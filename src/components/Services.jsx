import { ArrowRight, Check, Code2, Database, Megaphone, Palette } from 'lucide-react'
import { useDisplayContent } from '../context/LanguageContext'

const VARIANT_STYLE = {
  dev: { Icon: Code2, gradient: 'from-blue-700 to-cyan-400', glow: 'bg-sky-100 group-hover:bg-sky-200', text: 'group-hover:text-ebtblue' },
  erp: { Icon: Database, gradient: 'from-blue-700 to-indigo-500', glow: 'bg-blue-50 group-hover:bg-blue-100', text: 'group-hover:text-ebtblue' },
  ads: { Icon: Megaphone, gradient: 'from-cyan-600 to-emerald-400', glow: 'bg-amber-50 group-hover:bg-amber-100', text: 'group-hover:text-ebtblue' },
  design: { Icon: Palette, gradient: 'from-fuchsia-600 to-pink-400', glow: 'bg-fuchsia-50 group-hover:bg-pink-100', text: 'group-hover:text-pink-600' },
}

export default function Services() {
  const { content } = useDisplayContent()
  const { services } = content

  return (
    <section id="layanan" className="relative border-y border-sky-100 bg-white/40 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="section-eyebrow">{services.eyebrow}</span>
          <h2 className="mt-5 text-3xl font-bold text-ink sm:text-4xl">{services.title}</h2>
          <p className="mt-4 text-slate-600">{services.description}</p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {services.items.map((item) => {
            const style = VARIANT_STYLE[item.variant] || VARIANT_STYLE.dev
            const { Icon } = style
            return (
              <div
                key={item.id}
                className="group glass-panel relative overflow-hidden rounded-2xl p-7 transition-all duration-300 hover:-translate-y-2 hover:border-sky-400"
              >
                <div className={`pointer-events-none absolute -bottom-10 -right-10 h-32 w-32 rounded-full blur-2xl transition-colors ${style.glow}`} />

                <div className={`mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-tr text-white shadow-lg transition-transform group-hover:scale-110 ${style.gradient}`}>
                  <Icon size={26} />
                </div>

                <h3 className={`mb-3 text-base font-bold text-ink transition-colors ${style.text}`}>{item.title}</h3>
                <p className="mb-5 text-sm leading-relaxed text-slate-600">{item.description}</p>

                {item.features?.filter(Boolean).length > 0 && (
                  <ul className="mb-6 space-y-2 text-xs text-slate-600">
                    {item.features.filter(Boolean).map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check size={14} className="mt-0.5 shrink-0 text-cyan-royal" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                )}

                <a
                  href="#kalkulator"
                  className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-cyan-royal transition-all hover:text-ebtblue group-hover:gap-2.5"
                >
                  {services.ctaLabel} <ArrowRight size={14} />
                </a>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
