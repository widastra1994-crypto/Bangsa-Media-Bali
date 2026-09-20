import Navbar from '../components/Navbar'
import Pricing from '../components/Pricing'
import Footer from '../components/Footer'
import FloatingAssistant from '../components/FloatingAssistant'

export default function PricingOverviewPage() {
  return (
    <div className="min-h-screen bg-nusatech-gradient text-slate-100">
      <Navbar />
      <main className="pt-20 lg:pt-24">
        <Pricing />
      </main>
      <Footer />
      <FloatingAssistant />
    </div>
  )
}
