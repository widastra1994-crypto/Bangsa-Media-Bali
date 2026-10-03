import { useEffect, useState } from 'react'
import { ExternalLink, LogOut, ShieldAlert, Menu, X, ChevronDown, Lock } from 'lucide-react'
import { adminSignOut, useAdminSession } from '../context/ContentContext'
import { useUserRole } from './useUserRole'
import { visibleGroupsFor } from './menuConfig'
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
import VendorBillsEditor from './accounting/VendorBillsEditor'
import StaffProgressBoard from './accounting/StaffProgressBoard'
import ProfitabilityReport from './accounting/ProfitabilityReport'
import TimeLogsEditor from './accounting/TimeLogsEditor'
import ContractsEditor from './accounting/ContractsEditor'
import GlobalSearch from './GlobalSearch'
import NotificationCenter from './NotificationCenter'

// Daftar menu, label, ikon & batas role ada di menuConfig.js; di sini hanya
// pemetaan id menu -> komponen halamannya.
const TAB_COMPONENTS = {
  analytics: AnalyticsDashboard,
  brand: BrandNavEditor,
  hero: HeroEditor,
  services: ServicesEditor,
  pricing: PricingEditor,
  calculator: CalculatorEditor,
  portfolio: PortfolioEditor,
  testimonials: TestimonialsEditor,
  blog: BlogEditor,
  advantages: AdvantagesEditor,
  about: AboutEditor,
  contact: ContactFooterEditor,
  assistant: AssistantEditor,
  'acc-dashboard': AccountingDashboard,
  'acc-master': MasterDataEditor,
  'acc-profitability': ProfitabilityReport,
  'acc-transaction': TransactionForm,
  'acc-projects': ProjectsList,
  'acc-assets': DigitalAssetsList,
  'acc-staff-progress': StaffProgressBoard,
  'acc-time-logs': TimeLogsEditor,
  'acc-contracts': ContractsEditor,
  'acc-invoices': InvoicesList,
  'acc-vendor-bills': VendorBillsEditor,
  'acc-subscriptions': SubscriptionsEditor,
  'acc-expenses': ExpensesEditor,
  'acc-commissions': CommissionsList,
  'acc-bank': BankReconciliation,
  'acc-tax': TaxModule,
  'acc-audit': AuditTrailViewer,
  'acc-users': UserManagement,
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
  const { role, menuAccess, error: roleError, loading: roleLoading } = useUserRole()
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
    setActiveTab(null)
  }

  if (isSupabaseConfigured && roleError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-nusatech-gradient px-5 text-center text-slate-100">
        <ShieldAlert size={40} className="text-amber-400" />
        <p className="text-lg font-bold">Profil akun gagal dimuat.</p>
        <p className="max-w-sm text-sm text-slate-400">{roleError}</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => window.location.reload()} className="btn-primary !px-4 !py-2 text-xs">
            Muat Ulang
          </button>
          <button type="button" onClick={handleLogout} className="btn-secondary !px-4 !py-2 text-xs">
            <LogOut size={14} /> Keluar
          </button>
        </div>
      </div>
    )
  }

  // Sesi sudah ada tapi role belum termuat (sesaat setelah login): tunggu, jangan
  // menebak -- dulu jatuh ke 'owner' sehingga staf sekilas melihat semua menu.
  if (isSupabaseConfigured && !role) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-nusatech-gradient text-sm text-slate-400">
        Memuat sesi admin...
      </div>
    )
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

  // 'owner' hanya untuk mode fallback tanpa Supabase (akses penuh lokal).
  const effectiveRole = isSupabaseConfigured ? role : role || 'owner'
  const visibleGroups = visibleGroupsFor(effectiveRole, menuAccess)
  const visibleTabs = visibleGroups.flatMap((g) => g.tabs)
  const allowedTabIds = visibleTabs.map((t) => t.id)
  const currentTabId = activeTab && allowedTabIds.includes(activeTab) ? activeTab : visibleTabs[0]?.id
  const currentTab = visibleTabs.find((t) => t.id === currentTabId)
  const ActiveComponent = currentTab ? TAB_COMPONENTS[currentTab.id] : null

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
          <GlobalSearch onNavigate={selectTab} allowedTabIds={allowedTabIds} />
          <NotificationCenter onNavigate={selectTab} allowedTabIds={allowedTabIds} />
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
          {visibleTabs.length === 0 && (
            <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
              <Lock size={32} className="text-slate-600" />
              <p className="text-sm font-semibold text-white">Belum ada menu yang diizinkan untuk akun Anda.</p>
              <p className="max-w-sm text-xs text-slate-400">Hubungi Owner/Admin untuk mengatur akses menu Anda di halaman Kelola Pengguna.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
