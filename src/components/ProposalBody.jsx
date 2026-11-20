import { parseBlocks, splitBold } from '../lib/proposalFormat'

function Inline({ text }) {
  return splitBold(text).map((part, i) =>
    part.bold ? (
      <strong key={i} className="font-semibold text-ink">
        {part.text}
      </strong>
    ) : (
      <span key={i}>{part.text}</span>
    ),
  )
}

// Menampilkan isi section proposal (format: ## sub judul, - poin, 1. poin).
export default function ProposalBody({ text }) {
  return (
    <div className="space-y-3 text-[15px] leading-relaxed text-slate-700">
      {parseBlocks(text).map((b, i) => {
        if (b.type === 'h') {
          return (
            <h4 key={i} className="pt-2 text-base font-bold text-ink">
              <Inline text={b.text} />
            </h4>
          )
        }
        if (b.type === 'ul') {
          return (
            <ul key={i} className="list-disc space-y-1 pl-6 marker:text-slate-400">
              {b.items.map((it, j) => (
                <li key={j}>
                  <Inline text={it} />
                </li>
              ))}
            </ul>
          )
        }
        if (b.type === 'ol') {
          return (
            <ol key={i} start={b.start} className="list-decimal space-y-2 pl-6 marker:font-semibold marker:text-ink">
              {b.items.map((it, j) => (
                <li key={j}>
                  {it.desc ? (
                    <span className="font-semibold text-ink">
                      <Inline text={it.title.replace(/\*\*/g, '')} />
                    </span>
                  ) : (
                    <Inline text={it.title} />
                  )}
                  {it.desc && (
                    <p className="text-slate-600">
                      <Inline text={it.desc} />
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )
        }
        return (
          <p key={i} className="text-justify">
            <Inline text={b.text} />
          </p>
        )
      })}
    </div>
  )
}
