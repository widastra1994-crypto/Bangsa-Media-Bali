// Template isi penawaran per jenis layanan. Dipakai sebagai isian awal form
// (semua bisa diubah) supaya admin tidak menulis dari nol.
export const SERVICE_TYPES = [
  { value: 'website', label: 'Pembuatan Website' },
  { value: 'system', label: 'Pembuatan Sistem/Aplikasi' },
  { value: 'design', label: 'Desain & Branding' },
  { value: 'marketing', label: 'Marketing & Iklan' },
  { value: 'other', label: 'Lainnya' },
]
export const serviceLabel = (v) => SERVICE_TYPES.find((s) => s.value === v)?.label || 'Layanan'

const DEFAULT_TERMS = [
  { label: 'DP saat kontrak ditandatangani', percent: 50 },
  { label: 'Pelunasan saat pekerjaan selesai', percent: 50 },
]

export const TEMPLATES = {
  website: {
    title: 'Pembuatan Website',
    solution: 'Website profesional yang cepat, mudah ditemukan di Google, dan memudahkan calon pelanggan menghubungi atau memesan langsung.',
    packages: [
      { name: 'Basic', price: 3500000, recommended: false, features: ['Website 5 halaman', 'Desain responsif HP', 'Domain & hosting 1 tahun', 'Tombol WhatsApp & Google Maps'] },
      { name: 'Bisnis', price: 6500000, recommended: true, features: ['Semua di Basic', 'Hingga 10 halaman', 'SEO dasar & Google Business', 'Form pemesanan/booking', 'Pelatihan admin 1 sesi'] },
      { name: 'Premium', price: 9500000, recommended: false, features: ['Semua di Bisnis', 'Dua bahasa (ID/EN)', 'Pembayaran online', 'Maintenance 6 bulan'] },
    ],
    timeline: ['Minggu 1: pengumpulan materi & desain tampilan', 'Minggu 2-3: pembuatan website & isi konten', 'Minggu 4: uji coba, revisi, dan website online'],
    guarantee: 'perbaikan bug 3 bulan setelah online',
    revisions: 2,
  },
  system: {
    title: 'Pembuatan Sistem',
    solution: 'Sistem yang dibuat khusus sesuai alur kerja bisnis Anda, sehingga pekerjaan manual berkurang dan data tercatat rapi di satu tempat.',
    packages: [
      { name: 'Standar', price: 15000000, recommended: false, features: ['Modul inti sesuai kebutuhan', 'Hingga 5 pengguna', 'Laporan dasar', 'Pelatihan 1 sesi'] },
      { name: 'Profesional', price: 25000000, recommended: true, features: ['Semua di Standar', 'Hingga 20 pengguna & hak akses', 'Laporan & ekspor Excel', 'Integrasi WhatsApp/email', 'Maintenance 3 bulan'] },
    ],
    timeline: ['Minggu 1-2: analisis kebutuhan & rancangan alur', 'Minggu 3-6: pembuatan modul', 'Minggu 7: uji coba bersama tim Anda', 'Minggu 8: go-live & pelatihan'],
    guarantee: 'perbaikan bug 6 bulan',
    revisions: 3,
  },
  design: {
    title: 'Desain Logo & Branding',
    solution: 'Identitas visual yang konsisten dan mudah diingat, siap dipakai untuk media sosial, kemasan, dan materi promosi.',
    packages: [
      { name: 'Logo', price: 1500000, recommended: false, features: ['3 konsep logo', 'File siap cetak & digital', 'Panduan warna'] },
      { name: 'Branding', price: 3500000, recommended: true, features: ['Semua di Logo', 'Kartu nama & kop surat', '10 template konten media sosial', 'Brand guideline'] },
    ],
    timeline: ['Minggu 1: riset & konsep awal', 'Minggu 2: revisi & finalisasi', 'Minggu 3: serah terima file'],
    guarantee: 'file sumber diserahkan setelah lunas',
    revisions: 3,
  },
  marketing: {
    title: 'Kelola Iklan & Marketing Digital',
    solution: 'Iklan yang ditargetkan ke calon pelanggan yang tepat, dengan laporan rutin supaya setiap rupiah iklan bisa dipantau hasilnya.',
    packages: [
      { name: 'Starter', price: 2000000, recommended: false, features: ['1 platform (Meta atau Google)', 'Setup & optimasi iklan', 'Laporan bulanan', 'Belum termasuk dana iklan'] },
      { name: 'Growth', price: 3500000, recommended: true, features: ['2 platform (Meta & Google)', '8 desain konten iklan per bulan', 'Laporan 2 mingguan', 'Belum termasuk dana iklan'] },
    ],
    timeline: ['Minggu 1: riset target & pembuatan materi', 'Minggu 2: iklan tayang', 'Setiap bulan: optimasi & laporan'],
    guarantee: 'laporan hasil iklan transparan setiap periode',
    revisions: 2,
  },
  other: {
    title: '',
    solution: '',
    packages: [{ name: 'Paket', price: 0, recommended: true, features: [] }],
    timeline: [],
    guarantee: '',
    revisions: 2,
  },
}

export function templateFor(type) {
  const t = TEMPLATES[type] || TEMPLATES.other
  return {
    service_type: type,
    title: t.title,
    needs: '',
    solution: t.solution,
    packages: t.packages.map((p) => ({ ...p, features: [...p.features] })),
    timeline: [...t.timeline],
    payment_terms: DEFAULT_TERMS.map((x) => ({ ...x })),
    guarantee: t.guarantee,
    revisions: t.revisions,
    terms: '',
  }
}

export const STATUS = {
  draft: ['Draf', 'border-slate-400/30 bg-slate-500/15 text-slate-400'],
  sent: ['Terkirim', 'border-cyan-400/30 bg-cyan-500/15 text-cyan-300'],
  viewed: ['Dibuka klien', 'border-indigo-400/30 bg-indigo-500/15 text-indigo-300'],
  revision_requested: ['Minta revisi', 'border-amber-400/30 bg-amber-500/15 text-amber-300'],
  accepted: ['Disetujui, menunggu TTD', 'border-emerald-400/30 bg-emerald-500/15 text-emerald-300'],
  signed: ['Kontrak ditandatangani', 'border-emerald-400/30 bg-emerald-500/25 text-emerald-300'],
  rejected: ['Ditolak', 'border-red-400/30 bg-red-500/15 text-red-300'],
  cancelled: ['Dibatalkan', 'border-slate-400/30 bg-slate-500/15 text-slate-500'],
}

export const idr = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0)
export const todayLocal = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Makassar' })
export const addDays = (dateStr, n) => {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
export const quoteUrl = (siteUrl, token) => `${(siteUrl || 'https://bangsamediabali.com').replace(/\/$/, '')}/penawaran/${token}`
