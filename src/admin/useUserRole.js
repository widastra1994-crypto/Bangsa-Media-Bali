import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'

// Role user admin yang sedang login (owner/admin/staff/viewer). Dipakai untuk
// menyembunyikan menu & fitur yang tidak relevan/tidak boleh diakses role
// tersebut. Pembatasan SESUNGGUHNYA tetap ditegakkan di RLS Supabase --
// ini murni untuk kenyamanan tampilan (defense-in-depth, bukan satu-satunya lapisan).
export function useUserRole() {
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    let active = true
    const load = async () => {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData?.user) {
        if (active) {
          setRole(null)
          setLoading(false)
        }
        return
      }
      const { data } = await supabase.from('profiles').select('role').eq('id', userData.user.id).maybeSingle()
      if (active) {
        setRole(data?.role || 'viewer')
        setLoading(false)
      }
    }
    load()
    const { data: listener } = supabase.auth.onAuthStateChange(() => load())
    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  return { role, loading, isOwnerOrAdmin: role === 'owner' || role === 'admin' }
}
