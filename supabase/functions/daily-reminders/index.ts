// Edge Function: daily-reminders
// Dijalankan otomatis 1x/hari via pg_cron (lihat migrasi akunting_phase3_cron_schedule).
// Mengirim notifikasi email berjenjang untuk:
//   A. Perpanjangan Aset Digital: estimasi H-60, lalu invoice perpanjangan
//      (diterbitkan database) saat terbit, H-14, H-7, H-1, hari H, H+7.
//   B. Piutang/Termin Proyek: H-3, Hari H, H+3, H+7 (overdue).
// Pakai SERVICE ROLE key secara internal (bypass RLS) karena ini job sistem
// terjadwal, bukan request dari user yang login.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const idr = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0)

function daysBetween(dateStr: string) {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00Z')
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function wrapEmail(brand: string, heading: string, bodyHtml: string) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a;">
      <div style="background:#020617;padding:24px;border-radius:12px 12px 0 0;">
        <h1 style="color:#fbbf24;margin:0;font-size:20px;">${brand}</h1>
      </div>
      <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px;">
        <h2 style="margin-top:0;">${heading}</h2>
        ${bodyHtml}
        <p style="margin-top:24px;font-size:13px;color:#64748b;">Email ini dikirim otomatis oleh sistem ${brand}. Balas email ini jika ada pertanyaan.</p>
      </div>
    </div>`
}

Deno.serve(async (req) => {
  try {
    const resendKey = Deno.env.get('RESEND_API_KEY')
    const fromEmail = Deno.env.get('FROM_EMAIL') || 'onboarding@resend.dev'
    const brand = 'Bangsa Media Bali'

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    if (!resendKey) {
      return new Response(JSON.stringify({ ok: false, error: 'RESEND_API_KEY belum diset, reminder dilewati.' }), { status: 200 })
    }

    const sendEmail = async (to: string, subject: string, html: string) => {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${resendKey}` },
        body: JSON.stringify({ from: `${brand} <${fromEmail}>`, to: [to], subject, html }),
      })
      if (!res.ok) console.error('Resend error:', await res.text())
      return res.ok
    }

    let assetEmailsSent = 0
    let invoiceEmailsSent = 0

    // ------------------------------------------------------------------
    // A. PENGINGAT PERPANJANGAN ASET DIGITAL
    // Invoice perpanjangan, notifikasi lonceng & status masa tenggang dibuat
    // oleh fungsi database asset_daily_maintenance() (pg_cron 08.30 WITA).
    // Di sini hanya mengirim email ke klien.
    // ------------------------------------------------------------------
    const { data: settings } = await supabase.from('acc_reminder_settings').select('site_url').eq('id', 1).maybeSingle()
    const siteUrl = (settings?.site_url || 'https://bangsamediabali.com').replace(/\/$/, '')
    const typeLabel = (t: string) =>
      ({ domain: 'Domain', server: 'Hosting/Server', ssl: 'SSL', email: 'Email Bisnis', subscription: 'Langganan/Lisensi' } as Record<string, string>)[t] || 'Layanan'

    // A1. H-60: estimasi biaya perpanjangan.
    const { data: assets } = await supabase
      .from('acc_digital_assets')
      .select('id, asset_type, domain_name, expiry_date, sell_price, cost_price, acc_clients(company_name, email)')
      .in('status', ['active', 'pending_renewal'])
      .not('expiry_date', 'is', null)

    for (const asset of assets || []) {
      const client = asset.acc_clients
      if (!client?.email) continue
      const daysLeft = daysBetween(asset.expiry_date)
      if (daysLeft > 60 || daysLeft <= 30) continue
      const { error: logErr } = await supabase
        .from('acc_asset_reminder_log')
        .insert({ asset_id: asset.id, stage: 'h60', expiry_date: asset.expiry_date })
      if (logErr) continue // sudah pernah terkirim siklus ini
      const label = `${typeLabel(asset.asset_type)} ${asset.domain_name || ''}`.trim()
      const price = Number(asset.sell_price) || Number(asset.cost_price) || 0
      const html = wrapEmail(
        brand,
        'Estimasi Perpanjangan Layanan',
        `<p>Yth. <strong>${client.company_name}</strong>,</p>
         <p>Layanan <strong>${label}</strong> akan berakhir dalam <strong>${daysLeft} hari</strong> (${asset.expiry_date}).</p>
         <p>Estimasi biaya perpanjangan: <strong>${idr(price)}</strong>. Invoice resmi akan kami kirimkan 30 hari sebelum masa aktif berakhir.</p>`,
      )
      if (await sendEmail(client.email, `Estimasi Perpanjangan ${label}`, html)) assetEmailsSent++
    }

    // A2. Invoice perpanjangan: kirim saat terbit, lalu H-14, H-7, H-1, hari H, dan H+7.
    const { data: renewalInvoices } = await supabase
      .from('acc_invoices')
      .select('*, acc_clients(company_name, email), acc_asset_renewals(sell_price, period_start, period_end, status, lines, acc_digital_assets(asset_type, domain_name))')
      .in('invoice_type', ['domain_renewal', 'server_renewal'])
      .in('status', ['sent', 'partial', 'overdue'])

    for (const inv of renewalInvoices || []) {
      const items = (inv.acc_asset_renewals || []).filter((r: { status: string }) => r.status !== 'cancelled')
      if (items.length === 0) continue
      const client = inv.acc_clients
      if (!client?.email) continue
      const outstanding = Number(inv.total_amount) - Number(inv.pph23_amount || 0) - Number(inv.paid_amount)
      if (outstanding <= 0) continue
      const daysLeft = inv.due_date ? daysBetween(inv.due_date) : 0

      if (daysLeft < 0 && inv.status !== 'overdue') {
        await supabase.from('acc_invoices').update({ status: 'overdue' }).eq('id', inv.id)
      }

      const stage = daysLeft <= -7 ? 'r+7' : daysLeft <= 0 ? 'r-0' : daysLeft <= 1 ? 'r-1' : daysLeft <= 7 ? 'r-7' : daysLeft <= 14 ? 'r-14' : null
      const { data: sentLogs } = await supabase.from('acc_invoice_reminder_log').select('stage').eq('invoice_id', inv.id)
      const sent = new Set((sentLogs || []).map((l: { stage: string }) => l.stage))
      const isFirst = !sent.has('r-issued')
      if (!isFirst && (!stage || sent.has(stage))) continue

      const link = `${siteUrl}/invoice/${inv.public_token}`
      type RenewalRow = {
        sell_price: number
        period_start: string
        period_end: string
        lines?: { description: string; sell_price: number }[]
        acc_digital_assets: { asset_type: string; domain_name: string }
      }
      // Setiap baris rincian perpanjangan tampil sendiri; perpanjangan lama tanpa rincian = satu baris.
      const rows = items
        .flatMap((r: RenewalRow) =>
          (r.lines?.length
            ? r.lines.map((l) => ({ label: l.description, amount: Number(l.sell_price) }))
            : [{ label: `${typeLabel(r.acc_digital_assets?.asset_type)} ${r.acc_digital_assets?.domain_name || ''}`, amount: Number(r.sell_price) }]
          ).map((l) => ({ ...l, period: `${r.period_start} s/d ${r.period_end}` })),
        )
        .map(
          (l: { label: string; amount: number; period: string }) => `
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #eee;">${l.label}<br/>
                <span style="font-size:12px;color:#64748b;">Periode ${l.period}</span></td>
              <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">${idr(l.amount)}</td>
            </tr>`,
        )
        .join('')
      const when =
        daysLeft > 1 ? `jatuh tempo dalam <strong>${daysLeft} hari</strong> (${inv.due_date})`
        : daysLeft === 1 ? `jatuh tempo <strong>besok</strong> (${inv.due_date})`
        : daysLeft === 0 ? `jatuh tempo <strong>hari ini</strong>`
        : `telah melewati jatuh tempo <strong>${Math.abs(daysLeft)} hari</strong>. Layanan berisiko dihentikan`
      const heading = isFirst ? 'Invoice Perpanjangan Layanan' : daysLeft < 0 ? 'Layanan Melewati Masa Aktif' : 'Pengingat Perpanjangan Layanan'
      const html = wrapEmail(
        brand,
        heading,
        `<p>Yth. <strong>${client.company_name}</strong>,</p>
         <p>Tagihan perpanjangan <strong>${inv.invoice_number}</strong> ${when}.</p>
         <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
           ${rows}
           <tr><td style="padding:12px 0;font-weight:bold;">Sisa tagihan</td><td style="padding:12px 0;text-align:right;font-weight:bold;">${idr(outstanding)}</td></tr>
         </table>
         <p style="text-align:center;margin:24px 0;"><a href="${link}" style="background:#0f62fe;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold;">Lihat &amp; Unduh Invoice</a></p>
         <p style="font-size:13px;color:#64748b;">Jika sudah membayar, abaikan email ini.</p>`,
      )
      const subject = isFirst ? `Invoice Perpanjangan ${inv.invoice_number}` : `Pengingat: Invoice Perpanjangan ${inv.invoice_number}`
      if (await sendEmail(client.email, subject, html)) {
        invoiceEmailsSent++
        const logs = isFirst ? ['r-issued', stage].filter(Boolean) : [stage]
        for (const s of logs) await supabase.from('acc_invoice_reminder_log').insert({ invoice_id: inv.id, stage: s })
        await supabase.from('acc_invoice_shares').insert({ invoice_id: inv.id, channel: 'auto_email', shared_by: null })
      }
    }

    // ------------------------------------------------------------------
    // B. PENGINGAT PIUTANG & TERMIN PROYEK
    // ------------------------------------------------------------------
    const { data: invoices } = await supabase
      .from('acc_invoices')
      .select('*, acc_clients(company_name, email), acc_projects(website_name), acc_asset_renewals(id)')
      .in('status', ['sent', 'partial', 'overdue'])
      .not('due_date', 'is', null)

    for (const inv of invoices || []) {
      const client = inv.acc_clients
      if (!client?.email) continue
      // Invoice perpanjangan aset sudah diurus di bagian A.
      if (inv.acc_asset_renewals?.length) continue
      const outstanding = Number(inv.total_amount) - Number(inv.pph23_amount || 0) - Number(inv.paid_amount)
      if (outstanding <= 0) continue
      const daysLeft = daysBetween(inv.due_date)
      const label = inv.acc_projects?.website_name || inv.invoice_number

      const tryLogStage = async (stage: string) => {
        const { error } = await supabase.from('acc_invoice_reminder_log').insert({ invoice_id: inv.id, stage })
        return !error
      }

      if (daysLeft < 0 && inv.status !== 'overdue') {
        await supabase.from('acc_invoices').update({ status: 'overdue' }).eq('id', inv.id)
      }

      if (daysLeft <= 3 && daysLeft > 0) {
        if (await tryLogStage('h-3')) {
          const html = wrapEmail(
            brand,
            'Pengingat Pelunasan',
            `<p>Yth. <strong>${client.company_name}</strong>,</p>
             <p>Invoice <strong>${inv.invoice_number}</strong> (${label}) sebesar <strong>${idr(outstanding)}</strong> akan jatuh tempo dalam ${daysLeft} hari (${inv.due_date}).</p>`,
          )
          if (await sendEmail(client.email, `Pengingat Pelunasan Invoice ${inv.invoice_number}`, html)) invoiceEmailsSent++
        }
      } else if (daysLeft === 0) {
        if (await tryLogStage('h0')) {
          const html = wrapEmail(
            brand,
            'Jatuh Tempo Hari Ini',
            `<p>Yth. <strong>${client.company_name}</strong>,</p>
             <p>Invoice <strong>${inv.invoice_number}</strong> (${label}) sebesar <strong>${idr(outstanding)}</strong> jatuh tempo <strong>hari ini</strong>.</p>`,
          )
          if (await sendEmail(client.email, `Jatuh Tempo Hari Ini: Invoice ${inv.invoice_number}`, html)) invoiceEmailsSent++
        }
      } else if (daysLeft <= -3 && daysLeft > -7) {
        if (await tryLogStage('h+3')) {
          const html = wrapEmail(
            brand,
            'Pemberitahuan Keterlambatan Pembayaran',
            `<p>Yth. <strong>${client.company_name}</strong>,</p>
             <p>Invoice <strong>${inv.invoice_number}</strong> (${label}) sebesar <strong>${idr(outstanding)}</strong> telah melewati jatuh tempo ${Math.abs(daysLeft)} hari.</p>
             <p>Mohon segera diselesaikan.</p>`,
          )
          if (await sendEmail(client.email, `Keterlambatan Pembayaran: Invoice ${inv.invoice_number}`, html)) invoiceEmailsSent++
        }
      } else if (daysLeft <= -7) {
        if (await tryLogStage('h+7')) {
          const html = wrapEmail(
            brand,
            'Peringatan Keterlambatan Pembayaran',
            `<p>Yth. <strong>${client.company_name}</strong>,</p>
             <p>Invoice <strong>${inv.invoice_number}</strong> (${label}) sebesar <strong>${idr(outstanding)}</strong> telah menunggak ${Math.abs(daysLeft)} hari sejak jatuh tempo.</p>
             <p>Mohon segera hubungi kami untuk menyelesaikan tagihan ini.</p>`,
          )
          if (await sendEmail(client.email, `PENTING: Tunggakan Invoice ${inv.invoice_number}`, html)) invoiceEmailsSent++
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, assetEmailsSent, invoiceEmailsSent }), { status: 200, headers: { 'content-type': 'application/json' } })
  } catch (err) {
    console.error('daily-reminders error:', err)
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 200 })
  }
})
