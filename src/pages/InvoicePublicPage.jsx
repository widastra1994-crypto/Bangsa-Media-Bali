import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, Download, MessageCircle } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import { useContent } from '../context/ContentContext'
import { invoiceOutstanding } from '../lib/invoiceUtils'
import logoFull from '../assets/logo-full.png'

const downloadInvoicePdf = (...args) => import('../lib/pdfGenerator').then((m) => m.generateInvoicePdf(...args))

const idr = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0)
const formatDate = (d) => (d ? new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-')

const STATUS = {
  sent: ['Menunggu Pembayaran', 'bg-amber-100 text-amber-700'],
  partial: ['Dibayar Sebagian', 'bg-amber-100 text-amber-700'],
  overdue: ['Lewat Jatuh Tempo', 'bg-red-100 text-red-700'],
  paid: ['Lunas', 'bg-emerald-100 text-emerald-700'],
  cancelled: ['Dibatalkan', 'bg-slate-100 text-slate-600'],
}
const TYPE_LABEL = {
  project_deposit: 'Deposit Proyek',
  project_settlement: 'Pelunasan Proyek',
  domain_renewal: 'Perpanjangan Layanan',
  server_renewal: 'Perpanjangan Layanan',
  recurring_retainer: 'Layanan Bulanan',
  additional: 'Tagihan Tambahan',
}

// Halaman invoice untuk klien, dibuka dari link WhatsApp/email tanpa login.
// Data diambil lewat RPC get_public_invoice dengan token acak per invoice.
export default function InvoicePublicPage() {
  const { token } = useParams()
  const { content } = useContent()
  const [state, setState] = useState({ loading: true, data: null })
  const [qrisUrl, setQrisUrl] = useState('')

  useEffect(() => {
    if (!isSupabaseConfigured || !/^[0-9a-f-]{36}$/i.test(token || '')) {
      setState({ loading: false, data: null })
      return
    }
    supabase.rpc('get_public_invoice', { p_token: token }).then(({ data }) => setState({ loading: false, data: data || null }))
    supabase.rpc('get_public_qris_url').then(({ data }) => setQrisUrl(data || ''))
  }, [token])

  const brand = { name: content.brand?.name, address: content.contact?.address, phone: content.contact?.phone, email: content.contact?.email, qrisImageUrl: qrisUrl }
  const waNumber = String(content.contact?.whatsapp || content.contact?.phone || '').replace(/\D/g, '').replace(/^0/, '62')

  if (state.loading) {
    return <div className="flex min-h-screen items-center justify-center bg-site-gradient text-sm text-slate-600">Memuat invoice...</div>
  }
  if (!state.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-site-gradient px-5">
        <div className="max-w-sm rounded-2xl bg-white p-6 text-center shadow-card">
          <p className="font-semibold text-ink">Invoice tidak ditemukan</p>
          <p className="mt-2 text-sm text-slate-500">Link mungkin salah atau sudah tidak berlaku. Silakan hubungi kami.</p>
        </div>
      </div>
    )
  }

  const { invoice, client, items } = state.data
  const outstanding = invoiceOutstanding(invoice)
  const [statusLabel, statusClass] = STATUS[invoice.status] || [invoice.status, 'bg-slate-100 text-slate-600']
  const pdfItems = items.map((it) => ({ label: it.label, note: `Periode ${formatDate(it.period_start)} - ${formatDate(it.period_end)}`, amount: Number(it.amount) }))
  const confirmText = encodeURIComponent(`Halo, saya ingin konfirmasi pembayaran invoice ${invoice.invoice_number}.`)

  return (
    <div className="min-h-screen bg-site-gradient px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <img src={logoFull} alt={brand.name || 'Logo'} className="mx-auto h-10 w-auto" />
        <div className="mt-6 rounded-3xl bg-white p-6 shadow-card sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Invoice</p>
              <h1 className="text-xl font-bold text-ink">{invoice.invoice_number}</h1>
              <p className="mt-1 text-sm text-slate-500">{TYPE_LABEL[invoice.invoice_type] || 'Tagihan'}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>{statusLabel}</span>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs text-slate-400">Ditagihkan kepada</p>
              <p className="font-semibold text-ink">{client.company_name}</p>
              {client.pic_name && <p className="text-slate-500">{client.pic_name}</p>}
            </div>
            <div className="sm:text-right">
              <p className="text-xs text-slate-400">Tanggal terbit / Jatuh tempo</p>
              <p className="text-ink">
                {formatDate(invoice.created_at)} / <b>{formatDate(invoice.due_date)}</b>
              </p>
            </div>
          </div>

          <div className="mt-6 divide-y divide-slate-100 rounded-2xl border border-slate-100">
            {(items.length ? items : [{ label: invoice.project_name || TYPE_LABEL[invoice.invoice_type] || 'Layanan', amount: invoice.subtotal }]).map((it, i) => (
              <div key={i} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-ink">{it.label}</p>
                  {it.period_start && (
                    <p className="text-xs text-slate-500">
                      Periode {formatDate(it.period_start)} - {formatDate(it.period_end)}
                    </p>
                  )}
                </div>
                <p className="shrink-0 font-semibold text-ink">{idr(it.amount)}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-1 text-sm">
            {Number(invoice.tax_amount) > 0 && (
              <p className="flex justify-between text-slate-500">
                <span>Pajak</span>
                <span>{idr(invoice.tax_amount)}</span>
              </p>
            )}
            <p className="flex justify-between font-semibold text-ink">
              <span>Total</span>
              <span>{idr(invoice.total_amount)}</span>
            </p>
            {Number(invoice.pph23_amount) > 0 && (
              <p className="flex justify-between text-slate-500">
                <span>PPh 23 dipotong</span>
                <span>-{idr(invoice.pph23_amount)}</span>
              </p>
            )}
            {Number(invoice.paid_amount) > 0 && (
              <p className="flex justify-between text-emerald-600">
                <span>Sudah dibayar</span>
                <span>{idr(invoice.paid_amount)}</span>
              </p>
            )}
            <p className="flex justify-between border-t border-slate-100 pt-2 text-lg font-bold text-gold-deep">
              <span>Sisa tagihan</span>
              <span>{idr(Math.max(outstanding, 0))}</span>
            </p>
          </div>

          {invoice.status === 'paid' ? (
            <p className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
              <CheckCircle2 size={16} /> Terima kasih, invoice ini sudah lunas.
            </p>
          ) : (
            invoice.status !== 'cancelled' &&
            qrisUrl &&
            outstanding > 0 && (
              <div className="mt-6 flex items-center gap-4 rounded-2xl border border-slate-100 p-4">
                <img src={qrisUrl} alt="QRIS" className="h-28 w-28 rounded-lg border border-slate-200 object-contain p-1" />
                <p className="text-sm text-slate-600">
                  Scan QRIS ini untuk membayar, lalu masukkan nominal <b className="text-gold-deep">{idr(outstanding)}</b> secara manual.
                </p>
              </div>
            )
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            <button type="button" onClick={() => downloadInvoicePdf({ ...invoice, items: pdfItems }, client, brand)} className="btn-primary !py-2.5 text-sm">
              <Download size={15} /> Unduh PDF
            </button>
            {waNumber && invoice.status !== 'paid' && (
              <a href={`https://wa.me/${waNumber}?text=${confirmText}`} target="_blank" rel="noreferrer" className="btn-secondary !py-2.5 text-sm">
                <MessageCircle size={15} /> Konfirmasi Pembayaran
              </a>
            )}
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">
          {brand.name} · {brand.email} · {brand.phone}
        </p>
      </div>
    </div>
  )
}
