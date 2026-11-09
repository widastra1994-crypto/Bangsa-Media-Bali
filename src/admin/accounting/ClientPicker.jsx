import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'

export const CLIENT_TYPE_OPTIONS = [
  { value: 'perorangan', label: 'Perorangan' },
  { value: 'badan_usaha', label: 'Badan Usaha' },
]

const NEW = '__new__'
const EMPTY = { client_type: 'perorangan', company_name: '', pic_name: '', email: '', phone_primary: '', phone_secondary: '', business_type: '', address: '' }

// Pilihan klien + "Tambah klien baru" langsung di tempat. Klien baru
// disimpan ke Master Data Klien (acc_clients) dengan isian yang sama seperti
// di Master Data, lalu langsung terpilih.
export default function ClientPicker({ clients, value, onChange, onCreated, showEmail = false }) {
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }))
    setError('')
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
      <select
        className="input-field"
        value={adding ? NEW : value || ''}
        onChange={(e) => {
          if (e.target.value === NEW) return setAdding(true)
          setAdding(false)
          onChange(e.target.value)
        }}
      >
        <option value="">Pilih klien</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.company_name}
            {showEmail && c.email ? ` (${c.email})` : ''}
          </option>
        ))}
        <option value={NEW}>+ Tambah klien baru…</option>
      </select>

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
