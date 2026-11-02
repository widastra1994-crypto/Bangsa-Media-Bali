import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useUserRole } from '../useUserRole'
import { exportToCsv } from '../accounting/csvExport'
import { SOURCE_LABELS, currentMonth, formatDate, idr, monthLabel, monthRange, today } from './ledgerUtils'
import { ErrorNote, MonthPicker, PageHeader } from './LedgerUI'

const MANUAL_TYPES = ['manual', 'opening', 'reversal']
const emptyLine = () => ({ account_id: '', debit: '', credit: '', memo: '' })

// Contoh cepat supaya admin tidak perlu hafal debit/kredit.
const TEMPLATES = [
  { label: 'Setoran modal pemilik', debitKey: 'cash', creditKey: 'owner_capital' },
  { label: 'Pengambilan prive', debitKey: 'owner_drawing', creditKey: 'cash' },
  { label: 'Transfer antar rekening', debitKey: 'cash', creditKey: 'cash' },
  { label: 'Pindahkan dari "Kas/Bank Belum Ditentukan"', debitKey: 'cash', creditKey: 'cash_unassigned' },
  { label: 'Setor pajak (PPh Final)', debitKey: 'pph_final_payable', creditKey: 'cash' },
]

function ManualJournalForm({ accounts, onDone, onCancel }) {
  const [entryDate, setEntryDate] = useState(today())
  const [description, setDescription] = useState('')
  const [kind, setKind] = useState('manual')
  const [lines, setLines] = useState([emptyLine(), emptyLine()])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const activeAccounts = accounts.filter((a) => a.is_active)
  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0)
  const balanced = totalDebit > 0 && Math.round(totalDebit * 100) === Math.round(totalCredit * 100)

  const setLine = (idx, patch) => setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))

  const applyTemplate = (t) => {
    const byKey = (key) => (key === 'cash' ? '' : activeAccounts.find((a) => a.system_key === key)?.id || '')
    setDescription(t.label)
    setLines([
      { ...emptyLine(), account_id: byKey(t.debitKey) },
      { ...emptyLine(), account_id: byKey(t.creditKey) },
    ])
  }

  const submit = async () => {
    setBusy(true)
    setError('')
    const payload = lines
      .filter((l) => l.account_id && (Number(l.debit) > 0 || Number(l.credit) > 0))
      .map((l) => ({ account_id: l.account_id, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, memo: l.memo }))
    const { error: err } = await supabase.rpc('gl_create_manual_journal', {
      p_date: entryDate,
      p_description: description,
      p_lines: payload,
      p_kind: kind,
    })
    setBusy(false)
    if (err) setError(err.message)
    else onDone(entryDate)
  }

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-white">Jurnal Manual</p>
        <button type="button" onClick={onCancel} className="text-slate-500 hover:text-white" aria-label="Tutup">
          <X size={16} />
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        <span className="self-center text-[11px] text-slate-500">Contoh cepat:</span>
        {TEMPLATES.map((t) => (
          <button key={t.label} type="button" onClick={() => applyTemplate(t)} className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-slate-300 hover:border-cyan-400/60 hover:text-cyan-300">
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div>
          <label className="label-field">Tanggal</label>
          <input type="date" className="input-field" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="label-field">Keterangan</label>
          <input className="input-field" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="mis. Setoran modal awal" />
        </div>
        <div>
          <label className="label-field">Jenis</label>
          <select className="input-field" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="manual">Jurnal Umum</option>
            <option value="opening">Saldo Awal</option>
          </select>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-slate-400">
            <tr>
              <th className="py-2 pr-2">Akun</th>
              <th className="w-36 py-2 pr-2">Debit</th>
              <th className="w-36 py-2 pr-2">Kredit</th>
              <th className="py-2 pr-2">Memo</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, idx) => (
              <tr key={idx}>
                <td className="py-1 pr-2">
                  <select className="input-field" value={l.account_id} onChange={(e) => setLine(idx, { account_id: e.target.value })}>
                    <option value="">Pilih akun...</option>
                    {activeAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} - {a.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-1 pr-2">
                  <input type="number" min="0" className="input-field" value={l.debit} onChange={(e) => setLine(idx, { debit: e.target.value, credit: e.target.value ? '' : l.credit })} />
                </td>
                <td className="py-1 pr-2">
                  <input type="number" min="0" className="input-field" value={l.credit} onChange={(e) => setLine(idx, { credit: e.target.value, debit: e.target.value ? '' : l.debit })} />
                </td>
                <td className="py-1 pr-2">
                  <input className="input-field" value={l.memo} onChange={(e) => setLine(idx, { memo: e.target.value })} />
                </td>
                <td className="py-1">
                  {lines.length > 2 && (
                    <button type="button" onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))} className="text-slate-500 hover:text-red-400" aria-label="Hapus baris">
                      <X size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-white/10 font-semibold text-white">
              <td className="py-2 pr-2">
                <button type="button" onClick={() => setLines((prev) => [...prev, emptyLine()])} className="flex items-center gap-1 text-[11px] font-normal text-cyan-300 hover:underline">
                  <Plus size={12} /> Tambah baris
                </button>
              </td>
              <td className="py-2 pr-2">{idr(totalDebit)}</td>
              <td className="py-2 pr-2">{idr(totalCredit)}</td>
              <td colSpan={2} className={`py-2 text-[11px] ${balanced ? 'text-emerald-400' : 'text-amber-400'}`}>
                {balanced ? 'Seimbang' : `Selisih ${idr(Math.abs(totalDebit - totalCredit))}`}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <ErrorNote message={error} />
      <div className="mt-3 flex justify-end">
        <button type="button" onClick={submit} disabled={busy || !balanced || !description.trim()} className="btn-primary !px-4 !py-2 text-xs disabled:opacity-50">
          {busy ? 'Menyimpan...' : 'Simpan Jurnal'}
        </button>
      </div>
    </div>
  )
}

export default function JournalEntries() {
  const { isOwnerOrAdmin } = useUserRole()
  const [month, setMonth] = useState(currentMonth())
  const [source, setSource] = useState('')
  const [lines, setLines] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const { from, to } = monthRange(month)
    let q = supabase.from('acc_journal_view').select('*').gte('entry_date', from).lte('entry_date', to)
    if (source) q = q.eq('source_type', source)
    const { data, error: err } = await q.order('entry_date', { ascending: true }).order('entry_no', { ascending: true }).order('line_no', { ascending: true })
    if (err) setError(err.message)
    else setLines(data || [])
    setLoading(false)
  }, [month, source])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    supabase
      .from('acc_accounts')
      .select('*')
      .order('code')
      .then(({ data }) => setAccounts(data || []))
  }, [])

  const entries = useMemo(() => {
    const map = new Map()
    for (const l of lines) {
      if (!map.has(l.entry_id)) map.set(l.entry_id, { ...l, lines: [] })
      map.get(l.entry_id).lines.push(l)
    }
    return [...map.values()]
  }, [lines])

  const reversedIds = useMemo(() => new Set(lines.filter((l) => l.reversal_of).map((l) => l.reversal_of)), [lines])

  const reverse = async (e) => {
    if (!window.confirm(`Buat jurnal pembalik untuk #${e.entry_no}? Jurnal pembalik dicatat dengan tanggal hari ini.`)) return
    const { error: err } = await supabase.rpc('gl_reverse_journal', { p_entry_id: e.entry_id, p_date: today() })
    if (err) setError(err.message)
    else load()
  }

  const remove = async (e) => {
    if (!window.confirm(`Hapus jurnal #${e.entry_no} "${e.description}"?`)) return
    const { error: err } = await supabase.rpc('gl_delete_manual_journal', { p_entry_id: e.entry_id })
    if (err) setError(err.message)
    else load()
  }

  const exportCsv = () =>
    exportToCsv(
      `jurnal-umum-${month}`,
      lines.map((l) => ({
        No: l.entry_no,
        Tanggal: l.entry_date,
        Keterangan: l.description,
        Sumber: SOURCE_LABELS[l.source_type] || l.source_type,
        Akun: `${l.account_code} ${l.account_name}`,
        Debit: Number(l.debit),
        Kredit: Number(l.credit),
        Memo: l.memo || '',
      })),
    )

  return (
    <div>
      <PageHeader
        title="Jurnal Umum"
        description="Semua jurnal per bulan. Jurnal dari invoice, pembayaran, pengeluaran, vendor, dan komisi dibuat otomatis. Jurnal manual dipakai untuk modal, prive, transfer antar rekening, setor pajak, atau koreksi."
        onExport={exportCsv}
        exportDisabled={lines.length === 0}
      >
        <MonthPicker value={month} onChange={setMonth} />
        <select className="input-field !w-44" value={source} onChange={(e) => setSource(e.target.value)} aria-label="Filter sumber">
          <option value="">Semua sumber</option>
          {Object.entries(SOURCE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        {isOwnerOrAdmin && (
          <button type="button" onClick={() => setShowForm(true)} className="btn-primary !px-3 !py-2 text-xs">
            <Plus size={14} /> Jurnal Manual
          </button>
        )}
      </PageHeader>

      {showForm && (
        <ManualJournalForm
          accounts={accounts}
          onCancel={() => setShowForm(false)}
          onDone={(date) => {
            setShowForm(false)
            if (date.slice(0, 7) !== month) setMonth(date.slice(0, 7))
            else load()
          }}
        />
      )}

      <ErrorNote message={error} />

      <p className="mt-5 text-xs text-slate-500">
        {monthLabel(month)} &bull; {entries.length} jurnal
      </p>
      <div className="mt-2 space-y-3">
        {loading && <p className="py-6 text-center text-xs text-slate-500">Memuat...</p>}
        {!loading && entries.length === 0 && <p className="rounded-2xl border border-white/10 py-8 text-center text-xs text-slate-500">Belum ada jurnal di bulan ini.</p>}
        {entries.map((e) => {
          const canManage = isOwnerOrAdmin && MANUAL_TYPES.includes(e.source_type)
          return (
            <div key={e.entry_id} className="overflow-hidden rounded-2xl border border-white/10">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-white/5 px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono text-slate-500">#{e.entry_no}</span>
                  <span className="text-slate-400">{formatDate(e.entry_date)}</span>
                  <span className="font-semibold text-white">{e.description}</span>
                  <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-[10px] text-cyan-300">{SOURCE_LABELS[e.source_type] || e.source_type}</span>
                  {reversedIds.has(e.entry_id) && <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-300">Sudah dibalik</span>}
                </div>
                {canManage && (
                  <span className="flex items-center gap-3 text-[11px]">
                    {e.source_type !== 'reversal' && !reversedIds.has(e.entry_id) && (
                      <button type="button" onClick={() => reverse(e)} className="flex items-center gap-1 text-slate-500 hover:text-amber-300">
                        <RotateCcw size={12} /> Balik
                      </button>
                    )}
                    <button type="button" onClick={() => remove(e)} className="flex items-center gap-1 text-slate-500 hover:text-red-400">
                      <Trash2 size={12} /> Hapus
                    </button>
                  </span>
                )}
              </div>
              <table className="w-full text-left text-xs">
                <tbody>
                  {e.lines.map((l) => (
                    <tr key={l.line_id} className="border-t border-white/5 text-slate-300">
                      <td className={`px-4 py-2 ${Number(l.credit) > 0 ? 'pl-10' : ''}`}>
                        <span className="font-mono text-slate-500">{l.account_code}</span> {l.account_name}
                        {l.memo && <span className="ml-2 text-[11px] text-slate-500">({l.memo})</span>}
                      </td>
                      <td className="w-36 px-4 py-2 text-right">{Number(l.debit) > 0 ? idr(l.debit) : ''}</td>
                      <td className="w-36 px-4 py-2 text-right">{Number(l.credit) > 0 ? idr(l.credit) : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })}
      </div>
    </div>
  )
}
