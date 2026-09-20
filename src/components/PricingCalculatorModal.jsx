import { useContent } from '../context/ContentContext'
import Modal from './Modal'
import CalculatorPanel from './CalculatorPanel'

export default function PricingCalculatorModal({ tier, category, onClose }) {
  const { content } = useContent()
  const { calculator } = content

  return (
    <Modal onClose={onClose} labelledBy="pricing-calculator-title">
      <div className="mb-6 text-center">
        <span className="section-eyebrow">{calculator.eyebrow}</span>
        <h2 id="pricing-calculator-title" className="mt-4 text-2xl font-bold text-white sm:text-3xl">
          {calculator.title}
        </h2>
        <p className="mt-3 text-sm text-slate-300">{calculator.description}</p>
      </div>

      <CalculatorPanel
        defaultServices={tier.calculatorModules}
        defaultScale={tier.calculatorScale}
        contextNote={`Modul disesuaikan otomatis untuk paket "${tier.name}" (${category.label}) — silakan sesuaikan lagi bila perlu.`}
      />
    </Modal>
  )
}
