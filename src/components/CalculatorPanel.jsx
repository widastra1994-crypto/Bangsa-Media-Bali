import { useEffect, useMemo, useState } from 'react'
import { Check, CheckCircle2, MessageSquare, Shield } from 'lucide-react'
import { useContent } from '../context/ContentContext'
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'

const idr = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
const todayStr = () => new Date().toISOString().split('T')[0]

// Normalisasi nomor HP Indonesia ke format 62xxxxxxxxxx agar siap dipakai link WhatsApp,
// menerima input umum seperti 08xxx, +62xxx, 62xxx, atau dengan spasi/tanda hubung.
function normalizePhone(input) {
  let digits = input.replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) digits = digits.slice(1)
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`
  return digits
}

const STEPPER_STEPS = ['Layanan', 'Skala', 'Data Diri']

function Stepper({ completedSteps }) {
  return (
    <div className="mb-8 flex items-center">
      {STEPPER_STEPS.map((label, idx) => {
        const done = completedSteps[idx]
        const isLast = idx === STEPPER_STEPS.length - 1
        return (
          <div key={label} className={`flex items-center ${isLast ? '' : 'flex-1'}`}>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${
                  done ? 'border-cyan-royal bg-cyan-royal text-navy-950' : 'border-white/20 bg-navy-900 text-slate-400'
                }`}
              >
                {done ? <Check size={16} /> : idx + 1}
              </div>
              <span className={`text-[10px] font-semibold uppercase tracking-wide ${done ? 'text-cyan-royal' : 'text-slate-500'}`}>
                {label}
              </span>
            </div>
            {!isLast && (
              <div className={`mx-2 h-0.5 flex-1 rounded transition-colors ${done ? 'bg-cyan-royal' : 'bg-white/10'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function CalculatorPanel({ defaultServices, defaultScale, contextNote }) {
  const { content } = useContent()
  const { calculator } = content
  const [selectedServices, setSelectedServices] = useState(
    defaultServices?.length ? defaultServices : [calculator.services[0]?.id].filter(Boolean),
  )
  const [scaleId, setScaleId] = useState(defaultScale || calculator.scales[0]?.id)
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    businessName: '',
    businessType: calculator.businessTypes?.[0] || '',
    address: '',
    consultDate: '',
    consultTime: calculator.timeSlots?.[0] || '',
  })
  const [touched, setTouched] = useState(false)
  const [bookedSlots, setBookedSlots] = useState([])
  const [submitState, setSubmitState] = useState('idle') // idle | saving | saved

  const scale = calculator.scales.find((s) => s.id === scaleId) || calculator.scales[0]
  const fields = calculator.contactFields || {}

  // Cek slot yang sudah dibooking orang lain pada tanggal terpilih (kalau Supabase sudah dikonfigurasi).
  useEffect(() => {
    if (!isSupabaseConfigured || !form.consultDate) {
      setBookedSlots([])
      return
    }
    let cancelled = false
    supabase
      .from('booked_slots')
      .select('consult_time')
      .eq('consult_date', form.consultDate)
      .then(({ data, error }) => {
        if (!cancelled && !error && data) setBookedSlots(data.map((r) => r.consult_time))
      })
    return () => {
      cancelled = true
    }
  }, [form.consultDate])

  // Kalau slot yang lagi dipilih ternyata sudah penuh, otomatis pindah ke slot kosong terdekat.
  useEffect(() => {
    if (!bookedSlots.includes(form.consultTime)) return
    const nextAvailable = (calculator.timeSlots || []).filter(Boolean).find((slot) => !bookedSlots.includes(slot))
    if (nextAvailable) updateForm('consultTime', nextAvailable)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookedSlots])

  const toggleService = (id) => {
    setSelectedServices((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]))
  }

  const updateForm = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const total = useMemo(() => {
    const base = calculator.services
      .filter((s) => selectedServices.includes(s.id))
      .reduce((sum, s) => sum + s.basePrice, 0)
    return Math.round(base * (scale?.multiplier || 1))
  }, [selectedServices, scale, calculator.services])

  const selectedLabels = calculator.services.filter((s) => selectedServices.includes(s.id)).map((s) => s.label)
  const totalDisplay = selectedServices.length === 0 ? calculator.emptyStateLabel : idr(total)

  const isValid = form.name.trim().length > 0 && form.phone.trim().length > 0
  const completedSteps = [selectedServices.length > 0, Boolean(scaleId), isValid]

  const waMessage = encodeURIComponent(
    `Halo Bangsa Media Bali, saya tertarik untuk mendiskusikan proyek IT dengan perkiraan kebutuhan berikut:\n\n` +
      `Layanan Terpilih:\n${selectedLabels.map((l) => `• ${l}`).join('\n') || '-'}\n\n` +
      `Skala Proyek: ${scale?.label || '-'}\n` +
      `Estimasi Budget Kalkulator: ${totalDisplay}\n\n` +
      `Data Kontak:\n` +
      `Nama: ${form.name || '-'}\n` +
      `Telepon: ${form.phone || '-'}\n` +
      `Email: ${form.email || '-'}\n` +
      `Nama Bisnis: ${form.businessName || '-'}\n` +
      `Jenis Usaha: ${form.businessType || '-'}\n` +
      `Alamat: ${form.address || '-'}\n` +
      `Jadwal Konsultasi: ${form.consultDate || '-'}${form.consultDate ? `, pukul ${form.consultTime}` : ''}\n\n` +
      `Mohon info ketersediaan slot konsultasi gratis. Terima kasih!`,
  )
  const waLink = `https://wa.me/${calculator.whatsappNumber}?text=${waMessage}`

  const handleSubmit = (e) => {
    if (!isValid) {
      e.preventDefault()
      setTouched(true)
      return
    }
    if (!isSupabaseConfigured) return
    // Simpan lead di background; tidak menghalangi WhatsApp terbuka meski gagal/lambat.
    setSubmitState('saving')
    supabase
      .from('consultation_leads')
      .insert({
        name: form.name,
        phone: form.phone,
        email: form.email || null,
        business_name: form.businessName || null,
        business_type: form.businessType || null,
        address: form.address || null,
        services: selectedLabels,
        scale: scale?.label || null,
        estimated_total: total,
        consult_date: form.consultDate || null,
        consult_time: form.consultDate ? form.consultTime : null,
      })
      .then(({ error }) => {
        setSubmitState(error ? 'idle' : 'saved')
        if (error) console.warn('Gagal menyimpan lead ke Supabase:', error.message)
      })
  }

  return (
    <div className="glass-panel rounded-3xl border border-cyan-royal/30 p-6 shadow-blue-glow sm:p-10">
      {contextNote && (
        <div className="mb-6 rounded-xl border border-gold/30 bg-gold/10 px-4 py-2.5 text-xs font-semibold text-gold-soft">
          {contextNote}
        </div>
      )}
      <Stepper completedSteps={completedSteps} />
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <div>
            <label className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-royal text-xs font-black text-navy-950">1</span>
              {calculator.step1Label}
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {calculator.services.map((s) => (
                <label
                  key={s.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-all ${
                    selectedServices.includes(s.id)
                      ? 'border-cyan-royal/60 bg-navy-900/70'
                      : 'border-white/10 bg-navy-900/40 hover:border-cyan-royal/40'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedServices.includes(s.id)}
                    onChange={() => toggleService(s.id)}
                    className="mt-1 h-4 w-4 rounded accent-cyan-royal"
                  />
                  <div>
                    <div className="text-sm font-semibold text-white">{s.label}</div>
                    <div className="text-xs text-slate-400">mulai {idr(s.basePrice)}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-royal text-xs font-black text-navy-950">2</span>
              {calculator.step2Label}
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {calculator.scales.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => setScaleId(s.id)}
                  className={`rounded-xl border px-4 py-3 text-center text-xs font-bold transition-all ${
                    scaleId === s.id
                      ? 'border-cyan-royal bg-navy-900/80 text-white'
                      : 'border-white/10 bg-navy-900/40 text-slate-400 hover:border-white/25'
                  }`}
                >
                  <p>{s.label}</p>
                  <p className="mt-1 text-[10px] font-medium normal-case text-slate-400">{s.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-royal text-xs font-black text-navy-950">3</span>
              {calculator.step3Label}
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-400">{fields.name} *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => updateForm('name', e.target.value)}
                  className={`input-field ${touched && !form.name.trim() ? '!border-red-500' : ''}`}
                  placeholder={fields.name}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-400">{fields.phone} *</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => updateForm('phone', normalizePhone(e.target.value))}
                  className={`input-field ${touched && !form.phone.trim() ? '!border-red-500' : ''}`}
                  placeholder="08xxxxxxxxxx"
                />
                {form.phone && <p className="mt-1 text-[10px] text-slate-500">Format WhatsApp: +{form.phone}</p>}
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-400">{fields.email}</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => updateForm('email', e.target.value)}
                  className="input-field"
                  placeholder="nama@email.com"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-400">{fields.businessName}</label>
                <input
                  type="text"
                  value={form.businessName}
                  onChange={(e) => updateForm('businessName', e.target.value)}
                  className="input-field"
                  placeholder={fields.businessName}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-400">{fields.businessType}</label>
                <select
                  value={form.businessType}
                  onChange={(e) => updateForm('businessType', e.target.value)}
                  className="input-field"
                >
                  {(calculator.businessTypes || []).filter(Boolean).map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-400">{fields.address}</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => updateForm('address', e.target.value)}
                  className="input-field"
                  placeholder={fields.address}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-400">{fields.consultDate}</label>
                <input
                  type="date"
                  min={todayStr()}
                  value={form.consultDate}
                  onChange={(e) => updateForm('consultDate', e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-400">{fields.consultTime}</label>
                <select
                  value={form.consultTime}
                  onChange={(e) => updateForm('consultTime', e.target.value)}
                  className="input-field"
                >
                  {(calculator.timeSlots || []).filter(Boolean).map((slot) => (
                    <option key={slot} value={slot} disabled={bookedSlots.includes(slot)}>
                      {slot} {bookedSlots.includes(slot) ? '(Penuh)' : ''}
                    </option>
                  ))}
                </select>
                {isSupabaseConfigured && form.consultDate && bookedSlots.length > 0 && (
                  <p className="mt-1 text-[10px] text-amber-400">
                    {bookedSlots.length} slot pada tanggal ini sudah dibooking pengunjung lain.
                  </p>
                )}
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">{calculator.step3RequiredNote}</p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-cyan-royal/40 bg-gradient-to-b from-navy-800 to-navy-950 p-6 shadow-xl sm:p-8 lg:col-span-5">
          <div className="flex items-center justify-between border-b border-blue-900/60 pb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-royal">{calculator.summaryLabel}</span>
            {calculator.turnaround && (
              <span className="rounded-full border border-gold/30 bg-gold/20 px-2.5 py-0.5 text-[11px] font-semibold text-gold-soft">
                {calculator.turnaround}
              </span>
            )}
          </div>

          <div className="my-6">
            <div className="mb-1 text-xs uppercase tracking-wider text-slate-400">{calculator.investmentLabel}</div>
            <div className="text-3xl font-extrabold text-white sm:text-4xl">{totalDisplay}</div>
            <div className="mt-2 text-xs text-slate-500">{calculator.disclaimer}</div>
          </div>

          {calculator.perks?.filter(Boolean).length > 0 && (
            <div className="mb-8 space-y-2 text-xs text-slate-300">
              {calculator.perks.filter(Boolean).map((perk) => (
                <div key={perk} className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="shrink-0 text-cyan-royal" /> {perk}
                </div>
              ))}
            </div>
          )}

          <a
            href={waLink}
            onClick={handleSubmit}
            target={isValid ? '_blank' : undefined}
            rel="noopener noreferrer"
            className={`flex w-full items-center justify-center gap-2.5 rounded-xl py-4 text-sm font-bold uppercase tracking-wider text-white shadow-lg transition-transform hover:scale-[1.02] ${
              isValid
                ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 shadow-emerald-500/25'
                : 'bg-gradient-to-r from-emerald-500/50 via-teal-500/50 to-cyan-500/50 shadow-none'
            }`}
          >
            <MessageSquare size={18} /> {calculator.waButtonLabel}
          </a>
          {touched && !isValid && (
            <p className="mt-2 text-center text-[11px] font-semibold text-red-400">
              Mohon lengkapi {fields.name} dan {fields.phone} terlebih dahulu.
            </p>
          )}
          {submitState === 'saved' && (
            <p className="mt-2 text-center text-[11px] font-semibold text-emerald-400">
              Data Anda tersimpan — tim kami akan segera menghubungi.
            </p>
          )}

          <div className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-400">
            <Shield size={14} className="text-gold" /> {calculator.trustBadge}
          </div>
        </div>
      </div>
    </div>
  )
}
