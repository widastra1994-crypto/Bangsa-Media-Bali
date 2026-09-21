import { useSectionDraft } from '../useSectionDraft'
import { AddButton, ArrayCard, Field, ImageUploadField, SaveBar, TextArea, TextInput } from '../FormFields'

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
        <Field label="Gambar Maskot (opsional)">
          <ImageUploadField value={draft.mascotImage} onChange={(url) => setDraft({ ...draft, mascotImage: url })} pathPrefix="hero" />
        </Field>
        {!draft.mascotImage && <p className="text-xs text-slate-500">Saat ini memakai maskot robot animasi bawaan (SVG). Upload gambar di atas untuk menggantinya dengan gambar/logo sendiri.</p>}
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
