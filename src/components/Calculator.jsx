import { useContent } from '../context/ContentContext'
import CalculatorPanel from './CalculatorPanel'

export default function Calculator() {
  const { content } = useContent()
  const { calculator } = content

  return (
    <section id="kalkulator" className="relative overflow-hidden py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="section-eyebrow">{calculator.eyebrow}</span>
          <h2 className="mt-5 text-3xl font-bold text-white sm:text-4xl">{calculator.title}</h2>
          <p className="mt-4 text-slate-300">{calculator.description}</p>
        </div>

        <div className="mt-12">
          <CalculatorPanel />
        </div>
      </div>
    </section>
  )
}
