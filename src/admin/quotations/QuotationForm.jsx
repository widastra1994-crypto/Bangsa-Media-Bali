import { useState } from 'react'
import { Plus, Star, Trash2, X } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import ClientPicker from '../accounting/ClientPicker'
import { SERVICE_TYPES, addDays, idr, templateFor, todayLocal } from './quoteTemplates'

function Section({ title, hint, children }) {
  return (
    <div className="rounded-2xl border border-white/10 p-4">
      <p className="text-sm font-semibold text-white">{title}</p>
      {hint && <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>}
      <div className="mt-3">{children}</div>
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
      packages: (base.packages || []).map((p) => ({ ...p, featuresText: (p.features || []).join('\n') })),
      timelineText: (base.timeline || []).join('\n'),
      payment_terms: base.payment_terms || [],
      valid_until: quote?.valid_until || addDays(todayLocal(), 14),
      guarantee: base.guarantee || '',
      revisions: base.revisions ?? 2,
      terms: base.terms || '',
    }
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const changeType = (type) => {
    if (!isNew && !window.confirm('Ganti isi penawaran dengan template layanan ini? Isian paket, timeline, dan garansi akan diganti.')) return
    const t = templateFor(type)
    set({
      service_type: type,
      title: t.title || form.title,
      solution: t.solution,
      packages: t.packages.map((p) => ({ ...p, featuresText: p.features.join('\n') })),
      timelineText: t.timeline.join('\n'),
      guarantee: t.guarantee,
      revisions: t.revisions,
    })
  }

  const setPkg = (i, patch) => set({ packages: form.packages.map((p, idx) => (idx === i ? { ...p, ...patch } : p)) })
  const setRecommended = (i) => set({ packages: form.packages.map((p, idx) => ({ ...p, recommended: idx === i })) })
  const setTerm = (i, patch) => set({ payment_terms: form.payment_terms.map((t, idx) => (idx === i ? { ...t, ...patch } : t)) })
  const termTotal = form.payment_terms.reduce((s, t) => s + (Number(t.percent) || 0), 0)

  const save = async () => {
    if (!form.client_id) return setError('Pilih klien.')
    if (!form.title.trim()) return setError('Isi judul penawaran.')
    const packages = form.packages
      .map((p) => ({ name: p.name.trim(), price: Number(p.price) || 0, recommended: !!p.recommended, features: lines(p.featuresText) }))
      .filter((p) => p.name)
    if (!packages.length) return setError('Isi minimal satu paket.')
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

          <Section title="Kebutuhan & Solusi" hint="Ditampilkan paling atas supaya klien merasa dipahami.">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label-field">Kebutuhan / masalah klien</label>
                <textarea rows={3} className="input-field" value={form.needs} onChange={(e) => set({ needs: e.target.value })} placeholder="mis. Tamu masih booking lewat chat dan sering dobel jadwal." />
              </div>
              <div>
                <label className="label-field">Solusi kami</label>
                <textarea rows={3} className="input-field" value={form.solution} onChange={(e) => set({ solution: e.target.value })} />
              </div>
            </div>
          </Section>

          <Section title="Pilihan Paket" hint="1-3 paket. Tandai satu sebagai rekomendasi (bintang). Fitur: satu baris satu fitur.">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {form.packages.map((p, i) => (
                <div key={i} className={`rounded-xl border p-3 ${p.recommended ? 'border-2 border-cyan-royal/60' : 'border-white/10'}`}>
                  <div className="flex items-center gap-1.5">
                    <input className="input-field !py-1.5 text-sm font-semibold" value={p.name} onChange={(e) => setPkg(i, { name: e.target.value })} placeholder="Nama paket" />
                    <button
                      type="button"
                      onClick={() => setRecommended(i)}
                      className={p.recommended ? 'text-amber-400' : 'text-slate-400 hover:text-amber-400'}
                      title="Jadikan paket rekomendasi"
                      aria-label="Jadikan paket rekomendasi"
                    >
                      <Star size={16} fill={p.recommended ? 'currentColor' : 'none'} />
                    </button>
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
