import { useCallback, useEffect, useMemo, useState } from 'react'
import { Banknote, CheckCircle2, ChevronDown, Download, FileDown, Lock, RefreshCw, Trash2, Unlock } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useContent } from '../../context/ContentContext'
import { useUserRole } from '../useUserRole'
import { useSupabaseTable } from '../accounting/useSupabaseTable'
import { exportToCsv } from '../accounting/csvExport'
import { currentMonth, formatDate, idr, monthLabel, monthRange, today } from '../ledger/ledgerUtils'
import { ErrorNote, MonthPicker, PageHeader, StatCard } from '../ledger/LedgerUI'

const downloadPayslipPdf = (...args) => import('../../lib/pdfGenerator').then((m) => m.generatePayslipPdf(...args))

const STEPS = [
  { key: 'draft', label: 'Draf' },
  { key: 'approved', label: 'Disetujui Owner' },
  { key: 'paid', label: 'Dibayar' },
]

const EDITABLE = ['overtime_hours', 'bonus', 'bonus_note', 'absence_deduction', 'pph21', 'other_deduction', 'other_deduction_note', 'notes']

function SlipRow({ slip, editable, brand, onSaved }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(() => Object.fromEntries(EDITABLE.map((k) => [k, slip[k] ?? ''])))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setForm(Object.fromEntries(EDITABLE.map((k) => [k, slip[k] ?? ''])))
  }, [slip])

  const save = async () => {
    setBusy(true)
    setError('')
    const num = (v) => (v === '' || v === null ? 0 : Number(v))
    const { error: err } = await supabase
      .from('acc_payslips')
      .update({
        overtime_hours: num(form.overtime_hours),
        bonus: num(form.bonus),
        bonus_note: form.bonus_note || null,
        absence_deduction: num(form.absence_deduction),
        pph21: num(form.pph21),
        other_deduction: num(form.other_deduction),
        other_deduction_note: form.other_deduction_note || null,
        notes: form.notes || null,
      })
      .eq('id', slip.id)
    setBusy(false)
    if (err) setError(err.message)
    else onSaved()
  }

  const field = (key, label, type = 'number') => (
    <div>
      <label className="label-field">{label}</label>
      <input type={type} min="0" className="input-field" value={form[key]} disabled={!editable} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
    </div>
  )

  return (
    <>
      <tr className="cursor-pointer border-t border-white/5 text-slate-300 hover:bg-white/[0.03]" onClick={() => setOpen((v) => !v)}>
        <td className="px-4 py-3">
          <span className="flex items-center gap-2">
            <ChevronDown size={14} className={`text-slate-500 transition-transform ${open ? '' : '-rotate-90'}`} />
            <span>
              <span className="font-medium text-white">{slip.staff_name}</span>
              <span className="block text-[11px] text-slate-500">
                {slip.slip_no} &bull; {slip.bank_name ? `${slip.bank_name} ${slip.bank_account_number || ''}` : 'Rekening belum diisi'}
              </span>
            </span>
          </span>
        </td>
        <td className="px-4 py-3 text-right">{idr(slip.gross_pay)}</td>
        <td className="px-4 py-3 text-right text-red-300">{idr(slip.total_deductions)}</td>
        <td className={`px-4 py-3 text-right font-semibold ${Number(slip.net_pay) < 0 ? 'text-red-400' : 'text-white'}`}>{idr(slip.net_pay)}</td>
        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => downloadPayslipPdf(slip, brand)} className="inline-flex items-center gap-1 text-[11px] text-cyan-300 hover:underline">
            <FileDown size={12} /> PDF
          </button>
        </td>
      </tr>
      {open && (
        <tr className="border-t border-white/5 bg-white/[0.02]">
          <td colSpan={5} className="px-4 py-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="space-y-1 text-xs text-slate-300">
                <p className="label-field">Rincian otomatis</p>
                <p className="flex justify-between">
                  <span>Gaji pokok</span>
                  <span>{idr(slip.base_salary)}</span>
                </p>
                {(slip.allowances || []).map((a, i) => (
                  <p key={i} className="flex justify-between">
                    <span>Tunjangan {a.label}</span>
                    <span>{idr(a.amount)}</span>
                  </p>
                ))}
                {(slip.commission_details || []).map((c) => (
                  <p key={c.id} className="flex justify-between">
                    <span>
                      Komisi {c.project} ({c.role})
                    </span>
                    <span>{idr(c.amount)}</span>
                  </p>
                ))}
                <p className="flex justify-between">
                  <span>Lembur {Number(slip.overtime_hours)} jam x {idr(slip.overtime_rate)}</span>
                  <span>{idr(slip.overtime_amount)}</span>
                </p>
                <p className="flex justify-between text-red-300">
                  <span>BPJS Kesehatan + Ketenagakerjaan (karyawan)</span>
                  <span>-{idr(Number(slip.bpjs_kes_employee) + Number(slip.bpjs_tk_employee))}</span>
                </p>
                <p className="flex justify-between text-red-300">
                  <span>Cicilan kasbon</span>
                  <span>-{idr(slip.loan_deduction)}</span>
                </p>
                <p className="flex justify-between text-slate-500">
                  <span>BPJS ditanggung perusahaan (bukan potongan)</span>
                  <span>{idr(slip.bpjs_company)}</span>
                </p>
              </div>
              <div>
                <p className="label-field">Penyesuaian {editable ? '' : '(terkunci)'}</p>
                <div className="grid grid-cols-2 gap-2">
                  {field('overtime_hours', 'Jam lembur')}
                  {field('bonus', 'Bonus / THR (Rp)')}
                  {field('bonus_note', 'Keterangan bonus', 'text')}
                  {field('absence_deduction', 'Potongan absen (Rp)')}
                  {field('pph21', `PPh 21 (Rp)${Number(slip.pph21_percent) > 0 ? ` - otomatis ${Number(slip.pph21_percent)}%` : ''}`)}
                  {field('other_deduction', 'Potongan lain (Rp)')}
                  {field('other_deduction_note', 'Keterangan potongan lain', 'text')}
                  {field('notes', 'Catatan di slip', 'text')}
                </div>
                <ErrorNote message={error} />
                {editable && (
                  <div className="mt-3 flex justify-end">
                    <button type="button" onClick={save} disabled={busy} className="btn-primary !px-4 !py-2 text-xs disabled:opacity-60">
                      {busy ? 'Menyimpan...' : 'Simpan & Hitung Ulang'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function PayDialog({ run, total, onClose, onDone }) {
  const banks = useSupabaseTable('acc_bank_accounts', { orderBy: 'account_name', ascending: true })
  const [bankId, setBankId] = useState('')
  const [payDate, setPayDate] = useState(today())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setBusy(true)
    setError('')
    const { error: err } = await supabase.rpc('payroll_pay', { p_run_id: run.id, p_bank_account_id: bankId, p_pay_date: payDate })
    setBusy(false)
    if (err) setError(err.message)
    else onDone()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="glass-panel w-full max-w-md rounded-2xl p-6">
        <h3 className="text-base font-semibold text-white">Bayar Gaji {monthLabel(run.period.slice(0, 7))}</h3>
        <p className="mt-1 text-xs text-slate-400">Total {idr(total)}. Lakukan transfer ke setiap staf di bank Anda (lihat "Daftar Transfer"), lalu catat di sini.</p>
        <div className="mt-4 space-y-3">
          <div>
            <label className="label-field">Dibayar dari rekening</label>
            <select className="input-field" value={bankId} onChange={(e) => setBankId(e.target.value)}>
              <option value="">Pilih rekening...</option>
              {banks.rows.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.account_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Tanggal bayar</label>
            <input type="date" className="input-field" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
          </div>
        </div>
        <ErrorNote message={error} />
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary !px-4 !py-2 text-xs">
            Batal
          </button>
          <button type="button" onClick={submit} disabled={busy || !bankId} className="btn-primary !px-4 !py-2 text-xs disabled:opacity-50">
            <Banknote size={13} /> {busy ? 'Menyimpan...' : 'Tandai Sudah Dibayar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AnnualRecap() {
  const [year, setYear] = useState(currentMonth().slice(0, 4))
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('acc_payslips')
      .select('staff_id, staff_name, period, gross_pay, bpjs_kes_employee, bpjs_tk_employee, bpjs_company, pph21, net_pay, is_published')
      .gte('period', `${year}-01-01`)
      .lte('period', `${year}-12-01`)
      .eq('is_published', true)
      .then(({ data, error: err }) => {
        if (err) return setError(err.message)
        const map = new Map()
        for (const s of data || []) {
          const r = map.get(s.staff_id) || { staff_name: s.staff_name, months: 0, gross: 0, bpjsEmp: 0, bpjsCo: 0, pph21: 0, net: 0 }
          r.months += 1
          r.gross += Number(s.gross_pay)
          r.bpjsEmp += Number(s.bpjs_kes_employee) + Number(s.bpjs_tk_employee)
          r.bpjsCo += Number(s.bpjs_company)
          r.pph21 += Number(s.pph21)
          r.net += Number(s.net_pay)
          map.set(s.staff_id, r)
        }
        setRows([...map.values()].sort((a, b) => a.staff_name.localeCompare(b.staff_name)))
        setError('')
      })
  }, [year])

  const exportCsv = () =>
    exportToCsv(
      `rekap-gaji-${year}`,
      rows.map((r) => ({ Staf: r.staff_name, Bulan: r.months, Bruto: r.gross, 'BPJS Karyawan': r.bpjsEmp, 'BPJS Perusahaan': r.bpjsCo, 'PPh 21': r.pph21, Bersih: r.net })),
    )

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-white">Rekap Tahunan per Staf</p>
          <p className="mt-1 text-xs text-slate-400">Dari slip yang sudah disetujui. Berguna untuk bukti potong PPh 21 akhir tahun.</p>
        </div>
        <div className="flex gap-2">
          <input type="number" className="input-field !w-28" value={year} onChange={(e) => setYear(e.target.value)} aria-label="Tahun" />
          <button type="button" onClick={exportCsv} disabled={rows.length === 0} className="btn-secondary !px-3 !py-2 text-xs disabled:opacity-50">
            <Download size={14} /> Ekspor CSV
          </button>
        </div>
      </div>
      <ErrorNote message={error} />
      <div className="mt-3 overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-left text-xs">
          <thead className="bg-white/5 text-slate-400">
            <tr>
              <th className="px-4 py-3">Staf</th>
              <th className="px-4 py-3 text-right">Bulan</th>
              <th className="px-4 py-3 text-right">Bruto</th>
              <th className="px-4 py-3 text-right">BPJS Karyawan</th>
              <th className="px-4 py-3 text-right">BPJS Perusahaan</th>
              <th className="px-4 py-3 text-right">PPh 21</th>
              <th className="px-4 py-3 text-right">Bersih</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.staff_name} className="border-t border-white/5 text-slate-300">
                <td className="px-4 py-2.5 text-white">{r.staff_name}</td>
                <td className="px-4 py-2.5 text-right">{r.months}</td>
                <td className="px-4 py-2.5 text-right">{idr(r.gross)}</td>
                <td className="px-4 py-2.5 text-right">{idr(r.bpjsEmp)}</td>
                <td className="px-4 py-2.5 text-right">{idr(r.bpjsCo)}</td>
                <td className="px-4 py-2.5 text-right">{idr(r.pph21)}</td>
                <td className="px-4 py-2.5 text-right font-semibold text-white">{idr(r.net)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                  Belum ada slip gaji yang disetujui di tahun ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function PayrollRuns() {
  const { role } = useUserRole()
  const { content } = useContent()
  const brand = { name: content.brand?.name, address: content.contact?.address, phone: content.contact?.phone, email: content.contact?.email }
  const [month, setMonth] = useState(currentMonth())
  const [run, setRun] = useState(null)
  const [slips, setSlips] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [paying, setPaying] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const period = monthRange(month).from
    const { data: runData, error: runErr } = await supabase.from('acc_payroll_runs').select('*').eq('period', period).maybeSingle()
    if (runErr) {
      setError(runErr.message)
      setLoading(false)
      return
    }
    setRun(runData)
    if (runData) {
      const { data, error: err } = await supabase.from('acc_payslips').select('*').eq('run_id', runData.id).order('staff_name')
      if (err) setError(err.message)
      setSlips(data || [])
    } else setSlips([])
    setLoading(false)
  }, [month])

  useEffect(() => {
    load()
  }, [load])

  const call = async (fn, args, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return
    setBusy(true)
    setError('')
    const { error: err } = await supabase.rpc(fn, args)
    setBusy(false)
    if (err) setError(err.message)
    else load()
  }

  const removeDraft = async () => {
    if (!window.confirm(`Hapus draf penggajian ${monthLabel(month)}? Komisi dan cicilan kasbon kembali ke antrean.`)) return
    const { error: err } = await supabase.from('acc_payroll_runs').delete().eq('id', run.id)
    if (err) setError(err.message)
    else load()
  }

  const totals = useMemo(
    () =>
      slips.reduce(
        (t, s) => ({
          gross: t.gross + Number(s.gross_pay),
          deductions: t.deductions + Number(s.total_deductions),
          net: t.net + Number(s.net_pay),
          bpjsCo: t.bpjsCo + Number(s.bpjs_company),
        }),
        { gross: 0, deductions: 0, net: 0, bpjsCo: 0 },
      ),
    [slips],
  )

  const exportTransfer = () =>
    exportToCsv(
      `daftar-transfer-gaji-${month}`,
      slips
        .filter((s) => Number(s.net_pay) > 0)
        .map((s) => ({ Nama: s.staff_name, Bank: s.bank_name || '', 'No Rekening': s.bank_account_number || '', 'Atas Nama': s.bank_account_holder || s.staff_name, Nominal: Number(s.net_pay), Keterangan: `Gaji ${monthLabel(month)}` })),
    )

  const exportSummary = () =>
    exportToCsv(
      `rekap-gaji-${month}`,
      slips.map((s) => ({
        'No Slip': s.slip_no,
        Staf: s.staff_name,
        'Gaji Pokok': Number(s.base_salary),
        Tunjangan: Number(s.allowance_total),
        Komisi: Number(s.commission_total),
        Lembur: Number(s.overtime_amount),
        Bonus: Number(s.bonus),
        Bruto: Number(s.gross_pay),
        'BPJS Karyawan': Number(s.bpjs_kes_employee) + Number(s.bpjs_tk_employee),
        'PPh 21': Number(s.pph21),
        Kasbon: Number(s.loan_deduction),
        'Potongan Lain': Number(s.absence_deduction) + Number(s.other_deduction),
        Bersih: Number(s.net_pay),
        'BPJS Perusahaan': Number(s.bpjs_company),
      })),
    )

  const stepIndex = run ? STEPS.findIndex((s) => s.key === run.status) : -1
  const isDraft = run?.status === 'draft'

  return (
    <div>
      <PageHeader title="Penggajian" description="Buat slip gaji bulanan untuk semua staf. Gaji pokok, tunjangan, komisi siap dibayar, lembur, cicilan kasbon, BPJS, dan PPh 21 dihitung otomatis.">
        <MonthPicker value={month} onChange={setMonth} />
      </PageHeader>

      <ErrorNote message={error} />
      {loading && <p className="py-8 text-center text-xs text-slate-500">Memuat...</p>}

      {!loading && !run && (
        <div className="mt-5 rounded-2xl border border-dashed border-white/15 p-8 text-center">
          <p className="text-sm font-semibold text-white">Belum ada penggajian untuk {monthLabel(month)}.</p>
          <p className="mt-1 text-xs text-slate-400">Pastikan gaji tiap staf sudah diatur di menu Pengaturan Gaji.</p>
          <button type="button" onClick={() => call('payroll_generate', { p_period: monthRange(month).from })} disabled={busy} className="btn-primary mt-4 !px-4 !py-2 text-xs disabled:opacity-60">
            <RefreshCw size={13} /> {busy ? 'Menghitung...' : 'Buat Draf Gaji'}
          </button>
        </div>
      )}

      {!loading && run && (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {STEPS.map((s, i) => (
              <span key={s.key} className="flex items-center gap-2">
                <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${i <= stepIndex ? 'bg-emerald-500/10 text-emerald-300' : 'bg-white/5 text-slate-500'}`}>
                  {i <= stepIndex ? <CheckCircle2 size={13} /> : <span className="h-3 w-3 rounded-full border border-slate-500" />} {s.label}
                </span>
                {i < STEPS.length - 1 && <span className="h-px w-6 bg-white/10" />}
              </span>
            ))}
            {run.status === 'paid' && (
              <span className="text-xs text-slate-400">
                Dibayar {formatDate(run.pay_date)}
              </span>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label={`Total Bruto (${slips.length} staf)`} value={idr(totals.gross)} />
            <StatCard label="Total Potongan" value={idr(totals.deductions)} tone="bad" />
            <StatCard label="Total Gaji Bersih (ditransfer)" value={idr(totals.net)} tone="good" />
            <StatCard label="BPJS Ditanggung Perusahaan" value={idr(totals.bpjsCo)} />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {isDraft && (
                <>
                  <button
                    type="button"
                    onClick={() => call('payroll_generate', { p_period: run.period }, 'Hitung ulang semua slip dari data terbaru? Penyesuaian manual (bonus, potongan) akan hilang.')}
                    disabled={busy}
                    className="btn-secondary !px-3 !py-2 text-xs"
                  >
                    <RefreshCw size={13} /> Hitung Ulang
                  </button>
                  <button type="button" onClick={removeDraft} className="btn-secondary !px-3 !py-2 text-xs">
                    <Trash2 size={13} /> Hapus Draf
                  </button>
                  {role === 'owner' ? (
                    <button
                      type="button"
                      onClick={() => call('payroll_approve', { p_run_id: run.id }, `Setujui penggajian ${monthLabel(month)} senilai ${idr(totals.net)}? Slip akan dikunci dan bisa dilihat staf.`)}
                      disabled={busy}
                      className="btn-primary !px-3 !py-2 text-xs"
                    >
                      <Lock size={13} /> Setujui
                    </button>
                  ) : (
                    <span className="self-center text-xs text-slate-500">Menunggu persetujuan Owner.</span>
                  )}
                </>
              )}
              {run.status === 'approved' && (
                <>
                  <button type="button" onClick={() => setPaying(true)} className="btn-primary !px-3 !py-2 text-xs">
                    <Banknote size={13} /> Bayar
                  </button>
                  {role === 'owner' && (
                    <button type="button" onClick={() => call('payroll_reopen', { p_run_id: run.id }, 'Buka kembali penggajian ini? Slip disembunyikan lagi dari staf dan jurnal gajinya dibatalkan.')} className="btn-secondary !px-3 !py-2 text-xs">
                      <Unlock size={13} /> Buka Kembali
                    </button>
                  )}
                </>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={exportTransfer} disabled={slips.length === 0} className="btn-secondary !px-3 !py-2 text-xs disabled:opacity-50">
                <Download size={13} /> Daftar Transfer
              </button>
              <button type="button" onClick={exportSummary} disabled={slips.length === 0} className="btn-secondary !px-3 !py-2 text-xs disabled:opacity-50">
                <Download size={13} /> Rekap CSV
              </button>
            </div>
          </div>

          <div className="mt-3 overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/5 text-slate-400">
                <tr>
                  <th className="px-4 py-3">Staf (klik untuk rincian)</th>
                  <th className="px-4 py-3 text-right">Bruto</th>
                  <th className="px-4 py-3 text-right">Potongan</th>
                  <th className="px-4 py-3 text-right">Gaji Bersih</th>
                  <th className="px-4 py-3 text-right">Slip</th>
                </tr>
              </thead>
              <tbody>
                {slips.map((s) => (
                  <SlipRow key={s.id} slip={s} editable={isDraft} brand={brand} onSaved={load} />
                ))}
                {slips.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                      Tidak ada staf yang ikut penggajian. Atur gaji staf di menu Pengaturan Gaji, lalu klik Hitung Ulang.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <AnnualRecap />

      {paying && run && (
        <PayDialog
          run={run}
          total={totals.net}
          onClose={() => setPaying(false)}
          onDone={() => {
            setPaying(false)
            load()
          }}
        />
      )}
    </div>
  )
}
