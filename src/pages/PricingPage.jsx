import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { useDisplayContent, useLanguage } from '../context/LanguageContext'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import FloatingAssistant from '../components/FloatingAssistant'
import PricingCard from '../components/PricingCard'
import PricingComparisonTable from '../components/PricingComparisonTable'
import PricingCalculatorModal from '../components/PricingCalculatorModal'

export default function PricingPage() {
  const { slug } = useParams()
  const { content } = useDisplayContent()
  const { lang } = useLanguage()
  const t = (id, en) => (lang === 'en' ? en : id)
  const { pricing } = content
  const category = pricing.categories.find((c) => c.slug === slug)
  const [selectedTier, setSelectedTier] = useState(null)

  if (!category) {
    return (
      <div className="min-h-screen bg-nusatech-gradient text-slate-100">
        <Navbar />
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-5 text-center">
          <p className="text-2xl font-bold text-white">{t('Paket tidak ditemukan', 'Package not found')}</p>
          <Link to="/paket" className="btn-primary">
            <ArrowLeft size={16} /> {t('Kembali ke Semua Paket', 'Back to All Plans')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-nusatech-gradient text-slate-100">
      <Navbar />
      <main className="pb-20 pt-32 lg:pb-28 lg:pt-40">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <Link to="/paket" className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-cyan-royal">
            <ArrowLeft size={16} /> {t('Kembali ke Semua Paket', 'Back to All Plans')}
          </Link>

          <div className="mx-auto max-w-2xl text-center">
            <span className="section-eyebrow">{pricing.eyebrow}</span>
            <h1 className="mt-5 text-3xl font-bold text-white sm:text-4xl">{t(`Paket ${category.label}`, `${category.label} Plan`)}</h1>
            <p className="mt-4 text-slate-300">{pricing.description}</p>
          </div>

          {pricing.trustBadges?.length > 0 && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-400">
              {pricing.trustBadges.map((badge) => (
                <span key={badge} className="flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-cyan-royal" /> {badge}
                </span>
              ))}
            </div>
          )}

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {pricing.categories.map((cat) => (
              <Link
                key={cat.id}
                to={`/paket/${cat.slug}`}
                className={`rounded-full border px-5 py-2 text-sm font-semibold transition-colors ${
                  cat.slug === category.slug
                    ? 'border-gold bg-gold/15 text-gold-soft'
                    : 'border-white/15 text-slate-400 hover:border-white/30 hover:text-slate-200'
                }`}
              >
                {cat.label}
              </Link>
            ))}
          </div>

          {category.includedBadges?.length > 0 && (
            <p className="mt-6 text-center text-xs text-slate-400">
              {category.intro} <span className="text-slate-300">{category.includedBadges.join(' • ')}</span>
            </p>
          )}

          <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {category.tiers.map((tier) => (
              <PricingCard key={tier.id} tier={tier} onSelect={setSelectedTier} />
            ))}
          </div>

          <div className="mt-16">
            <h2 className="mb-6 text-center text-2xl font-bold text-white">{t(`Bandingkan Paket ${category.label}`, `Compare ${category.label} Plans`)}</h2>
            <PricingComparisonTable category={category} />
          </div>
        </div>
      </main>
      <Footer />
      <FloatingAssistant />

      {selectedTier && (
        <PricingCalculatorModal key={selectedTier.id} tier={selectedTier} category={category} onClose={() => setSelectedTier(null)} />
      )}
    </div>
  )
}
