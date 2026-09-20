import { useSectionDraft } from '../useSectionDraft'
import { AddButton, ArrayCard, Field, SaveBar, TextArea, TextInput } from '../FormFields'

export default function AboutEditor() {
  const { draft, setDraft, save, saved } = useSectionDraft('about')

  const updateParagraph = (idx, value) => {
    const paragraphs = [...draft.paragraphs]
    paragraphs[idx] = value
    setDraft({ ...draft, paragraphs })
  }
  const removeParagraph = (idx) => setDraft({ ...draft, paragraphs: draft.paragraphs.filter((_, i) => i !== idx) })
  const addParagraph = () => setDraft({ ...draft, paragraphs: [...draft.paragraphs, 'Paragraf baru...'] })

  const updateStat = (idx, field, value) => {
    const stats = [...draft.stats]
    stats[idx] = { ...stats[idx], [field]: value }
    setDraft({ ...draft, stats })
  }
  const removeStat = (idx) => setDraft({ ...draft, stats: draft.stats.filter((_, i) => i !== idx) })
  const addStat = () => setDraft({ ...draft, stats: [...draft.stats, { label: 'Statistik Baru', value: '0' }] })

  return (
    <div>
      <h2 className="text-lg font-semibold text-white">Tentang Kami</h2>
      <p className="mt-1 text-sm text-slate-400">Deskripsi perusahaan dan statistik pencapaian.</p>

      <div className="mt-6 grid grid-cols-1 gap-4">
        <Field label="Eyebrow">
          <TextInput value={draft.eyebrow} onChange={(v) => setDraft({ ...draft, eyebrow: v })} />
        </Field>
        <Field label="Judul Section">
          <TextInput value={draft.title} onChange={(v) => setDraft({ ...draft, title: v })} />
        </Field>
      </div>

      <h3 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-gold-soft">Paragraf</h3>
      <div className="space-y-3">
        {draft.paragraphs.map((p, idx) => (
          <div key={idx} className="flex items-start gap-2">
            <TextArea rows={2} value={p} onChange={(v) => updateParagraph(idx, v)} />
            <button
              type="button"
              onClick={() => removeParagraph(idx)}
              className="mt-1 shrink-0 rounded-lg p-2 text-red-400 hover:bg-red-500/10"
            >
              ×
            </button>
          </div>
        ))}
        <AddButton onClick={addParagraph} label="Tambah Paragraf" />
      </div>

      <h3 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-gold-soft">Statistik</h3>
      <div className="space-y-4">
        {draft.stats.map((s, idx) => (
          <ArrayCard key={idx} title={`Statistik ${idx + 1}`} onRemove={() => removeStat(idx)}>
            <Field label="Nilai">
              <TextInput value={s.value} onChange={(v) => updateStat(idx, 'value', v)} />
            </Field>
            <Field label="Label">
              <TextInput value={s.label} onChange={(v) => updateStat(idx, 'label', v)} />
            </Field>
          </ArrayCard>
        ))}
        <AddButton onClick={addStat} label="Tambah Statistik" />
      </div>

      <SaveBar onSave={save} saved={saved} />
    </div>
  )
}
