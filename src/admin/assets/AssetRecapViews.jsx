import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { exportToCsv } from '../accounting/csvExport'
import { StatCard } from '../ledger/LedgerUI'
import { RENEWAL_STATUS_LABEL, assetTypeLabel, daysUntil, formatDate, idr, renewalPrice, urgency, yearly } from './assetUtils'

const isLive = (a) => a.status !== 'terminated' && a.status !== 'expired'
const nextExpiry = (list) => list.filter((a) => isLive(a) && a.expiry_date).map((a) => a.expiry_date).sort()[0]

function GroupTable({ rows, nameLabel, valueLabel, renderAsset }) {
  const [open, setOpen] = useState({})
  return (
    <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
      <table className="w-full min-w-[640px] text-left text-xs">
        <thead className="bg-white/5 text-[11px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2.5">{nameLabel}</th>
            <th className="px-4 py-2.5 text-center">Aset</th>
            <th className="px-4 py-2.5">Habis Terdekat</th>
            <th className="px-4 py-2.5 text-right">{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((g) => {
            const days = daysUntil(g.next)
            const u = urgency(days)
            return [
              <tr key={g.key} className="cursor-pointer border-t border-white/5 text-slate-300 hover:bg-white/5" onClick={() => setOpen({ ...open, [g.key]: !open[g.key] })}>
                <td className="px-4 py-2.5 font-semibold text-white">
                  <span className="inline-flex items-center gap-1">
                    {open[g.key] ? <ChevronDown size={13} /> : <ChevronRight size={13} />} {g.name}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-center">{g.assets.length}</td>
                <td className="px-4 py-2.5">
                  {g.next ? (
                    <>
                      {formatDate(g.next)} <span className={`ml-1 ${u.tone}`}>({u.text})</span>
                    </>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="px-4 py-2.5 text-right font-semibold text-white">{idr(g.value)}</td>
              </tr>,
              open[g.key] && (
                <tr key={`${g.key}-detail`} className="border-t border-white/5 bg-white/[0.02]">
                  <td colSpan={4} className="px-8 py-2">
                    {g.assets.map((a) => (
                      <div key={a.id} className="flex flex-wrap justify-between gap-2 py-1 text-[11px] text-slate-400">
                        <span>
                          {assetTypeLabel(a.asset_type)} <b className="text-slate-200">{a.domain_name}</b> · habis {formatDate(a.expiry_date)}
                        </span>
                        <span>{renderAsset(a)}</span>
                      </div>
                    ))}
                  </td>
                </tr>
              ),
            ]
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                Belum ada data.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

export function ByClient({ assets }) {
  const rows = useMemo(() => {
    const map = new Map()
    for (const a of assets) {
      const key = a.client_id || 'none'
      if (!map.has(key)) map.set(key, { key, name: a.acc_clients?.company_name || 'Tanpa klien', assets: [] })
      map.get(key).assets.push(a)
    }
    return [...map.values()]
      .map((g) => ({ ...g, next: nextExpiry(g.assets), value: g.assets.filter(isLive).reduce((s, a) => s + yearly(renewalPrice(a), a.cycle_months), 0) }))
      .sort((x, y) => y.value - x.value)
  }, [assets])

  return (
    <>
      <p className="mt-4 text-xs text-slate-400">Nilai tagihan perpanjangan per tahun untuk setiap klien. Klik baris untuk melihat asetnya.</p>
      <GroupTable rows={rows} nameLabel="Klien" valueLabel="Tagihan / Tahun" renderAsset={(a) => `${idr(renewalPrice(a))} / ${a.cycle_months} bln`} />
    </>
  )
}

export function ByVendor({ assets }) {
  const rows = useMemo(() => {
    const map = new Map()
    for (const a of assets) {
      const key = a.vendor_id || 'none'
      if (!map.has(key)) map.set(key, { key, name: a.vendor?.vendor_name || 'Vendor belum diisi', assets: [] })
      map.get(key).assets.push(a)
    }
    return [...map.values()]
      .map((g) => ({ ...g, next: nextExpiry(g.assets), value: g.assets.filter(isLive).reduce((s, a) => s + yearly(a.cost_price, a.cycle_months), 0) }))
      .sort((x, y) => y.value - x.value)
  }, [assets])

  return (
    <>
      <p className="mt-4 text-xs text-slate-400">Biaya modal per tahun yang dibayarkan ke setiap vendor.</p>
      <GroupTable rows={rows} nameLabel="Vendor" valueLabel="Modal / Tahun" renderAsset={(a) => `${a.acc_clients?.company_name || '-'} · ${idr(a.cost_price)}`} />
    </>
  )
}

export function RenewalCalendar({ assets }) {
  const months = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() + i, 1))
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
      const list = assets.filter((a) => isLive(a) && a.expiry_date?.startsWith(key)).sort((x, y) => x.expiry_date.localeCompare(y.expiry_date))
      return {
        key,
        label: d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
        list,
        sell: list.reduce((s, a) => s + renewalPrice(a), 0),
        cost: list.reduce((s, a) => s + Number(a.cost_price || 0), 0),
      }
    })
  }, [assets])
  const overdue = assets.filter((a) => isLive(a) && daysUntil(a.expiry_date) < 0)

  return (
    <>
      <p className="mt-4 text-xs text-slate-400">Jadwal aset yang habis dalam 12 bulan ke depan, untuk melihat bulan yang ramai tagihan.</p>
      {overdue.length > 0 && (
        <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-300">
          {overdue.length} aset sudah melewati masa aktif: {overdue.map((a) => a.domain_name).join(', ')}
        </p>
      )}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {months.map((m) => (
          <div key={m.key} className={`rounded-2xl border p-4 ${m.list.length ? 'border-white/10 bg-white/5' : 'border-white/5 opacity-60'}`}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold capitalize text-white">{m.label}</p>
              <span className="text-[11px] text-slate-500">{m.list.length} aset</span>
            </div>
            {m.list.length > 0 && (
              <>
                <p className="mt-1 text-xs text-slate-400">
                  Tagihan {idr(m.sell)} · modal {idr(m.cost)}
                </p>
                <div className="mt-2 space-y-1">
                  {m.list.map((a) => (
                    <p key={a.id} className="flex justify-between gap-2 text-[11px] text-slate-400">
                      <span className="truncate">
                        {a.expiry_date.slice(8)} · {assetTypeLabel(a.asset_type)} {a.domain_name}
                      </span>
                      <span className="shrink-0 text-slate-500">{a.acc_clients?.company_name}</span>
                    </p>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

export function RenewalHistory({ assets }) {
  const all = useMemo(
    () =>
      assets
        .flatMap((a) => (a.acc_asset_renewals || []).map((r) => ({ ...r, asset: a })))
        .sort((x, y) => (y.period_start || '').localeCompare(x.period_start || '')),
    [assets],
  )
  const years = [...new Set(all.map((r) => r.period_start?.slice(0, 4)).filter(Boolean))].sort().reverse()
  const [year, setYear] = useState('all')
  const rows = all.filter((r) => year === 'all' || r.period_start?.startsWith(year))
  const settled = rows.filter((r) => r.status === 'paid' || r.status === 'manual')
  const revenue = settled.reduce((s, r) => s + Number(r.sell_price), 0)
  const cost = settled.reduce((s, r) => s + Number(r.cost_price), 0)
  const unpaid = rows.filter((r) => r.status === 'invoiced').reduce((s, r) => s + Number(r.sell_price), 0)

  const exportCsv = () =>
    exportToCsv(
      `riwayat-perpanjangan-${year}`,
      rows.map((r) => ({
        Klien: r.asset.acc_clients?.company_name || '',
        Jenis: assetTypeLabel(r.asset.asset_type),
        Layanan: r.asset.domain_name || '',
        'Periode Mulai': r.period_start,
        'Periode Akhir': r.period_end,
        'Harga Jual': Number(r.sell_price),
        'Harga Modal': Number(r.cost_price),
        Margin: Number(r.sell_price) - Number(r.cost_price),
        Status: RENEWAL_STATUS_LABEL[r.status],
        Invoice: r.acc_invoices?.invoice_number || '',
        'Tanggal Bayar': r.paid_at || '',
      })),
    )

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-400">Setiap perpanjangan beserta invoice dan pembayarannya.</p>
        <div className="flex gap-2">
          <select className="input-field !w-32 !py-1.5 text-xs" value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="all">Semua tahun</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button type="button" onClick={exportCsv} disabled={!rows.length} className="btn-secondary !px-3 !py-1.5 text-xs disabled:opacity-50">
            Ekspor CSV
          </button>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Pendapatan perpanjangan (lunas)" value={idr(revenue)} tone="good" />
        <StatCard label="Modal ke vendor" value={idr(cost)} />
        <StatCard label="Margin" value={idr(revenue - cost)} tone={revenue - cost >= 0 ? 'good' : 'bad'} />
        <StatCard label="Belum dibayar klien" value={idr(unpaid)} tone={unpaid > 0 ? 'warn' : 'default'} />
      </div>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead className="bg-white/5 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5">Layanan</th>
              <th className="px-4 py-2.5">Periode</th>
              <th className="px-4 py-2.5 text-right">Jual</th>
              <th className="px-4 py-2.5 text-right">Modal</th>
              <th className="px-4 py-2.5">Invoice</th>
              <th className="px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-white/5 text-slate-300">
                <td className="px-4 py-2.5">
                  <p className="font-semibold text-white">
                    {assetTypeLabel(r.asset.asset_type)} {r.asset.domain_name}
                  </p>
                  <p className="text-[11px] text-slate-500">{r.asset.acc_clients?.company_name}</p>
                </td>
                <td className="px-4 py-2.5">
                  {formatDate(r.period_start)} - {formatDate(r.period_end)}
                </td>
                <td className="px-4 py-2.5 text-right">{idr(r.sell_price)}</td>
                <td className="px-4 py-2.5 text-right text-slate-400">{idr(r.cost_price)}</td>
                <td className="px-4 py-2.5">{r.acc_invoices?.invoice_number || '-'}</td>
                <td className="px-4 py-2.5">
                  <span className={r.status === 'invoiced' ? 'text-amber-300' : r.status === 'cancelled' ? 'text-slate-500' : 'text-emerald-400'}>
                    {RENEWAL_STATUS_LABEL[r.status]}
                  </span>
                  {r.paid_at && <span className="block text-[11px] text-slate-500">{formatDate(r.paid_at)}</span>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Belum ada riwayat perpanjangan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
