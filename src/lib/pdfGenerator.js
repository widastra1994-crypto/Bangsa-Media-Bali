import { jsPDF } from 'jspdf'

const idr = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0)
const formatDate = (d) => (d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-')

const NAVY = [2, 6, 23]
const GOLD = [212, 175, 55]
const SLATE = [100, 116, 139]
const DARK = [15, 23, 42]

const INVOICE_STATUS_LABEL = { draft: 'DRAFT', sent: 'MENUNGGU PEMBAYARAN', partial: 'SEBAGIAN DIBAYAR', paid: 'LUNAS', overdue: 'JATUH TEMPO', cancelled: 'DIBATALKAN' }

function drawLetterhead(doc, brand) {
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, 210, 32, 'F')
  doc.setTextColor(...GOLD)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(brand.name || 'Bangsa Media Bali', 15, 15)
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(brand.address || '', 15, 22)
  doc.text(`${brand.phone || ''}  |  ${brand.email || ''}`, 15, 27)
}

function drawFooter(doc, note) {
  doc.setDrawColor(...SLATE)
  doc.setLineWidth(0.2)
  doc.line(15, 280, 195, 280)
  doc.setTextColor(...SLATE)
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8.5)
  doc.text(note || 'Dokumen ini dibuat otomatis oleh sistem dan sah tanpa tanda tangan basah.', 15, 286)
}

export function generateInvoicePdf(invoice, client, brand) {
  const doc = new jsPDF()
  drawLetterhead(doc, brand)

  doc.setTextColor(...DARK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text('INVOICE', 15, 48)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`No. Invoice: ${invoice.invoice_number}`, 15, 56)
  doc.text(`Tanggal Terbit: ${formatDate(invoice.created_at)}`, 15, 62)
  doc.text(`Jatuh Tempo: ${formatDate(invoice.due_date)}`, 15, 68)

  doc.setFont('helvetica', 'bold')
  doc.text('STATUS', 150, 56)
  doc.setFontSize(13)
  doc.setTextColor(...GOLD)
  doc.text(INVOICE_STATUS_LABEL[invoice.status] || invoice.status.toUpperCase(), 150, 63)

  doc.setTextColor(...SLATE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('DITAGIHKAN KEPADA', 15, 82)
  doc.setTextColor(...DARK)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  let y = 89
  doc.text(client?.company_name || '-', 15, y)
  if (client?.pic_name) {
    y += 6
    doc.text(`PIC: ${client.pic_name}`, 15, y)
  }
  if (client?.email) {
    y += 6
    doc.text(client.email, 15, y)
  }
  if (client?.address) {
    y += 6
    doc.text(client.address, 15, y, { maxWidth: 100 })
  }

  const tableTop = 115
  doc.setFillColor(...NAVY)
  doc.rect(15, tableTop, 180, 9, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('DESKRIPSI', 20, tableTop + 6)
  doc.text('JUMLAH', 175, tableTop + 6, { align: 'right' })

  doc.setTextColor(...DARK)
  doc.setFont('helvetica', 'normal')
  const invoiceTypeLabel = {
    project_deposit: 'Deposit Proyek',
    project_settlement: 'Pelunasan Proyek',
    domain_renewal: 'Perpanjangan Domain',
    server_renewal: 'Perpanjangan Server/Hosting',
    recurring_retainer: 'Layanan Bulanan (Retainer)',
  }
  doc.text(invoiceTypeLabel[invoice.invoice_type] || 'Layanan', 20, tableTop + 17)
  doc.text(idr(invoice.subtotal), 175, tableTop + 17, { align: 'right' })

  let sy = tableTop + 30
  doc.setDrawColor(220, 220, 220)
  doc.line(120, sy - 5, 195, sy - 5)

  const summaryRow = (label, value, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(bold ? 12 : 10)
    doc.text(label, 130, sy)
    doc.text(value, 175, sy, { align: 'right' })
    sy += bold ? 8 : 7
  }

  summaryRow('Subtotal', idr(invoice.subtotal))
  if (Number(invoice.tax_amount) > 0) summaryRow('Pajak', idr(invoice.tax_amount))
  summaryRow('TOTAL', idr(invoice.total_amount), true)
  summaryRow('Terbayar', idr(invoice.paid_amount))
  doc.setTextColor(...GOLD)
  summaryRow('Sisa Tagihan', idr(Number(invoice.total_amount) - Number(invoice.paid_amount)), true)
  doc.setTextColor(...DARK)

  drawFooter(doc, 'Terima kasih atas kepercayaan Anda bermitra dengan kami.')
  doc.save(`${invoice.invoice_number}.pdf`)
}

export function generateReceiptPdf(payment, invoice, client, brand) {
  const doc = new jsPDF()
  drawLetterhead(doc, brand)

  doc.setTextColor(...DARK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text('KUITANSI PEMBAYARAN', 15, 48)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`No. Kuitansi: ${payment.receipt_number}`, 15, 58)
  doc.text(`Tanggal: ${formatDate(payment.payment_date)}`, 15, 64)

  doc.setDrawColor(...GOLD)
  doc.setLineWidth(0.5)
  doc.rect(15, 75, 180, 55)

  const methodLabel = { bank_transfer: 'Transfer Bank', direct_mutasi: 'Mutasi Langsung', cash: 'Tunai', qris: 'QRIS' }

  doc.setFontSize(11)
  let y = 86
  const row = (label, value) => {
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...SLATE)
    doc.text(label, 22, y)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...DARK)
    doc.text(String(value), 75, y)
    y += 9
  }
  row('Telah terima dari', client?.company_name || '-')
  row('Sejumlah', idr(payment.amount_paid))
  row('Untuk pembayaran', invoice?.invoice_number || '-')
  row('Metode Pembayaran', methodLabel[payment.payment_method] || payment.payment_method)
  if (invoice) row('Sisa Tagihan', idr(Number(invoice.total_amount) - Number(invoice.paid_amount)))

  drawFooter(doc, 'Kuitansi ini adalah bukti pembayaran sah, dibuat otomatis oleh sistem.')
  doc.save(`${payment.receipt_number}.pdf`)
}
