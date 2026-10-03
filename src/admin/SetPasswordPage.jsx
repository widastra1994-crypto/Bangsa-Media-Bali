import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Lock } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import MascotIcon from '../components/MascotIcon'

const MIN_LENGTH = 8

// Tujuan link email undangan (invite-staff) dan reset password. Sesi sudah
// otomatis aktif dari token di URL; di sini pengguna menetapkan password
// supaya bisa login normal di /admin berikutnya.
export default function SetPasswordPage() {
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [checking, setChecking] = useState(true)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured) {
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
    const { error: err } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (err) setError(err.message)
    else setDone(true)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-nusatech-gradient px-5">
      <div className="glass-panel w-full max-w-sm rounded-3xl p-8 shadow-blue-glow">
        <div className="flex flex-col items-center text-center">
          <MascotIcon variant="assistant" size={72} />
          <h1 className="mt-4 text-xl font-bold text-white">Atur Password Akun</h1>
          {session?.user?.email && <p className="mt-1 text-sm text-slate-400">{session.user.email}</p>}
        </div>

        {checking && <p className="mt-6 text-center text-sm text-slate-400">Memverifikasi link...</p>}

        {!checking && !session && (
          <div className="mt-6 text-center">
            <p className="flex items-start gap-2 text-left text-sm text-amber-300">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              Link tidak valid atau sudah kedaluwarsa. Minta Owner/Admin mengirim ulang undangan dari menu Kelola Pengguna.
            </p>
            <a href="/admin" className="btn-secondary mt-5 inline-flex !px-4 !py-2 text-xs">
              Ke Halaman Login
            </a>
          </div>
        )}

        {!checking && session && done && (
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

        {!checking && session && !done && (
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
