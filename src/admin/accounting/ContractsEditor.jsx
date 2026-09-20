import { useCallback, useEffect, useState } from 'react'
import { Download, FileSignature, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useContent } from '../../context/ContentContext'
import { useSupabaseTable } from './useSupabaseTable'

const STATUS_LABEL = { draft: 'Draft', sent: 'Menunggu Tanda Tangan', signed: 'Sudah Ditandatangani' }
const STATUS_COLOR = {
  draft: 'bg-slate-500/20 text-slate-300 border-slate-400/30',
  sent: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
  signed: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
}

const downloadContractPdf = (...args) => import('../../lib/pdfGenerator').then((m) => m.generateContractPdf(...args))

function NewContractForm({ clients, projects, onDone }) {
  const [form, setForm] = useState({ client_id: '', project_id: '', title: '', content: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!form.client_id || !form.title || !form.content) return
    setBusy(true)
    setError('')
    const { error: err } = await supabase.from('acc_contracts').insert({ ...form, project_id: form.project_id || null, status: 'sent' })
    setBusy(false)
    if (err) setError(err.message)
    else {
      setForm({ client_id: '', project_id: '', title: '', content: '' })
      onDone()
    }
  }

  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <select className="input-field" value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}>
          <option value="">Pilih Klien...</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.company_name}
            </option>
          ))}
        </select>
        <select className="input-field" value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>
          <option value="">Proyek Terkait (opsional)...</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.website_name || p.id.slice(0, 8)}
            </option>
          ))}
        </select>
      </div>
      <input className="input-field" placeholder="Judul Kontrak (mis. SPK Pembuatan Website)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      <textarea
        className="input-field resize-y"
        rows={8}
        placeholder="Isi kontrak/SPK lengkap..."
        value={form.content}
        onChange={(e) => setForm({ ...form, content: e.target.value })}
      />
      <button type="button" disabled={busy || !form.client_id || !form.title || !form.content} onClick={submit} className="btn-primary !py-2.5 text-xs disabled:opacity-60">
        {busy ? 'Menerbitkan...' : 'Terbitkan & Kirim ke Portal Klien'}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

export default function ContractsEditor() {
  const [contracts, setContracts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const clients = useSupabaseTable('acc_clients', { orderBy: 'company_name', ascending: true })
  const projects = useSupabaseTable('acc_projects', { orderBy: 'created_at' })
  const { content } = useContent()
  const brand = { name: content.brand?.name, address: content.contact?.address, phone: content.contact?.phone, email: content.contact?.email }

  const load = useCallback(() => {
    setLoading(true)
    supabase
      .from('acc_contracts')
      .select('*, acc_clients(company_name), acc_projects(website_name)')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setContracts(data || [])
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <FileSignature size={18} /> Kontrak/SPK Digital
          </h2>
          <p className="mt-1 text-sm text-slate-400">Klien menandatangani langsung dari Portal Klien mereka (tanda tangan elektronik).</p>
        </div>
        <button type="button" onClick={() => setShowForm((v) => !v)} className="btn-secondary !px-3 !py-2 text-xs">
          <Plus size={14} /> Buat Kontrak
        </button>
      </div>

      {showForm && (
        <div className="mt-4">
          <NewContractForm clients={clients.rows} projects={projects.rows} onDone={() => { setShowForm(false); load() }} />
        </div>
      )}

      <div className="mt-5 space-y-3">
        {loading && <p className="text-sm text-slate-400">Memuat...</p>}
        {!loading && contracts.length === 0 && <p className="text-sm text-slate-500">Belum ada kontrak dibuat.</p>}
        {contracts.map((c) => (
          <div key={c.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-white">{c.title}</p>
                <p className="text-xs text-slate-400">
                  {c.acc_clients?.company_name} {c.acc_projects?.website_name && `• ${c.acc_projects.website_name}`}
                </p>
              </div>
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${STATUS_COLOR[c.status]}`}>{STATUS_LABEL[c.status]}</span>
            </div>
            {c.status === 'signed' && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3 text-xs text-slate-400">
                <p>
                  Ditandatangani oleh <strong className="text-white">{c.signed_by_name}</strong> pada {new Date(c.signed_at).toLocaleString('id-ID')}
                </p>
                <button
                  type="button"
                  onClick={() => downloadContractPdf(c, c.acc_clients, brand)}
                  className="flex items-center gap-1.5 font-semibold text-cyan-royal hover:text-cyan-300"
                >
                  <Download size={13} /> Unduh PDF Bertanda Tangan
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
