import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { exportToCsv } from '../accounting/csvExport'
import { currentMonth, fetchBalances, formatDate, idr, monthRange, normalBalance } from './ledgerUtils'
import { ErrorNote, MonthPicker, PageHeader, PrintTitle } from './LedgerUI'

export default function BalanceSheet() {
  const [month, setMonth] = useState(currentMonth())
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const asOf = monthRange(month).to

  useEffect(() => {
    fetchBalances(null, asOf)
      .then((r) => {
        setRows(r)
        setError('')
      })
      .catch((e) => setError(e.message))
  }, [asOf])

  const bal = (r) => normalBalance(r.account_type, r.closing)
  const pick = (type) => (rows || []).filter((r) => r.account_type === type && bal(r) !== 0)
  const assets = pick('asset')
  const liabilities = pick('liability')
  const equity = pick('equity')
  // Laba berjalan = semua pendapatan - semua beban sampai tanggal neraca
  // (belum ditutup ke Laba Ditahan).
  const currentEarnings = (rows || []).reduce((s, r) => {
    if (r.account_type === 'revenue') return s - r.closing
    if (r.account_type === 'expense') return s - r.closing
    return s
  }, 0)
  const sum = (list) => list.reduce((s, r) => s + bal(r), 0)
  const totalAssets = sum(assets)
  const totalLiabilities = sum(liabilities)
  const totalEquity = sum(equity) + currentEarnings
  const balanced = Math.round(totalAssets * 100) === Math.round((totalLiabilities + totalEquity) * 100)

  const exportCsv = () =>
    exportToCsv(`neraca-${month}`, [
      ...assets.map((r) => ({ Kelompok: 'Aset', Akun: `${r.code} ${r.name}`, Saldo: bal(r) })),
      { Kelompok: 'Aset', Akun: 'TOTAL ASET', Saldo: totalAssets },
      ...liabilities.map((r) => ({ Kelompok: 'Liabilitas', Akun: `${r.code} ${r.name}`, Saldo: bal(r) })),
      { Kelompok: 'Liabilitas', Akun: 'TOTAL LIABILITAS', Saldo: totalLiabilities },
      ...equity.map((r) => ({ Kelompok: 'Ekuitas', Akun: `${r.code} ${r.name}`, Saldo: bal(r) })),
      { Kelompok: 'Ekuitas', Akun: 'Laba Berjalan (akumulasi)', Saldo: currentEarnings },
      { Kelompok: 'Ekuitas', Akun: 'TOTAL EKUITAS', Saldo: totalEquity },
    ])

  const Block = ({ title, list, extra, total, totalLabel }) => (
    <div className="overflow-hidden rounded-2xl border border-white/10">
      <p className="bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-gold-soft">{title}</p>
      <table className="w-full text-left text-xs">
        <tbody>
          {list.map((r) => (
            <tr key={r.account_id} className="border-t border-white/5 text-slate-300">
              <td className="px-4 py-2">
                <span className="font-mono text-slate-500">{r.code}</span> {r.name}
              </td>
              <td className={`px-4 py-2 text-right ${bal(r) < 0 ? 'text-red-400' : ''}`}>{idr(bal(r))}</td>
            </tr>
          ))}
          {extra}
          {list.length === 0 && !extra && (
            <tr>
              <td colSpan={2} className="px-4 py-3 text-center text-slate-500">
                -
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="border-t border-white/10 font-bold text-white">
            <td className="px-4 py-2">{totalLabel}</td>
            <td className="px-4 py-2 text-right">{idr(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )

  return (
    <div>
      <PageHeader
        title="Neraca"
        description="Posisi harta (aset), utang (liabilitas), dan modal (ekuitas) per akhir bulan. Aset harus sama dengan Liabilitas + Ekuitas."
        onExport={exportCsv}
        exportDisabled={!rows}
        printable
      >
        <MonthPicker value={month} onChange={setMonth} />
      </PageHeader>

      <ErrorNote message={error} />
      <PrintTitle title="Neraca" period={`Per ${formatDate(asOf)}`} />

      {rows && (
        <>
          <div className={`mt-4 flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs ${balanced ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>
            {balanced ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            Per {formatDate(asOf)}: Aset {idr(totalAssets)} {balanced ? '=' : '≠'} Liabilitas + Ekuitas {idr(totalLiabilities + totalEquity)}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Block title="Aset" list={assets} total={totalAssets} totalLabel="Total Aset" />
            <div className="space-y-4">
              <Block title="Liabilitas" list={liabilities} total={totalLiabilities} totalLabel="Total Liabilitas" />
              <Block
                title="Ekuitas"
                list={equity}
                extra={
                  <tr className="border-t border-white/5 text-slate-300">
                    <td className="px-4 py-2 italic">Laba berjalan (akumulasi, belum dipindah ke Laba Ditahan)</td>
                    <td className={`px-4 py-2 text-right ${currentEarnings < 0 ? 'text-red-400' : ''}`}>{idr(currentEarnings)}</td>
                  </tr>
                }
                total={totalEquity}
                totalLabel="Total Ekuitas"
              />
              <div className="flex justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-bold text-white">
                <span>Total Liabilitas + Ekuitas</span>
                <span>{idr(totalLiabilities + totalEquity)}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
