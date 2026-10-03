// Edge Function: invite-staff
// Dipanggil dari CMS admin (tab Kelola Pengguna) oleh Owner/Admin untuk
// mengundang akun staf/admin/viewer baru, atau membuat link atur ulang
// password untuk akun internal yang sudah ada.
//
// Link dibuat sendiri lewat admin.generateLink (tanpa email bawaan Supabase),
// lalu dikembalikan ke CMS untuk disalin / dikirim via WhatsApp. Alasannya:
// email bawaan Supabase dibatasi ~2 email/jam per proyek, dan link di dalamnya
// bergantung pada Site URL/Redirect URLs Auth. Link di sini langsung menuju
// /admin/set-password milik aplikasi dan baru diverifikasi (verifyOtp) saat
// pengguna menekan Simpan Password. Jika secret RESEND_API_KEY diset, link
// yang sama juga dikirim lewat email.
//
// Aturan peran (juga ditegakkan trigger protect_owner_role di DB):
// - Akun Owner tidak bisa disentuh dari sini.
// - Role Admin dan akun Admin hanya dikelola Owner.
// - Akun Klien Portal yang sudah aktif tidak bisa dijadikan akun internal.
// Trigger handle_new_user selalu membuat profil 'client', jadi role yang benar
// ditetapkan di sini lewat service role.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const ALLOWED_ROLES = ['admin', 'staff', 'viewer']
const ROLE_LABEL: Record<string, string> = { admin: 'Admin', staff: 'Staff', viewer: 'Viewer' }
const DEFAULT_APP_ORIGIN = 'https://bangsamediabali.com'

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

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const isLocalHost = (host: string) => /^(localhost|127\.0\.0\.1)(:\d{1,5})?$/i.test(host)

// Akhiran tetap menjamin huruf kecil, besar, angka, dan simbol selalu ada,
// supaya lolos aturan kekuatan password Supabase apa pun yang dipilih.
const randomPassword = () => {
  const bytes = new Uint8Array(48)
  crypto.getRandomValues(bytes)
  return `${btoa(String.fromCharCode(...bytes))}aA1!`
}

// Origin halaman CMS yang memanggil, supaya link mengarah ke domain yang sama
// (produksi, preview Vercel, atau localhost saat pengembangan). Host divalidasi
// ketat supaya karakter seperti tanda kutip tidak bisa masuk ke HTML email.
function appOriginFrom(redirectTo: unknown): string {
  try {
    if (typeof redirectTo === 'string') {
      const url = new URL(redirectTo)
      const hostOk = /^[a-z0-9.-]+(:\d{1,5})?$/i.test(url.host)
      const protocolOk = url.protocol === 'https:' || (url.protocol === 'http:' && isLocalHost(url.host))
      if (hostOk && protocolOk && url.pathname === '/admin/set-password') return url.origin
    }
  } catch {
    // abaikan, pakai default
  }
  return DEFAULT_APP_ORIGIN
}

const buildLink = (origin: string, tokenHash: string, type: 'invite' | 'recovery') =>
  `${origin}/admin/set-password?${new URLSearchParams({ token_hash: tokenHash, type }).toString()}`

// Opsional dan tidak boleh menggagalkan undangan: link tetap dikembalikan ke
// CMS walau Resend gangguan.
async function sendLinkEmail(to: string, name: string, role: string, url: string, kind: 'invite' | 'reset') {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) return false
  try {
    const fromEmail = Deno.env.get('FROM_EMAIL') || 'onboarding@resend.dev'
    const intro =
      kind === 'invite'
        ? `Anda diundang bergabung ke CMS Admin Bangsa Media Bali sebagai <strong>${ROLE_LABEL[role] || role}</strong>. Klik tombol di bawah untuk membuat password akun Anda.`
        : 'Klik tombol di bawah untuk mengatur ulang password akun CMS Admin Bangsa Media Bali Anda.'
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a;">
        <div style="background:#020617;padding:24px;border-radius:12px 12px 0 0;">
          <h1 style="color:#fbbf24;margin:0;font-size:20px;">Bangsa Media Bali</h1>
        </div>
        <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px;">
          <p>Halo <strong>${escapeHtml(name)}</strong>,</p>
          <p>${intro}</p>
          <p style="margin:28px 0;">
            <a href="${escapeHtml(url)}" style="background:#d4af37;color:#020617;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:bold;">Atur Password Akun</a>
          </p>
          <p style="font-size:13px;color:#64748b;">Link ini hanya bisa dipakai sekali dan punya masa berlaku. Jika sudah kedaluwarsa, minta link baru ke Owner/Admin.</p>
        </div>
      </div>`
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from: `Bangsa Media Bali <${fromEmail}>`,
        to: [to],
        subject: kind === 'invite' ? 'Undangan akun CMS Bangsa Media Bali' : 'Atur password akun CMS Bangsa Media Bali',
        html,
      }),
    })
    if (!res.ok) console.error('Resend error:', await res.text())
    return res.ok
  } catch (err) {
    console.error('Resend exception:', err)
    return false
  }
}

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
    const callerIsOwner = callerProfile.role === 'owner'

    const { email, name, role, redirectTo } = await req.json()
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
    if (!cleanEmail || !ALLOWED_ROLES.includes(role)) {
      return json({ ok: false, error: 'Email atau role tidak valid.' }, 400)
    }
    if (role === 'admin' && !callerIsOwner) {
      return json({ ok: false, error: 'Hanya Owner yang boleh mengundang akun Admin.' }, 403)
    }
    const displayName = (typeof name === 'string' && name.trim()) || cleanEmail
    const origin = appOriginFrom(redirectTo)
    const canEmail = !isLocalHost(new URL(origin).host)

    // Periksa akun target dulu, SEBELUM membuat token apa pun -- supaya
    // pemanggil yang tidak berhak tidak bisa membatalkan token milik akun lain.
    const { data: found, error: lookupError } = await admin.rpc('internal_user_lookup', { p_email: cleanEmail })
    if (lookupError) return json({ ok: false, error: lookupError.message })
    const existing = Array.isArray(found) ? found[0] : found

    if (existing) {
      if (existing.role === 'owner') {
        return json({ ok: false, error: 'Akun Owner tidak bisa diubah lewat menu ini.' }, 403)
      }
      if (existing.role === 'admin' && !callerIsOwner) {
        return json({ ok: false, error: 'Akun Admin hanya bisa dikelola oleh Owner.' }, 403)
      }
      if (existing.confirmed) {
        if (!ALLOWED_ROLES.includes(existing.role)) {
          return json({
            ok: false,
            error: 'Email ini sudah dipakai akun Klien Portal. Demi keamanan, akun klien tidak bisa dijadikan akun internal -- gunakan email lain untuk staf.',
          })
        }
        // Akun internal yang sudah aktif (atau undangan yang link-nya sudah
        // dibuka tapi password belum disimpan): buat link atur ulang password.
        // Role tidak diubah dari sini.
        const rec = await admin.auth.admin.generateLink({ type: 'recovery', email: cleanEmail })
        if (rec.error || !rec.data?.properties?.hashed_token) {
          return json({ ok: false, error: rec.error?.message || 'Gagal membuat link atur password.' })
        }
        const url = buildLink(origin, rec.data.properties.hashed_token, 'recovery')
        const emailSent = canEmail && (await sendLinkEmail(cleanEmail, displayName, existing.role, url, 'reset'))
        return json({ ok: true, kind: 'reset', userId: existing.user_id, role: existing.role, inviteUrl: url, emailSent })
      }
    }

    // Akun baru atau undangan yang belum diterima.
    const first = await admin.auth.admin.generateLink({ type: 'invite', email: cleanEmail, options: { data: { name: displayName } } })
    if (first.error || !first.data?.user) {
      return json({ ok: false, error: first.error?.message || 'Gagal membuat link undangan. Coba lagi.' })
    }
    const userId = first.data.user.id

    // Akun belum terkonfirmasi bisa saja dibuat lebih dulu oleh orang lain lewat
    // signUp publik dengan password pilihannya. Password itu akan tetap berlaku
    // setelah undangan diterima, jadi selalu timpa dengan nilai acak, lalu buat
    // token undangan baru (penggantian password bisa membatalkan token lama).
    const { error: pwError } = await admin.auth.admin.updateUserById(userId, { password: randomPassword() })
    if (pwError) return json({ ok: false, error: pwError.message })

    const fresh = await admin.auth.admin.generateLink({ type: 'invite', email: cleanEmail, options: { data: { name: displayName } } })
    if (fresh.error || !fresh.data?.properties?.hashed_token) {
      return json({ ok: false, error: fresh.error?.message || 'Gagal membuat link undangan.' })
    }

    const { error: roleError } = await admin.from('profiles').upsert({ id: userId, name: displayName, role }, { onConflict: 'id' })
    if (roleError) {
      return json({ ok: false, error: `Link undangan dibuat, tapi role gagal ditetapkan (${roleError.message}). Coba undang ulang.` })
    }

    const url = buildLink(origin, fresh.data.properties.hashed_token, 'invite')
    const emailSent = canEmail && (await sendLinkEmail(cleanEmail, displayName, role, url, 'invite'))
    return json({ ok: true, kind: 'invite', userId, role, inviteUrl: url, emailSent })
  } catch (err) {
    console.error('invite-staff error:', err)
    return json({ ok: false, error: String(err) })
  }
})
