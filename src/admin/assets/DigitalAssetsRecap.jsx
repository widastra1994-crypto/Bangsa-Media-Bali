import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarCheck, FilePlus2, Pencil, Plus, Search } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { exportToCsv } from '../accounting/csvExport'
import { ErrorNote, PageHeader, StatCard } from '../ledger/LedgerUI'
import { useUserRole } from '../useUserRole'
import AssetForm from './AssetForm'
import RenewalDialog from './RenewalDialog'
import ShareInvoice from './ShareInvoice'
import ReminderSettings from './ReminderSettings'
import { ByClient, ByVendor, RenewalCalendar, RenewalHistory } from './AssetRecapViews'
import { ASSET_TYPES, STATUS_LABEL, assetTypeLabel, cycleLabel, daysUntil, formatDate, idr, renewalPrice, urgency, yearly } from './assetUtils'

const ASSET_SELECT =
  '*, acc_clients(id, company_name, pic_name, email, phone_primary), acc_projects(website_name), vendor:acc_vendors!acc_digital_assets_vendor_id_fkey(vendor_name), ' +
  'acc_asset_renewals(id, invoice_id, status, period_start, period_end, sell_price, cost_price, paid_at, ' +
  'acc_invoices(id, invoice_number, status, total_amount, paid_amount, pph23_amount, due_date, public_token))'

const TABS = [
  { id: 'list', label: 'Daftar Aset' },
  { id: 'client', label: 'Per Klien' },
  { id: 'vendor', label: 'Per Vendor' },
  { id: 'calendar', label: 'Kalender' },
  { id: 'history', label: 'Riwayat Perpanjangan' },
  { id: 'settings', label: 'Pengaturan Pengingat' },
]

const UPTIME = { up: ['Online', 'text-emerald-400'], down: ['Down', 'text-red-400'], degraded: ['Lambat', 'text-amber-400'] }
const isLive = (a) => a.status !== 'terminated' && a.status !== 'expired'
const openRenewal = (a) => (a.acc_asset_renewals || []).find((r) => r.status === 'invoiced' && r.acc_invoices)

export default function DigitalAssetsRecap() {
  const { role } = useUserRole()
  const canEdit = ['owner', 'admin', 'staff'].includes(role)
  const canManage = ['owner', 'admin'].includes(role)

  const [tab, setTab] = useState('list')
  const [assets, setAssets] = useState([])
  const [lookups, setLookups] = useState({ clients: [], projects: [], vendors: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [filters, setFilters] = useState({ q: '', type: '', client: '', vendor: '', status: 'live', due: '' })
  const [selected, setSelected] = useState([])
  const [editing, setEditing] = useState(null)
  const [renewing, setRenewing] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [a, c, p, v] = await Promise.all([
      supabase.from('acc_digital_assets').select(ASSET_SELECT).order('expiry_date', { ascending: true, nullsFirst: false }),
      supabase.from('acc_clients').select('id, company_name').order('company_name'),
      supabase.from('acc_projects').select('id, website_name, client_id').order('created_at', { ascending: false }),
      supabase.from('acc_vendors').select('id, vendor_name, vendor_type').order('vendor_name'),
    ])
    const err = a.error || c.error || p.error || v.error
    if (err) setError(err.message)
    else {
      setError('')
      setAssets(a.data || [])
      setLookups({ clients: c.data || [], projects: p.data || [], vendors: v.data || [] })
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const flash = (msg) => {
    setNotice(msg)
    setTimeout(() => setNotice(''), 5000)
  }

  const stats = useMemo(() => {
    const live = assets.filter(isLive)
    const within = (n) => live.filter((a) => {
      const d = daysUntil(a.expiry_date)
      return d !== null && d <= n
    }).length
    const revenue = live.reduce((s, a) => s + yearly(renewalPrice(a), a.cycle_months), 0)
    const cost = live.reduce((s, a) => s + yearly(a.cost_price, a.cycle_months), 0)
    return { live: live.length, d30: within(30), d60: within(60), d90: within(90), overdue: within(-1), revenue, cost }
  }, [assets])

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase()
    return assets.filter((a) => {
      if (filters.type && a.asset_type !== filters.type) return false
      if (filters.client && a.client_id !== filters.client) return false
      if (filters.vendor && a.vendor_id !== filters.vendor) return false
      if (filters.status === 'live' && !isLive(a)) return false
      if (filters.status && filters.status !== 'live' && a.status !== filters.status) return false
      const d = daysUntil(a.expiry_date)
      if (filters.due === '30' && !(d !== null && d <= 30)) return false
      if (filters.due === 'overdue' && !(d !== null && d < 0)) return false
      if (filters.due === 'unpaid' && !openRenewal(a)) return false
      if (q && ![a.domain_name, a.acc_clients?.company_name, a.vendor?.vendor_name, a.acc_projects?.website_name].some((s) => s?.toLowerCase().includes(q))) return false
      return true
    })
  }, [assets, filters])

  const selectedAssets = assets.filter((a) => selected.includes(a.id))
  const selectedClients = new Set(selectedAssets.map((a) => a.client_id))
  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const markRenewed = async (a) => {
    if (!window.confirm(`Tandai ${a.domain_name} sudah diperpanjang (dibayar di luar invoice)? Masa aktif maju ${cycleLabel(a.cycle_months).toLowerCase()}.`)) return
    const { data, error: err } = await supabase.rpc('asset_mark_renewed', { p_asset_id: a.id, p_notes: null })
    if (err) return setError(err.message)
    flash(`${a.domain_name} diperpanjang sampai ${formatDate(data)}.`)
    load()
  }

  const exportCsv = () =>
    exportToCsv(
      'rekap-aset-digital',
      filtered.map((a) => ({
        Jenis: assetTypeLabel(a.asset_type),
        Layanan: a.domain_name || '',
        Klien: a.acc_clients?.company_name || '',
        Proyek: a.acc_projects?.website_name || '',
        Vendor: a.vendor?.vendor_name || '',
        Mulai: a.registration_date || '',
        'Habis Masa Aktif': a.expiry_date || '',
        'Sisa Hari': daysUntil(a.expiry_date) ?? '',
        Siklus: cycleLabel(a.cycle_months),
        'Harga Modal': Number(a.cost_price),
        'Harga Jual': Number(a.sell_price),
        Status: STATUS_LABEL[a.status] || a.status,
        'Invoice Terbuka': openRenewal(a)?.acc_invoices?.invoice_number || '',
      })),
    )

  const setFilter = (patch) => setFilters((f) => ({ ...f, ...patch }))

  return (
    <div>
      <PageHeader
        title="Rekap Aset Digital"
        description="Semua domain, hosting/server, SSL, dan email bisnis klien. Invoice perpanjangan terbit otomatis dan bisa dibagikan ke klien lewat WhatsApp atau email."
        onExport={tab === 'list' ? exportCsv : undefined}
        exportDisabled={!filtered.length}
      >
        {canEdit && (
          <button type="button" onClick={() => setEditing({})} className="btn-primary !px-3 !py-2 text-xs">
            <Plus size={14} /> Tambah Aset
          </button>
        )}
      </PageHeader>

      <ErrorNote message={error} />
      {notice && <p className="mt-3 text-xs text-cyan-300">{notice}</p>}

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Aset aktif" value={stats.live} />
        <StatCard
          label="Habis ≤ 30 hari"
          value={stats.d30}
          tone={stats.overdue > 0 ? 'bad' : stats.d30 > 0 ? 'warn' : 'default'}
          hint={`${stats.d60} aset ≤ 60 hari · ${stats.d90} ≤ 90 hari${stats.overdue ? ` · ${stats.overdue} lewat` : ''}`}
        />
        <StatCard label="Tagihan perpanjangan / tahun" value={idr(stats.revenue)} tone="good" />
        <StatCard label="Modal ke vendor / tahun" value={idr(stats.cost)} />
        <StatCard label="Margin / tahun" value={idr(stats.revenue - stats.cost)} tone={stats.revenue - stats.cost >= 0 ? 'good' : 'bad'} />
      </div>

      <div className="mt-5 flex flex-wrap gap-1 border-b border-white/10">
        {TABS.filter((t) => t.id !== 'settings' || role !== 'viewer').map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-xs font-semibold ${tab === t.id ? 'border-gold text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <p className="mt-4 text-sm text-slate-400">Memuat...</p>}

      {!loading && tab === 'list' && (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input className="input-field !py-1.5 !pl-8 text-xs" placeholder="Cari domain, klien, vendor..." value={filters.q} onChange={(e) => setFilter({ q: e.target.value })} />
            </div>
            <select className="input-field !w-auto !py-1.5 text-xs" value={filters.type} onChange={(e) => setFilter({ type: e.target.value })}>
              <option value="">Semua jenis</option>
              {ASSET_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <select className="input-field !w-auto !py-1.5 text-xs" value={filters.client} onChange={(e) => setFilter({ client: e.target.value })}>
              <option value="">Semua klien</option>
              {lookups.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name}
                </option>
              ))}
            </select>
            <select className="input-field !w-auto !py-1.5 text-xs" value={filters.vendor} onChange={(e) => setFilter({ vendor: e.target.value })}>
              <option value="">Semua vendor</option>
              {lookups.vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.vendor_name}
                </option>
              ))}
            </select>
            <select className="input-field !w-auto !py-1.5 text-xs" value={filters.due} onChange={(e) => setFilter({ due: e.target.value })}>
              <option value="">Semua masa aktif</option>
              <option value="30">Habis ≤ 30 hari</option>
              <option value="overdue">Sudah lewat</option>
              <option value="unpaid">Invoice belum dibayar</option>
            </select>
            <select className="input-field !w-auto !py-1.5 text-xs" value={filters.status} onChange={(e) => setFilter({ status: e.target.value })}>
              <option value="live">Aset berjalan</option>
              <option value="">Semua status</option>
              {Object.entries(STATUS_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          {canEdit && selected.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs text-cyan-200">
              <span>{selected.length} aset dipilih</span>
              {selectedClients.size > 1 ? (
                <span className="text-amber-300">Satu invoice hanya untuk satu klien. Pilih aset dari klien yang sama.</span>
              ) : (
                <button type="button" onClick={() => setRenewing(selectedAssets)} className="btn-primary !px-3 !py-1.5 text-xs">
                  <FilePlus2 size={13} /> Buat 1 Invoice Gabungan
                </button>
              )}
              <button type="button" onClick={() => setSelected([])} className="text-slate-400 hover:text-white">
                Batal pilih
              </button>
            </div>
          )}

          <div className="mt-3 overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[980px] text-left text-xs">
              <thead className="bg-white/5 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  {canEdit && <th className="w-8 px-3 py-2.5" />}
                  <th className="px-3 py-2.5">Layanan</th>
                  <th className="px-3 py-2.5">Vendor</th>
                  <th className="px-3 py-2.5">Masa Aktif</th>
                  <th className="px-3 py-2.5 text-right">Modal</th>
                  <th className="px-3 py-2.5 text-right">Jual</th>
                  <th className="px-3 py-2.5">Invoice Perpanjangan</th>
                  <th className="px-3 py-2.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const days = daysUntil(a.expiry_date)
                  const u = urgency(days)
                  const open = openRenewal(a)
                  const inv = open?.acc_invoices
                  return (
                    <tr key={a.id} className="border-t border-white/5 align-top text-slate-300">
                      {canEdit && (
                        <td className="px-3 py-3">
                          <input type="checkbox" className="h-3.5 w-3.5 accent-gold" checked={selected.includes(a.id)} onChange={() => toggle(a.id)} aria-label={`Pilih ${a.domain_name}`} />
                        </td>
                      )}
                      <td className="px-3 py-3">
                        <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-400">{assetTypeLabel(a.asset_type)}</span>
                        <p className="mt-1 font-semibold text-white">{a.domain_name || '-'}</p>
                        <p className="text-[11px] text-slate-500">
                          {a.acc_clients?.company_name || 'Tanpa klien'}
                          {a.acc_projects?.website_name ? ` · ${a.acc_projects.website_name}` : ''}
                        </p>
                        {a.website_url && (
                          <p className={`text-[11px] ${UPTIME[a.uptime_status]?.[1] || 'text-slate-500'}`}>Website: {UPTIME[a.uptime_status]?.[0] || 'belum dicek'}</p>
                        )}
                      </td>
                      <td className="px-3 py-3">{a.vendor?.vendor_name || '-'}</td>
                      <td className="px-3 py-3">
                        <p className="text-white">{formatDate(a.expiry_date)}</p>
                        <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${u.badge}`}>{u.text}</span>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {cycleLabel(a.cycle_months)} · {STATUS_LABEL[a.status] || a.status}
                          {!a.auto_invoice && ' · invoice manual'}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-right text-slate-400">{idr(a.cost_price)}</td>
                      <td className="px-3 py-3 text-right font-semibold text-white">{idr(renewalPrice(a))}</td>
                      <td className="px-3 py-3">
                        {inv ? (
                          <div className="space-y-1.5">
                            <p>
                              <span className="font-semibold text-white">{inv.invoice_number}</span>{' '}
                              <span className="text-amber-300">{inv.status === 'partial' ? 'dibayar sebagian' : 'belum dibayar'}</span>
                            </p>
                            {canEdit && <ShareInvoice compact invoice={inv} client={a.acc_clients} />}
                          </div>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {canEdit && (
                          <div className="flex flex-col items-end gap-1.5">
                            {!inv && isLive(a) && (
                              <button type="button" onClick={() => setRenewing([a])} className="btn-secondary !px-2 !py-1 text-[11px]">
                                <FilePlus2 size={12} /> Buat Invoice
                              </button>
                            )}
                            {!inv && isLive(a) && (
                              <button type="button" onClick={() => markRenewed(a)} className="btn-secondary !px-2 !py-1 text-[11px]" title="Sudah dibayar di luar invoice">
                                <CalendarCheck size={12} /> Tandai Diperpanjang
                              </button>
                            )}
                            <button type="button" onClick={() => setEditing(a)} className="btn-secondary !px-2 !py-1 text-[11px]">
                              <Pencil size={12} /> Edit
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                      {assets.length ? 'Tidak ada aset yang cocok dengan filter.' : 'Belum ada aset digital. Klik "Tambah Aset".'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!loading && tab === 'client' && <ByClient assets={assets} />}
      {!loading && tab === 'vendor' && <ByVendor assets={assets} />}
      {!loading && tab === 'calendar' && <RenewalCalendar assets={assets} />}
      {!loading && tab === 'history' && <RenewalHistory assets={assets} />}
      {!loading && tab === 'settings' && <ReminderSettings canEdit={canManage} />}

      {editing && (
        <AssetForm
          asset={editing}
          clients={lookups.clients}
          projects={lookups.projects}
          vendors={lookups.vendors}
          canDelete={canManage}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            setEditing(null)
            flash(msg)
            load()
          }}
        />
      )}
      {renewing && (
        <RenewalDialog
          assets={renewing}
          onClose={() => {
            setRenewing(null)
            setSelected([])
          }}
          onDone={load}
        />
      )}
    </div>
  )
}
