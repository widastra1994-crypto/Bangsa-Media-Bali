import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Harus dibaca SEBELUM createClient: Supabase memproses lalu menghapus hash
// URL (#access_token=...&type=invite) secara otomatis setelah klien dibuat.
// Dipakai untuk mengarahkan pengguna dari link undangan/reset password ke
// halaman atur password, di halaman mana pun mereka mendarat.
export const initialAuthLinkType =
  typeof window !== 'undefined' ? new URLSearchParams(window.location.hash.slice(1)).get('type') : null

// Sengaja null kalau belum dikonfigurasi, supaya kalkulator tetap berfungsi normal
// (lewat WhatsApp) walau fitur simpan-leads/cek-slot belum diaktifkan.
export const supabase = url && anonKey ? createClient(url, anonKey) : null
export const isSupabaseConfigured = Boolean(supabase)

// Browser membatasi/menjeda timer JS di tab yang tidak aktif (mis. admin
// membuka tab lain lama), sehingga proses refresh token otomatis Supabase
// bisa telat jalan dan access token keburu kedaluwarsa -> muncul error
// "JWT expired" saat query dijalankan. Ini pola resmi yang direkomendasikan
// Supabase: paksa refresh begitu tab aktif kembali, hentikan timernya saat
// tab tidak terlihat supaya tidak boros closure/listener saat idle.
if (isSupabaseConfigured && typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      supabase.auth.startAutoRefresh()
    } else {
      supabase.auth.stopAutoRefresh()
    }
  })
}
