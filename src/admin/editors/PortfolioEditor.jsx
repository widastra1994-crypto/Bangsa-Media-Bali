import { ImageOff } from 'lucide-react'
import { useSectionDraft } from '../useSectionDraft'
import { AddButton, ArrayCard, Field, SaveBar, SelectInput, TextArea, TextInput } from '../FormFields'

const ACCENT_OPTIONS = [
  { value: 'blue', label: 'Biru' },
  { value: 'gold', label: 'Emas' },
  { value: 'cyan', label: 'Cyan' },
]

export default function PortfolioEditor() {
  const { draft, setDraft, save, saved } = useSectionDraft('portfolio')

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
          id: Date.now(),
          slug: `proyek-${Date.now()}`,
          title: 'Proyek Baru',
          category: draft.categories[1] || 'Website',
          location: '',
          client: '',
          year: new Date().getFullYear().toString(),
          description: 'Deskripsi singkat proyek.',
          challenge: '',
          solution: '',
          tags: [],
          accent: 'blue',
          image: '',
          gallery: [],
          results: [],
          websiteUrl: '',
        },
      ],
    })

  // Ganti nama kategori otomatis diikuti semua kartu proyek yang memakainya,
  // supaya filter tidak pernah kehilangan proyek gara-gara nama kategori berubah.
  const updateCategory = (idx, value) => {
    const oldValue = draft.categories[idx]
    const categories = [...draft.categories]
    categories[idx] = value
    const items = draft.items.map((item) => (item.category === oldValue ? { ...item, category: value } : item))
    setDraft({ ...draft, categories, items })
  }

  const removeCategory = (idx) => {
    const removed = draft.categories[idx]
    const categories = draft.categories.filter((_, i) => i !== idx)
    const fallback = categories.find((c) => c !== 'Semua') || 'Semua'
    const affected = draft.items.filter((item) => item.category === removed).length
    if (affected > 0) {
      const ok = window.confirm(
        `${affected} proyek memakai kategori "${removed}". Proyek tersebut akan dipindah ke kategori "${fallback}". Lanjutkan hapus kategori ini?`,
      )
      if (!ok) return
    }
    const items = draft.items.map((item) => (item.category === removed ? { ...item, category: fallback } : item))
    setDraft({ ...draft, categories, items })
  }

  const addCategory = () => setDraft({ ...draft, categories: [...draft.categories, 'Kategori Baru'] })

  const categoryOptions = draft.categories.filter((c) => c !== 'Semua').map((c) => ({ value: c, label: c }))

  return (
    <div>
      <h2 className="text-lg font-semibold text-white">Portofolio & Studi Kasus</h2>
      <p className="mt-1 text-sm text-slate-400">Kelola kategori filter dan daftar kartu proyek.</p>

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

      <h3 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-gold-soft">Kategori Filter</h3>
      <div className="flex flex-wrap gap-3">
        {draft.categories.map((cat, idx) => (
          <div key={idx} className="flex items-center gap-1 rounded-full border border-white/15 bg-white/5 pl-3 pr-1">
            {cat === 'Semua' ? (
              <span className="py-1.5 text-xs text-slate-400">Semua (tetap)</span>
            ) : (
              <>
                <input
                  className="w-28 bg-transparent py-1.5 text-xs text-slate-200 focus:outline-none"
                  value={cat}
                  onChange={(e) => updateCategory(idx, e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => removeCategory(idx)}
                  className="rounded-full px-2 text-red-400 hover:bg-red-500/10"
                >
                  ×
                </button>
              </>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={addCategory}
          className="rounded-full border border-dashed border-gold/40 px-3 py-1.5 text-xs font-semibold text-gold-soft hover:bg-gold/10"
        >
          + Kategori
        </button>
      </div>

      <h3 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-gold-soft">Kartu Proyek</h3>
      <div className="space-y-4">
        {draft.items.map((item, idx) => (
          <ArrayCard key={item.id} title={`Proyek ${idx + 1}`} onRemove={() => removeItem(idx)}>
            <Field label="Judul Proyek">
              <TextInput value={item.title} onChange={(v) => updateItem(idx, 'title', v)} />
            </Field>
            <Field label="Kategori">
              <SelectInput value={item.category} onChange={(v) => updateItem(idx, 'category', v)} options={categoryOptions} />
            </Field>
            <Field label="Warna Aksen">
              <SelectInput value={item.accent} onChange={(v) => updateItem(idx, 'accent', v)} options={ACCENT_OPTIONS} />
            </Field>
            <Field label="Lokasi (contoh: Denpasar, Bali)">
              <TextInput value={item.location} onChange={(v) => updateItem(idx, 'location', v)} />
            </Field>
            <Field label="Slug URL Halaman Detail">
              <TextInput value={item.slug} onChange={(v) => updateItem(idx, 'slug', v)} placeholder="nama-proyek" />
            </Field>
            <Field label="Nama Klien (opsional)">
              <TextInput value={item.client} onChange={(v) => updateItem(idx, 'client', v)} />
            </Field>
            <Field label="Tahun Pengerjaan">
              <TextInput value={item.year} onChange={(v) => updateItem(idx, 'year', v)} placeholder="2026" />
            </Field>
            <Field label="Tag Teknologi (pisahkan dengan koma)">
              <TextInput
                value={(item.tags || []).join(', ')}
                onChange={(v) => updateItem(idx, 'tags', v.split(',').map((t) => t.trim()))}
              />
            </Field>
            <Field label="URL Foto Proyek (opsional)">
              <TextInput value={item.image} onChange={(v) => updateItem(idx, 'image', v)} placeholder="https://... (link gambar/screenshot)" />
            </Field>
            <Field label="Link Website Proyek (opsional)">
              <TextInput value={item.websiteUrl} onChange={(v) => updateItem(idx, 'websiteUrl', v)} placeholder="https://namaproyek.com" />
            </Field>
            {item.image ? (
              <div className="sm:col-span-2">
                <img
                  src={item.image}
                  alt=""
                  className="h-32 w-full rounded-lg border border-white/10 object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                    e.currentTarget.nextSibling.style.display = 'flex'
                  }}
                />
                <div className="hidden h-32 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-red-500/40 text-xs text-red-400">
                  <ImageOff size={16} /> URL gambar tidak bisa dimuat
                </div>
              </div>
            ) : null}
            <Field label="Deskripsi" className="sm:col-span-2">
              <TextArea rows={2} value={item.description} onChange={(v) => updateItem(idx, 'description', v)} />
            </Field>
            <Field label="Tantangan Klien (untuk halaman detail)" className="sm:col-span-2">
              <TextArea rows={2} value={item.challenge} onChange={(v) => updateItem(idx, 'challenge', v)} placeholder="Masalah yang dihadapi klien sebelum proyek ini." />
            </Field>
            <Field label="Solusi Kami (untuk halaman detail)" className="sm:col-span-2">
              <TextArea rows={2} value={item.solution} onChange={(v) => updateItem(idx, 'solution', v)} placeholder="Bagaimana kami menyelesaikannya." />
            </Field>
            <Field label="Galeri Foto Tambahan (1 URL per baris)" className="sm:col-span-2">
              <TextArea
                rows={3}
                value={(item.gallery || []).join('\n')}
                onChange={(v) => updateItem(idx, 'gallery', v.split('\n').map((s) => s.trim()).filter(Boolean))}
                placeholder={'https://...foto1.jpg\nhttps://...foto2.jpg'}
              />
            </Field>
            <Field label="Hasil / Pencapaian (format: Label = Nilai, 1 per baris)" className="sm:col-span-2">
              <TextArea
                rows={3}
                value={(item.results || []).map((r) => `${r.label} = ${r.value}`).join('\n')}
                onChange={(v) =>
                  updateItem(
                    idx,
                    'results',
                    v
                      .split('\n')
                      .map((line) => {
                        const [label, ...rest] = line.split('=')
                        return { label: (label || '').trim(), value: rest.join('=').trim() }
                      })
                      .filter((r) => r.label && r.value),
                  )
                }
                placeholder={'Kenaikan Penjualan = 140%\nWaktu Pengerjaan = 5 Minggu'}
              />
            </Field>
          </ArrayCard>
        ))}
        <AddButton onClick={addItem} label="Tambah Proyek" />
      </div>

      <SaveBar onSave={save} saved={saved} />
    </div>
  )
}
