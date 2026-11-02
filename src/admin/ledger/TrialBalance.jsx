import { useEffect, useState } from 'react'
import { CheckCircle2, AlertTriangle } from 'lucide-react'
import { exportToCsv } from '../accounting/csvExport'
import { currentMonth, fetchBalances, idr, monthRange } from './ledgerUtils'
import { ErrorNote, MonthPicker, PageHeader, PrintTitle, periodText } from './LedgerUI'

const dc = (net) => ({ debit: net > 0 ? net : 0, credit: net < 0 ? -net : 0 })

export default function TrialBalance() {
  const [month, setMonth] = useState(currentMonth())
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showEmpty, setShowEmpty] = useState(false)

  useEffect(() => {
    const { from, to } = monthRange(month)
    setLoading(true)
    fetchBalances(from, to)
      .then((r) => {
        setRows(r)
        setError('')
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [month])

  const visible = rows.filter((r) => showEmpty || r.opening || r.debit || r.credit || r.closing)
  const totals = visible.reduce(
    (t, r) => {
      const o = dc(r.opening)
      const c = dc(r.closing)
      return {
        od: t.od + o.debit,
        oc: t.oc + o.credit,
        md: t.md + r.debit,
        mc: t.mc + r.credit,
        cd: t.cd + c.debit,
        cc: t.cc + c.credit,
      }
    },
    { od: 0, oc: 0, md: 0, mc: 0, cd: 0, cc: 0 },
  )
  const balanced = Math.round(totals.cd * 100) === Math.round(totals.cc * 100) && Math.round(totals.md * 100) === Math.round(totals.mc * 100)

  const exportCsv = () =>
    exportToCsv(
      `neraca-saldo-${month}`,
      visible.map((r) => ({
        Kode: r.code,
        Akun: r.name,
        'Saldo Awal Debit': dc(r.opening).debit,
        'Saldo Awal Kredit': dc(r.opening).credit,
        'Mutasi Debit': r.debit,
        'Mutasi Kredit': r.credit,
        'Saldo Akhir Debit': dc(r.closing).debit,
        'Saldo Akhir Kredit': dc(r.closing).credit,
      })),
    )

  return (
    <div>
      <PageHeader
        title="Neraca Saldo"
        description="Saldo awal, mutasi bulan ini, dan saldo akhir setiap akun. Total debit harus sama dengan total kredit; kalau sama, pembukuan seimbang."
        onExport={exportCsv}
        exportDisabled={visible.length === 0}
        printable
      >
        <MonthPicker value={month} onChange={setMonth} />
      </PageHeader>

      <ErrorNote message={error} />
      <PrintTitle title="Neraca Saldo" period={periodText(month)} />

      {!loading && (
        <div className={`mt-4 flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs ${balanced ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>
          {balanced ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {balanced ? 'Seimbang: total debit sama dengan total kredit.' : 'Tidak seimbang! Hubungi admin sistem.'}
        </div>
      )}

      <label className="mt-4 flex items-center gap-2 text-xs text-slate-400 print:hidden">
        <input type="checkbox" checked={showEmpty} onChange={(e) => setShowEmpty(e.target.checked)} className="h-4 w-4 accent-gold" />
        Tampilkan akun yang saldonya nol
      </label>

      <div className="mt-3 overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-left text-xs">
          <thead className="bg-white/5 text-slate-400">
            <tr>
              <th className="px-3 py-3" rowSpan={2}>
                Kode
              </th>
              <th className="px-3 py-3" rowSpan={2}>
                Akun
              </th>
              <th className="px-3 pt-3 text-center" colSpan={2}>
                Saldo Awal
              </th>
              <th className="px-3 pt-3 text-center" colSpan={2}>
                Mutasi
              </th>
              <th className="px-3 pt-3 text-center" colSpan={2}>
                Saldo Akhir
              </th>
            </tr>
            <tr>
              {['Debit', 'Kredit', 'Debit', 'Kredit', 'Debit', 'Kredit'].map((h, i) => (
                <th key={i} className="px-3 pb-3 pt-1 text-right">
                  {h}
                </th>
              ))}
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
            {!loading &&
              visible.map((r) => {
                const o = dc(r.opening)
                const c = dc(r.closing)
                const cell = (v) => (v ? idr(v) : '-')
                return (
                  <tr key={r.account_id} className="border-t border-white/5 text-slate-300">
                    <td className="px-3 py-2 font-mono">{r.code}</td>
                    <td className="px-3 py-2 text-white">{r.name}</td>
                    <td className="px-3 py-2 text-right">{cell(o.debit)}</td>
                    <td className="px-3 py-2 text-right">{cell(o.credit)}</td>
                    <td className="px-3 py-2 text-right">{cell(r.debit)}</td>
                    <td className="px-3 py-2 text-right">{cell(r.credit)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-white">{cell(c.debit)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-white">{cell(c.credit)}</td>
                  </tr>
                )
              })}
            {!loading && visible.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                  Belum ada saldo.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-white/10 bg-white/5 font-bold text-white">
              <td className="px-3 py-3" colSpan={2}>
                Total
              </td>
              <td className="px-3 py-3 text-right">{idr(totals.od)}</td>
              <td className="px-3 py-3 text-right">{idr(totals.oc)}</td>
              <td className="px-3 py-3 text-right">{idr(totals.md)}</td>
              <td className="px-3 py-3 text-right">{idr(totals.mc)}</td>
              <td className="px-3 py-3 text-right">{idr(totals.cd)}</td>
              <td className="px-3 py-3 text-right">{idr(totals.cc)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
