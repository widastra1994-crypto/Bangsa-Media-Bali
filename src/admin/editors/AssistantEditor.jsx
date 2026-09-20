import { useSectionDraft } from '../useSectionDraft'
import { AddButton, ArrayCard, Field, SaveBar, TextArea, TextInput } from '../FormFields'

export default function AssistantEditor() {
  const { draft, setDraft, save, saved } = useSectionDraft('assistant')

  const updateQuestion = (idx, field, value) => {
    const quickQuestions = [...draft.quickQuestions]
    quickQuestions[idx] = { ...quickQuestions[idx], [field]: value }
    setDraft({ ...draft, quickQuestions })
  }
  const removeQuestion = (idx) => setDraft({ ...draft, quickQuestions: draft.quickQuestions.filter((_, i) => i !== idx) })
  const addQuestion = () =>
    setDraft({
      ...draft,
      quickQuestions: [...draft.quickQuestions, { id: `q-${Date.now()}`, label: 'Pertanyaan Baru', text: 'Pertanyaan baru...', isWhatsapp: false }],
    })

  const updateReply = (idx, field, value) => {
    const keywordReplies = [...draft.keywordReplies]
    keywordReplies[idx] = { ...keywordReplies[idx], [field]: value }
    setDraft({ ...draft, keywordReplies })
  }
  const removeReply = (idx) => setDraft({ ...draft, keywordReplies: draft.keywordReplies.filter((_, i) => i !== idx) })
  const addReply = () =>
    setDraft({
      ...draft,
      keywordReplies: [...draft.keywordReplies, { id: `kw-${Date.now()}`, keywords: [], reply: 'Balasan baru...' }],
    })

  return (
    <div>
      <h2 className="text-lg font-semibold text-white">Asisten Chat Mengambang</h2>
      <p className="mt-1 text-sm text-slate-400">
        Atur nama, sapaan pembuka, tombol pertanyaan cepat, dan skrip balasan otomatis chatbot.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nama Asisten">
          <TextInput value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} />
        </Field>
        <Field label="Subjudul">
          <TextInput value={draft.subtitle} onChange={(v) => setDraft({ ...draft, subtitle: v })} />
        </Field>
        <Field label="Pesan Sapaan Pembuka" className="sm:col-span-2">
          <TextArea rows={2} value={draft.greeting} onChange={(v) => setDraft({ ...draft, greeting: v })} />
        </Field>
        <Field label="Placeholder Kolom Input">
          <TextInput value={draft.inputPlaceholder} onChange={(v) => setDraft({ ...draft, inputPlaceholder: v })} />
        </Field>
        <Field label="Balasan Default (jika tidak ada kata kunci cocok)">
          <TextInput value={draft.defaultReply} onChange={(v) => setDraft({ ...draft, defaultReply: v })} />
        </Field>
      </div>

      <h3 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-gold-soft">Tombol Pertanyaan Cepat</h3>
      <div className="space-y-4">
        {draft.quickQuestions.map((q, idx) => (
          <ArrayCard key={q.id} title={`Pertanyaan ${idx + 1}`} onRemove={() => removeQuestion(idx)}>
            <Field label="Label Tombol">
              <TextInput value={q.label} onChange={(v) => updateQuestion(idx, 'label', v)} />
            </Field>
            <Field label="Isi Pertanyaan / Pesan">
              <TextInput value={q.text} onChange={(v) => updateQuestion(idx, 'text', v)} />
            </Field>
            <label className="flex items-center gap-2 text-xs text-slate-300 sm:col-span-2">
              <input
                type="checkbox"
                checked={!!q.isWhatsapp}
                onChange={(e) => updateQuestion(idx, 'isWhatsapp', e.target.checked)}
                className="h-4 w-4 accent-gold"
              />
              Langsung buka WhatsApp (bukan dijawab bot)
            </label>
          </ArrayCard>
        ))}
        <AddButton onClick={addQuestion} label="Tambah Pertanyaan Cepat" />
      </div>

      <h3 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-gold-soft">Balasan Otomatis Berbasis Kata Kunci</h3>
      <div className="space-y-4">
        {draft.keywordReplies.map((k, idx) => (
          <ArrayCard key={k.id} title={`Aturan ${idx + 1}`} onRemove={() => removeReply(idx)}>
            <Field label="Kata Kunci (pisahkan dengan koma)" className="sm:col-span-2">
              <TextInput
                value={(k.keywords || []).join(', ')}
                onChange={(v) => updateReply(idx, 'keywords', v.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))}
              />
            </Field>
            <Field label="Balasan Bot" className="sm:col-span-2">
              <TextArea rows={2} value={k.reply} onChange={(v) => updateReply(idx, 'reply', v)} />
            </Field>
          </ArrayCard>
        ))}
        <AddButton onClick={addReply} label="Tambah Aturan Balasan" />
      </div>

      <SaveBar onSave={save} saved={saved} />
    </div>
  )
}
