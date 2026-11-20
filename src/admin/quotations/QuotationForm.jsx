import { useState } from 'react'
import { ArrowDown, ArrowUp, CheckCircle2, Circle, Plus, Receipt, Star, Trash2, X } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import ClientPicker from '../accounting/ClientPicker'
import { SERVICE_TYPES, addDays, idr, templateFor, todayLocal } from './quoteTemplates'
import { isPricing } from '../../lib/proposalFormat'

function Section({ title, hint, children }) {
  return (
    <div className="rounded-2xl border border-white/10 p-4">
      <p className="text-sm font-semibold text-white">{title}</p>
      {hint && <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>}
      <div className="mt-3">{children}</div>
    </div>
  )
}

// Daftar bagian proposal (Pendahuluan, Tujuan, Ruang Lingkup, ...). Blok
// Investasi (estimasi waktu, paket, termin, maintenance) bisa dipindah posisinya.
function SectionsEditor({ sections, onChange }) {
  const move = (i, d) => {
    const j = i + d
    if (j < 0 || j >= sections.length) return
    const next = [...sections]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  const update = (i, patch) => onChange(sections.map((x, idx) => (idx === i ? { ...x, ...patch } : x)))
  const iconBtn = 'flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-white/10 hover:text-white disabled:opacity-30'
  return (
    <div className="space-y-3">
      {sections.map((sec, i) => (
        <div key={i} className={`rounded-xl border p-3 ${isPricing(sec) ? 'border-dashed border-cyan-royal/50 bg-cyan-500/5' : 'border-white/10'}`}>
          <div className="flex items-center gap-2">
            <span className="w-6 shrink-0 text-center text-xs font-bold text-slate-500">{i + 1}</span>
            {isPricing(sec) ? (
              <p className="flex flex-1 items-center gap-1.5 text-xs font-semibold text-cyan-royal">
                <Receipt size={14} /> Blok Investasi: estimasi waktu, paket & harga, termin, maintenance
              </p>
            ) : (
              <input className="input-field flex-1 !py-1.5 text-sm font-semibold" value={sec.title} onChange={(e) => update(i, { title: e.target.value })} placeholder="Judul bagian, mis. Pendahuluan" />
            )}
            <button type="button" className={iconBtn} onClick={() => move(i, -1)} disabled={i === 0} aria-label="Naikkan">
              <ArrowUp size={14} />
            </button>
            <button type="button" className={iconBtn} onClick={() => move(i, 1)} disabled={i === sections.length - 1} aria-label="Turunkan">
              <ArrowDown size={14} />
            </button>
            {!isPricing(sec) && (
              <button type="button" className={`${iconBtn} hover:!text-red-400`} onClick={() => onChange(sections.filter((_, idx) => idx !== i))} aria-label="Hapus bagian">
                <Trash2 size={14} />
              </button>
            )}
          </div>
          {!isPricing(sec) && (
            <textarea rows={7} className="input-field mt-2 font-mono text-xs leading-relaxed" value={sec.content} onChange={(e) => update(i, { content: e.target.value })} />
          )}
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => onChange([...sections, { title: '', content: '' }])} className="flex items-center gap-1 text-xs font-semibold text-cyan-royal hover:underline">
          <Plus size={13} /> Tambah bagian
        </button>
        {!sections.some(isPricing) && (
          <button type="button" onClick={() => onChange([...sections, { type: 'pricing' }])} className="text-xs font-semibold text-cyan-royal hover:underline">
            + Tambahkan blok Investasi
          </button>
        )}
      </div>
      <p className="rounded-lg bg-white/5 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
        Format isi: <code>## Sub judul</code> · <code>- poin</code> · <code>1. Judul poin</code> (baris di bawahnya jadi keterangan) · <code>**tebal**</code> · baris kosong =
        paragraf baru · <code>{'{klien}'}</code> otomatis diganti nama klien.
      </p>
    </div>
  )
}

const lines = (text) =>
  String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

// Form buat/edit penawaran. Jenis layanan mengisi template awal yang bisa
// diubah semuanya.
export default function QuotationForm({ quote, clients, onClose, onSaved }) {
  const isNew = !quote?.id
  const [clientList, setClientList] = useState(clients)
  const [form, setForm] = useState(() => {
    const base = isNew ? templateFor('website') : quote
    return {
      client_id: quote?.client_id || '',
      service_type: base.service_type,
      title: base.title || '',
      needs: base.needs || '',
      solution: base.solution || '',
      packages: (base.packages || []).map((p, i, arr) => ({ ...p, recommended: arr.length === 1 ? true : !!p.recommended, featuresText: (p.features || []).join('\n') })),
      single_package: isNew || (base.packages || []).length <= 1,
      timelineText: (base.timeline || []).join('\n'),
      payment_terms: base.payment_terms || [],
      valid_until: quote?.valid_until || addDays(todayLocal(), 14),
      guarantee: base.guarantee || '',
      revisions: base.revisions ?? 2,
      terms: base.terms || '',
      doc_title: base.doc_title || '',
      addressed_to: base.addressed_to || 'Management Perusahaan',
      sections: base.sections?.length ? base.sections : templateFor(base.service_type || 'other').sections,
      estimated_duration: base.estimated_duration || '',
      maintenance_fee: base.maintenance_fee ?? '',
      maintenance_period: base.maintenance_period || 'tahun',
      maintenance_note: base.maintenance_note || '',
    }
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const changeType = (type) => {
    if (!isNew && !window.confirm('Ganti isi penawaran dengan template layanan ini? Isi proposal, paket, timeline, dan maintenance akan diganti.')) return
    const t = templateFor(type)
    set({
      service_type: type,
      title: t.title || form.title,
      solution: t.solution,
      packages: t.packages.map((p) => ({ ...p, featuresText: p.features.join('\n') })),
      timelineText: t.timeline.join('\n'),
      guarantee: t.guarantee,
      revisions: t.revisions,
      doc_title: t.doc_title,
      sections: t.sections,
      estimated_duration: t.estimated_duration,
      maintenance_fee: t.maintenance_fee,
      maintenance_period: t.maintenance_period,
      maintenance_note: t.maintenance_note,
    })
  }

  const setPkg = (i, patch) => set({ packages: form.packages.map((p, idx) => (idx === i ? { ...p, ...patch } : p)) })
  const setRecommended = (i) => set({ packages: form.packages.map((p, idx) => ({ ...p, recommended: idx === i })) })
  const setTerm = (i, patch) => set({ payment_terms: form.payment_terms.map((t, idx) => (idx === i ? { ...t, ...patch } : t)) })
  const termTotal = form.payment_terms.reduce((s, t) => s + (Number(t.percent) || 0), 0)

  const save = async () => {
    if (!form.client_id) return setError('Pilih klien.')
    if (!form.title.trim()) return setError('Isi judul penawaran.')
    if (form.single_package && !form.packages.some((p) => p.recommended)) return setError('Pilih satu paket yang ditawarkan ke klien.')
    const packages = form.packages
      .filter((p) => !form.single_package || p.recommended)
      .map((p) => ({ name: p.name.trim(), price: Number(p.price) || 0, recommended: form.single_package ? false : !!p.recommended, features: lines(p.featuresText) }))
      .filter((p) => p.name)
    if (!packages.length) return setError(form.single_package ? 'Paket yang dipilih belum diberi nama.' : 'Isi minimal satu paket.')
    if (packages.some((p) => p.price <= 0)) return setError('Isi harga setiap paket.')
    if (form.payment_terms.length && termTotal !== 100) return setError(`Total persen termin harus 100% (sekarang ${termTotal}%).`)
    setBusy(true)
    setError('')
    const payload = {
      client_id: form.client_id,
      service_type: form.service_type,
      title: form.title.trim(),
      needs: form.needs.trim() || null,
      solution: form.solution.trim() || null,
      packages,
      timeline: lines(form.timelineText),
      payment_terms: form.payment_terms
        .map((t) => ({ label: t.label.trim(), percent: Number(t.percent) || 0 }))
        .filter((t) => t.label && t.percent > 0),
      valid_until: form.valid_until || null,
      guarantee: form.guarantee.trim() || null,
      revisions: form.revisions === '' ? null : Number(form.revisions),
      terms: form.terms.trim() || null,
      doc_title: form.doc_title.trim() || null,
      addressed_to: form.addressed_to.trim() || null,
      sections: form.sections
        .map((x) => (isPricing(x) ? { type: 'pricing' } : { title: (x.title || '').trim(), content: x.content || '' }))
        .filter((x) => isPricing(x) || x.title || x.content.trim()),
      estimated_duration: form.estimated_duration.trim() || null,
      maintenance_fee: form.maintenance_fee === '' ? null : Number(form.maintenance_fee) || null,
      maintenance_period: form.maintenance_period,
      maintenance_note: form.maintenance_note.trim() || null,
    }
    // Revisi selesai dikerjakan: kembali menunggu keputusan klien.
    if (quote?.status === 'revision_requested') payload.status = 'sent'
    const res = isNew ? await supabase.from('acc_quotations').insert(payload) : await supabase.from('acc_quotations').update(payload).eq('id', quote.id)
    setBusy(false)
    if (res.error) return setError(res.error.message)
    onSaved(isNew ? 'Penawaran disimpan sebagai draf. Bagikan ke klien dari daftar.' : 'Penawaran diperbarui.')
  }

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto overscroll-contain bg-black/60 px-3 py-6 sm:p-6">
      <div className="glass-panel mx-auto my-4 w-full max-w-3xl rounded-2xl p-4 sm:my-10 sm:p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">{isNew ? 'Buat Penawaran' : `Edit ${quote.quote_number}`}</h3>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white" aria-label="Tutup">
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label-field">Klien</label>
              <ClientPicker
                clients={clientList}
                value={form.client_id}
                onChange={(id) => set({ client_id: id })}
                onCreated={(c) => setClientList((l) => [...l, c].sort((a, b) => a.company_name.localeCompare(b.company_name)))}
              />
            </div>
            <div>
              <label className="label-field">Jenis Layanan</label>
              <select className="input-field" value={form.service_type} onChange={(e) => changeType(e.target.value)}>
                {SERVICE_TYPES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-slate-500">Mengisi template paket, timeline & garansi.</p>
            </div>
            <div>
              <label className="label-field">Judul Penawaran</label>
              <input className="input-field" value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="mis. Website Booking Villa Sunrise" />
            </div>
          </div>

          <Section title="Kop Proposal">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label-field">Judul dokumen</label>
                <input className="input-field" value={form.doc_title} onChange={(e) => set({ doc_title: e.target.value })} placeholder="mis. Proposal Penawaran Operational & Business Management System" />
              </div>
              <div>
                <label className="label-field">Ditujukan kepada</label>
                <input className="input-field" value={form.addressed_to} onChange={(e) => set({ addressed_to: e.target.value })} placeholder="mis. Management Perusahaan" />
              </div>
              <p className="self-end text-[11px] text-slate-500">Nama klien, tanggal, dan nomor penawaran ditambahkan otomatis.</p>
            </div>
          </Section>

          <Section title="Isi Proposal" hint="Susunan bagian proposal seperti dokumen resmi. Urutan bisa diatur dengan panah.">
            <SectionsEditor sections={form.sections} onChange={(sections) => set({ sections })} />
          </Section>

          <Section
            title="Paket & Harga"
            hint={
              form.single_package
                ? 'Klik "Pilih paket ini" pada paket yang ditawarkan. Hanya paket terpilih yang tampil ke klien. Fitur: satu baris satu fitur.'
                : '1-3 paket, klien memilih sendiri. Tandai satu sebagai rekomendasi (bintang). Fitur: satu baris satu fitur.'
            }
          >
            <div className="mb-3 inline-flex rounded-xl border border-white/10 p-1 text-xs font-semibold">
              {[
                [true, 'Satu paket (dipilih admin)'],
                [false, 'Beberapa pilihan untuk klien'],
              ].map(([v, label]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => set({ single_package: v })}
                  className={`rounded-lg px-3 py-1.5 ${form.single_package === v ? 'bg-cyan-royal text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {form.packages.map((p, i) => (
                <div
                  key={i}
                  className={`rounded-xl border p-3 transition ${p.recommended ? 'border-2 border-cyan-royal/60' : 'border-white/10'} ${form.single_package && !p.recommended ? 'opacity-60 hover:opacity-100' : ''}`}
                >
                  {form.single_package && (
                    <button
                      type="button"
                      onClick={() => setRecommended(i)}
                      className={`mb-2 flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold ${p.recommended ? 'bg-cyan-royal text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
                    >
                      {p.recommended ? <CheckCircle2 size={14} /> : <Circle size={14} />} {p.recommended ? 'Paket dipilih' : 'Pilih paket ini'}
                    </button>
                  )}
                  <div className="flex items-center gap-1.5">
                    <input className="input-field !py-1.5 text-sm font-semibold" value={p.name} onChange={(e) => setPkg(i, { name: e.target.value })} placeholder="Nama paket" />
                    {!form.single_package && (
                      <button
                        type="button"
                        onClick={() => setRecommended(i)}
                        className={p.recommended ? 'text-amber-400' : 'text-slate-400 hover:text-amber-400'}
                        title="Jadikan paket rekomendasi"
                        aria-label="Jadikan paket rekomendasi"
                      >
                        <Star size={16} fill={p.recommended ? 'currentColor' : 'none'} />
                      </button>
                    )}
                    {form.packages.length > 1 && (
                      <button type="button" onClick={() => set({ packages: form.packages.filter((_, idx) => idx !== i) })} className="text-slate-400 hover:text-red-400" aria-label="Hapus paket">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                  <input type="number" min="0" className="input-field mt-2 !py-1.5 text-sm" value={p.price} onChange={(e) => setPkg(i, { price: e.target.value })} placeholder="Harga" />
                  <p className="mt-1 text-[11px] text-slate-500">{idr(p.price)}</p>
                  <textarea rows={5} className="input-field mt-2 text-xs" value={p.featuresText} onChange={(e) => setPkg(i, { featuresText: e.target.value })} placeholder="Satu fitur per baris" />
                </div>
              ))}
            </div>
            {form.packages.length < 3 && (
              <button
                type="button"
                onClick={() => set({ packages: [...form.packages, { name: '', price: '', recommended: false, featuresText: '' }] })}
                className="mt-3 flex items-center gap-1 text-xs font-semibold text-cyan-royal hover:underline"
              >
                <Plus size={13} /> Tambah paket
              </button>
            )}
          </Section>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Section title="Timeline Pengerjaan" hint="Satu baris satu tahap.">
              <textarea rows={5} className="input-field text-xs" value={form.timelineText} onChange={(e) => set({ timelineText: e.target.value })} />
            </Section>
            <Section title="Termin Pembayaran" hint={`Total harus 100% (sekarang ${termTotal}%).`}>
              <div className="space-y-2">
                {form.payment_terms.map((t, i) => (
                  <div key={i} className="flex gap-2">
                    <input className="input-field flex-1 !py-1.5 text-xs" value={t.label} onChange={(e) => setTerm(i, { label: e.target.value })} placeholder="mis. DP" />
                    <input type="number" min="0" max="100" className="input-field !w-20 !py-1.5 text-xs" value={t.percent} onChange={(e) => setTerm(i, { percent: e.target.value })} />
                    <span className="self-center text-xs text-slate-500">%</span>
                    <button type="button" onClick={() => set({ payment_terms: form.payment_terms.filter((_, idx) => idx !== i) })} className="text-slate-400 hover:text-red-400" aria-label="Hapus termin">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => set({ payment_terms: [...form.payment_terms, { label: '', percent: '' }] })} className="mt-2 flex items-center gap-1 text-xs font-semibold text-cyan-royal hover:underline">
                <Plus size={13} /> Tambah termin
              </button>
            </Section>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="label-field">Berlaku sampai</label>
              <input type="date" className="input-field" value={form.valid_until} onChange={(e) => set({ valid_until: e.target.value })} />
            </div>
            <div>
              <label className="label-field">Jumlah revisi</label>
              <input type="number" min="0" className="input-field" value={form.revisions} onChange={(e) => set({ revisions: e.target.value })} />
            </div>
            <div>
              <label className="label-field">Garansi</label>
              <input className="input-field" value={form.guarantee} onChange={(e) => set({ guarantee: e.target.value })} placeholder="mis. perbaikan bug 3 bulan" />
            </div>
          </div>
          <Section title="Estimasi Waktu & Maintenance" hint="Tampil di blok Investasi. Kosongkan biaya maintenance bila tidak ada.">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="label-field">Estimasi pengerjaan</label>
                <input className="input-field" value={form.estimated_duration} onChange={(e) => set({ estimated_duration: e.target.value })} placeholder="mis. 1 – 3 Minggu" />
              </div>
              <div>
                <label className="label-field">Biaya maintenance</label>
                <input type="number" min="0" className="input-field" value={form.maintenance_fee} onChange={(e) => set({ maintenance_fee: e.target.value })} placeholder="mis. 5000000" />
              </div>
              <div>
                <label className="label-field">Per</label>
                <select className="input-field" value={form.maintenance_period} onChange={(e) => set({ maintenance_period: e.target.value })}>
                  <option value="tahun">Tahun</option>
                  <option value="bulan">Bulan</option>
                </select>
              </div>
              <div className="sm:col-span-3">
                <label className="label-field">Layanan maintenance meliputi (format sama seperti isi proposal)</label>
                <textarea rows={5} className="input-field font-mono text-xs" value={form.maintenance_note} onChange={(e) => set({ maintenance_note: e.target.value })} />
              </div>
            </div>
          </Section>

          <div>
            <label className="label-field">Ketentuan tambahan (opsional, masuk ke kontrak)</label>
            <textarea rows={3} className="input-field text-xs" value={form.terms} onChange={(e) => set({ terms: e.target.value })} placeholder="mis. Materi foto & teks disediakan klien paling lambat minggu pertama." />
          </div>
        </div>

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary !py-2 text-xs">
            Batal
          </button>
          <button type="button" onClick={save} disabled={busy} className="btn-primary !py-2 text-xs disabled:opacity-60">
            {busy ? 'Menyimpan...' : 'Simpan Penawaran'}
          </button>
        </div>
      </div>
    </div>
  )
}
