import { Check, Mail, MapPin } from 'lucide-react'
import { useDisplayContent } from '../context/LanguageContext'
import logoFull from '../assets/logo-full.png'

export default function Footer() {
  const { content } = useDisplayContent()
  const { footer, nav, contact, services } = content

  return (
    <footer className="border-t border-slate-200 bg-white pb-12 pt-16 text-sm text-slate-600">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="grid grid-cols-1 gap-10 border-b border-slate-200 pb-12 md:grid-cols-12">
          <div className="md:col-span-5">
            <img src={logoFull} alt="Bangsa Media Bali" className="mb-4 h-9 w-auto object-contain" />
            <p className="mb-6 max-w-sm text-xs leading-relaxed text-slate-600">{footer.tagline}</p>
            <div className="space-y-1.5 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-cyan-royal" /> {contact.address}
              </div>
              <div className="flex items-center gap-2">
                <Mail size={16} className="text-cyan-royal" /> {contact.email}
              </div>
            </div>
          </div>

          <div className="md:col-span-3">
            <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-ink">{footer.servicesHeading}</h4>
            <ul className="space-y-2.5 text-xs">
              {services.items.map((item) => (
                <li key={item.id}>
                  <a href="/#layanan" className="transition-colors hover:text-ebtblue">
                    {item.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-4">
            <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-ink">{footer.philosophyHeading}</h4>
            <p className="mb-4 text-xs leading-relaxed text-slate-600">{footer.philosophyText}</p>
            <div className="flex items-center gap-2.5 rounded-xl border border-gold/50 bg-amber-50 p-3.5 text-xs text-gold-deep">
              <Check size={16} className="text-gold-deep" />
              <span>{contact.hours}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 pt-8 text-xs text-slate-500 sm:flex-row">
          <div>
            &copy; {new Date().getFullYear()} {footer.copyText}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {nav.menu
              .filter((item) => !item.primary)
              .map((item) => (
                <a key={item.id} href={item.href} className="hover:text-ebtblue">
                  {item.label}
                </a>
              ))}
            {footer.socials.map((s) => (
              <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className="hover:text-ebtblue">
                {s.label}
              </a>
            ))}
            <a href="/portal" className="hover:text-ebtblue">
              Portal Klien
            </a>
            <a href="/admin" className="text-slate-400 hover:text-gold-deep">
              Admin
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
