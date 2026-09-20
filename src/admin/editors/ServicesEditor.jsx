import { Code2, Database, Megaphone, Palette } from 'lucide-react'
import { useSectionDraft } from '../useSectionDraft'
import { AddButton, ArrayCard, Field, SaveBar, SelectInput, TextArea, TextInput } from '../FormFields'

const VARIANT_OPTIONS = [
  { value: 'dev', label: 'Ikon Developer (biru) — Code2' },
  { value: 'erp', label: 'Ikon ERP/POS (indigo) — Database' },
  { value: 'ads', label: 'Ikon Ads (hijau) — Megaphone' },
  { value: 'design', label: 'Ikon Design (pink) — Palette' },
]

const PREVIEW_ICON = { dev: Code2, erp: Database, ads: Megaphone, design: Palette }

export default function ServicesEditor() {
  const { draft, setDraft, save, saved } = useSectionDraft('services')

  const updateItem = (idx, field, value) => {
    const items = [...draft.items]
    items[idx] = { ...items[idx], [field]: value }
    setDraft({ ...draft, items })
  }

  const removeItem = (idx) => setDraft({ ...draft, items: draft.items.filter((_, i) => i !== idx) })

  const addItem = () =>
    setDraft({
      ...draft,
      items: [
        ...draft.items,
        { id: `layanan-${Date.now()}`, variant: 'dev', title: 'Layanan Baru', description: 'Deskripsi layanan baru.', features: [] },
      ],
    })

  return (
    <div>
      <h2 className="text-lg font-semibold text-white">Layanan Utama</h2>
      <p className="mt-1 text-sm text-slate-400">Kelola judul, deskripsi, bullet fitur, dan kartu grid layanan.</p>

      <div className="mt-6 grid grid-cols-1 gap-4">
        <Field label="Eyebrow">
          <TextInput value={draft.eyebrow} onChange={(v) => setDraft({ ...draft, eyebrow: v })} />
        </Field>
        <Field label="Judul Section">
          <TextInput value={draft.title} onChange={(v) => setDraft({ ...draft, title: v })} />
        </Field>
        <Field label="Deskripsi Section">
          <TextArea rows={2} value={draft.description} onChange={(v) => setDraft({ ...draft, description: v })} />
        </Field>
        <Field label="Label Tombol CTA di Setiap Kartu">
          <TextInput value={draft.ctaLabel} onChange={(v) => setDraft({ ...draft, ctaLabel: v })} />
        </Field>
      </div>

      <h3 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-gold-soft">Kartu Layanan</h3>
      <div className="space-y-4">
        {draft.items.map((item, idx) => {
          const PreviewIcon = PREVIEW_ICON[item.variant] || Code2
          return (
            <ArrayCard key={item.id} title={`Layanan ${idx + 1}`} onRemove={() => removeItem(idx)}>
              <div className="flex items-center justify-center sm:col-span-2">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-tr from-ebtblue to-cyan-royal text-white">
                  <PreviewIcon size={26} />
                </div>
              </div>
              <Field label="Judul Layanan">
                <TextInput value={item.title} onChange={(v) => updateItem(idx, 'title', v)} />
              </Field>
              <Field label="Gaya Ikon">
                <SelectInput value={item.variant} onChange={(v) => updateItem(idx, 'variant', v)} options={VARIANT_OPTIONS} />
              </Field>
              <Field label="Deskripsi" className="sm:col-span-2">
                <TextArea rows={2} value={item.description} onChange={(v) => updateItem(idx, 'description', v)} />
              </Field>
              <Field label="Bullet Fitur (satu baris = satu poin)" className="sm:col-span-2">
                <TextArea
                  rows={3}
                  value={(item.features || []).join('\n')}
                  onChange={(v) => updateItem(idx, 'features', v.split('\n'))}
                />
              </Field>
            </ArrayCard>
          )
        })}
        <AddButton onClick={addItem} label="Tambah Layanan" />
      </div>

      <SaveBar onSave={save} saved={saved} />
    </div>
  )
}
