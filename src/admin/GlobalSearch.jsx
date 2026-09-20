import { useEffect, useRef, useState } from 'react'
import { FolderOpen, Receipt, Search, User, X } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

// Pencarian cepat lintas Klien/Proyek/Invoice supaya tidak perlu buka tab
// satu-satu untuk menemukan sesuatu di antara puluhan menu akunting.
export default function GlobalSearch({ onNavigate }) {
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const [results, setResults] = useState({ clients: [], projects: [], invoices: [] })
  const [loading, setLoading] = useState(false)
  const boxRef = useRef(null)

  useEffect(() => {
    const onClickOutside = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  useEffect(() => {
    if (!term.trim() || term.trim().length < 2) {
      setResults({ clients: [], projects: [], invoices: [] })
      return
    }
    setLoading(true)
    const timeout = setTimeout(async () => {
      const q = `%${term.trim()}%`
      const [clients, projects, invoices] = await Promise.all([
        supabase.from('acc_clients').select('id, company_name, email').ilike('company_name', q).limit(5),
        supabase.from('acc_projects').select('id, website_name, acc_clients(company_name)').ilike('website_name', q).limit(5),
        supabase.from('acc_invoices').select('id, invoice_number, total_amount, acc_clients(company_name)').ilike('invoice_number', q).limit(5),
      ])
      setResults({ clients: clients.data || [], projects: projects.data || [], invoices: invoices.data || [] })
      setLoading(false)
    }, 300)
    return () => clearTimeout(timeout)
  }, [term])

  const hasResults = results.clients.length + results.projects.length + results.invoices.length > 0

  const go = (tabId) => {
    onNavigate(tabId)
    setOpen(false)
    setTerm('')
  }

  return (
    <div ref={boxRef} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className="btn-secondary !px-3 !py-2 text-xs" aria-label="Cari">
        <Search size={14} /> <span className="hidden sm:inline">Cari</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-white/10 bg-navy-950 p-3 shadow-2xl sm:w-96">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              autoFocus
              type="text"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Cari klien, proyek, atau nomor invoice..."
              className="input-field pl-9 pr-8"
            />
            {term && (
              <button type="button" onClick={() => setTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                <X size={14} />
              </button>
            )}
          </div>

          <div className="mt-2 max-h-80 overflow-y-auto">
            {loading && <p className="px-2 py-3 text-xs text-slate-500">Mencari...</p>}
            {!loading && term.trim().length >= 2 && !hasResults && <p className="px-2 py-3 text-xs text-slate-500">Tidak ada hasil.</p>}

            {results.clients.length > 0 && (
              <div className="mb-2">
                <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Klien</p>
                {results.clients.map((c) => (
                  <button key={c.id} type="button" onClick={() => go('acc-master')} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs hover:bg-white/5">
                    <User size={14} className="shrink-0 text-cyan-royal" />
                    <span>
                      <span className="block font-semibold text-white">{c.company_name}</span>
                      <span className="text-slate-500">{c.email}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}

            {results.projects.length > 0 && (
              <div className="mb-2">
                <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Proyek</p>
                {results.projects.map((p) => (
                  <button key={p.id} type="button" onClick={() => go('acc-projects')} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs hover:bg-white/5">
                    <FolderOpen size={14} className="shrink-0 text-gold-soft" />
                    <span>
                      <span className="block font-semibold text-white">{p.website_name}</span>
                      <span className="text-slate-500">{p.acc_clients?.company_name}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}

            {results.invoices.length > 0 && (
              <div>
                <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Invoice</p>
                {results.invoices.map((inv) => (
                  <button key={inv.id} type="button" onClick={() => go('acc-invoices')} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs hover:bg-white/5">
                    <Receipt size={14} className="shrink-0 text-emerald-400" />
                    <span>
                      <span className="block font-semibold text-white">{inv.invoice_number}</span>
                      <span className="text-slate-500">{inv.acc_clients?.company_name}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
