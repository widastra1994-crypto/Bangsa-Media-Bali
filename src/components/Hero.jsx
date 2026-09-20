import { Calculator, Play } from 'lucide-react'
import { useDisplayContent } from '../context/LanguageContext'
import HeroMascot from './HeroMascot'
import CircuitWaves from './CircuitWaves'

export default function Hero() {
  const { content } = useDisplayContent()
  const { hero } = content

  return (
    <section id="beranda" className="relative overflow-hidden bg-gradient-to-b from-[#020509] via-navy-950 to-navy-900 pt-32 pb-20 lg:pt-44 lg:pb-32">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[750px] -translate-x-1/2 rounded-full bg-ebtblue/20 blur-[130px]" />
      <div className="pointer-events-none absolute right-5 top-1/3 h-96 w-96 rounded-full bg-cyan-royal/10 blur-[100px]" />
      <div className="pointer-events-none absolute bottom-10 left-10 h-80 w-80 rounded-full bg-gold/10 blur-[90px]" />
      <CircuitWaves className="bottom-0 top-auto h-2/3 opacity-60" />

      <div className="relative z-10 mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-5 lg:grid-cols-12 lg:gap-8 lg:px-8">
        <div className="text-center lg:col-span-7 lg:text-left">
          <span className="section-eyebrow">
            <span>✦</span> {hero.eyebrow} <span>✦</span>
          </span>

          <h1 className="mb-6 mt-6 text-4xl font-extrabold leading-[1.15] tracking-tight text-white sm:text-5xl lg:text-6xl">
            {hero.headline.split(' ').map((word, i) =>
              word.toLowerCase() === 'adat' || word.toLowerCase() === 'inovasi' ? (
                <span key={i} className="bg-gradient-to-r from-gold to-gold-soft bg-clip-text text-transparent">
                  {word}{' '}
                </span>
              ) : (
                `${word} `
              ),
            )}
          </h1>

          <p className="mx-auto mb-8 max-w-2xl text-base leading-relaxed text-slate-300/90 lg:mx-0 lg:text-lg">{hero.description}</p>

          <div className="mb-12 flex flex-col items-center justify-center gap-4 sm:flex-row lg:justify-start">
            <a href="#kalkulator" className="btn-primary w-full sm:w-auto">
              <Calculator size={18} className="text-gold-soft" /> {hero.ctaPrimary}
            </a>
            <a href="#portofolio" className="btn-secondary w-full sm:w-auto">
              <Play size={16} /> {hero.ctaSecondary}
            </a>
          </div>

          <div className="grid grid-cols-2 gap-5 border-t border-white/10 pt-6 sm:grid-cols-4">
            {hero.badges.map((badge) => (
              <div key={badge.label} className="text-center lg:text-left">
                <p className="text-2xl font-extrabold text-white lg:text-3xl">
                  {badge.value}
                </p>
                <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">{badge.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5">
          <HeroMascot />
        </div>
      </div>
    </section>
  )
}
