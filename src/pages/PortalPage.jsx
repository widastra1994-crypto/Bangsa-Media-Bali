import { useEffect, useState } from 'react'
import { AlertTriangle, Calendar, CheckCircle2, Download, FileSignature, FileText, Globe, LogOut, Mail, Send } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import { useContent } from '../context/ContentContext'
import MascotIcon from '../components/MascotIcon'
import SignaturePad from '../components/SignaturePad'
import ProjectProgress from '../components/ProjectProgress'

// Lazy-load jsPDF (lumayan besar) hanya saat tombol unduh benar-benar diklik,
// supaya pengunjung website biasa (yang tidak pernah buka /portal) tidak ikut
// memuatnya di beranda.
const downloadInvoicePdf = (...args) => import('../lib/pdfGenerator').then((m) => m.generateInvoicePdf(...args))
const downloadReceiptPdf = (...args) => import('../lib/pdfGenerator').then((m) => m.generateReceiptPdf(...args))
const downloadContractPdf = (...args) => import('../lib/pdfGenerator').then((m) => m.generateContractPdf(...args))

const idr = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0)

const INVOICE_STATUS_LABEL = { draft: 'Draft', sent: 'Menunggu Pembayaran', partial: 'Sebagian Dibayar', paid: 'Lunas', overdue: 'Jatuh Tempo', cancelled: 'Batal' }
const INVOICE_STATUS_COLOR = {
  draft: 'bg-slate-500/20 text-slate-300 border-slate-400/30',
  sent: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/30',
  partial: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
  paid: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
  overdue: 'bg-red-500/20 text-red-300 border-red-400/30',
  cancelled: 'bg-slate-500/20 text-slate-400 border-slate-400/30',
}
const PROJECT_STATUS_LABEL = { planning: 'Perencanaan', in_progress: 'Sedang Dikerjakan', completed: 'Selesai', cancelled: 'Batal' }
const ASSET_STATUS_LABEL = { active: 'Aktif', pending_renewal: 'Menunggu Perpanjangan', grace_period: 'Masa Tenggang', expired: 'Kedaluwarsa', terminated: 'Dihentikan' }

function LoginForm() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/portal` },
    })
    setLoading(false)
    if (err) setError(err.message)
    else setSent(true)
  }

  if (sent) {
    return (
      <div className="glass-panel w-full max-w-sm rounded-3xl p-8 text-center shadow-blue-glow">
        <Mail className="mx-auto text-cyan-royal" size={40} />
        <h1 className="mt-4 text-lg font-bold text-white">Cek Email Anda</h1>
        <p className="mt-2 text-sm text-slate-400">Kami sudah kirim tautan login ke <strong>{email}</strong>. Klik tautan itu untuk masuk ke Portal Klien.</p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="glass-panel w-full max-w-sm rounded-3xl p-8 shadow-blue-glow">
      <div className="flex flex-col items-center text-center">
        <MascotIcon variant="assistant" size={64} />
        <h1 className="mt-4 text-xl font-bold text-white">Portal Klien</h1>
        <p className="mt-1 text-sm text-slate-400">Masuk dengan email untuk melihat status proyek & invoice Anda.</p>
      </div>
      <div className="mt-6">
        <label className="label-field">Email Terdaftar</label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input-field pl-9" placeholder="email@bisnis-anda.com" />
        </div>
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      </div>
      <button type="submit" disabled={loading} className="btn-primary mt-6 w-full disabled:opacity-60">
        <Send size={15} /> {loading ? 'Mengirim...' : 'Kirim Tautan Login'}
      </button>
      <a href="/" className="mt-4 block text-center text-xs text-slate-500 hover:text-gold-soft">
        Kembali ke Beranda
      </a>
    </form>
  )
}

function SignContractCard({ contract, client, brand, onSigned }) {
  const [signature, setSignature] = useState(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(false)

  const submit = async () => {
    if (!signature || !name.trim()) {
      setError('Tanda tangan dan nama lengkap wajib diisi.')
      return
    }
    setBusy(true)
    setError('')
    const { error: err } = await supabase
      .from('acc_contracts')
      .update({ status: 'signed', signature_data: signature, signed_by_name: name.trim(), signed_at: new Date().toISOString() })
      .eq('id', contract.id)
    setBusy(false)
    if (err) setError(err.message)
    else onSigned()
  }

  return (
    <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-bold text-white">
          <FileSignature size={15} className="text-amber-300" /> {contract.title}
        </p>
        <button type="button" onClick={() => setExpanded((v) => !v)} className="text-xs font-semibold text-amber-300 hover:text-amber-200">
          {expanded ? 'Tutup' : 'Baca & Tanda Tangani'}
        </button>
      </div>
      {expanded && (
        <div className="mt-3 space-y-3">
          <div className="max-h-56 overflow-y-auto rounded-xl border border-white/10 bg-navy-950/60 p-3 text-xs leading-relaxed text-slate-300">
            {contract.content.split('\n').map((line, i) => (
              <p key={i} className="mb-2">
                {line}
              </p>
            ))}
          </div>
          <input
            type="text"
            placeholder="Ketik nama lengkap Anda sebagai konfirmasi"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-field"
          />
          <SignaturePad onChange={setSignature} />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button type="button" disabled={busy} onClick={submit} className="btn-primary w-full !py-2.5 text-xs disabled:opacity-60">
            {busy ? 'Menyimpan...' : 'Setujui & Tanda Tangani Kontrak'}
          </button>
        </div>
      )}
    </div>
  )
}

function Dashboard({ session }) {
  const { content } = useContent()
  const [qrisUrl, setQrisUrl] = useState('')
  const brand = { name: content.brand?.name, address: content.contact?.address, phone: content.contact?.phone, email: content.contact?.email, qrisImageUrl: qrisUrl }
  const [client, setClient] = useState(null)
  const [projects, setProjects] = useState([])
  const [invoices, setInvoices] = useState([])
  const [assets, setAssets] = useState([])
  const [contracts, setContracts] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    supabase.rpc('get_public_qris_url').then(({ data }) => setQrisUrl(data || ''))
  }, [])

  useEffect(() => {
    const load = async () => {
      await supabase.rpc('claim_client_record')
      const { data: clientRow } = await supabase.from('acc_clients').select('*').eq('client_user_id', session.user.id).maybeSingle()
      if (!clientRow) {
        setNotFound(true)
        setLoading(false)
        return
      }
      setClient(clientRow)
      const [proj, inv] = await Promise.all([
        supabase.from('acc_projects').select('*').eq('client_id', clientRow.id).order('created_at', { ascending: false }),
        supabase.from('acc_invoices').select('*, acc_payments(*)').eq('client_id', clientRow.id).order('created_at', { ascending: false }),
      ])
      setProjects(proj.data || [])
      setInvoices(inv.data || [])
      const projectIds = (proj.data || []).map((p) => p.id)
      if (projectIds.length > 0) {
        const { data: assetRows } = await supabase.from('acc_digital_assets').select('*').in('project_id', projectIds)
        setAssets(assetRows || [])
      }
      const { data: contractRows } = await supabase.from('acc_contracts').select('*').eq('client_id', clientRow.id).order('created_at', { ascending: false })
      setContracts(contractRows || [])
      setLoading(false)
    }
    load()
  }, [session])

  const reloadContracts = async () => {
    if (!client) return
    const { data } = await supabase.from('acc_contracts').select('*').eq('client_id', client.id).order('created_at', { ascending: false })
    setContracts(data || [])
  }

  const logout = () => supabase.auth.signOut()

  if (loading) {
    return <p className="text-sm text-slate-400">Memuat data Anda...</p>
  }

  if (notFound) {
    return (
      <div className="glass-panel w-full max-w-md rounded-3xl p-8 text-center">
        <AlertTriangle className="mx-auto text-amber-400" size={40} />
        <h1 className="mt-4 text-lg font-bold text-white">Data Belum Ditemukan</h1>
        <p className="mt-2 text-sm text-slate-400">
          Email <strong>{session.user.email}</strong> belum terdaftar sebagai klien kami. Hubungi tim Bangsa Media Bali jika ini keliru.
        </p>
        <button type="button" onClick={logout} className="btn-secondary mt-6 !px-4 !py-2 text-xs">
          <LogOut size={14} /> Keluar
        </button>
      </div>
    )
  }

  return (
    <div className="w-full max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-5">
        <div>
          <p className="text-xs text-slate-400">Selamat datang,</p>
          <h1 className="text-lg font-bold text-white">{client.company_name}</h1>
        </div>
        <button type="button" onClick={logout} className="btn-secondary !px-3 !py-2 text-xs">
          <LogOut size={14} /> Keluar
        </button>
      </div>

      {client.referral_code && (
        <div className="mt-4 rounded-2xl border border-gold/30 bg-gold/10 p-4">
          <p className="text-xs text-gold-soft">
            Kode Referral Anda: <strong>{client.referral_code}</strong> -- bagikan ke rekan Anda untuk dapat potongan biaya perpanjangan domain/hosting tahun depan.
          </p>
        </div>
      )}

      {contracts.filter((c) => c.status === 'sent').length > 0 && (
        <div className="mt-4 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-300">Kontrak Menunggu Tanda Tangan</h2>
          {contracts
            .filter((c) => c.status === 'sent')
            .map((c) => (
              <SignContractCard key={c.id} contract={c} client={client} brand={brand} onSigned={reloadContracts} />
            ))}
        </div>
      )}

      {contracts.filter((c) => c.status === 'signed').length > 0 && (
        <div className="mt-4 space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Kontrak Tersimpan</h2>
          {contracts
            .filter((c) => c.status === 'signed')
            .map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs">
                <span className="text-slate-300">{c.title}</span>
                <button type="button" onClick={() => downloadContractPdf(c, client, brand)} className="flex items-center gap-1.5 text-cyan-royal hover:text-cyan-300">
                  <Download size={12} /> Unduh PDF
                </button>
              </div>
            ))}
        </div>
      )}

      <h2 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-gold-soft">Proyek Saya</h2>
      <div className="space-y-3">
        {projects.length === 0 && <p className="text-sm text-slate-500">Belum ada proyek tercatat.</p>}
        {projects.map((p) => {
          const asset = assets.find((a) => a.project_id === p.id)
          return (
            <div key={p.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-white">{p.website_name || 'Proyek'}</p>
                <span className="rounded-full border border-cyan-400/30 bg-cyan-500/20 px-2.5 py-1 text-[11px] font-bold text-cyan-300">
                  {PROJECT_STATUS_LABEL[p.status]}
                </span>
              </div>
              {asset && (
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                  {asset.website_url && (
                    <a href={asset.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-cyan-royal">
                      <Globe size={12} /> Kunjungi Website
                    </a>
                  )}
                  {asset.expiry_date && (
                    <span className="flex items-center gap-1">
                      <Calendar size={12} /> Masa Aktif s/d {asset.expiry_date} ({ASSET_STATUS_LABEL[asset.status]})
                    </span>
                  )}
                </div>
              )}
              <ProjectProgress projectId={p.id} />
            </div>
          )
        })}
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-gold-soft">Invoice & Riwayat Pembayaran</h2>
      <div className="space-y-3">
        {invoices.length === 0 && <p className="text-sm text-slate-500">Belum ada invoice.</p>}
        {invoices.map((inv) => (
          <div key={inv.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-sm font-bold text-white">
                <FileText size={14} /> {inv.invoice_number}
              </p>
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${INVOICE_STATUS_COLOR[inv.status]}`}>{INVOICE_STATUS_LABEL[inv.status]}</span>
            </div>
            <button
              type="button"
              onClick={() => downloadInvoicePdf(inv, client, brand)}
              className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-cyan-royal hover:text-cyan-300"
            >
              <Download size={13} /> Unduh PDF Invoice
            </button>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
              <div>
                <p className="text-slate-500">Total</p>
                <p className="font-semibold text-white">{idr(inv.total_amount)}</p>
              </div>
              <div>
                <p className="text-slate-500">Terbayar</p>
                <p className="font-semibold text-emerald-400">{idr(inv.paid_amount)}</p>
              </div>
              <div>
                <p className="text-slate-500">Sisa</p>
                <p className="font-semibold text-gold-soft">{idr(Number(inv.total_amount) - Number(inv.paid_amount))}</p>
              </div>
            </div>
            {brand?.qrisImageUrl && Number(inv.total_amount) - Number(inv.paid_amount) > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                <img src={brand.qrisImageUrl} alt="QRIS" className="h-20 w-20 rounded-lg border border-white/10 bg-white object-contain p-1" />
                <p className="max-w-[220px] text-[11px] text-slate-400">
                  Scan QRIS ini untuk membayar, lalu masukkan nominal <span className="font-semibold text-gold-soft">{idr(Number(inv.total_amount) - Number(inv.paid_amount))}</span> secara manual.
                </p>
              </div>
            )}
            {inv.acc_payments?.length > 0 && (
              <div className="mt-3 border-t border-white/10 pt-3">
                <p className="mb-1.5 text-[11px] font-semibold text-slate-400">Riwayat Pembayaran</p>
                {inv.acc_payments.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 size={11} className="text-emerald-400" /> {p.payment_date} &bull; {idr(p.amount_paid)} &bull; {p.receipt_number}
                    </span>
                    <button type="button" onClick={() => downloadReceiptPdf(p, inv, client, brand)} className="flex items-center gap-1 text-cyan-royal hover:text-cyan-300">
                      <Download size={11} /> Unduh Kuitansi
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function PortalPage() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setSession(null)
      return
    }
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => listener.subscription.unsubscribe()
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center bg-nusatech-gradient px-5 py-12">
      {!isSupabaseConfigured ? (
        <p className="text-sm text-slate-400">Portal klien belum tersedia.</p>
      ) : session === undefined ? (
        <p className="text-sm text-slate-400">Memuat...</p>
      ) : session ? (
        <Dashboard session={session} />
      ) : (
        <LoginForm />
      )}
    </div>
  )
}
