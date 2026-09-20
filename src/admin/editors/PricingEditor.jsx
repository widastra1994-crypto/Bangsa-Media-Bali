import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useContent } from '../../context/ContentContext'
import { useSectionDraft } from '../useSectionDraft'
import { AddButton, ArrayCard, Field, NumberInput, SaveBar, SelectInput, TextArea, TextInput } from '../FormFields'

export default function PricingEditor() {
  const { content } = useContent()
  const { draft, setDraft, save, saved } = useSectionDraft('pricing')
  const [activeCat, setActiveCat] = useState(0)
  const calcServices = content.calculator.services
  const calcScales = content.calculator.scales

  const category = draft.categories[activeCat]

  const updateCategories = (categories) => setDraft({ ...draft, categories })

  const updateCategoryField = (field, value) => {
    const categories = [...draft.categories]
    categories[activeCat] = { ...categories[activeCat], [field]: value }
    updateCategories(categories)
  }

  const updateTier = (tierIdx, field, value) => {
    const tiers = [...category.tiers]
    tiers[tierIdx] = { ...tiers[tierIdx], [field]: value }
    updateCategoryField('tiers', tiers)
  }

  const updateGroupField = (groupIdx, field, value) => {
    const comparisonGroups = [...category.comparisonGroups]
    comparisonGroups[groupIdx] = { ...comparisonGroups[groupIdx], [field]: value }
    updateCategoryField('comparisonGroups', comparisonGroups)
  }

  const addGroup = () =>
    updateCategoryField('comparisonGroups', [
      ...category.comparisonGroups,
      { id: `grp-${Date.now()}`, title: 'Grup Baru', rows: [] },
    ])
  const removeGroup = (groupIdx) =>
    updateCategoryField('comparisonGroups', category.comparisonGroups.filter((_, i) => i !== groupIdx))

  const addRow = (groupIdx) => {
    const comparisonGroups = [...category.comparisonGroups]
    const rows = [...comparisonGroups[groupIdx].rows, { id: `row-${Date.now()}`, label: 'Fitur Baru', values: category.tiers.map(() => '–') }]
    comparisonGroups[groupIdx] = { ...comparisonGroups[groupIdx], rows }
    updateCategoryField('comparisonGroups', comparisonGroups)
  }
  const removeRow = (groupIdx, rowIdx) => {
    const comparisonGroups = [...category.comparisonGroups]
    comparisonGroups[groupIdx] = { ...comparisonGroups[groupIdx], rows: comparisonGroups[groupIdx].rows.filter((_, i) => i !== rowIdx) }
    updateCategoryField('comparisonGroups', comparisonGroups)
  }
  const updateRow = (groupIdx, rowIdx, field, value) => {
    const comparisonGroups = [...category.comparisonGroups]
    const rows = [...comparisonGroups[groupIdx].rows]
    rows[rowIdx] = { ...rows[rowIdx], [field]: value }
    comparisonGroups[groupIdx] = { ...comparisonGroups[groupIdx], rows }
    updateCategoryField('comparisonGroups', comparisonGroups)
  }
  const updateRowValue = (groupIdx, rowIdx, valueIdx, value) => {
    const comparisonGroups = [...category.comparisonGroups]
    const rows = [...comparisonGroups[groupIdx].rows]
    const values = [...rows[rowIdx].values]
    values[valueIdx] = value
    rows[rowIdx] = { ...rows[rowIdx], values }
    comparisonGroups[groupIdx] = { ...comparisonGroups[groupIdx], rows }
    updateCategoryField('comparisonGroups', comparisonGroups)
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-white">Paket Harga</h2>
      <p className="mt-1 text-sm text-slate-400">
        Kelola kartu paket dan tabel perbandingan fitur untuk setiap kategori. Tampil di homepage (#paket) dan halaman detail /paket/[kategori].
        Tombol "Pilih Paket" akan membuka popup Kalkulator Estimasi Biaya dengan modul & skala yang otomatis tersesuaikan sesuai pengaturan di bawah.
      </p>

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
        <Field label="Label Link 'Lihat Detail Lengkap'">
          <TextInput value={draft.detailCtaLabel} onChange={(v) => setDraft({ ...draft, detailCtaLabel: v })} />
        </Field>
        <Field label="Badge Kepercayaan (satu baris = satu poin)">
          <TextArea rows={2} value={(draft.trustBadges || []).join('\n')} onChange={(v) => setDraft({ ...draft, trustBadges: v.split('\n') })} />
        </Field>
      </div>

      <h3 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-gold-soft">Pilih Kategori Paket</h3>
      <div className="flex flex-wrap gap-2">
        {draft.categories.map((cat, idx) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveCat(idx)}
            className={`rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
              activeCat === idx ? 'border-gold bg-gold/15 text-gold-soft' : 'border-white/15 text-slate-400 hover:border-white/30'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {category && (
        <div className="mt-6 space-y-8">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nama Kategori (tampil di tab & judul)">
              <TextInput value={category.label} onChange={(v) => updateCategoryField('label', v)} />
            </Field>
            <Field label="URL Slug (contoh: website → /paket/website)">
              <TextInput value={category.slug} onChange={(v) => updateCategoryField('slug', v.toLowerCase().replace(/\s+/g, '-'))} />
            </Field>
            <Field label="Teks Intro (contoh: 'Semua paket sudah termasuk:')">
              <TextInput value={category.intro} onChange={(v) => updateCategoryField('intro', v)} />
            </Field>
            <Field label="Badge Termasuk (pisahkan dengan koma)">
              <TextInput
                value={(category.includedBadges || []).join(', ')}
                onChange={(v) => updateCategoryField('includedBadges', v.split(',').map((t) => t.trim()).filter(Boolean))}
              />
            </Field>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gold-soft">
              3 Kartu Paket — {category.label}
            </h3>
            <div className="space-y-4">
              {category.tiers.map((tier, tierIdx) => (
                <ArrayCard key={tier.id} title={tier.name || `Paket ${tierIdx + 1}`}>
                  <Field label="Nama Paket">
                    <TextInput value={tier.name} onChange={(v) => updateTier(tierIdx, 'name', v)} />
                  </Field>
                  <Field label="Badge (contoh: Paling Populer)">
                    <TextInput value={tier.badge} onChange={(v) => updateTier(tierIdx, 'badge', v)} />
                  </Field>
                  <Field label="Deskripsi Singkat" className="sm:col-span-2">
                    <TextInput value={tier.description} onChange={(v) => updateTier(tierIdx, 'description', v)} />
                  </Field>
                  <Field label="Harga Coret (Rp, opsional)">
                    <NumberInput value={tier.priceOriginal} onChange={(v) => updateTier(tierIdx, 'priceOriginal', v)} />
                  </Field>
                  <Field label="Harga Jual (Rp)">
                    <NumberInput value={tier.price} onChange={(v) => updateTier(tierIdx, 'price', v)} />
                  </Field>
                  <Field label="Satuan Harga (contoh: /proyek, /bulan)">
                    <TextInput value={tier.billingNote} onChange={(v) => updateTier(tierIdx, 'billingNote', v)} />
                  </Field>
                  <Field label="Label Tombol CTA">
                    <TextInput value={tier.ctaLabel} onChange={(v) => updateTier(tierIdx, 'ctaLabel', v)} />
                  </Field>
                  <label className="flex items-center gap-2 text-xs text-slate-300 sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={!!tier.highlight}
                      onChange={(e) => updateTier(tierIdx, 'highlight', e.target.checked)}
                      className="h-4 w-4 accent-gold"
                    />
                    Tandai sebagai paket unggulan (kartu ditonjolkan)
                  </label>

                  <Field label="Skala Kalkulator (dipilih otomatis di popup)">
                    <SelectInput
                      value={tier.calculatorScale}
                      onChange={(v) => updateTier(tierIdx, 'calculatorScale', v)}
                      options={calcScales.map((s) => ({ value: s.id, label: s.label }))}
                    />
                  </Field>
                  <Field label="Modul Kalkulator (dicentang otomatis di popup)">
                    <div className="flex flex-wrap gap-3 pt-1">
                      {calcServices.map((s) => (
                        <label key={s.id} className="flex items-center gap-1.5 text-xs text-slate-300">
                          <input
                            type="checkbox"
                            checked={(tier.calculatorModules || []).includes(s.id)}
                            onChange={(e) => {
                              const current = tier.calculatorModules || []
                              const next = e.target.checked ? [...current, s.id] : current.filter((id) => id !== s.id)
                              updateTier(tierIdx, 'calculatorModules', next)
                            }}
                            className="h-4 w-4 accent-gold"
                          />
                          {s.label}
                        </label>
                      ))}
                    </div>
                  </Field>

                  <Field label="Daftar Fitur (satu baris = satu poin)" className="sm:col-span-2">
                    <TextArea
                      rows={4}
                      value={(tier.features || []).join('\n')}
                      onChange={(v) => updateTier(tierIdx, 'features', v.split('\n'))}
                    />
                  </Field>
                </ArrayCard>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Jumlah paket tetap 3 per kategori agar selaras dengan kolom tabel perbandingan di bawah.
            </p>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gold-soft">
              Tabel Perbandingan Fitur — {category.label}
            </h3>
            <div className="space-y-5">
              {category.comparisonGroups.map((group, groupIdx) => (
                <div key={group.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <TextInput value={group.title} onChange={(v) => updateGroupField(groupIdx, 'title', v)} />
                    <button
                      type="button"
                      onClick={() => removeGroup(groupIdx)}
                      className="shrink-0 rounded-lg p-2 text-red-400 hover:bg-red-500/10"
                      aria-label="Hapus grup"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="space-y-2">
                    {group.rows.map((row, rowIdx) => (
                      <div key={row.id} className="grid grid-cols-1 gap-2 rounded-lg bg-navy-900/50 p-2.5 sm:grid-cols-[1.4fr_repeat(3,1fr)_auto]">
                        <TextInput value={row.label} onChange={(v) => updateRow(groupIdx, rowIdx, 'label', v)} />
                        {category.tiers.map((tier, valueIdx) => (
                          <input
                            key={tier.id}
                            type="text"
                            className="input-field text-center text-xs"
                            placeholder={tier.name}
                            value={row.values[valueIdx] ?? ''}
                            onChange={(e) => updateRowValue(groupIdx, rowIdx, valueIdx, e.target.value)}
                          />
                        ))}
                        <button
                          type="button"
                          onClick={() => removeRow(groupIdx, rowIdx)}
                          className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/10"
                          aria-label="Hapus baris"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => addRow(groupIdx)}
                    className="mt-3 text-xs font-semibold text-cyan-royal hover:text-cyan-300"
                  >
                    + Tambah Baris Fitur
                  </button>
                  <p className="mt-1 text-[10px] text-slate-500">
                    Isi dengan "✓" untuk centang, "–" untuk tidak tersedia, atau teks bebas (contoh: "10 Halaman").
                  </p>
                </div>
              ))}
              <AddButton onClick={addGroup} label="Tambah Grup Fitur" />
            </div>
          </div>
        </div>
      )}

      <SaveBar onSave={save} saved={saved} />
    </div>
  )
}
