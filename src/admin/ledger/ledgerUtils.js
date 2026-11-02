import { supabase } from '../../lib/supabaseClient'

export const idr = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0)

export const ACCOUNT_TYPES = [
  { value: 'asset', label: 'Aset (Harta)' },
  { value: 'liability', label: 'Liabilitas (Utang)' },
  { value: 'equity', label: 'Ekuitas (Modal)' },
  { value: 'revenue', label: 'Pendapatan' },
  { value: 'expense', label: 'Beban' },
]
export const accountTypeLabel = (t) => ACCOUNT_TYPES.find((a) => a.value === t)?.label || t

export const SOURCE_LABELS = {
  invoice: 'Invoice',
  payment: 'Pembayaran Klien',
  expense: 'Pengeluaran',
  vendor_bill: 'Tagihan Vendor',
  vendor_payment: 'Bayar Vendor',
  commission_accrual: 'Komisi Diakui',
  commission_payment: 'Komisi Dibayar',
  digital_asset: 'Biaya Domain/Server',
  manual: 'Jurnal Umum',
  opening: 'Saldo Awal',
  reversal: 'Jurnal Pembalik',
  closing_tax: 'PPh Final (Tutup Buku)',
  payroll: 'Penggajian',
  payroll_payment: 'Bayar Gaji',
  employee_loan: 'Kasbon Karyawan',
}

// Aset & beban bersaldo normal debit; liabilitas, ekuitas, pendapatan kredit.
export const isDebitNormal = (type) => type === 'asset' || type === 'expense'

// Ubah saldo mentah (debit - kredit) ke angka "sisi normal" akun, supaya
// pendapatan/utang tampil positif.
export const normalBalance = (type, net) => (isDebitNormal(type) ? Number(net || 0) : -Number(net || 0))

export const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Makassar' })

export function monthRange(ym) {
  const [y, m] = ym.split('-').map(Number)
  const from = `${y}-${String(m).padStart(2, '0')}-01`
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const to = `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`
  return { from, to }
}

export const currentMonth = () => today().slice(0, 7)

export function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export const monthLabel = (ym) => {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export const formatDate = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-')

export async function fetchBalances(from, to) {
  const { data, error } = await supabase.rpc('gl_account_balances', { p_from: from || null, p_to: to })
  if (error) throw new Error(error.message)
  return (data || []).map((r) => ({
    ...r,
    opening: Number(r.opening),
    debit: Number(r.debit),
    credit: Number(r.credit),
    closing: Number(r.closing),
  }))
}

export function sumBy(rows, fn) {
  return rows.reduce((s, r) => s + fn(r), 0)
}
