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
    title: 'Sistem Manajemen Operasional & Website',
    solution: 'Sistem yang dibuat khusus sesuai alur kerja bisnis Anda, sehingga pekerjaan manual berkurang dan data tercatat rapi di satu tempat.',
    packages: [
      {
        name: 'Biaya Pengembangan Sistem',
        price: 25000000,
        recommended: true,
        features: ['Website & online booking system', 'Booking & operasional', 'Accounting & financial management', 'Karyawan, payroll & insentif', 'Reporting & business analytics', 'User access & permission'],
      },
    ],
    timeline: [],
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


// ---------- Isi proposal per layanan (format: ## sub judul, - poin, 1. poin bernomor) ----------
const PENUTUP = (topik) => `Bangsa Media Bali berharap ${topik} ini dapat menjadi solusi digital yang membantu {klien} bekerja lebih efisien, terstruktur, dan siap berkembang.

Kami berkomitmen menyediakan solusi yang disesuaikan dengan kebutuhan {klien} serta memberikan dukungan teknis selama proses implementasi dan pengelolaan jangka panjang.

Besar harapan kami untuk dapat menjalin kerja sama dengan {klien}.`

const KETENTUAN_UMUM = `1. Pekerjaan dikembangkan berdasarkan ruang lingkup dan spesifikasi yang disepakati.
2. Materi (logo, foto, teks, data) disediakan klien sesuai jadwal yang disepakati.
3. Integrasi payment gateway, WhatsApp API, atau layanan pihak ketiga mengikuti biaya provider apabila berlaku.
4. Pengembangan fitur tambahan di luar ruang lingkup awal dapat dikenakan biaya tambahan.
5. Perlakuan dan pelaporan pajak resmi tidak termasuk kecuali disepakati.
6. Hak akses, kepemilikan, source code, pengelolaan server, dan data dituangkan dalam kesepakatan kerja sama.`

const SECTION_TEMPLATES = {
  system: [
    {
      title: 'Pendahuluan',
      content: `Dengan hormat,

Bangsa Media Bali menawarkan kerja sama pengembangan sistem digital terintegrasi untuk mendukung pengelolaan usaha {klien}, yang mencakup website, sistem pemesanan, manajemen operasional, transaksi, keuangan, karyawan, serta laporan bisnis.

Sistem ini dirancang untuk membantu perusahaan mengelola seluruh aktivitas usaha dalam satu platform digital, mulai dari pemesanan pelanggan, pengelolaan jadwal dan kapasitas, pencatatan transaksi, pengelolaan karyawan, hingga monitoring performa dan laporan keuangan.

Dengan sistem terintegrasi, perusahaan dapat mengurangi pencatatan manual, meningkatkan efisiensi operasional, serta memperoleh informasi bisnis yang dapat digunakan manajemen dalam pengambilan keputusan.`,
    },
    {
      title: 'Tujuan Pengembangan Sistem',
      content: `Pengembangan sistem memiliki beberapa tujuan utama:

1. **Digitalisasi Booking & Reservasi**
Mempermudah pelanggan melakukan reservasi melalui website dengan pemilihan paket, jadwal, jumlah peserta, dan pembayaran.
2. **Manajemen Kapasitas & Jadwal**
Mengelola kapasitas dan jadwal layanan serta mencegah kelebihan pemesanan.
3. **Kontrol Operasional**
Mempermudah pengelolaan aktivitas harian, petugas, dan status operasional.
4. **Pengelolaan Keuangan**
Mencatat pemasukan, pengeluaran, pembayaran, refund, kas, dan laporan keuangan secara terstruktur.
5. **Manajemen Karyawan**
Mengelola data karyawan, absensi, jadwal kerja, gaji, komisi, dan slip gaji.
6. **Monitoring Performa Bisnis**
Menyediakan informasi pendapatan, jumlah pelanggan, dan performa operasional secara real-time.`,
    },
    {
      title: 'Ruang Lingkup & Fitur Sistem',
      content: `## A. Website & Online Booking System
- Website profil perusahaan, layanan, harga, galeri, FAQ, dan kontak.
- Integrasi WhatsApp dan Google Maps.
- Booking online: pilih paket, tanggal, jam/sesi, dan jumlah peserta.
- Booking reference, konfirmasi, status booking & pembayaran.
- Reschedule, pembatalan, dan pencatatan refund.
- Notifikasi booking ke admin dan pelanggan.
- Responsive untuk desktop, tablet, dan mobile; SEO dasar; CMS konten.

## B. Booking & Operasional
- Booking online, walk-in, manual oleh admin, WhatsApp, dan partner.
- Pengaturan kapasitas, slot, jam operasional, dan pencegahan overbooking.
- Check-in pelanggan dan status layanan.
- Database pelanggan, riwayat transaksi, dan repeat customer.

## C. Accounting & Financial Management
- Dashboard keuangan: pendapatan, pengeluaran, laba, kas & bank.
- Pencatatan pemasukan, pengeluaran, piutang, dan utang.
- Pembayaran tunai, transfer, QRIS, deposit, dan pembayaran sebagian.
- Laporan Laba Rugi, Arus Kas, dan laporan harian/bulanan.

## D. Karyawan, Payroll & Insentif
- Database karyawan, jabatan, dan departemen.
- Absensi, shift, cuti, dan lembur.
- Penggajian, tunjangan, insentif, potongan, kasbon, dan slip gaji digital.

## E. Reporting & Business Analytics
- Laporan pendapatan per paket, per channel, dan per periode.
- Performa booking, utilisasi kapasitas, dan performa staf.
- Export Excel, PDF, dan cetak laporan.

## F. User Access & Permission
- Hak akses per peran: Owner, Admin, Keuangan, Operasional, dan lainnya.
- Pembatasan akses data keuangan.
- Activity log dan audit trail perubahan data.`,
    },
    {
      title: 'System Architecture',
      content: `Sistem dirancang menggunakan arsitektur terintegrasi yang terdiri dari:

## Customer Interface
Website resmi dan sistem booking online yang dapat diakses melalui desktop dan perangkat mobile.

## Management Dashboard
Dashboard admin untuk mengelola booking, operasional, keuangan, karyawan, dan seluruh aktivitas perusahaan.

## Central Database
Database terpusat untuk menyimpan data pelanggan, transaksi, operasional, karyawan, payroll, dan laporan.

## Infrastructure
- Production server dan database.
- Domain dan SSL.
- Backup otomatis.
- Keamanan dan monitoring.`,
    },
    {
      title: 'Tahapan Implementasi',
      content: `## Phase 1 — Analysis & System Planning
- Analisis model bisnis dan alur kerja.
- Kebutuhan sistem dan perancangan database.

## Phase 2 — UI/UX & System Design
- Desain website, halaman booking, dan dashboard admin.

## Phase 3 — Development
- Pembangunan website, booking, operasional, keuangan, karyawan, payroll, dan laporan.

## Phase 4 — Integration & Testing
- Integrasi pembayaran dan notifikasi apabila diperlukan.
- Pengujian fungsi, hak akses, keamanan, dan user acceptance test.

## Phase 5 — Data Setup, Training & Launch
- Input data awal, pembuatan akun pengguna, dan pelatihan admin.
- Go-live, monitoring, dan dukungan teknis.`,
    },
    { type: 'pricing' },
    { title: 'Ketentuan & Batasan Sistem', content: KETENTUAN_UMUM + '\n7. Akurasi laporan bergantung pada kelengkapan dan kebenaran data yang dimasukkan.' },
    { title: 'Penutup', content: PENUTUP('sistem') },
  ],
  website: [
    {
      title: 'Pendahuluan',
      content: `Dengan hormat,

Bangsa Media Bali menawarkan jasa pembuatan website profesional untuk {klien} sebagai media informasi, promosi, dan penerimaan pesanan secara online.

Website dirancang cepat, mudah ditemukan di Google, nyaman dibuka di HP, dan memudahkan calon pelanggan menghubungi atau memesan langsung.`,
    },
    {
      title: 'Tujuan',
      content: `1. **Meningkatkan Kepercayaan**
Tampilan profesional yang memperkuat citra {klien}.
2. **Mudah Ditemukan**
Optimasi SEO dasar dan Google Business agar muncul di pencarian.
3. **Lebih Banyak Pesanan**
Tombol WhatsApp, form pemesanan, dan informasi harga yang jelas.`,
    },
    {
      title: 'Ruang Lingkup & Fitur',
      content: `## Halaman Website
- Beranda, Tentang Kami, Layanan/Produk, Galeri, FAQ, dan Kontak.
- Integrasi WhatsApp dan Google Maps.

## Fitur Teknis
- Desain responsif untuk desktop, tablet, dan mobile.
- SEO dasar dan pendaftaran Google Search Console.
- SSL (https) dan backup.
- CMS untuk mengubah konten sendiri.`,
    },
    {
      title: 'Tahapan Pengerjaan',
      content: `## Tahap 1 — Pengumpulan Materi & Desain
- Diskusi kebutuhan, materi, dan desain tampilan.
## Tahap 2 — Pembuatan Website
- Pembuatan halaman dan pengisian konten.
## Tahap 3 — Uji Coba & Online
- Revisi, pengujian, dan website online.`,
    },
    { type: 'pricing' },
    { title: 'Ketentuan', content: KETENTUAN_UMUM },
    { title: 'Penutup', content: PENUTUP('website') },
  ],
  design: [
    {
      title: 'Pendahuluan',
      content: `Dengan hormat,

Bangsa Media Bali menawarkan jasa desain logo dan branding untuk {klien}, agar memiliki identitas visual yang konsisten, profesional, dan mudah diingat pelanggan.`,
    },
    {
      title: 'Ruang Lingkup',
      content: `- Riset brand dan pesaing.
- Konsep logo beserta variasinya.
- Panduan warna dan tipografi.
- File siap cetak dan digital (PNG, PDF, file sumber).`,
    },
    {
      title: 'Tahapan Pengerjaan',
      content: `1. **Riset & Brief**
Memahami karakter usaha dan target pelanggan.
2. **Konsep Awal**
Presentasi beberapa konsep desain.
3. **Revisi & Finalisasi**
Penyempurnaan desain terpilih dan serah terima file.`,
    },
    { type: 'pricing' },
    { title: 'Ketentuan', content: KETENTUAN_UMUM },
    { title: 'Penutup', content: PENUTUP('identitas visual') },
  ],
  marketing: [
    {
      title: 'Pendahuluan',
      content: `Dengan hormat,

Bangsa Media Bali menawarkan jasa pengelolaan iklan dan marketing digital untuk {klien}, agar promosi tepat sasaran dan setiap rupiah anggaran iklan dapat dipantau hasilnya.`,
    },
    {
      title: 'Ruang Lingkup',
      content: `## Pengelolaan Iklan
- Riset target pasar dan kata kunci.
- Setup dan optimasi iklan Meta (Facebook/Instagram) dan/atau Google.
- Pembuatan materi konten iklan.

## Laporan
- Laporan hasil iklan: jangkauan, klik, biaya per hasil.
- Rekomendasi optimasi setiap periode.`,
    },
    {
      title: 'Tahapan',
      content: `1. **Riset & Strategi**
Menentukan target, pesan, dan anggaran.
2. **Produksi & Tayang**
Membuat materi dan menayangkan iklan.
3. **Optimasi & Laporan**
Memantau performa dan melaporkan hasil secara rutin.`,
    },
    { type: 'pricing' },
    { title: 'Ketentuan', content: `${KETENTUAN_UMUM}\n7. Dana iklan (saldo platform) dibayar terpisah dan tidak termasuk biaya jasa.` },
    { title: 'Penutup', content: PENUTUP('strategi marketing') },
  ],
  other: [
    { title: 'Pendahuluan', content: 'Dengan hormat,\n\nBangsa Media Bali menawarkan kerja sama kepada {klien} untuk ...' },
    { title: 'Ruang Lingkup', content: '- ' },
    { type: 'pricing' },
    { title: 'Ketentuan', content: KETENTUAN_UMUM },
    { title: 'Penutup', content: PENUTUP('solusi') },
  ],
}

const DOC_TITLES = {
  system: 'Proposal Penawaran Operational & Business Management System',
  website: 'Proposal Penawaran Pembuatan Website',
  design: 'Proposal Penawaran Desain Logo & Branding',
  marketing: 'Proposal Penawaran Digital Marketing & Iklan',
  other: 'Proposal Penawaran',
}

const MAINTENANCE = {
  system: {
    fee: 5000000,
    period: 'tahun',
    note: `Layanan meliputi:
- Server & hosting management.
- Monitoring server dan aplikasi.
- Security updates dan database maintenance.
- Backup otomatis.
- Bug fixing dan technical support.
- Domain & SSL management.

Pengembangan fitur baru dan perubahan alur kerja utama di luar ruang lingkup maintenance ditawarkan secara terpisah.`,
  },
  website: {
    fee: 1500000,
    period: 'tahun',
    note: `Layanan meliputi:
- Perpanjangan hosting & domain.
- Backup, keamanan, dan update sistem.
- Perbaikan kendala teknis.
- Perubahan konten ringan.`,
  },
}

const DURATIONS = { system: '1 – 3 Minggu', website: '2 – 4 Minggu', design: '1 – 3 Minggu', marketing: 'Berjalan per bulan', other: '' }

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
    doc_title: DOC_TITLES[type] || DOC_TITLES.other,
    addressed_to: 'Management Perusahaan',
    sections: (SECTION_TEMPLATES[type] || SECTION_TEMPLATES.other).map((x) => ({ ...x })),
    estimated_duration: DURATIONS[type] || '',
    maintenance_fee: MAINTENANCE[type]?.fee ?? '',
    maintenance_period: MAINTENANCE[type]?.period || 'tahun',
    maintenance_note: MAINTENANCE[type]?.note || '',
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
