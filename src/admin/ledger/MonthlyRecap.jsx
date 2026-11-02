import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { exportToCsv } from '../accounting/csvExport'
import { currentMonth, fetchBalances, formatDate, idr, monthLabel, monthRange, shiftMonth, today } from './ledgerUtils'
import { ErrorNote, MonthPicker, PageHeader, PrintTitle, StatCard } from './LedgerUI'
import { buildProfitLoss } from './ProfitLoss'

// Warna grafik ditulis langsung: utilitas bg-gold dipetakan ulang oleh tema admin.
const REV_COLOR = '#1468c8'
const EXP_COLOR = '#d97706'

const AGING = [
  { key: 'current', label: 'Belum jatuh tempo' },
  { key: 'd30', label: '1-30 hari' },
  { key: 'd60', label: '31-60 hari' },
  { key: 'd60plus', label: '> 60 hari' },
]

function agingBucket(dueDate, asOf) {
  if (!dueDate || dueDate >= asOf) return 'current'
  const days = Math.round((new Date(`${asOf}T00:00:00`) - new Date(`${dueDate}T00:00:00`)) / 86400000)
  if (days <= 30) return 'd30'
  if (days <= 60) return 'd60'
  return 'd60plus'
}

const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function Card({ title, children }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10">
      <p className="bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-gold-soft">{title}</p>
      <div className="p-4">{children}</div>
    </div>
  )
}

function Row({ label, value, strong, tone }) {
  return (
    <div className={`flex justify-between gap-3 py-1 text-xs ${strong ? 'font-semibold text-white' : 'text-slate-300'}`}>
      <span>{label}</span>
      <span className={tone === 'bad' ? 'text-red-400' : tone === 'good' ? 'text-emerald-400' : ''}>{value}</span>
    </div>
  )
}

export default function MonthlyRecap() {
  const [month, setMonth] = useState(currentMonth())
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const { from, to } = monthRange(month)
    const prev = monthRange(shiftMonth(month, -1))
    const trendFrom = monthRange(shiftMonth(month, -11)).from
    const now = today()
    Promise.all([
      fetchBalances(from, to),
      fetchBalances(prev.from, prev.to),
      supabase.from('acc_invoices').select('invoice_number, total_amount, paid_amount, due_date, status, is_pph23_withheld, subtotal, created_at, acc_clients(company_name)').in('status', ['sent', 'partial', 'overdue']),
      supabase.from('acc_vendor_bills').select('bill_number, amount, paid_amount, due_date, status, acc_vendors(vendor_name)').neq('status', 'paid'),
      supabase.from('acc_commissions').select('commission_amount').eq('status', 'payable'),
      supabase.from('acc_tax_profile').select('pph_final_rate, pph23_rate').eq('id', 1).maybeSingle(),
      supabase.from('acc_subscriptions').select('amount').eq('status', 'active'),
      supabase.from('acc_digital_assets').select('domain_name, expiry_date, status').gte('expiry_date', now).lte('expiry_date', addDays(now, 60)).order('expiry_date'),
      supabase.from('acc_journal_view').select('entry_date, account_type, debit, credit').in('account_type', ['revenue', 'expense']).gte('entry_date', trendFrom).lte('entry_date', to),
      supabase.from('acc_payments').select('amount_paid').gte('payment_date', from).lte('payment_date', to),
    ])
      .then(([cur, prv, inv, bills, comm, tax, subs, assets, trend, pays]) => {
        for (const r of [inv, bills, comm, tax, subs, assets, trend, pays]) if (r.error) throw new Error(r.error.message)
        setData({ cur, prv, inv: inv.data, bills: bills.data, comm: comm.data, tax: tax.data, subs: subs.data, assets: assets.data, trend: trend.data, pays: pays.data, asOf: now })
        setError('')
      })
      .catch((e) => setError(e.message))
  }, [month])

  const view = useMemo(() => {
    if (!data) return null
    const pl = buildProfitLoss(data.cur)
    const plPrev = buildProfitLoss(data.prv)
    const cash = data.cur.filter((b) => b.is_cash && (b.closing || b.debit || b.credit))
    const cashTotal = cash.reduce((s, b) => s + b.closing, 0)
    const cashIn = cash.reduce((s, b) => s + b.debit, 0)
    const cashOut = cash.reduce((s, b) => s + b.credit, 0)

    const receivables = data.inv
      .map((i) => ({ ...i, outstanding: Number(i.total_amount) - Number(i.paid_amount), bucket: agingBucket(i.due_date, data.asOf) }))
      .filter((i) => i.outstanding > 0)
    const aging = Object.fromEntries(AGING.map((a) => [a.key, receivables.filter((r) => r.bucket === a.key).reduce((s, r) => s + r.outstanding, 0)]))
    const byClient = Object.entries(
      receivables.reduce((m, r) => {
        const k = r.acc_clients?.company_name || '-'
        m[k] = (m[k] || 0) + r.outstanding
        return m
      }, {}),
    ).sort((a, b) => b[1] - a[1])

    const vendorDebt = data.bills.reduce((s, b) => s + Number(b.amount) - Number(b.paid_amount), 0)
    const commissionDebt = data.comm.reduce((s, c) => s + Number(c.commission_amount), 0)
    const omzet = data.pays.reduce((s, p) => s + Number(p.amount_paid), 0)
    const pphFinalRate = Number(data.tax?.pph_final_rate ?? 0.5)
    const pph23Rate = Number(data.tax?.pph23_rate ?? 2)
    const { from, to } = monthRange(month)
    const pph23 = data.inv
      .filter((i) => i.is_pph23_withheld && i.created_at.slice(0, 10) >= from && i.created_at.slice(0, 10) <= to)
      .reduce((s, i) => s + (Number(i.subtotal) * pph23Rate) / 100, 0)
    const mrr = data.subs.reduce((s, x) => s + Number(x.amount), 0)

    const months = Array.from({ length: 12 }, (_, i) => shiftMonth(month, i - 11))
    const trend = months.map((m) => {
      const rows = data.trend.filter((t) => t.entry_date.slice(0, 7) === m)
      const revenue = rows.filter((t) => t.account_type === 'revenue').reduce((s, t) => s + Number(t.credit) - Number(t.debit), 0)
      const expense = rows.filter((t) => t.account_type === 'expense').reduce((s, t) => s + Number(t.debit) - Number(t.credit), 0)
      return { m, revenue, expense }
    })
    const trendMax = Math.max(1, ...trend.flatMap((t) => [t.revenue, t.expense]))

    return { pl, plPrev, cash, cashTotal, cashIn, cashOut, receivables, aging, byClient, vendorDebt, commissionDebt, omzet, pphFinalRate, pph23, mrr, trend, trendMax }
  }, [data, month])

  const delta = (a, b) => {
    if (!b) return null
    const pct = ((a - b) / Math.abs(b)) * 100
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}% vs bulan lalu`
  }

  const exportCsv = () => {
    if (!view) return
    exportToCsv(`rekap-${month}`, [
      { Pos: 'Pendapatan', Nominal: view.pl.totalRevenue },
      { Pos: 'Beban pokok proyek', Nominal: view.pl.totalCogs },
      { Pos: 'Laba kotor', Nominal: view.pl.grossProfit },
      { Pos: 'Beban operasional', Nominal: view.pl.totalOpex },
      { Pos: 'Laba bersih', Nominal: view.pl.netProfit },
      { Pos: 'Kas masuk', Nominal: view.cashIn },
      { Pos: 'Kas keluar', Nominal: view.cashOut },
      { Pos: 'Saldo kas & bank', Nominal: view.cashTotal },
      ...AGING.map((a) => ({ Pos: `Piutang ${a.label}`, Nominal: view.aging[a.key] })),
      { Pos: 'Utang vendor', Nominal: view.vendorDebt },
      { Pos: 'Utang komisi', Nominal: view.commissionDebt },
      { Pos: `Estimasi PPh Final (${view.pphFinalRate}%)`, Nominal: Math.round((view.omzet * view.pphFinalRate) / 100) },
      { Pos: 'PPh 23 dipotong klien', Nominal: view.pph23 },
      { Pos: 'Retainer aktif per bulan', Nominal: view.mrr },
    ])
  }

  return (
    <div>
      <PageHeader
        title="Rekap Bulanan"
        description="Ringkasan keuangan satu halaman: laba rugi, kas, piutang, utang, pajak, dan tren 12 bulan."
        onExport={exportCsv}
        exportDisabled={!view}
        printable
      >
        <MonthPicker value={month} onChange={setMonth} />
      </PageHeader>

      <ErrorNote message={error} />
      <PrintTitle title="Rekap Keuangan Bulanan" period={monthLabel(month)} />
      {!view && !error && <p className="py-8 text-center text-xs text-slate-500">Memuat...</p>}

      {view && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Pendapatan" value={idr(view.pl.totalRevenue)} hint={delta(view.pl.totalRevenue, view.plPrev.totalRevenue)} />
            <StatCard label="Laba Bersih" value={idr(view.pl.netProfit)} tone={view.pl.netProfit >= 0 ? 'good' : 'bad'} hint={delta(view.pl.netProfit, view.plPrev.netProfit)} />
            <StatCard label="Saldo Kas & Bank" value={idr(view.cashTotal)} hint={`Masuk ${idr(view.cashIn)} · Keluar ${idr(view.cashOut)}`} />
            <StatCard label="Piutang Belum Dibayar" value={idr(view.receivables.reduce((s, r) => s + r.outstanding, 0))} tone={view.aging.d60plus > 0 ? 'warn' : 'default'} hint={`${view.receivables.length} invoice`} />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title="Laba Rugi">
              <Row label="Pendapatan" value={idr(view.pl.totalRevenue)} />
              <Row label="Beban pokok proyek" value={idr(-view.pl.totalCogs)} />
              <Row label="Laba kotor" value={idr(view.pl.grossProfit)} strong />
              <Row label="Beban operasional" value={idr(-view.pl.totalOpex)} />
              <Row label="Laba bersih" value={idr(view.pl.netProfit)} strong tone={view.pl.netProfit >= 0 ? 'good' : 'bad'} />
              <p className="mt-2 text-[11px] text-slate-500">Basis akrual. Rincian lengkap di menu Laba Rugi.</p>
            </Card>

            <Card title="Saldo per Rekening">
              {view.cash.map((b) => (
                <Row key={b.account_id} label={`${b.code} ${b.name}`} value={idr(b.closing)} tone={b.closing < 0 ? 'bad' : undefined} />
              ))}
              {view.cash.length === 0 && <p className="text-xs text-slate-500">Belum ada mutasi kas.</p>}
              <div className="mt-1 border-t border-white/10 pt-1">
                <Row label="Total" value={idr(view.cashTotal)} strong />
              </div>
            </Card>

            <Card title="Umur Piutang (per hari ini)">
              {AGING.map((a) => (
                <Row key={a.key} label={a.label} value={idr(view.aging[a.key])} tone={a.key === 'd60plus' && view.aging[a.key] > 0 ? 'bad' : undefined} />
              ))}
              {view.byClient.length > 0 && (
                <div className="mt-2 border-t border-white/10 pt-2">
                  <p className="mb-1 text-[11px] text-slate-500">Terbesar per klien</p>
                  {view.byClient.slice(0, 5).map(([name, v]) => (
                    <Row key={name} label={name} value={idr(v)} />
                  ))}
                </div>
              )}
            </Card>

            <Card title="Utang & Kewajiban">
              <Row label="Utang vendor belum dibayar" value={idr(view.vendorDebt)} />
              <Row label="Komisi siap dibayar" value={idr(view.commissionDebt)} />
              <Row label={`Estimasi PPh Final ${view.pphFinalRate}% (kas masuk ${idr(view.omzet)})`} value={idr(Math.round((view.omzet * view.pphFinalRate) / 100))} />
              <Row label="PPh 23 dipotong klien bulan ini" value={idr(view.pph23)} />
              <p className="mt-2 text-[11px] text-slate-500">Perhitungan pajak ini estimasi. Pastikan dengan konsultan pajak sebelum setor/lapor.</p>
            </Card>

            <Card title="Pendapatan Rutin">
              <Row label="Retainer aktif per bulan" value={idr(view.mrr)} strong />
              <p className="mb-1 mt-3 text-[11px] text-slate-500">Domain/server jatuh tempo 60 hari ke depan</p>
              {data.assets.map((a, i) => (
                <Row key={i} label={a.domain_name || '-'} value={formatDate(a.expiry_date)} />
              ))}
              {data.assets.length === 0 && <p className="text-xs text-slate-500">Tidak ada.</p>}
            </Card>

            <Card title="Tren 12 Bulan">
              <div className="flex h-40 items-end gap-1.5">
                {view.trend.map((t) => (
                  <div key={t.m} className="flex flex-1 flex-col items-center gap-1" title={`${monthLabel(t.m)}: pendapatan ${idr(t.revenue)}, beban ${idr(t.expense)}`}>
                    <div className="flex h-32 w-full items-end justify-center gap-0.5">
                      <div className="w-1/2 rounded-t" style={{ background: REV_COLOR, height: `${(Math.max(0, t.revenue) / view.trendMax) * 100}%` }} />
                      <div className="w-1/2 rounded-t" style={{ background: EXP_COLOR, height: `${(Math.max(0, t.expense) / view.trendMax) * 100}%` }} />
                    </div>
                    <span className="text-[9px] text-slate-500">{t.m.slice(5)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-4 text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-sm" style={{ background: REV_COLOR }} /> Pendapatan
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-sm" style={{ background: EXP_COLOR }} /> Beban
                </span>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
