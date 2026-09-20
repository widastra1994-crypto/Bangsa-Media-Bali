import { useId } from 'react'
import { Code2, Database, Megaphone, Palette, Sparkles, MessageCircle } from 'lucide-react'

const VARIANTS = {
  dev: {
    head: ['#0052D4', '#4364F7'],
    eye: '#7DD3FC',
    Icon: Code2,
    iconColor: '#E0F2FE',
  },
  erp: {
    head: ['#B8912C', '#D4AF37'],
    eye: '#22D3EE',
    Icon: Database,
    iconColor: '#FDF6E3',
  },
  ads: {
    head: ['#6D28D9', '#C026D3'],
    eye: '#FDE68A',
    Icon: Megaphone,
    iconColor: '#FDF4FF',
  },
  design: {
    head: ['#0D9488', '#34D399'],
    eye: '#FDE68A',
    Icon: Palette,
    iconColor: '#ECFDF5',
  },
  assistant: {
    head: ['#D4AF37', '#FFD86B'],
    eye: '#4364F7',
    Icon: MessageCircle,
    iconColor: '#050B1F',
  },
  default: {
    head: ['#0052D4', '#D4AF37'],
    eye: '#67E8F9',
    Icon: Sparkles,
    iconColor: '#FDF6E3',
  },
}

// Ikon maskot robot Bali: setiap varian punya warna, aksen, dan lambang dada berbeda.
export default function MascotIcon({ variant = 'default', size = 64, animated = false, className = '' }) {
  const uid = useId()
  const cfg = VARIANTS[variant] || VARIANTS.default
  const { Icon } = cfg
  const iconSize = Math.max(12, size * 0.24)

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center ${animated ? 'animate-float' : ''} ${className}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" width="100%" height="100%" role="img" aria-hidden="true">
        <defs>
          <linearGradient id={`${uid}-head`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={cfg.head[0]} />
            <stop offset="100%" stopColor={cfg.head[1]} />
          </linearGradient>
          <linearGradient id={`${uid}-body`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0A1330" />
            <stop offset="100%" stopColor="#030816" />
          </linearGradient>
          <radialGradient id={`${uid}-glow`}>
            <stop offset="0%" stopColor={cfg.eye} stopOpacity="0.9" />
            <stop offset="100%" stopColor={cfg.eye} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* aura belakang */}
        <circle cx="50" cy="50" r="46" fill={`url(#${uid}-glow)`} opacity="0.18" />

        {/* badan/bust */}
        <path d="M16,99 L31,64 H69 L84,99 Z" fill={`url(#${uid}-body)`} stroke="#ffffff20" strokeWidth="1" />

        {/* selempang endek (sash) diagonal dengan motif diamond */}
        <path d="M32,64 L46,99 L38,99 L26,68 Z" fill="#D4AF37" opacity="0.9" />
        {[0, 1, 2, 3].map((i) => (
          <rect
            key={i}
            x={31 + i * 3.6}
            y={70 + i * 8.6}
            width="4.2"
            height="4.2"
            fill="#030816"
            opacity="0.55"
            transform={`rotate(45 ${33 + i * 3.6} ${72 + i * 8.6})`}
          />
        ))}

        {/* leher */}
        <rect x="42" y="58" width="16" height="8" rx="2" fill="#0A1330" />

        {/* kepala */}
        <rect x="24" y="18" width="52" height="44" rx="16" fill={`url(#${uid}-head)`} stroke="#ffffff30" strokeWidth="1" />

        {/* mata */}
        <circle cx="39" cy="40" r="4.2" fill={cfg.eye} className={animated ? 'animate-glow' : ''} />
        <circle cx="61" cy="40" r="4.2" fill={cfg.eye} className={animated ? 'animate-glow' : ''} />

        {/* grille mulut */}
        <rect x="40" y="49" width="20" height="2.4" rx="1.2" fill="#030816" opacity="0.55" />

        {/* udeng (ikat kepala Bali) bercahaya */}
        <path
          d="M20,24 Q50,-6 80,24 Q50,10 20,24 Z"
          fill="#D4AF37"
          stroke="#FFE9A8"
          strokeWidth="1"
        />
        <path d="M28,20 Q50,4 72,20" fill="none" stroke="#4364F7" strokeWidth="1.2" opacity="0.85" />
        <circle cx="50" cy="6" r="3" fill="#67E8F9" className={animated ? 'animate-glow' : ''} />

        {/* antena */}
        <line x1="50" y1="3" x2="50" y2="-6" stroke="#D4AF37" strokeWidth="1.5" />
        <circle cx="50" cy="-7" r="2" fill={cfg.eye} />

        {/* emblem dada */}
        <circle cx="50" cy="83" r="10.5" fill="#050B1F" stroke="#D4AF37" strokeWidth="1.4" />
      </svg>
      <Icon
        size={iconSize}
        color={cfg.iconColor}
        strokeWidth={2.4}
        className="absolute"
        style={{ top: '76%', left: '50%', transform: 'translate(-50%, -50%)' }}
      />
    </div>
  )
}
