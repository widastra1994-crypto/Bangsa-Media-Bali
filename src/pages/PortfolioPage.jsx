import Navbar from '../components/Navbar'
import Portfolio from '../components/Portfolio'
import Footer from '../components/Footer'
import FloatingAssistant from '../components/FloatingAssistant'

export default function PortfolioPage() {
  return (
    <div className="min-h-screen bg-nusatech-gradient text-slate-100">
      <Navbar />
      <main className="pt-20 lg:pt-24">
        <Portfolio />
      </main>
      <Footer />
      <FloatingAssistant />
    </div>
  )
}
