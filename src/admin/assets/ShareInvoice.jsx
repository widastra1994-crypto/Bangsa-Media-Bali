import { useState } from 'react'
import { Check, Link2, Mail, MessageCircle } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { sendFinanceEmail } from '../../lib/financeEmail'
import { invoiceOutstanding } from '../../lib/invoiceUtils'
import { useContent } from '../../context/ContentContext'
import { buildShareText, fetchInvoiceItems, getReminderSettings, logShare, publicInvoiceUrl, waPhone } from './assetUtils'

const currentUserId = async () => (await supabase.auth.getSession()).data?.session?.user?.id

// Tombol bagikan invoice ke klien: WhatsApp (membuka WA dengan pesan siap
// kirim), email resmi, dan salin link invoice publik. Setiap aksi dicatat.
// `invoice` minimal berisi id, invoice_number, total_amount, paid_amount,
// pph23_amount, due_date, public_token; `client` berisi company_name,
// pic_name, email, phone_primary.
export default function ShareInvoice({ invoice, client, compact = false, onShared }) {
  const { content } = useContent()
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')

  const prepare = async () => {
    const [settings, items] = await Promise.all([getReminderSettings(), fetchInvoiceItems(invoice.id)])
    const link = publicInvoiceUrl(settings.site_url, invoice.public_token)
    return { settings, items, link }
  }

  const done = async (channel, message) => {
    await logShare(invoice.id, channel, await currentUserId())
    setNotice(message)
    onShared?.(channel)
    setTimeout(() => setNotice(''), 4000)
  }

  const shareWa = async () => {
    // Buka jendela dulu (sinkron dengan klik) supaya tidak diblokir browser.
    const win = window.open('', '_blank')
    setBusy('wa')
    try {
      const { settings, items, link } = await prepare()
      const text = buildShareText({ template: settings.wa_template, brand: content.brand?.name, invoice, client, items, link })
      const phone = waPhone(client?.phone_primary)
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
      if (win) win.location.href = url
      else window.location.href = url
      await done('whatsapp', phone ? 'WhatsApp dibuka, tinggal tekan kirim.' : 'Nomor HP klien kosong: pilih kontak di WhatsApp.')
    } catch (e) {
      win?.close()
      setNotice(`Gagal: ${e.message}`)
    } finally {
      setBusy('')
    }
  }

  const shareEmail = async () => {
    if (!client?.email) return setNotice('Email klien belum diisi di data klien.')
    setBusy('email')
    try {
      const { items, link } = await prepare()
      const res = await sendFinanceEmail({
        type: 'invoice',
        to: client.email,
        clientName: client.company_name,
        brandName: content.brand?.name,
        docNumber: invoice.invoice_number,
        amount: invoiceOutstanding(invoice),
        dueDate: invoice.due_date,
        items: items.length ? items.map((it) => ({ label: it.note ? `${it.label} (${it.note})` : it.label, amount: it.amount })) : undefined,
        link,
      })
      if (!res.ok) throw new Error(res.error || 'periksa konfigurasi email')
      await done('email', `Email terkirim ke ${client.email}.`)
    } catch (e) {
      setNotice(`Gagal kirim email: ${e.message}`)
    } finally {
      setBusy('')
    }
  }

  const copyLink = async () => {
    setBusy('link')
    try {
      const { link } = await prepare()
      await navigator.clipboard.writeText(link)
      await done('link', 'Link invoice disalin.')
    } catch (e) {
      setNotice(`Gagal menyalin: ${e.message}`)
    } finally {
      setBusy('')
    }
  }

  const btn = compact ? 'btn-secondary !px-2 !py-1 text-[11px]' : 'btn-secondary !px-3 !py-1.5 text-xs'
  const size = compact ? 12 : 13

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={shareWa} disabled={!!busy} className={`${btn} disabled:opacity-60`} title="Kirim lewat WhatsApp">
        <MessageCircle size={size} className="text-emerald-500" /> {busy === 'wa' ? 'Membuka...' : 'WhatsApp'}
      </button>
      <button type="button" onClick={shareEmail} disabled={!!busy} className={`${btn} disabled:opacity-60`} title="Kirim email ke klien">
        <Mail size={size} /> {busy === 'email' ? 'Mengirim...' : 'Email'}
      </button>
      <button type="button" onClick={copyLink} disabled={!!busy} className={`${btn} disabled:opacity-60`} title="Salin link invoice">
        <Link2 size={size} /> Salin Link
      </button>
      {notice && (
        <span className="flex items-center gap-1 text-[11px] text-cyan-300">
          <Check size={11} /> {notice}
        </span>
      )}
    </div>
  )
}
