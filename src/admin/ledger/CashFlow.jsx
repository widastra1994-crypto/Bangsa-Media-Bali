import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { exportToCsv } from '../accounting/csvExport'
import { currentMonth, fetchBalances, idr, monthLabel, monthRange } from './ledgerUtils'
import { ErrorNote, MonthPicker, PageHeader, PrintTitle, StatCard } from './LedgerUI'

const OPERATING_LABELS = {
  payment: 'Penerimaan dari klien',
  expense: 'Pembayaran beban',
  vendor_payment: 'Pembayaran ke vendor',
  commission_payment: 'Pembayaran komisi',
  payroll_payment: 'Pembayaran gaji',
  closing_tax: 'Pembayaran pajak',
  digital_asset: 'Biaya domain & server',
  employee_loan: 'Kasbon karyawan',
}

// Kelompokkan tiap jurnal yang menyentuh kas/bank: operasional, investasi
// (beli aset tetap), atau pendanaan (modal/prive). Transfer antar rekening
// tidak mengubah total kas sehingga dilewati.
function classify(entry) {
  const cashLines = entry.lines.filter((l) => l.is_cash)
  const net = cashLines.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0)
  if (cashLines.length === 0 || Math.round(net) === 0) return null
  const others = entry.lines.filter((l) => !l.is_cash)
  let group = 'operating'
  let label = OPERATING_LABELS[entry.source_type] || 'Lain-lain'
  if (['manual', 'opening', 'reversal'].includes(entry.source_type)) {
    if (others.some((l) => l.account_type === 'equity')) {
      group = 'financing'
      label = net > 0 ? 'Setoran modal' : 'Prive / pengambilan pemilik'
    } else if (others.some((l) => l.account_type === 'asset')) {
      group = 'investing'
      label = net > 0 ? 'Penjualan / penerimaan aset' : 'Pembelian aset'
    } else {
      label = 'Penyesuaian & lain-lain'
    }
  }
  return { group, label, net }
}

export default function CashFlow() {
  const [month, setMonth] = useState(currentMonth())
  const [lines, setLines] = useState([])
  const [openingCash, setOpeningCash] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const { from, to } = monthRange(month)
    setLoading(true)
    Promise.all([
      fetchBalances(from, to),
      supabase.from('acc_journal_view').select('entry_id, source_type, account_type, is_cash, debit, credit').gte('entry_date', from).lte('entry_date', to),
    ])
      .then(([bal, res]) => {
        if (res.error) throw new Error(res.error.message)
        setOpeningCash(bal.filter((b) => b.is_cash).reduce((s, b) => s + b.opening, 0))
        setLines(res.data || [])
        setError('')
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [month])

  const groups = useMemo(() => {
    const entries = new Map()
    for (const l of lines) {
      if (!entries.has(l.entry_id)) entries.set(l.entry_id, { source_type: l.source_type, lines: [] })
      entries.get(l.entry_id).lines.push(l)
    }
    const out = { operating: {}, investing: {}, financing: {} }
    for (const e of entries.values()) {
      const c = classify(e)
      if (!c) continue
      out[c.group][c.label] = (out[c.group][c.label] || 0) + c.net
    }
    return out
  }, [lines])

  const total = (g) => Object.values(groups[g]).reduce((s, v) => s + v, 0)
  const netChange = total('operating') + total('investing') + total('financing')
  const closingCash = openingCash + netChange

  const sections = [
    { key: 'operating', title: 'Arus Kas dari Aktivitas Operasional' },
    { key: 'investing', title: 'Arus Kas dari Aktivitas Investasi' },
    { key: 'financing', title: 'Arus Kas dari Aktivitas Pendanaan' },
  ]

  const exportCsv = () =>
    exportToCsv(`arus-kas-${month}`, [
      { Pos: 'Saldo kas awal', Nominal: openingCash },
      ...sections.flatMap((s) => [
        ...Object.entries(groups[s.key]).map(([label, v]) => ({ Pos: `${s.title} - ${label}`, Nominal: v })),
        { Pos: `Total ${s.title}`, Nominal: total(s.key) },
      ]),
      { Pos: 'Kenaikan/penurunan kas', Nominal: netChange },
      { Pos: 'Saldo kas akhir', Nominal: closingCash },
    ])

  return (
    <div>
      <PageHeader
        title="Arus Kas"
        description="Uang yang benar-benar masuk dan keluar dari semua rekening kas/bank dalam sebulan, dikelompokkan per aktivitas."
        onExport={exportCsv}
        exportDisabled={loading}
        printable
      >
        <MonthPicker value={month} onChange={setMonth} />
      </PageHeader>

      <ErrorNote message={error} />
      <PrintTitle title="Laporan Arus Kas" period={monthLabel(month)} />

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Saldo Kas Awal" value={idr(openingCash)} />
        <StatCard label="Kenaikan / Penurunan" value={idr(netChange)} tone={netChange >= 0 ? 'good' : 'bad'} />
        <StatCard label="Saldo Kas Akhir" value={idr(closingCash)} />
      </div>

      <div className="mt-4 space-y-4">
        {sections.map((s) => {
          const entries = Object.entries(groups[s.key])
          return (
            <div key={s.key} className="overflow-hidden rounded-2xl border border-white/10">
              <p className="bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-gold-soft">{s.title}</p>
              <table className="w-full text-left text-xs">
                <tbody>
                  {entries.map(([label, v]) => (
                    <tr key={label} className="border-t border-white/5 text-slate-300">
                      <td className="px-4 py-2">{label}</td>
                      <td className={`px-4 py-2 text-right ${v < 0 ? 'text-red-400' : 'text-emerald-400'}`}>{idr(v)}</td>
                    </tr>
                  ))}
                  {entries.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-4 py-3 text-center text-slate-500">
                        {loading ? 'Memuat...' : 'Tidak ada'}
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t border-white/10 font-semibold text-white">
                    <td className="px-4 py-2">Total</td>
                    <td className="px-4 py-2 text-right">{idr(total(s.key))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )
        })}
      </div>
    </div>
  )
}
