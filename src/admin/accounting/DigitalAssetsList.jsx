import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Mail, RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { sendFinanceEmail } from '../../lib/financeEmail'

const idr = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0)

const STATUS_LABEL = { active: 'Aktif', pending_renewal: 'Menunggu Perpanjangan', grace_period: 'Masa Tenggang', expired: 'Kedaluwarsa', terminated: 'Dihentikan' }
const STATUS_OPTIONS = Object.keys(STATUS_LABEL)
const STATUS_COLOR = {
  active: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
  pending_renewal: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
  grace_period: 'bg-orange-500/20 text-orange-300 border-orange-400/30',
  expired: 'bg-red-500/20 text-red-300 border-red-400/30',
  terminated: 'bg-slate-500/20 text-slate-400 border-slate-400/30',
}

function daysUntil(dateStr) {
  if (!dateStr) return null
  const diff = new Date(dateStr).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)
  return Math.round(diff / (1000 * 60 * 60 * 24))
}

function RenewalForm({ asset, onDone }) {
  const defaultAmount = (Number(asset.domain_cost) || 0) + (Number(asset.server_cost) || 0)
  const [amount, setAmount] = useState(defaultAmount)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      const invoiceType = Number(asset.server_cost) > 0 && !(Number(asset.domain_cost) > 0) ? 'server_renewal' : 'domain_renewal'
      const dueDate = new Date().toISOString().slice(0, 10)
      const { data, error: err } = await supabase
        .from('acc_invoices')
        .insert({
          project_id: asset.project_id,
          client_id: asset.acc_projects.client_id,
          invoice_type: invoiceType,
          subtotal: Number(amount),
          total_amount: Number(amount),
          due_date: dueDate,
          status: 'sent',
        })
        .select()
      if (err) throw new Error(err.message)
      const invoice = data[0]

      const client = asset.acc_projects.acc_clients
      if (client?.email) {
        await sendFinanceEmail({
          type: 'invoice',
          to: client.email,
          clientName: client.company_name,
          docNumber: invoice.invoice_number,
          amount: Number(amount),
          dueDate,
          items: [{ label: `Perpanjangan ${asset.domain_name || 'aset'} (1 tahun)`, amount: Number(amount) }],
        })
      }
      onDone(invoice.invoice_number)
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <div className="mt-3 grid grid-cols-1 gap-3 rounded-xl border border-white/10 bg-white/5 p-4 sm:grid-cols-3">
      <input type="number" className="input-field" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Nominal perpanjangan" />
      <button type="button" disabled={busy} onClick={submit} className="btn-primary !py-2 text-xs disabled:opacity-60">
        {busy ? 'Menerbitkan...' : 'Terbitkan & Kirim Invoice'}
      </button>
      {error && <p className="col-span-full text-xs text-red-400">{error}</p>}
    </div>
  )
}

export default function DigitalAssetsList() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [renewingId, setRenewingId] = useState(null)
  const [notice, setNotice] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    supabase
      .from('acc_digital_assets')
      .select(
        '*, acc_projects(website_name, client_id, acc_clients(company_name, email)), domain_vendor:acc_vendors!acc_digital_assets_domain_vendor_id_fkey(vendor_name), server_vendor:acc_vendors!acc_digital_assets_server_vendor_id_fkey(vendor_name), acc_asset_reminder_log(stage, expiry_date)',
      )
      .order('expiry_date', { ascending: true })
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setRows(data || [])
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const updateStatus = async (id, status) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)))
    const { error: err } = await supabase.from('acc_digital_assets').update({ status }).eq('id', id)
    if (err) setError(err.message)
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-white">Aset Digital (Domain & Server)</h2>
      <p className="mt-1 text-sm text-slate-400">Dibuat otomatis dari Form Transaksi. Pantau masa aktif dan terbitkan invoice perpanjangan dari sini.</p>

      {error && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-red-400">
          <AlertTriangle size={14} /> {error}
        </p>
      )}
      {notice && <p className="mt-3 text-xs text-cyan-300">{notice}</p>}

      <div className="mt-4 space-y-3">
        {loading && <p className="text-sm text-slate-400">Memuat...</p>}
        {!loading && rows.length === 0 && <p className="text-sm text-slate-500">Belum ada aset digital.</p>}
        {rows.map((asset) => {
          const days = daysUntil(asset.expiry_date)
          const urgent = days !== null && days <= 30
          return (
            <div key={asset.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-white">{asset.domain_name || asset.acc_projects?.website_name || 'Aset'}</p>
                  <p className="text-xs text-slate-400">
                    {asset.acc_projects?.acc_clients?.company_name} &bull; {asset.acc_projects?.website_name}
                  </p>
                </div>
                <select
                  value={asset.status}
                  onChange={(e) => updateStatus(asset.id, e.target.value)}
                  className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${STATUS_COLOR[asset.status]}`}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s} className="bg-navy-950 text-white">
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-5">
                <div>
                  <p className="text-slate-500">Vendor Domain</p>
                  <p className="font-semibold text-white">{asset.domain_vendor?.vendor_name || '-'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Vendor Server</p>
                  <p className="font-semibold text-white">{asset.server_vendor?.vendor_name || '-'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Beban/Tahun</p>
                  <p className="font-semibold text-white">{idr(Number(asset.domain_cost) + Number(asset.server_cost))}</p>
                </div>
                <div>
                  <p className="text-slate-500">Kedaluwarsa</p>
                  <p className="font-semibold text-white">{asset.expiry_date || '-'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Sisa Waktu</p>
                  <p className={`font-semibold ${urgent ? 'text-amber-300' : 'text-emerald-400'}`}>
                    {days === null ? '-' : days < 0 ? `Lewat ${Math.abs(days)} hari` : `${days} hari`}
                  </p>
                </div>
              </div>

              {asset.acc_asset_reminder_log?.filter((r) => r.expiry_date === asset.expiry_date).length > 0 && (
                <p className="mt-3 text-[11px] text-slate-500">
                  Pengingat terkirim siklus ini:{' '}
                  {asset.acc_asset_reminder_log
                    .filter((r) => r.expiry_date === asset.expiry_date)
                    .map((r) => r.stage.toUpperCase())
                    .join(', ')}
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => setRenewingId(renewingId === asset.id ? null : asset.id)} className="btn-secondary !px-3 !py-1.5 text-xs">
                  <RefreshCw size={13} /> Buat Invoice Perpanjangan
                </button>
              </div>

              {renewingId === asset.id && (
                <RenewalForm
                  asset={asset}
                  onDone={(invNumber) => {
                    setRenewingId(null)
                    setNotice(`Invoice perpanjangan ${invNumber} berhasil diterbitkan & dikirim.`)
                    load()
                  }}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
