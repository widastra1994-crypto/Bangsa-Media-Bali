import { useSectionDraft } from '../useSectionDraft'
import { AddButton, ArrayCard, Field, NumberInput, SaveBar, TextArea, TextInput } from '../FormFields'

export default function TestimonialsEditor() {
  const { draft, setDraft, save, saved } = useSectionDraft('testimonials')

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
        { id: `testi-${Date.now()}`, name: 'Nama Klien', role: 'Jabatan', company: 'Nama Bisnis', avatar: '', rating: 5, text: 'Tuliskan testimoni klien di sini.' },
      ],
    })

  return (
    <div>
      <h2 className="text-lg font-semibold text-white">Testimoni Klien</h2>
      <p className="mt-1 text-sm text-slate-400">Kelola testimoni yang tampil di halaman utama.</p>

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

      <h3 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-gold-soft">Daftar Testimoni</h3>
      <div className="space-y-4">
        {draft.items.map((item, idx) => (
          <ArrayCard key={item.id} title={`Testimoni ${idx + 1}`} onRemove={() => removeItem(idx)}>
            <Field label="Nama Klien">
              <TextInput value={item.name} onChange={(v) => updateItem(idx, 'name', v)} />
            </Field>
            <Field label="Jabatan">
              <TextInput value={item.role} onChange={(v) => updateItem(idx, 'role', v)} />
            </Field>
            <Field label="Nama Bisnis/Perusahaan">
              <TextInput value={item.company} onChange={(v) => updateItem(idx, 'company', v)} />
            </Field>
            <Field label="Rating (1-5)">
              <NumberInput value={item.rating} onChange={(v) => updateItem(idx, 'rating', Math.min(5, Math.max(1, v)))} />
            </Field>
            <Field label="URL Foto Asli Klien (opsional)" className="sm:col-span-2">
              <TextInput value={item.avatar} onChange={(v) => updateItem(idx, 'avatar', v)} placeholder="Kosongkan untuk pakai avatar inisial otomatis" />
            </Field>
            <Field label="Isi Testimoni" className="sm:col-span-2">
              <TextArea rows={3} value={item.text} onChange={(v) => updateItem(idx, 'text', v)} />
            </Field>
          </ArrayCard>
        ))}
        <AddButton onClick={addItem} label="Tambah Testimoni" />
      </div>

      <SaveBar onSave={save} saved={saved} />
    </div>
  )
}
