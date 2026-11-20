// Format sederhana isi section proposal penawaran (dipakai halaman klien &
// PDF supaya hasilnya sama):
//   ## Sub judul            -> sub judul tebal
//   - poin / • poin         -> daftar berbutir
//   1. Judul poin           -> daftar bernomor; baris biasa tepat di bawahnya
//                              menjadi keterangan poin tersebut
//   **teks**                -> tebal (di dalam kalimat)
//   baris kosong            -> pemisah paragraf
export function parseBlocks(text) {
  const blocks = []
  let para = []
  const flushPara = () => {
    if (para.length) blocks.push({ type: 'p', text: para.join(' ') })
    para = []
  }
  const last = () => blocks[blocks.length - 1]
  let inOl = false

  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim()
    if (!line) {
      flushPara()
      inOl = false
      continue
    }
    const h = line.match(/^#{2,3}\s+(.*)$/)
    const ul = line.match(/^[-•●*]\s+(.*)$/)
    const ol = line.match(/^(\d+)[.)]\s+(.*)$/)
    if (h) {
      flushPara()
      inOl = false
      blocks.push({ type: 'h', text: h[1] })
    } else if (ul) {
      flushPara()
      inOl = false
      if (last()?.type === 'ul') last().items.push(ul[1])
      else blocks.push({ type: 'ul', items: [ul[1]] })
    } else if (ol) {
      flushPara()
      inOl = true
      const item = { title: ol[2], desc: '' }
      if (last()?.type === 'ol') last().items.push(item)
      else blocks.push({ type: 'ol', start: Number(ol[1]), items: [item] })
    } else if (inOl && last()?.type === 'ol') {
      const item = last().items[last().items.length - 1]
      item.desc = item.desc ? `${item.desc} ${line}` : line
    } else {
      para.push(line)
    }
  }
  flushPara()
  return blocks
}

// Pecah teks menjadi potongan biasa/tebal berdasarkan **...**.
export function splitBold(text) {
  return String(text || '')
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part) => (part.startsWith('**') && part.endsWith('**') ? { bold: true, text: part.slice(2, -2) } : { bold: false, text: part }))
}

export const stripBold = (text) => String(text || '').replace(/\*\*([^*]+)\*\*/g, '$1')

// Isi placeholder {klien} dengan nama klien.
export const fillClient = (text, clientName) => String(text || '').replace(/\{klien\}/gi, clientName || 'klien')

export const PRICING_MARKER = { type: 'pricing' }
export const isPricing = (s) => s?.type === 'pricing'
