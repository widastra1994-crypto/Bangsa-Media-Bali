import { useEffect, useMemo, useState } from 'react'
import { Lock, Pencil, Plus, X } from 'lucide-react'
import { useSupabaseTable } from '../accounting/useSupabaseTable'
import { useUserRole } from '../useUserRole'
import { ACCOUNT_TYPES, accountTypeLabel, fetchBalances, idr, normalBalance, today } from './ledgerUtils'
import { ErrorNote, PageHeader } from './LedgerUI'
import { exportToCsv } from '../accounting/csvExport'

const emptyForm = { code: '', name: '', account_type: 'expense', notes: '' }

export default function ChartOfAccounts() {
  const accounts = useSupabaseTable('acc_accounts', { orderBy: 'code', ascending: true })
  const { isOwnerOrAdmin } = useUserRole()
  const [balances, setBalances] = useState({})
  const [form, setForm] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchBalances(null, today())
      .then((rows) => setBalances(Object.fromEntries(rows.map((r) => [r.account_id, r]))))
      .catch((e) => setError(e.message))
  }, [accounts.rows])

  const grouped = useMemo(
    () => ACCOUNT_TYPES.map((t) => ({ ...t, rows: accounts.rows.filter((a) => a.account_type === t.value) })),
    [accounts.rows],
  )

  const startAdd = () => {
    setEditingId(null)
    setForm(emptyForm)
  }
  const startEdit = (a) => {
    setEditingId(a.id)
    setForm({ code: a.code, name: a.name, account_type: a.account_type, notes: a.notes || '' })
  }

  const save = async () => {
    setBusy(true)
    setError('')
    try {
      const values = { code: form.code.trim(), name: form.name.trim(), account_type: form.account_type, notes: form.notes || null }
      if (!values.code || !values.name) throw new Error('Kode dan nama akun wajib diisi.')
      if (editingId) await accounts.update(editingId, values)
      else await accounts.insert(values)
      setForm(null)
      setEditingId(null)
    } catch (e) {
      setError(e.message.includes('duplicate') ? 'Kode akun sudah dipakai.' : e.message)
    }
    setBusy(false)
  }

  const toggleActive = async (a) => {
    setError('')
    try {
      await accounts.update(a.id, { is_active: !a.is_active })
    } catch (e) {
      setError(e.message)
    }
  }

  const exportCsv = () =>
    exportToCsv(
      'bagan-akun',
      accounts.rows.map((a) => ({
        Kode: a.code,
        Nama: a.name,
        Jenis: accountTypeLabel(a.account_type),
        Saldo: normalBalance(a.account_type, balances[a.id]?.closing),
        Aktif: a.is_active ? 'Ya' : 'Tidak',
      })),
    )

  return (
    <div>
      <PageHeader
        title="Bagan Akun"
        description="Daftar akun yang dipakai Buku Besar. Akun bertanda gembok dipakai jurnal otomatis: kode dan namanya boleh diganti, tapi tidak bisa dihapus. Akun kas/bank dibuat otomatis dari Master Data > Kas & Bank."
        onExport={exportCsv}
        exportDisabled={accounts.rows.length === 0}
      >
        {isOwnerOrAdmin && (
          <button type="button" onClick={startAdd} className="btn-primary !px-3 !py-2 text-xs">
            <Plus size={14} /> Tambah Akun
          </button>
        )}
      </PageHeader>

      <ErrorNote message={error || accounts.error} />

      {form && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-white">{editingId ? 'Ubah Akun' : 'Akun Baru'}</p>
            <button type="button" onClick={() => setForm(null)} className="text-slate-500 hover:text-white" aria-label="Tutup">
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div>
              <label className="label-field">Kode</label>
              <input className="input-field" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="mis. 6310" />
            </div>
            <div className="sm:col-span-2">
              <label className="label-field">Nama Akun</label>
              <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="mis. Beban Listrik & Internet" />
            </div>
            <div>
              <label className="label-field">Jenis</label>
              <select className="input-field" value={form.account_type} onChange={(e) => setForm({ ...form, account_type: e.target.value })}>
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-4">
              <label className="label-field">Catatan (opsional)</label>
              <input className="input-field" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button type="button" onClick={save} disabled={busy} className="btn-primary !px-4 !py-2 text-xs disabled:opacity-60">
              {busy ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>
      )}

      <div className="mt-5 space-y-5">
        {grouped.map((g) => (
          <div key={g.value} className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/5 text-slate-400">
                <tr>
                  <th className="w-20 px-4 py-3">Kode</th>
                  <th className="px-4 py-3">{g.label}</th>
                  <th className="px-4 py-3 text-right">Saldo Saat Ini</th>
                  <th className="w-28 px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {accounts.loading && (
                  <tr>
                    <td colSpan={4} className="px-4 py-4 text-center text-slate-500">
                      Memuat...
                    </td>
                  </tr>
                )}
                {g.rows.map((a) => {
                  const bal = normalBalance(a.account_type, balances[a.id]?.closing)
                  const locked = Boolean(a.system_key || a.bank_account_id)
                  return (
                    <tr key={a.id} className={`border-t border-white/5 text-slate-300 ${a.is_active ? '' : 'opacity-50'}`}>
                      <td className="px-4 py-2.5 font-mono">{a.code}</td>
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-1.5 font-medium text-white">
                          {locked && <Lock size={11} className="text-slate-500" />}
                          {a.name}
                          {a.is_cash && <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-[10px] text-cyan-300">Kas/Bank</span>}
                          {!a.is_active && <span className="text-[10px] text-slate-500">(nonaktif)</span>}
                        </span>
                        {a.notes && <span className="text-[11px] text-slate-500">{a.notes}</span>}
                      </td>
                      <td className={`px-4 py-2.5 text-right font-semibold ${bal < 0 ? 'text-red-400' : ''}`}>{idr(bal)}</td>
                      <td className="px-4 py-2.5 text-right">
                        {isOwnerOrAdmin && (
                          <span className="inline-flex items-center gap-2">
                            <button type="button" onClick={() => startEdit(a)} className="text-slate-500 hover:text-cyan-300" title="Ubah">
                              <Pencil size={13} />
                            </button>
                            {!locked && (
                              <button type="button" onClick={() => toggleActive(a)} className="text-[11px] text-slate-500 hover:text-white">
                                {a.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                              </button>
                            )}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {!accounts.loading && g.rows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-4 text-center text-slate-500">
                      Belum ada akun.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  )
}
