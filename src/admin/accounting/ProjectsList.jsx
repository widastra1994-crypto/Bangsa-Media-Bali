import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

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
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    supabase
      .from('acc_projects')
      .select('*, acc_clients(company_name, email), acc_service_categories(name)')
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setRows(data || [])
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const updateStatus = async (id, status) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)))
    const { error: err } = await supabase.from('acc_projects').update({ status }).eq('id', id)
    if (err) setError(err.message)
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-white">Daftar Proyek</h2>
      <p className="mt-1 text-sm text-slate-400">Seluruh proyek yang dibuat lewat Form Transaksi Terpadu.</p>

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
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Memuat...
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Belum ada proyek. Buat lewat menu "Transaksi Baru".
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-white/5 text-slate-300">
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
