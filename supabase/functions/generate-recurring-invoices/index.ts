// Edge Function: generate-recurring-invoices
// Dijalankan otomatis tiap hari via pg_cron. Untuk setiap langganan retainer
// aktif (acc_subscriptions) yang sudah lewat tanggal tagih bulan ini dan
// belum ditagih di bulan berjalan, terbitkan invoice baru (invoice_type
// 'recurring_retainer') dan kirim ke email klien. Anti-duplikat lewat kolom
// last_invoiced_period (ditandai per-bulan, bukan per-tanggal, supaya kalau
// cron telat jalan satu-dua hari tetap tidak menagih dobel di bulan sama).

import { createClient } from 'jsr:@supabase/supabase-js@2'

const idr = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0)

function firstOfMonth(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10)
}

Deno.serve(async (req) => {
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const resendKey = Deno.env.get('RESEND_API_KEY')
    const fromEmail = Deno.env.get('FROM_EMAIL') || 'onboarding@resend.dev'
    const brand = 'Bangsa Media Bali'

    const now = new Date()
    const today = now.toISOString().slice(0, 10)
    const currentDay = now.getUTCDate()
    const currentPeriod = firstOfMonth(now)

    const { data: subs, error: subsErr } = await supabase
      .from('acc_subscriptions')
      .select('*, acc_clients(company_name, email)')
      .eq('status', 'active')
      .lte('start_date', today)

    if (subsErr) throw subsErr

    let created = 0
    const results: Record<string, unknown>[] = []

    for (const sub of subs || []) {
      if (sub.end_date && sub.end_date < today) continue // sudah lewat masa berlaku
      if (sub.last_invoiced_period === currentPeriod) continue // sudah ditagih bulan ini
      if (currentDay < sub.billing_day) continue // belum waktunya tagih bulan ini

      const dueDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

      const { data: invRows, error: invErr } = await supabase
        .from('acc_invoices')
        .insert({
          project_id: sub.project_id || null,
          client_id: sub.client_id,
          invoice_type: 'recurring_retainer',
          subtotal: sub.amount,
          total_amount: sub.amount,
          due_date: dueDate,
          status: 'sent',
        })
        .select()
      if (invErr) {
        results.push({ subscription: sub.id, error: invErr.message })
        continue
      }
      const invoice = invRows[0]

      await supabase.from('acc_subscriptions').update({ last_invoiced_period: currentPeriod }).eq('id', sub.id)
      created++

      const client = sub.acc_clients
      if (client?.email && resendKey) {
        const html = `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a;">
            <div style="background:#020617;padding:24px;border-radius:12px 12px 0 0;"><h1 style="color:#fbbf24;margin:0;font-size:20px;">${brand}</h1></div>
            <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px;">
              <h2 style="margin-top:0;">Tagihan Bulanan: ${sub.service_name}</h2>
              <p>Yth. <strong>${client.company_name}</strong>,</p>
              <p>Berikut tagihan rutin bulanan untuk layanan <strong>${sub.service_name}</strong>.</p>
              <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
                <tr><td style="padding:8px 0;color:#64748b;">Nomor Invoice</td><td style="padding:8px 0;text-align:right;font-weight:bold;">${invoice.invoice_number}</td></tr>
                <tr><td style="padding:12px 0;font-weight:bold;border-top:2px solid #0f172a;">Total</td><td style="padding:12px 0;text-align:right;font-weight:bold;border-top:2px solid #0f172a;">${idr(sub.amount)}</td></tr>
                <tr><td style="padding:8px 0;color:#64748b;">Jatuh Tempo</td><td style="padding:8px 0;text-align:right;">${dueDate}</td></tr>
              </table>
              <p style="margin-top:24px;font-size:13px;color:#64748b;">Email ini dikirim otomatis oleh sistem ${brand}.</p>
            </div>
          </div>`
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'content-type': 'application/json', Authorization: `Bearer ${resendKey}` },
          body: JSON.stringify({ from: `${brand} <${fromEmail}>`, to: [client.email], subject: `Tagihan Bulanan ${sub.service_name} - ${invoice.invoice_number}`, html }),
        }).catch((e) => console.error('Gagal kirim email retainer:', e))
      }

      results.push({ subscription: sub.id, invoice: invoice.invoice_number })
    }

    return new Response(JSON.stringify({ ok: true, created, results }), { status: 200, headers: { 'content-type': 'application/json' } })
  } catch (err) {
    console.error('generate-recurring-invoices error:', err)
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 200 })
  }
})
