import { Plus, Trash2 } from 'lucide-react'

export function Field({ label, children, className = '' }) {
  return (
    <div className={className}>
      <label className="label-field">{label}</label>
      {children}
    </div>
  )
}

export function TextInput({ value, onChange, placeholder }) {
  return (
    <input
      type="text"
      className="input-field"
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

export function NumberInput({ value, onChange, placeholder }) {
  return (
    <input
      type="number"
      className="input-field"
      value={value ?? 0}
      placeholder={placeholder}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  )
}

export function TextArea({ value, onChange, rows = 3, placeholder }) {
  return (
    <textarea
      className="input-field resize-y"
      rows={rows}
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

export function SelectInput({ value, onChange, options }) {
  return (
    <select className="input-field" value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}

export function ArrayCard({ children, onRemove, title }) {
  return (
    <div className="relative rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg p-1.5 text-red-400 transition-colors hover:bg-red-500/10"
            aria-label="Hapus item"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </div>
  )
}

export function AddButton({ onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gold/40 px-4 py-3 text-sm font-semibold text-gold-soft transition-colors hover:bg-gold/10"
    >
      <Plus size={16} /> {label}
    </button>
  )
}

export function SaveBar({ onSave, saved }) {
  return (
    <div className="sticky bottom-0 mt-8 flex items-center justify-end gap-3 border-t border-white/10 bg-navy-950/90 py-4 backdrop-blur-xl">
      {saved && <span className="text-xs font-medium text-emerald-400">Tersimpan ✓</span>}
      <button type="button" onClick={onSave} className="btn-primary !py-2.5">
        Simpan Perubahan
      </button>
    </div>
  )
}
