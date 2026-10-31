import { useEffect, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

const STATUS_RING = {
  todo: 'border-slate-300 text-transparent',
  in_progress: 'border-amber-400 bg-amber-50 text-amber-600',
  done: 'border-emerald-400 bg-emerald-50 text-emerald-600',
}

// Tampilan progres read-only untuk klien -- checklist yang sama dengan yang
// dikelola staf di admin, tapi di sini murni informasi (tidak ada tombol
// ubah/tambah/hapus). RLS di acc_project_tasks sudah membatasi klien hanya
// bisa SELECT baris milik proyeknya sendiri.
export default function ProjectProgress({ projectId }) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    supabase
      .from('acc_project_tasks')
      .select('id, title, status')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (active) {
          setTasks(data || [])
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [projectId])

  if (loading || tasks.length === 0) return null

  const done = tasks.filter((t) => t.status === 'done').length
  const pct = Math.round((done / tasks.length) * 100)

  return (
    <div className="mt-3 border-t border-slate-200 pt-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Progres Pengerjaan</p>
        <p className="text-[11px] font-bold text-gold-deep">
          {pct}% <span className="font-normal text-slate-500">({done}/{tasks.length})</span>
        </p>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-gradient-to-r from-cyan-royal to-gold transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 space-y-1">
        {tasks.map((task) => (
          <div key={task.id} className="flex items-center gap-2">
            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${STATUS_RING[task.status]}`}>
              {task.status === 'in_progress' && <Loader2 size={9} className="animate-spin" />}
              {task.status === 'done' && <Check size={9} strokeWidth={3} />}
            </span>
            <span className={`truncate text-[11px] ${task.status === 'done' ? 'text-slate-500 line-through' : 'text-slate-600'}`}>{task.title}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
