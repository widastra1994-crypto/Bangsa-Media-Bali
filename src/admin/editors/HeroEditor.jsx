import { ImageOff } from 'lucide-react'
import { useSectionDraft } from '../useSectionDraft'
import { AddButton, ArrayCard, Field, SaveBar, TextArea, TextInput } from '../FormFields'

export default function HeroEditor() {
  const { draft, setDraft, save, saved } = useSectionDraft('hero')

  const updateBadge = (idx, field, value) => {
    const badges = [...draft.badges]
    badges[idx] = { ...badges[idx], [field]: value }
    setDraft({ ...draft, badges })
  }

  const removeBadge = (idx) => setDraft({ ...draft, badges: draft.badges.filter((_, i) => i !== idx) })

  const addBadge = () =>
    setDraft({ ...draft, badges: [...draft.badges, { label: 'Statistik Baru', value: '0' }] })

  return (
    <div>
      <h2 className="text-lg font-semibold text-white">Hero Section</h2>
      <p className="mt-1 text-sm text-slate-400">Headline utama, deskripsi, tombol CTA, dan badge statistik.</p>

      <div className="mt-6 grid grid-cols-1 gap-4">
        <Field label="Eyebrow / Label Kecil">
          <TextInput value={draft.eyebrow} onChange={(v) => setDraft({ ...draft, eyebrow: v })} />
        </Field>
        <Field label="Headline">
          <TextArea rows={2} value={draft.headline} onChange={(v) => setDraft({ ...draft, headline: v })} />
        </Field>
        <Field label="Deskripsi">
          <TextArea rows={3} value={draft.description} onChange={(v) => setDraft({ ...draft, description: v })} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Label Tombol Utama">
            <TextInput value={draft.ctaPrimary} onChange={(v) => setDraft({ ...draft, ctaPrimary: v })} />
          </Field>
          <Field label="Label Tombol Kedua">
            <TextInput value={draft.ctaSecondary} onChange={(v) => setDraft({ ...draft, ctaSecondary: v })} />
          </Field>
        </div>
      </div>

      <h3 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-gold-soft">Ikon/Maskot Robot</h3>
      <div className="grid grid-cols-1 gap-4">
        <Field label="URL Gambar Maskot (opsional)">
          <TextInput
            value={draft.mascotImage}
            onChange={(v) => setDraft({ ...draft, mascotImage: v })}
            placeholder="Kosongkan untuk pakai maskot robot animasi bawaan"
          />
        </Field>
        {draft.mascotImage ? (
          <div className="flex items-center gap-4">
            <img
              src={draft.mascotImage}
              alt="Preview maskot"
              className="h-28 w-28 rounded-2xl border border-white/10 object-contain bg-navy-900/60"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
                e.currentTarget.nextSibling.style.display = 'flex'
              }}
            />
            <div className="hidden h-28 w-28 items-center justify-center gap-2 rounded-2xl border border-dashed border-red-500/40 text-xs text-red-400">
              <ImageOff size={16} /> Gagal dimuat
            </div>
            <button type="button" onClick={() => setDraft({ ...draft, mascotImage: '' })} className="btn-secondary !px-3 !py-2 text-xs">
              Pakai Maskot Bawaan
            </button>
          </div>
        ) : (
          <p className="text-xs text-slate-500">Saat ini memakai maskot robot animasi bawaan (SVG). Isi URL gambar di atas untuk menggantinya dengan gambar/logo sendiri.</p>
        )}
      </div>

      <h3 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-gold-soft">Badge Statistik</h3>
      <div className="space-y-4">
        {draft.badges.map((badge, idx) => (
          <ArrayCard key={idx} title={`Badge ${idx + 1}`} onRemove={() => removeBadge(idx)}>
            <Field label="Nilai (contoh: 120+)">
              <TextInput value={badge.value} onChange={(v) => updateBadge(idx, 'value', v)} />
            </Field>
            <Field label="Label">
              <TextInput value={badge.label} onChange={(v) => updateBadge(idx, 'label', v)} />
            </Field>
          </ArrayCard>
        ))}
        <AddButton onClick={addBadge} label="Tambah Badge" />
      </div>

      <SaveBar onSave={save} saved={saved} />
    </div>
  )
}
