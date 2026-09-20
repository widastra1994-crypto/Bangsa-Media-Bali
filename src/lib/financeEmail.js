import { supabase, isSupabaseConfigured } from './supabaseClient'

const FUNCTION_URL = isSupabaseConfigured
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-finance-email`
  : null

// Kirim email invoice/kuitansi ke klien via Edge Function send-finance-email.
// Selalu dipanggil dengan access token sesi admin yang sedang login (bukan
// anon key), supaya hanya admin yang login yang bisa memicu pengiriman email.
export async function sendFinanceEmail(payload) {
  if (!FUNCTION_URL) return { ok: false, error: 'Supabase belum dikonfigurasi.' }
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  if (!token) return { ok: false, error: 'Sesi admin tidak ditemukan, silakan login ulang.' }

  try {
    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    })
    return await res.json()
  } catch (err) {
    return { ok: false, error: err.message }
  }
}
