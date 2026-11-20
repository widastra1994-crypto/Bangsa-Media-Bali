import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { BadgeCheck, Briefcase, CalendarClock, CheckCircle2, Clock, Download, FileSignature, ListChecks, MessageCircle, Receipt, RefreshCw, ShieldCheck, Star } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import { useContent } from '../context/ContentContext'
import SignaturePad from '../components/SignaturePad'
import logoFull from '../assets/logo-full.png'

const downloadContractPdf = (...args) => import('../lib/pdfGenerator').then((m) => m.generateContractPdf(...args))

const idr = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0)
const formatDate = (d) => (d ? new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-')
const daysLeft = (d) => (d ? Math.round((new Date(`${d}T00:00:00`) - new Date(new Date().toDateString())) / 86400000) : null)
const PORTFOLIO_CATEGORY = { website: 'Website', system: 'ERP/POS', marketing: 'Ads', design: 'UI/UX' }

function Card({ children, className = '' }) {
  return <div className={`rounded-3xl bg-white p-5 shadow-card sm:p-7 ${className}`}>{children}</div>
}

// Halaman penawaran untuk klien (tanpa login): pilih paket -> setujui ->
// tanda tangan kontrak -> proyek & invoice dibuat otomatis.
export default function QuotationPublicPage() {
  const { token } = useParams()
  const { content } = useContent()
  const [state, setState] = useState({ loading: true, data: null })
  const [pkg, setPkg] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [revising, setRevising] = useState(false)
  const [note, setNote] = useState('')
  const [name, setName] = useState('')
  const [signature, setSignature] = useState(null)
  const [done, setDone] = useState('')

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !/^[0-9a-f-]{36}$/i.test(token || '')) return setState({ loading: false, data: null })
    const { data } = await supabase.rpc('quotation_public_open', { p_token: token })
    setState({ loading: false, data: data || null })
    if (data?.quote) {
      const q = data.quote
      setPkg((prev) => prev ?? q.accepted_package ?? Math.max(0, q.packages.findIndex((p) => p.recommended)))
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const brand = { name: content.brand?.name || 'Bangsa Media Bali', address: content.contact?.address, phone: content.contact?.phone, email: content.contact?.email }
  const waNumber = String(content.contact?.whatsapp || content.contact?.phone || '').replace(/\D/g, '').replace(/^0/, '62')

  if (state.loading) return <div className="flex min-h-screen items-center justify-center bg-site-gradient text-sm text-slate-600">Memuat penawaran...</div>
  if (!state.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-site-gradient px-5">
        <Card className="max-w-sm text-center">
          <p className="font-semibold text-ink">Penawaran tidak ditemukan</p>
          <p className="mt-2 text-sm text-slate-500">Link mungkin salah atau penawaran sudah dibatalkan. Silakan hubungi kami.</p>
        </Card>
      </div>
    )
  }

  const { quote: q, client, contract, invoice_token: invoiceToken } = state.data
  const chosen = q.packages[pkg] || q.packages[0]
  const price = Number(chosen?.price) || 0
  const open = ['sent', 'viewed', 'revision_requested'].includes(q.status) && !q.expired
  const left = daysLeft(q.valid_until)
  const portfolio = (content.portfolio?.items || []).filter((p) => !PORTFOLIO_CATEGORY[q.service_type] || p.category === PORTFOLIO_CATEGORY[q.service_type]).slice(0, 3)
  const testimonials = (content.testimonials?.items || []).slice(0, 2)
  const waLink = (text) => `https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`

  const accept = async () => {
    setBusy(true)
    setError('')
    const { error: err } = await supabase.rpc('quotation_public_accept', { p_token: token, p_package: pkg })
    setBusy(false)
    if (err) return setError(err.message)
    await load()
    setTimeout(() => document.getElementById('kontrak')?.scrollIntoView({ behavior: 'smooth' }), 100)
  }
  const requestRevision = async () => {
    if (!note.trim()) return setError('Tulis apa yang ingin diubah.')
    setBusy(true)
    setError('')
    const { error: err } = await supabase.rpc('quotation_public_request_revision', { p_token: token, p_note: note })
    setBusy(false)
    if (err) return setError(err.message)
    setRevising(false)
    setDone('Permintaan revisi terkirim. Tim kami akan mengirim penawaran yang sudah disesuaikan.')
    load()
  }
  const sign = async () => {
    if (name.trim().length < 3) return setError('Isi nama lengkap penanda tangan.')
    if (!signature) return setError('Bubuhkan tanda tangan di kotak.')
    setBusy(true)
    setError('')
    const { error: err } = await supabase.rpc('quotation_public_sign', { p_token: token, p_name: name, p_signature: signature })
    setBusy(false)
    if (err) return setError(err.message)
    load()
  }

  return (
    <div className="min-h-screen bg-site-gradient px-4 py-8 sm:py-10">
      <div className="mx-auto max-w-3xl space-y-4">
        <img src={logoFull} alt={brand.name} className="mx-auto h-10 w-auto" />

        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Penawaran {q.quote_number}</p>
              <h1 className="mt-1 text-2xl font-bold text-ink">{q.title}</h1>
              <p className="mt-1 text-sm text-slate-500">
                Untuk <b className="text-ink">{client.company_name}</b>
                {client.pic_name ? ` · ${client.pic_name}` : ''} · {formatDate(q.created_at)}
              </p>
            </div>
            {open && left !== null && (
              <span className="flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                <Clock size={13} /> {left <= 0 ? 'Berlaku sampai hari ini' : `Berlaku ${left} hari lagi`}
              </span>
            )}
            {q.expired && <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">Masa berlaku habis</span>}
          </div>
          {(q.needs || q.solution) && (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {q.needs && (
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Kebutuhan Anda</p>
                  <p className="mt-1 text-sm text-slate-700">{q.needs}</p>
                </div>
              )}
              {q.solution && (
                <div className="rounded-2xl bg-sky-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Solusi kami</p>
                  <p className="mt-1 text-sm text-slate-700">{q.solution}</p>
                </div>
              )}
            </div>
          )}
        </Card>

        <Card>
          <p className="text-sm font-semibold text-ink">{q.packages.length > 1 ? 'Pilih paket' : 'Paket'}</p>
          <div className={`mt-3 grid gap-3 ${q.packages.length > 1 ? 'sm:grid-cols-2 md:grid-cols-3' : ''}`}>
            {q.packages.map((p, i) => {
              const active = i === pkg
              return (
                <button
                  key={i}
                  type="button"
                  disabled={!open}
                  onClick={() => setPkg(i)}
                  className={`relative rounded-2xl border p-4 text-left transition ${active ? 'border-2 border-ebtblue bg-sky-50/60' : 'border-slate-200 hover:border-sky-300'}`}
                >
                  {p.recommended && (
                    <span className="absolute -top-2.5 right-3 flex items-center gap-1 rounded-full bg-ebtblue px-2 py-0.5 text-[10px] font-bold text-white">
                      <Star size={10} fill="currentColor" /> Paling dipilih
                    </span>
                  )}
                  <p className="font-semibold text-ink">{p.name}</p>
                  <p className="mt-1 text-xl font-bold text-ink">{idr(p.price)}</p>
                  <ul className="mt-3 space-y-1.5 text-xs text-slate-600">
                    {(p.features || []).map((f, j) => (
                      <li key={j} className="flex gap-1.5">
                        <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-500" /> {f}
                      </li>
                    ))}
                  </ul>
                </button>
              )
            })}
          </div>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          {q.timeline?.length > 0 && (
            <Card>
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                <CalendarClock size={16} className="text-ebtblue" /> Timeline pengerjaan
              </p>
              <ol className="mt-3 space-y-2">
                {q.timeline.map((t, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-slate-700">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-ebtblue">{i + 1}</span>
                    {t}
                  </li>
                ))}
              </ol>
            </Card>
          )}
          {q.payment_terms?.length > 0 && (
            <Card>
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Receipt size={16} className="text-ebtblue" /> Termin pembayaran
              </p>
              <div className="mt-3 space-y-2 text-sm">
                {q.payment_terms.map((t, i) => (
                  <p key={i} className="flex justify-between gap-3 text-slate-700">
                    <span>
                      {t.label} ({t.percent}%)
                    </span>
                    <b className="text-ink">{idr((price * Number(t.percent)) / 100)}</b>
                  </p>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-500">Pembayaran via transfer bank atau QRIS. Invoice dikirim otomatis.</p>
            </Card>
          )}
        </div>

        <Card className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-700">
          {q.guarantee && (
            <span className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-500" /> Garansi {q.guarantee}
            </span>
          )}
          {q.revisions !== null && q.revisions !== undefined && (
            <span className="flex items-center gap-2">
              <RefreshCw size={16} className="text-emerald-500" /> {q.revisions}x revisi
            </span>
          )}
          <span className="flex items-center gap-2">
            <BadgeCheck size={16} className="text-emerald-500" /> Kontrak resmi & invoice transparan
          </span>
        </Card>

        {(portfolio.length > 0 || testimonials.length > 0) && (
          <Card>
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Briefcase size={16} className="text-ebtblue" /> Hasil kerja & kata klien kami
            </p>
            {portfolio.length > 0 && (
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {portfolio.map((p) => (
                  <a key={p.id} href={`/portofolio/${p.slug}`} target="_blank" rel="noreferrer" className="rounded-2xl border border-slate-200 p-3 hover:border-sky-300">
                    <p className="text-sm font-semibold text-ink">{p.title}</p>
                    <p className="mt-1 line-clamp-3 text-xs text-slate-500">{p.description}</p>
                  </a>
                ))}
              </div>
            )}
            {testimonials.map((t) => (
              <blockquote key={t.id} className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                “{t.text}”
                <footer className="mt-1 text-xs text-slate-500">
                  {t.name}
                  {t.company ? `, ${t.company}` : ''}
                </footer>
              </blockquote>
            ))}
          </Card>
        )}

        {done && <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{done}</p>}

        {open && (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs text-slate-500">Paket dipilih: {chosen?.name}</p>
                <p className="text-2xl font-bold text-ink">{idr(price)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setRevising((v) => !v)} className="btn-secondary !py-2.5 text-sm">
                  <MessageCircle size={15} /> Minta revisi
                </button>
                <button type="button" onClick={accept} disabled={busy} className="btn-primary !py-2.5 text-sm disabled:opacity-60">
                  <CheckCircle2 size={15} /> {busy ? 'Memproses...' : 'Setujui penawaran'}
                </button>
              </div>
            </div>
            {revising && (
              <div className="mt-4">
                <textarea
                  rows={3}
                  className="input-field"
                  placeholder="Tuliskan apa yang ingin diubah, mis. tambah fitur bahasa Inggris atau sesuaikan budget."
                  value={note}
                  onChange={(e) => {
                    setNote(e.target.value)
                    setError('')
                  }}
                />
                <div className="mt-2 flex flex-wrap justify-end gap-2">
                  {waNumber && (
                    <a href={waLink(`Halo, saya ingin diskusi penawaran ${q.quote_number}.`)} target="_blank" rel="noreferrer" className="btn-secondary !py-2 text-xs">
                      Diskusi via WhatsApp
                    </a>
                  )}
                  <button type="button" onClick={requestRevision} disabled={busy} className="btn-primary !py-2 text-xs">
                    Kirim permintaan revisi
                  </button>
                </div>
              </div>
            )}
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          </Card>
        )}

        {q.expired && (
          <Card className="text-center">
            <p className="text-sm text-slate-600">Masa berlaku penawaran ini sudah habis.</p>
            {waNumber && (
              <a href={waLink(`Halo, penawaran ${q.quote_number} sudah habis masa berlakunya. Boleh minta penawaran baru?`)} target="_blank" rel="noreferrer" className="btn-primary mt-3 !py-2.5 text-sm">
                Minta penawaran baru
              </a>
            )}
          </Card>
        )}

        {contract && (
          <Card className="border-2 border-ebtblue/40">
            <div id="kontrak" className="flex items-center gap-2">
              <FileSignature size={18} className="text-ebtblue" />
              <p className="text-base font-semibold text-ink">{contract.title}</p>
            </div>
            <pre className="mt-4 max-h-[28rem] overflow-y-auto whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 font-sans text-sm leading-relaxed text-slate-700">{contract.content}</pre>

            {contract.status !== 'signed' ? (
              <div className="mt-5">
                <p className="text-sm font-semibold text-ink">Tanda tangan elektronik</p>
                <input
                  className="input-field mt-2"
                  placeholder="Nama lengkap penanda tangan"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    setError('')
                  }}
                />
                <div className="mt-3">
                  <SignaturePad onChange={setSignature} />
                </div>
                {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                <button type="button" onClick={sign} disabled={busy} className="btn-primary mt-4 w-full !py-3 text-sm disabled:opacity-60">
                  <FileSignature size={16} /> {busy ? 'Memproses...' : 'Tanda tangani kontrak'}
                </button>
                <p className="mt-2 text-center text-xs text-slate-500">Dengan menandatangani, Anda menyetujui seluruh isi perjanjian di atas.</p>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl bg-emerald-50 p-4">
                <p className="flex items-center gap-2 font-semibold text-emerald-700">
                  <CheckCircle2 size={18} /> Kontrak ditandatangani oleh {contract.signed_by_name} pada {new Date(contract.signed_at).toLocaleString('id-ID')}
                </p>
                <p className="mt-1 text-sm text-emerald-700">
                  Terima kasih! Proyek Anda sudah terdaftar di sistem kami. Silakan lakukan pembayaran termin pertama agar pekerjaan bisa segera dimulai.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => downloadContractPdf(contract, client, brand)} className="btn-secondary !py-2 text-sm">
                    <Download size={15} /> Unduh PDF kontrak
                  </button>
                  {invoiceToken && (
                    <a href={`/invoice/${invoiceToken}`} className="btn-primary !py-2 text-sm">
                      <ListChecks size={15} /> Lihat invoice & cara bayar
                    </a>
                  )}
                </div>
              </div>
            )}
          </Card>
        )}

        <p className="pt-2 text-center text-xs text-slate-500">
          {brand.name} · {brand.email} · {brand.phone}
        </p>
      </div>
    </div>
  )
}
