import { useState } from 'react'
import { Send, X } from 'lucide-react'
import { useDisplayContent } from '../context/LanguageContext'
import MascotIcon from './MascotIcon'

function getKeywordReply(text, assistant) {
  const lower = text.toLowerCase()
  const match = assistant.keywordReplies?.find((k) => k.keywords.some((kw) => lower.includes(kw)))
  return match?.reply || assistant.defaultReply
}

// Coba jawab pakai AI (Claude) via serverless function; kalau belum dikonfigurasi
// (ANTHROPIC_API_KEY belum diset) atau gagal karena sebab apa pun, otomatis
// jatuh ke balasan berbasis kata kunci supaya chat tidak pernah terasa error.
async function getBotReply(text, assistant, history) {
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: text, history }),
    })
    if (res.ok) {
      const data = await res.json()
      if (data?.reply) return data.reply
    }
  } catch {
    // Diam-diam jatuh ke fallback di bawah (mis. offline, belum ada endpoint di dev lokal).
  }
  return getKeywordReply(text, assistant)
}

export default function FloatingAssistant() {
  const { content } = useDisplayContent()
  const { calculator, assistant } = content
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [messages, setMessages] = useState(() => [{ from: 'bot', text: assistant.greeting }])

  const waLink = (text) => `https://wa.me/${calculator.whatsappNumber}?text=${encodeURIComponent(text)}`

  const send = async (text) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const history = messages
    setMessages((prev) => [...prev, { from: 'user', text: trimmed }])
    setInput('')
    setThinking(true)
    const reply = await getBotReply(trimmed, assistant, history)
    setThinking(false)
    setMessages((prev) => [...prev, { from: 'bot', text: reply }])
  }

  return (
    <div className="fixed bottom-6 right-5 z-50 flex flex-col items-end gap-3 lg:bottom-8 lg:right-8">
      {open && (
        <div className="glass-panel flex w-80 flex-col overflow-hidden rounded-2xl border border-cyan-royal/50 shadow-blue-glow sm:w-96">
          <div className="flex items-center justify-between border-b border-cyan-royal/30 bg-gradient-to-r from-navy-900 to-navy-800 p-4">
            <div className="flex items-center gap-2.5">
              <MascotIcon variant="assistant" size={36} />
              <div>
                <div className="flex items-center gap-1.5 text-sm font-bold text-white">
                  {assistant.name} <span className="h-2 w-2 rounded-full bg-emerald-400" />
                </div>
                <div className="text-[10px] text-cyan-200">{assistant.subtitle}</div>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="p-1 text-slate-300 hover:text-white" aria-label="Tutup chat">
              <X size={18} />
            </button>
          </div>

          <div className="max-h-72 space-y-3 overflow-y-auto p-4 text-xs">
            {messages.map((m, i) =>
              m.from === 'bot' ? (
                <div key={i} className="flex gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ebtblue text-[10px] text-gold-soft">NB</div>
                  <div className="rounded-2xl rounded-tl-none border border-white/10 bg-navy-900/90 p-3 leading-relaxed text-slate-200">{m.text}</div>
                </div>
              ) : (
                <div key={i} className="flex justify-end gap-2">
                  <div className="max-w-[80%] rounded-2xl rounded-tr-none bg-cyan-royal p-3 text-white">{m.text}</div>
                </div>
              ),
            )}
            {thinking && (
              <div className="flex gap-2">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ebtblue text-[10px] text-gold-soft">NB</div>
                <div className="flex items-center gap-1 rounded-2xl rounded-tl-none border border-white/10 bg-navy-900/90 p-3">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 px-4 pb-3">
            {assistant.quickQuestions?.map((q) =>
              q.isWhatsapp ? (
                <a
                  key={q.id}
                  href={waLink(q.text)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-emerald-800 bg-emerald-950 px-2.5 py-1 text-[10px] text-emerald-300 hover:border-emerald-400"
                >
                  {q.label}
                </a>
              ) : (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => send(q.text)}
                  className="rounded-full border border-blue-800 bg-blue-950 px-2.5 py-1 text-[10px] text-cyan-300 hover:border-cyan-400"
                >
                  {q.label}
                </button>
              ),
            )}
          </div>

          <div className="flex gap-2 border-t border-white/10 bg-navy-950 p-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send(input)}
              placeholder={assistant.inputPlaceholder}
              className="flex-1 rounded-xl border border-white/15 bg-navy-900/90 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-cyan-royal focus:outline-none"
            />
            <button
              type="button"
              onClick={() => send(input)}
              className="rounded-xl bg-cyan-royal px-3.5 py-2 font-bold text-navy-950 hover:bg-cyan-300"
              aria-label="Kirim pesan"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Buka asisten Bangsa Media Bali"
        className="relative flex h-16 w-16 items-center justify-center rounded-full border border-gold/50 bg-navy-900/80 shadow-gold-glow backdrop-blur-xl transition-transform hover:scale-105"
      >
        <span className="absolute inset-0 animate-pulse-slow rounded-full bg-gold/20" />
        {open ? <X className="relative z-10 text-gold-soft" size={22} /> : <MascotIcon variant="assistant" size={48} className="relative z-10" />}
        {!open && <span className="absolute -right-1 -top-1 h-4 w-4 animate-ping rounded-full border-2 border-navy-950 bg-emerald-400" />}
        {!open && <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-navy-950 bg-emerald-400" />}
      </button>
    </div>
  )
}
