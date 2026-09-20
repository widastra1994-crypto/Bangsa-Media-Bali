import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useSupabaseTable } from './useSupabaseTable'
import { logAudit } from './auditLog'

const idr = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0)
const STATUS_LABEL = { unpaid: 'Belum Dibayar', partial: 'Sebagian Dibayar', paid: 'Lunas' }
const STATUS_COLOR = {
  unpaid: 'bg-red-500/20 text-red-300 border-red-400/30',
  partial: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
  paid: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
}

function NewBillForm({ vendors, onDone }) {
  const [form, setForm] = useState({ vendor_id: '', bill_number: '', description: '', amount: '', due_date: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!form.vendor_id || !form.amount) return
    setBusy(true)
    setError('')
    const { error: err } = await supabase.from('acc_vendor_bills').insert({ ...form, amount: Number(form.amount) })
    setBusy(false)
    if (err) setError(err.message)
    else {
      setForm({ vendor_id: '', bill_number: '', description: '', amount: '', due_date: '' })
      onDone()
    }
  }

  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl border border-white/10 bg-white/5 p-4 sm:grid-cols-3">
      <select className="input-field" value={form.vendor_id} onChange={(e) => setForm({ ...form, vendor_id: e.target.value })}>
        <option value="">Pilih Vendor...</option>
        {vendors.map((v) => (
          <option key={v.id} value={v.id}>
            {v.vendor_name}
          </option>
        ))}
      </select>
      <input className="input-field" placeholder="No. Tagihan Vendor (opsional)" value={form.bill_number} onChange={(e) => setForm({ ...form, bill_number: e.target.value })} />
      <input type="number" className="input-field" placeholder="Nominal (Rp)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
      <input className="input-field sm:col-span-2" placeholder="Deskripsi (mis. Sewa Hosting Tahunan)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      <input type="date" className="input-field" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
      <button type="button" disabled={busy || !form.vendor_id || !form.amount} onClick={submit} className="btn-primary sm:col-span-3 !py-2 text-xs disabled:opacity-60">
        {busy ? 'Menyimpan...' : 'Catat Tagihan Vendor'}
      </button>
      {error && <p className="text-xs text-red-400 sm:col-span-3">{error}</p>}
    </div>
  )
}

function PayBillForm({ bill, bankAccounts, onDone }) {
  const outstanding = Number(bill.amount) - Number(bill.paid_amount)
  const [amount, setAmount] = useState(outstanding)
  const [bankAccountId, setBankAccountId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setBusy(true)
    setError('')
    const { error: err } = await supabase.from('acc_vendor_payments').insert({ vendor_bill_id: bill.id, amount_paid: Number(amount), bank_account_id: bankAccountId || null })
    setBusy(false)
    if (err) setError(err.message)
    else {
      logAudit('vendor_bill_paid', 'acc_vendor_bills', bill.id, { newValues: { amount: Number(amount) } })
      onDone()
    }
  }

  return (
    <div className="mt-3 grid grid-cols-1 gap-3 rounded-xl border border-white/10 bg-white/5 p-3 sm:grid-cols-3">
      <input type="number" className="input-field" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <select className="input-field" value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)}>
        <option value="">Bayar dari Akun...</option>
        {bankAccounts.map((b) => (
          <option key={b.id} value={b.id}>
            {b.account_name}
          </option>
        ))}
      </select>
      <button type="button" disabled={busy || !amount} onClick={submit} className="btn-primary !py-2 text-xs disabled:opacity-60">
        {busy ? 'Menyimpan...' : 'Catat Pembayaran'}
      </button>
      {error && <p className="text-xs text-red-400 sm:col-span-3">{error}</p>}
    </div>
  )
}

export default function VendorBillsEditor() {
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [payingId, setPayingId] = useState(null)
  const vendors = useSupabaseTable('acc_vendors', { orderBy: 'vendor_name', ascending: true })
  const bankAccounts = useSupabaseTable('acc_bank_accounts', { orderBy: 'account_name', ascending: true })

  const load = useCallback(() => {
    setLoading(true)
    supabase
      .from('acc_vendor_bills')
      .select('*, acc_vendors(vendor_name)')
      .order('due_date', { ascending: true })
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setBills(data || [])
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const totalUnpaid = bills.filter((b) => b.status !== 'paid').reduce((s, b) => s + (Number(b.amount) - Number(b.paid_amount)), 0)

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Utang Vendor (Accounts Payable)</h2>
          <p className="mt-1 text-sm text-slate-400">Lacak tagihan dari vendor (hosting, domain, dsb) yang belum Anda bayar.</p>
        </div>
        <button type="button" onClick={() => setShowForm((v) => !v)} className="btn-secondary !px-3 !py-2 text-xs">
          <Plus size={14} /> Catat Tagihan
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
        <p className="text-xs text-red-300">Total Belum Dibayar</p>
        <p className="text-xl font-bold text-red-300">{idr(totalUnpaid)}</p>
      </div>

      {error && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-red-400">
          <AlertTriangle size={13} /> {error}
        </p>
      )}

      {showForm && (
        <div className="mt-4">
          <NewBillForm vendors={vendors.rows} onDone={() => { setShowForm(false); load() }} />
        </div>
      )}

      <div className="mt-5 space-y-3">
        {loading && <p className="text-sm text-slate-400">Memuat...</p>}
        {!loading && bills.length === 0 && <p className="text-sm text-slate-500">Belum ada tagihan vendor tercatat.</p>}
        {bills.map((bill) => {
          const outstanding = Number(bill.amount) - Number(bill.paid_amount)
          return (
            <div key={bill.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-white">
                    {bill.acc_vendors?.vendor_name} {bill.bill_number && <span className="text-xs font-normal text-slate-500">({bill.bill_number})</span>}
                  </p>
                  <p className="text-xs text-slate-400">{bill.description}</p>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${STATUS_COLOR[bill.status]}`}>{STATUS_LABEL[bill.status]}</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                <div>
                  <p className="text-slate-500">Total</p>
                  <p className="font-semibold text-white">{idr(bill.amount)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Sisa</p>
                  <p className="font-semibold text-gold-soft">{idr(outstanding)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Jatuh Tempo</p>
                  <p className="font-semibold text-white">{bill.due_date || '-'}</p>
                </div>
              </div>
              {outstanding > 0 && (
                <button type="button" onClick={() => setPayingId(payingId === bill.id ? null : bill.id)} className="btn-secondary mt-3 !px-3 !py-1.5 text-xs">
                  Catat Pembayaran
                </button>
              )}
              {payingId === bill.id && <PayBillForm bill={bill} bankAccounts={bankAccounts.rows} onDone={() => { setPayingId(null); load() }} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
