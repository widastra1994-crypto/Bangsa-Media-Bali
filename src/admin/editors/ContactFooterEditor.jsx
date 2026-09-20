import { useContent } from '../../context/ContentContext'
import { useSectionDraft } from '../useSectionDraft'
import { AddButton, ArrayCard, Field, SaveBar, TextArea, TextInput } from '../FormFields'

export default function ContactFooterEditor() {
  const { updateSection } = useContent()
  const contact = useSectionDraft('contact')
  const footer = useSectionDraft('footer')

  const saveBoth = () => {
    updateSection('contact', contact.draft)
    updateSection('footer', footer.draft)
    contact.save()
  }

  const updateLabel = (key, value) => {
    contact.setDraft({ ...contact.draft, labels: { ...contact.draft.labels, [key]: value } })
  }

  const updateSocial = (idx, field, value) => {
    const socials = [...footer.draft.socials]
    socials[idx] = { ...socials[idx], [field]: value }
    footer.setDraft({ ...footer.draft, socials })
  }
  const removeSocial = (idx) => footer.setDraft({ ...footer.draft, socials: footer.draft.socials.filter((_, i) => i !== idx) })
  const addSocial = () =>
    footer.setDraft({ ...footer.draft, socials: [...footer.draft.socials, { label: 'Sosial Baru', href: 'https://' }] })

  return (
    <div>
      <h2 className="text-lg font-semibold text-white">Kontak & Footer</h2>
      <p className="mt-1 text-sm text-slate-400">
        Alamat ini juga dipakai untuk pencarian lokasi Google Maps di section Kontak.
      </p>

      <h3 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-gold-soft">Informasi Kontak</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Eyebrow">
          <TextInput value={contact.draft.eyebrow} onChange={(v) => contact.setDraft({ ...contact.draft, eyebrow: v })} />
        </Field>
        <Field label="Judul Section">
          <TextInput value={contact.draft.title} onChange={(v) => contact.setDraft({ ...contact.draft, title: v })} />
        </Field>
        <Field label="Deskripsi" className="sm:col-span-2">
          <TextArea rows={2} value={contact.draft.description} onChange={(v) => contact.setDraft({ ...contact.draft, description: v })} />
        </Field>
        <Field label="Alamat Lengkap" className="sm:col-span-2">
          <TextArea rows={2} value={contact.draft.address} onChange={(v) => contact.setDraft({ ...contact.draft, address: v })} />
        </Field>
        <Field label="Kata Kunci Pencarian Google Maps">
          <TextInput value={contact.draft.mapsQuery} onChange={(v) => contact.setDraft({ ...contact.draft, mapsQuery: v })} />
        </Field>
        <Field label="Telepon">
          <TextInput value={contact.draft.phone} onChange={(v) => contact.setDraft({ ...contact.draft, phone: v })} />
        </Field>
        <Field label="Email">
          <TextInput value={contact.draft.email} onChange={(v) => contact.setDraft({ ...contact.draft, email: v })} />
        </Field>
        <Field label="Jam Operasional">
          <TextInput value={contact.draft.hours} onChange={(v) => contact.setDraft({ ...contact.draft, hours: v })} />
        </Field>
      </div>

      <h3 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-gold-soft">Label Kartu Kontak</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Label 'Alamat'">
          <TextInput value={contact.draft.labels.address} onChange={(v) => updateLabel('address', v)} />
        </Field>
        <Field label="Label 'Telepon'">
          <TextInput value={contact.draft.labels.phone} onChange={(v) => updateLabel('phone', v)} />
        </Field>
        <Field label="Label 'Email'">
          <TextInput value={contact.draft.labels.email} onChange={(v) => updateLabel('email', v)} />
        </Field>
        <Field label="Label 'Jam Operasional'">
          <TextInput value={contact.draft.labels.hours} onChange={(v) => updateLabel('hours', v)} />
        </Field>
        <Field label="Teks Tautan Google Maps">
          <TextInput value={contact.draft.labels.mapsLink} onChange={(v) => updateLabel('mapsLink', v)} />
        </Field>
      </div>

      <h3 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-gold-soft">Footer</h3>
      <div className="grid grid-cols-1 gap-4">
        <Field label="Tagline Footer">
          <TextInput value={footer.draft.tagline} onChange={(v) => footer.setDraft({ ...footer.draft, tagline: v })} />
        </Field>
        <Field label="Teks Hak Cipta">
          <TextInput value={footer.draft.copyText} onChange={(v) => footer.setDraft({ ...footer.draft, copyText: v })} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Judul Kolom Layanan">
            <TextInput value={footer.draft.servicesHeading} onChange={(v) => footer.setDraft({ ...footer.draft, servicesHeading: v })} />
          </Field>
          <Field label="Judul Kolom Filosofi">
            <TextInput value={footer.draft.philosophyHeading} onChange={(v) => footer.setDraft({ ...footer.draft, philosophyHeading: v })} />
          </Field>
        </div>
        <Field label="Teks Filosofi">
          <TextArea rows={2} value={footer.draft.philosophyText} onChange={(v) => footer.setDraft({ ...footer.draft, philosophyText: v })} />
        </Field>
      </div>

      <h3 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-gold-soft">Tautan Sosial Media</h3>
      <div className="space-y-4">
        {footer.draft.socials.map((s, idx) => (
          <ArrayCard key={idx} title={`Sosial ${idx + 1}`} onRemove={() => removeSocial(idx)}>
            <Field label="Nama Platform">
              <TextInput value={s.label} onChange={(v) => updateSocial(idx, 'label', v)} />
            </Field>
            <Field label="URL">
              <TextInput value={s.href} onChange={(v) => updateSocial(idx, 'href', v)} />
            </Field>
          </ArrayCard>
        ))}
        <AddButton onClick={addSocial} label="Tambah Sosial Media" />
      </div>

      <SaveBar onSave={saveBoth} saved={contact.saved} />
    </div>
  )
}
