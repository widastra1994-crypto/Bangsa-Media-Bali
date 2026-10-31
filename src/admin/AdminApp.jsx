import { useEffect, useState } from 'react'
import { ExternalLink, LogOut, ShieldAlert, Menu, X, ChevronDown, ChevronRight, Lock } from 'lucide-react'
import { adminSignOut, useAdminSession } from '../context/ContentContext'
import { useUserRole } from './useUserRole'
import { visibleGroupsFor } from './menuConfig'
import { isSupabaseConfigured } from '../lib/supabaseClient'
import AdminLogin from './AdminLogin'
import logoFull from '../assets/logo-full.png'
import './admin-theme.css'
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

const ROLE_NAME = { owner: 'Owner', admin: 'Admin', staff: 'Staff', viewer: 'Viewer' }

function Brand() {
  return (
    <div>
      <img src={logoFull} alt="Bangsa Media Bali" className="h-10 w-auto" />
      <p className="adm-eyebrow mt-2 !text-[10.5px]">CMS Admin &amp; Akunting</p>
    </div>
  )
}

function SidebarNav({ visibleGroups, currentTabId, onSelect, collapsed, onToggleGroup }) {
  return (
    <nav className="flex flex-col gap-4 px-3 py-4">
      {visibleGroups.map((group) => {
        const isCollapsed = collapsed[group.group]
        return (
          <div key={group.group}>
            <button
              type="button"
              onClick={() => onToggleGroup(group.group)}
              className="adm-eyebrow mb-1.5 flex w-full items-center justify-between px-2 text-left hover:text-[color:var(--ink)]"
              aria-expanded={!isCollapsed}
            >
              {group.group}
              <ChevronDown size={13} className={`transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
            </button>
            {!isCollapsed && (
              <ul className="flex flex-col gap-0.5">
                {group.tabs.map((tab) => {
                  const TabIcon = tab.icon
                  const active = currentTabId === tab.id
                  return (
                    <li key={tab.id}>
                      <button type="button" onClick={() => onSelect(tab.id)} aria-current={active ? 'page' : undefined} className="adm-nav-item">
                        <TabIcon size={17} className="adm-nav-icon shrink-0" />
                        <span className="truncate">{tab.label}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )
      })}
    </nav>
  )
}

function AccountFooter({ account, role, onLogout }) {
  const display = account.name || account.email || 'Pengguna'
  return (
    <div className="flex items-center gap-2.5 border-t border-[#e1e9f3] px-5 py-3">
      <span className="adm-avatar grid h-8 w-8 shrink-0 place-items-center rounded-full text-[12px] font-semibold uppercase text-white ring-2 ring-[#e1e9f3]">
        {display.slice(0, 2)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-[color:var(--ink)]">{display}</p>
        <p className="truncate text-[11.5px] text-[color:var(--muted)]">{ROLE_NAME[role] || role}</p>
      </div>
      <button
        type="button"
        onClick={onLogout}
        title="Keluar"
        aria-label="Keluar"
        className="rounded-md p-1.5 text-[color:var(--muted)] transition-colors hover:bg-[#edf4fc] hover:text-[color:var(--ink)]"
      >
        <LogOut size={16} />
      </button>
    </div>
  )
}

function CenteredScreen({ children }) {
  return <div className="admin-theme flex min-h-screen flex-col items-center justify-center gap-4 px-5 text-center">{children}</div>
}

export default function AdminApp() {
  const { authed: sessionAuthed, loading } = useAdminSession()
  const { role, menuAccess, account, error: roleError, loading: roleLoading } = useUserRole()
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
      <CenteredScreen>
        <p className="text-sm text-slate-400">Memuat sesi admin...</p>
      </CenteredScreen>
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
      <CenteredScreen>
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
      </CenteredScreen>
    )
  }

  // Sesi sudah ada tapi role belum termuat (sesaat setelah login): tunggu, jangan
  // menebak -- dulu jatuh ke 'owner' sehingga staf sekilas melihat semua menu.
  if (isSupabaseConfigured && !role) {
    return (
      <CenteredScreen>
        <p className="text-sm text-slate-400">Memuat sesi admin...</p>
      </CenteredScreen>
    )
  }

  // Akun role 'client' (portal) tidak pernah dimaksudkan membuka CMS admin ini.
  if (role === 'client') {
    return (
      <CenteredScreen>
        <ShieldAlert size={40} className="text-amber-400" />
        <p className="text-lg font-bold">Akun ini bukan akun admin.</p>
        <p className="max-w-sm text-sm text-slate-400">
          Akun Anda terdaftar sebagai klien. Silakan gunakan Portal Klien untuk melihat status proyek dan invoice Anda.
        </p>
        <button type="button" onClick={handleLogout} className="btn-secondary !px-4 !py-2 text-xs">
          <LogOut size={14} /> Keluar
        </button>
      </CenteredScreen>
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

  const currentGroup = visibleGroups.find((g) => g.tabs.some((t) => t.id === currentTabId))
  const navProps = { visibleGroups, currentTabId, onSelect: selectTab, collapsed: collapsedGroups, onToggleGroup: toggleGroup }

  return (
    <div className="admin-theme flex min-h-screen">
      {/* Sidebar desktop: putih, setinggi layar, scroll sendiri */}
      <aside className="adm-sidebar sticky top-0 hidden h-screen w-[256px] shrink-0 flex-col border-r shadow-[4px_0_24px_-16px_rgba(21,33,58,0.25)] lg:flex">
        <div className="mx-3 mt-4 border-b border-[#e1e9f3] px-2 pb-4">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav {...navProps} />
        </div>
        <AccountFooter account={account} role={effectiveRole} onLogout={handleLogout} />
      </aside>

      {/* Sidebar mobile: drawer geser dari kiri dengan overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="adm-sidebar absolute inset-y-0 left-0 flex w-[85%] max-w-xs flex-col border-r shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#e1e9f3] px-5 py-4">
              <Brand />
              <button type="button" onClick={() => setMobileMenuOpen(false)} className="rounded-md p-1.5 text-[color:var(--muted)] hover:bg-[#edf4fc]" aria-label="Tutup menu">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <SidebarNav {...navProps} />
            </div>
            <AccountFooter account={account} role={effectiveRole} onLogout={handleLogout} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="adm-topbar sticky top-0 z-40 flex items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-md p-2 text-[color:var(--ink)] hover:bg-[#edf4fc] lg:hidden"
              aria-label="Buka menu"
            >
              <Menu size={20} />
            </button>
            <img src={logoFull} alt="Bangsa Media Bali" className="h-8 w-auto sm:hidden" />
            {currentTab && (
              <nav aria-label="Lokasi halaman" className="hidden min-w-0 items-center gap-1.5 text-[13px] sm:flex">
                <span className="truncate text-[color:var(--muted)]">{currentGroup?.group}</span>
                <ChevronRight size={14} className="shrink-0 text-[color:var(--faint)]" />
                <span className="flex items-center gap-1.5 truncate font-medium text-[color:var(--ink)]">
                  <currentTab.icon size={15} className="shrink-0 text-[color:var(--accent)]" /> {currentTab.label}
                </span>
              </nav>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <GlobalSearch onNavigate={selectTab} allowedTabIds={allowedTabIds} />
            <NotificationCenter onNavigate={selectTab} allowedTabIds={allowedTabIds} />
            <a href="/" target="_blank" rel="noopener noreferrer" className="btn-secondary !px-3 !py-2 text-xs">
              <ExternalLink size={14} /> <span className="hidden md:inline">Lihat Website</span>
            </a>
          </div>
        </header>

        <main className="admin-content mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {currentTab && (
            <p className="mb-3 flex items-center gap-2 text-[13px] font-medium text-[color:var(--muted)] sm:hidden">
              <currentTab.icon size={15} className="text-[color:var(--accent)]" /> {currentTab.label}
            </p>
          )}
          <div className="glass-panel min-h-[70vh] rounded-2xl p-5 sm:p-6 lg:p-7">
            {ActiveComponent && <ActiveComponent />}
            {visibleTabs.length === 0 && (
              <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
                <Lock size={32} className="text-slate-600" />
                <p className="text-sm font-semibold text-white">Belum ada menu yang diizinkan untuk akun Anda.</p>
                <p className="max-w-sm text-xs text-slate-400">Hubungi Owner/Admin untuk mengatur akses menu Anda di halaman Kelola Pengguna.</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
