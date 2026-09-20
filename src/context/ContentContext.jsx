import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { defaultContent } from '../data/defaultContent'
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'

const STORAGE_KEY = 'nusatech_content_v3'
const AUTH_KEY = 'nusatech_admin_auth'
// Dipakai hanya sebagai fallback saat Supabase belum dikonfigurasi (mode dev lokal).
// Begitu Supabase aktif, admin login pakai email+password sungguhan (Supabase Auth),
// bukan password ini lagi.
export const ADMIN_PASSWORD = 'nusatech2024'

const isPlainObject = (v) => v && typeof v === 'object' && !Array.isArray(v)

// Array bisa digabung per-item (mempertahankan field baru dari default) hanya jika
// setiap elemennya adalah objek ber-`id` unik, mis. pricing.categories[].tiers[].
// Array primitif (features, tags) atau objek tanpa id tidak aman digabung per-item,
// jadi dipakai apa adanya dari data tersimpan (override).
function canMergeArrayByld(arr) {
  return Array.isArray(arr) && arr.length > 0 && arr.every((item) => isPlainObject(item) && item.id !== undefined)
}

function mergeArrays(baseArr, overrideArr) {
  if (!Array.isArray(overrideArr)) return baseArr
  if (!canMergeArrayByld(baseArr) || !canMergeArrayByld(overrideArr)) return overrideArr

  const baseById = new Map(baseArr.map((item) => [item.id, item]))
  const merged = overrideArr.map((item) => {
    const baseItem = baseById.get(item.id)
    return baseItem ? deepMerge(baseItem, item) : item
  })
  const overrideIds = new Set(overrideArr.map((item) => item.id))
  baseArr.forEach((item) => {
    if (!overrideIds.has(item.id)) merged.push(item)
  })
  return merged
}

// Merge rekursif: field baru yang ditambahkan ke defaultContent (section, sub-objek,
// atau field baru di dalam item array ber-id) tetap muncul walau data tersimpan
// pengguna belum punya field itu, tanpa menghapus perubahan/penambahan milik pengguna.
function deepMerge(base, override) {
  if (Array.isArray(base) || Array.isArray(override)) {
    return mergeArrays(Array.isArray(base) ? base : [], override)
  }
  if (isPlainObject(base) && isPlainObject(override)) {
    const result = { ...base }
    for (const key of Object.keys(override)) {
      result[key] = key in base ? deepMerge(base[key], override[key]) : override[key]
    }
    return result
  }
  return override !== undefined ? override : base
}

function loadLocalContent() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultContent
    return deepMerge(defaultContent, JSON.parse(raw))
  } catch (err) {
    console.warn('Gagal memuat konten tersimpan, memakai default.', err)
    return defaultContent
  }
}

const ContentContext = createContext(null)

export function ContentProvider({ children }) {
  // Render pertama instan dari cache lokal/default; kalau Supabase aktif, versi
  // resmi (dipakai semua pengunjung) menyusul lewat useEffect di bawah.
  const [content, setContent] = useState(loadLocalContent)
  const [remoteLoaded, setRemoteLoaded] = useState(!isSupabaseConfigured)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(content))
  }, [content])

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    supabase
      .from('site_content')
      .select('data')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          console.warn('Gagal memuat konten dari Supabase, memakai cache lokal.', error.message)
        } else if (data?.data) {
          setContent(deepMerge(defaultContent, data.data))
        }
        setRemoteLoaded(true)
      })
    return () => {
      active = false
    }
  }, [])

  const persistRemote = useCallback((next) => {
    if (!isSupabaseConfigured) return
    supabase
      .from('site_content')
      .upsert({ id: 1, data: next, updated_at: new Date().toISOString() })
      .then(({ error }) => {
        if (error) console.warn('Gagal menyimpan konten ke Supabase (mungkin belum login admin):', error.message)
      })
  }, [])

  const updateSection = useCallback(
    (section, value) => {
      setContent((prev) => {
        const next = { ...prev, [section]: value }
        persistRemote(next)
        return next
      })
    },
    [persistRemote],
  )

  const value = useMemo(
    () => ({ content, updateSection, remoteLoaded }),
    [content, updateSection, remoteLoaded],
  )

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>
}

export function useContent() {
  const ctx = useContext(ContentContext)
  if (!ctx) throw new Error('useContent harus dipakai di dalam ContentProvider')
  return ctx
}

// ---------------------------------------------------------------------------
// Autentikasi admin: pakai Supabase Auth sungguhan kalau sudah dikonfigurasi
// (aman untuk production), atau password statis sebagai fallback saat dev
// lokal belum menyiapkan Supabase.
// ---------------------------------------------------------------------------

export async function adminSignIn(email, password) {
  if (isSupabaseConfigured) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error ? error.message : null
  }
  if (password === ADMIN_PASSWORD) {
    window.sessionStorage.setItem(AUTH_KEY, 'true')
    return null
  }
  return 'Password salah. Silakan coba lagi.'
}

export async function adminSignOut() {
  if (isSupabaseConfigured) await supabase.auth.signOut()
  window.sessionStorage.removeItem(AUTH_KEY)
}

export function useAdminSession() {
  const [state, setState] = useState(() => ({
    loading: isSupabaseConfigured,
    authed: isSupabaseConfigured ? false : window.sessionStorage.getItem(AUTH_KEY) === 'true',
  }))

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (active) setState({ loading: false, authed: Boolean(data.session) })
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ loading: false, authed: Boolean(session) })
    })
    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  return state
}
