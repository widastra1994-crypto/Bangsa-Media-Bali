// Edge Function opsional (Tahap 2): kirim notifikasi email ke tim setiap ada lead baru.
// Deploy dengan Supabase CLI: supabase functions deploy send-lead-email
// Lalu set secret: supabase secrets set RESEND_API_KEY=xxxxx TEAM_EMAIL=halo@bangsamediabali.id
// Terakhir hubungkan sebagai Database Webhook (Dashboard > Database > Webhooks) yang
// trigger saat INSERT ke tabel consultation_leads, memanggil URL function ini.

// @ts-nocheck
import { serve } from 'https://deno.land/std@0.203.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const TEAM_EMAIL = Deno.env.get('TEAM_EMAIL')
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'onboarding@resend.dev'

serve(async (req) => {
  try {
    const payload = await req.json()
    const lead = payload.record

    if (!lead) {
      return new Response(JSON.stringify({ error: 'Tidak ada data lead pada payload.' }), { status: 400 })
    }

    const html = `
      <h2>Lead Konsultasi Baru — Bangsa Media Bali</h2>
      <p><strong>Nama:</strong> ${lead.name || '-'}</p>
      <p><strong>Telepon:</strong> ${lead.phone || '-'}</p>
      <p><strong>Email:</strong> ${lead.email || '-'}</p>
      <p><strong>Nama Bisnis:</strong> ${lead.business_name || '-'}</p>
      <p><strong>Jenis Usaha:</strong> ${lead.business_type || '-'}</p>
      <p><strong>Alamat:</strong> ${lead.address || '-'}</p>
      <p><strong>Layanan:</strong> ${(lead.services || []).join(', ') || '-'}</p>
      <p><strong>Skala Proyek:</strong> ${lead.scale || '-'}</p>
      <p><strong>Estimasi Biaya:</strong> Rp ${Number(lead.estimated_total || 0).toLocaleString('id-ID')}</p>
      <p><strong>Jadwal Konsultasi:</strong> ${lead.consult_date || '-'} pukul ${lead.consult_time || '-'}</p>
    `

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: TEAM_EMAIL,
        subject: `Lead Baru: ${lead.name} (${lead.business_name || 'Tanpa nama bisnis'})`,
        html,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      return new Response(JSON.stringify({ error: `Resend gagal: ${errText}` }), { status: 502 })
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
