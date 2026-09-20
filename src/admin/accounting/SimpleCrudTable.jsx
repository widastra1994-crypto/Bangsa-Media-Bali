import { useState } from 'react'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'

function FieldInput({ field, value, onChange }) {
  if (field.type === 'select') {
    return (
      <select className="input-field" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">Pilih...</option>
        {field.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    )
  }
  if (field.type === 'checkbox') {
    return (
      <input
        type="checkbox"
        checked={Boolean(value)}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-white/20 bg-white/5 accent-gold"
      />
    )
  }
  if (field.type === 'number') {
    return (
      <input
        type="number"
        className="input-field"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      />
    )
  }
  if (field.type === 'textarea') {
    return (
      <textarea
        className="input-field resize-y"
        rows={2}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
      />
    )
  }
  return (
    <input
      type={field.type === 'date' ? 'date' : field.type === 'email' ? 'email' : 'text'}
      className="input-field"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
    />
  )
}

// Tabel CRUD generik dipakai untuk semua layar Master Data akunting (Klien,
// Vendor, Layanan, Kas & Bank, Staf) supaya tidak menduplikasi UI form+tabel
// di setiap entitas. `fields` mendeskripsikan form tambah/edit, `columns`
// mendeskripsikan tabel daftar.
export default function SimpleCrudTable({ title, description, fields, data, columns }) {
  const { rows, loading, error, insert, update, remove } = data
  const emptyForm = Object.fromEntries(fields.map((f) => [f.key, f.default ?? '']))
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState('')

  const submitAdd = async () => {
    setBusy(true)
    setLocalError('')
    try {
      await insert(form)
      setForm(emptyForm)
      setAdding(false)
    } catch (e) {
      setLocalError(e.message)
    }
    setBusy(false)
  }

  const startEdit = (row) => {
    setEditingId(row.id)
    setEditForm({ ...row })
  }

  const submitEdit = async () => {
    setBusy(true)
    setLocalError('')
    try {
      await update(editingId, editForm)
      setEditingId(null)
    } catch (e) {
      setLocalError(e.message)
    }
    setBusy(false)
  }

  const confirmDelete = async (id) => {
    if (!window.confirm('Hapus data ini? Tindakan ini tidak bisa dibatalkan.')) return
    try {
      await remove(id)
    } catch (e) {
      setLocalError(e.message)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white">{title}</h3>
          {description && <p className="mt-1 text-xs text-slate-400">{description}</p>}
        </div>
        <button type="button" onClick={() => setAdding((v) => !v)} className="btn-secondary shrink-0 !px-3 !py-2 text-xs">
          <Plus size={14} /> Tambah
        </button>
      </div>

      {(localError || error) && <p className="mt-3 text-xs text-red-400">{localError || error}</p>}

      {adding && (
        <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-white/10 bg-white/5 p-4 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.key} className={f.span2 ? 'sm:col-span-2' : ''}>
              <label className="label-field">{f.label}</label>
              <FieldInput field={f} value={form[f.key]} onChange={(v) => setForm({ ...form, [f.key]: v })} />
            </div>
          ))}
          <div className="flex gap-2 sm:col-span-2">
            <button type="button" disabled={busy} onClick={submitAdd} className="btn-primary !py-2 text-xs disabled:opacity-60">
              Simpan
            </button>
            <button type="button" onClick={() => setAdding(false)} className="btn-secondary !py-2 text-xs">
              Batal
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-left text-xs">
          <thead className="bg-white/5 text-slate-400">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className="px-4 py-3">
                  {c.label}
                </th>
              ))}
              <th className="px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-6 text-center text-slate-500">
                  Memuat...
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-6 text-center text-slate-500">
                  Belum ada data.
                </td>
              </tr>
            )}
            {rows.map((row) =>
              editingId === row.id ? (
                <tr key={row.id} className="border-t border-white/5 bg-white/5">
                  <td colSpan={columns.length + 1} className="p-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {fields.map((f) => (
                        <div key={f.key} className={f.span2 ? 'sm:col-span-2' : ''}>
                          <label className="label-field">{f.label}</label>
                          <FieldInput field={f} value={editForm[f.key]} onChange={(v) => setEditForm({ ...editForm, [f.key]: v })} />
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button type="button" disabled={busy} onClick={submitEdit} className="btn-primary !py-2 text-xs disabled:opacity-60">
                        <Check size={14} /> Simpan
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} className="btn-secondary !py-2 text-xs">
                        <X size={14} /> Batal
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={row.id} className="border-t border-white/5 text-slate-300">
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-3">
                      {c.render ? c.render(row) : row[c.key]}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => startEdit(row)} className="rounded p-1.5 text-cyan-royal hover:bg-cyan-royal/10" aria-label="Edit">
                        <Pencil size={14} />
                      </button>
                      <button type="button" onClick={() => confirmDelete(row.id)} className="rounded p-1.5 text-red-400 hover:bg-red-500/10" aria-label="Hapus">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
