import { useContent } from '../../context/ContentContext'
import { useSectionDraft } from '../useSectionDraft'
import { AddButton, ArrayCard, Field, SaveBar, TextInput } from '../FormFields'

export default function BrandNavEditor() {
  const { updateSection } = useContent()
  const brand = useSectionDraft('brand')
  const nav = useSectionDraft('nav')

  const saveBoth = () => {
    updateSection('brand', brand.draft)
    updateSection('nav', nav.draft)
    brand.save()
  }

  const updateMenuItem = (idx, field, value) => {
    const items = [...nav.draft.menu]
    items[idx] = { ...items[idx], [field]: value }
    nav.setDraft({ ...nav.draft, menu: items })
  }

  const removeMenuItem = (idx) => {
    nav.setDraft({ ...nav.draft, menu: nav.draft.menu.filter((_, i) => i !== idx) })
  }

  const addMenuItem = () => {
    nav.setDraft({
      ...nav.draft,
      menu: [...nav.draft.menu, { id: `menu-${Date.now()}`, label: 'Menu Baru', href: '#', primary: false }],
    })
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-white">Brand & Navigasi</h2>
      <p className="mt-1 text-sm text-slate-400">
        Kelola nama brand dan menu navbar. Menu yang dicentang "Tampil di Navbar Utama" akan tampil di menu atas; sisanya otomatis tampil di footer.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nama Brand">
          <TextInput value={brand.draft.name} onChange={(v) => brand.setDraft({ ...brand.draft, name: v })} />
        </Field>
        <Field label="Sub Brand">
          <TextInput value={brand.draft.subBrand} onChange={(v) => brand.setDraft({ ...brand.draft, subBrand: v })} />
        </Field>
        <Field label="Label Tombol CTA Navbar">
          <TextInput value={nav.draft.ctaLabel} onChange={(v) => nav.setDraft({ ...nav.draft, ctaLabel: v })} />
        </Field>
      </div>

      <h3 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-gold-soft">Menu Navigasi</h3>
      <div className="space-y-4">
        {nav.draft.menu.map((item, idx) => (
          <ArrayCard key={item.id} title={`Menu ${idx + 1}`} onRemove={() => removeMenuItem(idx)}>
            <Field label="Label">
              <TextInput value={item.label} onChange={(v) => updateMenuItem(idx, 'label', v)} />
            </Field>
            <Field label="Tautan (href)">
              <TextInput value={item.href} onChange={(v) => updateMenuItem(idx, 'href', v)} />
            </Field>
            <label className="flex items-center gap-2 text-xs text-slate-300 sm:col-span-2">
              <input
                type="checkbox"
                checked={Boolean(item.primary)}
                onChange={(e) => updateMenuItem(idx, 'primary', e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-white/5 accent-gold"
              />
              Tampil di Navbar Utama (jika tidak dicentang, hanya tampil di footer)
            </label>
          </ArrayCard>
        ))}
        <AddButton onClick={addMenuItem} label="Tambah Menu" />
      </div>

      <SaveBar onSave={saveBoth} saved={brand.saved} />
    </div>
  )
}
