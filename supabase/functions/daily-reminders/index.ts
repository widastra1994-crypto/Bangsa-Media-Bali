// Edge Function: daily-reminders
// Dijalankan otomatis 1x/hari via pg_cron (lihat migrasi akunting_phase3_cron_schedule).
// Mengirim notifikasi email berjenjang untuk:
//   A. Perpanjangan Aset Digital: H-60, H-30 (+terbitkan invoice perpanjangan),
//      H-14, H-7, H-1, Hari H (masuk grace period).
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
    // ------------------------------------------------------------------
    const { data: assets } = await supabase
      .from('acc_digital_assets')
      .select('*, acc_projects(id, website_name, client_id, acc_clients(company_name, email))')
      .in('status', ['active', 'pending_renewal', 'grace_period'])
      .not('expiry_date', 'is', null)

    for (const asset of assets || []) {
      const client = asset.acc_projects?.acc_clients
      if (!client?.email) continue
      const daysLeft = daysBetween(asset.expiry_date)
      const assetLabel = asset.domain_name || asset.acc_projects?.website_name || 'Aset Digital'
      const renewalCost = (Number(asset.domain_cost) || 0) + (Number(asset.server_cost) || 0)

      const tryLogStage = async (stage: string) => {
        const { error } = await supabase
          .from('acc_asset_reminder_log')
          .insert({ asset_id: asset.id, stage, expiry_date: asset.expiry_date })
        return !error // false kalau sudah pernah terkirim (unique constraint bentrok)
      }

      if (daysLeft <= 60 && daysLeft > 30) {
        if (await tryLogStage('h60')) {
          const html = wrapEmail(
            brand,
            'Estimasi Perpanjangan Aset Tahun Depan',
            `<p>Yth. <strong>${client.company_name}</strong>,</p>
             <p>Aset digital <strong>${assetLabel}</strong> akan memasuki masa perpanjangan dalam <strong>${daysLeft} hari</strong> (${asset.expiry_date}).</p>
             <p>Estimasi biaya perpanjangan tahun depan: <strong>${idr(renewalCost)}</strong>. Invoice resmi akan kami kirimkan mendekati tanggal jatuh tempo.</p>`,
          )
          if (await sendEmail(client.email, `Estimasi Perpanjangan ${assetLabel}`, html)) assetEmailsSent++
        }
      } else if (daysLeft <= 30 && daysLeft > 14) {
        if (await tryLogStage('h30')) {
          // Terbitkan invoice perpanjangan otomatis + kirim sebagai tagihan resmi.
          const dueDate = new Date().toISOString().slice(0, 10)
          const invoiceType = Number(asset.server_cost) > 0 && !(Number(asset.domain_cost) > 0) ? 'server_renewal' : 'domain_renewal'
          const { data: invRows } = await supabase
            .from('acc_invoices')
            .insert({
              project_id: asset.project_id,
              client_id: asset.acc_projects.client_id,
              invoice_type: invoiceType,
              subtotal: renewalCost,
              total_amount: renewalCost,
              due_date: asset.expiry_date,
              status: 'sent',
            })
            .select()
          const invoice = invRows?.[0]
          await supabase.from('acc_digital_assets').update({ status: 'pending_renewal' }).eq('id', asset.id)
          const html = wrapEmail(
            brand,
            'Surat Tagihan Perpanjangan',
            `<p>Yth. <strong>${client.company_name}</strong>,</p>
             <p>Berikut tagihan resmi perpanjangan <strong>${assetLabel}</strong>, jatuh tempo <strong>${asset.expiry_date}</strong>.</p>
             <p>Nomor Invoice: <strong>${invoice?.invoice_number || '-'}</strong><br/>Total: <strong>${idr(renewalCost)}</strong></p>
             <p>Silakan lakukan pembayaran melalui transfer bank atau QRIS sebelum tanggal jatuh tempo agar layanan tidak terganggu.</p>`,
          )
          if (await sendEmail(client.email, `Invoice Perpanjangan ${assetLabel} - ${invoice?.invoice_number || ''}`, html)) assetEmailsSent++
        }
      } else if (daysLeft <= 14 && daysLeft > 7) {
        if (await tryLogStage('h14')) {
          const html = wrapEmail(
            brand,
            'Konfirmasi Status Pembayaran Perpanjangan',
            `<p>Yth. <strong>${client.company_name}</strong>,</p>
             <p>Kami ingin memastikan status pembayaran tagihan perpanjangan <strong>${assetLabel}</strong> yang jatuh tempo <strong>${asset.expiry_date}</strong>.</p>
             <p>Jika sudah dibayar, abaikan email ini. Jika belum, mohon segera diselesaikan agar layanan tetap aktif.</p>`,
          )
          if (await sendEmail(client.email, `Konfirmasi Pembayaran Perpanjangan ${assetLabel}`, html)) assetEmailsSent++
        }
      } else if (daysLeft <= 7 && daysLeft > 1) {
        if (await tryLogStage('h7')) {
          const html = wrapEmail(
            brand,
            '⚠️ Peringatan: Masa Aktif Akan Berakhir',
            `<p>Yth. <strong>${client.company_name}</strong>,</p>
             <p><strong>${assetLabel}</strong> akan berakhir masa aktifnya dalam <strong>${daysLeft} hari</strong> (${asset.expiry_date}).</p>
             <p>Jika tagihan perpanjangan belum dibayar, website/layanan Anda berisiko disuspend. Mohon segera lakukan pembayaran.</p>`,
          )
          if (await sendEmail(client.email, `PENTING: ${assetLabel} Akan Berakhir dalam ${daysLeft} Hari`, html)) assetEmailsSent++
        }
      } else if (daysLeft === 1) {
        if (await tryLogStage('h1')) {
          const html = wrapEmail(
            brand,
            '🚨 Peringatan Terakhir: Besok Masa Aktif Berakhir',
            `<p>Yth. <strong>${client.company_name}</strong>,</p>
             <p>Ini adalah peringatan terakhir. <strong>${assetLabel}</strong> akan berakhir <strong>besok (${asset.expiry_date})</strong>.</p>
             <p>Mohon segera lakukan pembayaran hari ini untuk menghindari gangguan layanan.</p>`,
          )
          if (await sendEmail(client.email, `URGENT: ${assetLabel} Berakhir Besok`, html)) assetEmailsSent++
        }
      } else if (daysLeft <= 0) {
        if (await tryLogStage('h0')) {
          await supabase.from('acc_digital_assets').update({ status: 'grace_period' }).eq('id', asset.id)
          const html = wrapEmail(
            brand,
            'Layanan Memasuki Masa Tenggang',
            `<p>Yth. <strong>${client.company_name}</strong>,</p>
             <p><strong>${assetLabel}</strong> telah memasuki masa tenggang (grace period) karena masa aktif telah berakhir pada ${asset.expiry_date}.</p>
             <p>Segera lakukan pembayaran untuk menghindari penghentian layanan permanen.</p>`,
          )
          if (await sendEmail(client.email, `${assetLabel} Memasuki Masa Tenggang`, html)) assetEmailsSent++
        }
      }
    }

    // ------------------------------------------------------------------
    // B. PENGINGAT PIUTANG & TERMIN PROYEK
    // ------------------------------------------------------------------
    const { data: invoices } = await supabase
      .from('acc_invoices')
      .select('*, acc_clients(company_name, email), acc_projects(website_name)')
      .in('status', ['sent', 'partial', 'overdue'])
      .not('due_date', 'is', null)

    for (const inv of invoices || []) {
      const client = inv.acc_clients
      if (!client?.email) continue
      const outstanding = Number(inv.total_amount) - Number(inv.paid_amount)
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
