import { useEffect, useState } from 'react'
import { Download, History } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { exportToCsv } from './csvExport'

const ACTION_LABEL = {
  create: 'Buat Data',
  payment_recorded: 'Catat Pembayaran',
  commission_paid: 'Komisi Dicairkan',
  bank_mutation_matched: 'Mutasi Bank Dicocokkan',
}

export default function AuditTrailViewer() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('acc_audit_logs')
      .select('*, profiles(name)')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        setRows(data || [])
        setLoading(false)
      })
  }, [])

  const exportLogs = () => {
    exportToCsv(
      'audit-trail',
      rows.map((r) => ({
        Waktu: r.created_at,
        User: r.profiles?.name || r.user_id || '-',
        Aksi: ACTION_LABEL[r.action] || r.action,
        Entitas: r.entity_name,
        Detail: JSON.stringify(r.new_values || {}),
      })),
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <History size={18} /> Audit Trail
          </h2>
          <p className="mt-1 text-sm text-slate-400">Riwayat aksi penting (transaksi, pembayaran, pencairan komisi) untuk transparansi & keamanan.</p>
        </div>
        <button type="button" onClick={exportLogs} disabled={rows.length === 0} className="btn-secondary !px-3 !py-2 text-xs disabled:opacity-50">
          <Download size={14} /> Ekspor CSV
        </button>
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-left text-xs">
          <thead className="bg-white/5 text-slate-400">
            <tr>
              <th className="px-4 py-3">Waktu</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Aksi</th>
              <th className="px-4 py-3">Entitas</th>
              <th className="px-4 py-3">Detail</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  Memuat...
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  Belum ada aktivitas tercatat.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-white/5 text-slate-300">
                <td className="px-4 py-3 whitespace-nowrap">{new Date(r.created_at).toLocaleString('id-ID')}</td>
                <td className="px-4 py-3">{r.profiles?.name || '-'}</td>
                <td className="px-4 py-3">{ACTION_LABEL[r.action] || r.action}</td>
                <td className="px-4 py-3">{r.entity_name}</td>
                <td className="max-w-xs truncate px-4 py-3 text-slate-500" title={JSON.stringify(r.new_values)}>
                  {JSON.stringify(r.new_values)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
