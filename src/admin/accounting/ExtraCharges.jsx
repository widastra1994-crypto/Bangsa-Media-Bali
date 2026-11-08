import { useState } from 'react'
import { CheckCircle2, Plus, Trash2, X } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import ShareInvoice from '../assets/ShareInvoice'

const idr = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0)
const todayLocal = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Makassar' })

export const emptyExtra = () => ({ description: '', amount: '' })

// Baris yang benar-benar diisi (keterangan atau nominal), sudah dirapikan.
export const filledExtras = (rows) =>
  rows.map((r) => ({ description: r.description.trim(), amount: Number(r.amount) || 0 })).filter((r) => r.description || r.amount)

export const extrasTotal = (rows) => filledExtras(rows).reduce((s, r) => s + r.amount, 0)

// null bila valid, atau pesan kesalahan.
export function extrasError(rows) {
  const rowsFilled = filledExtras(rows)
  if (rowsFilled.some((r) => !r.description)) return 'Isi keterangan untuk setiap pembayaran tambahan.'
  if (rowsFilled.some((r) => r.amount <= 0)) return 'Isi nominal untuk setiap pembayaran tambahan.'
  return null
}

// Daftar rincian tagihan dengan keterangan bebas (mis. "Iklan Meta Ads
// Desember", "Revisi tambahan"), bisa ditambah/dihapus barisnya.
export function ExtraChargeRows({ rows, onChange, placeholder = 'Keterangan, mis. Iklan Meta Ads Desember' }) {
  const update = (i, patch) => onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="flex gap-2">
          <input className="input-field flex-1" placeholder={placeholder} value={r.description} onChange={(e) => update(i, { description: e.target.value })} />
          <input
            type="number"
            min="0"
            className="input-field !w-40"
            placeholder="Nominal (Rp)"
            value={r.amount}
            onChange={(e) => update(i, { amount: e.target.value })}
          />
          <button
            type="button"
            onClick={() => onChange(rows.length > 1 ? rows.filter((_, idx) => idx !== i) : [emptyExtra()])}
            className="shrink-0 px-1 text-slate-500 hover:text-red-400"
            aria-label="Hapus baris"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => onChange([...rows, emptyExtra()])} className="flex items-center gap-1 text-xs font-semibold text-cyan-royal hover:underline">
          <Plus size={13} /> Tambah baris
        </button>
        {extrasTotal(rows) > 0 && <span className="text-xs text-slate-400">Total tambahan: {idr(extrasTotal(rows))}</span>}
      </div>
    </div>
  )
}

// Buat invoice "Tagihan Tambahan" untuk proyek yang sudah berjalan, lalu
// langsung tampilkan tombol bagikan ke klien.
export function AdditionalChargeDialog({ project, onClose, onCreated }) {
  const [rows, setRows] = useState([emptyExtra()])
  const [due, setDue] = useState(todayLocal())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [invoice, setInvoice] = useState(null)
  const client = project.acc_clients

  const submit = async () => {
    const msg = extrasError(rows) || (extrasTotal(rows) <= 0 ? 'Isi minimal satu pembayaran tambahan.' : null)
    if (msg) return setError(msg)
    setBusy(true)
    setError('')
    const { data: invoiceId, error: err } = await supabase.rpc('invoice_create_with_items', {
      p_client_id: project.client_id,
      p_project_id: project.id,
      p_invoice_type: 'additional',
      p_due: due,
      p_items: filledExtras(rows).map((r) => ({ ...r, kind: 'extra' })),
    })
    if (err) {
      setBusy(false)
      return setError(err.message)
    }
    const { data } = await supabase.from('acc_invoices').select('*').eq('id', invoiceId).maybeSingle()
    setBusy(false)
    setInvoice(data)
    onCreated?.(data)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4">
      <div className="glass-panel w-full max-w-xl rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">Tagihan Tambahan</h3>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white" aria-label="Tutup">
            <X size={18} />
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          {client?.company_name} · {project.website_name || 'Proyek'}
        </p>

        {!invoice ? (
          <>
            <p className="mt-4 text-xs text-slate-400">Isi keterangan pembayaran sesuai kebutuhan, misalnya iklan, revisi, atau fitur tambahan. Semua baris masuk ke satu invoice.</p>
            <div className="mt-3">
              <ExtraChargeRows rows={rows} onChange={setRows} />
            </div>
            <div className="mt-4">
              <label className="label-field">Jatuh Tempo</label>
              <input type="date" className="input-field !w-44" value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
            {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="btn-secondary !py-2 text-xs">
                Batal
              </button>
              <button type="button" onClick={submit} disabled={busy} className="btn-primary !py-2 text-xs disabled:opacity-60">
                {busy ? 'Menerbitkan...' : `Terbitkan Invoice ${extrasTotal(rows) > 0 ? idr(extrasTotal(rows)) : ''}`}
              </button>
            </div>
          </>
        ) : (
          <div className="mt-4">
            <p className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              <CheckCircle2 size={16} /> Invoice {invoice.invoice_number} ({idr(invoice.total_amount)}) diterbitkan.
            </p>
            <p className="mt-4 text-xs text-slate-400">Bagikan ke klien:</p>
            <div className="mt-2">
              <ShareInvoice invoice={invoice} client={client} />
            </div>
            <p className="mt-3 text-[11px] text-slate-500">Pembayarannya dicatat di menu Invoice & Piutang seperti invoice lain.</p>
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={onClose} className="btn-primary !py-2 text-xs">
                Selesai
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
