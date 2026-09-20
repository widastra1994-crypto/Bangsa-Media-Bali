import { useDisplayContent } from '../context/LanguageContext'
import MascotIcon from './MascotIcon'

export default function About() {
  const { content } = useDisplayContent()
  const { about } = content

  return (
    <section id="tentang" className="relative py-20 lg:py-28">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-5 lg:grid-cols-2 lg:px-8">
        <div className="order-2 lg:order-1">
          <span className="section-eyebrow">{about.eyebrow}</span>
          <h2 className="mt-5 text-3xl font-bold text-white sm:text-4xl">{about.title}</h2>
          <div className="mt-5 space-y-4">
            {about.paragraphs.map((p, i) => (
              <p key={i} className="text-slate-300">
                {p}
              </p>
            ))}
          </div>

          <div className="mt-10 grid grid-cols-2 gap-5 sm:grid-cols-4">
            {about.stats.map((stat) => (
              <div key={stat.label} className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-center">
                <p className="text-xl font-bold text-gold-soft">{stat.value}</p>
                <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel order-1 flex items-center justify-center rounded-3xl p-10 lg:order-2">
          <div className="grid grid-cols-2 gap-6">
            <MascotIcon variant="dev" size={100} animated />
            <MascotIcon variant="erp" size={100} animated />
            <MascotIcon variant="ads" size={100} animated />
            <MascotIcon variant="design" size={100} animated />
          </div>
        </div>
      </div>
    </section>
  )
}
