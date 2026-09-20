import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Download, Mail, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { sendFinanceEmail } from '../../lib/financeEmail'
import { useSupabaseTable } from './useSupabaseTable'
import { logAudit } from './auditLog'
import { useContent } from '../../context/ContentContext'

// Lazy-load jsPDF (lumayan besar) hanya saat tombol unduh benar-benar diklik,
// supaya tidak ikut membebani bundle awal admin panel.
const downloadInvoicePdf = (...args) => import('../../lib/pdfGenerator').then((m) => m.generateInvoicePdf(...args))
const downloadReceiptPdf = (...args) => import('../../lib/pdfGenerator').then((m) => m.generateReceiptPdf(...args))

const idr = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0)

const STATUS_LABEL = { draft: 'Draft', sent: 'Terkirim', partial: 'Sebagian Dibayar', paid: 'Lunas', overdue: 'Jatuh Tempo', cancelled: 'Batal' }
const STATUS_COLOR = {
  draft: 'bg-slate-500/20 text-slate-300 border-slate-400/30',
  sent: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/30',
  partial: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
  paid: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
  overdue: 'bg-red-500/20 text-red-300 border-red-400/30',
  cancelled: 'bg-slate-500/20 text-slate-400 border-slate-400/30',
}
const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Transfer Bank' },
  { value: 'direct_mutasi', label: 'Mutasi Langsung' },
  { value: 'cash', label: 'Tunai' },
  { value: 'qris', label: 'QRIS' },
]

function PaymentForm({ invoice, bankAccounts, onDone }) {
  const outstanding = Number(invoice.total_amount) - Number(invoice.paid_amount)
  const [amount, setAmount] = useState(outstanding > 0 ? outstanding : '')
  const [method, setMethod] = useState('bank_transfer')
  const [bankAccountId, setBankAccountId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      const { error: err } = await supabase.from('acc_payments').insert({
        invoice_id: invoice.id,
        amount_paid: Number(amount),
        payment_method: method,
        bank_account_id: bankAccountId || null,
      })
      if (err) throw new Error(err.message)

      logAudit('payment_recorded', 'acc_invoices', invoice.id, {
        newValues: { invoice_number: invoice.invoice_number, amount: Number(amount), method },
      })

      const client = invoice.acc_clients
      if (client?.email) {
        await sendFinanceEmail({
          type: 'receipt',
          to: client.email,
          clientName: client.company_name,
          docNumber: `Pembayaran - ${invoice.invoice_number}`,
          amount: Number(amount),
        })
      }
      onDone()
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <div className="mt-3 grid grid-cols-1 gap-3 rounded-xl border border-white/10 bg-white/5 p-4 sm:grid-cols-4">
      <input type="number" className="input-field" placeholder="Nominal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <select className="input-field" value={method} onChange={(e) => setMethod(e.target.value)}>
        {PAYMENT_METHODS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
      <select className="input-field" value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)}>
        <option value="">Akun Kas Tujuan...</option>
        {bankAccounts.map((b) => (
          <option key={b.id} value={b.id}>
            {b.account_name}
          </option>
        ))}
      </select>
      <button type="button" disabled={busy || !amount} onClick={submit} className="btn-primary !py-2 text-xs disabled:opacity-60">
        {busy ? 'Menyimpan...' : 'Catat Pembayaran'}
      </button>
      {error && <p className="col-span-full text-xs text-red-400">{error}</p>}
    </div>
  )
}

export default function InvoicesList() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [payingId, setPayingId] = useState(null)
  const [sendingId, setSendingId] = useState(null)
  const [notice, setNotice] = useState('')
  const bankAccounts = useSupabaseTable('acc_bank_accounts')
  const { content } = useContent()
  const [qrisUrl, setQrisUrl] = useState('')
  const brand = { name: content.brand?.name, address: content.contact?.address, phone: content.contact?.phone, email: content.contact?.email, qrisImageUrl: qrisUrl }

  useEffect(() => {
    supabase.rpc('get_public_qris_url').then(({ data }) => setQrisUrl(data || ''))
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    supabase
      .from('acc_invoices')
      .select('*, acc_clients(company_name, email, pic_name, address), acc_projects(website_name), acc_invoice_reminder_log(stage), acc_payments(*)')
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setRows(data || [])
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const updatePph23 = async (id, patch) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    const { error: err } = await supabase.from('acc_invoices').update(patch).eq('id', id)
    if (err) setError(err.message)
  }

  const resendEmail = async (invoice) => {
    const client = invoice.acc_clients
    if (!client?.email) return
    setSendingId(invoice.id)
    setNotice('')
    const res = await sendFinanceEmail({
      type: 'invoice',
      to: client.email,
      clientName: client.company_name,
      docNumber: invoice.invoice_number,
      amount: invoice.total_amount,
      dueDate: invoice.due_date,
      items: [{ label: invoice.acc_projects?.website_name || 'Layanan', amount: invoice.total_amount }],
    })
    setNotice(res.ok ? `Email invoice ${invoice.invoice_number} terkirim ulang.` : `Gagal kirim email: ${res.error || 'periksa konfigurasi Resend'}`)
    setSendingId(null)
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-white">Invoice & Piutang</h2>
      <p className="mt-1 text-sm text-slate-400">Pantau status tagihan, catat pelunasan, dan kirim ulang invoice ke email klien kapan saja.</p>

      {error && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-red-400">
          <AlertTriangle size={14} /> {error}
        </p>
      )}
      {notice && <p className="mt-3 text-xs text-cyan-300">{notice}</p>}

      <div className="mt-4 space-y-3">
        {loading && <p className="text-sm text-slate-400">Memuat...</p>}
        {!loading && rows.length === 0 && <p className="text-sm text-slate-500">Belum ada invoice.</p>}
        {rows.map((inv) => {
          const outstanding = Number(inv.total_amount) - Number(inv.paid_amount)
          return (
            <div key={inv.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-white">
                    {inv.invoice_number} <span className="ml-2 text-xs font-normal text-slate-400">{inv.acc_projects?.website_name}</span>
                  </p>
                  <p className="text-xs text-slate-400">
                    {inv.acc_clients?.company_name} &bull; {inv.acc_clients?.email}
                  </p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${STATUS_COLOR[inv.status]}`}>{STATUS_LABEL[inv.status]}</span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                <div>
                  <p className="text-slate-500">Total</p>
                  <p className="font-semibold text-white">{idr(inv.total_amount)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Terbayar</p>
                  <p className="font-semibold text-emerald-400">{idr(inv.paid_amount)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Sisa</p>
                  <p className="font-semibold text-gold-soft">{idr(outstanding)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Jatuh Tempo</p>
                  <p className="font-semibold text-white">{inv.due_date || '-'}</p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {outstanding > 0 && inv.status !== 'cancelled' && (
                  <button
                    type="button"
                    onClick={() => setPayingId(payingId === inv.id ? null : inv.id)}
                    className="btn-secondary !px-3 !py-1.5 text-xs"
                  >
                    <Plus size={13} /> Catat Pembayaran
                  </button>
                )}
                <button type="button" disabled={sendingId === inv.id} onClick={() => resendEmail(inv)} className="btn-secondary !px-3 !py-1.5 text-xs disabled:opacity-60">
                  <Mail size={13} /> {sendingId === inv.id ? 'Mengirim...' : 'Kirim Ulang Email'}
                </button>
                <button type="button" onClick={() => downloadInvoicePdf(inv, inv.acc_clients, brand)} className="btn-secondary !px-3 !py-1.5 text-xs">
                  <Download size={13} /> Unduh PDF Invoice
                </button>
              </div>

              {inv.acc_payments?.length > 0 && (
                <div className="mt-3 border-t border-white/5 pt-3">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Riwayat Pembayaran</p>
                  <div className="space-y-1.5">
                    {inv.acc_payments.map((p) => (
                      <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                        <span>
                          {p.payment_date} &bull; {idr(p.amount_paid)} &bull; {p.receipt_number}
                        </span>
                        <button
                          type="button"
                          onClick={() => downloadReceiptPdf(p, inv, inv.acc_clients, brand)}
                          className="flex items-center gap-1 text-cyan-royal hover:text-cyan-300"
                        >
                          <Download size={11} /> Unduh Kuitansi
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3 text-[11px]">
                <label className="flex items-center gap-1.5 text-slate-400">
                  <input
                    type="checkbox"
                    checked={Boolean(inv.is_pph23_withheld)}
                    onChange={(e) => updatePph23(inv.id, { is_pph23_withheld: e.target.checked })}
                    className="h-3.5 w-3.5 accent-gold"
                  />
                  Kena Potong PPh 23
                </label>
                {inv.is_pph23_withheld && (
                  <input
                    type="text"
                    defaultValue={inv.pph23_bukti_potong || ''}
                    onBlur={(e) => e.target.value !== (inv.pph23_bukti_potong || '') && updatePph23(inv.id, { pph23_bukti_potong: e.target.value })}
                    placeholder="No. Bukti Potong"
                    className="input-field !w-40 !py-1 text-[11px]"
                  />
                )}
              </div>

              {inv.acc_invoice_reminder_log?.length > 0 && (
                <p className="mt-2 text-[11px] text-slate-500">
                  Pengingat otomatis terkirim: {inv.acc_invoice_reminder_log.map((r) => r.stage.toUpperCase()).join(', ')}
                </p>
              )}

              {payingId === inv.id && (
                <PaymentForm
                  invoice={inv}
                  bankAccounts={bankAccounts.rows}
                  onDone={() => {
                    setPayingId(null)
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
