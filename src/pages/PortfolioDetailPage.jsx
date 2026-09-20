import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ExternalLink, MapPin } from 'lucide-react'
import { useDisplayContent, useLanguage } from '../context/LanguageContext'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import FloatingAssistant from '../components/FloatingAssistant'

export default function PortfolioDetailPage() {
  const { slug } = useParams()
  const { content } = useDisplayContent()
  const { lang } = useLanguage()
  const t = (id, en) => (lang === 'en' ? en : id)
  const { portfolio } = content
  const item = portfolio.items.find((p) => p.slug === slug || String(p.id) === slug)

  if (!item) {
    return (
      <div className="min-h-screen bg-nusatech-gradient text-slate-100">
        <Navbar />
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-5 text-center">
          <p className="text-2xl font-bold text-white">{t('Proyek tidak ditemukan', 'Project not found')}</p>
          <Link to="/#portofolio" className="btn-primary">
            <ArrowLeft size={16} /> {t('Kembali ke Portofolio', 'Back to Portfolio')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-nusatech-gradient text-slate-100">
      <Navbar />
      <main className="pb-20 pt-32 lg:pb-28 lg:pt-40">
        <div className="mx-auto max-w-5xl px-5 lg:px-8">
          <Link to="/#portofolio" className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-cyan-royal">
            <ArrowLeft size={16} /> {t('Kembali ke Portofolio', 'Back to Portfolio')}
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded border border-cyan-400/30 bg-blue-500/20 px-2.5 py-1 text-[11px] font-bold text-cyan-300">
              {item.category}
            </span>
            {item.location && (
              <span className="flex items-center gap-1 text-xs font-semibold text-gold-soft">
                <MapPin size={13} /> {item.location}
              </span>
            )}
            {item.year && <span className="text-xs text-slate-400">{item.year}</span>}
          </div>

          <h1 className="mt-4 text-3xl font-bold text-white sm:text-4xl">{item.title}</h1>
          {item.client && <p className="mt-2 text-sm text-slate-400">{t('Klien', 'Client')}: {item.client}</p>}

          {item.image && (
            <div className="relative mt-8 h-72 w-full overflow-hidden rounded-2xl border border-white/10 sm:h-96">
              <img src={item.image} alt={item.title} className="h-full w-full object-cover" onError={(e) => e.currentTarget.parentElement.remove()} />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-navy-950/80 via-navy-950/5 to-transparent" />
            </div>
          )}

          {item.results?.length > 0 && (
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {item.results.map((r) => (
                <div key={r.label} className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
                  <p className="text-2xl font-bold text-cyan-royal">{r.value}</p>
                  <p className="mt-1 text-xs text-slate-400">{r.label}</p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gold-soft">{t('Tantangan', 'The Challenge')}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">{item.challenge || '-'}</p>
            </div>
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gold-soft">{t('Solusi Kami', 'Our Solution')}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">{item.solution || item.description}</p>
            </div>
          </div>

          {item.tags?.filter(Boolean).length > 0 && (
            <div className="mt-8 flex flex-wrap gap-2">
              {item.tags.filter(Boolean).map((tag) => (
                <span key={tag} className="rounded bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {item.gallery?.filter(Boolean).length > 0 && (
            <div className="mt-10">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gold-soft">{t('Galeri Proyek', 'Project Gallery')}</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {item.gallery.filter(Boolean).map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt={`${item.title} ${i + 1}`}
                    className="h-56 w-full rounded-xl border border-white/10 object-cover"
                    onError={(e) => e.currentTarget.parentElement.removeChild(e.currentTarget)}
                  />
                ))}
              </div>
            </div>
          )}

          {item.websiteUrl && (
            <a
              href={item.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary mt-10 inline-flex"
            >
              {t('Kunjungi Website Resmi', 'Visit Official Website')} <ExternalLink size={15} />
            </a>
          )}
        </div>
      </main>
      <Footer />
      <FloatingAssistant />
    </div>
  )
}
