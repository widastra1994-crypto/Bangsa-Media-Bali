// Edge Function: notify-lead
// Dipanggil otomatis oleh trigger database setiap ada baris baru di
// consultation_leads (lihat migrasi notify_new_lead di schema.sql).
// Mengirim notifikasi Telegram ke tim internal supaya lead baru langsung
// diketahui tanpa perlu buka dashboard admin.
//
// Aktivasi: set secret TELEGRAM_BOT_TOKEN & TELEGRAM_CHAT_ID di
// Supabase Dashboard > Edge Functions > notify-lead > Secrets.
// Selama secret belum diisi, function ini diam saja (tidak mengirim apa pun,
// tidak menyebabkan error pada insert lead).

Deno.serve(async (req) => {
  try {
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
    const chatId = Deno.env.get('TELEGRAM_CHAT_ID')
    if (!botToken || !chatId) {
      return new Response(JSON.stringify({ skipped: true, reason: 'Telegram belum dikonfigurasi' }), { status: 200 })
    }

    const payload = await req.json()
    const lead = payload?.record ?? payload

    const services = Array.isArray(lead.services) ? lead.services.join(', ') : lead.services || '-'
    const text = [
      '🔔 *Lead Baru Masuk!*',
      '',
      `👤 Nama: ${lead.name || '-'}`,
      `📱 Telepon: ${lead.phone || '-'}`,
      lead.email ? `📧 Email: ${lead.email}` : null,
      lead.business_name ? `🏢 Bisnis: ${lead.business_name}` : null,
      lead.business_type ? `📂 Jenis Usaha: ${lead.business_type}` : null,
      `🛠️ Layanan: ${services}`,
      lead.scale ? `📊 Skala: ${lead.scale}` : null,
      lead.estimated_total ? `💰 Estimasi: Rp${Number(lead.estimated_total).toLocaleString('id-ID')}` : null,
      lead.consult_date ? `📅 Jadwal: ${lead.consult_date} ${lead.consult_time || ''}` : null,
    ]
      .filter(Boolean)
      .join('\n')

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('Gagal kirim Telegram:', errText)
      return new Response(JSON.stringify({ ok: false, error: errText }), { status: 200 })
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  } catch (err) {
    console.error('notify-lead error:', err)
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 200 })
  }
})
