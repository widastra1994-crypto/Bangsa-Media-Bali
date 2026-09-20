// Ekspor array of object ke file CSV dan langsung unduh, tanpa dependensi
// tambahan (cukup untuk kebutuhan laporan sederhana).
export function exportToCsv(filename, rows) {
  if (!rows || rows.length === 0) return
  const headers = Object.keys(rows[0])
  const escape = (val) => {
    const s = val === null || val === undefined ? '' : String(val)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers.join(','), ...rows.map((row) => headers.map((h) => escape(row[h])).join(','))].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
