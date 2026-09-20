import { useSectionDraft } from '../useSectionDraft'
import { AddButton, ArrayCard, Field, NumberInput, SaveBar, TextArea, TextInput } from '../FormFields'

export default function CalculatorEditor() {
  const { draft, setDraft, save, saved } = useSectionDraft('calculator')

  const updateService = (idx, field, value) => {
    const services = [...draft.services]
    services[idx] = { ...services[idx], [field]: value }
    setDraft({ ...draft, services })
  }
  const removeService = (idx) => setDraft({ ...draft, services: draft.services.filter((_, i) => i !== idx) })
  const addService = () =>
    setDraft({
      ...draft,
      services: [...draft.services, { id: `svc-${Date.now()}`, label: 'Layanan Baru', basePrice: 1000000 }],
    })

  const updateScale = (idx, field, value) => {
    const scales = [...draft.scales]
    scales[idx] = { ...scales[idx], [field]: value }
    setDraft({ ...draft, scales })
  }
  const removeScale = (idx) => setDraft({ ...draft, scales: draft.scales.filter((_, i) => i !== idx) })
  const addScale = () =>
    setDraft({
      ...draft,
      scales: [...draft.scales, { id: `scale-${Date.now()}`, label: 'Skala Baru', description: '', multiplier: 1 }],
    })

  const updateContactField = (key, value) => setDraft({ ...draft, contactFields: { ...draft.contactFields, [key]: value } })

  return (
    <div>
      <h2 className="text-lg font-semibold text-white">Kalkulator Estimasi Biaya</h2>
      <p className="mt-1 text-sm text-slate-400">
        Atur teks section, daftar layanan beserta harga dasar, skala proyek, dan nomor WhatsApp tujuan.
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
        <Field label="Nomor WhatsApp Tujuan (format 62xxxxxxxxxx)">
          <TextInput value={draft.whatsappNumber} onChange={(v) => setDraft({ ...draft, whatsappNumber: v })} />
        </Field>
        <Field label="Badge Estimasi Waktu (contoh: Pengerjaan 14 - 30 Hari)">
          <TextInput value={draft.turnaround} onChange={(v) => setDraft({ ...draft, turnaround: v })} />
        </Field>
        <Field label="Poin Keuntungan / Perks (satu baris = satu poin)">
          <TextArea rows={3} value={(draft.perks || []).join('\n')} onChange={(v) => setDraft({ ...draft, perks: v.split('\n') })} />
        </Field>
      </div>

      <h3 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-gold-soft">Label & Teks Antarmuka</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Label Langkah 1">
          <TextInput value={draft.step1Label} onChange={(v) => setDraft({ ...draft, step1Label: v })} />
        </Field>
        <Field label="Label Langkah 2">
          <TextInput value={draft.step2Label} onChange={(v) => setDraft({ ...draft, step2Label: v })} />
        </Field>
        <Field label="Judul Kartu Ringkasan">
          <TextInput value={draft.summaryLabel} onChange={(v) => setDraft({ ...draft, summaryLabel: v })} />
        </Field>
        <Field label="Label Nilai Investasi">
          <TextInput value={draft.investmentLabel} onChange={(v) => setDraft({ ...draft, investmentLabel: v })} />
        </Field>
        <Field label="Teks saat Belum Pilih Layanan">
          <TextInput value={draft.emptyStateLabel} onChange={(v) => setDraft({ ...draft, emptyStateLabel: v })} />
        </Field>
        <Field label="Label Tombol WhatsApp">
          <TextInput value={draft.waButtonLabel} onChange={(v) => setDraft({ ...draft, waButtonLabel: v })} />
        </Field>
        <Field label="Teks Badge Kepercayaan (NDA)">
          <TextInput value={draft.trustBadge} onChange={(v) => setDraft({ ...draft, trustBadge: v })} />
        </Field>
        <Field label="Teks Disclaimer" className="sm:col-span-2">
          <TextArea rows={2} value={draft.disclaimer} onChange={(v) => setDraft({ ...draft, disclaimer: v })} />
        </Field>
      </div>

      <h3 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-gold-soft">Pilihan Layanan & Harga Dasar</h3>
      <div className="space-y-4">
        {draft.services.map((s, idx) => (
          <ArrayCard key={s.id} title={`Layanan ${idx + 1}`} onRemove={() => removeService(idx)}>
            <Field label="Nama Layanan">
              <TextInput value={s.label} onChange={(v) => updateService(idx, 'label', v)} />
            </Field>
            <Field label="Harga Dasar (Rp)">
              <NumberInput value={s.basePrice} onChange={(v) => updateService(idx, 'basePrice', v)} />
            </Field>
          </ArrayCard>
        ))}
        <AddButton onClick={addService} label="Tambah Layanan" />
      </div>

      <h3 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-gold-soft">Skala Proyek & Pengali</h3>
      <div className="space-y-4">
        {draft.scales.map((s, idx) => (
          <ArrayCard key={s.id} title={`Skala ${idx + 1}`} onRemove={() => removeScale(idx)}>
            <Field label="Nama Skala">
              <TextInput value={s.label} onChange={(v) => updateScale(idx, 'label', v)} />
            </Field>
            <Field label="Pengali (contoh 1.8)">
              <NumberInput value={s.multiplier} onChange={(v) => updateScale(idx, 'multiplier', v)} />
            </Field>
            <Field label="Deskripsi Singkat" className="sm:col-span-2">
              <TextInput value={s.description} onChange={(v) => updateScale(idx, 'description', v)} />
            </Field>
          </ArrayCard>
        ))}
        <AddButton onClick={addScale} label="Tambah Skala" />
      </div>

      <h3 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-gold-soft">
        Form Data Diri & Jadwal Konsultasi (Langkah 3)
      </h3>
      <div className="grid grid-cols-1 gap-4">
        <Field label="Label Langkah 3">
          <TextInput value={draft.step3Label} onChange={(v) => setDraft({ ...draft, step3Label: v })} />
        </Field>
        <Field label="Catatan Wajib Isi">
          <TextInput value={draft.step3RequiredNote} onChange={(v) => setDraft({ ...draft, step3RequiredNote: v })} />
        </Field>
      </div>

      <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Label Setiap Kolom Form</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Label Nama Lengkap">
          <TextInput value={draft.contactFields?.name} onChange={(v) => updateContactField('name', v)} />
        </Field>
        <Field label="Label Nomor Telepon">
          <TextInput value={draft.contactFields?.phone} onChange={(v) => updateContactField('phone', v)} />
        </Field>
        <Field label="Label Email">
          <TextInput value={draft.contactFields?.email} onChange={(v) => updateContactField('email', v)} />
        </Field>
        <Field label="Label Nama Bisnis">
          <TextInput value={draft.contactFields?.businessName} onChange={(v) => updateContactField('businessName', v)} />
        </Field>
        <Field label="Label Jenis Usaha">
          <TextInput value={draft.contactFields?.businessType} onChange={(v) => updateContactField('businessType', v)} />
        </Field>
        <Field label="Label Alamat">
          <TextInput value={draft.contactFields?.address} onChange={(v) => updateContactField('address', v)} />
        </Field>
        <Field label="Label Tanggal Konsultasi">
          <TextInput value={draft.contactFields?.consultDate} onChange={(v) => updateContactField('consultDate', v)} />
        </Field>
        <Field label="Label Waktu Konsultasi">
          <TextInput value={draft.contactFields?.consultTime} onChange={(v) => updateContactField('consultTime', v)} />
        </Field>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Pilihan Jenis Usaha (satu baris = satu pilihan)">
          <TextArea
            rows={4}
            value={(draft.businessTypes || []).join('\n')}
            onChange={(v) => setDraft({ ...draft, businessTypes: v.split('\n') })}
          />
        </Field>
        <Field label="Pilihan Jam Konsultasi (satu baris = satu slot)">
          <TextArea
            rows={4}
            value={(draft.timeSlots || []).join('\n')}
            onChange={(v) => setDraft({ ...draft, timeSlots: v.split('\n') })}
          />
        </Field>
      </div>

      <SaveBar onSave={save} saved={saved} />
    </div>
  )
}
