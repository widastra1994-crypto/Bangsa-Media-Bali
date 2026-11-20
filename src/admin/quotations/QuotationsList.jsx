import { useCallback, useEffect, useMemo, useState } from 'react'
import { Ban, Check, ExternalLink, FileDown, Link2, Mail, MessageCircle, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { sendFinanceEmail } from '../../lib/financeEmail'
import { useContent } from '../../context/ContentContext'
import { ErrorNote, PageHeader, StatCard } from '../ledger/LedgerUI'
import { useUserRole } from '../useUserRole'
import { getReminderSettings, waPhone } from '../assets/assetUtils'
import QuotationForm from './QuotationForm'
import logoFull from '../../assets/logo-full.png'
import { STATUS, idr, quoteUrl, serviceLabel, todayLocal } from './quoteTemplates'

const formatDate = (d) => (d ? new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-')
const OPEN = ['sent', 'viewed', 'revision_requested']
const EDITABLE = ['draft', 'sent', 'viewed', 'revision_requested']

const priceRange = (q) => {
  if (q.accepted_package !== null && q.accepted_package !== undefined && q.packages?.[q.accepted_package]) return idr(q.packages[q.accepted_package].price)
  const prices = (q.packages || []).map((p) => Number(p.price) || 0)
  if (!prices.length) return '-'
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  return min === max ? idr(min) : `${idr(min)} – ${idr(max)}`
}

function ShareButtons({ quote, onShared }) {
  const { content } = useContent()
  const [notice, setNotice] = useState('')
  const client = quote.acc_clients

  const markSent = async (channel) => {
    if (quote.status === 'draft') await supabase.from('acc_quotations').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', quote.id)
    setNotice(channel)
    setTimeout(() => setNotice(''), 4000)
    onShared()
  }
  const link = async () => quoteUrl((await getReminderSettings()).site_url, quote.public_token)

  const shareWa = async () => {
    const win = window.open('', '_blank')
    const url = await link()
    const text =
      `Halo ${client?.pic_name || client?.company_name || 'Bapak/Ibu'},\n\n` +
      `Terima kasih atas kesempatannya. Berikut penawaran *${quote.title}* dari ${content.brand?.name || 'Bangsa Media Bali'} (${quote.quote_number}).\n\n` +
      `Di halaman ini Anda bisa melihat pilihan paket, timeline, dan langsung menyetujui secara online:\n${url}\n\n` +
      (quote.valid_until ? `Penawaran berlaku sampai ${formatDate(quote.valid_until)}.\n\n` : '') +
      'Silakan balas pesan ini bila ada pertanyaan. Terima kasih.'
    const wa = `https://wa.me/${waPhone(client?.phone_primary)}?text=${encodeURIComponent(text)}`
    if (win) win.location.href = wa
    else window.location.href = wa
    markSent('WhatsApp dibuka, tinggal tekan kirim.')
  }
  const shareEmail = async () => {
    if (!client?.email) return setNotice('Email klien belum diisi.')
    const res = await sendFinanceEmail({
      type: 'quotation',
      to: client.email,
      clientName: client.company_name,
      brandName: content.brand?.name,
      docNumber: quote.quote_number,
      amount: Math.min(...quote.packages.map((p) => Number(p.price) || 0)),
      items: quote.packages.map((p) => ({ label: `Paket ${p.name}${p.recommended ? ' (rekomendasi)' : ''}`, amount: p.price })),
      notes: quote.valid_until ? `Penawaran berlaku sampai ${formatDate(quote.valid_until)}.` : undefined,
      link: await link(),
      linkLabel: 'Lihat & Setujui Penawaran',
    })
    if (!res.ok) return setNotice(`Gagal kirim email: ${res.error || 'periksa konfigurasi email'}`)
    markSent(`Email terkirim ke ${client.email}.`)
  }
  const copy = async () => {
    await navigator.clipboard.writeText(await link())
    markSent('Link disalin.')
  }

  const btn = 'btn-secondary !h-8 !w-8 !p-0'
  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      <button type="button" onClick={shareWa} className={btn} title="Kirim lewat WhatsApp" aria-label="Kirim lewat WhatsApp">
        <MessageCircle size={14} className="text-emerald-500" />
      </button>
      <button type="button" onClick={shareEmail} className={btn} title="Kirim email" aria-label="Kirim email">
        <Mail size={14} />
      </button>
      <button type="button" onClick={copy} className={btn} title="Salin link" aria-label="Salin link">
        <Link2 size={14} />
      </button>
      {notice && (
        <span className="flex w-full items-center justify-end gap-1 text-[11px] text-cyan-300">
          <Check size={11} /> {notice}
        </span>
      )}
    </div>
  )
}

export default function QuotationsList() {
  const { role } = useUserRole()
  const canEdit = ['owner', 'admin', 'staff'].includes(role)
  const canManage = ['owner', 'admin'].includes(role)
  const [rows, setRows] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState(null)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const { content } = useContent()
  const downloadPdf = async (r) => {
    const { generateProposalPdf } = await import('../../lib/pdfGenerator')
    const brand = {
      name: content.brand?.name || 'Bangsa Media Bali',
      subBrand: content.brand?.subBrand,
      address: content.contact?.address,
      phone: content.contact?.phone,
      email: content.contact?.email,
      website: window.location.host,
      logoUrl: logoFull,
    }
    await generateProposalPdf(r, r.acc_clients || {}, brand)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const [a, c] = await Promise.all([
      supabase
        .from('acc_quotations')
        .select('*, acc_clients(company_name, pic_name, email, phone_primary), acc_invoices(invoice_number), acc_projects(website_name)')
        .order('created_at', { ascending: false }),
      supabase.from('acc_clients').select('id, company_name, pic_name, email, phone_primary').order('company_name'),
    ])
    if (a.error || c.error) setError((a.error || c.error).message)
    else {
      setError('')
      setRows(a.data || [])
      setClients(c.data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const flash = (m) => {
    setNotice(m)
    setTimeout(() => setNotice(''), 5000)
  }

  const today = todayLocal()
  const isExpired = (r) => OPEN.includes(r.status) && r.valid_until && r.valid_until < today

  const stats = useMemo(() => {
    const open = rows.filter((r) => OPEN.includes(r.status) && !isExpired(r))
    const won = rows.filter((r) => r.status === 'signed' || r.status === 'accepted')
    const decided = rows.filter((r) => ['signed', 'accepted', 'rejected'].includes(r.status) || isExpired(r))
    const wonValue = won.reduce((s, r) => s + (Number(r.packages?.[r.accepted_package]?.price) || 0), 0)
    return { open: open.length, won: won.length, wonValue, rate: decided.length ? Math.round((won.length / decided.length) * 100) : null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows])

  const filtered = rows.filter((r) => {
    if (status === 'expired' ? !isExpired(r) : status && r.status !== status) return false
    const s = q.trim().toLowerCase()
    return !s || [r.quote_number, r.title, r.acc_clients?.company_name].some((v) => v?.toLowerCase().includes(s))
  })

  const cancel = async (r) => {
    if (!window.confirm(`Batalkan penawaran ${r.quote_number}? Link penawaran tidak bisa dibuka klien lagi.`)) return
    const { error: err } = await supabase.from('acc_quotations').update({ status: 'cancelled' }).eq('id', r.id)
    if (err) return setError(err.message)
    flash('Penawaran dibatalkan.')
    load()
  }
  const remove = async (r) => {
    if (!window.confirm(`Hapus draf ${r.quote_number}? Tindakan ini tidak bisa dibatalkan.`)) return
    const { error: err } = await supabase.from('acc_quotations').delete().eq('id', r.id)
    if (err) return setError(err.message)
    flash('Draf dihapus.')
    load()
  }
  const preview = async (r) => window.open(quoteUrl((await getReminderSettings()).site_url, r.public_token), '_blank', 'noopener')

  return (
    <div>
      <PageHeader
        title="Penawaran"
        description="Buat penawaran dengan pilihan paket, bagikan ke klien, dan saat disetujui kontrak, proyek, serta invoice dibuat otomatis."
      >
        {canEdit && (
          <button type="button" onClick={() => setEditing({})} className="btn-primary !px-3 !py-2 text-xs">
            <Plus size={14} /> Buat Penawaran
          </button>
        )}
      </PageHeader>
      <ErrorNote message={error} />
      {notice && <p className="mt-3 text-xs text-cyan-300">{notice}</p>}

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Menunggu keputusan klien" value={stats.open} />
        <StatCard label="Disetujui / kontrak" value={stats.won} tone="good" />
        <StatCard label="Nilai yang disetujui" value={idr(stats.wonValue)} tone="good" />
        <StatCard label="Tingkat persetujuan" value={stats.rate === null ? '-' : `${stats.rate}%`} hint="Disetujui ÷ penawaran yang sudah diputuskan" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className="input-field !py-1.5 !pl-8 text-xs" placeholder="Cari nomor, judul, atau klien..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input-field !w-auto !py-1.5 text-xs" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Semua status</option>
          {Object.entries(STATUS).map(([v, [l]]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
          <option value="expired">Kedaluwarsa</option>
        </select>
      </div>

      <div className="mt-3 overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[820px] text-left text-xs">
          <thead className="bg-white/5 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2.5">Penawaran</th>
              <th className="px-3 py-2.5">Klien</th>
              <th className="px-3 py-2.5 text-right">Nilai</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="w-44 px-3 py-2.5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  Memuat...
                </td>
              </tr>
            )}
            {!loading &&
              filtered.map((r) => {
                const [label, cls] = isExpired(r) ? ['Kedaluwarsa', 'border-red-400/30 bg-red-500/15 text-red-300'] : STATUS[r.status] || [r.status, '']
                return (
                  <tr key={r.id} className="border-t border-white/5 align-top text-slate-300">
                    <td className="px-3 py-3">
                      <p className="font-semibold text-white">{r.title}</p>
                      <p className="text-[11px] text-slate-500">
                        {r.quote_number} · {serviceLabel(r.service_type)} · dibuat {formatDate(r.created_at)}
                      </p>
                    </td>
                    <td className="px-3 py-3">{r.acc_clients?.company_name || '-'}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right">
                      <p className="font-semibold text-white">{priceRange(r)}</p>
                      {r.accepted_package !== null && r.packages?.[r.accepted_package] && (
                        <p className="text-[11px] text-emerald-400">Paket {r.packages[r.accepted_package].name}</p>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cls}`}>{label}</span>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {r.viewed_at && `Dibuka ${formatDate(r.viewed_at)}`}
                        {r.valid_until && OPEN.includes(r.status) && ` · berlaku s/d ${formatDate(r.valid_until)}`}
                      </p>
                      {r.status === 'revision_requested' && r.revision_note && (
                        <p className="mt-1 max-w-xs rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-300">“{r.revision_note}”</p>
                      )}
                      {r.status === 'signed' && (
                        <p className="mt-1 text-[11px] text-emerald-400">
                          Proyek dibuat{r.acc_invoices?.invoice_number ? ` · invoice ${r.acc_invoices.invoice_number}` : ''}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        {canEdit && EDITABLE.includes(r.status) && <ShareButtons quote={r} onShared={load} />}
                        {r.status !== 'draft' && r.status !== 'cancelled' && (
                          <button type="button" onClick={() => preview(r)} className="btn-secondary !h-8 !w-8 !p-0" title="Lihat halaman penawaran" aria-label="Lihat halaman penawaran">
                            <ExternalLink size={14} />
                          </button>
                        )}
                        <button type="button" onClick={() => downloadPdf(r)} className="btn-secondary !h-8 !w-8 !p-0" title="Unduh PDF proposal" aria-label="Unduh PDF proposal">
                          <FileDown size={14} />
                        </button>
                        {canEdit && EDITABLE.includes(r.status) && (
                          <button type="button" onClick={() => setEditing(r)} className="btn-secondary !h-8 !w-8 !p-0" title="Edit penawaran" aria-label="Edit penawaran">
                            <Pencil size={14} />
                          </button>
                        )}
                        {canEdit && OPEN.includes(r.status) && (
                          <button type="button" onClick={() => cancel(r)} className="btn-secondary !h-8 !w-8 !p-0" title="Batalkan penawaran" aria-label="Batalkan penawaran">
                            <Ban size={14} />
                          </button>
                        )}
                        {canManage && r.status === 'draft' && (
                          <button type="button" onClick={() => remove(r)} className="btn-secondary !h-8 !w-8 !p-0 text-red-500" title="Hapus draf" aria-label="Hapus draf">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  {rows.length ? 'Tidak ada penawaran yang cocok.' : 'Belum ada penawaran. Klik "Buat Penawaran".'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        Alur: Draf → bagikan (WhatsApp/Email/Link) → klien membuka → klien memilih paket & menyetujui → klien menandatangani kontrak → proyek & invoice dibuat
        otomatis.
      </p>

      {editing && (
        <QuotationForm
          quote={editing.id ? editing : null}
          clients={clients}
          onClose={() => setEditing(null)}
          onSaved={(m) => {
            setEditing(null)
            flash(m)
            load()
          }}
        />
      )}
    </div>
  )
}
