import { useEffect, useState } from 'react'
import { ExternalLink, LogOut, ShieldAlert } from 'lucide-react'
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
    roles: ['owner', 'admin'],
    tabs: [
      { id: 'analytics', label: 'Dashboard Analitik', Component: AnalyticsDashboard },
      { id: 'brand', label: 'Brand & Navigasi', Component: BrandNavEditor },
      { id: 'hero', label: 'Hero', Component: HeroEditor },
      { id: 'services', label: 'Layanan', Component: ServicesEditor },
      { id: 'pricing', label: 'Paket Harga', Component: PricingEditor },
      { id: 'calculator', label: 'Kalkulator', Component: CalculatorEditor },
      { id: 'portfolio', label: 'Portofolio', Component: PortfolioEditor },
      { id: 'testimonials', label: 'Testimoni', Component: TestimonialsEditor },
      { id: 'blog', label: 'Blog', Component: BlogEditor },
      { id: 'advantages', label: 'Keunggulan', Component: AdvantagesEditor },
      { id: 'about', label: 'Tentang', Component: AboutEditor },
      { id: 'contact', label: 'Kontak & Footer', Component: ContactFooterEditor },
      { id: 'assistant', label: 'Asisten Chat', Component: AssistantEditor },
    ],
  },
  {
    group: 'Akunting',
    roles: null,
    tabs: [
      { id: 'acc-dashboard', label: 'Dashboard Akunting', Component: AccountingDashboard, roles: ['owner', 'admin'] },
      { id: 'acc-master', label: 'Master Data', Component: MasterDataEditor, roles: ['owner', 'admin'] },
      { id: 'acc-transaction', label: 'Transaksi Baru', Component: TransactionForm, roles: ['owner', 'admin', 'staff'] },
      { id: 'acc-projects', label: 'Daftar Proyek', Component: ProjectsList, roles: null },
      { id: 'acc-assets', label: 'Aset Digital', Component: DigitalAssetsList, roles: null },
      { id: 'acc-invoices', label: 'Invoice & Piutang', Component: InvoicesList, roles: ['owner', 'admin', 'staff'] },
      { id: 'acc-subscriptions', label: 'Langganan Retainer', Component: SubscriptionsEditor, roles: ['owner', 'admin'] },
      { id: 'acc-bank', label: 'Rekonsiliasi Bank', Component: BankReconciliation, roles: ['owner', 'admin'] },
      { id: 'acc-tax', label: 'Pajak', Component: TaxModule, roles: ['owner', 'admin'] },
      { id: 'acc-audit', label: 'Audit Trail', Component: AuditTrailViewer, roles: ['owner', 'admin'] },
      { id: 'acc-expenses', label: 'Pengeluaran', Component: ExpensesEditor, roles: ['owner', 'admin', 'staff'] },
      { id: 'acc-commissions', label: 'Komisi Tim', Component: CommissionsList, roles: ['owner', 'admin', 'staff'] },
    ],
  },
  {
    group: 'Pengaturan',
    roles: ['owner', 'admin'],
    tabs: [{ id: 'acc-users', label: 'Kelola Pengguna', Component: UserManagement }],
  },
]

function visibleGroupsForRole(role) {
  return TAB_GROUPS.map((group) => {
    if (group.roles && !group.roles.includes(role)) return null
    const tabs = group.tabs.filter((tab) => !tab.roles || tab.roles.includes(role))
    return tabs.length > 0 ? { ...group, tabs } : null
  }).filter(Boolean)
}

export default function AdminApp() {
  const { authed: sessionAuthed, loading } = useAdminSession()
  const { role, loading: roleLoading } = useUserRole()
  // Override lokal untuk umpan balik instan: mode fallback (tanpa Supabase) tidak
  // reaktif sendiri terhadap login/logout, jadi status efektifnya dipandu dari sini
  // sampai sessionAuthed dari hook menyusul (selalu terjadi pada mode Supabase).
  const [localOverride, setLocalOverride] = useState(null)
  const [activeTab, setActiveTab] = useState(null)

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
  const ActiveComponent = visibleTabs.find((t) => t.id === currentTabId)?.Component

  return (
    <div className="min-h-screen bg-nusatech-gradient text-slate-100">
      <header className="glass-panel sticky top-0 z-40 flex items-center justify-between px-5 py-3 lg:px-8">
        <div className="flex items-center gap-3">
          <MascotIcon variant="assistant" size={40} />
          <div>
            <p className="text-sm font-bold text-white">CMS Admin Bangsa Media Bali</p>
            <p className="text-[11px] text-slate-400">
              {effectiveRole === 'owner' ? 'Owner' : effectiveRole === 'admin' ? 'Admin' : effectiveRole === 'staff' ? 'Staff' : 'Viewer'} &bull; Kelola website & akunting
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href="/" target="_blank" rel="noopener noreferrer" className="btn-secondary !px-3 !py-2 text-xs">
            <ExternalLink size={14} /> Lihat Website
          </a>
          <button type="button" onClick={handleLogout} className="btn-secondary !px-3 !py-2 text-xs">
            <LogOut size={14} /> Keluar
          </button>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-6 lg:flex-row lg:px-8">
        <aside className="lg:w-64 lg:shrink-0">
          <nav className="glass-panel flex flex-col gap-4 overflow-x-auto rounded-2xl p-2 lg:overflow-visible">
            {visibleGroups.map((group) => (
              <div key={group.group}>
                <p className="px-3 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{group.group}</p>
                <div className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
                  {group.tabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-left text-sm font-medium transition-colors ${
                        currentTabId === tab.id ? 'bg-gold/15 text-gold-soft' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <main className="glass-panel min-h-[70vh] flex-1 rounded-2xl p-6 lg:p-8">
          {ActiveComponent && <ActiveComponent />}
        </main>
      </div>
    </div>
  )
}
