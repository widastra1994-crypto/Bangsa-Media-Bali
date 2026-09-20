import { useId } from 'react'

// Motif garis data/sirkuit bercahaya untuk kesan premium & berteknologi di latar section.
export default function CircuitWaves({ className = '', opacity = 1 }) {
  const uid = useId()

  return (
    <svg
      viewBox="0 0 1440 500"
      preserveAspectRatio="none"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      style={{ opacity }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${uid}-line1`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#4364F7" stopOpacity="0" />
          <stop offset="45%" stopColor="#67E8F9" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${uid}-line2`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#D4AF37" stopOpacity="0" />
          <stop offset="55%" stopColor="#4364F7" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#67E8F9" stopOpacity="0" />
        </linearGradient>
        <filter id={`${uid}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g filter={`url(#${uid}-glow)`}>
        <path
          d="M-100,320 C 250,220 400,380 650,300 S 1050,180 1250,260 L 1540,220"
          fill="none"
          stroke={`url(#${uid}-line1)`}
          strokeWidth="2"
        />
        <path
          d="M-100,380 C 300,420 500,300 750,360 S 1100,300 1300,340 L 1540,320"
          fill="none"
          stroke={`url(#${uid}-line2)`}
          strokeWidth="1.5"
        />
        <path
          d="M-100,260 C 220,300 420,180 700,230 S 1000,120 1250,180 L 1540,150"
          fill="none"
          stroke={`url(#${uid}-line1)`}
          strokeWidth="1"
          opacity="0.6"
        />

        {[
          [250, 232], [650, 300], [1050, 214], [750, 360], [1300, 340], [420, 214], [1250, 180],
        ].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={i % 3 === 0 ? 4 : 2.5} fill={i % 2 === 0 ? '#67E8F9' : '#D4AF37'} />
        ))}
      </g>
    </svg>
  )
}
