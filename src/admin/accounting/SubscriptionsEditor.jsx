import SimpleCrudTable from './SimpleCrudTable'
import { useSupabaseTable } from './useSupabaseTable'

const idr = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0)

const STATUS_OPTIONS = [
  { value: 'active', label: 'Aktif' },
  { value: 'paused', label: 'Dijeda' },
  { value: 'cancelled', label: 'Berhenti' },
]

export default function SubscriptionsEditor() {
  const data = useSupabaseTable('acc_subscriptions', {
    select: '*, acc_clients(company_name)',
    orderBy: 'created_at',
  })
  const clients = useSupabaseTable('acc_clients', { orderBy: 'company_name', ascending: true })

  return (
    <div>
      <h2 className="text-lg font-semibold text-white">Langganan Retainer & Invoice Berulang</h2>
      <p className="mt-1 text-sm text-slate-400">
        Untuk klien dengan jasa bulanan (kelola iklan, maintenance, dsb). Sistem otomatis menerbitkan & mengirim invoice setiap bulan pada tanggal yang ditentukan -- tidak perlu input manual lagi.
      </p>

      <div className="mt-6">
        <SimpleCrudTable
          title="Daftar Langganan"
          data={data}
          fields={[
            {
              key: 'client_id',
              label: 'Klien',
              type: 'select',
              options: clients.rows.map((c) => ({ value: c.id, label: c.company_name })),
            },
            { key: 'service_name', label: 'Nama Layanan', type: 'text', placeholder: 'Kelola Iklan Meta Ads, Maintenance Bulanan, dsb.' },
            { key: 'amount', label: 'Nominal per Bulan (Rp)', type: 'number' },
            { key: 'billing_day', label: 'Tanggal Tagih Tiap Bulan (1-28)', type: 'number', default: 1 },
            { key: 'start_date', label: 'Mulai Berlaku', type: 'date', default: new Date().toISOString().slice(0, 10) },
            { key: 'end_date', label: 'Berakhir (opsional, kosongkan jika berlangsung terus)', type: 'date' },
            { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS, default: 'active' },
            { key: 'notes', label: 'Catatan', type: 'textarea', span2: true },
          ]}
          columns={[
            { key: 'client', label: 'Klien', render: (r) => r.acc_clients?.company_name },
            { key: 'service_name', label: 'Layanan' },
            { key: 'amount', label: 'Nominal/Bulan', render: (r) => idr(r.amount) },
            { key: 'billing_day', label: 'Tgl Tagih', render: (r) => `Tanggal ${r.billing_day}` },
            { key: 'last_invoiced_period', label: 'Terakhir Ditagih', render: (r) => r.last_invoiced_period || '-' },
            { key: 'status', label: 'Status', render: (r) => STATUS_OPTIONS.find((s) => s.value === r.status)?.label },
          ]}
        />
      </div>
    </div>
  )
}
