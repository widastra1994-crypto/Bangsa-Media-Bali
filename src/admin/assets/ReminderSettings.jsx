import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useContent } from '../../context/ContentContext'
import { buildShareText, getReminderSettings, publicInvoiceUrl, resetReminderSettings } from './assetUtils'

const PLACEHOLDERS = [
  ['{pic}', 'nama PIC klien'],
  ['{klien}', 'nama perusahaan klien'],
  ['{layanan}', 'daftar domain/server yang diperpanjang'],
  ['{total}', 'sisa tagihan'],
  ['{nomor}', 'nomor invoice'],
  ['{jatuh_tempo}', 'tanggal jatuh tempo'],
  ['{link}', 'link invoice untuk klien'],
  ['{brand}', 'nama bisnis Anda'],
]

export default function ReminderSettings({ canEdit }) {
  const { content } = useContent()
  const [form, setForm] = useState(null)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getReminderSettings().then((s) => setForm({ renew_days: s.renew_days ?? 30, site_url: s.site_url || '', wa_template: s.wa_template || '' }))
  }, [])

  if (!form) return <p className="mt-4 text-sm text-slate-400">Memuat...</p>

  const save = async () => {
    setBusy(true)
    const { error } = await supabase
      .from('acc_reminder_settings')
      .update({ renew_days: Number(form.renew_days), site_url: form.site_url.trim(), wa_template: form.wa_template, updated_at: new Date().toISOString() })
      .eq('id', 1)
    setBusy(false)
    resetReminderSettings()
    setNotice(error ? `Gagal: ${error.message}` : 'Pengaturan disimpan.')
  }

  const preview = buildShareText({
    template: form.wa_template,
    brand: content.brand?.name,
    invoice: { invoice_number: 'INV-2026-0001', total_amount: 1150000, paid_amount: 0, due_date: '2026-12-01' },
    client: { company_name: 'PT Contoh Klien', pic_name: 'Bapak Budi' },
    items: [
      { label: 'Domain contohklien.com', note: 'Periode 01 Des 2026 - 01 Des 2027' },
      { label: 'Hosting/Server contohklien.com', note: 'Periode 01 Des 2026 - 01 Des 2027' },
    ],
    link: publicInvoiceUrl(form.site_url, '...'),
  })

  return (
    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <div>
          <label className="label-field">Terbitkan invoice otomatis berapa hari sebelum habis</label>
          <input type="number" min="7" max="90" className="input-field !w-32" value={form.renew_days} disabled={!canEdit} onChange={(e) => setForm({ ...form, renew_days: e.target.value })} />
          <p className="mt-1 text-[11px] text-slate-500">
            Invoice dibuat tiap pagi pukul 08.30 WITA dan langsung dikirim ke email klien. Pengingat email menyusul pada H-14, H-7, H-1, hari H, dan H+7
            selama belum dibayar.
          </p>
        </div>
        <div>
          <label className="label-field">Alamat website untuk link invoice</label>
          <input className="input-field" value={form.site_url} disabled={!canEdit} onChange={(e) => setForm({ ...form, site_url: e.target.value })} />
        </div>
        <div>
          <label className="label-field">Template pesan WhatsApp</label>
          <textarea rows={11} className="input-field font-mono text-xs" value={form.wa_template} disabled={!canEdit} onChange={(e) => setForm({ ...form, wa_template: e.target.value })} />
          <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-0.5 text-[11px] text-slate-500 sm:grid-cols-2">
            {PLACEHOLDERS.map(([k, v]) => (
              <p key={k}>
                <code className="text-cyan-300">{k}</code> {v}
              </p>
            ))}
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-3">
            <button type="button" onClick={save} disabled={busy} className="btn-primary !py-2 text-xs disabled:opacity-60">
              {busy ? 'Menyimpan...' : 'Simpan Pengaturan'}
            </button>
            {notice && <span className="text-xs text-cyan-300">{notice}</span>}
          </div>
        )}
      </div>
      <div>
        <p className="label-field">Contoh pesan</p>
        <pre className="whitespace-pre-wrap rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 font-sans text-xs leading-relaxed text-slate-200">{preview}</pre>
      </div>
    </div>
  )
}
