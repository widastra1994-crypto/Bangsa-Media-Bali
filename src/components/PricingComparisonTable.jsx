import { Fragment } from 'react'
import { Check, Minus } from 'lucide-react'

function CellValue({ value }) {
  if (value === '✓') return <Check size={16} className="mx-auto text-cyan-royal" />
  if (value === '–' || value === '-') return <Minus size={14} className="mx-auto text-slate-400" />
  return <span className="text-slate-800">{value}</span>
}

export default function PricingComparisonTable({ category }) {
  return (
    <div className="glass-panel overflow-hidden rounded-2xl border border-sky-100">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-sky-50">
              <th className="p-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Fitur</th>
              {category.tiers.map((tier) => (
                <th key={tier.id} className="p-4 text-center">
                  <span className={`text-sm font-bold ${tier.highlight ? 'text-gold-deep' : 'text-ink'}`}>{tier.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {category.comparisonGroups.map((group) => (
              <Fragment key={group.id}>
                <tr className="border-b border-slate-200 bg-amber-50/60">
                  <td colSpan={category.tiers.length + 1} className="p-3 pl-4 text-xs font-bold uppercase tracking-wide text-gold-deep">
                    {group.title}
                  </td>
                </tr>
                {group.rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 hover:bg-sky-50">
                    <td className="p-4 text-slate-600">{row.label}</td>
                    {row.values.map((value, idx) => (
                      <td key={idx} className="p-4 text-center">
                        <CellValue value={value} />
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
