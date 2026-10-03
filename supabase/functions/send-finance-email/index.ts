// Edge Function: send-finance-email
// Dipanggil dari CMS admin (butuh login) untuk mengirim email Invoice atau
// Kuitansi ke klien via Resend. Selain verify_jwt platform, function ini juga
// memvalidasi bahwa token benar-benar milik user yang login (bukan anon key),
// supaya endpoint pengiriman email tidak bisa dipicu tanpa login.
//
// Aktivasi: set secret RESEND_API_KEY & FROM_EMAIL di Supabase Dashboard >
// Edge Functions > send-finance-email > Secrets. Selama RESEND_API_KEY belum
// diisi, function ini mengembalikan pesan jelas (tidak mengirim apa pun),
// supaya form transaksi tetap bisa disimpan normal walau email belum aktif.

import { createClient } from 'jsr:@supabase/supabase-js@2'

// Origin '*' aman: autentikasi lewat bearer token di header, bukan cookie.
// Tanpa header ini preflight OPTIONS dari browser ditolak ("Failed to fetch").
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
    const authHeader = req.headers.get('Authorization') || ''
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
    } = await supabaseClient.auth.getUser()
    if (!user) {
      return json({ ok: false, error: 'Unauthorized' }, 401)
    }

    const apiKey = Deno.env.get('RESEND_API_KEY')
    const fromEmail = Deno.env.get('FROM_EMAIL') || 'onboarding@resend.dev'

    if (!apiKey) {
      return json({ ok: false, error: 'Email belum dikonfigurasi (RESEND_API_KEY belum diset).' })
    }

    const body = await req.json()
    const { type, to, clientName, brandName, docNumber, amount, dueDate, items, notes } = body

    if (!to || !type || !docNumber) {
      return json({ ok: false, error: 'Data email tidak lengkap.' }, 400)
    }

    const formatIDR = (n: number) =>
      new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0)

    const brand = brandName || 'Bangsa Media Bali'
    const isInvoice = type === 'invoice'
    const subject = isInvoice ? `Invoice ${docNumber} dari ${brand}` : `Kuitansi Pembayaran ${docNumber} dari ${brand}`
    const heading = isInvoice ? 'Invoice / Tagihan' : 'Kuitansi Pembayaran'

    const itemsRows = Array.isArray(items) && items.length
      ? items.map((it: { label: string; amount: number }) => `
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #eee;">${it.label}</td>
            <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">${formatIDR(it.amount)}</td>
          </tr>`).join('')
      : `<tr><td style="padding:8px 0;">${isInvoice ? 'Tagihan' : 'Pembayaran'}</td><td style="padding:8px 0;text-align:right;">${formatIDR(amount)}</td></tr>`

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a;">
        <div style="background:#020617;padding:24px;border-radius:12px 12px 0 0;">
          <h1 style="color:#fbbf24;margin:0;font-size:20px;">${brand}</h1>
        </div>
        <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px;">
          <h2 style="margin-top:0;">${heading}</h2>
          <p>Yth. <strong>${clientName || 'Pelanggan'}</strong>,</p>
          <p>${isInvoice ? 'Berikut kami sampaikan rincian tagihan Anda:' : 'Terima kasih, pembayaran Anda telah kami terima. Berikut kuitansi resminya:'}</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
            <tr><td style="padding:8px 0;color:#64748b;">Nomor ${isInvoice ? 'Invoice' : 'Kuitansi'}</td><td style="padding:8px 0;text-align:right;font-weight:bold;">${docNumber}</td></tr>
            ${itemsRows}
            <tr><td style="padding:12px 0;font-weight:bold;border-top:2px solid #0f172a;">Total</td><td style="padding:12px 0;text-align:right;font-weight:bold;border-top:2px solid #0f172a;">${formatIDR(amount)}</td></tr>
            ${isInvoice && dueDate ? `<tr><td style="padding:8px 0;color:#64748b;">Jatuh Tempo</td><td style="padding:8px 0;text-align:right;">${dueDate}</td></tr>` : ''}
          </table>
          ${notes ? `<p style="font-size:13px;color:#64748b;">${notes}</p>` : ''}
          <p style="margin-top:24px;font-size:13px;color:#64748b;">Email ini dikirim otomatis oleh sistem ${brand}. Balas email ini jika ada pertanyaan.</p>
        </div>
      </div>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ from: `${brand} <${fromEmail}>`, to: [to], subject, html }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('Resend error:', errText)
      return json({ ok: false, error: errText })
    }

    return json({ ok: true })
  } catch (err) {
    console.error('send-finance-email error:', err)
    return json({ ok: false, error: String(err) })
  }
})
