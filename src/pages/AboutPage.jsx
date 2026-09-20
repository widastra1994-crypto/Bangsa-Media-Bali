import Navbar from '../components/Navbar'
import About from '../components/About'
import Footer from '../components/Footer'
import FloatingAssistant from '../components/FloatingAssistant'

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-nusatech-gradient text-slate-100">
      <Navbar />
      <main className="pt-20 lg:pt-24">
        <About />
      </main>
      <Footer />
      <FloatingAssistant />
    </div>
  )
}
