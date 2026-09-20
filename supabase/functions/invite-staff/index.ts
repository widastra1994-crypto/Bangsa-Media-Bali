// Edge Function: invite-staff
// Dipanggil dari CMS admin (tab Kelola Pengguna) oleh Owner/Admin untuk
// mengundang akun staf/admin/viewer baru. Memakai SERVICE_ROLE_KEY untuk
// memanggil Supabase Admin API (invite email dikirim otomatis oleh Supabase
// Auth). Role disisipkan ke user_metadata supaya trigger handle_new_user
// otomatis membuat profil dengan role yang benar (bukan default 'client').

import { createClient } from 'jsr:@supabase/supabase-js@2'

const ALLOWED_ROLES = ['admin', 'staff', 'viewer']

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), { status: 405 })
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
      return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), { status: 401 })
    }

    const admin = createClient(supabaseUrl, serviceKey)

    const { data: callerProfile } = await admin.from('profiles').select('role').eq('id', caller.id).maybeSingle()
    if (!callerProfile || !['owner', 'admin'].includes(callerProfile.role)) {
      return new Response(JSON.stringify({ ok: false, error: 'Hanya Owner/Admin yang boleh mengundang pengguna baru.' }), { status: 403 })
    }

    const { email, name, role } = await req.json()
    if (!email || !ALLOWED_ROLES.includes(role)) {
      return new Response(JSON.stringify({ ok: false, error: 'Email atau role tidak valid.' }), { status: 400 })
    }

    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { data: { role, name: name || email } })
    if (error) {
      return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 200 })
    }

    return new Response(JSON.stringify({ ok: true, userId: data.user.id }), { status: 200, headers: { 'content-type': 'application/json' } })
  } catch (err) {
    console.error('invite-staff error:', err)
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 200 })
  }
})
