import { Quote, Star } from 'lucide-react'
import { useDisplayContent } from '../context/LanguageContext'

export default function Testimonials() {
  const { content } = useDisplayContent()
  const { testimonials } = content
  if (!testimonials?.items?.length) return null

  return (
    <section id="testimoni" className="relative border-t border-blue-900/40 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="section-eyebrow">{testimonials.eyebrow}</span>
          <h2 className="mt-5 text-3xl font-bold text-white sm:text-4xl">{testimonials.title}</h2>
          <p className="mt-4 text-slate-300">{testimonials.description}</p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {testimonials.items.map((t) => (
            <div
              key={t.id}
              className="relative flex flex-col rounded-2xl border border-slate-800 bg-navy-900/50 p-6 transition-all duration-300 hover:-translate-y-1.5 hover:border-gold/50"
            >
              <Quote className="absolute right-5 top-5 text-gold/20" size={36} />
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={14} className={i < (t.rating || 5) ? 'fill-gold text-gold' : 'text-slate-700'} />
                ))}
              </div>
              <p className="relative z-10 mt-4 flex-1 text-sm leading-relaxed text-slate-300">"{t.text}"</p>
              <div className="mt-6 flex items-center gap-3 border-t border-white/10 pt-4">
                {t.avatar && (
                  <img
                    src={t.avatar}
                    alt={t.name}
                    className="h-10 w-10 rounded-full object-cover"
                    onError={(e) => e.currentTarget.remove()}
                  />
                )}
                <div>
                  <p className="text-sm font-bold text-white">{t.name}</p>
                  <p className="text-xs text-slate-400">
                    {t.role}
                    {t.company ? `, ${t.company}` : ''}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
