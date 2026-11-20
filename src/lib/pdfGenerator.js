import { jsPDF } from 'jspdf'
import { invoiceOutstanding } from './invoiceUtils'

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

// QRIS di sini adalah kode QRIS statis milik bisnis (diunggah admin di
// Pengaturan > Pajak), BUKAN QRIS dinamis dengan nominal otomatis -- itu
// perlu Payment Service Provider resmi (Midtrans/Xendit dkk). Klien scan
// lalu masukkan nominal manual. Best-effort: kalau gambar gagal dimuat
// (CORS/404), PDF tetap lanjut tanpa gambar, cukup catatan teks.
async function tryLoadImageAsDataUrl(url) {
  if (!url) return null
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

export async function generateInvoicePdf(invoice, client, brand) {
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
    additional: 'Tagihan Tambahan',
  }
  // invoice.items (opsional): rincian per layanan, mis. perpanjangan domain & server.
  const rows = invoice.items?.length ? invoice.items : [{ label: invoiceTypeLabel[invoice.invoice_type] || 'Layanan', amount: invoice.subtotal }]
  let ry = tableTop + 17
  rows.forEach((it) => {
    doc.setFontSize(10)
    doc.setTextColor(...DARK)
    doc.text(String(it.label), 20, ry, { maxWidth: 130 })
    doc.text(idr(it.amount), 175, ry, { align: 'right' })
    if (it.note) {
      doc.setFontSize(8.5)
      doc.setTextColor(...SLATE)
      doc.text(String(it.note), 20, ry + 5)
      ry += 5
    }
    ry += 9
  })
  doc.setTextColor(...DARK)

  let sy = ry + 4
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
  if (Number(invoice.pph23_amount) > 0) summaryRow('PPh 23 dipotong', `-${idr(invoice.pph23_amount)}`)
  summaryRow('Terbayar', idr(invoice.paid_amount))
  doc.setTextColor(...GOLD)
  summaryRow('Sisa Tagihan', idr(invoiceOutstanding(invoice)), true)
  doc.setTextColor(...DARK)

  if (brand?.qrisImageUrl && invoiceOutstanding(invoice) > 0) {
    const dataUrl = await tryLoadImageAsDataUrl(brand.qrisImageUrl)
    if (dataUrl) {
      doc.setTextColor(...SLATE)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('SCAN UNTUK BAYAR (QRIS)', 15, sy + 5)
      doc.addImage(dataUrl, 'PNG', 15, sy + 8, 32, 32)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.text('Masukkan nominal secara manual saat scan.', 50, sy + 24, { maxWidth: 60 })
    }
  }

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
  if (invoice) row('Sisa Tagihan', idr(invoiceOutstanding(invoice)))

  drawFooter(doc, 'Kuitansi ini adalah bukti pembayaran sah, dibuat otomatis oleh sistem.')
  doc.save(`${payment.receipt_number}.pdf`)
}

export function generateContractPdf(contract, client, brand) {
  const doc = new jsPDF()
  drawLetterhead(doc, brand)

  doc.setTextColor(...DARK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  const titleLines = doc.splitTextToSize(contract.title, 180)
  doc.text(titleLines, 15, 48)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...SLATE)
  doc.text(`Klien: ${client?.company_name || '-'}  |  Dibuat: ${formatDate(contract.created_at)}`, 15, 48 + titleLines.length * 6 + 4)

  doc.setTextColor(...DARK)
  doc.setFontSize(10)
  const bodyLines = doc.splitTextToSize(contract.content, 180)
  let y = 48 + titleLines.length * 6 + 14
  const pageBottom = 250
  bodyLines.forEach((line) => {
    if (y > pageBottom) {
      doc.addPage()
      y = 20
    }
    doc.text(line, 15, y)
    y += 5.5
  })

  if (contract.status === 'signed') {
    if (y > pageBottom - 40) {
      doc.addPage()
      y = 20
    }
    y += 10
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('TANDA TANGAN ELEKTRONIK KLIEN', 15, y)
    y += 4
    if (contract.signature_data) {
      doc.addImage(contract.signature_data, 'PNG', 15, y, 60, 24)
      y += 28
    }
    doc.setDrawColor(...SLATE)
    doc.line(15, y, 90, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(contract.signed_by_name || '-', 15, y)
    y += 5
    doc.setTextColor(...SLATE)
    doc.setFontSize(8)
    doc.text(`Ditandatangani elektronik pada ${new Date(contract.signed_at).toLocaleString('id-ID')}`, 15, y)
  }

  drawFooter(doc, 'Dokumen ini sah secara elektronik sesuai persetujuan yang diberikan klien melalui Portal Klien.')
  doc.save(`Kontrak-${(contract.title || 'dokumen').replace(/[^a-z0-9]+/gi, '-')}.pdf`)
}

const EMPLOYMENT_LABEL = { tetap: 'Karyawan Tetap', kontrak: 'Karyawan Kontrak', freelance: 'Freelance' }

export function generatePayslipPdf(slip, brand) {
  const doc = new jsPDF()
  drawLetterhead(doc, brand)
  const period = new Date(`${slip.period}T00:00:00`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

  doc.setTextColor(...DARK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('SLIP GAJI', 15, 46)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Periode: ${period}`, 15, 53)
  doc.text(`No. Slip: ${slip.slip_no || '-'}`, 195, 46, { align: 'right' })
  doc.setTextColor(...SLATE)
  doc.setFontSize(8.5)
  doc.text('RAHASIA - hanya untuk karyawan yang bersangkutan', 195, 53, { align: 'right' })

  doc.setDrawColor(...GOLD)
  doc.setLineWidth(0.4)
  doc.rect(15, 58, 180, 22)
  doc.setFontSize(9.5)
  const info = (label, value, x, y) => {
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...SLATE)
    doc.text(label, x, y)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...DARK)
    doc.text(String(value || '-'), x + 30, y)
  }
  info('Nama', slip.staff_name, 20, 65)
  info('Jabatan', slip.role_type, 20, 71)
  info('Status', EMPLOYMENT_LABEL[slip.employment_type] || slip.employment_type, 20, 77)
  info('Bank', slip.bank_name, 110, 65)
  info('No. Rekening', slip.bank_account_number, 110, 71)
  info('Atas Nama', slip.bank_account_holder || slip.staff_name, 110, 77)

  const earnings = [['Gaji Pokok', slip.base_salary]]
  for (const a of slip.allowances || []) earnings.push([`Tunjangan ${a.label}`, a.amount])
  for (const c of slip.commission_details || []) earnings.push([`Komisi ${c.project} (${c.role})`, c.amount])
  if (Number(slip.overtime_amount) > 0) earnings.push([`Lembur ${Number(slip.overtime_hours)} jam`, slip.overtime_amount])
  if (Number(slip.bonus) > 0) earnings.push([`Bonus${slip.bonus_note ? ` (${slip.bonus_note})` : ''}`, slip.bonus])

  const deductions = []
  if (Number(slip.bpjs_kes_employee) > 0) deductions.push(['BPJS Kesehatan', slip.bpjs_kes_employee])
  if (Number(slip.bpjs_tk_employee) > 0) deductions.push(['BPJS Ketenagakerjaan', slip.bpjs_tk_employee])
  if (Number(slip.pph21) > 0) deductions.push(['PPh 21', slip.pph21])
  if (Number(slip.loan_deduction) > 0) deductions.push(['Cicilan Kasbon', slip.loan_deduction])
  if (Number(slip.absence_deduction) > 0) deductions.push(['Potongan Absen', slip.absence_deduction])
  if (Number(slip.other_deduction) > 0) deductions.push([`Potongan Lain${slip.other_deduction_note ? ` (${slip.other_deduction_note})` : ''}`, slip.other_deduction])

  const column = (title, rows, total, x) => {
    let y = 92
    doc.setFillColor(241, 245, 249)
    doc.rect(x, y - 5, 87, 8, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...DARK)
    doc.text(title, x + 2, y)
    y += 9
    doc.setFontSize(9)
    for (const [label, value] of rows) {
      doc.setFont('helvetica', 'normal')
      const lines = doc.splitTextToSize(label, 55)
      doc.text(lines, x + 2, y)
      doc.text(idr(value), x + 85, y, { align: 'right' })
      y += 5.5 * lines.length
    }
    if (rows.length === 0) {
      doc.setTextColor(...SLATE)
      doc.text('-', x + 2, y)
      doc.setTextColor(...DARK)
      y += 5.5
    }
    return { y, total }
  }
  const left = column('PENDAPATAN', earnings, slip.gross_pay, 15)
  const right = column('POTONGAN', deductions, slip.total_deductions, 108)
  const yTotal = Math.max(left.y, right.y) + 3
  doc.setDrawColor(...SLATE)
  doc.setLineWidth(0.2)
  doc.line(15, yTotal - 4, 195, yTotal - 4)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.text('Total Pendapatan', 17, yTotal + 1)
  doc.text(idr(slip.gross_pay), 100, yTotal + 1, { align: 'right' })
  doc.text('Total Potongan', 110, yTotal + 1)
  doc.text(idr(slip.total_deductions), 193, yTotal + 1, { align: 'right' })

  doc.setFillColor(...NAVY)
  doc.rect(15, yTotal + 8, 180, 14, 'F')
  doc.setTextColor(...GOLD)
  doc.setFontSize(12)
  doc.text('GAJI BERSIH (TAKE HOME PAY)', 20, yTotal + 17)
  doc.setTextColor(255, 255, 255)
  doc.text(idr(slip.net_pay), 190, yTotal + 17, { align: 'right' })

  if (slip.notes) {
    doc.setTextColor(...SLATE)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.text(doc.splitTextToSize(`Catatan: ${slip.notes}`, 180), 15, yTotal + 32)
  }

  drawFooter(doc, 'Slip gaji ini dibuat otomatis oleh sistem dan sah tanpa tanda tangan basah. Simpan sebagai dokumen pribadi.')
  doc.save(`${slip.slip_no || 'slip-gaji'}.pdf`)
}

// ---------- Proposal penawaran (format dokumen seperti proposal resmi) ----------
// quote: data penawaran (sections, packages, payment_terms, timeline, dll).
// brand: { name, subBrand, phone, email, website, logoUrl }.
export async function generateProposalPdf(quote, client, brand) {
  const { parseBlocks, stripBold, fillClient, isPricing } = await import('./proposalFormat')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const L = 20
  const W = 170
  const BOTTOM = 277
  let y = 18
  const clientName = client?.company_name || ''
  const fill = (t) => fillClient(t, clientName)

  const ensure = (h) => {
    if (y + h > BOTTOM) {
      doc.addPage()
      y = 22
    }
  }
  const text = (str, { size = 10.5, bold = false, color = DARK, x = L, width = W, gap = 5.6, justify = false } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    doc.setTextColor(...color)
    const lines = doc.splitTextToSize(String(str), width)
    lines.forEach((line, i) => {
      ensure(gap)
      const last = i === lines.length - 1
      doc.text(line, x, y, justify && !last ? { align: 'justify', maxWidth: width } : undefined)
      y += gap
    })
  }
  const rule = () => {
    ensure(10)
    y += 3
    doc.setDrawColor(190, 190, 190)
    doc.setLineWidth(0.3)
    doc.line(L, y, L + W, y)
    y += 9
  }
  const sectionTitle = (n, title) => {
    ensure(20)
    text(`${n}. ${String(title).toUpperCase()}`, { size: 15, bold: true, gap: 8 })
    y += 2
  }
  const blocks = (content) => {
    parseBlocks(fill(content)).forEach((b) => {
      if (b.type === 'h') {
        y += 1.5
        text(stripBold(b.text), { size: 11.5, bold: true, gap: 6.5 })
        y += 0.5
      } else if (b.type === 'ul') {
        b.items.forEach((it) => {
          ensure(6)
          doc.setFillColor(...DARK)
          doc.circle(L + 6, y - 1.3, 0.8, 'F')
          text(stripBold(it), { x: L + 10, width: W - 10 })
        })
        y += 2
      } else if (b.type === 'ol') {
        b.items.forEach((it, j) => {
          ensure(6)
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(10.5)
          doc.setTextColor(...DARK)
          doc.text(`${(b.start || 1) + j}.`, L + 4, y)
          text(stripBold(it.title), { x: L + 10, width: W - 10, bold: !!it.desc })
          if (it.desc) text(stripBold(it.desc), { x: L + 10, width: W - 10 })
        })
        y += 2
      } else {
        text(stripBold(b.text), { justify: true })
        y += 2.5
      }
    })
  }

  // Sampul
  const logo = brand?.logoUrl ? await tryLoadImageAsDataUrl(brand.logoUrl) : null
  if (logo) {
    const props = doc.getImageProperties(logo)
    const h = 14
    doc.addImage(logo, 'PNG', L, y, (props.width / props.height) * h, h)
    y += h + 12
  } else {
    text(brand?.name || 'Bangsa Media Bali', { size: 16, bold: true })
    y += 6
  }
  text(String(quote.doc_title || quote.title).toUpperCase(), { size: 20, bold: true, gap: 10 })
  y += 6
  text('Disusun oleh:', { size: 10, bold: true })
  text(String(brand?.name || 'Bangsa Media Bali').toUpperCase(), { size: 10, bold: true })
  if (brand?.subBrand) text(brand.subBrand, { size: 10 })
  y += 3
  text('Ditujukan kepada:', { size: 10, bold: true })
  text([quote.addressed_to, clientName].filter(Boolean).join(' – '), { size: 10 })
  y += 3
  text(`Tanggal: ${formatDate(quote.created_at || new Date())}`, { size: 10 })
  text(`No. Penawaran: ${quote.quote_number || '-'}${quote.valid_until ? `  ·  Berlaku sampai ${formatDate(quote.valid_until)}` : ''}`, { size: 10, color: SLATE })
  rule()

  let n = 0
  const sections = quote.sections?.length ? quote.sections : [{ type: 'pricing' }]
  sections.forEach((s) => {
    if (isPricing(s)) {
      if (quote.estimated_duration || quote.timeline?.length) {
        sectionTitle(++n, 'Estimasi Waktu Pengerjaan')
        if (quote.estimated_duration) text(`Estimasi pengerjaan: ${quote.estimated_duration}`, { bold: true })
        ;(quote.timeline || []).forEach((t) => {
          ensure(6)
          doc.setFillColor(...DARK)
          doc.circle(L + 6, y - 1.3, 0.8, 'F')
          text(t, { x: L + 10, width: W - 10 })
        })
        rule()
      }
      sectionTitle(++n, 'Investasi Proyek')
      ;(quote.packages || []).forEach((p) => {
        text(`${p.name}: ${idr(p.price)}${p.recommended && quote.packages.length > 1 ? '  (rekomendasi)' : ''}`, { bold: true, size: 11.5, gap: 6.5 })
        ;(p.features || []).forEach((f) => {
          ensure(6)
          doc.setFillColor(...DARK)
          doc.circle(L + 6, y - 1.3, 0.8, 'F')
          text(f, { x: L + 10, width: W - 10 })
        })
        y += 3
      })
      if (quote.payment_terms?.length) {
        text('Termin pembayaran:', { bold: true })
        quote.payment_terms.forEach((t) => {
          const pk = quote.packages?.[quote.accepted_package ?? -1] || (quote.packages?.length === 1 ? quote.packages[0] : null)
          const base = Number(pk?.price) || null
          text(`- ${t.label} ${t.percent}%${base ? `: ${idr((base * t.percent) / 100)}` : ''}`, { x: L + 4, width: W - 4 })
        })
      }
      if (quote.guarantee || quote.revisions !== null) {
        y += 2
        text([quote.revisions !== null && quote.revisions !== undefined ? `Revisi: ${quote.revisions}x` : null, quote.guarantee ? `Garansi: ${quote.guarantee}` : null].filter(Boolean).join('  ·  '), { color: SLATE })
      }
      rule()
      if (Number(quote.maintenance_fee) > 0) {
        sectionTitle(++n, 'Maintenance & System Management')
        text(`Biaya Layanan: ${idr(quote.maintenance_fee)} / ${quote.maintenance_period === 'bulan' ? 'Bulan' : 'Tahun'}`, { bold: true, size: 11.5, gap: 6.5 })
        y += 1
        if (quote.maintenance_note) blocks(quote.maintenance_note)
        rule()
      }
      return
    }
    sectionTitle(++n, s.title || 'Bagian')
    blocks(s.content)
    if (/penutup/i.test(s.title || '')) {
      y += 4
      text('Hormat kami,')
      y += 14
      text(String(brand?.name || 'Bangsa Media Bali').toUpperCase(), { bold: true })
      if (brand?.subBrand) text(brand.subBrand)
      y += 6
      ;[brand?.phone, brand?.website, brand?.email].filter(Boolean).forEach((c) => text(c, { size: 10 }))
    } else {
      rule()
    }
  })

  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...SLATE)
    doc.text(`${brand?.name || 'Bangsa Media Bali'} · ${quote.quote_number || ''}`, L, 290)
    doc.text(`Halaman ${i} dari ${pages}`, L + W, 290, { align: 'right' })
  }
  doc.save(`${quote.quote_number || 'Penawaran'} - ${clientName || 'Proposal'}.pdf`.replace(/[\/:*?"<>|]/g, '-'))
}
