import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Lock } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import MascotIcon from '../components/MascotIcon'

const MIN_LENGTH = 8
const LINK_TYPES = ['invite', 'recovery']

function readTokenFromUrl() {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const tokenHash = params.get('token_hash')
  const type = params.get('type')
  return tokenHash && LINK_TYPES.includes(type) ? { tokenHash, type } : null
}

const isNetworkError = (err) =>
  err?.name === 'AuthRetryableFetchError' || (typeof err?.status === 'number' && (err.status === 0 || err.status >= 500))

// Penanda "token sudah diverifikasi tapi password belum tersimpan" untuk akun
// tertentu. Kalau link yang sama dibuka lagi (token sudah terpakai), sesi akun
// ITU yang dilanjutkan -- bukan sesi akun lain yang kebetulan login di browser.
const PENDING_KEY = 'bmb_pending_password_setup'
const storage = {
  get: () => {
    try {
      return localStorage.getItem(PENDING_KEY)
    } catch {
      return null
    }
  },
  set: (v) => {
    try {
      localStorage.setItem(PENDING_KEY, v)
    } catch {
      // abaikan
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(PENDING_KEY)
    } catch {
      // abaikan
    }
  },
}

// Tujuan link undangan / atur ulang password. Dua format link:
// - ?token_hash=...&type=invite|recovery  -> dibuat invite-staff. Token SENGAJA
//   baru diverifikasi saat tombol Simpan ditekan (bukan saat halaman dibuka),
//   supaya pemindai link email/pratinjau WhatsApp tidak menghabiskan token
//   sekali pakai, dan akun tidak terkonfirmasi tanpa password.
// - #access_token=...&type=...  -> link email bawaan Supabase, sesi otomatis.
export default function SetPasswordPage() {
  const navigate = useNavigate()
  const [pendingToken, setPendingToken] = useState(readTokenFromUrl)
  const [session, setSession] = useState(null)
  const [linkError, setLinkError] = useState('')
  const [checking, setChecking] = useState(() => !readTokenFromUrl())
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured || readTokenFromUrl()) {
      setChecking(false)
      return
    }
    // Token dari hash URL diproses asinkron oleh Supabase, jadi tunggu event
    // auth juga -- getSession() saja bisa masih kosong di render pertama.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSession(data.session)
      setChecking(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (newSession) {
        setSession(newSession)
        setChecking(false)
      }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    document.title = 'Atur Password — Bangsa Media Bali'
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < MIN_LENGTH) {
      setError(`Password minimal ${MIN_LENGTH} karakter.`)
      return
    }
    if (password !== confirm) {
      setError('Konfirmasi password tidak sama.')
      return
    }
    setSaving(true)

    if (pendingToken) {
      const { data, error: err } = await supabase.auth.verifyOtp({ token_hash: pendingToken.tokenHash, type: pendingToken.type })
      if (err || !data?.session) {
        setSaving(false)
        if (isNetworkError(err)) {
          // Token belum tentu terpakai -- biarkan di URL supaya bisa dicoba lagi.
          setError('Gagal terhubung ke server. Periksa koneksi internet lalu coba lagi.')
          return
        }
        window.history.replaceState(null, '', '/admin/set-password')
        setPendingToken(null)
        const { data: current } = await supabase.auth.getSession()
        const pendingUserId = storage.get()
        if (current.session && pendingUserId && current.session.user.id === pendingUserId) {
          setSession(current.session)
          setError('Link sudah terpakai sebelumnya, tapi akun Anda masih terverifikasi di perangkat ini. Silakan simpan password Anda.')
        } else {
          setLinkError(err?.message || 'Link tidak valid.')
        }
        return
      }
      // Token sudah terpakai: kalau langkah berikut gagal, sesi ini yang dipakai
      // untuk mencoba lagi, bukan token.
      window.history.replaceState(null, '', '/admin/set-password')
      storage.set(data.session.user.id)
      setPendingToken(null)
      setSession(data.session)
    }

    const { error: err } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (err) {
      setError(err.message)
    } else {
      storage.clear()
      setDone(true)
    }
  }

  const showForm = !checking && !done && (pendingToken || session)
  const showInvalid = !checking && !done && !pendingToken && !session

  return (
    <div className="flex min-h-screen items-center justify-center bg-nusatech-gradient px-5">
      <div className="glass-panel w-full max-w-sm rounded-3xl p-8 shadow-blue-glow">
        <div className="flex flex-col items-center text-center">
          <MascotIcon variant="assistant" size={72} />
          <h1 className="mt-4 text-xl font-bold text-white">Atur Password Akun</h1>
          {session?.user?.email ? (
            <p className="mt-1 text-sm text-slate-400">{session.user.email}</p>
          ) : (
            pendingToken && <p className="mt-1 text-sm text-slate-400">Buat password untuk masuk ke CMS Admin.</p>
          )}
        </div>

        {checking && <p className="mt-6 text-center text-sm text-slate-400">Memverifikasi link...</p>}

        {showInvalid && (
          <div className="mt-6 text-center">
            <p className="flex items-start gap-2 text-left text-sm text-amber-300">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              Link tidak valid, sudah dipakai, atau kedaluwarsa. Jika Anda sudah pernah mengatur password, langsung login di halaman admin. Jika
              belum, minta Owner/Admin membuat link baru dari menu Kelola Pengguna.
            </p>
            {linkError && <p className="mt-2 text-left text-[11px] text-slate-500">Detail: {linkError}</p>}
            <a href="/admin" className="btn-secondary mt-5 inline-flex !px-4 !py-2 text-xs">
              Ke Halaman Login
            </a>
          </div>
        )}

        {done && (
          <div className="mt-6 text-center">
            <p className="flex items-center justify-center gap-2 text-sm text-emerald-400">
              <CheckCircle2 size={16} /> Password berhasil disimpan.
            </p>
            <p className="mt-2 text-xs text-slate-400">Berikutnya, login di /admin memakai email dan password ini.</p>
            <button type="button" onClick={() => navigate('/admin')} className="btn-primary mt-5 w-full">
              Masuk ke Dashboard
            </button>
          </div>
        )}

        {showForm && (
          <form onSubmit={handleSubmit} className="mt-6">
            <label className="label-field">Password Baru</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field pl-9"
                placeholder={`Minimal ${MIN_LENGTH} karakter`}
                autoComplete="new-password"
                autoFocus
                required
              />
            </div>
            <label className="label-field mt-4">Ulangi Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="input-field pl-9"
                placeholder="Ketik ulang password"
                autoComplete="new-password"
                required
              />
            </div>
            {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
            <button type="submit" disabled={saving} className="btn-primary mt-6 w-full disabled:opacity-60">
              {saving ? 'Menyimpan...' : 'Simpan Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
