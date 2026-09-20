import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Globe } from 'lucide-react'
import { useDisplayContent } from '../context/LanguageContext'

const BANNER_GRADIENT = {
  Website: 'from-blue-900 via-indigo-950 to-slate-900',
  'ERP/POS': 'from-slate-900 via-cyan-950 to-blue-950',
  Ads: 'from-indigo-950 via-slate-900 to-amber-950/40',
  'UI/UX': 'from-fuchsia-950 via-slate-900 to-pink-950/40',
}

const TAG_BADGE = {
  Website: 'bg-blue-500/20 text-cyan-300 border-cyan-400/30',
  'ERP/POS': 'bg-cyan-500/20 text-cyan-300 border-cyan-400/30',
  Ads: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
  'UI/UX': 'bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-400/30',
}

export default function Portfolio() {
  const { content } = useDisplayContent()
  const { portfolio } = content
  const allLabel = portfolio.categories[0]
  const [activeCategory, setActiveCategory] = useState(allLabel)

  // Sinkronkan ulang saat label "Semua/All" berganti karena toggle bahasa,
  // supaya filter tidak diam-diam macet di label bahasa yang sudah tidak ada.
  useEffect(() => {
    setActiveCategory(allLabel)
  }, [allLabel])

  const filtered =
    activeCategory === allLabel ? portfolio.items : portfolio.items.filter((item) => item.category === activeCategory)

  return (
    <section id="portofolio" className="relative border-t border-blue-900/40 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="section-eyebrow">{portfolio.eyebrow}</span>
          <h2 className="mt-5 text-3xl font-bold text-white sm:text-4xl">{portfolio.title}</h2>
          <p className="mt-4 text-slate-300">{portfolio.description}</p>
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          {portfolio.categories.map((cat) => (
            <button
              type="button"
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`rounded-full border px-5 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
                activeCategory === cat
                  ? 'border-gold bg-gold/15 text-gold-soft'
                  : 'border-white/15 text-slate-400 hover:border-white/30 hover:text-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <Link
              key={item.id}
              to={`/portofolio/${item.slug || item.id}`}
              className="group overflow-hidden rounded-2xl border border-slate-800 bg-navy-900/50 transition-all duration-300 hover:-translate-y-1.5 hover:border-cyan-400/60"
            >
              <div className={`relative flex h-44 flex-col justify-between overflow-hidden bg-gradient-to-br p-6 ${BANNER_GRADIENT[item.category] || BANNER_GRADIENT.Website}`}>
                {item.image && (
                  <>
                    <img
                      src={item.image}
                      alt={item.title}
                      className="absolute inset-0 h-full w-full object-cover"
                      onError={(e) => e.currentTarget.remove()}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/10" />
                  </>
                )}
                <div className="relative z-10 flex items-center justify-between">
                  <span className={`rounded border px-2.5 py-1 text-[11px] font-bold ${TAG_BADGE[item.category] || TAG_BADGE.Website}`}>
                    {item.category}
                  </span>
                  {item.location && <span className="text-xs font-semibold text-gold-soft">{item.location}</span>}
                </div>
                <div className="relative z-10 text-lg font-bold text-white transition-colors group-hover:text-cyan-300">{item.title}</div>

                {item.websiteUrl && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      window.open(item.websiteUrl, '_blank', 'noopener,noreferrer')
                    }}
                    title={`Kunjungi website resmi ${item.title}`}
                    aria-label={`Kunjungi website resmi ${item.title}`}
                    className="absolute bottom-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-navy-950/70 text-white backdrop-blur-md transition-all hover:scale-110 hover:border-cyan-royal hover:bg-navy-950 hover:text-cyan-royal"
                  >
                    <Globe size={16} />
                  </button>
                )}
              </div>

              <div className="p-6">
                {item.tags?.filter(Boolean).length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {item.tags.filter(Boolean).map((tag) => (
                      <span key={tag} className="rounded bg-slate-800 px-2 py-1 text-[10px] text-slate-300">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs leading-relaxed text-slate-400">{item.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
