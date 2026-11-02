import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Lock, LockOpen } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useUserRole } from '../useUserRole'
import { currentMonth, fetchBalances, formatDate, idr, monthLabel, monthRange, shiftMonth } from './ledgerUtils'
import { ErrorNote, PageHeader } from './LedgerUI'

function CloseDialog({ month, onClose, onDone }) {
  const [check, setCheck] = useState(null)
  const [postTax, setPostTax] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const { from, to } = monthRange(month)
    Promise.all([
      fetchBalances(null, to),
      supabase.from('acc_payments').select('amount_paid').gte('payment_date', from).lte('payment_date', to),
      supabase.from('acc_tax_profile').select('pph_final_rate').eq('id', 1).maybeSingle(),
      supabase.from('acc_journal_entries').select('id', { count: 'exact', head: true }).gte('entry_date', from).lte('entry_date', to),
    ])
      .then(([bal, pays, tax, count]) => {
        const unassigned = bal.find((b) => b.system_key === 'cash_unassigned')?.closing || 0
        const totalDebit = bal.reduce((s, b) => s + (b.closing > 0 ? b.closing : 0), 0)
        const totalCredit = bal.reduce((s, b) => s + (b.closing < 0 ? -b.closing : 0), 0)
        const omzet = (pays.data || []).reduce((s, p) => s + Number(p.amount_paid), 0)
        const rate = Number(tax.data?.pph_final_rate ?? 0.5)
        setCheck({
          unassigned,
          balanced: Math.round(totalDebit * 100) === Math.round(totalCredit * 100),
          omzet,
          rate,
          tax: Math.round((omzet * rate) / 100),
          entries: count.count || 0,
        })
      })
      .catch((e) => setError(e.message))
  }, [month])

  const submit = async () => {
    setBusy(true)
    setError('')
    const { error: err } = await supabase.rpc('gl_close_period', { p_period: monthRange(month).from, p_post_pph_final: postTax })
    setBusy(false)
    if (err) setError(err.message)
    else onDone()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="glass-panel w-full max-w-lg rounded-2xl p-6">
        <h3 className="text-base font-semibold text-white">Tutup Buku {monthLabel(month)}</h3>
        <p className="mt-1 text-xs text-slate-400">Setelah ditutup, semua transaksi di bulan ini terkunci: invoice, pembayaran, pengeluaran, vendor, dan jurnal tidak bisa diubah atau dihapus. Kesalahan dikoreksi di bulan berjalan.</p>

        {!check && !error && <p className="py-6 text-center text-xs text-slate-500">Memeriksa...</p>}
        {check && (
          <div className="mt-4 space-y-2 text-xs">
            <p className={`flex items-center gap-2 ${check.balanced ? 'text-emerald-400' : 'text-red-400'}`}>
              {check.balanced ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />} Neraca saldo {check.balanced ? 'seimbang' : 'TIDAK seimbang'}
            </p>
            <p className={`flex items-center gap-2 ${check.unassigned ? 'text-amber-400' : 'text-emerald-400'}`}>
              {check.unassigned ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
              {check.unassigned ? `Masih ada ${idr(Math.abs(check.unassigned))} di "Kas/Bank Belum Ditentukan". Sebaiknya dipindahkan dulu lewat Jurnal Umum.` : 'Semua transaksi kas sudah punya rekening'}
            </p>
            <p className="flex items-center gap-2 text-slate-300">
              <CheckCircle2 size={14} className="text-slate-500" /> {check.entries} jurnal di bulan ini
            </p>
            <label className="mt-3 flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-slate-300">
              <input type="checkbox" checked={postTax} onChange={(e) => setPostTax(e.target.checked)} className="mt-0.5 h-4 w-4 accent-gold" />
              <span>
                Catat utang <b>PPh Final {check.rate}%</b> dari kas masuk klien {idr(check.omzet)} = <b>{idr(check.tax)}</b>.
                <span className="block text-[11px] text-slate-500">Hilangkan centang kalau usaha Anda tidak memakai PPh Final UMKM, atau sudah dicatat manual.</span>
              </span>
            </label>
          </div>
        )}

        <ErrorNote message={error} />
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary !px-4 !py-2 text-xs">
            Batal
          </button>
          <button type="button" onClick={submit} disabled={busy || !check} className="btn-primary !px-4 !py-2 text-xs disabled:opacity-50">
            <Lock size={13} /> {busy ? 'Menutup...' : 'Tutup Buku'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PeriodClosing() {
  const { role, isOwnerOrAdmin } = useUserRole()
  const [closings, setClosings] = useState([])
  const [counts, setCounts] = useState({})
  const [error, setError] = useState('')
  const [closing, setClosing] = useState(null)
  const months = Array.from({ length: 12 }, (_, i) => shiftMonth(currentMonth(), -i))

  const load = useCallback(async () => {
    const from = monthRange(months[months.length - 1]).from
    const [c, e] = await Promise.all([
      supabase.from('acc_period_closings').select('*, profiles(name)'),
      supabase.from('acc_journal_entries').select('entry_date').gte('entry_date', from),
    ])
    if (c.error || e.error) {
      setError((c.error || e.error).message)
      return
    }
    setClosings(c.data || [])
    setCounts(
      (e.data || []).reduce((m, r) => {
        const k = r.entry_date.slice(0, 7)
        m[k] = (m[k] || 0) + 1
        return m
      }, {}),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const reopen = async (month) => {
    if (!window.confirm(`Buka kembali periode ${monthLabel(month)}? Transaksinya bisa diubah lagi. Jurnal PPh Final yang sudah dicatat tetap ada.`)) return
    const { error: err } = await supabase.rpc('gl_reopen_period', { p_period: monthRange(month).from })
    if (err) setError(err.message)
    else load()
  }

  return (
    <div>
      <PageHeader
        title="Tutup Buku"
        description="Kunci pembukuan bulan yang sudah selesai supaya angkanya tidak berubah lagi. Lakukan setiap awal bulan untuk bulan sebelumnya, setelah semua transaksi dan rekonsiliasi bank beres."
      />
      <ErrorNote message={error} />

      <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-left text-xs">
          <thead className="bg-white/5 text-slate-400">
            <tr>
              <th className="px-4 py-3">Periode</th>
              <th className="px-4 py-3">Jurnal</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => {
              const c = closings.find((x) => x.period.slice(0, 7) === m)
              const isCurrent = m === currentMonth()
              return (
                <tr key={m} className="border-t border-white/5 text-slate-300">
                  <td className="px-4 py-3 font-medium text-white">{monthLabel(m)}</td>
                  <td className="px-4 py-3">{counts[m] || 0}</td>
                  <td className="px-4 py-3">
                    {c ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-300">
                        <Lock size={11} /> Ditutup {formatDate(c.closed_at.slice(0, 10))}
                        {c.profiles?.name ? ` oleh ${c.profiles.name}` : ''}
                      </span>
                    ) : isCurrent ? (
                      <span className="text-slate-500">Bulan berjalan</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-300">
                        <LockOpen size={11} /> Terbuka
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!c && !isCurrent && isOwnerOrAdmin && (
                      <button type="button" onClick={() => setClosing(m)} className="btn-primary !px-3 !py-1.5 text-[11px]">
                        <Lock size={12} /> Tutup Buku
                      </button>
                    )}
                    {c && role === 'owner' && (
                      <button type="button" onClick={() => reopen(m)} className="text-[11px] text-slate-500 hover:text-amber-300">
                        Buka kembali
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {closing && (
        <CloseDialog
          month={closing}
          onClose={() => setClosing(null)}
          onDone={() => {
            setClosing(null)
            load()
          }}
        />
      )}
    </div>
  )
}
