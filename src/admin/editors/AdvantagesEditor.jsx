import { useSectionDraft } from '../useSectionDraft'
import { AddButton, ArrayCard, Field, SaveBar, SelectInput, TextArea, TextInput } from '../FormFields'

const ICON_OPTIONS = [
  { value: 'code-2', label: 'Code' },
  { value: 'clock', label: 'Clock' },
  { value: 'sparkles', label: 'Sparkles' },
  { value: 'headphones', label: 'Headphones' },
]

const COLOR_OPTIONS = [
  { value: 'cyan', label: 'Cyan' },
  { value: 'gold', label: 'Emas' },
  { value: 'blue', label: 'Biru' },
  { value: 'emerald', label: 'Hijau Emerald' },
]

export default function AdvantagesEditor() {
  const { draft, setDraft, save, saved } = useSectionDraft('advantages')

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
        { id: `adv-${Date.now()}`, icon: 'sparkles', color: 'cyan', title: 'Keunggulan Baru', description: 'Deskripsi keunggulan.' },
      ],
    })

  return (
    <div>
      <h2 className="text-lg font-semibold text-white">Keunggulan (Kenapa Bermitra)</h2>
      <p className="mt-1 text-sm text-slate-400">Kelola 4 kartu nilai unggulan yang tampil sebelum section Tentang.</p>

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
      </div>

      <h3 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-gold-soft">Kartu Keunggulan</h3>
      <div className="space-y-4">
        {draft.items.map((item, idx) => (
          <ArrayCard key={item.id} title={`Keunggulan ${idx + 1}`} onRemove={() => removeItem(idx)}>
            <Field label="Judul">
              <TextInput value={item.title} onChange={(v) => updateItem(idx, 'title', v)} />
            </Field>
            <Field label="Ikon">
              <SelectInput value={item.icon} onChange={(v) => updateItem(idx, 'icon', v)} options={ICON_OPTIONS} />
            </Field>
            <Field label="Warna">
              <SelectInput value={item.color} onChange={(v) => updateItem(idx, 'color', v)} options={COLOR_OPTIONS} />
            </Field>
            <Field label="Deskripsi" className="sm:col-span-2">
              <TextArea rows={2} value={item.description} onChange={(v) => updateItem(idx, 'description', v)} />
            </Field>
          </ArrayCard>
        ))}
        <AddButton onClick={addItem} label="Tambah Keunggulan" />
      </div>

      <SaveBar onSave={save} saved={saved} />
    </div>
  )
}
