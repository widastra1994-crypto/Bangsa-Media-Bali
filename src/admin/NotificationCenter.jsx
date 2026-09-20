import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Bell, Clock, FileWarning, ShieldAlert, UserPlus } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

const idr = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0)

const SEVERITY_DOT = { high: 'bg-red-400', medium: 'bg-amber-400', low: 'bg-cyan-400' }

// Notifikasi dihitung langsung (live) dari tabel yang sudah ada setiap kali
// panel dibuka -- bukan tabel notifikasi tersendiri dengan status baca/belum,
// supaya tidak ada state tambahan yang perlu disinkronkan.
async function computeNotifications() {
  const today = new Date()
  const soon = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()

  const [overdueInv, expiringAssets, newLeads, overdueBills] = await Promise.all([
    supabase.from('acc_invoices').select('id, invoice_number, total_amount, paid_amount, due_date, acc_clients(company_name)').eq('status', 'overdue').order('due_date', { ascending: true }).limit(10),
    supabase.from('acc_digital_assets').select('id, domain_name, expiry_date, acc_projects(website_name)').lte('expiry_date', soon.toISOString()).gte('expiry_date', today.toISOString()).order('expiry_date', { ascending: true }).limit(10),
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
      detail: `${i.acc_clients?.company_name || '-'} · Sisa ${idr(Number(i.total_amount) - Number(i.paid_amount))}`,
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
  ;(expiringAssets.data || []).forEach((a) => {
    const days = Math.ceil((new Date(a.expiry_date) - today) / (1000 * 60 * 60 * 24))
    items.push({
      id: `asset-${a.id}`,
      icon: Clock,
      severity: days <= 3 ? 'high' : 'medium',
      title: `${a.domain_name || a.acc_projects?.website_name || 'Aset'} akan expired`,
      detail: `${days} hari lagi · ${new Date(a.expiry_date).toLocaleDateString('id-ID')}`,
      tab: 'acc-assets',
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

export default function NotificationCenter({ onNavigate }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
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

  const highCount = items.filter((i) => i.severity === 'high').length

  return (
    <div ref={boxRef} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className="btn-secondary relative !px-3 !py-2 text-xs" aria-label="Notifikasi">
        <Bell size={14} />
        {items.length > 0 && (
          <span className={`absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold text-white ${highCount > 0 ? 'bg-red-500' : 'bg-cyan-500'}`}>
            {items.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-white/10 bg-navy-950 p-3 shadow-2xl sm:w-96">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gold-soft">Notifikasi</h3>
            {loading && <span className="text-[10px] text-slate-500">Memuat...</span>}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {loaded && items.length === 0 && (
              <p className="flex items-center gap-2 px-2 py-4 text-xs text-slate-500">
                <AlertTriangle size={13} /> Tidak ada hal penting saat ini.
              </p>
            )}
            {items.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onNavigate(item.tab)
                    setOpen(false)
                  }}
                  className="flex w-full items-start gap-2.5 rounded-lg px-2 py-2.5 text-left hover:bg-white/5"
                >
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${SEVERITY_DOT[item.severity]}`} />
                  <Icon size={14} className="mt-0.5 shrink-0 text-slate-400" />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-white">{item.title}</span>
                    <span className="block truncate text-[11px] text-slate-500">{item.detail}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
