import { useEffect, useState } from 'react'
import { Check, Loader2, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'

const STATUS_CYCLE = { todo: 'in_progress', in_progress: 'done', done: 'todo' }
const STATUS_RING = {
  todo: 'border-slate-500/50 text-transparent hover:border-slate-300',
  in_progress: 'border-amber-400/70 bg-amber-500/15 text-amber-400',
  done: 'border-emerald-400/70 bg-emerald-500/15 text-emerald-400',
}

// Progres proyek dihitung dari checklist tugas ini (selesai / total), bukan
// field terpisah yang harus diisi manual -- supaya angkanya selalu konsisten
// dengan checklist yang benar-benar dicentang staf.
export default function ProjectTasksPanel({ projectId, canManage, canAdd, onStatsChange }) {
  const [tasks, setTasks] = useState([])
  const [staffOptions, setStaffOptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [newStaff, setNewStaff] = useState('')
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    supabase
      .from('acc_project_tasks')
      .select('*, acc_staff_members(name)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setTasks(data || [])
        setLoading(false)
      })
  }

  useEffect(() => {
    load()
    if (canAdd) {
      supabase
        .from('acc_staff_members')
        .select('id, name')
        .order('name', { ascending: true })
        .then(({ data }) => setStaffOptions(data || []))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  useEffect(() => {
    const done = tasks.filter((t) => t.status === 'done').length
    onStatsChange?.({ done, total: tasks.length })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks])

  const done = tasks.filter((t) => t.status === 'done').length
  const pct = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0

  const cycleStatus = async (task) => {
    const prevStatus = task.status
    const nextStatus = STATUS_CYCLE[task.status]
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)))
    const { data, error: err } = await supabase.from('acc_project_tasks').update({ status: nextStatus }).eq('id', task.id).select()
    if (err || !data?.length) {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: prevStatus } : t)))
      if (err) setError(err.message)
    }
  }

  const addTask = async (e) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    const { error: err } = await supabase.from('acc_project_tasks').insert({
      project_id: projectId,
      title: newTitle.trim(),
      assigned_staff_id: newStaff || null,
    })
    if (err) setError(err.message)
    else {
      setNewTitle('')
      setNewStaff('')
      load()
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

  return (
    <div className="rounded-xl border border-white/10 bg-navy-950/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Progres Pengerjaan</p>
        <p className="text-xs font-bold text-gold-soft">
          {pct}% <span className="font-normal text-slate-500">({done}/{tasks.length} tugas)</span>
        </p>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-cyan-royal to-gold-soft transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      {error && <p className="mt-2 text-[11px] text-red-400">{error}</p>}

      <div className="mt-3 space-y-1">
        {loading && <p className="px-2 py-2 text-xs text-slate-500">Memuat tugas...</p>}
        {!loading && tasks.length === 0 && <p className="px-2 py-2 text-xs text-slate-500">Belum ada tugas untuk proyek ini.</p>}
        {tasks.map((task) => (
          <div key={task.id} className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-white/5">
            <button
              type="button"
              onClick={() => cycleStatus(task)}
              title="Klik untuk ubah status"
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${STATUS_RING[task.status]}`}
            >
              {task.status === 'in_progress' && <Loader2 size={11} className="animate-spin" />}
              {task.status === 'done' && <Check size={12} strokeWidth={3} />}
            </button>
            <span className={`min-w-0 flex-1 truncate text-xs ${task.status === 'done' ? 'text-slate-500 line-through' : 'text-slate-200'}`}>{task.title}</span>
            {task.acc_staff_members?.name && (
              <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">{task.acc_staff_members.name}</span>
            )}
            {canManage && (
              <button type="button" onClick={() => removeTask(task.id)} className="shrink-0 text-slate-600 hover:text-red-400">
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ))}
      </div>

      {canAdd && (
        <form onSubmit={addTask} className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Tambah tugas baru..."
            className="input-field !w-auto !py-1.5 min-w-[140px] flex-1 text-xs"
          />
          <select value={newStaff} onChange={(e) => setNewStaff(e.target.value)} className="input-field !w-36 !py-1.5 text-xs">
            <option value="">Staf (opsional)</option>
            {staffOptions.map((s) => (
              <option key={s.id} value={s.id} className="bg-navy-950">
                {s.name}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-primary !px-3 !py-1.5 text-xs">
            <Plus size={13} /> Tambah
          </button>
        </form>
      )}
    </div>
  )
}
