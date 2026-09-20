import { useState } from 'react'
import { Lock, Mail } from 'lucide-react'
import { adminSignIn } from '../context/ContentContext'
import { isSupabaseConfigured } from '../lib/supabaseClient'
import MascotIcon from '../components/MascotIcon'

export default function AdminLogin({ onSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const errorMessage = await adminSignIn(email, password)
    setLoading(false)
    if (errorMessage) {
      setError(errorMessage)
    } else {
      onSuccess()
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-nusatech-gradient px-5">
      <form onSubmit={handleSubmit} className="glass-panel w-full max-w-sm rounded-3xl p-8 shadow-blue-glow">
        <div className="flex flex-col items-center text-center">
          <MascotIcon variant="assistant" size={72} />
          <h1 className="mt-4 text-xl font-bold text-white">Admin CMS Bangsa Media Bali</h1>
          <p className="mt-1 text-sm text-slate-400">Masuk untuk mengelola konten website.</p>
        </div>

        {isSupabaseConfigured && (
          <div className="mt-6">
            <label className="label-field">Email Admin</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field pl-9"
                placeholder="admin@bangsamediabali.id"
                autoFocus
                required
              />
            </div>
          </div>
        )}

        <div className="mt-4">
          <label className="label-field">Password Admin</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field pl-9"
              placeholder="Masukkan password"
              autoFocus={!isSupabaseConfigured}
              required
            />
          </div>
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        </div>

        <button type="submit" disabled={loading} className="btn-primary mt-6 w-full disabled:opacity-60">
          {loading ? 'Memproses...' : 'Masuk'}
        </button>

        <a href="/" className="mt-4 block text-center text-xs text-slate-500 hover:text-gold-soft">
          Kembali ke Beranda
        </a>
      </form>
    </div>
  )
}
