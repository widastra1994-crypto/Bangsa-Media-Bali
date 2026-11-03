import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Bell, Check, Clock, FileWarning, ShieldAlert, UserPlus } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { invoiceOutstanding } from '../lib/invoiceUtils'
import ShareInvoice from './assets/ShareInvoice'

const idr = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0)

const SEVERITY_DOT = { high: 'bg-red-400', medium: 'bg-amber-400', low: 'bg-cyan-400' }

// Dua sumber notifikasi:
//  1. Dihitung langsung dari tabel (invoice/tagihan vendor jatuh tempo, lead baru).
//  2. Notifikasi perpanjangan aset yang dibuat job harian database
//     (acc_admin_notifications), dengan status sudah dibaca per pengguna.
async function computeNotifications() {
  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()

  const [overdueInv, assetNotifs, newLeads, overdueBills] = await Promise.all([
    supabase.from('acc_invoices').select('id, invoice_number, total_amount, paid_amount, pph23_amount, due_date, acc_clients(company_name)').eq('status', 'overdue').order('due_date', { ascending: true }).limit(10),
    supabase
      .from('acc_admin_notifications')
      .select(
        'id, asset_id, severity, title, body, tab, cycle_date, created_at, acc_notification_reads(user_id), acc_clients(company_name, pic_name, email, phone_primary), ' +
          'acc_digital_assets(expiry_date, acc_asset_renewals(status, acc_invoices(id, invoice_number, status, total_amount, paid_amount, pph23_amount, due_date, public_token)))',
      )
      .gte('created_at', new Date(today.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(60),
    supabase.from('consultation_leads').select('id, name, business_name, created_at').gte('created_at', startOfToday).order('created_at', { ascending: false }).limit(10),
    supabase.from('acc_vendor_bills').select('id, bill_number, amount, paid_amount, due_date, acc_vendors(vendor_name)').neq('status', 'paid').lte('due_date', today.toISOString()).order('due_date', { ascending: true }).limit(10),
  ])

  const items = []

  ;(overdueInv.data || []).forEach((i) =>
    items.push({
      id: `inv-${i.id}`,
      icon: FileWarning,
      severity: 'high',
      title: `Invoice ${i.invoice_number} jatuh tempo`,
      detail: `${i.acc_clients?.company_name || '-'} · Sisa ${idr(invoiceOutstanding(i))}`,
      tab: 'acc-invoices',
    }),
  )
  ;(overdueBills.data || []).forEach((b) =>
    items.push({
      id: `bill-${b.id}`,
      icon: ShieldAlert,
      severity: 'high',
      title: `Tagihan vendor ${b.bill_number} jatuh tempo`,
      detail: `${b.acc_vendors?.vendor_name || '-'} · Sisa ${idr(Number(b.amount) - Number(b.paid_amount))}`,
      tab: 'acc-vendor-bills',
    }),
  )
  // Hanya tahap terbaru per aset, dan disembunyikan bila aset sudah diperpanjang.
  const seenAssets = new Set()
  ;(assetNotifs.data || []).forEach((n) => {
    if (!n.acc_digital_assets || n.acc_digital_assets.expiry_date !== n.cycle_date) return
    const key = n.asset_id
    if (seenAssets.has(key)) return
    seenAssets.add(key)
    const inv = (n.acc_digital_assets.acc_asset_renewals || []).find((r) => r.status === 'invoiced')?.acc_invoices || null
    items.push({
      id: `n-${n.id}`,
      dbId: n.id,
      unread: (n.acc_notification_reads || []).length === 0,
      icon: Clock,
      severity: n.severity,
      title: n.title,
      detail: n.body,
      tab: n.tab,
      invoice: inv,
      client: n.acc_clients,
    })
  })
  ;(newLeads.data || []).forEach((l) =>
    items.push({
      id: `lead-${l.id}`,
      icon: UserPlus,
      severity: 'low',
      title: `Lead baru: ${l.name}`,
      detail: l.business_name || 'Tanpa nama perusahaan',
      tab: 'analytics',
    }),
  )

  return items
}

export default function NotificationCenter({ onNavigate, allowedTabIds }) {
  const [open, setOpen] = useState(false)
  const [allItems, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const boxRef = useRef(null)

  useEffect(() => {
    const onClickOutside = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  useEffect(() => {
    let cancelled = false
    const refresh = () => {
      setLoading(true)
      computeNotifications()
        .then((res) => {
          if (!cancelled) {
            setItems(res)
            setLoaded(true)
          }
        })
        .finally(() => !cancelled && setLoading(false))
    }
    refresh()
    const interval = setInterval(refresh, 5 * 60 * 1000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  // Notifikasi dari menu yang tidak boleh dibuka pengguna ini tidak ditampilkan.
  const items = allItems.filter((i) => allowedTabIds.includes(i.tab))
  // Notifikasi aset yang sudah dibaca tidak dihitung di angka lonceng.
  const counted = items.filter((i) => !i.dbId || i.unread)
  const highCount = counted.filter((i) => i.severity === 'high').length
  const unreadIds = items.filter((i) => i.dbId && i.unread).map((i) => i.dbId)

  const markRead = async (ids) => {
    if (!ids.length) return
    setItems((prev) => prev.map((i) => (ids.includes(i.dbId) ? { ...i, unread: false } : i)))
    const { data } = await supabase.auth.getSession()
    const uid = data?.session?.user?.id
    if (uid) await supabase.from('acc_notification_reads').upsert(ids.map((id) => ({ notification_id: id, user_id: uid })), { ignoreDuplicates: true })
  }

  const go = (item) => {
    if (item.dbId) markRead([item.dbId])
    onNavigate(item.tab)
    setOpen(false)
  }

  return (
    <div ref={boxRef} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className="btn-secondary relative !px-3 !py-2 text-xs" aria-label="Notifikasi">
        <Bell size={14} />
        {counted.length > 0 && (
          <span className={`absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold text-white ${highCount > 0 ? 'bg-red-500' : 'bg-cyan-500'}`}>
            {counted.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[22rem] rounded-2xl border border-white/10 bg-navy-950 p-3 shadow-2xl sm:w-[26rem]">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gold-soft">Notifikasi</h3>
            <div className="flex items-center gap-3">
              {loading && <span className="text-[10px] text-slate-500">Memuat...</span>}
              {unreadIds.length > 0 && (
                <button type="button" onClick={() => markRead(unreadIds)} className="text-[11px] text-cyan-royal hover:underline">
                  Tandai semua dibaca
                </button>
              )}
            </div>
          </div>
          <div className="max-h-[28rem] overflow-y-auto">
            {loaded && items.length === 0 && (
              <p className="flex items-center gap-2 px-2 py-4 text-xs text-slate-500">
                <AlertTriangle size={13} /> Tidak ada hal penting saat ini.
              </p>
            )}
            {items.map((item) => {
              const Icon = item.icon
              const faded = item.dbId && !item.unread
              return (
                <div key={item.id} className={`rounded-lg px-2 py-2.5 hover:bg-white/5 ${faded ? 'opacity-60' : ''}`}>
                  <button type="button" onClick={() => go(item)} className="flex w-full items-start gap-2.5 text-left">
                    <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${faded ? 'bg-slate-500' : SEVERITY_DOT[item.severity]}`} />
                    <Icon size={14} className="mt-0.5 shrink-0 text-slate-400" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-white">{item.title}</span>
                      <span className="block truncate text-[11px] text-slate-500">{item.detail}</span>
                    </span>
                  </button>
                  {item.dbId && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 pl-9">
                      {item.invoice ? (
                        <ShareInvoice compact invoice={item.invoice} client={item.client} onShared={() => markRead([item.dbId])} />
                      ) : (
                        <button type="button" onClick={() => go(item)} className="btn-secondary !px-2 !py-1 text-[11px]">
                          Buat invoice
                        </button>
                      )}
                      {item.unread && (
                        <button type="button" onClick={() => markRead([item.dbId])} className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white">
                          <Check size={11} /> Dibaca
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
