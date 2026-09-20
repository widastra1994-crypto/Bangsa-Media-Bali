import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Upload } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useSupabaseTable } from './useSupabaseTable'
import { logAudit } from './auditLog'

const idr = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0)

// Parser CSV mutasi bank yang cukup fleksibel: mendeteksi kolom tanggal,
// keterangan, dan nominal berdasarkan nama header (Indonesia/Inggris), lalu
// mendukung baik satu kolom nominal bertanda (+/-) maupun kolom debit/kredit
// terpisah (format umum ekspor internet banking).
function parseBankCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) return { rows: [], error: 'File CSV kosong atau tidak punya baris data.' }

  const splitLine = (line) => line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
  const header = splitLine(lines[0]).map((h) => h.toLowerCase())

  const findCol = (...keywords) => header.findIndex((h) => keywords.some((k) => h.includes(k)))
  const dateIdx = findCol('tanggal', 'date')
  const descIdx = findCol('keterangan', 'uraian', 'description', 'remark')
  const amountIdx = findCol('jumlah', 'amount', 'nominal')
  const debitIdx = findCol('debit', 'keluar')
  const creditIdx = findCol('kredit', 'credit', 'masuk')

  if (dateIdx === -1 || (amountIdx === -1 && debitIdx === -1 && creditIdx === -1)) {
    return { rows: [], error: 'Kolom tanggal/nominal tidak terdeteksi. Pastikan CSV punya header (mis. Tanggal, Keterangan, Debit, Kredit).' }
  }

  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i])
    if (cols.length < 2) continue
    const rawDate = cols[dateIdx]
    let mutationDate = rawDate
    // Coba normalisasi format DD/MM/YYYY atau DD-MM-YYYY -> YYYY-MM-DD
    const dmy = rawDate.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
    if (dmy) mutationDate = `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`

    let amount = 0
    let direction = 'in'
    if (amountIdx !== -1) {
      const raw = Number(String(cols[amountIdx]).replace(/[^0-9.-]/g, ''))
      amount = Math.abs(raw)
      direction = raw < 0 ? 'out' : 'in'
    } else {
      const debit = Number(String(cols[debitIdx] || 0).replace(/[^0-9.-]/g, '')) || 0
      const credit = Number(String(cols[creditIdx] || 0).replace(/[^0-9.-]/g, '')) || 0
      if (credit > 0) {
        amount = credit
        direction = 'in'
      } else {
        amount = debit
        direction = 'out'
      }
    }
    if (!mutationDate || !amount) continue
    rows.push({ mutation_date: mutationDate, description: descIdx !== -1 ? cols[descIdx] : '', amount, direction })
  }
  return { rows, error: rows.length === 0 ? 'Tidak ada baris valid yang bisa diimpor.' : '' }
}

export default function BankReconciliation() {
  const bankAccounts = useSupabaseTable('acc_bank_accounts', { orderBy: 'account_name', ascending: true })
  const [mutations, setMutations] = useState([])
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedBankAccount, setSelectedBankAccount] = useState('')
  const [parseError, setParseError] = useState('')
  const [importing, setImporting] = useState(false)
  const [notice, setNotice] = useState('')
  const fileRef = useRef(null)

  const loadMutations = useCallback(() => {
    setLoading(true)
    Promise.all([
      supabase.from('acc_bank_mutations').select('*, acc_bank_accounts(account_name)').eq('is_matched', false).order('mutation_date', { ascending: false }),
      supabase.from('acc_invoices').select('*, acc_clients(company_name, email)').in('status', ['sent', 'partial', 'overdue']),
    ]).then(([mut, inv]) => {
      setMutations(mut.data || [])
      setInvoices(inv.data || [])
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    loadMutations()
  }, [loadMutations])

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !selectedBankAccount) {
      setParseError('Pilih akun bank tujuan dulu sebelum unggah file.')
      return
    }
    setParseError('')
    const text = await file.text()
    const { rows, error } = parseBankCsv(text)
    if (error) {
      setParseError(error)
      return
    }
    setImporting(true)
    const { error: insertErr } = await supabase.from('acc_bank_mutations').insert(
      rows.map((r) => ({ ...r, bank_account_id: selectedBankAccount })),
    )
    setImporting(false)
    if (insertErr) setParseError(insertErr.message)
    else {
      setNotice(`${rows.length} baris mutasi berhasil diimpor.`)
      loadMutations()
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  const findSuggestedMatch = (mutation) => {
    if (mutation.direction !== 'in') return null
    return invoices.find((inv) => Math.abs(Number(inv.total_amount) - Number(inv.paid_amount) - Number(mutation.amount)) < 1)
  }

  const confirmMatch = async (mutation, invoice) => {
    setNotice('')
    const { data: payRows, error: payErr } = await supabase
      .from('acc_payments')
      .insert({
        invoice_id: invoice.id,
        payment_date: mutation.mutation_date,
        amount_paid: mutation.amount,
        payment_method: 'direct_mutasi',
        bank_account_id: mutation.bank_account_id,
      })
      .select()
    if (payErr) {
      setParseError(payErr.message)
      return
    }
    await supabase.from('acc_bank_mutations').update({ is_matched: true, matched_payment_id: payRows[0].id }).eq('id', mutation.id)
    logAudit('bank_mutation_matched', 'acc_invoices', invoice.id, { newValues: { invoice_number: invoice.invoice_number, amount: mutation.amount } })
    setNotice(`Mutasi ${idr(mutation.amount)} berhasil dicocokkan ke invoice ${invoice.invoice_number}.`)
    loadMutations()
  }

  const ignoreMutation = async (id) => {
    await supabase.from('acc_bank_mutations').update({ is_matched: true }).eq('id', id)
    loadMutations()
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-white">Rekonsiliasi Mutasi Bank</h2>
      <p className="mt-1 text-sm text-slate-400">
        Ekspor mutasi dari internet banking Anda ke CSV, lalu impor di sini. Sistem otomatis mencocokkan nominal dengan invoice yang belum lunas.
      </p>

      <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <select className="input-field" value={selectedBankAccount} onChange={(e) => setSelectedBankAccount(e.target.value)}>
            <option value="">Pilih Akun Bank Tujuan...</option>
            {bankAccounts.rows.map((b) => (
              <option key={b.id} value={b.id}>
                {b.account_name}
              </option>
            ))}
          </select>
          <label className="btn-secondary cursor-pointer justify-center !py-2.5 text-xs">
            <Upload size={14} /> {importing ? 'Mengimpor...' : 'Unggah File CSV Mutasi'}
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" disabled={importing} />
          </label>
        </div>
        {parseError && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
            <AlertTriangle size={13} /> {parseError}
          </p>
        )}
        {notice && <p className="mt-2 text-xs text-emerald-400">{notice}</p>}
        <p className="mt-2 text-[11px] text-slate-500">
          Format CSV: baris pertama header, kolom Tanggal + Keterangan + (Jumlah bertanda, atau kolom Debit & Kredit terpisah).
        </p>
      </div>

      <h3 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-gold-soft">Mutasi Belum Dicocokkan</h3>
      <div className="space-y-3">
        {loading && <p className="text-sm text-slate-400">Memuat...</p>}
        {!loading && mutations.length === 0 && <p className="text-sm text-slate-500">Tidak ada mutasi menunggu pencocokan.</p>}
        {mutations.map((m) => {
          const suggestion = findSuggestedMatch(m)
          return (
            <div key={m.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-white">
                    {m.mutation_date} &bull; {m.description || '(tanpa keterangan)'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {m.acc_bank_accounts?.account_name} &bull; {m.direction === 'in' ? 'Uang Masuk' : 'Uang Keluar'}
                  </p>
                </div>
                <p className={`text-lg font-bold ${m.direction === 'in' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {m.direction === 'in' ? '+' : '-'}
                  {idr(m.amount)}
                </p>
              </div>

              {suggestion ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                  <p className="flex items-center gap-1.5 text-xs text-emerald-300">
                    <CheckCircle2 size={14} /> Cocok dengan Invoice <strong>{suggestion.invoice_number}</strong> ({suggestion.acc_clients?.company_name})
                  </p>
                  <button type="button" onClick={() => confirmMatch(m, suggestion)} className="btn-primary !px-3 !py-1.5 text-xs">
                    Konfirmasi & Catat Pembayaran
                  </button>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <select
                    className="input-field flex-1"
                    onChange={(e) => {
                      const inv = invoices.find((i) => i.id === e.target.value)
                      if (inv) confirmMatch(m, inv)
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Cocokkan manual ke invoice...
                    </option>
                    {invoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoice_number} - {inv.acc_clients?.company_name} (sisa {idr(Number(inv.total_amount) - Number(inv.paid_amount))})
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => ignoreMutation(m.id)} className="btn-secondary !px-3 !py-1.5 text-xs">
                    Abaikan
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
