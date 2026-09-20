import { useId, useState } from 'react'

const SPEECH_PHRASES = [
  'Om Swastyastu! Butuh website secepat kilat?',
  'Sistem kami siap bantu bisnis Anda berjalan otomatis!',
  'Iklan dengan ROI optimal? Tim kami ahlinya.',
  'Coba hitung estimasi biaya proyek Anda di bawah!',
  'Desain presisi & berkarakter kuat untuk brand Anda.',
]

// Maskot robot Bali detail: chrome body, badong emas, kampuh endek siber, udeng neon + kuncung.
export default function HeroMascot() {
  const uid = useId()
  const [phraseIndex, setPhraseIndex] = useState(-1)

  const speak = () => setPhraseIndex((i) => (i + 1) % SPEECH_PHRASES.length)

  return (
    <div className="relative mx-auto flex w-full max-w-md flex-col items-center">
      <div className="relative aspect-square w-full">
        <div className="absolute inset-0 animate-spin-slow rounded-full border border-dashed border-gold/20" />
        <div className="absolute inset-10 rounded-full bg-gradient-to-b from-cyan-royal/15 via-ebtblue/20 to-transparent blur-2xl" />

        <button
          type="button"
          onClick={speak}
          aria-label="Sapa maskot Bangsa Media Bali"
          className="group absolute inset-0 flex cursor-pointer flex-col items-center justify-center focus:outline-none"
        >
          {phraseIndex >= 0 && (
            <div className="absolute -top-2 z-20 max-w-[240px] scale-100 rounded-2xl border border-cyan-royal/50 bg-navy-900/95 px-4 py-2.5 text-center text-xs text-cyan-100 shadow-blue-glow backdrop-blur-md transition-transform duration-300 sm:text-sm">
              <span className="font-bold text-gold-soft">Nusa-Bot: </span>
              {SPEECH_PHRASES[phraseIndex]}
              <div className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-cyan-royal/50 bg-navy-900/95" />
            </div>
          )}

          <svg
            viewBox="0 0 400 480"
            className="relative z-10 h-full w-full animate-float drop-shadow-[0_15px_30px_rgba(67,100,247,0.35)] transition-transform duration-300 group-hover:scale-[1.03]"
            role="img"
            aria-labelledby={`${uid}-title`}
          >
            <title id={`${uid}-title`}>Maskot robot Bangsa Media Bali berbusana adat Bali</title>
            <defs>
              <radialGradient id={`${uid}-glow`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#67E8F9" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#0052D4" stopOpacity="0" />
              </radialGradient>
              <linearGradient id={`${uid}-chrome`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F8FAFC" />
                <stop offset="35%" stopColor="#94A3B8" />
                <stop offset="70%" stopColor="#334155" />
                <stop offset="100%" stopColor="#0F172A" />
              </linearGradient>
              <linearGradient id={`${uid}-gold`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFF3B0" />
                <stop offset="45%" stopColor="#D4AF37" />
                <stop offset="100%" stopColor="#B8860B" />
              </linearGradient>
              <linearGradient id={`${uid}-neon`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#67E8F9" />
                <stop offset="100%" stopColor="#0052D4" />
              </linearGradient>
              <linearGradient id={`${uid}-goldEdge`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#B8860B" />
                <stop offset="50%" stopColor="#FFF3B0" />
                <stop offset="100%" stopColor="#B8860B" />
              </linearGradient>
            </defs>

            <circle cx="200" cy="170" r="90" fill={`url(#${uid}-glow)`} opacity="0.3" />

            {/* KAKI & SEPATU */}
            <g>
              <rect x="163" y="440" width="26" height="34" rx="7" fill={`url(#${uid}-chrome)`} stroke="#4364F7" strokeWidth="1.5" />
              <rect x="211" y="440" width="26" height="34" rx="7" fill={`url(#${uid}-chrome)`} stroke="#4364F7" strokeWidth="1.5" />
              <path d="M158 468 h36 l4 10 q-22 8 -44 0 Z" fill="#050B1F" stroke="#67E8F9" strokeWidth="1" />
              <path d="M206 468 h36 l4 10 q-22 8 -44 0 Z" fill="#050B1F" stroke="#67E8F9" strokeWidth="1" />
            </g>

            {/* TORSO, SABUK & KAMEN (SARUNG) EMAS */}
            <g>
              <path d="M135 270 Q200 255 265 270 L272 368 Q200 392 128 368 Z" fill={`url(#${uid}-chrome)`} stroke="#67E8F9" strokeWidth="2" />
              <path d="M158 268 L172 360 M200 262 L200 372 M242 268 L228 360" stroke="#F8FAFC" strokeWidth="1.2" opacity="0.35" />

              <path d="M145 270 Q200 310 255 270 L260 290 Q200 340 140 290 Z" fill={`url(#${uid}-gold)`} stroke="#FFE9A8" strokeWidth="2" />
              <circle cx="200" cy="315" r="7" fill="#67E8F9" className="animate-glow" />
              <circle cx="170" cy="300" r="4" fill="#4364F7" />
              <circle cx="230" cy="300" r="4" fill="#4364F7" />

              <circle cx="200" cy="345" r="22" fill="#050B1F" stroke="#67E8F9" strokeWidth="3" />
              <circle cx="200" cy="345" r="14" fill={`url(#${uid}-neon)`} />
              <polygon points="200,334 209,351 191,351" fill="#ffffff" opacity="0.85" />

              <rect x="150" y="368" width="100" height="14" rx="4" fill={`url(#${uid}-gold)`} stroke="#FFE9A8" strokeWidth="1.5" />
              <circle cx="200" cy="375" r="8" fill="#050B1F" stroke="#FFF3B0" strokeWidth="1.5" />

              <path d="M128 380 Q200 405 272 380 L280 445 Q200 470 120 445 Z" fill="#0A1330" stroke={`url(#${uid}-gold)`} strokeWidth="2.5" />
              <path d="M124 440 Q200 462 276 440 L280 445 Q200 470 120 445 Z" fill={`url(#${uid}-gold)`} opacity="0.9" />
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <rect
                  key={i}
                  x={140 + i * 24}
                  y={444}
                  width="8"
                  height="8"
                  fill="#0A1330"
                  transform={`rotate(45 ${144 + i * 24} 448)`}
                />
              ))}
              <line x1="150" y1="395" x2="180" y2="430" stroke="#D4AF37" strokeWidth="2" strokeDasharray="3,3" />
              <line x1="250" y1="395" x2="220" y2="430" stroke="#D4AF37" strokeWidth="2" strokeDasharray="3,3" />
              <line x1="165" y1="395" x2="200" y2="425" stroke="#67E8F9" strokeWidth="1.5" />
              <line x1="235" y1="395" x2="200" y2="425" stroke="#67E8F9" strokeWidth="1.5" />
            </g>

            {/* PAULDRON (BAHU EMAS) */}
            <g>
              <circle cx="112" cy="262" r="30" fill={`url(#${uid}-gold)`} stroke="#FFF3B0" strokeWidth="2" />
              <circle cx="112" cy="262" r="30" fill="none" stroke={`url(#${uid}-goldEdge)`} strokeWidth="1.5" opacity="0.7" />
              <circle cx="112" cy="262" r="8" fill="#050B1F" stroke="#67E8F9" strokeWidth="1.5" />
              <circle cx="288" cy="262" r="30" fill={`url(#${uid}-gold)`} stroke="#FFF3B0" strokeWidth="2" />
              <circle cx="288" cy="262" r="30" fill="none" stroke={`url(#${uid}-goldEdge)`} strokeWidth="1.5" opacity="0.7" />
              <circle cx="288" cy="262" r="8" fill="#050B1F" stroke="#67E8F9" strokeWidth="1.5" />
            </g>

            {/* HEAD & UDENG */}
            <g>
              <rect x="182" y="240" width="36" height="30" rx="6" fill="#0A1330" stroke="#4364F7" strokeWidth="1.5" />
              <line x1="190" y1="242" x2="190" y2="268" stroke="#67E8F9" strokeWidth="2" />
              <line x1="200" y1="242" x2="200" y2="268" stroke="#D4AF37" strokeWidth="2" />
              <line x1="210" y1="242" x2="210" y2="268" stroke="#67E8F9" strokeWidth="2" />

              <ellipse cx="200" cy="180" rx="64" ry="72" fill={`url(#${uid}-chrome)`} stroke="#4364F7" strokeWidth="2" />

              <path d="M150 155 Q200 142 250 155 Q258 200 248 215 Q200 230 152 215 Q142 200 150 155 Z" fill="#030B1E" stroke="#67E8F9" strokeWidth="2.5" />

              <path d="M165 178 Q180 173 190 180" stroke="#67E8F9" strokeWidth="5" strokeLinecap="round" fill="none" className="animate-glow" />
              <path d="M210 180 Q220 173 235 178" stroke="#67E8F9" strokeWidth="5" strokeLinecap="round" fill="none" className="animate-glow" />
              <circle cx="178" cy="184" r="2" fill="#ffffff" />
              <circle cx="222" cy="184" r="2" fill="#ffffff" />

              <path d="M188 205 Q200 213 212 205" stroke="#4364F7" strokeWidth="3" strokeLinecap="round" fill="none" />

              <path d="M135 140 Q200 115 265 140 L268 122 Q200 95 132 122 Z" fill={`url(#${uid}-gold)`} stroke="#FFE9A8" strokeWidth="2" />
              <circle cx="160" cy="128" r="3" fill="#050B1F" />
              <line x1="163" y1="128" x2="185" y2="128" stroke="#050B1F" strokeWidth="2" />
              <circle cx="240" cy="128" r="3" fill="#050B1F" />
              <line x1="237" y1="128" x2="215" y2="128" stroke="#050B1F" strokeWidth="2" />

              <path d="M188 118 Q195 60 216 45 Q212 78 206 118 Z" fill={`url(#${uid}-gold)`} stroke="#FFF3B0" strokeWidth="2" />
              <line x1="216" y1="45" x2="225" y2="30" stroke="#67E8F9" strokeWidth="3" strokeLinecap="round" />
              <circle cx="226" cy="28" r="4" fill="#67E8F9" className="animate-glow" />

              <g transform="translate(252, 142) scale(0.65)">
                <circle cx="20" cy="20" r="10" fill="#D4AF37" />
                <path d="M20 5 C15 15, 5 15, 20 20 C35 15, 25 15, 20 5" fill="#FFFFFF" stroke="#D4AF37" />
                <path d="M35 20 C25 15, 25 5, 20 20 C25 35, 25 25, 35 20" fill="#FFFFFF" stroke="#D4AF37" />
                <path d="M20 35 C25 25, 35 25, 20 20 C5 25, 15 25, 20 35" fill="#FFFFFF" stroke="#D4AF37" />
                <path d="M5 20 C15 25, 15 35, 20 20 C15 5, 15 15, 5 20" fill="#FFFFFF" stroke="#D4AF37" />
                <circle cx="20" cy="20" r="4" fill="#67E8F9" />
              </g>
            </g>

            {/* GREETING ARM */}
            <g>
              <path d="M292 275 Q345 250 335 210" stroke={`url(#${uid}-chrome)`} strokeWidth="22" strokeLinecap="round" fill="none" />
              <circle cx="335" cy="205" r="14" fill={`url(#${uid}-chrome)`} stroke="#4364F7" strokeWidth="2" />
              <path d="M325 195 L330 165 M336 192 L345 162 M345 196 L358 170 M320 198 L312 185" stroke="#4364F7" strokeWidth="4" strokeLinecap="round" />
              <circle cx="335" cy="190" r="5" fill="#67E8F9" className="animate-glow" />
            </g>
          </svg>
        </button>
      </div>

      <div className="mt-1 flex items-center gap-2 rounded-full border border-cyan-royal/40 bg-navy-900/80 px-4 py-1.5 text-xs font-semibold text-cyan-200 shadow-blue-glow">
        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
        Klik maskot untuk berinteraksi
      </div>
    </div>
  )
}
