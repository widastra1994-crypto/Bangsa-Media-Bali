import { useRef, useState } from 'react'
import { ImageOff, Loader2, Plus, Trash2, Upload } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

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

// Upload langsung ke Supabase Storage (bucket "site-images") -- pengguna
// pilih file dari komputer, bukan tempel URL manual. Bucket publik supaya
// gambar bisa tampil di website tanpa perlu auth, tapi upload dibatasi
// owner/admin lewat RLS storage.objects.
export function ImageUploadField({ value, onChange, pathPrefix = 'uploads', previewClassName = 'h-28 w-28' }) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    setUploading(true)
    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg'
    const path = `${pathPrefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error: uploadErr } = await supabase.storage.from('site-images').upload(path, file, { cacheControl: '3600', upsert: false })
    if (uploadErr) {
      setError(uploadErr.message)
      setUploading(false)
      return
    }
    const { data } = supabase.storage.from('site-images').getPublicUrl(path)
    onChange(data.publicUrl)
    setUploading(false)
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif" className="hidden" onChange={handleFile} />
      <div className="flex flex-wrap items-center gap-4">
        {value ? (
          <img
            src={value}
            alt="Preview"
            className={`${previewClassName} rounded-2xl border border-white/10 bg-navy-900/60 object-contain`}
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
        ) : (
          <div className={`flex ${previewClassName} items-center justify-center rounded-2xl border border-dashed border-white/15 text-slate-600`}>
            <ImageOff size={20} />
          </div>
        )}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="btn-secondary flex items-center gap-1.5 !px-3 !py-2 text-xs disabled:opacity-60"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? 'Mengunggah...' : 'Upload dari Komputer'}
          </button>
          {value && (
            <button type="button" onClick={() => onChange('')} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-400">
              <Trash2 size={12} /> Hapus Gambar
            </button>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-400">Gagal unggah: {error}</p>}
      <p className="mt-2 text-[11px] text-slate-500">Format: PNG, JPG, WEBP, SVG, atau GIF. Maks 5MB.</p>
    </div>
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
