import { useEffect, useMemo, useState } from 'react'
import { Briefcase, Coins, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'

const idr = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0)

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${accent}`}>
        <Icon size={18} />
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{label}</p>
    </div>
  )
}

export default function AccountingDashboard() {
  const [invoices, setInvoices] = useState([])
  const [payments, setPayments] = useState([])
  const [expenses, setExpenses] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('acc_invoices').select('*'),
      supabase.from('acc_payments').select('*'),
      supabase.from('acc_expenses').select('*'),
      supabase.from('acc_projects').select('*'),
    ]).then(([inv, pay, exp, proj]) => {
      setInvoices(inv.data || [])
      setPayments(pay.data || [])
      setExpenses(exp.data || [])
      setProjects(proj.data || [])
      setLoading(false)
    })
  }, [])

  const stats = useMemo(() => {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const piutang = invoices
      .filter((i) => ['sent', 'partial', 'overdue'].includes(i.status))
      .reduce((s, i) => s + (Number(i.total_amount) - Number(i.paid_amount)), 0)

    const kasMasukBulanIni = payments.filter((p) => new Date(p.payment_date) >= startOfMonth).reduce((s, p) => s + Number(p.amount_paid), 0)

    const bebanBulanIni = expenses.filter((e) => new Date(e.expense_date) >= startOfMonth).reduce((s, e) => s + Number(e.amount), 0)

    const labaBersihBulanIni = kasMasukBulanIni - bebanBulanIni

    const proyekAktif = projects.filter((p) => ['planning', 'in_progress'].includes(p.status)).length

    return { piutang, kasMasukBulanIni, bebanBulanIni, labaBersihBulanIni, proyekAktif }
  }, [invoices, payments, expenses, projects])

  return (
    <div>
      <h2 className="text-lg font-semibold text-white">Dashboard Akunting</h2>
      <p className="mt-1 text-sm text-slate-400">Ringkasan kas riil bulan berjalan (cash-basis) dan status piutang.</p>

      {loading ? (
        <p className="mt-6 text-sm text-slate-400">Memuat data...</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
          <StatCard icon={TrendingUp} label="Kas Masuk Bulan Ini" value={idr(stats.kasMasukBulanIni)} accent="bg-emerald-500/15 text-emerald-300" />
          <StatCard icon={TrendingDown} label="Beban Bulan Ini" value={idr(stats.bebanBulanIni)} accent="bg-red-500/15 text-red-300" />
          <StatCard
            icon={Coins}
            label="Laba Bersih Bulan Ini (Cash-Basis)"
            value={idr(stats.labaBersihBulanIni)}
            accent={stats.labaBersihBulanIni >= 0 ? 'bg-gold/15 text-gold-soft' : 'bg-red-500/15 text-red-300'}
          />
          <StatCard icon={Wallet} label="Sisa Piutang Belum Lunas" value={idr(stats.piutang)} accent="bg-amber-500/15 text-amber-300" />
          <StatCard icon={Briefcase} label="Proyek Aktif" value={stats.proyekAktif} accent="bg-cyan-500/15 text-cyan-300" />
        </div>
      )}

      <p className="mt-6 text-xs text-slate-500">
        Catatan: laba bersih dihitung murni dari kas masuk riil (deposit + pelunasan) dikurangi beban keluar riil, sesuai prinsip cash-basis accounting.
        Piutang yang belum lunas tidak diakui sebagai kas dan otomatis tetap tercatat sampai dibayar.
      </p>
    </div>
  )
}
