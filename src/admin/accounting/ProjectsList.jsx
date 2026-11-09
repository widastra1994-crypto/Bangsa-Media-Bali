import { Fragment, useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Download, FilePlus2, Pencil, Trash2, X } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { exportToCsv } from './csvExport'
import { useUserRole } from '../useUserRole'
import ProjectTasksPanel from './ProjectTasksPanel'
import { AdditionalChargeDialog } from './ExtraCharges'
import ProjectEditDialog from './ProjectEditDialog'

const idr = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0)

const STATUS_OPTIONS = ['planning', 'in_progress', 'completed', 'cancelled']
const STATUS_LABEL = { planning: 'Perencanaan', in_progress: 'Dikerjakan', completed: 'Selesai', cancelled: 'Batal' }
const STATUS_COLOR = {
  planning: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/30',
  in_progress: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
  completed: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
  cancelled: 'bg-red-500/20 text-red-300 border-red-400/30',
}

// Konfirmasi hapus proyek Batal: tampilkan dulu semua data yang ikut terhapus
// (ringkasan dari project_delete dry-run), baru hapus permanen.
function DeleteProjectDialog({ project, onClose, onDeleted }) {
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.rpc('project_delete', { p_project_id: project.id, p_dry_run: true }).then(({ data, error: err }) => {
      if (err) setError(err.message)
      else setSummary(data)
    })
  }, [project.id])

  const remove = async () => {
    setBusy(true)
    const { error: err } = await supabase.rpc('project_delete', { p_project_id: project.id, p_dry_run: false })
    setBusy(false)
    if (err) return setError(err.message)
    onDeleted(project)
  }

  const items = summary
    ? [
        [summary.invoices, `invoice (total ${idr(summary.invoice_total)})`],
        [summary.payments, `pembayaran klien (${idr(summary.payment_total)})`],
        [summary.expenses, `pengeluaran (${idr(summary.expense_total)})`],
        [summary.commissions, `komisi staf${summary.commissions_paid ? `, ${summary.commissions_paid} sudah dibayar` : ''}`],
        [summary.assets, 'aset digital (domain/server)'],
        [summary.contracts, 'kontrak'],
        [summary.subscriptions, 'langganan bulanan'],
        [summary.tasks, 'tugas proyek'],
      ].filter(([n]) => Number(n) > 0)
    : []
  const name = project.website_name || 'HAPUS'

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto overscroll-contain bg-black/60 px-3 py-6 sm:p-6">
      <div className="glass-panel mx-auto my-4 w-full max-w-lg rounded-2xl p-4 sm:my-10 sm:p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">Hapus Proyek {project.website_name}</h3>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white" aria-label="Tutup">
            <X size={18} />
          </button>
        </div>
        {!summary && !error && <p className="mt-4 text-sm text-slate-400">Memeriksa data terkait...</p>}
        {summary && (
          <>
            <p className="mt-3 text-sm text-slate-300">
              Proyek ini dan semua data di bawah akan dihapus permanen, termasuk jurnalnya di Buku Besar. Proyek tidak lagi dihitung di piutang maupun laporan.
            </p>
            <ul className="mt-3 space-y-1 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
              {items.length === 0 && <li>Tidak ada data terkait selain proyeknya.</li>}
              {items.map(([n, label]) => (
                <li key={label}>
                  • <b>{n}</b> {label}
                </li>
              ))}
            </ul>
            {Number(summary.payments) > 0 && (
              <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                Ada pembayaran klien yang ikut terhapus, sehingga saldo kas di laporan berkurang {idr(summary.payment_total)}. Kalau uang itu benar-benar diterima
                dan tidak dikembalikan, jangan hapus proyek ini.
              </p>
            )}
            {summary.status !== 'cancelled' && (
              <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                Status proyek ini masih <b>{STATUS_LABEL[summary.status] || summary.status}</b>, belum Batal. Pastikan proyek ini memang salah input atau
                tidak jadi, karena pendapatannya akan hilang dari laporan.
              </p>
            )}
            <label className="label-field mt-4">
              Ketik <b>{name}</b> untuk konfirmasi
            </label>
            <input className="input-field" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
          </>
        )}
        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary !py-2 text-xs">
            Batal
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={!summary || busy || confirmText.trim() !== name}
            className="btn-primary !bg-red-600 !py-2 text-xs disabled:opacity-50"
          >
            <Trash2 size={13} /> {busy ? 'Menghapus...' : 'Hapus Permanen'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ProjectsList() {
  const { role, isOwnerOrAdmin } = useUserRole()
  const [rows, setRows] = useState([])
  const [taskStats, setTaskStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [charging, setCharging] = useState(null)
  const [editing, setEditing] = useState(null)
  const [notice, setNotice] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      supabase.from('acc_projects').select('*, acc_clients(company_name, email, pic_name, phone_primary), acc_service_categories(name)').order('created_at', { ascending: false }),
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
      {notice && <p className="mt-3 text-xs text-cyan-300">{notice}</p>}

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
                      <div className="flex items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setExpandedId(expanded ? null : row.id)}
                          className="flex items-center gap-1 text-[11px] font-semibold text-cyan-royal hover:text-cyan-300"
                        >
                          {expanded ? 'Tutup' : 'Kelola'} {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                        {canAddTasks && (
                          <button
                            type="button"
                            onClick={() => setEditing(row)}
                            className="flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-slate-600 hover:text-slate-800"
                            title="Edit proyek"
                          >
                            <Pencil size={13} /> Edit
                          </button>
                        )}
                        {canAddTasks && row.status !== 'cancelled' && (
                          <button
                            type="button"
                            onClick={() => setCharging(row)}
                            className="flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-emerald-600 hover:text-emerald-500"
                            title="Tagihan tambahan, mis. iklan atau revisi"
                          >
                            <FilePlus2 size={13} /> Tagihan
                          </button>
                        )}
                        {isOwnerOrAdmin && (
                          <button
                            type="button"
                            onClick={() => setDeleting(row)}
                            className="flex items-center gap-1 text-[11px] font-semibold text-red-500 hover:text-red-400"
                            title="Hapus proyek beserta invoice & datanya"
                          >
                            <Trash2 size={13} /> Hapus
                          </button>
                        )}
                      </div>
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

      {editing && (
        <ProjectEditDialog
          project={editing}
          onClose={() => setEditing(null)}
          onSaved={(notes) => {
            setEditing(null)
            setNotice(`Proyek diperbarui.${notes.length ? ` Ikut berubah: ${notes.join('; ')}.` : ''}`)
            load()
          }}
        />
      )}

      {charging && (
        <AdditionalChargeDialog
          project={charging}
          onClose={() => setCharging(null)}
          onCreated={(inv) => setNotice(`Invoice tambahan ${inv?.invoice_number || ''} untuk ${charging.website_name || 'proyek'} diterbitkan.`)}
        />
      )}

      {deleting && (
        <DeleteProjectDialog
          project={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={(p) => {
            setDeleting(null)
            setRows((prev) => prev.filter((r) => r.id !== p.id))
            setNotice(`Proyek ${p.website_name || ''} beserta datanya sudah dihapus.`)
          }}
        />
      )}
    </div>
  )
}
