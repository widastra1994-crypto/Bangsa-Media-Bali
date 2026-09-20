import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Calendar, CheckCircle2, Clock, RefreshCw, TrendingUp, Users } from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient'

const STATUS_OPTIONS = ['baru', 'dihubungi', 'selesai', 'batal']
const STATUS_LABEL = { baru: 'Baru', dihubungi: 'Dihubungi', selesai: 'Selesai', batal: 'Batal' }
const STATUS_COLOR = {
  baru: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/30',
  dihubungi: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
  selesai: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
  batal: 'bg-red-500/20 text-red-300 border-red-400/30',
}
const SERVICE_LABEL = { web: 'Website & Web App', erp: 'Sistem/ERP & POS', ads: 'Iklan (Ads)', design: 'UI/UX & Branding' }

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${accent}`}>
        <Icon size={18} />
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{label}</p>
    </div>
  )
}

function BarRow({ label, value, max, colorClass }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-slate-300">{label}</span>
        <span className="font-semibold text-slate-200">{value}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export default function AnalyticsDashboard() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState(null)

  const loadLeads = async () => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    let { data, error: err } = await supabase.from('consultation_leads').select('*').order('created_at', { ascending: false })
    // Access token bisa kedaluwarsa kalau tab dibiarkan lama tidak aktif --
    // coba refresh sesi sekali lalu ulangi query, daripada langsung tampilkan
    // error mentah "JWT expired" ke pengguna.
    if (err && /jwt expired/i.test(err.message)) {
      const { error: refreshErr } = await supabase.auth.refreshSession()
      if (!refreshErr) {
        ;({ data, error: err } = await supabase.from('consultation_leads').select('*').order('created_at', { ascending: false }))
      }
    }
    if (err) {
      setError(err.message)
    } else {
      setLeads(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadLeads()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stats = useMemo(() => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfWeek = new Date(startOfToday)
    startOfWeek.setDate(startOfWeek.getDate() - 6)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const today = leads.filter((l) => new Date(l.created_at) >= startOfToday).length
    const thisWeek = leads.filter((l) => new Date(l.created_at) >= startOfWeek).length
    const thisMonth = leads.filter((l) => new Date(l.created_at) >= startOfMonth).length

    const statusCounts = STATUS_OPTIONS.reduce((acc, s) => ({ ...acc, [s]: 0 }), {})
    leads.forEach((l) => {
      const s = l.status || 'baru'
      statusCounts[s] = (statusCounts[s] || 0) + 1
    })

    const serviceCounts = {}
    leads.forEach((l) => {
      ;(l.services || []).forEach((s) => {
        serviceCounts[s] = (serviceCounts[s] || 0) + 1
      })
    })

    const scaleCounts = {}
    leads.forEach((l) => {
      if (l.scale) scaleCounts[l.scale] = (scaleCounts[l.scale] || 0) + 1
    })

    const days = Array.from({ length: 14 }).map((_, i) => {
      const d = new Date(startOfToday)
      d.setDate(d.getDate() - (13 - i))
      const count = leads.filter((l) => isSameDay(new Date(l.created_at), d)).length
      return { date: d, count }
    })
    const maxDay = Math.max(1, ...days.map((d) => d.count))

    return { total: leads.length, today, thisWeek, thisMonth, statusCounts, serviceCounts, scaleCounts, days, maxDay }
  }, [leads])

  const updateStatus = (id, status) => {
    setUpdatingId(id)
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)))
    supabase
      .from('consultation_leads')
      .update({ status })
      .eq('id', id)
      .then(({ error: err }) => {
        setUpdatingId(null)
        if (err) setError(`Gagal update status: ${err.message}`)
      })
  }

  if (!isSupabaseConfigured) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-white">Dashboard Analitik</h2>
        <p className="mt-4 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          <AlertTriangle size={18} /> Supabase belum dikonfigurasi, dashboard leads tidak tersedia di mode ini.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Dashboard Analitik</h2>
          <p className="mt-1 text-sm text-slate-400">Ringkasan permintaan konsultasi (leads) dari kalkulator estimasi biaya.</p>
        </div>
        <button type="button" onClick={loadLeads} className="btn-secondary !px-3 !py-2 text-xs">
          <RefreshCw size={14} /> Muat Ulang
        </button>
      </div>

      {error && (
        <p className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          <AlertTriangle size={16} /> {error}
        </p>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-slate-400">Memuat data leads...</p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard icon={Users} label="Total Leads" value={stats.total} accent="bg-cyan-500/15 text-cyan-300" />
            <StatCard icon={Calendar} label="Leads Hari Ini" value={stats.today} accent="bg-blue-500/15 text-blue-300" />
            <StatCard icon={TrendingUp} label="7 Hari Terakhir" value={stats.thisWeek} accent="bg-gold/15 text-gold-soft" />
            <StatCard icon={Clock} label="Bulan Ini" value={stats.thisMonth} accent="bg-emerald-500/15 text-emerald-300" />
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gold-soft">Leads 14 Hari Terakhir</h3>
              <div className="flex h-32 items-end gap-1.5">
                {stats.days.map((d, i) => (
                  <div key={i} className="group relative flex-1">
                    <div
                      className="w-full rounded-t bg-cyan-royal/70 transition-colors group-hover:bg-cyan-royal"
                      style={{ height: `${Math.max(4, (d.count / stats.maxDay) * 100)}%` }}
                    />
                    <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-navy-950 px-1.5 py-0.5 text-[10px] text-white opacity-0 group-hover:opacity-100">
                      {d.date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}: {d.count}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gold-soft">Status Leads</h3>
              <div className="space-y-3">
                {STATUS_OPTIONS.map((s) => (
                  <BarRow
                    key={s}
                    label={STATUS_LABEL[s]}
                    value={stats.statusCounts[s] || 0}
                    max={stats.total}
                    colorClass={s === 'selesai' ? 'bg-emerald-400' : s === 'batal' ? 'bg-red-400' : s === 'dihubungi' ? 'bg-amber-400' : 'bg-cyan-400'}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gold-soft">Layanan Paling Diminati</h3>
              <div className="space-y-3">
                {Object.keys(SERVICE_LABEL).map((s) => (
                  <BarRow key={s} label={SERVICE_LABEL[s]} value={stats.serviceCounts[s] || 0} max={stats.total} colorClass="bg-blue-400" />
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gold-soft">Skala Proyek</h3>
              <div className="space-y-3">
                {['kecil', 'menengah', 'besar'].map((s) => (
                  <BarRow key={s} label={s === 'kecil' ? 'Skala Kecil' : s === 'menengah' ? 'Skala Menengah' : 'Skala Besar'} value={stats.scaleCounts[s] || 0} max={stats.total} colorClass="bg-gold" />
                ))}
              </div>
            </div>
          </div>

          <h3 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-gold-soft">Leads Terbaru</h3>
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/5 text-slate-400">
                <tr>
                  <th className="px-4 py-3">Nama</th>
                  <th className="px-4 py-3">Kontak</th>
                  <th className="px-4 py-3">Layanan</th>
                  <th className="px-4 py-3">Jadwal</th>
                  <th className="px-4 py-3">Masuk</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {leads.slice(0, 30).map((l) => (
                  <tr key={l.id} className="border-t border-white/5 text-slate-300">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-white">{l.name}</p>
                      <p className="text-[11px] text-slate-500">{l.business_name || l.business_type || '-'}</p>
                    </td>
                    <td className="px-4 py-3">{l.phone}</td>
                    <td className="px-4 py-3">{(l.services || []).map((s) => SERVICE_LABEL[s] || s).join(', ') || '-'}</td>
                    <td className="px-4 py-3">
                      {l.consult_date ? `${l.consult_date} ${l.consult_time || ''}` : '-'}
                    </td>
                    <td className="px-4 py-3">{new Date(l.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td className="px-4 py-3">
                      <select
                        value={l.status || 'baru'}
                        disabled={updatingId === l.id}
                        onChange={(e) => updateStatus(l.id, e.target.value)}
                        className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${STATUS_COLOR[l.status || 'baru']}`}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s} className="bg-navy-950 text-white">
                            {STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
                {leads.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                      Belum ada leads masuk.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {leads.length > 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
              <CheckCircle2 size={13} /> Menampilkan 30 leads terbaru dari total {leads.length}. Ubah status langsung dari dropdown di atas.
            </p>
          )}
        </>
      )}
    </div>
  )
}
