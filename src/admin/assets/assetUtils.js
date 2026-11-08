import { supabase } from '../../lib/supabaseClient'
import { invoiceOutstanding, renewalLines } from '../../lib/invoiceUtils'

export const idr = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0)

export const ASSET_TYPES = [
  { value: 'domain', label: 'Domain' },
  { value: 'server', label: 'Hosting/Server' },
  { value: 'ssl', label: 'SSL' },
  { value: 'email', label: 'Email Bisnis' },
  { value: 'subscription', label: 'Langganan / Lisensi' },
  { value: 'other', label: 'Lainnya' },
]
export const assetTypeLabel = (t) => ASSET_TYPES.find((a) => a.value === t)?.label || 'Layanan'

export const CYCLES = [
  { value: 1, label: 'Bulanan' },
  { value: 3, label: '3 bulan' },
  { value: 6, label: '6 bulan' },
  { value: 12, label: 'Tahunan' },
  { value: 24, label: '2 tahun' },
  { value: 36, label: '3 tahun' },
]
export const cycleLabel = (m) => CYCLES.find((c) => c.value === Number(m))?.label || `${m} bulan`

export const STATUS_LABEL = {
  active: 'Aktif',
  pending_renewal: 'Menunggu Pembayaran',
  grace_period: 'Masa Tenggang',
  expired: 'Kedaluwarsa',
  terminated: 'Dihentikan',
}

export const RENEWAL_STATUS_LABEL = { invoiced: 'Belum dibayar', paid: 'Lunas', manual: 'Dicatat manual', cancelled: 'Dibatalkan' }

const todayLocal = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Makassar' })

export function daysUntil(dateStr) {
  if (!dateStr) return null
  return Math.round((new Date(`${dateStr}T00:00:00Z`) - new Date(`${todayLocal()}T00:00:00Z`)) / 86400000)
}

// Merah <= 7 hari / lewat, oranye <= 30 hari, hijau aman.
export function urgency(days) {
  if (days === null) return { tone: 'text-slate-500', badge: 'border-white/10 bg-white/5 text-slate-400', text: '-' }
  if (days < 0) return { tone: 'text-red-400', badge: 'border-red-400/30 bg-red-500/15 text-red-300', text: `Lewat ${-days} hari` }
  if (days <= 7) return { tone: 'text-red-400', badge: 'border-red-400/30 bg-red-500/15 text-red-300', text: days === 0 ? 'Hari ini' : `${days} hari lagi` }
  if (days <= 30) return { tone: 'text-amber-300', badge: 'border-amber-400/30 bg-amber-500/15 text-amber-300', text: `${days} hari lagi` }
  return { tone: 'text-emerald-400', badge: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-300', text: `${days} hari lagi` }
}

export const formatDate = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-')

// Harga perpanjangan setahun penuh, supaya aset bulanan & tahunan bisa dijumlah.
export const yearly = (amount, cycleMonths) => (Number(amount) || 0) * (12 / (Number(cycleMonths) || 12))

export const renewalPrice = (asset) => Number(asset.sell_price) || Number(asset.cost_price) || 0

// ---------- Berbagi invoice ----------
let settingsPromise = null
export function getReminderSettings() {
  if (!settingsPromise) {
    settingsPromise = supabase
      .from('acc_reminder_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => data || {})
  }
  return settingsPromise
}
export const resetReminderSettings = () => {
  settingsPromise = null
}

export const DEFAULT_SITE_URL = 'https://bangsamediabali.com'
export const publicInvoiceUrl = (siteUrl, token) => `${(siteUrl || DEFAULT_SITE_URL).replace(/\/$/, '')}/invoice/${token}`

// Nomor HP Indonesia -> format wa.me (62xxxxxxxx).
export function waPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('62')) return digits
  if (digits.startsWith('0')) return `62${digits.slice(1)}`
  if (digits.startsWith('8')) return `62${digits}`
  return digits
}

export function fillTemplate(template, values) {
  return String(template || '').replace(/\{(\w+)\}/g, (m, key) => (values[key] !== undefined ? values[key] : m))
}

export async function fetchInvoiceItems(invoiceId) {
  const [extra, renewals] = await Promise.all([
    supabase.from('acc_invoice_items').select('description, amount, sort').eq('invoice_id', invoiceId).order('sort'),
    supabase
      .from('acc_asset_renewals')
      .select('sell_price, period_start, period_end, status, lines, acc_digital_assets(asset_type, domain_name)')
      .eq('invoice_id', invoiceId)
      .neq('status', 'cancelled')
      .order('created_at'),
  ])
  return [
    ...(extra.data || []).map((it) => ({ label: it.description, amount: Number(it.amount) })),
    ...(renewals.data || []).flatMap((r) => renewalLines(r)),
  ]
}

export function buildShareText({ template, brand, invoice, client, items, link }) {
  const services = items.length
    ? items.map((it) => `- ${it.label}${it.note ? ` (${it.note.replace('Periode ', '')})` : ''}`).join('\n')
    : `- ${invoice.invoice_number}`
  return fillTemplate(template, {
    brand: brand || 'Bangsa Media Bali',
    klien: client?.company_name || '',
    pic: client?.pic_name || client?.company_name || 'Bapak/Ibu',
    layanan: services,
    total: idr(invoiceOutstanding(invoice)),
    nomor: invoice.invoice_number,
    jatuh_tempo: formatDate(invoice.due_date),
    link,
  })
}

export const logShare = (invoiceId, channel, userId) =>
  supabase.from('acc_invoice_shares').insert({ invoice_id: invoiceId, channel, shared_by: userId })
