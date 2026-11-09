import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import ClientPicker from './ClientPicker'

const idr = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0)

const ROLES = [
  { key: 'developer_id', role: 'developer', label: 'Developer' },
  { key: 'designer_id', role: 'designer', label: 'Desainer' },
  { key: 'sales_id', role: 'sales', label: 'Sales' },
]

function Field({ label, children, className = '' }) {
  return (
    <div className={className}>
      <label className="label-field">{label}</label>
      {children}
    </div>
  )
}

// Edit proyek. Perubahan harga, klien, dan tim ikut otomatis ke invoice
// proyek, aset, kontrak, dan komisi yang belum dibayar (fungsi project_update).
export default function ProjectEditDialog({ project, onClose, onSaved }) {
  const [form, setForm] = useState({
    client_id: project.client_id || '',
    website_name: project.website_name || '',
    service_category_id: project.service_category_id || '',
    project_date: project.project_date || '',
    deal_price: project.deal_price ?? '',
    budget_limit: project.budget_limit ?? '',
    developer_id: project.developer_id || '',
    designer_id: project.designer_id || '',
    sales_id: project.sales_id || '',
    notes: project.notes || '',
  })
  const [lists, setLists] = useState({ clients: [], categories: [], staff: [] })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  useEffect(() => {
    Promise.all([
      supabase.from('acc_clients').select('id, company_name').order('company_name'),
      supabase.from('acc_service_categories').select('id, name').order('name'),
      supabase.from('acc_staff_members').select('id, name, role_type, is_active').order('name'),
    ]).then(([c, k, s]) => setLists({ clients: c.data || [], categories: k.data || [], staff: s.data || [] }))
  }, [])

  const priceChanged = Number(form.deal_price) !== Number(project.deal_price)
  const clientChanged = form.client_id !== project.client_id

  const save = async () => {
    if (!form.client_id) return setError('Pilih klien.')
    if (form.deal_price === '' || Number(form.deal_price) < 0) return setError('Isi harga jual.')
    setBusy(true)
    setError('')
    const { data, error: err } = await supabase.rpc('project_update', {
      p_project_id: project.id,
      p_patch: { ...form, deal_price: Number(form.deal_price), budget_limit: form.budget_limit === '' ? '' : Number(form.budget_limit) },
    })
    setBusy(false)
    if (err) return setError(err.message)
    onSaved(data?.notes || [])
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4">
      <div className="glass-panel w-full max-w-2xl rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">Edit Proyek {project.website_name}</h3>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white" aria-label="Tutup">
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Klien" className="sm:col-span-2">
            <ClientPicker
              clients={lists.clients}
              value={form.client_id}
              onChange={(id) => set({ client_id: id })}
              onCreated={(c) => setLists((l) => ({ ...l, clients: [...l.clients, c].sort((a, b) => a.company_name.localeCompare(b.company_name)) }))}
            />
          </Field>
          <Field label="Nama Website / Proyek">
            <input className="input-field" value={form.website_name} onChange={(e) => set({ website_name: e.target.value })} />
          </Field>
          <Field label="Kategori Layanan">
            <select className="input-field" value={form.service_category_id} onChange={(e) => set({ service_category_id: e.target.value })}>
              <option value="">-</option>
              {lists.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tanggal Proyek">
            <input type="date" className="input-field" value={form.project_date} onChange={(e) => set({ project_date: e.target.value })} />
          </Field>
          <Field label="Harga Jual (Rp)">
            <input type="number" min="0" className="input-field" value={form.deal_price} onChange={(e) => set({ deal_price: e.target.value })} />
          </Field>
          <Field label="Batas Anggaran Beban (opsional)">
            <input type="number" min="0" className="input-field" value={form.budget_limit} onChange={(e) => set({ budget_limit: e.target.value })} />
          </Field>
          {ROLES.map((r) => (
            <Field key={r.key} label={r.label}>
              <select className="input-field" value={form[r.key]} onChange={(e) => set({ [r.key]: e.target.value })}>
                <option value="">Tidak ditugaskan</option>
                {lists.staff
                  .filter((s) => (s.is_active !== false && (s.role_type === r.role || s.role_type === 'lainnya')) || s.id === form[r.key])
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </Field>
          ))}
          <Field label="Catatan" className="sm:col-span-2">
            <input className="input-field" value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
        </div>

        {(priceChanged || clientChanged) && (
          <div className="mt-4 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-xs text-cyan-200">
            <p className="font-semibold">Ikut berubah otomatis saat disimpan:</p>
            <ul className="mt-1 list-disc pl-4">
              {priceChanged && (
                <>
                  <li>
                    Invoice proyek menyesuaikan harga baru ({idr(project.deal_price)} → {idr(form.deal_price)}), termasuk piutang, status Lunas, dan Buku Besar.
                  </li>
                  <li>Komisi tim yang belum dibayar disesuaikan sebanding dengan harga baru.</li>
                </>
              )}
              {clientChanged && <li>Invoice, aset digital, kontrak, dan langganan proyek ini pindah ke klien baru.</li>}
            </ul>
          </div>
        )}
        <p className="mt-3 text-[11px] text-slate-500">Bila staf tim diganti, komisi yang belum dibayar ikut pindah ke staf baru. Komisi yang sudah dibayar atau masuk slip gaji tidak diubah.</p>

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary !py-2 text-xs">
            Batal
          </button>
          <button type="button" onClick={save} disabled={busy} className="btn-primary !py-2 text-xs disabled:opacity-60">
            {busy ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </div>
    </div>
  )
}
