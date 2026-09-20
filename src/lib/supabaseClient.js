import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Sengaja null kalau belum dikonfigurasi, supaya kalkulator tetap berfungsi normal
// (lewat WhatsApp) walau fitur simpan-leads/cek-slot belum diaktifkan.
export const supabase = url && anonKey ? createClient(url, anonKey) : null
export const isSupabaseConfigured = Boolean(supabase)
