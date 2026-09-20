import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, Sparkles, X } from 'lucide-react'
import { useDisplayContent, useLanguage } from '../context/LanguageContext'
import logoFull from '../assets/logo-full.png'

function NavLink({ item, onClick, className }) {
  if (item.href.startsWith('/')) {
    return (
      <Link to={item.href} onClick={onClick} className={className}>
        {item.id === 'kalkulator' && <span className="h-2 w-2 animate-ping rounded-full bg-cyan-royal" />}
        {item.label}
      </Link>
    )
  }
  return (
    <a href={item.href} onClick={onClick} className={className}>
      {item.id === 'kalkulator' && <span className="h-2 w-2 animate-ping rounded-full bg-cyan-royal" />}
      {item.label}
    </a>
  )
}

function LangToggle({ compact }) {
  const { lang, setLang } = useLanguage()
  return (
    <div
      role="group"
      aria-label="Pilih bahasa / Select language"
      className={`flex items-center gap-0.5 rounded-full border border-white/15 bg-white/5 p-0.5 ${compact ? 'w-full' : ''}`}
    >
      {['id', 'en'].map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLang(code)}
          aria-pressed={lang === code}
          className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${compact ? 'flex-1' : ''} ${
            lang === code ? 'bg-gold text-navy-950' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

export default function Navbar() {
  const { content } = useDisplayContent()
  const { nav } = content
  const primaryMenu = nav.menu.filter((item) => item.primary)
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b transition-all duration-300 ${
        scrolled ? 'border-blue-900/40 bg-navy-950/80 shadow-lg shadow-black/30 backdrop-blur-xl' : 'border-transparent bg-transparent'
      }`}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
        <a href="#beranda" className="flex items-center gap-2">
          <img src={logoFull} alt="Bangsa Media Bali" className="h-9 w-auto object-contain lg:h-10" />
        </a>

        <ul className="hidden items-center gap-7 lg:flex">
          {primaryMenu.map((item) => (
            <li key={item.id}>
              <NavLink
                item={item}
                className="flex items-center gap-1.5 whitespace-nowrap text-sm font-medium text-slate-300 transition-colors hover:text-cyan-royal"
              />
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-3 lg:flex">
          <LangToggle />
          <a href="#kontak" className="btn-primary !px-5 !py-2.5 text-xs">
            <Sparkles size={14} className="text-gold-soft" /> {nav.ctaLabel}
          </a>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="glass-panel rounded-lg p-2 text-slate-200 lg:hidden"
          aria-label="Buka menu"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {open && (
        <div className="glass-panel mx-4 mb-4 rounded-2xl px-5 py-4 lg:hidden">
          <ul className="flex flex-col gap-4">
            {primaryMenu.map((item) => (
              <li key={item.id}>
                <NavLink item={item} onClick={() => setOpen(false)} className="block text-sm font-medium text-slate-200 hover:text-gold-soft" />
              </li>
            ))}
            <li>
              <LangToggle compact />
            </li>
            <li>
              <a href="#kontak" onClick={() => setOpen(false)} className="btn-primary w-full">
                {nav.ctaLabel}
              </a>
            </li>
          </ul>
        </div>
      )}
    </header>
  )
}
