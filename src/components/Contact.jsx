import { Clock, Mail, MapPin, Phone } from 'lucide-react'
import { useDisplayContent } from '../context/LanguageContext'

export default function Contact() {
  const { content } = useDisplayContent()
  const { contact } = content
  const mapsEmbedSrc = `https://www.google.com/maps?q=${encodeURIComponent(contact.mapsQuery)}&output=embed`
  const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.mapsQuery)}`

  return (
    <section id="kontak" className="relative py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="section-eyebrow">{contact.eyebrow}</span>
          <h2 className="mt-5 text-3xl font-bold text-white sm:text-4xl">{contact.title}</h2>
          <p className="mt-4 text-slate-300">{contact.description}</p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="glass-panel space-y-5 rounded-2xl p-6 lg:col-span-2">
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 shrink-0 text-gold" size={20} />
              <div>
                <p className="text-sm font-semibold text-white">{contact.labels.address}</p>
                <p className="text-sm text-slate-400">{contact.address}</p>
                <a href={mapsLink} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs font-semibold text-cyan-royal hover:underline">
                  {contact.labels.mapsLink}
                </a>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="mt-0.5 shrink-0 text-gold" size={20} />
              <div>
                <p className="text-sm font-semibold text-white">{contact.labels.phone}</p>
                <p className="text-sm text-slate-400">{contact.phone}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 shrink-0 text-gold" size={20} />
              <div>
                <p className="text-sm font-semibold text-white">{contact.labels.email}</p>
                <p className="text-sm text-slate-400">{contact.email}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 shrink-0 text-gold" size={20} />
              <div>
                <p className="text-sm font-semibold text-white">{contact.labels.hours}</p>
                <p className="text-sm text-slate-400">{contact.hours}</p>
              </div>
            </div>
          </div>

          <div className="glass-panel overflow-hidden rounded-2xl lg:col-span-3">
            <iframe
              title="Lokasi Bangsa Media Bali"
              src={mapsEmbedSrc}
              className="h-72 w-full lg:h-full lg:min-h-[320px]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
