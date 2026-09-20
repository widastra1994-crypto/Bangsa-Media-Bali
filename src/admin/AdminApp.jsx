import { useEffect, useState } from 'react'
import {
  ExternalLink,
  LogOut,
  ShieldAlert,
  Menu,
  X,
  ChevronDown,
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
} from 'lucide-react'
import { adminSignOut, useAdminSession } from '../context/ContentContext'
import { useUserRole } from './useUserRole'
import { isSupabaseConfigured } from '../lib/supabaseClient'
import AdminLogin from './AdminLogin'
import MascotIcon from '../components/MascotIcon'
import BrandNavEditor from './editors/BrandNavEditor'
import HeroEditor from './editors/HeroEditor'
import ServicesEditor from './editors/ServicesEditor'
import PricingEditor from './editors/PricingEditor'
import CalculatorEditor from './editors/CalculatorEditor'
import PortfolioEditor from './editors/PortfolioEditor'
import TestimonialsEditor from './editors/TestimonialsEditor'
import BlogEditor from './editors/BlogEditor'
import AdvantagesEditor from './editors/AdvantagesEditor'
import AboutEditor from './editors/AboutEditor'
import ContactFooterEditor from './editors/ContactFooterEditor'
import AssistantEditor from './editors/AssistantEditor'
import AnalyticsDashboard from './editors/AnalyticsDashboard'
import AccountingDashboard from './accounting/AccountingDashboard'
import MasterDataEditor from './accounting/MasterDataEditor'
import TransactionForm from './accounting/TransactionForm'
import ProjectsList from './accounting/ProjectsList'
import DigitalAssetsList from './accounting/DigitalAssetsList'
import BankReconciliation from './accounting/BankReconciliation'
import TaxModule from './accounting/TaxModule'
import AuditTrailViewer from './accounting/AuditTrailViewer'
import InvoicesList from './accounting/InvoicesList'
import ExpensesEditor from './accounting/ExpensesEditor'
import CommissionsList from './accounting/CommissionsList'
import UserManagement from './accounting/UserManagement'
import SubscriptionsEditor from './accounting/SubscriptionsEditor'

// `roles: null` -> tampil untuk semua role yang bisa masuk /admin (owner, admin, staff, viewer).
// Role 'client' TIDAK PERNAH melihat /admin sama sekali (diarahkan ke pesan terpisah).
const TAB_GROUPS = [
  {
    group: 'Konten Website',
    icon: Layout,
    roles: ['owner', 'admin'],
    tabs: [
      { id: 'analytics', label: 'Dashboard Analitik', icon: BarChart3, Component: AnalyticsDashboard },
      { id: 'brand', label: 'Brand & Navigasi', icon: Palette, Component: BrandNavEditor },
      { id: 'hero', label: 'Hero', icon: Sparkles, Component: HeroEditor },
      { id: 'services', label: 'Layanan', icon: Briefcase, Component: ServicesEditor },
      { id: 'pricing', label: 'Paket Harga', icon: Tag, Component: PricingEditor },
      { id: 'calculator', label: 'Kalkulator', icon: Calculator, Component: CalculatorEditor },
      { id: 'portfolio', label: 'Portofolio', icon: FolderKanban, Component: PortfolioEditor },
      { id: 'testimonials', label: 'Testimoni', icon: Quote, Component: TestimonialsEditor },
      { id: 'blog', label: 'Blog', icon: Newspaper, Component: BlogEditor },
      { id: 'advantages', label: 'Keunggulan', icon: Award, Component: AdvantagesEditor },
      { id: 'about', label: 'Tentang', icon: Info, Component: AboutEditor },
      { id: 'contact', label: 'Kontak & Footer', icon: Phone, Component: ContactFooterEditor },
      { id: 'assistant', label: 'Asisten Chat', icon: Bot, Component: AssistantEditor },
    ],
  },
  {
    group: 'Akunting',
    icon: Coins,
    roles: null,
    tabs: [
      { id: 'acc-dashboard', label: 'Dashboard Akunting', icon: LayoutDashboard, Component: AccountingDashboard, roles: ['owner', 'admin'] },
      { id: 'acc-master', label: 'Master Data', icon: Database, Component: MasterDataEditor, roles: ['owner', 'admin'] },
      { id: 'acc-transaction', label: 'Transaksi Baru', icon: FilePlus2, Component: TransactionForm, roles: ['owner', 'admin', 'staff'] },
      { id: 'acc-projects', label: 'Daftar Proyek', icon: FolderOpen, Component: ProjectsList, roles: null },
      { id: 'acc-assets', label: 'Aset Digital', icon: Globe, Component: DigitalAssetsList, roles: null },
      { id: 'acc-invoices', label: 'Invoice & Piutang', icon: Receipt, Component: InvoicesList, roles: ['owner', 'admin', 'staff'] },
      { id: 'acc-subscriptions', label: 'Langganan Retainer', icon: Repeat, Component: SubscriptionsEditor, roles: ['owner', 'admin'] },
      { id: 'acc-bank', label: 'Rekonsiliasi Bank', icon: Landmark, Component: BankReconciliation, roles: ['owner', 'admin'] },
      { id: 'acc-tax', label: 'Pajak', icon: Percent, Component: TaxModule, roles: ['owner', 'admin'] },
      { id: 'acc-audit', label: 'Audit Trail', icon: History, Component: AuditTrailViewer, roles: ['owner', 'admin'] },
      { id: 'acc-expenses', label: 'Pengeluaran', icon: Wallet, Component: ExpensesEditor, roles: ['owner', 'admin', 'staff'] },
      { id: 'acc-commissions', label: 'Komisi Tim', icon: Users, Component: CommissionsList, roles: ['owner', 'admin', 'staff'] },
    ],
  },
  {
    group: 'Pengaturan',
    icon: Settings,
    roles: ['owner', 'admin'],
    tabs: [{ id: 'acc-users', label: 'Kelola Pengguna', icon: UserCog, Component: UserManagement }],
  },
]

function visibleGroupsForRole(role) {
  return TAB_GROUPS.map((group) => {
    if (group.roles && !group.roles.includes(role)) return null
    const tabs = group.tabs.filter((tab) => !tab.roles || tab.roles.includes(role))
    return tabs.length > 0 ? { ...group, tabs } : null
  }).filter(Boolean)
}

function SidebarNav({ visibleGroups, currentTabId, onSelect, collapsed, onToggleGroup }) {
  return (
    <nav className="flex flex-col gap-1">
      {visibleGroups.map((group) => {
        const GroupIcon = group.icon
        const isCollapsed = collapsed[group.group]
        return (
          <div key={group.group} className="mb-1">
            <button
              type="button"
              onClick={() => onToggleGroup(group.group)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors hover:bg-white/5"
            >
              <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <GroupIcon size={13} /> {group.group}
              </span>
              <ChevronDown size={14} className={`text-slate-600 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
            </button>
            {!isCollapsed && (
              <div className="mt-0.5 flex flex-col gap-0.5">
                {group.tabs.map((tab) => {
                  const TabIcon = tab.icon
                  const active = currentTabId === tab.id
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => onSelect(tab.id)}
                      className={`group flex items-center gap-2.5 rounded-lg border-l-2 px-3 py-2.5 text-left text-sm font-medium transition-all ${
                        active
                          ? 'border-gold bg-gold/10 text-gold-soft'
                          : 'border-transparent text-slate-400 hover:border-white/20 hover:bg-white/5 hover:text-slate-200'
                      }`}
                    >
                      <TabIcon size={16} className={active ? 'text-gold-soft' : 'text-slate-500 group-hover:text-slate-300'} />
                      <span className="truncate">{tab.label}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )
}

export default function AdminApp() {
  const { authed: sessionAuthed, loading } = useAdminSession()
  const { role, loading: roleLoading } = useUserRole()
  // Override lokal untuk umpan balik instan: mode fallback (tanpa Supabase) tidak
  // reaktif sendiri terhadap login/logout, jadi status efektifnya dipandu dari sini
  // sampai sessionAuthed dari hook menyusul (selalu terjadi pada mode Supabase).
  const [localOverride, setLocalOverride] = useState(null)
  const [activeTab, setActiveTab] = useState(null)
  const [collapsedGroups, setCollapsedGroups] = useState({})
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    document.title = 'Admin CMS — Bangsa Media Bali'
  }, [])

  useEffect(() => {
    if (localOverride !== null && sessionAuthed === localOverride) setLocalOverride(null)
  }, [sessionAuthed, localOverride])

  if (loading || (isSupabaseConfigured && roleLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-nusatech-gradient text-sm text-slate-400">
        Memuat sesi admin...
      </div>
    )
  }

  const authed = localOverride !== null ? localOverride : sessionAuthed

  if (!authed) {
    return <AdminLogin onSuccess={() => setLocalOverride(true)} />
  }

  const handleLogout = () => {
    adminSignOut()
    setLocalOverride(false)
  }

  // Akun role 'client' (portal) tidak pernah dimaksudkan membuka CMS admin ini.
  if (role === 'client') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-nusatech-gradient px-5 text-center text-slate-100">
        <ShieldAlert size={40} className="text-amber-400" />
        <p className="text-lg font-bold">Akun ini bukan akun admin.</p>
        <p className="max-w-sm text-sm text-slate-400">
          Akun Anda terdaftar sebagai klien. Silakan gunakan Portal Klien untuk melihat status proyek dan invoice Anda.
        </p>
        <button type="button" onClick={handleLogout} className="btn-secondary !px-4 !py-2 text-xs">
          <LogOut size={14} /> Keluar
        </button>
      </div>
    )
  }

  const effectiveRole = role || 'owner' // mode fallback tanpa Supabase: akses penuh seperti sebelumnya
  const visibleGroups = visibleGroupsForRole(effectiveRole)
  const visibleTabs = visibleGroups.flatMap((g) => g.tabs)
  const currentTabId = activeTab && visibleTabs.some((t) => t.id === activeTab) ? activeTab : visibleTabs[0]?.id
  const currentTab = visibleTabs.find((t) => t.id === currentTabId)
  const ActiveComponent = currentTab?.Component

  const toggleGroup = (name) => setCollapsedGroups((prev) => ({ ...prev, [name]: !prev[name] }))
  const selectTab = (id) => {
    setActiveTab(id)
    setMobileMenuOpen(false)
  }

  return (
    <div className="min-h-screen bg-nusatech-gradient text-slate-100">
      <header className="glass-panel sticky top-0 z-40 flex items-center justify-between px-5 py-3 lg:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="rounded-lg p-2 text-slate-300 hover:bg-white/5 lg:hidden"
            aria-label="Buka menu"
          >
            <Menu size={20} />
          </button>
          <MascotIcon variant="assistant" size={40} className="hidden sm:block" />
          <div>
            <p className="text-sm font-bold text-white">CMS Admin Bangsa Media Bali</p>
            <p className="text-[11px] text-slate-400">
              {effectiveRole === 'owner' ? 'Owner' : effectiveRole === 'admin' ? 'Admin' : effectiveRole === 'staff' ? 'Staff' : 'Viewer'} &bull; Kelola website & akunting
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href="/" target="_blank" rel="noopener noreferrer" className="btn-secondary !px-3 !py-2 text-xs">
            <ExternalLink size={14} /> <span className="hidden sm:inline">Lihat Website</span>
          </a>
          <button type="button" onClick={handleLogout} className="btn-secondary !px-3 !py-2 text-xs">
            <LogOut size={14} /> <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-5 py-6 lg:px-8">
        {/* Sidebar desktop: sticky, scroll independen dari konten utama */}
        <aside className="hidden lg:block lg:w-72 lg:shrink-0">
          <div className="glass-panel sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-2xl p-3">
            <SidebarNav visibleGroups={visibleGroups} currentTabId={currentTabId} onSelect={selectTab} collapsed={collapsedGroups} onToggleGroup={toggleGroup} />
          </div>
        </aside>

        {/* Sidebar mobile: drawer geser dari kiri dengan overlay */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
            <div className="glass-panel absolute inset-y-0 left-0 w-[85%] max-w-xs overflow-y-auto p-3 shadow-2xl">
              <div className="mb-2 flex items-center justify-between px-2 py-1">
                <span className="text-sm font-bold text-white">Menu</span>
                <button type="button" onClick={() => setMobileMenuOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5" aria-label="Tutup menu">
                  <X size={18} />
                </button>
              </div>
              <SidebarNav visibleGroups={visibleGroups} currentTabId={currentTabId} onSelect={selectTab} collapsed={collapsedGroups} onToggleGroup={toggleGroup} />
            </div>
          </div>
        )}

        <main className="glass-panel min-h-[70vh] w-full min-w-0 flex-1 rounded-2xl p-5 sm:p-6 lg:p-8">
          {currentTab && (
            <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 lg:hidden">
              <currentTab.icon size={14} className="text-gold-soft" /> {currentTab.label}
            </p>
          )}
          {ActiveComponent && <ActiveComponent />}
        </main>
      </div>
    </div>
  )
}
