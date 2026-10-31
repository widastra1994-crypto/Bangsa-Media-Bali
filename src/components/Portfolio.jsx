import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Globe } from 'lucide-react'
import { useDisplayContent } from '../context/LanguageContext'

const BANNER_GRADIENT = {
  Website: 'from-ebtblue via-blue-600 to-cyan-royal',
  'ERP/POS': 'from-sky-500 via-cyan-600 to-blue-600',
  Ads: 'from-blue-600 via-indigo-500 to-amber-500',
  'UI/UX': 'from-fuchsia-600 via-purple-600 to-pink-500',
}

const TAG_BADGE = {
  Website: 'bg-white/90 text-ebtblue border-white/70',
  'ERP/POS': 'bg-white/90 text-sky-700 border-white/70',
  Ads: 'bg-amber-50 text-amber-700 border-amber-200',
  'UI/UX': 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
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
    <section id="portofolio" className="relative border-t border-slate-200 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="section-eyebrow">{portfolio.eyebrow}</span>
          <h2 className="mt-5 text-3xl font-bold text-ink sm:text-4xl">{portfolio.title}</h2>
          <p className="mt-4 text-slate-600">{portfolio.description}</p>
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          {portfolio.categories.map((cat) => (
            <button
              type="button"
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`rounded-full border px-5 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
                activeCategory === cat
                  ? 'border-gold bg-gold/15 text-gold-deep'
                  : 'border-slate-200 bg-white/70 text-slate-600 hover:border-sky-300 hover:text-ink'
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
              className="group overflow-hidden rounded-2xl border border-sky-100 bg-white/80 shadow-card transition-all duration-300 hover:-translate-y-1.5 hover:border-sky-400"
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
                  {item.location && <span className="text-xs font-semibold text-gold-soft drop-shadow">{item.location}</span>}
                </div>
                <div className="relative z-10 text-lg font-bold text-white transition-colors group-hover:text-sky-100">{item.title}</div>

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
                    className="absolute bottom-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-white/90 text-ebtblue shadow-card backdrop-blur-md transition-all hover:scale-110 hover:border-cyan-royal hover:bg-white hover:text-cyan-royal"
                  >
                    <Globe size={16} />
                  </button>
                )}
              </div>

              <div className="p-6">
                {item.tags?.filter(Boolean).length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {item.tags.filter(Boolean).map((tag) => (
                      <span key={tag} className="rounded bg-sky-50 px-2 py-1 text-[10px] text-slate-600">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs leading-relaxed text-slate-600">{item.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
