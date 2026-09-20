import SimpleCrudTable from './SimpleCrudTable'
import { useSupabaseTable } from './useSupabaseTable'

export default function TimeLogsEditor() {
  const data = useSupabaseTable('acc_time_logs', {
    select: '*, acc_projects(website_name), acc_staff_members(name)',
    orderBy: 'work_date',
  })
  const projects = useSupabaseTable('acc_projects', { orderBy: 'created_at' })
  const staff = useSupabaseTable('acc_staff_members', { orderBy: 'name', ascending: true })

  return (
    <div>
      <h2 className="text-lg font-semibold text-white">Jam Kerja Staf</h2>
      <p className="mt-1 text-sm text-slate-400">
        Catat jam kerja per proyek untuk melihat produktivitas & profitabilitas riil (lihat tab Profitabilitas Proyek untuk Rp per jam).
      </p>

      <div className="mt-6">
        <SimpleCrudTable
          title="Riwayat Jam Kerja"
          data={data}
          fields={[
            { key: 'project_id', label: 'Proyek', type: 'select', options: projects.rows.map((p) => ({ value: p.id, label: p.website_name || p.id.slice(0, 8) })) },
            { key: 'staff_id', label: 'Staf', type: 'select', options: staff.rows.map((s) => ({ value: s.id, label: s.name })) },
            { key: 'work_date', label: 'Tanggal', type: 'date', default: new Date().toISOString().slice(0, 10) },
            { key: 'hours', label: 'Jumlah Jam', type: 'number' },
            { key: 'description', label: 'Deskripsi Pekerjaan', type: 'textarea', span2: true },
          ]}
          columns={[
            { key: 'work_date', label: 'Tanggal' },
            { key: 'project', label: 'Proyek', render: (r) => r.acc_projects?.website_name || '-' },
            { key: 'staff', label: 'Staf', render: (r) => r.acc_staff_members?.name || '-' },
            { key: 'hours', label: 'Jam', render: (r) => `${r.hours} jam` },
            { key: 'description', label: 'Deskripsi' },
          ]}
        />
      </div>
    </div>
  )
}
