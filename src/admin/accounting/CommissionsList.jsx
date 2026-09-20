import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'

const idr = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0)

const STATUS_LABEL = { pending: 'Pending (Belum Lunas)', payable: 'Siap Dicairkan', paid: 'Sudah Dicairkan' }
const STATUS_COLOR = {
  pending: 'bg-slate-500/20 text-slate-300 border-slate-400/30',
  payable: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
  paid: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
}
const ROLE_LABEL = { developer: 'Developer', designer: 'Desainer', sales: 'Sales' }

export default function CommissionsList() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    supabase
      .from('acc_commissions')
      .select('*, acc_staff_members(name), acc_projects(website_name, acc_clients(company_name))')
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

  const markPaid = async (id) => {
    const { error: err } = await supabase.from('acc_commissions').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', id)
    if (err) setError(err.message)
    else load()
  }

  const totalPending = rows.filter((r) => r.status === 'pending').reduce((s, r) => s + Number(r.commission_amount), 0)
  const totalPayable = rows.filter((r) => r.status === 'payable').reduce((s, r) => s + Number(r.commission_amount), 0)
  const totalPaid = rows.filter((r) => r.status === 'paid').reduce((s, r) => s + Number(r.commission_amount), 0)

  return (
    <div>
      <h2 className="text-lg font-semibold text-white">Komisi Tim</h2>
      <p className="mt-1 text-sm text-slate-400">Komisi otomatis pindah dari Pending ke Siap Dicairkan begitu invoice proyek terkait Lunas.</p>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-slate-400">Pending</p>
          <p className="text-lg font-bold text-slate-300">{idr(totalPending)}</p>
        </div>
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-xs text-amber-300">Siap Dicairkan</p>
          <p className="text-lg font-bold text-amber-300">{idr(totalPayable)}</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="text-xs text-emerald-300">Sudah Dicairkan</p>
          <p className="text-lg font-bold text-emerald-300">{idr(totalPaid)}</p>
        </div>
      </div>

      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

      <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-left text-xs">
          <thead className="bg-white/5 text-slate-400">
            <tr>
              <th className="px-4 py-3">Staf</th>
              <th className="px-4 py-3">Proyek</th>
              <th className="px-4 py-3">Peran</th>
              <th className="px-4 py-3">Nominal</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Aksi</th>
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
                  Belum ada data komisi.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-white/5 text-slate-300">
                <td className="px-4 py-3 font-semibold text-white">{r.acc_staff_members?.name}</td>
                <td className="px-4 py-3">
                  {r.acc_projects?.website_name} <span className="text-slate-500">({r.acc_projects?.acc_clients?.company_name})</span>
                </td>
                <td className="px-4 py-3">{ROLE_LABEL[r.role_in_project]}</td>
                <td className="px-4 py-3">{idr(r.commission_amount)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${STATUS_COLOR[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                </td>
                <td className="px-4 py-3">
                  {r.status === 'payable' && (
                    <button type="button" onClick={() => markPaid(r.id)} className="flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300">
                      <CheckCircle2 size={13} /> Tandai Cair
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
