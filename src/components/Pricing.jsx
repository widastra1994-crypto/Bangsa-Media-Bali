import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { useDisplayContent } from '../context/LanguageContext'
import PricingCard from './PricingCard'
import PricingCalculatorModal from './PricingCalculatorModal'

export default function Pricing() {
  const { content } = useDisplayContent()
  const { pricing } = content
  const [activeCategory, setActiveCategory] = useState(pricing.categories[0]?.slug)
  const [selectedTier, setSelectedTier] = useState(null)

  const category = pricing.categories.find((c) => c.slug === activeCategory) || pricing.categories[0]

  return (
    <section id="paket" className="relative py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="section-eyebrow">{pricing.eyebrow}</span>
          <h2 className="mt-5 text-3xl font-bold text-ink sm:text-4xl">{pricing.title}</h2>
          <p className="mt-4 text-slate-600">{pricing.description}</p>
        </div>

        {pricing.trustBadges?.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-600">
            {pricing.trustBadges.map((badge) => (
              <span key={badge} className="flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-cyan-royal" /> {badge}
              </span>
            ))}
          </div>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {pricing.categories.map((cat) => (
            <button
              type="button"
              key={cat.id}
              onClick={() => setActiveCategory(cat.slug)}
              className={`rounded-full border px-5 py-2 text-sm font-semibold transition-colors ${
                activeCategory === cat.slug
                  ? 'border-gold bg-amber-50 text-gold-deep shadow-card'
                  : 'border-slate-200 bg-white/70 text-slate-600 hover:border-sky-300 hover:text-ebtblue'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {category.includedBadges?.length > 0 && (
          <p className="mt-6 text-center text-xs text-slate-600">
            {category.intro}{' '}
            <span className="text-slate-800">{category.includedBadges.join(' • ')}</span>
          </p>
        )}

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {category.tiers.map((tier) => (
            <PricingCard key={tier.id} tier={tier} onSelect={setSelectedTier} />
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            to={`/paket/${category.slug}`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-royal hover:text-ebtblue"
          >
            {pricing.detailCtaLabel} ({category.label}) <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      {selectedTier && (
        <PricingCalculatorModal key={selectedTier.id} tier={selectedTier} category={category} onClose={() => setSelectedTier(null)} />
      )}
    </section>
  )
}
