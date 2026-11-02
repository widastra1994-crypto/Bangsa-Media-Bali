import { useEffect, useState } from 'react'
import { FileDown } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useContent } from '../../context/ContentContext'
import { idr, monthLabel } from '../ledger/ledgerUtils'
import { ErrorNote, PageHeader } from '../ledger/LedgerUI'

const downloadPayslipPdf = (...args) => import('../../lib/pdfGenerator').then((m) => m.generatePayslipPdf(...args))

export default function MyPayslips() {
  const { content } = useContent()
  const brand = { name: content.brand?.name, address: content.contact?.address, phone: content.contact?.phone, email: content.contact?.email }
  const [state, setState] = useState({ loading: true, linked: true, slips: [], loans: [] })
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      const uid = sessionData?.session?.user?.id
      if (!uid) return setState({ loading: false, linked: false, slips: [], loans: [] })
      // Owner/Admin bisa membaca semua slip, jadi selalu saring ke data staf
      // milik akun yang sedang login.
      const { data: staff, error: staffErr } = await supabase.from('acc_staff_members').select('id').eq('profile_id', uid)
      if (staffErr) return setError(staffErr.message)
      const ids = (staff || []).map((s) => s.id)
      if (ids.length === 0) return setState({ loading: false, linked: false, slips: [], loans: [] })
      const [slips, loans] = await Promise.all([
        supabase.from('acc_payslips').select('*').in('staff_id', ids).eq('is_published', true).order('period', { ascending: false }),
        supabase.from('acc_employee_loans_view').select('*').in('staff_id', ids).eq('status', 'active'),
      ])
      if (slips.error || loans.error) return setError((slips.error || loans.error).message)
      setState({ loading: false, linked: true, slips: slips.data || [], loans: loans.data || [] })
    }
    load()
  }, [])

  return (
    <div>
      <PageHeader title="Slip Gaji Saya" description="Slip gaji Anda yang sudah disetujui. Klik PDF untuk mengunduh. Data ini hanya bisa dilihat oleh Anda dan Owner/Admin." />
      <ErrorNote message={error} />
      {state.loading && !error && <p className="py-8 text-center text-xs text-slate-500">Memuat...</p>}

      {!state.loading && !state.linked && (
        <p className="mt-5 rounded-2xl border border-white/10 p-6 text-center text-xs text-slate-400">
          Akun Anda belum terhubung ke data staf. Minta Owner/Admin menghubungkannya di Kelola Pengguna (kolom "Terhubung ke Data Staf").
        </p>
      )}

      {!state.loading && state.linked && (
        <>
          {state.loans.length > 0 && (
            <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-300">
              {state.loans.map((l) => (
                <p key={l.id}>
                  Sisa kasbon: <b>{idr(l.remaining)}</b> (cicilan {idr(l.installment_amount)} per bulan)
                </p>
              ))}
            </div>
          )}

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {state.slips.map((s) => (
              <div key={s.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-slate-400">{s.slip_no}</p>
                <p className="mt-0.5 text-base font-semibold text-white">{monthLabel(s.period.slice(0, 7))}</p>
                <div className="mt-3 space-y-1 text-xs text-slate-300">
                  <p className="flex justify-between">
                    <span>Penghasilan bruto</span>
                    <span>{idr(s.gross_pay)}</span>
                  </p>
                  <p className="flex justify-between text-red-300">
                    <span>Potongan</span>
                    <span>-{idr(s.total_deductions)}</span>
                  </p>
                  <p className="flex justify-between border-t border-white/10 pt-1 text-sm font-bold text-white">
                    <span>Gaji bersih</span>
                    <span>{idr(s.net_pay)}</span>
                  </p>
                </div>
                <button type="button" onClick={() => downloadPayslipPdf(s, brand)} className="btn-secondary mt-3 w-full !py-2 text-xs">
                  <FileDown size={13} /> Unduh PDF
                </button>
              </div>
            ))}
          </div>
          {state.slips.length === 0 && <p className="mt-5 rounded-2xl border border-white/10 p-6 text-center text-xs text-slate-400">Belum ada slip gaji.</p>}
        </>
      )}
    </div>
  )
}
