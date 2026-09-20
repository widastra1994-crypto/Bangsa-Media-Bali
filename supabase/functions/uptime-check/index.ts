// Edge Function: uptime-check
// Dijalankan otomatis tiap 30 menit via pg_cron. Mengecek status HTTP setiap
// website klien yang terdaftar (acc_digital_assets.website_url), menyimpan
// hasilnya, dan mengirim email peringatan ke tim internal kalau ada yang down.
//
// Catatan: pengecekan masa berlaku sertifikat SSL TIDAK diimplementasikan di
// versi ini -- inspeksi detail sertifikat TLS di runtime Deno Edge Function
// tidak cukup andal/stabil untuk fitur produksi. Uptime check (HTTP status)
// tetap berjalan penuh. Aktivasi email: set RESEND_API_KEY, FROM_EMAIL, dan
// INTERNAL_ALERT_EMAIL (email tim teknis) di Secrets fungsi ini.

import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const resendKey = Deno.env.get('RESEND_API_KEY')
    const fromEmail = Deno.env.get('FROM_EMAIL') || 'onboarding@resend.dev'
    const alertEmail = Deno.env.get('INTERNAL_ALERT_EMAIL')

    const { data: assets } = await supabase
      .from('acc_digital_assets')
      .select('id, website_url, uptime_status, domain_name, project_id, acc_projects(website_name)')
      .not('website_url', 'is', null)
      .in('status', ['active', 'pending_renewal', 'grace_period'])

    const downSites: string[] = []

    for (const asset of assets || []) {
      let newStatus: 'up' | 'down' = 'down'
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 10000)
        const res = await fetch(asset.website_url, { method: 'GET', redirect: 'follow', signal: controller.signal })
        clearTimeout(timeout)
        newStatus = res.ok || (res.status >= 200 && res.status < 400) ? 'up' : 'down'
      } catch {
        newStatus = 'down'
      }

      const wasUp = asset.uptime_status !== 'down'
      await supabase.from('acc_digital_assets').update({ uptime_status: newStatus, last_checked_at: new Date().toISOString() }).eq('id', asset.id)

      if (newStatus === 'down' && wasUp) {
        downSites.push(`${asset.domain_name || asset.acc_projects?.website_name || asset.website_url} (${asset.website_url})`)
      }
    }

    if (downSites.length > 0 && resendKey && alertEmail) {
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
          <h2 style="color:#dc2626;">⚠️ Peringatan: Website Down Terdeteksi</h2>
          <p>Sistem mendeteksi ${downSites.length} website klien tidak merespons normal:</p>
          <ul>${downSites.map((s) => `<li>${s}</li>`).join('')}</ul>
          <p style="font-size:12px;color:#64748b;">Dicek otomatis tiap 30 menit oleh sistem Bangsa Media Bali.</p>
        </div>`
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${resendKey}` },
        body: JSON.stringify({ from: `Bangsa Media Bali Alert <${fromEmail}>`, to: [alertEmail], subject: `⚠️ ${downSites.length} Website Down`, html }),
      }).catch((e) => console.error('Gagal kirim alert:', e))
    }

    return new Response(JSON.stringify({ ok: true, checked: (assets || []).length, down: downSites.length }), { status: 200, headers: { 'content-type': 'application/json' } })
  } catch (err) {
    console.error('uptime-check error:', err)
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 200 })
  }
})
