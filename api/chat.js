// Vercel Serverless Function: chatbot AI Nusa-Bot.
// Menerima { message, history } dari FloatingAssistant, membangun system prompt
// dari konten CMS terkini (Supabase site_content, public-read), lalu memanggil
// Anthropic Messages API. Kalau ANTHROPIC_API_KEY belum diset, kembalikan 501
// supaya frontend otomatis jatuh ke balasan kata-kunci (tidak pernah error ke user).

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5'

async function fetchSiteContent() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/site_content?id=eq.1&select=data`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    })
    if (!res.ok) return null
    const rows = await res.json()
    return rows?.[0]?.data || null
  } catch {
    return null
  }
}

function buildSystemPrompt(content) {
  const brand = content?.brand?.name || 'Bangsa Media Bali'
  const services = content?.services?.items || []
  const categories = content?.pricing?.categories || []
  const contact = content?.contact || {}
  const wa = content?.calculator?.whatsappNumber || ''

  const serviceLines = services.map((s) => `- ${s.title}: ${s.description}`).join('\n')
  const pricingLines = categories
    .map((c) => {
      const tierLines = c.tiers.map((t) => `${t.name} (mulai Rp${t.price.toLocaleString('id-ID')}${t.billingNote || ''})`).join(', ')
      return `- ${c.label}: ${tierLines}`
    })
    .join('\n')

  return `Kamu adalah "Nusa-Bot", asisten digital resmi ${brand}, sebuah agensi IT di Bali yang memadukan teknologi modern dengan kearifan lokal Bali.

Gunakan informasi berikut untuk menjawab pertanyaan pengunjung website secara akurat:

LAYANAN UTAMA:
${serviceLines || '- Website, Sistem/ERP/POS, Iklan Digital, UI/UX Design'}

PAKET HARGA (estimasi mulai dari):
${pricingLines || 'Hubungi tim untuk info harga.'}

KONTAK:
- Alamat: ${contact.address || '-'}
- Telepon/WhatsApp: ${contact.phone || '-'}
- Email: ${contact.email || '-'}
- Jam Operasional: ${contact.hours || '-'}

ATURAN JAWABAN:
- Jawab dalam Bahasa Indonesia yang ramah dan profesional, kecuali pengunjung bertanya dalam Bahasa Inggris.
- Jawaban singkat, maksimal 3-4 kalimat, gunakan poin bila perlu.
- Jangan mengarang harga di luar data di atas. Untuk estimasi biaya presisi, arahkan ke fitur "Kalkulator Estimasi Biaya" di halaman ini.
- Untuk pertanyaan yang butuh diskusi lebih lanjut, tawarkan lanjut ke WhatsApp (${wa ? `https://wa.me/${wa}` : 'tombol Chat Tim via WA'}).
- Jangan pernah membahas topik di luar layanan ${brand} (IT, website, sistem, iklan digital, desain).`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    res.status(501).json({ error: 'AI belum dikonfigurasi (ANTHROPIC_API_KEY belum diset).' })
    return
  }

  const { message, history } = req.body || {}
  if (!message || typeof message !== 'string' || message.length > 800) {
    res.status(400).json({ error: 'Pesan tidak valid.' })
    return
  }

  const safeHistory = Array.isArray(history)
    ? history
        .slice(-8)
        .filter((m) => m && typeof m.text === 'string' && (m.from === 'user' || m.from === 'bot'))
        .map((m) => ({ role: m.from === 'user' ? 'user' : 'assistant', content: m.text.slice(0, 800) }))
    : []

  try {
    const content = await fetchSiteContent()
    const systemPrompt = buildSystemPrompt(content)

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 400,
        system: systemPrompt,
        messages: [...safeHistory, { role: 'user', content: message }],
      }),
    })

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text()
      console.error('Anthropic API error:', anthropicRes.status, errText)
      res.status(502).json({ error: 'Gagal menghubungi layanan AI.' })
      return
    }

    const data = await anthropicRes.json()
    const reply = data?.content?.[0]?.text?.trim()
    if (!reply) {
      res.status(502).json({ error: 'Respons AI kosong.' })
      return
    }

    res.status(200).json({ reply })
  } catch (err) {
    console.error('Chat handler error:', err)
    res.status(500).json({ error: 'Terjadi kesalahan pada server.' })
  }
}
