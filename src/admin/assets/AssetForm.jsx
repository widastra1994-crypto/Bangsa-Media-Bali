import { useState } from 'react'
import { Plus, RefreshCw, Trash2, X } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import ClientPicker from '../accounting/ClientPicker'
import { ASSET_TYPES, CYCLES, STATUS_LABEL, assetTypeLabel, cycleLabel, idr } from './assetUtils'

const EMPTY = {
  asset_type: 'domain',
  client_id: '',
  project_id: '',
  vendor_id: '',
  domain_name: '',
  website_url: '',
  registration_date: '',
  expiry_date: '',
  cycle_months: 12,
  cost_price: '',
  sell_price: '',
  auto_invoice: true,
  record_cost: false,
  status: 'active',
  notes: '',
}

function addMonths(dateStr, months) {
  if (!dateStr) return ''
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + Number(months))
  return d.toISOString().slice(0, 10)
}

const emptyLine = () => ({ description: '', cost_price: '', sell_price: '' })

// Rincian biaya perpanjangan: semua baris ikut masuk ke setiap invoice
// perpanjangan (mis. hosting + backup + email bisnis + lisensi).
function PriceItemsEditor({ lines, onChange, cycleMonths }) {
  const update = (i, patch) => onChange(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  const cost = lines.reduce((s, l) => s + (Number(l.cost_price) || 0), 0)
  const sell = lines.reduce((s, l) => s + (Number(l.sell_price) || 0), 0)
  return (
    <div className="rounded-2xl border-2 border-cyan-royal/40 p-4">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-cyan-royal">
        <RefreshCw size={14} /> Rincian Perpanjangan
      </p>
      <p className="mt-0.5 text-[11px] text-slate-500">Semua baris ini otomatis masuk ke invoice setiap kali perpanjangan.</p>
      <div className="mt-3 hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)_24px] gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:grid">
        <span>Keterangan</span>
        <span>Modal</span>
        <span>Jual ke klien</span>
        <span />
      </div>
      <div className="mt-1 space-y-2">
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)_24px]">
            <input
              className="input-field col-span-2 sm:col-span-1"
              placeholder="mis. Backup harian, Email bisnis, Lisensi plugin"
              value={l.description}
              onChange={(e) => update(i, { description: e.target.value })}
            />
            <input type="number" min="0" className="input-field" placeholder="Modal" value={l.cost_price} onChange={(e) => update(i, { cost_price: e.target.value })} />
            <input type="number" min="0" className="input-field" placeholder="Jual" value={l.sell_price} onChange={(e) => update(i, { sell_price: e.target.value })} />
            <button
              type="button"
              onClick={() => onChange(lines.length > 1 ? lines.filter((_, idx) => idx !== i) : [emptyLine()])}
              className="col-span-2 justify-self-end text-slate-500 hover:text-red-400 sm:col-span-1"
              aria-label="Hapus baris"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => onChange([...lines, emptyLine()])} className="mt-3 flex items-center gap-1 text-xs font-semibold text-cyan-royal hover:underline">
        <Plus size={13} /> Tambah baris perpanjangan
      </button>
      <p className="mt-3 text-xs text-slate-400">
        Total per {cycleLabel(cycleMonths).toLowerCase()}: jual <b className="text-white">{idr(sell)}</b> · modal {idr(cost)} · margin{' '}
        <b className={sell - cost >= 0 ? 'text-emerald-400' : 'text-red-400'}>{idr(sell - cost)}</b>
      </p>
    </div>
  )
}

function Field({ label, hint, children, className = '' }) {
  return (
    <div className={className}>
      <label className="label-field">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  )
}

export default function AssetForm({ asset, clients, projects, vendors, canDelete, onClose, onSaved }) {
  const isNew = !asset?.id
  const [form, setForm] = useState(() =>
    isNew
      ? { ...EMPTY, ...asset }
      : Object.fromEntries(Object.keys(EMPTY).map((k) => [k, asset[k] ?? EMPTY[k]])),
  )
  const [lines, setLines] = useState(() => {
    const existing = [...(asset?.acc_asset_price_items || [])].sort((a, b) => a.sort - b.sort)
    return existing.length
      ? existing.map((l) => ({ description: l.description, cost_price: Number(l.cost_price), sell_price: Number(l.sell_price) }))
      : [emptyLine()]
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const [clientList, setClientList] = useState(clients)
  const clientProjects = projects.filter((p) => p.client_id === form.client_id)

  const save = async () => {
    if (!form.client_id) return setError('Pilih klien.')
    if (!form.domain_name.trim()) return setError('Isi nama domain / nama layanan.')
    if (!form.expiry_date) return setError('Isi tanggal habis masa aktif.')
    const items = lines
      .map((l, i) => ({
        // Baris pertama tanpa keterangan diberi nama layanannya.
        description: l.description.trim() || (i === 0 ? `${assetTypeLabel(form.asset_type)} ${form.domain_name.trim()}` : ''),
        cost_price: Number(l.cost_price) || 0,
        sell_price: Number(l.sell_price) || 0,
      }))
      .filter((l, i) => i === 0 || l.description || l.cost_price || l.sell_price)
    if (items.some((l) => !l.description)) return setError('Isi keterangan untuk setiap rincian perpanjangan.')
    setBusy(true)
    setError('')
    const payload = {
      ...form,
      client_id: form.client_id,
      project_id: form.project_id || null,
      vendor_id: form.vendor_id || null,
      domain_name: form.domain_name.trim(),
      website_url: form.website_url.trim() || null,
      registration_date: form.registration_date || null,
      cycle_months: Number(form.cycle_months),
      cost_price: items.reduce((s, l) => s + l.cost_price, 0),
      sell_price: items.reduce((s, l) => s + l.sell_price, 0),
      notes: form.notes.trim() || null,
    }
    const res = isNew
      ? await supabase.from('acc_digital_assets').insert(payload).select('id').single()
      : await supabase.from('acc_digital_assets').update(payload).eq('id', asset.id)
    if (res.error) {
      setBusy(false)
      return setError(res.error.message)
    }
    const { error: itemsErr } = await supabase.rpc('asset_save_price_items', { p_asset_id: isNew ? res.data.id : asset.id, p_items: items })
    setBusy(false)
    if (itemsErr) return setError(`Aset tersimpan, tapi rincian perpanjangan gagal disimpan: ${itemsErr.message}`)
    onSaved(isNew ? 'Aset ditambahkan.' : 'Aset diperbarui.')
  }

  const remove = async () => {
    if (!window.confirm(`Hapus aset ${asset.domain_name}? Riwayat perpanjangannya ikut terhapus. Invoice yang sudah terbit tidak ikut terhapus.`)) return
    setBusy(true)
    const { error: err } = await supabase.from('acc_digital_assets').delete().eq('id', asset.id)
    setBusy(false)
    if (err) return setError(err.message)
    onSaved('Aset dihapus.')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4">
      <div className="glass-panel w-full max-w-2xl rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">{isNew ? 'Tambah Aset Digital' : `Edit ${asset.domain_name || 'Aset'}`}</h3>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white" aria-label="Tutup">
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Jenis Layanan">
            <select className="input-field" value={form.asset_type} onChange={(e) => set({ asset_type: e.target.value })}>
              {ASSET_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={form.asset_type === 'domain' ? 'Nama Domain' : 'Nama Layanan'} hint={form.asset_type === 'domain' ? 'Contoh: namaklien.com' : 'Contoh: Hosting 2GB namaklien.com'}>
            <input className="input-field" value={form.domain_name} onChange={(e) => set({ domain_name: e.target.value })} />
          </Field>
          <Field label="Klien" className="sm:col-span-2">
            <ClientPicker
              clients={clientList}
              value={form.client_id}
              onChange={(id) => set({ client_id: id, project_id: '' })}
              onCreated={(c) => setClientList((list) => [...list, c].sort((a, b) => a.company_name.localeCompare(b.company_name)))}
            />
          </Field>
          <Field label="Proyek (opsional)" hint="Kosongkan bila klien hanya membeli domain/server.">
            <select className="input-field" value={form.project_id || ''} onChange={(e) => set({ project_id: e.target.value })} disabled={!form.client_id}>
              <option value="">Tanpa proyek</option>
              {clientProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.website_name || 'Proyek'}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Vendor">
            <select className="input-field" value={form.vendor_id || ''} onChange={(e) => set({ vendor_id: e.target.value })}>
              <option value="">Pilih vendor</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.vendor_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Siklus Perpanjangan">
            <select
              className="input-field"
              value={form.cycle_months}
              onChange={(e) => set({ cycle_months: Number(e.target.value), expiry_date: form.expiry_date || addMonths(form.registration_date, e.target.value) })}
            >
              {CYCLES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tanggal Mulai / Registrasi">
            <input
              type="date"
              className="input-field"
              value={form.registration_date || ''}
              onChange={(e) => set({ registration_date: e.target.value, expiry_date: form.expiry_date || addMonths(e.target.value, form.cycle_months) })}
            />
          </Field>
          <Field label="Tanggal Habis Masa Aktif">
            <input type="date" className="input-field" value={form.expiry_date || ''} onChange={(e) => set({ expiry_date: e.target.value })} />
          </Field>
          <div className="sm:col-span-2">
            <PriceItemsEditor lines={lines} onChange={setLines} cycleMonths={form.cycle_months} />
          </div>
          {(form.asset_type === 'domain' || form.asset_type === 'server') && (
            <Field label="URL Website (opsional)" hint="Untuk pemantauan website online/down." className="sm:col-span-2">
              <input className="input-field" value={form.website_url || ''} onChange={(e) => set({ website_url: e.target.value })} placeholder="https://" />
            </Field>
          )}
          {!isNew && (
            <Field label="Status">
              <select className="input-field" value={form.status} onChange={(e) => set({ status: e.target.value })}>
                {Object.entries(STATUS_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Catatan" className={isNew ? 'sm:col-span-2' : ''}>
            <input className="input-field" value={form.notes || ''} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
        </div>

        <div className="mt-4 space-y-2 text-xs text-slate-300">
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-0.5 h-3.5 w-3.5 accent-gold" checked={form.auto_invoice} onChange={(e) => set({ auto_invoice: e.target.checked })} />
            <span>Terbitkan invoice perpanjangan otomatis & kirim email ke klien sebelum masa aktif habis.</span>
          </label>
          {isNew && (
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-0.5 h-3.5 w-3.5 accent-gold" checked={form.record_cost} onChange={(e) => set({ record_cost: e.target.checked })} />
              <span>
                Catat harga modal sebagai beban di Buku Besar (rekening "belum ditentukan"). Biarkan kosong untuk aset lama atau bila pembayaran ke vendor
                dicatat lewat menu Pengeluaran.
              </span>
            </label>
          )}
        </div>

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          {!isNew && canDelete ? (
            <button type="button" onClick={remove} disabled={busy} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300">
              <Trash2 size={13} /> Hapus aset
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-secondary !py-2 text-xs">
              Batal
            </button>
            <button type="button" onClick={save} disabled={busy} className="btn-primary !py-2 text-xs disabled:opacity-60">
              {busy ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
