import { ChevronLeft, ChevronRight, Download, Printer } from 'lucide-react'
import { monthLabel, shiftMonth } from './ledgerUtils'

export function PageHeader({ title, description, onExport, exportDisabled, printable, children }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
      <div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {description && <p className="mt-1 max-w-2xl text-sm text-slate-400">{description}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        {printable && (
          <button type="button" onClick={() => window.print()} className="btn-secondary !px-3 !py-2 text-xs">
            <Printer size={14} /> Cetak / PDF
          </button>
        )}
        {onExport && (
          <button type="button" onClick={onExport} disabled={exportDisabled} className="btn-secondary !px-3 !py-2 text-xs disabled:opacity-50">
            <Download size={14} /> Ekspor CSV
          </button>
        )}
      </div>
    </div>
  )
}

export function MonthPicker({ value, onChange }) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => onChange(shiftMonth(value, -1))} className="btn-secondary !px-2 !py-2" aria-label="Bulan sebelumnya">
        <ChevronLeft size={14} />
      </button>
      <input type="month" value={value} onChange={(e) => e.target.value && onChange(e.target.value)} className="input-field !w-40" aria-label="Pilih bulan" />
      <button type="button" onClick={() => onChange(shiftMonth(value, 1))} className="btn-secondary !px-2 !py-2" aria-label="Bulan berikutnya">
        <ChevronRight size={14} />
      </button>
    </div>
  )
}

export function StatCard({ label, value, tone = 'default', hint }) {
  const tones = {
    default: 'border-white/10 bg-white/5 text-white',
    good: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    bad: 'border-red-500/30 bg-red-500/10 text-red-300',
    warn: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  }
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>}
    </div>
  )
}

export function ErrorNote({ message }) {
  if (!message) return null
  return <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{message}</p>
}

export function PrintTitle({ title, period }) {
  return (
    <div className="mb-4 hidden text-center print:block">
      <p className="text-base font-bold">Bangsa Media Bali</p>
      <p className="text-sm font-semibold">{title}</p>
      {period && <p className="text-xs">{period}</p>}
    </div>
  )
}

export const periodText = (ym) => `Periode ${monthLabel(ym)}`
