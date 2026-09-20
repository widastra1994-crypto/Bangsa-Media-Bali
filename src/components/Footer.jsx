import { Check, Mail, MapPin } from 'lucide-react'
import { useDisplayContent } from '../context/LanguageContext'
import logoFull from '../assets/logo-full.png'

export default function Footer() {
  const { content } = useDisplayContent()
  const { footer, nav, contact, services } = content

  return (
    <footer className="border-t border-blue-950 bg-navy-950/90 pb-12 pt-16 text-sm text-slate-400">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="grid grid-cols-1 gap-10 border-b border-slate-900 pb-12 md:grid-cols-12">
          <div className="md:col-span-5">
            <img src={logoFull} alt="Bangsa Media Bali" className="mb-4 h-9 w-auto object-contain" />
            <p className="mb-6 max-w-sm text-xs leading-relaxed text-slate-400">{footer.tagline}</p>
            <div className="space-y-1.5 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-cyan-royal" /> {contact.address}
              </div>
              <div className="flex items-center gap-2">
                <Mail size={16} className="text-cyan-royal" /> {contact.email}
              </div>
            </div>
          </div>

          <div className="md:col-span-3">
            <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-white">{footer.servicesHeading}</h4>
            <ul className="space-y-2.5 text-xs">
              {services.items.map((item) => (
                <li key={item.id}>
                  <a href="#layanan" className="transition-colors hover:text-cyan-royal">
                    {item.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-4">
            <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-white">{footer.philosophyHeading}</h4>
            <p className="mb-4 text-xs leading-relaxed text-slate-400">{footer.philosophyText}</p>
            <div className="flex items-center gap-2.5 rounded-xl border border-blue-900/40 bg-navy-900/80 p-3.5 text-xs text-gold-soft/90">
              <Check size={16} className="text-gold" />
              <span>{contact.hours}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 pt-8 text-xs text-slate-500 sm:flex-row">
          <div>
            &copy; {new Date().getFullYear()} {footer.copyText}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {nav.menu.map((item) => (
              <a key={item.id} href={item.href} className="hover:text-slate-300">
                {item.label}
              </a>
            ))}
            {footer.socials.map((s) => (
              <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className="hover:text-slate-300">
                {s.label}
              </a>
            ))}
            <a href="/admin" className="text-slate-600 hover:text-gold-soft">
              Admin
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
