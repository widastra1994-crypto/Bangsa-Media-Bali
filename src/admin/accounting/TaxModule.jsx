import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Download, Save } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { exportToCsv } from './csvExport'

const idr = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0)

function TaxProfileForm({ profile, onSaved }) {
  const [form, setForm] = useState(profile)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    setSaving(true)
    setError('')
    const { error: err } = await supabase.from('acc_tax_profile').upsert({ ...form, id: 1, updated_at: new Date().toISOString() })
    setSaving(false)
    if (err) setError(err.message)
    else onSaved(form)
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gold-soft">Profil Pajak</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label-field">Nama Usaha / Wajib Pajak</label>
          <input className="input-field" value={form.business_name || ''} onChange={(e) => setForm({ ...form, business_name: e.target.value })} />
        </div>
        <div>
          <label className="label-field">NPWP (16 digit) / NIK</label>
          <input className="input-field" value={form.npwp || ''} onChange={(e) => setForm({ ...form, npwp: e.target.value })} />
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input type="checkbox" checked={Boolean(form.is_pkp)} onChange={(e) => setForm({ ...form, is_pkp: e.target.checked })} className="h-4 w-4 accent-gold" />
          Terdaftar sebagai PKP (Pengusaha Kena Pajak)
        </label>
        <div />
        <div>
          <label className="label-field">Tarif PPh Final UMKM (%)</label>
          <input type="number" step="0.1" className="input-field" value={form.pph_final_rate} onChange={(e) => setForm({ ...form, pph_final_rate: Number(e.target.value) })} />
        </div>
        <div>
          <label className="label-field">Tarif PPh Pasal 23 (%)</label>
          <input type="number" step="0.1" className="input-field" value={form.pph23_rate} onChange={(e) => setForm({ ...form, pph23_rate: Number(e.target.value) })} />
        </div>
        <div>
          <label className="label-field">Tarif PPN (%)</label>
          <input type="number" step="0.1" className="input-field" value={form.ppn_rate} onChange={(e) => setForm({ ...form, ppn_rate: Number(e.target.value) })} />
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      <button type="button" disabled={saving} onClick={save} className="btn-primary mt-4 !py-2 text-xs disabled:opacity-60">
        <Save size={14} /> {saving ? 'Menyimpan...' : 'Simpan Profil Pajak'}
      </button>
      <p className="mt-3 text-[11px] text-slate-500">
        Tarif di atas bisa disesuaikan sendiri. Ini adalah alat estimasi internal, bukan sistem lapor pajak resmi -- selalu verifikasi dengan konsultan pajak sebelum menyampaikan SPT.
      </p>
    </div>
  )
}

export default function TaxModule() {
  const [profile, setProfile] = useState(null)
  const [payments, setPayments] = useState([])
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      supabase.from('acc_tax_profile').select('*').eq('id', 1).maybeSingle(),
      supabase.from('acc_payments').select('*'),
      supabase.from('acc_invoices').select('*, acc_clients(company_name)').eq('is_pph23_withheld', true),
    ]).then(([prof, pay, inv]) => {
      setProfile(
        prof.data || { id: 1, npwp: '', is_pkp: false, business_name: '', pph_final_rate: 0.5, pph23_rate: 2, ppn_rate: 11 },
      )
      if (prof.error) setError(prof.error.message)
      setPayments(pay.data || [])
      setInvoices(inv.data || [])
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const monthlyPayments = useMemo(
    () => payments.filter((p) => { const d = new Date(p.payment_date); return d.getMonth() === month && d.getFullYear() === year }),
    [payments, month, year],
  )
  const monthlyPph23 = useMemo(
    () => invoices.filter((i) => { const d = new Date(i.created_at); return d.getMonth() === month && d.getFullYear() === year }),
    [invoices, month, year],
  )

  const omzetBruto = monthlyPayments.reduce((s, p) => s + Number(p.amount_paid), 0)
  const pphFinalEstimate = profile ? (omzetBruto * Number(profile.pph_final_rate)) / 100 : 0
  const totalPph23 = monthlyPph23.reduce((s, i) => s + (Number(i.subtotal) * Number(profile?.pph23_rate || 0)) / 100, 0)

  const exportReport = () => {
    exportToCsv(`laporan-pajak-${year}-${month + 1}`, [
      {
        Bulan: `${month + 1}/${year}`,
        'Omzet Bruto': omzetBruto,
        'Tarif PPh Final (%)': profile.pph_final_rate,
        'Estimasi PPh Final': pphFinalEstimate,
        'Total PPh 23 Dipotong': totalPph23,
        'Jumlah Invoice Kena PPh 23': monthlyPph23.length,
      },
    ])
  }

  if (loading || !profile) return <p className="text-sm text-slate-400">Memuat...</p>

  return (
    <div>
      <h2 className="text-lg font-semibold text-white">Pajak (Estimasi 2026)</h2>
      <p className="mt-1 text-sm text-slate-400">Estimasi kewajiban pajak berbasis data transaksi. Bukan pengganti konsultasi resmi ke konsultan pajak.</p>

      {error && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-red-400">
          <AlertTriangle size={13} /> {error}
        </p>
      )}

      <div className="mt-5">
        <TaxProfileForm profile={profile} onSaved={setProfile} />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gold-soft">Laporan Bulanan</h3>
        <div className="flex items-center gap-2">
          <select className="input-field !py-1.5 text-xs" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {Array.from({ length: 12 }).map((_, i) => (
              <option key={i} value={i}>
                {new Date(2026, i, 1).toLocaleDateString('id-ID', { month: 'long' })}
              </option>
            ))}
          </select>
          <input type="number" className="input-field !w-24 !py-1.5 text-xs" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          <button type="button" onClick={exportReport} className="btn-secondary !px-3 !py-1.5 text-xs">
            <Download size={13} /> Ekspor CSV
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-slate-400">Omzet Bruto Bulanan</p>
          <p className="text-lg font-bold text-white">{idr(omzetBruto)}</p>
        </div>
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-xs text-amber-300">Estimasi PPh Final ({profile.pph_final_rate}%)</p>
          <p className="text-lg font-bold text-amber-300">{idr(pphFinalEstimate)}</p>
        </div>
        <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4">
          <p className="text-xs text-cyan-300">Total PPh 23 Dipotong</p>
          <p className="text-lg font-bold text-cyan-300">{idr(totalPph23)}</p>
        </div>
      </div>

      {monthlyPph23.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/5 text-slate-400">
              <tr>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Klien</th>
                <th className="px-4 py-3">Nomor Bukti Potong</th>
                <th className="px-4 py-3">Nominal Dipotong</th>
              </tr>
            </thead>
            <tbody>
              {monthlyPph23.map((i) => (
                <tr key={i.id} className="border-t border-white/5 text-slate-300">
                  <td className="px-4 py-3">{i.invoice_number}</td>
                  <td className="px-4 py-3">{i.acc_clients?.company_name}</td>
                  <td className="px-4 py-3">{i.pph23_bukti_potong || '-'}</td>
                  <td className="px-4 py-3">{idr((Number(i.subtotal) * Number(profile.pph23_rate)) / 100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
