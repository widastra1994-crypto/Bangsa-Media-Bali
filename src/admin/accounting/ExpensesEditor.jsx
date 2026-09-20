import SimpleCrudTable from './SimpleCrudTable'
import { useSupabaseTable } from './useSupabaseTable'

const idr = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0)

const CATEGORY_OPTIONS = [
  { value: 'domain_cost', label: 'Beban Domain' },
  { value: 'server_cost', label: 'Beban Server' },
  { value: 'project_tools', label: 'Alat/Tools Proyek' },
  { value: 'office_operational', label: 'Operasional Kantor' },
  { value: 'salary', label: 'Gaji' },
  { value: 'marketing', label: 'Marketing' },
]

export default function ExpensesEditor() {
  const data = useSupabaseTable('acc_expenses', { orderBy: 'expense_date' })
  const vendors = useSupabaseTable('acc_vendors', { orderBy: 'vendor_name', ascending: true })
  const bankAccounts = useSupabaseTable('acc_bank_accounts', { orderBy: 'account_name', ascending: true })
  const projects = useSupabaseTable('acc_projects', { orderBy: 'created_at' })

  return (
    <div>
      <h2 className="text-lg font-semibold text-white">Pengeluaran</h2>
      <p className="mt-1 text-sm text-slate-400">Catat beban operasional di luar form transaksi proyek (gaji, marketing, dsb).</p>

      <div className="mt-6">
        <SimpleCrudTable
          title="Daftar Pengeluaran"
          data={data}
          fields={[
            { key: 'category', label: 'Kategori', type: 'select', options: CATEGORY_OPTIONS, default: 'office_operational' },
            { key: 'amount', label: 'Nominal (Rp)', type: 'number' },
            { key: 'expense_date', label: 'Tanggal', type: 'date', default: new Date().toISOString().slice(0, 10) },
            {
              key: 'vendor_id',
              label: 'Vendor (opsional)',
              type: 'select',
              options: vendors.rows.map((v) => ({ value: v.id, label: v.vendor_name })),
            },
            {
              key: 'bank_account_id',
              label: 'Sumber Kas/Bank',
              type: 'select',
              options: bankAccounts.rows.map((b) => ({ value: b.id, label: b.account_name })),
            },
            {
              key: 'project_id',
              label: 'Proyek Terkait (opsional)',
              type: 'select',
              options: projects.rows.map((p) => ({ value: p.id, label: p.website_name || p.id.slice(0, 8) })),
            },
            { key: 'notes', label: 'Catatan', type: 'textarea', span2: true },
          ]}
          columns={[
            { key: 'expense_date', label: 'Tanggal' },
            { key: 'category', label: 'Kategori', render: (r) => CATEGORY_OPTIONS.find((c) => c.value === r.category)?.label || r.category },
            { key: 'amount', label: 'Nominal', render: (r) => idr(r.amount) },
            { key: 'notes', label: 'Catatan' },
          ]}
        />
      </div>
    </div>
  )
}
