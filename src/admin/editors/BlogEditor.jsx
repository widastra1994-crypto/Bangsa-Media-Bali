import { useSectionDraft } from '../useSectionDraft'
import { AddButton, ArrayCard, Field, SaveBar, TextArea, TextInput } from '../FormFields'

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

export default function BlogEditor() {
  const { draft, setDraft, save, saved } = useSectionDraft('blog')

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
        {
          id: `blog-${Date.now()}`,
          slug: `artikel-baru-${Date.now()}`,
          title: 'Judul Artikel Baru',
          excerpt: 'Ringkasan singkat artikel.',
          coverImage: '',
          author: 'Tim Bangsa Media Bali',
          date: new Date().toISOString().slice(0, 10),
          tags: [],
          content: 'Tulis isi artikel di sini. Pisahkan paragraf dengan baris baru.',
        },
      ],
    })

  return (
    <div>
      <h2 className="text-lg font-semibold text-white">Blog & Studi Kasus</h2>
      <p className="mt-1 text-sm text-slate-400">Kelola artikel yang tampil di halaman utama dan halaman /blog.</p>

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

      <h3 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-gold-soft">Daftar Artikel</h3>
      <div className="space-y-4">
        {draft.items.map((item, idx) => (
          <ArrayCard key={item.id} title={item.title || `Artikel ${idx + 1}`} onRemove={() => removeItem(idx)}>
            <Field label="Judul Artikel" className="sm:col-span-2">
              <TextInput
                value={item.title}
                onChange={(v) => {
                  const items = [...draft.items]
                  items[idx] = { ...items[idx], title: v, slug: items[idx].slug || slugify(v) }
                  setDraft({ ...draft, items })
                }}
              />
            </Field>
            <Field label="Slug URL (huruf kecil, pisahkan dengan strip)">
              <TextInput value={item.slug} onChange={(v) => updateItem(idx, 'slug', slugify(v))} placeholder="contoh-slug-artikel" />
            </Field>
            <Field label="Tanggal Publish">
              <TextInput value={item.date} onChange={(v) => updateItem(idx, 'date', v)} placeholder="YYYY-MM-DD" />
            </Field>
            <Field label="Penulis">
              <TextInput value={item.author} onChange={(v) => updateItem(idx, 'author', v)} />
            </Field>
            <Field label="Tag (pisahkan dengan koma)">
              <TextInput value={(item.tags || []).join(', ')} onChange={(v) => updateItem(idx, 'tags', v.split(',').map((t) => t.trim()).filter(Boolean))} />
            </Field>
            <Field label="URL Gambar Cover (opsional)" className="sm:col-span-2">
              <TextInput value={item.coverImage} onChange={(v) => updateItem(idx, 'coverImage', v)} placeholder="https://..." />
            </Field>
            <Field label="Ringkasan (Excerpt)" className="sm:col-span-2">
              <TextArea rows={2} value={item.excerpt} onChange={(v) => updateItem(idx, 'excerpt', v)} />
            </Field>
            <Field label="Isi Artikel (1 paragraf per baris)" className="sm:col-span-2">
              <TextArea rows={6} value={item.content} onChange={(v) => updateItem(idx, 'content', v)} />
            </Field>
          </ArrayCard>
        ))}
        <AddButton onClick={addItem} label="Tambah Artikel" />
      </div>

      <SaveBar onSave={save} saved={saved} />
    </div>
  )
}
