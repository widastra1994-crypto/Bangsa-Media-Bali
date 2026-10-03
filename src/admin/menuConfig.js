import {
  BarChart3,
  Palette,
  Sparkles,
  Briefcase,
  Tag,
  Calculator,
  FolderKanban,
  Quote,
  Newspaper,
  Award,
  Info,
  Phone,
  Bot,
  LayoutDashboard,
  Database,
  FilePlus2,
  FolderOpen,
  Globe,
  Receipt,
  Repeat,
  Landmark,
  Percent,
  History,
  Wallet,
  Users,
  UserCog,
  Layout,
  Coins,
  Settings,
  TrendingUp,
  CreditCard,
  Clock,
  FileSignature,
  ListChecks,
} from 'lucide-react'

// Metadata menu tanpa komponen halaman, supaya bisa dipakai juga oleh checklist
// akses di Kelola Pengguna tanpa import melingkar ke AdminApp.
// `roles` = batas atas akses per role, selaras dengan RLS database. `null` -> semua
// role yang bisa masuk /admin (owner, admin, staff, viewer). Role 'client' tidak
// pernah melihat /admin.
export const MENU_GROUPS = [
  {
    group: 'Konten Website',
    icon: Layout,
    roles: ['owner', 'admin'],
    tabs: [
      { id: 'analytics', label: 'Dashboard Analitik', icon: BarChart3 },
      { id: 'brand', label: 'Brand & Navigasi', icon: Palette },
      { id: 'hero', label: 'Hero', icon: Sparkles },
      { id: 'services', label: 'Layanan', icon: Briefcase },
      { id: 'pricing', label: 'Paket Harga', icon: Tag },
      { id: 'calculator', label: 'Kalkulator', icon: Calculator },
      { id: 'portfolio', label: 'Portofolio', icon: FolderKanban },
      { id: 'testimonials', label: 'Testimoni', icon: Quote },
      { id: 'blog', label: 'Blog', icon: Newspaper },
      { id: 'advantages', label: 'Keunggulan', icon: Award },
      { id: 'about', label: 'Tentang', icon: Info },
      { id: 'contact', label: 'Kontak & Footer', icon: Phone },
      { id: 'assistant', label: 'Asisten Chat', icon: Bot },
    ],
  },
  {
    group: 'Dashboard & Master',
    icon: LayoutDashboard,
    roles: ['owner', 'admin'],
    tabs: [
      { id: 'acc-dashboard', label: 'Dashboard Akunting', icon: LayoutDashboard },
      { id: 'acc-master', label: 'Master Data', icon: Database },
      { id: 'acc-profitability', label: 'Profitabilitas Proyek', icon: TrendingUp },
    ],
  },
  {
    group: 'Operasional',
    icon: FolderOpen,
    roles: null,
    tabs: [
      { id: 'acc-transaction', label: 'Transaksi Baru', icon: FilePlus2, roles: ['owner', 'admin', 'staff'] },
      { id: 'acc-projects', label: 'Daftar Proyek', icon: FolderOpen, roles: null },
      { id: 'acc-assets', label: 'Aset Digital', icon: Globe, roles: null },
      { id: 'acc-staff-progress', label: 'Progres Staf', icon: ListChecks, roles: null },
      { id: 'acc-time-logs', label: 'Jam Kerja Staf', icon: Clock, roles: ['owner', 'admin', 'staff'] },
      { id: 'acc-contracts', label: 'Kontrak & SPK Digital', icon: FileSignature, roles: ['owner', 'admin'] },
    ],
  },
  {
    group: 'Keuangan',
    icon: Coins,
    roles: null,
    tabs: [
      { id: 'acc-invoices', label: 'Invoice & Piutang', icon: Receipt, roles: ['owner', 'admin', 'staff'] },
      { id: 'acc-vendor-bills', label: 'Utang ke Vendor', icon: CreditCard, roles: ['owner', 'admin'] },
      { id: 'acc-subscriptions', label: 'Langganan Retainer', icon: Repeat, roles: ['owner', 'admin'] },
      { id: 'acc-expenses', label: 'Pengeluaran', icon: Wallet, roles: ['owner', 'admin', 'staff'] },
      { id: 'acc-commissions', label: 'Komisi Tim', icon: Users, roles: ['owner', 'admin', 'staff'] },
      { id: 'acc-bank', label: 'Rekonsiliasi Bank', icon: Landmark, roles: ['owner', 'admin'] },
    ],
  },
  {
    group: 'Pajak & Audit',
    icon: Percent,
    roles: ['owner', 'admin'],
    tabs: [
      { id: 'acc-tax', label: 'Pajak', icon: Percent },
      { id: 'acc-audit', label: 'Audit Trail', icon: History },
    ],
  },
  {
    group: 'Pengaturan',
    icon: Settings,
    roles: ['owner', 'admin'],
    tabs: [{ id: 'acc-users', label: 'Kelola Pengguna', icon: UserCog }],
  },
]

// Hanya role ini yang menunya bisa dipersempit lewat checklist. Owner & Admin
// selalu melihat semua menu yang diizinkan role-nya.
export const CONFIGURABLE_ROLES = ['staff', 'viewer']

const allows = (roles, role) => !roles || roles.includes(role)

export function eligibleGroupsForRole(role) {
  return MENU_GROUPS.map((group) => {
    if (!allows(group.roles, role)) return null
    const tabs = group.tabs.filter((tab) => allows(tab.roles, role))
    return tabs.length > 0 ? { ...group, tabs } : null
  }).filter(Boolean)
}

export function eligibleTabIds(role) {
  return eligibleGroupsForRole(role).flatMap((g) => g.tabs.map((t) => t.id))
}

// Checklist hanya bisa MEMPERSEMPIT menu di dalam batas role, tidak pernah
// menambah di luar batas itu. menuAccess null = belum pernah diatur -> semua
// menu yang layak untuk role tersebut.
export function visibleGroupsFor(role, menuAccess) {
  const groups = eligibleGroupsForRole(role)
  if (!CONFIGURABLE_ROLES.includes(role) || !Array.isArray(menuAccess)) return groups
  return groups
    .map((g) => ({ ...g, tabs: g.tabs.filter((t) => menuAccess.includes(t.id)) }))
    .filter((g) => g.tabs.length > 0)
}
