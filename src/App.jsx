import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Services from './components/Services'
import Pricing from './components/Pricing'
import Calculator from './components/Calculator'
import Portfolio from './components/Portfolio'
import Testimonials from './components/Testimonials'
import Blog from './components/Blog'
import Advantages from './components/Advantages'
import About from './components/About'
import Contact from './components/Contact'
import Footer from './components/Footer'
import FloatingAssistant from './components/FloatingAssistant'
import CursorCircuit from './components/CursorCircuit'

function App() {
  return (
    <div className="min-h-screen bg-nusatech-gradient">
      <CursorCircuit />
      <Navbar />
      <main>
        <Hero />
        <Services />
        <Pricing />
        <Calculator />
        <Portfolio />
        <Testimonials />
        <Blog />
        <Advantages />
        <About />
        <Contact />
      </main>
      <Footer />
      <FloatingAssistant />
    </div>
  )
}

export default App
