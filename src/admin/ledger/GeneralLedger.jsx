import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { exportToCsv } from '../accounting/csvExport'
import { SOURCE_LABELS, accountTypeLabel, fetchBalances, formatDate, idr, isDebitNormal, monthRange, currentMonth, normalBalance } from './ledgerUtils'
import { ErrorNote, PageHeader, PrintTitle, StatCard } from './LedgerUI'

export default function GeneralLedger() {
  const initial = monthRange(currentMonth())
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [balances, setBalances] = useState([])
  const [accountId, setAccountId] = useState('')
  const [lines, setLines] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!from || !to) return
    fetchBalances(from, to)
      .then((rows) => {
        setBalances(rows)
        setAccountId((prev) => prev || rows.find((r) => r.is_cash && r.system_key !== 'cash_unassigned')?.account_id || rows[0]?.account_id || '')
      })
      .catch((e) => setError(e.message))
  }, [from, to])

  useEffect(() => {
    if (!accountId || !from || !to) return
    setLoading(true)
    setError('')
    supabase
      .from('acc_journal_view')
      .select('*')
      .eq('account_id', accountId)
      .gte('entry_date', from)
      .lte('entry_date', to)
      .order('entry_date', { ascending: true })
      .order('entry_no', { ascending: true })
      .order('line_no', { ascending: true })
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setLines(data || [])
        setLoading(false)
      })
  }, [accountId, from, to])

  const account = balances.find((b) => b.account_id === accountId)
  const unassigned = balances.find((b) => b.system_key === 'cash_unassigned')
  const debitNormal = account ? isDebitNormal(account.account_type) : true
  const opening = account ? normalBalance(account.account_type, account.opening) : 0

  const rows = useMemo(() => {
    let running = opening
    return lines.map((l) => {
      const delta = debitNormal ? Number(l.debit) - Number(l.credit) : Number(l.credit) - Number(l.debit)
      running += delta
      return { ...l, running }
    })
  }, [lines, opening, debitNormal])

  const totalDebit = lines.reduce((s, l) => s + Number(l.debit), 0)
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit), 0)
  const closing = rows.length ? rows[rows.length - 1].running : opening

  const exportCsv = () =>
    exportToCsv(
      `buku-besar-${account?.code || ''}-${from}-${to}`,
      [
        { Tanggal: from, No: '', Keterangan: 'Saldo awal', Debit: '', Kredit: '', Saldo: opening },
        ...rows.map((r) => ({
          Tanggal: r.entry_date,
          No: r.entry_no,
          Keterangan: r.description + (r.memo ? ` (${r.memo})` : ''),
          Debit: Number(r.debit) || '',
          Kredit: Number(r.credit) || '',
          Saldo: r.running,
        })),
      ],
    )

  return (
    <div>
      <PageHeader
        title="Buku Besar"
        description="Riwayat mutasi dan saldo berjalan per akun. Pilih akun dan rentang tanggal."
        onExport={exportCsv}
        exportDisabled={!account}
        printable
      />

      {unassigned && Math.abs(unassigned.closing) > 0 && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-300 print:hidden">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <p>
            Ada transaksi senilai <b>{idr(Math.abs(unassigned.closing))}</b> yang belum jelas rekening kas/banknya (akun {unassigned.code} {unassigned.name}).
            Buka <b>Jurnal Umum &gt; Jurnal Manual &gt; "Pindahkan dari Kas/Bank Belum Ditentukan"</b> untuk memindahkannya ke rekening yang benar, atau isi rekening di transaksi aslinya.
          </p>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4 print:hidden">
        <div className="sm:col-span-2">
          <label className="label-field">Akun</label>
          <select className="input-field" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {balances.map((b) => (
              <option key={b.account_id} value={b.account_id}>
                {b.code} - {b.name}
                {b.debit || b.credit ? ' •' : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-field">Dari</label>
          <input type="date" className="input-field" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="label-field">Sampai</label>
          <input type="date" className="input-field" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <ErrorNote message={error} />

      {account && (
        <>
          <PrintTitle title={`Buku Besar ${account.code} - ${account.name}`} period={`${formatDate(from)} s/d ${formatDate(to)}`} />
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Saldo Awal" value={idr(opening)} />
            <StatCard label="Total Debit" value={idr(totalDebit)} />
            <StatCard label="Total Kredit" value={idr(totalCredit)} />
            <StatCard label="Saldo Akhir" value={idr(closing)} tone={closing < 0 ? 'bad' : 'good'} hint={accountTypeLabel(account.account_type)} />
          </div>

          <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/5 text-slate-400">
                <tr>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">No</th>
                  <th className="px-4 py-3">Keterangan</th>
                  <th className="px-4 py-3 text-right">Debit</th>
                  <th className="px-4 py-3 text-right">Kredit</th>
                  <th className="px-4 py-3 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-white/5 text-slate-400">
                  <td className="px-4 py-2">{formatDate(from)}</td>
                  <td className="px-4 py-2" />
                  <td className="px-4 py-2 italic">Saldo awal</td>
                  <td className="px-4 py-2" />
                  <td className="px-4 py-2" />
                  <td className="px-4 py-2 text-right font-semibold">{idr(opening)}</td>
                </tr>
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-4 text-center text-slate-500">
                      Memuat...
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.line_id} className="border-t border-white/5 text-slate-300">
                    <td className="whitespace-nowrap px-4 py-2">{formatDate(r.entry_date)}</td>
                    <td className="px-4 py-2 font-mono text-slate-500">#{r.entry_no}</td>
                    <td className="px-4 py-2">
                      <span className="text-white">{r.description}</span>
                      <span className="ml-2 text-[10px] text-slate-500">{SOURCE_LABELS[r.source_type]}</span>
                      {r.memo && <span className="block text-[11px] text-slate-500">{r.memo}</span>}
                    </td>
                    <td className="px-4 py-2 text-right">{Number(r.debit) > 0 ? idr(r.debit) : ''}</td>
                    <td className="px-4 py-2 text-right">{Number(r.credit) > 0 ? idr(r.credit) : ''}</td>
                    <td className={`px-4 py-2 text-right font-semibold ${r.running < 0 ? 'text-red-400' : 'text-white'}`}>{idr(r.running)}</td>
                  </tr>
                ))}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-4 text-center text-slate-500">
                      Tidak ada mutasi di rentang tanggal ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
