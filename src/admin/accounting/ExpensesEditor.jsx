import { useState } from 'react'
import { Plus } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import SimpleCrudTable from './SimpleCrudTable'
import { useSupabaseTable } from './useSupabaseTable'

const idr = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0)

// Kelompok beban di Laba Rugi / Buku Besar untuk kategori baru.
const ACCOUNT_GROUPS = [
  { value: 'exp_office', label: 'Operasional Kantor' },
  { value: 'exp_marketing', label: 'Marketing' },
  { value: 'exp_salary', label: 'Gaji & Tunjangan' },
  { value: 'exp_hosting', label: 'Domain & Server' },
  { value: 'exp_project_tools', label: 'Tools & Proyek' },
  { value: 'exp_vendor', label: 'Vendor Pihak Ketiga' },
  { value: 'exp_other', label: 'Lain-lain' },
]

const NEW = '__new__'

// Pilihan kategori + "Tambah kategori baru" langsung di form, tanpa ke menu lain.
function CategoryPicker({ categories, value, onChange, onCreated }) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [group, setGroup] = useState('exp_other')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    if (!name.trim()) return setError('Isi nama kategori.')
    setBusy(true)
    const { data: code, error: err } = await supabase.rpc('expense_category_add', { p_name: name.trim(), p_account_key: group })
    setBusy(false)
    if (err) return setError(err.message)
    await onCreated()
    onChange(code)
    setAdding(false)
    setName('')
    setGroup('exp_other')
    setError('')
  }

  return (
    <div>
      <select
        className="input-field"
        value={adding ? NEW : value ?? ''}
        onChange={(e) => {
          if (e.target.value === NEW) return setAdding(true)
          setAdding(false)
          onChange(e.target.value)
        }}
      >
        <option value="">Pilih kategori</option>
        <option value={NEW}>+ Tambah kategori baru…</option>
        {categories.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </select>
      {adding && (
        <div className="mt-2 rounded-xl border-2 border-cyan-royal/40 p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="label-field">Nama kategori</label>
              <input
                className="input-field"
                placeholder="mis. Iklan Meta Ads, Listrik, Internet"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setError('')
                }}
              />
            </div>
            <div>
              <label className="label-field">Masuk kelompok laporan</label>
              <select className="input-field" value={group} onChange={(e) => setGroup(e.target.value)}>
                {ACCOUNT_GROUPS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => setAdding(false)} className="btn-secondary !py-1.5 text-xs">
              Batal
            </button>
            <button type="button" onClick={save} disabled={busy} className="btn-primary !py-1.5 text-xs disabled:opacity-60">
              <Plus size={13} /> {busy ? 'Menyimpan...' : 'Simpan kategori'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ExpensesEditor() {
  const data = useSupabaseTable('acc_expenses', { orderBy: 'expense_date' })
  const bankAccounts = useSupabaseTable('acc_bank_accounts', { orderBy: 'account_name', ascending: true })
  const categories = useSupabaseTable('acc_expense_categories', { orderBy: 'sort', ascending: true })
  const visibleCategories = categories.rows.filter((c) => !c.is_hidden)
  const categoryName = (code) => categories.rows.find((c) => c.code === code)?.name || code

  return (
    <div>
      <h2 className="text-lg font-semibold text-white">Pengeluaran</h2>
      <p className="mt-1 text-sm text-slate-400">
        Catat beban operasional di luar form transaksi proyek (gaji, marketing, dsb). Semua pengeluaran otomatis terhitung di Rekap Bulanan dan Laba Rugi.
      </p>

      <div className="mt-6">
        <SimpleCrudTable
          title="Daftar Pengeluaran"
          data={data}
          fields={[
            {
              key: 'category',
              label: 'Kategori',
              type: 'custom',
              default: 'office_operational',
              render: ({ value, onChange }) => (
                <CategoryPicker categories={visibleCategories} value={value} onChange={onChange} onCreated={categories.refresh} />
              ),
            },
            { key: 'amount', label: 'Nominal (Rp)', type: 'number' },
            { key: 'expense_date', label: 'Tanggal', type: 'date', default: new Date().toISOString().slice(0, 10) },
            {
              key: 'bank_account_id',
              label: 'Sumber Kas/Bank',
              type: 'select',
              options: bankAccounts.rows.map((b) => ({ value: b.id, label: b.account_name })),
            },
            { key: 'notes', label: 'Catatan', type: 'textarea', span2: true },
          ]}
          columns={[
            { key: 'expense_date', label: 'Tanggal' },
            { key: 'category', label: 'Kategori', render: (r) => categoryName(r.category) },
            { key: 'amount', label: 'Nominal', render: (r) => idr(r.amount) },
            { key: 'notes', label: 'Catatan' },
          ]}
        />
      </div>
    </div>
  )
}
