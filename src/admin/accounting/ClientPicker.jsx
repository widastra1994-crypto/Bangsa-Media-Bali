import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search, UserPlus } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'

export const CLIENT_TYPE_OPTIONS = [
  { value: 'perorangan', label: 'Perorangan' },
  { value: 'badan_usaha', label: 'Badan Usaha' },
]

const EMPTY = { client_type: 'perorangan', company_name: '', pic_name: '', email: '', phone_primary: '', phone_secondary: '', business_type: '', address: '' }

// Pilihan klien yang bisa dicari (nama, PIC, email, telepon) + "Tambah klien
// baru" tepat di bawah kolom cari. Klien baru
// disimpan ke Master Data Klien (acc_clients) dengan isian yang sama seperti
// di Master Data, lalu langsung terpilih.
export default function ClientPicker({ clients, value, onChange, onCreated, showEmail = false }) {
  const [adding, setAdding] = useState(false)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const boxRef = useRef(null)
  const searchRef = useRef(null)
  const listRef = useRef(null)
  const [form, setForm] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }))
    setError('')
  }

  const selected = clients.find((c) => c.id === value)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return clients
    return clients.filter((c) => [c.company_name, c.pic_name, c.email, c.phone_primary].some((v) => v?.toLowerCase().includes(q)))
  }, [clients, query])
  // Baris 0 = "Tambah klien baru", baris 1.. = klien hasil pencarian.
  const rowCount = filtered.length + 1

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => boxRef.current && !boxRef.current.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', onDown)
    searchRef.current?.focus()
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  useEffect(() => {
    listRef.current?.querySelector(`[data-row="${cursor}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  const startAdding = () => {
    setForm({ ...EMPTY, company_name: query.trim() })
    setAdding(true)
    setOpen(false)
    setQuery('')
  }
  const pick = (id) => {
    onChange(id)
    setAdding(false)
    setOpen(false)
    setQuery('')
  }
  const choose = (row) => (row === 0 ? startAdding() : pick(filtered[row - 1].id))

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => Math.min(c + 1, rowCount - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => Math.max(c - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(cursor)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const save = async () => {
    if (!form.company_name.trim()) return setError('Isi nama klien.')
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return setError('Isi email yang valid (dipakai untuk kirim invoice).')
    setBusy(true)
    const payload = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, typeof v === 'string' ? v.trim() || null : v]))
    const { data, error: err } = await supabase.from('acc_clients').insert(payload).select().single()
    setBusy(false)
    if (err) return setError(err.message)
    onCreated?.(data)
    onChange(data.id)
    setAdding(false)
    setForm(EMPTY)
  }

  return (
    <div>
      <div ref={boxRef} className="relative">
        <button
          type="button"
          onClick={() => {
            setOpen((o) => !o)
            setCursor(filtered.length ? 1 : 0)
          }}
          className="input-field flex items-center justify-between gap-2 text-left"
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className={`truncate ${selected || adding ? '' : 'text-slate-500'}`}>
            {adding ? '+ Klien baru' : selected ? `${selected.company_name}${showEmail && selected.email ? ` (${selected.email})` : ''}` : 'Pilih klien'}
          </span>
          <ChevronDown size={15} className="shrink-0 text-slate-500" />
        </button>

        {open && (
          <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-white/15 bg-white shadow-2xl">
            <div className="border-b border-white/10 p-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  ref={searchRef}
                  className="input-field !py-1.5 !pl-8 text-sm"
                  placeholder="Cari nama, PIC, email, atau telepon..."
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setCursor(1)
                  }}
                  onKeyDown={onKeyDown}
                  aria-label="Cari klien"
                />
              </div>
            </div>
            <ul ref={listRef} role="listbox" className="max-h-64 overflow-y-auto py-1 text-sm">
              <li
                data-row={0}
                role="option"
                aria-selected={cursor === 0}
                onMouseEnter={() => setCursor(0)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  startAdding()
                }}
                className={`flex cursor-pointer items-center gap-2 border-b border-white/10 px-3 py-2 font-semibold text-cyan-royal ${cursor === 0 ? 'bg-sky-50' : ''}`}
              >
                <UserPlus size={14} /> Tambah klien baru{query.trim() ? ` "${query.trim()}"` : ''}
              </li>
              {filtered.map((c, i) => (
                <li
                  key={c.id}
                  data-row={i + 1}
                  role="option"
                  aria-selected={c.id === value}
                  onMouseEnter={() => setCursor(i + 1)}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    pick(c.id)
                  }}
                  className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2 ${cursor === i + 1 ? 'bg-sky-50' : ''}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-white">{c.company_name}</span>
                    {(c.pic_name || c.email) && (
                      <span className="block truncate text-[11px] text-slate-500">{[c.pic_name, c.email].filter(Boolean).join(' · ')}</span>
                    )}
                  </span>
                  {c.id === value && <Check size={14} className="shrink-0 text-cyan-royal" />}
                </li>
              ))}
              {filtered.length === 0 && <li className="px-3 py-3 text-center text-xs text-slate-500">Klien tidak ditemukan. Pilih "Tambah klien baru" di atas.</li>}
            </ul>
          </div>
        )}
      </div>

      {adding && (
        <div className="mt-3 rounded-2xl border-2 border-cyan-royal/40 p-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-cyan-royal">
            <UserPlus size={14} /> Klien baru
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">Otomatis tersimpan ke Master Data Klien dengan isian yang sama.</p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label-field">Tipe Klien</label>
              <select className="input-field" value={form.client_type} onChange={(e) => set({ client_type: e.target.value })}>
                {CLIENT_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field">Nama Entitas/Klien *</label>
              <input className="input-field" value={form.company_name} onChange={(e) => set({ company_name: e.target.value })} />
            </div>
            <div>
              <label className="label-field">Nama PIC</label>
              <input className="input-field" value={form.pic_name} onChange={(e) => set({ pic_name: e.target.value })} />
            </div>
            <div>
              <label className="label-field">Email Aktif *</label>
              <input type="email" className="input-field" value={form.email} onChange={(e) => set({ email: e.target.value })} />
            </div>
            <div>
              <label className="label-field">Telepon Utama</label>
              <input className="input-field" value={form.phone_primary} onChange={(e) => set({ phone_primary: e.target.value })} placeholder="0812..." />
            </div>
            <div>
              <label className="label-field">Telepon Darurat</label>
              <input className="input-field" value={form.phone_secondary} onChange={(e) => set({ phone_secondary: e.target.value })} />
            </div>
            <div>
              <label className="label-field">Tipe Usaha</label>
              <input className="input-field" value={form.business_type} onChange={(e) => set({ business_type: e.target.value })} placeholder="Travel, Hotel/Villa, F&B, dsb." />
            </div>
            <div>
              <label className="label-field">Alamat</label>
              <input className="input-field" value={form.address} onChange={(e) => set({ address: e.target.value })} />
            </div>
          </div>
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setAdding(false)
                setError('')
              }}
              className="btn-secondary !py-1.5 text-xs"
            >
              Batal
            </button>
            <button type="button" onClick={save} disabled={busy} className="btn-primary !py-1.5 text-xs disabled:opacity-60">
              {busy ? 'Menyimpan...' : 'Simpan klien'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
