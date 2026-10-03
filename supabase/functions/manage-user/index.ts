// Edge Function: manage-user
// Menghapus akun pengguna dari CMS (Kelola Pengguna > Hapus). Butuh Admin API
// Supabase (service role) karena akun login ada di auth.users, bukan hanya
// tabel profiles.
//
// Aturan (selaras trigger protect_owner_role):
// - Tidak bisa menghapus akun sendiri, dan akun Owner tidak bisa dihapus dari sini.
// - Akun Admin hanya bisa dihapus Owner.
// Riwayat tetap aman: audit trail menyimpan salinan nama pelaku (actor_name),
// dan referensi di tabel lain otomatis dilepas (ON DELETE SET NULL).

import { createClient } from 'jsr:@supabase/supabase-js@2'

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
      return json({ ok: false, error: 'Hanya Owner/Admin yang boleh menghapus pengguna.' }, 403)
    }

    const { action, userId } = await req.json()
    if (action !== 'delete' || typeof userId !== 'string' || !userId) {
      return json({ ok: false, error: 'Permintaan tidak valid.' }, 400)
    }
    if (userId === caller.id) {
      return json({ ok: false, error: 'Anda tidak bisa menghapus akun Anda sendiri.' }, 403)
    }

    const { data: target } = await admin.from('profiles').select('name, role').eq('id', userId).maybeSingle()
    const { data: targetAuth } = await admin.auth.admin.getUserById(userId)
    if (!target && !targetAuth?.user) {
      return json({ ok: false, error: 'Pengguna tidak ditemukan.' }, 404)
    }
    if (target?.role === 'owner') {
      return json({ ok: false, error: 'Akun Owner tidak bisa dihapus dari CMS.' }, 403)
    }
    if (target?.role === 'admin' && callerProfile.role !== 'owner') {
      return json({ ok: false, error: 'Akun Admin hanya bisa dihapus oleh Owner.' }, 403)
    }

    // Catat dulu (sebelum hapus) supaya jejaknya ada walau penghapusan gagal di tengah.
    await admin.from('acc_audit_logs').insert({
      user_id: caller.id,
      action: 'user_deleted',
      entity_name: 'profiles',
      entity_id: userId,
      old_values: { name: target?.name ?? null, role: target?.role ?? null, email: targetAuth?.user?.email ?? null },
    })

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
    if (deleteError) {
      return json({ ok: false, error: deleteError.message })
    }

    return json({ ok: true })
  } catch (err) {
    console.error('manage-user error:', err)
    return json({ ok: false, error: String(err) })
  }
})
