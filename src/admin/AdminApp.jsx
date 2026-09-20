import { useEffect, useState } from 'react'
import { ExternalLink, LogOut } from 'lucide-react'
import { adminSignOut, useAdminSession } from '../context/ContentContext'
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
import InvoicesList from './accounting/InvoicesList'
import ExpensesEditor from './accounting/ExpensesEditor'
import CommissionsList from './accounting/CommissionsList'

const TAB_GROUPS = [
  {
    group: 'Konten Website',
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
    tabs: [
      { id: 'acc-dashboard', label: 'Dashboard Akunting', Component: AccountingDashboard },
      { id: 'acc-master', label: 'Master Data', Component: MasterDataEditor },
      { id: 'acc-transaction', label: 'Transaksi Baru', Component: TransactionForm },
      { id: 'acc-projects', label: 'Daftar Proyek', Component: ProjectsList },
      { id: 'acc-assets', label: 'Aset Digital', Component: DigitalAssetsList },
      { id: 'acc-invoices', label: 'Invoice & Piutang', Component: InvoicesList },
      { id: 'acc-expenses', label: 'Pengeluaran', Component: ExpensesEditor },
      { id: 'acc-commissions', label: 'Komisi Tim', Component: CommissionsList },
    ],
  },
]

const TABS = TAB_GROUPS.flatMap((g) => g.tabs)

export default function AdminApp() {
  const { authed: sessionAuthed, loading } = useAdminSession()
  // Override lokal untuk umpan balik instan: mode fallback (tanpa Supabase) tidak
  // reaktif sendiri terhadap login/logout, jadi status efektifnya dipandu dari sini
  // sampai sessionAuthed dari hook menyusul (selalu terjadi pada mode Supabase).
  const [localOverride, setLocalOverride] = useState(null)
  const [activeTab, setActiveTab] = useState('analytics')

  useEffect(() => {
    document.title = 'Admin CMS — Bangsa Media Bali'
  }, [])

  useEffect(() => {
    if (localOverride !== null && sessionAuthed === localOverride) setLocalOverride(null)
  }, [sessionAuthed, localOverride])

  if (loading) {
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

  const ActiveComponent = TABS.find((t) => t.id === activeTab)?.Component

  return (
    <div className="min-h-screen bg-nusatech-gradient text-slate-100">
      <header className="glass-panel sticky top-0 z-40 flex items-center justify-between px-5 py-3 lg:px-8">
        <div className="flex items-center gap-3">
          <MascotIcon variant="assistant" size={40} />
          <div>
            <p className="text-sm font-bold text-white">CMS Admin Bangsa Media Bali</p>
            <p className="text-[11px] text-slate-400">Kelola seluruh konten website</p>
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
            {TAB_GROUPS.map((group) => (
              <div key={group.group}>
                <p className="px-3 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{group.group}</p>
                <div className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
                  {group.tabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-left text-sm font-medium transition-colors ${
                        activeTab === tab.id ? 'bg-gold/15 text-gold-soft' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
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
