import { Fragment } from 'react'
import { Check, Minus } from 'lucide-react'

function CellValue({ value }) {
  if (value === '✓') return <Check size={16} className="mx-auto text-cyan-royal" />
  if (value === '–' || value === '-') return <Minus size={14} className="mx-auto text-slate-600" />
  return <span className="text-slate-200">{value}</span>
}

export default function PricingComparisonTable({ category }) {
  return (
    <div className="glass-panel overflow-hidden rounded-2xl border border-white/10">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-navy-900/60">
              <th className="p-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Fitur</th>
              {category.tiers.map((tier) => (
                <th key={tier.id} className="p-4 text-center">
                  <span className={`text-sm font-bold ${tier.highlight ? 'text-gold-soft' : 'text-white'}`}>{tier.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {category.comparisonGroups.map((group) => (
              <Fragment key={group.id}>
                <tr className="border-b border-white/10 bg-white/5">
                  <td colSpan={category.tiers.length + 1} className="p-3 pl-4 text-xs font-bold uppercase tracking-wide text-gold-soft">
                    {group.title}
                  </td>
                </tr>
                {group.rows.map((row) => (
                  <tr key={row.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                    <td className="p-4 text-slate-300">{row.label}</td>
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
