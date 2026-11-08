// Sisa tagihan invoice. Bila klien memotong PPh 23, potongan itu (pph23_amount,
// diisi otomatis oleh database) tidak perlu dibayar klien.
export const invoiceOutstanding = (inv) =>
  Number(inv?.total_amount || 0) - Number(inv?.pph23_amount || 0) - Number(inv?.paid_amount || 0)

const ASSET_LABEL = { domain: 'Domain', server: 'Hosting/Server', ssl: 'SSL', email: 'Email Bisnis' }
const shortDate = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-')

// Rincian baris invoice: dari acc_invoice_items (proyek + pembayaran tambahan)
// lalu dari acc_asset_renewals (perpanjangan aset). Kosong untuk invoice lama.
export function invoiceLineItems(inv) {
  const items = [...(inv?.acc_invoice_items || [])]
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
    .map((it) => ({ label: it.description, amount: Number(it.amount) }))
  const renewals = (inv?.acc_asset_renewals || [])
    .filter((r) => r.status !== 'cancelled')
    .map((r) => ({
      label: `Perpanjangan ${ASSET_LABEL[r.acc_digital_assets?.asset_type] || 'Layanan'} ${r.acc_digital_assets?.domain_name || ''}`.trim(),
      note: `Periode ${shortDate(r.period_start)} - ${shortDate(r.period_end)}`,
      amount: Number(r.sell_price),
    }))
  return [...items, ...renewals]
}

export const INVOICE_ITEMS_SELECT = 'acc_invoice_items(description, amount, kind, sort)'
