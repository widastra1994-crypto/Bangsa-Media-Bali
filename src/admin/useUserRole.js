import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'

// Role user admin yang sedang login (owner/admin/staff/viewer) dan daftar menu
// yang diizinkan untuknya. Dipakai untuk menyembunyikan menu & fitur yang
// tidak relevan/tidak boleh diakses. Pembatasan SESUNGGUHNYA tetap ditegakkan
// di RLS Supabase -- ini murni untuk kenyamanan tampilan (defense-in-depth).
export function useUserRole() {
  const [role, setRole] = useState(null)
  const [menuAccess, setMenuAccess] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    let active = true
    let latestRequest = 0
    const load = async () => {
      const requestId = ++latestRequest
      const isStale = () => !active || requestId !== latestRequest
      // getSession dibaca lokal (tanpa jaringan), jadi gangguan koneksi tidak
      // disalahartikan sebagai "belum login".
      const { data: sessionData } = await supabase.auth.getSession()
      if (isStale()) return
      const user = sessionData?.session?.user
      if (!user) {
        setRole(null)
        setMenuAccess(null)
        setError(null)
        setLoading(false)
        return
      }
      const { data, error: err } = await supabase.from('profiles').select('role, menu_access').eq('id', user.id).maybeSingle()
      if (isStale()) return
      if (err || !data) {
        // Gagal-tertutup: jangan menebak role (dulu jatuh ke 'viewer' dengan
        // semua menunya, padahal menu akun ini mungkin sudah dipersempit).
        setRole(null)
        setMenuAccess(null)
        setError(err?.message || 'Profil akun tidak ditemukan.')
      } else {
        setRole(data.role)
        setMenuAccess(data.menu_access ?? null)
        setError(null)
      }
      setLoading(false)
    }
    load()
    const { data: listener } = supabase.auth.onAuthStateChange(() => load())
    // Muat ulang saat tab kembali aktif, supaya perubahan role/akses menu dari
    // Owner berlaku tanpa staf harus logout-login.
    const onVisible = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      listener.subscription.unsubscribe()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return { role, menuAccess, error, loading, isOwnerOrAdmin: role === 'owner' || role === 'admin' }
}
