import { useEffect, useMemo, useState } from 'react'
import { Download, TrendingDown, TrendingUp } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { exportToCsv } from './csvExport'

const idr = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0)

export default function ProfitabilityReport() {
  const [projects, setProjects] = useState([])
  const [assets, setAssets] = useState([])
  const [expenses, setExpenses] = useState([])
  const [commissions, setCommissions] = useState([])
  const [timeLogs, setTimeLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('acc_projects').select('*, acc_clients(company_name)'),
      supabase.from('acc_digital_assets').select('project_id, domain_cost, server_cost'),
      supabase.from('acc_expenses').select('project_id, amount').not('project_id', 'is', null),
      supabase.from('acc_commissions').select('project_id, commission_amount'),
      supabase.from('acc_time_logs').select('project_id, hours'),
    ]).then(([proj, asset, exp, comm, tl]) => {
      setProjects(proj.data || [])
      setAssets(asset.data || [])
      setExpenses(exp.data || [])
      setCommissions(comm.data || [])
      setTimeLogs(tl.data || [])
      setLoading(false)
    })
  }, [])

  const rows = useMemo(() => {
    return projects.map((p) => {
      const assetCost = assets.filter((a) => a.project_id === p.id).reduce((s, a) => s + Number(a.domain_cost || 0) + Number(a.server_cost || 0), 0)
      const expenseCost = expenses.filter((e) => e.project_id === p.id).reduce((s, e) => s + Number(e.amount || 0), 0)
      const commissionCost = commissions.filter((c) => c.project_id === p.id).reduce((s, c) => s + Number(c.commission_amount || 0), 0)
      const hours = timeLogs.filter((t) => t.project_id === p.id).reduce((s, t) => s + Number(t.hours || 0), 0)
      const totalCost = assetCost + expenseCost + commissionCost
      const revenue = Number(p.deal_price || 0)
      const margin = revenue - totalCost
      const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0
      const perHour = hours > 0 ? margin / hours : null
      return { ...p, assetCost, expenseCost, commissionCost, totalCost, revenue, margin, marginPct, hours, perHour }
    })
  }, [projects, assets, expenses, commissions, timeLogs])

  const totals = rows.reduce(
    (acc, r) => ({ revenue: acc.revenue + r.revenue, cost: acc.cost + r.totalCost, margin: acc.margin + r.margin }),
    { revenue: 0, cost: 0, margin: 0 },
  )

  const exportReport = () =>
    exportToCsv(
      'profitabilitas-proyek',
      rows.map((r) => ({
        Klien: r.acc_clients?.company_name,
        Proyek: r.website_name,
        'Harga Jual': r.revenue,
        'Beban Aset': r.assetCost,
        'Beban Lain': r.expenseCost,
        Komisi: r.commissionCost,
        'Total Beban': r.totalCost,
        Margin: r.margin,
        'Margin %': r.marginPct.toFixed(1),
        'Jam Kerja': r.hours,
      })),
    )

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Analisis Profitabilitas Proyek</h2>
          <p className="mt-1 text-sm text-slate-400">Margin riil tiap proyek: harga jual dikurangi seluruh beban (aset, pengeluaran, komisi).</p>
        </div>
        <button type="button" onClick={exportReport} disabled={rows.length === 0} className="btn-secondary !px-3 !py-2 text-xs disabled:opacity-50">
          <Download size={14} /> Ekspor CSV
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-slate-400">Total Pendapatan</p>
          <p className="text-lg font-bold text-white">{idr(totals.revenue)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-slate-400">Total Beban</p>
          <p className="text-lg font-bold text-red-300">{idr(totals.cost)}</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="text-xs text-emerald-300">Total Margin</p>
          <p className="text-lg font-bold text-emerald-300">{idr(totals.margin)}</p>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-left text-xs">
          <thead className="bg-white/5 text-slate-400">
            <tr>
              <th className="px-4 py-3">Proyek</th>
              <th className="px-4 py-3">Pendapatan</th>
              <th className="px-4 py-3">Beban</th>
              <th className="px-4 py-3">Margin</th>
              <th className="px-4 py-3">Margin %</th>
              <th className="px-4 py-3">Jam Kerja</th>
              <th className="px-4 py-3">Rp/Jam</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                  Memuat...
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                  Belum ada proyek.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-white/5 text-slate-300">
                <td className="px-4 py-3">
                  <p className="font-semibold text-white">{r.website_name || '-'}</p>
                  <p className="text-[11px] text-slate-500">{r.acc_clients?.company_name}</p>
                </td>
                <td className="px-4 py-3">{idr(r.revenue)}</td>
                <td className="px-4 py-3 text-red-300">{idr(r.totalCost)}</td>
                <td className={`px-4 py-3 font-semibold ${r.margin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  <span className="flex items-center gap-1">
                    {r.margin >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {idr(r.margin)}
                  </span>
                </td>
                <td className="px-4 py-3">{r.marginPct.toFixed(1)}%</td>
                <td className="px-4 py-3">{r.hours || '-'}</td>
                <td className="px-4 py-3">{r.perHour !== null ? idr(r.perHour) : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
