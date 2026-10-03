// Edge Function: invite-staff
// Dipanggil dari CMS admin (tab Kelola Pengguna) oleh Owner/Admin untuk
// mengundang akun staf/admin/viewer baru. Memakai SERVICE_ROLE_KEY untuk
// memanggil Supabase Admin API (invite email dikirim otomatis oleh Supabase
// Auth). Trigger handle_new_user selalu membuat profil 'client' (role tidak
// boleh diambil dari user_metadata yang bisa diisi siapa pun), jadi role yang
// benar ditetapkan di sini lewat service role setelah undangan dibuat.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const ALLOWED_ROLES = ['admin', 'staff', 'viewer']

// Origin '*' aman di sini: autentikasi lewat header Authorization (bearer
// token), bukan cookie, jadi browser lain tidak bisa "menumpang" sesi admin.
// Tanpa header ini, preflight OPTIONS dari browser ditolak dan fetch di
// frontend gagal dengan "Failed to fetch".
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'content-type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    if (req.method !== 'POST') {
      return json({ ok: false, error: 'Method not allowed' }, 405)
    }

    const authHeader = req.headers.get('Authorization') || ''
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const {
      data: { user: caller },
    } = await callerClient.auth.getUser()
    if (!caller) {
      return json({ ok: false, error: 'Sesi tidak valid, silakan login ulang.' }, 401)
    }

    const admin = createClient(supabaseUrl, serviceKey)

    const { data: callerProfile } = await admin.from('profiles').select('role').eq('id', caller.id).maybeSingle()
    if (!callerProfile || !['owner', 'admin'].includes(callerProfile.role)) {
      return json({ ok: false, error: 'Hanya Owner/Admin yang boleh mengundang pengguna baru.' }, 403)
    }

    const { email, name, role, redirectTo } = await req.json()
    if (!email || !ALLOWED_ROLES.includes(role)) {
      return json({ ok: false, error: 'Email atau role tidak valid.' }, 400)
    }

    // Hanya terima tujuan halaman atur password; Supabase Auth juga menolak
    // URL yang tidak ada di daftar Redirect URLs (fallback ke Site URL).
    let safeRedirect: string | undefined
    try {
      if (redirectTo && new URL(redirectTo).pathname === '/admin/set-password') safeRedirect = redirectTo
    } catch {
      safeRedirect = undefined
    }

    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { name: name || email },
      redirectTo: safeRedirect,
    })
    if (error) {
      return json({ ok: false, error: error.message })
    }

    const { error: roleError } = await admin
      .from('profiles')
      .upsert({ id: data.user.id, name: name || email, role }, { onConflict: 'id' })
    if (roleError) {
      return json({
        ok: false,
        error: `Undangan terkirim, tapi role gagal ditetapkan (${roleError.message}). Ubah role akun ini secara manual di daftar pengguna.`,
      })
    }

    return json({ ok: true, userId: data.user.id })
  } catch (err) {
    console.error('invite-staff error:', err)
    return json({ ok: false, error: String(err) })
  }
})
