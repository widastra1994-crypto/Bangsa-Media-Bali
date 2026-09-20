import { Clock, Code2, Headphones, Sparkles } from 'lucide-react'
import { useDisplayContent } from '../context/LanguageContext'

const ICONS = { 'code-2': Code2, clock: Clock, sparkles: Sparkles, headphones: Headphones }

const COLOR_STYLE = {
  cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-400/20',
  gold: 'bg-amber-500/10 text-amber-400 border-amber-400/20',
  blue: 'bg-blue-500/10 text-blue-400 border-blue-400/20',
  emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-400/20',
}

export default function Advantages() {
  const { content } = useDisplayContent()
  const { advantages } = content

  return (
    <section id="keunggulan" className="relative py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="section-eyebrow">{advantages.eyebrow}</span>
          <h2 className="mt-5 text-3xl font-bold text-white sm:text-4xl">{advantages.title}</h2>
          <p className="mt-4 text-slate-400">{advantages.description}</p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {advantages.items.map((item) => {
            const Icon = ICONS[item.icon] || Sparkles
            return (
              <div key={item.id} className="glass-panel rounded-2xl border border-blue-900/50 p-6 text-center">
                <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border ${COLOR_STYLE[item.color] || COLOR_STYLE.cyan}`}>
                  <Icon size={22} />
                </div>
                <h4 className="mb-2 text-base font-bold text-white">{item.title}</h4>
                <p className="text-xs leading-relaxed text-slate-400">{item.description}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
