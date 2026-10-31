import { Check } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'

const idr = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

export default function PricingCard({ tier, onSelect }) {
  const { lang } = useLanguage()
  const discount = tier.priceOriginal > tier.price ? Math.round(100 - (tier.price / tier.priceOriginal) * 100) : 0

  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-1.5 ${
        tier.highlight
          ? 'border-gold bg-gradient-to-b from-white via-sky-50 to-sky-100 shadow-gold-glow lg:scale-[1.04]'
          : 'glass-panel border-sky-100'
      }`}
    >
      {tier.badge && (
        <span
          className={`absolute -top-3 left-6 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide ${
            tier.highlight ? 'bg-gold text-navy-950' : 'border border-cyan-royal/40 bg-white text-cyan-royal'
          }`}
        >
          {tier.badge}
        </span>
      )}

      <h3 className="mt-3 text-lg font-bold text-ink">{tier.name}</h3>
      <p className="mt-2 min-h-[40px] text-xs text-slate-600">{tier.description}</p>

      <div className="mt-5">
        {discount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 line-through">{idr(tier.priceOriginal)}</span>
            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">
              {lang === 'en' ? 'Save' : 'Hemat'} {discount}%
            </span>
          </div>
        )}
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-extrabold text-ink">{idr(tier.price)}</span>
          <span className="text-xs text-slate-600">{tier.billingNote}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onSelect(tier)}
        className={`mt-5 w-full rounded-xl py-3 text-center text-sm font-bold transition-transform hover:scale-[1.02] ${
          tier.highlight ? 'btn-primary' : 'border border-cyan-royal/40 bg-white text-cyan-royal hover:bg-sky-50'
        }`}
      >
        {tier.ctaLabel}
      </button>

      <ul className="mt-6 space-y-2.5 border-t border-slate-200 pt-5 text-xs text-slate-600">
        {tier.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <Check size={14} className="mt-0.5 shrink-0 text-cyan-royal" />
            {feature}
          </li>
        ))}
      </ul>
    </div>
  )
}
