import { useEffect, useState } from 'react'
import { exportToCsv } from '../accounting/csvExport'
import { currentMonth, fetchBalances, idr, monthLabel, monthRange, shiftMonth } from './ledgerUtils'
import { ErrorNote, MonthPicker, PageHeader, PrintTitle, StatCard } from './LedgerUI'

// Mutasi akun laba-rugi dalam periode, sudah di sisi normalnya.
const movement = (r) => (r.account_type === 'revenue' ? r.credit - r.debit : r.debit - r.credit)

export function buildProfitLoss(rows) {
  const revenue = rows.filter((r) => r.account_type === 'revenue')
  const cogs = rows.filter((r) => r.account_type === 'expense' && r.code.startsWith('5'))
  const opex = rows.filter((r) => r.account_type === 'expense' && !r.code.startsWith('5'))
  const sum = (list) => list.reduce((s, r) => s + movement(r), 0)
  const totalRevenue = sum(revenue)
  const totalCogs = sum(cogs)
  const grossProfit = totalRevenue - totalCogs
  const totalOpex = sum(opex)
  return { revenue, cogs, opex, totalRevenue, totalCogs, grossProfit, totalOpex, netProfit: grossProfit - totalOpex }
}

function rangeFor(month, mode) {
  if (mode === 'ytd') return { from: `${month.slice(0, 4)}-01-01`, to: monthRange(month).to }
  return monthRange(month)
}

export default function ProfitLoss() {
  const [month, setMonth] = useState(currentMonth())
  const [mode, setMode] = useState('month')
  const [current, setCurrent] = useState(null)
  const [previous, setPrevious] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const cur = rangeFor(month, mode)
    const prevMonth = mode === 'ytd' ? `${Number(month.slice(0, 4)) - 1}${month.slice(4)}` : shiftMonth(month, -1)
    const prev = rangeFor(prevMonth, mode)
    Promise.all([fetchBalances(cur.from, cur.to), fetchBalances(prev.from, prev.to)])
      .then(([a, b]) => {
        setCurrent(buildProfitLoss(a))
        setPrevious(buildProfitLoss(b))
        setError('')
      })
      .catch((e) => setError(e.message))
  }, [month, mode])

  const prevLabel = mode === 'ytd' ? `s/d ${monthLabel(`${Number(month.slice(0, 4)) - 1}${month.slice(4)}`)}` : monthLabel(shiftMonth(month, -1))
  const curLabel = mode === 'ytd' ? `Jan - ${monthLabel(month)}` : monthLabel(month)
  const prevById = (id) => {
    const all = previous ? [...previous.revenue, ...previous.cogs, ...previous.opex] : []
    const r = all.find((x) => x.account_id === id)
    return r ? movement(r) : 0
  }

  const exportCsv = () => {
    if (!current) return
    const rows = []
    const push = (label, val, prev) => rows.push({ Pos: label, [curLabel]: val, [prevLabel]: prev })
    current.revenue.forEach((r) => push(`${r.code} ${r.name}`, movement(r), prevById(r.account_id)))
    push('Total Pendapatan', current.totalRevenue, previous?.totalRevenue)
    current.cogs.forEach((r) => push(`${r.code} ${r.name}`, movement(r), prevById(r.account_id)))
    push('Laba Kotor', current.grossProfit, previous?.grossProfit)
    current.opex.forEach((r) => push(`${r.code} ${r.name}`, movement(r), prevById(r.account_id)))
    push('Laba Bersih', current.netProfit, previous?.netProfit)
    exportToCsv(`laba-rugi-${mode}-${month}`, rows)
  }

  const Section = ({ title, list, total, totalLabel }) => (
    <>
      <tr className="bg-white/5">
        <td colSpan={3} className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-gold-soft">
          {title}
        </td>
      </tr>
      {list
        .filter((r) => movement(r) || prevById(r.account_id))
        .map((r) => (
          <tr key={r.account_id} className="border-t border-white/5 text-slate-300">
            <td className="px-4 py-2 pl-8">
              <span className="font-mono text-slate-500">{r.code}</span> {r.name}
            </td>
            <td className="px-4 py-2 text-right">{idr(movement(r))}</td>
            <td className="px-4 py-2 text-right text-slate-500">{idr(prevById(r.account_id))}</td>
          </tr>
        ))}
      <tr className="border-t border-white/10 font-semibold text-white">
        <td className="px-4 py-2">{totalLabel}</td>
        <td className="px-4 py-2 text-right">{idr(total[0])}</td>
        <td className="px-4 py-2 text-right text-slate-500">{idr(total[1])}</td>
      </tr>
    </>
  )

  return (
    <div>
      <PageHeader
        title="Laba Rugi"
        description="Pendapatan dikurangi beban (basis akrual: pendapatan diakui saat invoice terbit, beban saat terjadi). Untuk arus uang tunai, lihat Arus Kas."
        onExport={exportCsv}
        exportDisabled={!current}
        printable
      >
        <select className="input-field !w-40" value={mode} onChange={(e) => setMode(e.target.value)} aria-label="Periode">
          <option value="month">Per bulan</option>
          <option value="ytd">Tahun berjalan</option>
        </select>
        <MonthPicker value={month} onChange={setMonth} />
      </PageHeader>

      <ErrorNote message={error} />
      <PrintTitle title="Laporan Laba Rugi" period={curLabel} />

      {current && (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard label="Total Pendapatan" value={idr(current.totalRevenue)} hint={`${prevLabel}: ${idr(previous?.totalRevenue)}`} />
            <StatCard label="Total Beban" value={idr(current.totalCogs + current.totalOpex)} tone="bad" hint={`${prevLabel}: ${idr((previous?.totalCogs || 0) + (previous?.totalOpex || 0))}`} />
            <StatCard label="Laba Bersih" value={idr(current.netProfit)} tone={current.netProfit >= 0 ? 'good' : 'bad'} hint={`${prevLabel}: ${idr(previous?.netProfit)}`} />
          </div>

          <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400">
                <tr>
                  <th className="px-4 py-3" />
                  <th className="px-4 py-3 text-right">{curLabel}</th>
                  <th className="px-4 py-3 text-right">{prevLabel}</th>
                </tr>
              </thead>
              <tbody>
                <Section title="Pendapatan" list={current.revenue} total={[current.totalRevenue, previous?.totalRevenue]} totalLabel="Total Pendapatan" />
                <Section title="Beban Pokok Proyek" list={current.cogs} total={[current.totalCogs, previous?.totalCogs]} totalLabel="Total Beban Pokok" />
                <tr className="border-t border-white/10 bg-emerald-500/10 font-bold text-emerald-300">
                  <td className="px-4 py-3">Laba Kotor</td>
                  <td className="px-4 py-3 text-right">{idr(current.grossProfit)}</td>
                  <td className="px-4 py-3 text-right">{idr(previous?.grossProfit)}</td>
                </tr>
                <Section title="Beban Operasional" list={current.opex} total={[current.totalOpex, previous?.totalOpex]} totalLabel="Total Beban Operasional" />
                <tr className={`border-t border-white/10 font-bold ${current.netProfit >= 0 ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>
                  <td className="px-4 py-3">Laba Bersih</td>
                  <td className="px-4 py-3 text-right">{idr(current.netProfit)}</td>
                  <td className="px-4 py-3 text-right">{idr(previous?.netProfit)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
