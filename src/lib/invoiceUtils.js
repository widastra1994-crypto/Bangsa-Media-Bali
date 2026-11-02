// Sisa tagihan invoice. Bila klien memotong PPh 23, potongan itu (pph23_amount,
// diisi otomatis oleh database) tidak perlu dibayar klien.
export const invoiceOutstanding = (inv) =>
  Number(inv?.total_amount || 0) - Number(inv?.pph23_amount || 0) - Number(inv?.paid_amount || 0)
