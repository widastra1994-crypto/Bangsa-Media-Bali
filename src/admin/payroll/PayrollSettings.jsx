import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useSupabaseTable } from '../accounting/useSupabaseTable'
import { formatDate, idr, today } from '../ledger/ledgerUtils'
import { ErrorNote, PageHeader } from '../ledger/LedgerUI'

export const EMPLOYMENT_TYPES = [
  { value: 'tetap', label: 'Karyawan Tetap' },
  { value: 'kontrak', label: 'Karyawan Kontrak' },
  { value: 'freelance', label: 'Freelance' },
]

const allowanceTotal = (list) => (list || []).reduce((s, a) => s + (Number(a.amount) || 0), 0)

function NumberField({ label, value, onChange, suffix, step }) {
  return (
    <div>
      <label className="label-field">{label}</label>
      <div className="relative">
        <input type="number" min="0" step={step || 'any'} className="input-field" value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))} />
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">{suffix}</span>}
      </div>
    </div>
  )
}

function GeneralSettings() {
  const [form, setForm] = useState(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('acc_payroll_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setForm(data)
      })
  }, [])

  const save = async () => {
    setError('')
    const { id: _id, updated_at: _u, ...values } = form
    const { error: err } = await supabase.from('acc_payroll_settings').update({ ...values, updated_at: new Date().toISOString() }).eq('id', 1)
    if (err) setError(err.message)
    else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  if (!form) return <ErrorNote message={error} />
  const set = (k) => (v) => setForm({ ...form, [k]: v })

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-sm font-semibold text-white">Pengaturan Umum</p>
      <p className="mt-1 text-xs text-slate-400">Persentase BPJS di bawah adalah nilai umum dan bisa berubah sesuai aturan. Pastikan dengan konsultan pajak/HR Anda.</p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <NumberField label="Jam kerja normal / bulan" value={form.normal_hours_per_month} onChange={set('normal_hours_per_month')} suffix="jam" />
        <NumberField label="Tarif lembur / jam" value={form.overtime_rate_per_hour} onChange={set('overtime_rate_per_hour')} suffix="Rp" />
        <NumberField label="Tanggal gajian" value={form.pay_day} onChange={set('pay_day')} step="1" />
        <div />
        <NumberField label="BPJS Kes - karyawan" value={form.bpjs_kes_employee_pct} onChange={set('bpjs_kes_employee_pct')} suffix="%" />
        <NumberField label="BPJS Kes - perusahaan" value={form.bpjs_kes_company_pct} onChange={set('bpjs_kes_company_pct')} suffix="%" />
        <NumberField label="Batas gaji BPJS Kes" value={form.bpjs_kes_salary_cap} onChange={set('bpjs_kes_salary_cap')} suffix="Rp" />
        <div />
        <NumberField label="BPJS TK - karyawan" value={form.bpjs_tk_employee_pct} onChange={set('bpjs_tk_employee_pct')} suffix="%" />
        <NumberField label="BPJS TK - perusahaan" value={form.bpjs_tk_company_pct} onChange={set('bpjs_tk_company_pct')} suffix="%" />
      </div>
      <p className="mt-2 text-[11px] text-slate-500">Isi jam kerja normal 0 kalau lembur tidak dihitung otomatis dari Jam Kerja Staf. Dasar BPJS = gaji pokok + tunjangan tetap.</p>
      <ErrorNote message={error} />
      <div className="mt-3 flex items-center justify-end gap-3">
        {saved && <span className="text-xs text-emerald-400">Tersimpan</span>}
        <button type="button" onClick={save} className="btn-primary !px-4 !py-2 text-xs">
          Simpan Pengaturan
        </button>
      </div>
    </div>
  )
}

function ProfileForm({ staff, profile, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    employment_type: profile?.employment_type || 'tetap',
    base_salary: profile?.base_salary ?? 0,
    allowances: profile?.allowances?.length ? profile.allowances : [{ label: 'Transport', amount: 0 }],
    bpjs_kes_enrolled: profile?.bpjs_kes_enrolled ?? false,
    bpjs_tk_enrolled: profile?.bpjs_tk_enrolled ?? false,
    pph21_percent: profile?.pph21_percent ?? 0,
    bank_name: profile?.bank_name || '',
    bank_account_number: profile?.bank_account_number || '',
    bank_account_holder: profile?.bank_account_holder || '',
    is_active: profile?.is_active ?? true,
  }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const setAllowance = (idx, patch) => setForm((f) => ({ ...f, allowances: f.allowances.map((a, i) => (i === idx ? { ...a, ...patch } : a)) }))

  const save = async () => {
    setBusy(true)
    setError('')
    const payload = {
      ...form,
      staff_id: staff.id,
      base_salary: Number(form.base_salary) || 0,
      pph21_percent: Number(form.pph21_percent) || 0,
      allowances: form.allowances.filter((a) => a.label.trim() && Number(a.amount) > 0).map((a) => ({ label: a.label.trim(), amount: Number(a.amount) })),
      updated_at: new Date().toISOString(),
    }
    const { error: err } = await supabase.from('acc_staff_payroll_profiles').upsert(payload)
    setBusy(false)
    if (err) setError(err.message)
    else onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4">
      <div className="glass-panel w-full max-w-2xl rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">Gaji {staff.name}</h3>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white" aria-label="Tutup">
            <X size={18} />
          </button>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="label-field">Status</label>
            <select className="input-field" value={form.employment_type} onChange={(e) => setForm({ ...form, employment_type: e.target.value })}>
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <NumberField label="Gaji pokok / bulan" value={form.base_salary} onChange={(v) => setForm({ ...form, base_salary: v })} suffix="Rp" />
          <NumberField label="Tarif PPh 21" value={form.pph21_percent} onChange={(v) => setForm({ ...form, pph21_percent: v })} suffix="%" />
        </div>
        <p className="mt-1 text-[11px] text-slate-500">Tarif PPh 21 dikalikan penghasilan bruto per bulan (mis. tarif efektif/TER dari konsultan pajak). Isi 0 kalau tidak dipotong.</p>

        <p className="label-field mt-4">Tunjangan tetap per bulan</p>
        <div className="space-y-2">
          {form.allowances.map((a, idx) => (
            <div key={idx} className="flex gap-2">
              <input className="input-field" value={a.label} onChange={(e) => setAllowance(idx, { label: e.target.value })} placeholder="Nama tunjangan" />
              <input type="number" min="0" className="input-field !w-44" value={a.amount} onChange={(e) => setAllowance(idx, { amount: e.target.value })} placeholder="Rp" />
              <button type="button" onClick={() => setForm((f) => ({ ...f, allowances: f.allowances.filter((_, i) => i !== idx) }))} className="text-slate-500 hover:text-red-400" aria-label="Hapus tunjangan">
                <X size={16} />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setForm((f) => ({ ...f, allowances: [...f.allowances, { label: '', amount: 0 }] }))} className="flex items-center gap-1 text-xs text-cyan-300 hover:underline">
            <Plus size={12} /> Tambah tunjangan
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-5 text-xs text-slate-300">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.bpjs_kes_enrolled} onChange={(e) => setForm({ ...form, bpjs_kes_enrolled: e.target.checked })} className="h-4 w-4 accent-gold" />
            Terdaftar BPJS Kesehatan
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.bpjs_tk_enrolled} onChange={(e) => setForm({ ...form, bpjs_tk_enrolled: e.target.checked })} className="h-4 w-4 accent-gold" />
            Terdaftar BPJS Ketenagakerjaan
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="h-4 w-4 accent-gold" />
            Ikut penggajian
          </label>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="label-field">Bank</label>
            <input className="input-field" value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} placeholder="BCA, BRI, dsb." />
          </div>
          <div>
            <label className="label-field">No. Rekening</label>
            <input className="input-field" value={form.bank_account_number} onChange={(e) => setForm({ ...form, bank_account_number: e.target.value })} />
          </div>
          <div>
            <label className="label-field">Atas Nama</label>
            <input className="input-field" value={form.bank_account_holder} onChange={(e) => setForm({ ...form, bank_account_holder: e.target.value })} />
          </div>
        </div>

        <ErrorNote message={error} />
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary !px-4 !py-2 text-xs">
            Batal
          </button>
          <button type="button" onClick={save} disabled={busy} className="btn-primary !px-4 !py-2 text-xs disabled:opacity-60">
            {busy ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  )
}

function StaffProfiles() {
  const staff = useSupabaseTable('acc_staff_members', { orderBy: 'name', ascending: true })
  const [profiles, setProfiles] = useState({})
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')

  const loadProfiles = useCallback(() => {
    supabase
      .from('acc_staff_payroll_profiles')
      .select('*')
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setProfiles(Object.fromEntries((data || []).map((p) => [p.staff_id, p])))
      })
  }, [])

  useEffect(() => {
    loadProfiles()
  }, [loadProfiles])

  const active = staff.rows.filter((s) => s.is_active)

  return (
    <div className="mt-6">
      <p className="text-sm font-semibold text-white">Gaji per Staf</p>
      <p className="mt-1 text-xs text-slate-400">Staf baru ditambahkan di Master Data &gt; Staf. Staf yang belum diatur gajinya tetap ikut slip kalau punya komisi siap dibayar.</p>
      <ErrorNote message={error || staff.error} />
      <div className="mt-3 overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-left text-xs">
          <thead className="bg-white/5 text-slate-400">
            <tr>
              <th className="px-4 py-3">Staf</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Gaji Pokok</th>
              <th className="px-4 py-3 text-right">Tunjangan</th>
              <th className="px-4 py-3">BPJS</th>
              <th className="px-4 py-3">PPh 21</th>
              <th className="px-4 py-3">Rekening</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {active.map((s) => {
              const p = profiles[s.id]
              return (
                <tr key={s.id} className={`border-t border-white/5 text-slate-300 ${p && !p.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-white">{s.name}</p>
                    <p className="text-[11px] capitalize text-slate-500">{s.role_type}</p>
                  </td>
                  <td className="px-4 py-2.5">{p ? EMPLOYMENT_TYPES.find((t) => t.value === p.employment_type)?.label : <span className="text-amber-300">Belum diatur</span>}</td>
                  <td className="px-4 py-2.5 text-right">{p ? idr(p.base_salary) : '-'}</td>
                  <td className="px-4 py-2.5 text-right">{p ? idr(allowanceTotal(p.allowances)) : '-'}</td>
                  <td className="px-4 py-2.5">{p ? [p.bpjs_kes_enrolled && 'Kes', p.bpjs_tk_enrolled && 'TK'].filter(Boolean).join(', ') || '-' : '-'}</td>
                  <td className="px-4 py-2.5">{p && Number(p.pph21_percent) > 0 ? `${Number(p.pph21_percent)}%` : '-'}</td>
                  <td className="px-4 py-2.5">{p?.bank_name ? `${p.bank_name} ${p.bank_account_number || ''}` : '-'}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button type="button" onClick={() => setEditing(s)} className="inline-flex items-center gap-1 text-cyan-300 hover:underline">
                      <Pencil size={12} /> Atur
                    </button>
                  </td>
                </tr>
              )
            })}
            {!staff.loading && active.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                  Belum ada staf aktif.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {editing && (
        <ProfileForm
          staff={editing}
          profile={profiles[editing.id]}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            loadProfiles()
          }}
        />
      )}
    </div>
  )
}

const emptyLoan = () => ({ staff_id: '', loan_date: today(), amount: '', installment_amount: '', bank_account_id: '', notes: '' })

function EmployeeLoans() {
  const staff = useSupabaseTable('acc_staff_members', { orderBy: 'name', ascending: true })
  const banks = useSupabaseTable('acc_bank_accounts', { orderBy: 'account_name', ascending: true })
  const [loans, setLoans] = useState([])
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    supabase
      .from('acc_employee_loans_view')
      .select('*')
      .order('loan_date', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setLoans(data || [])
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const save = async () => {
    setError('')
    const { error: err } = await supabase.from('acc_employee_loans').insert({
      staff_id: form.staff_id,
      loan_date: form.loan_date,
      amount: Number(form.amount),
      installment_amount: Number(form.installment_amount),
      bank_account_id: form.bank_account_id || null,
      notes: form.notes || null,
    })
    if (err) setError(err.message)
    else {
      setForm(null)
      load()
    }
  }

  const remove = async (loan) => {
    if (!window.confirm(`Hapus kasbon ${loan.staff_name} ${idr(loan.amount)}?`)) return
    const { error: err } = await supabase.from('acc_employee_loans').delete().eq('id', loan.id)
    if (err) setError(err.message)
    else load()
  }

  const valid = form && form.staff_id && Number(form.amount) > 0 && Number(form.installment_amount) > 0

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-white">Kasbon Karyawan</p>
          <p className="mt-1 text-xs text-slate-400">Cicilan dipotong otomatis dari slip gaji setiap bulan sampai lunas.</p>
        </div>
        {!form && (
          <button type="button" onClick={() => setForm(emptyLoan())} className="btn-primary !px-3 !py-2 text-xs">
            <Plus size={14} /> Catat Kasbon
          </button>
        )}
      </div>

      {form && (
        <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="label-field">Staf</label>
              <select className="input-field" value={form.staff_id} onChange={(e) => setForm({ ...form, staff_id: e.target.value })}>
                <option value="">Pilih staf...</option>
                {staff.rows
                  .filter((s) => s.is_active)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="label-field">Tanggal</label>
              <input type="date" className="input-field" value={form.loan_date} onChange={(e) => setForm({ ...form, loan_date: e.target.value })} />
            </div>
            <div>
              <label className="label-field">Diambil dari rekening</label>
              <select className="input-field" value={form.bank_account_id} onChange={(e) => setForm({ ...form, bank_account_id: e.target.value })}>
                <option value="">Pilih...</option>
                {banks.rows.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.account_name}
                  </option>
                ))}
              </select>
            </div>
            <NumberField label="Nominal kasbon" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} suffix="Rp" />
            <NumberField label="Cicilan per bulan" value={form.installment_amount} onChange={(v) => setForm({ ...form, installment_amount: v })} suffix="Rp" />
            <div>
              <label className="label-field">Catatan</label>
              <input className="input-field" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setForm(null)} className="btn-secondary !px-4 !py-2 text-xs">
              Batal
            </button>
            <button type="button" onClick={save} disabled={!valid} className="btn-primary !px-4 !py-2 text-xs disabled:opacity-50">
              Simpan
            </button>
          </div>
        </div>
      )}

      <ErrorNote message={error} />
      <div className="mt-3 overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-left text-xs">
          <thead className="bg-white/5 text-slate-400">
            <tr>
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3">Staf</th>
              <th className="px-4 py-3 text-right">Nominal</th>
              <th className="px-4 py-3 text-right">Cicilan</th>
              <th className="px-4 py-3 text-right">Sudah Dipotong</th>
              <th className="px-4 py-3 text-right">Sisa</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loans.map((l) => (
              <tr key={l.id} className="border-t border-white/5 text-slate-300">
                <td className="px-4 py-2.5">{formatDate(l.loan_date)}</td>
                <td className="px-4 py-2.5 text-white">
                  {l.staff_name}
                  {l.notes && <span className="block text-[11px] text-slate-500">{l.notes}</span>}
                </td>
                <td className="px-4 py-2.5 text-right">{idr(l.amount)}</td>
                <td className="px-4 py-2.5 text-right">{idr(l.installment_amount)}</td>
                <td className="px-4 py-2.5 text-right">{idr(l.deducted)}</td>
                <td className="px-4 py-2.5 text-right font-semibold text-white">{idr(l.remaining)}</td>
                <td className="px-4 py-2.5">{l.status === 'paid' ? <span className="text-emerald-400">Lunas</span> : <span className="text-amber-300">Berjalan</span>}</td>
                <td className="px-4 py-2.5 text-right">
                  {Number(l.deducted) === 0 && (
                    <button type="button" onClick={() => remove(l)} className="text-slate-500 hover:text-red-400" aria-label="Hapus kasbon">
                      <Trash2 size={13} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {loans.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                  Belum ada kasbon.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function PayrollSettings() {
  return (
    <div>
      <PageHeader title="Pengaturan Gaji" description="Atur gaji pokok, tunjangan, BPJS, PPh 21, rekening, dan kasbon setiap staf. Data ini dipakai saat membuat slip gaji bulanan di menu Penggajian." />
      <div className="mt-5">
        <GeneralSettings />
      </div>
      <StaffProfiles />
      <EmployeeLoans />
    </div>
  )
}
