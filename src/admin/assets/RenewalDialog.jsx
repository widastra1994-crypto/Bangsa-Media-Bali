import { useState } from 'react'
import { CheckCircle2, X } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import ShareInvoice from './ShareInvoice'
import { assetTypeLabel, cycleLabel, formatDate, idr, renewalPrice } from './assetUtils'

const todayLocal = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Makassar' })

// Terbitkan satu invoice perpanjangan untuk satu atau beberapa aset milik
// klien yang sama, lalu langsung tampilkan tombol bagikan ke klien.
export default function RenewalDialog({ assets, onClose, onDone }) {
  const client = assets[0]?.acc_clients
  const minExpiry = assets.map((a) => a.expiry_date).filter(Boolean).sort()[0]
  const [amounts, setAmounts] = useState(() => Object.fromEntries(assets.map((a) => [a.id, renewalPrice(a)])))
  const [due, setDue] = useState(minExpiry && minExpiry > todayLocal() ? minExpiry : todayLocal())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [invoice, setInvoice] = useState(null)

  const total = assets.reduce((s, a) => s + (Number(amounts[a.id]) || 0), 0)

  const submit = async () => {
    setBusy(true)
    setError('')
    const { data: invoiceId, error: err } = await supabase.rpc('asset_create_renewal_invoice', {
      p_asset_ids: assets.map((a) => a.id),
      p_amounts: assets.map((a) => Number(amounts[a.id]) || 0),
      p_due: due,
    })
    if (err) {
      setBusy(false)
      return setError(err.message)
    }
    const { data } = await supabase.from('acc_invoices').select('*').eq('id', invoiceId).maybeSingle()
    setBusy(false)
    setInvoice(data)
    onDone()
  }

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto overscroll-contain bg-black/60 px-3 py-6 sm:p-6">
      <div className="glass-panel mx-auto my-4 w-full max-w-xl rounded-2xl p-4 sm:my-10 sm:p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">Invoice Perpanjangan</h3>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white" aria-label="Tutup">
            <X size={18} />
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-400">{client?.company_name}</p>

        {!invoice ? (
          <>
            <div className="mt-4 space-y-2">
              {assets.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">
                      {assetTypeLabel(a.asset_type)} {a.domain_name}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Habis {formatDate(a.expiry_date)} · diperpanjang {cycleLabel(a.cycle_months).toLowerCase()}
                    </p>
                    {a.acc_asset_price_items?.length > 1 && (
                      <ul className="mt-1 text-[11px] text-slate-400">
                        {[...a.acc_asset_price_items]
                          .sort((x, y) => x.sort - y.sort)
                          .map((l, i) => (
                            <li key={i}>
                              • {l.description} {idr(l.sell_price)}
                            </li>
                          ))}
                      </ul>
                    )}
                    {Number(amounts[a.id]) !== renewalPrice(a) && (
                      <p className="mt-1 text-[11px] text-amber-400">Nominal diubah: rincian digabung jadi satu baris di invoice.</p>
                    )}
                  </div>
                  <input
                    type="number"
                    min="0"
                    className="input-field !w-36 !py-1.5 text-right text-xs"
                    value={amounts[a.id]}
                    onChange={(e) => setAmounts({ ...amounts, [a.id]: e.target.value })}
                    aria-label={`Harga perpanjangan ${a.domain_name}`}
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <label className="label-field">Jatuh Tempo</label>
                <input type="date" className="input-field !w-44" value={due} onChange={(e) => setDue(e.target.value)} />
              </div>
              <p className="text-sm text-slate-300">
                Total <span className="text-lg font-bold text-white">{idr(total)}</span>
              </p>
            </div>
            {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="btn-secondary !py-2 text-xs">
                Batal
              </button>
              <button type="button" onClick={submit} disabled={busy || total <= 0} className="btn-primary !py-2 text-xs disabled:opacity-60">
                {busy ? 'Menerbitkan...' : 'Terbitkan Invoice'}
              </button>
            </div>
          </>
        ) : (
          <div className="mt-4">
            <p className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              <CheckCircle2 size={16} /> Invoice {invoice.invoice_number} ({idr(invoice.total_amount)}) diterbitkan.
            </p>
            <p className="mt-4 text-xs text-slate-400">Bagikan ke klien:</p>
            <div className="mt-2">
              <ShareInvoice invoice={invoice} client={client} />
            </div>
            <p className="mt-3 text-[11px] text-slate-500">
              Saat pembayaran dicatat di menu Invoice dan invoice Lunas, masa aktif aset maju otomatis.
            </p>
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={onClose} className="btn-primary !py-2 text-xs">
                Selesai
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
