import { Fragment, useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Download } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { exportToCsv } from './csvExport'
import { useUserRole } from '../useUserRole'
import ProjectTasksPanel from './ProjectTasksPanel'

const idr = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0)

const STATUS_OPTIONS = ['planning', 'in_progress', 'completed', 'cancelled']
const STATUS_LABEL = { planning: 'Perencanaan', in_progress: 'Dikerjakan', completed: 'Selesai', cancelled: 'Batal' }
const STATUS_COLOR = {
  planning: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/30',
  in_progress: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
  completed: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
  cancelled: 'bg-red-500/20 text-red-300 border-red-400/30',
}

export default function ProjectsList() {
  const { role, isOwnerOrAdmin } = useUserRole()
  const [rows, setRows] = useState([])
  const [taskStats, setTaskStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      supabase.from('acc_projects').select('*, acc_clients(company_name, email), acc_service_categories(name)').order('created_at', { ascending: false }),
      supabase.from('acc_project_tasks').select('project_id, status'),
    ]).then(([proj, tasks]) => {
      if (proj.error) setError(proj.error.message)
      else setRows(proj.data || [])
      const stats = {}
      ;(tasks.data || []).forEach((t) => {
        if (!stats[t.project_id]) stats[t.project_id] = { done: 0, total: 0 }
        stats[t.project_id].total += 1
        if (t.status === 'done') stats[t.project_id].done += 1
      })
      setTaskStats(stats)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const canAddTasks = role !== 'viewer'

  const updateStatus = async (id, status) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)))
    const { error: err } = await supabase.from('acc_projects').update({ status }).eq('id', id)
    if (err) setError(err.message)
  }

  const exportProjects = () =>
    exportToCsv(
      'daftar-proyek',
      rows.map((r) => ({
        Klien: r.acc_clients?.company_name,
        Proyek: r.website_name,
        Kategori: r.acc_service_categories?.name,
        'Harga Jual': r.deal_price,
        Tanggal: r.project_date,
        Status: STATUS_LABEL[r.status],
      })),
    )

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Daftar Proyek</h2>
          <p className="mt-1 text-sm text-slate-400">Seluruh proyek yang dibuat lewat Form Transaksi Terpadu.</p>
        </div>
        <button type="button" onClick={exportProjects} disabled={rows.length === 0} className="btn-secondary !px-3 !py-2 text-xs disabled:opacity-50">
          <Download size={14} /> Ekspor CSV
        </button>
      </div>

      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

      <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-left text-xs">
          <thead className="bg-white/5 text-slate-400">
            <tr>
              <th className="px-4 py-3">Klien</th>
              <th className="px-4 py-3">Proyek</th>
              <th className="px-4 py-3">Kategori</th>
              <th className="px-4 py-3">Harga Jual</th>
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Progres</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                  Memuat...
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                  Belum ada proyek. Buat lewat menu "Transaksi Baru".
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const stats = taskStats[row.id]
              const pct = stats && stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0
              const expanded = expandedId === row.id
              return (
                <Fragment key={row.id}>
                  <tr className="border-t border-white/5 text-slate-300">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-white">{row.acc_clients?.company_name || '-'}</p>
                      <p className="text-[11px] text-slate-500">{row.acc_clients?.email}</p>
                    </td>
                    <td className="px-4 py-3">{row.website_name || '-'}</td>
                    <td className="px-4 py-3">{row.acc_service_categories?.name || '-'}</td>
                    <td className="px-4 py-3">{idr(row.deal_price)}</td>
                    <td className="px-4 py-3">{row.project_date}</td>
                    <td className="px-4 py-3">
                      <select
                        value={row.status}
                        onChange={(e) => updateStatus(row.id, e.target.value)}
                        className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${STATUS_COLOR[row.status]}`}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s} className="bg-navy-950 text-white">
                            {STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {stats && stats.total > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
                            <div className="h-full rounded-full bg-gradient-to-r from-cyan-royal to-gold-soft" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[11px] font-semibold text-slate-400">{pct}%</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-600">Belum ada tugas</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : row.id)}
                        className="flex items-center gap-1 text-[11px] font-semibold text-cyan-royal hover:text-cyan-300"
                      >
                        {expanded ? 'Tutup' : 'Kelola'} {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="border-t border-white/5">
                      <td colSpan={8} className="bg-white/[0.02] px-4 py-4">
                        <ProjectTasksPanel
                          projectId={row.id}
                          canManage={isOwnerOrAdmin}
                          canAdd={canAddTasks}
                          onStatsChange={(s) => setTaskStats((prev) => ({ ...prev, [row.id]: s }))}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
