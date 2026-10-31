import { Clock, Code2, Headphones, Sparkles } from 'lucide-react'
import { useDisplayContent } from '../context/LanguageContext'

const ICONS = { 'code-2': Code2, clock: Clock, sparkles: Sparkles, headphones: Headphones }

const COLOR_STYLE = {
  cyan: 'bg-sky-100 text-ebtblue border-sky-200',
  gold: 'bg-amber-50 text-amber-600 border-amber-200',
  blue: 'bg-blue-50 text-ebtblue border-blue-200',
  emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200',
}

export default function Advantages() {
  const { content } = useDisplayContent()
  const { advantages } = content

  return (
    <section id="keunggulan" className="relative py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="section-eyebrow">{advantages.eyebrow}</span>
          <h2 className="mt-5 text-3xl font-bold text-ink sm:text-4xl">{advantages.title}</h2>
          <p className="mt-4 text-slate-600">{advantages.description}</p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {advantages.items.map((item) => {
            const Icon = ICONS[item.icon] || Sparkles
            return (
              <div key={item.id} className="glass-panel rounded-2xl border border-sky-100 p-6 text-center">
                <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border ${COLOR_STYLE[item.color] || COLOR_STYLE.cyan}`}>
                  <Icon size={22} />
                </div>
                <h4 className="mb-2 text-base font-bold text-ink">{item.title}</h4>
                <p className="text-xs leading-relaxed text-slate-600">{item.description}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
