import { useEffect, useMemo, useState } from 'react'
import { Trash2, UserRound } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useUserRole } from '../useUserRole'

const COLUMNS = [
  { key: 'todo', label: 'Belum Dikerjakan', dot: 'bg-slate-400', border: 'border-slate-500/30' },
  { key: 'in_progress', label: 'Sedang Dikerjakan', dot: 'bg-amber-400', border: 'border-amber-400/30' },
  { key: 'done', label: 'Selesai', dot: 'bg-emerald-400', border: 'border-emerald-400/30' },
]
const NEXT_LABEL = { todo: 'Mulai Kerjakan →', in_progress: 'Tandai Selesai →', done: 'Buka Lagi' }
const NEXT_STATUS = { todo: 'in_progress', in_progress: 'done', done: 'todo' }

// Papan lintas-proyek untuk data yang sama dengan checklist di Daftar Proyek
// (acc_project_tasks) -- di sana dikelola per-proyek, di sini staf melihat
// SEMUA tugas miliknya dari berbagai proyek sekaligus dan bisa update
// statusnya sendiri tanpa harus buka satu-satu menu Daftar Proyek.
export default function StaffProgressBoard() {
  const { role, isOwnerOrAdmin } = useUserRole()
  const [tasks, setTasks] = useState([])
  const [staffList, setStaffList] = useState([])
  const [myStaffId, setMyStaffId] = useState(null)
  const [filterStaff, setFilterStaff] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    supabase
      .from('acc_project_tasks')
      .select('*, acc_projects(website_name), acc_staff_members(id, name)')
      .order('created_at', { ascending: true })
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setTasks(data || [])
        setLoading(false)
      })
  }

  useEffect(() => {
    load()
    supabase
      .from('acc_staff_members')
      .select('id, name, profile_id')
      .order('name', { ascending: true })
      .then(({ data }) => {
        setStaffList(data || [])
        supabase.auth.getUser().then(({ data: userData }) => {
          const mine = (data || []).find((s) => s.profile_id === userData?.user?.id)
          if (mine) {
            setMyStaffId(mine.id)
            setFilterStaff('mine')
          }
        })
      })
  }, [])

  const filteredTasks = useMemo(() => {
    if (filterStaff === 'all') return tasks
    if (filterStaff === 'mine') return tasks.filter((t) => t.assigned_staff_id === myStaffId)
    return tasks.filter((t) => t.assigned_staff_id === filterStaff)
  }, [tasks, filterStaff, myStaffId])

  const grouped = useMemo(() => {
    const g = { todo: [], in_progress: [], done: [] }
    filteredTasks.forEach((t) => g[t.status]?.push(t))
    return g
  }, [filteredTasks])

  const canEdit = (task) => isOwnerOrAdmin || (role === 'staff' && task.assigned_staff_id === myStaffId)

  const cycleStatus = async (task) => {
    const prevStatus = task.status
    const nextStatus = NEXT_STATUS[task.status]
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)))
    const { data, error: err } = await supabase.from('acc_project_tasks').update({ status: nextStatus }).eq('id', task.id).select()
    if (err || !data?.length) {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: prevStatus } : t)))
      if (err) setError(err.message)
    }
  }

  const removeTask = async (id) => {
    const prev = tasks
    setTasks((p) => p.filter((t) => t.id !== id))
    const { error: err } = await supabase.from('acc_project_tasks').delete().eq('id', id)
    if (err) {
      setError(err.message)
      setTasks(prev)
    }
  }

  const totalDone = filteredTasks.filter((t) => t.status === 'done').length
  const totalPct = filteredTasks.length > 0 ? Math.round((totalDone / filteredTasks.length) * 100) : 0

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Progres Staf</h2>
          <p className="mt-1 text-sm text-slate-400">Papan tugas lintas proyek. Klik tombol status untuk memperbarui progres.</p>
        </div>
        <select value={filterStaff} onChange={(e) => setFilterStaff(e.target.value)} className="input-field !w-48 !py-2 text-xs">
          {myStaffId && (
            <option value="mine" className="bg-navy-950">
              Tugas Saya
            </option>
          )}
          <option value="all" className="bg-navy-950">
            Semua Staf
          </option>
          {staffList.map((s) => (
            <option key={s.id} value={s.id} className="bg-navy-950">
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold uppercase tracking-wide text-slate-400">Progres {filterStaff === 'mine' ? 'Saya' : filterStaff === 'all' ? 'Keseluruhan' : 'Staf Ini'}</span>
          <span className="font-bold text-gold-soft">
            {totalPct}% <span className="font-normal text-slate-500">({totalDone}/{filteredTasks.length} tugas)</span>
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-cyan-royal to-gold-soft transition-all duration-500" style={{ width: `${totalPct}%` }} />
        </div>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-slate-400">Memuat...</p>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {COLUMNS.map((col) => (
            <div key={col.key} className={`rounded-2xl border ${col.border} bg-white/[0.03] p-3`}>
              <div className="mb-3 flex items-center justify-between px-1">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-300">
                  <span className={`h-2 w-2 rounded-full ${col.dot}`} /> {col.label}
                </p>
                <span className="text-xs font-semibold text-slate-500">{grouped[col.key].length}</span>
              </div>
              <div className="space-y-2">
                {grouped[col.key].length === 0 && <p className="px-2 py-4 text-center text-[11px] text-slate-600">Tidak ada tugas</p>}
                {grouped[col.key].map((task) => (
                  <div key={task.id} className="rounded-xl border border-white/10 bg-navy-950/60 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-100">{task.title}</p>
                      {isOwnerOrAdmin && (
                        <button type="button" onClick={() => removeTask(task.id)} className="shrink-0 text-slate-600 hover:text-red-400">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                    <p className="mt-1 truncate text-[11px] text-slate-500">{task.acc_projects?.website_name || '-'}</p>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5">
                      <span className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">
                        <UserRound size={10} /> {task.acc_staff_members?.name || 'Belum ditugaskan'}
                      </span>
                      {canEdit(task) && (
                        <button
                          type="button"
                          onClick={() => cycleStatus(task)}
                          className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 text-[10px] font-semibold text-cyan-300 hover:bg-cyan-500/20"
                        >
                          {NEXT_LABEL[task.status]}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
