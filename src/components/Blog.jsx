import { Link } from 'react-router-dom'
import { ArrowRight, Calendar } from 'lucide-react'
import { useDisplayContent } from '../context/LanguageContext'

function formatDate(dateStr) {
  try {
    return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return dateStr
  }
}

export default function Blog() {
  const { content } = useDisplayContent()
  const { blog } = content
  if (!blog?.items?.length) return null
  const latest = blog.items.slice(0, 3)

  return (
    <section id="blog-preview" className="relative border-t border-blue-900/40 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="section-eyebrow">{blog.eyebrow}</span>
          <h2 className="mt-5 text-3xl font-bold text-white sm:text-4xl">{blog.title}</h2>
          <p className="mt-4 text-slate-300">{blog.description}</p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
          {latest.map((post) => (
            <Link
              key={post.id}
              to={`/blog/${post.slug}`}
              className="group overflow-hidden rounded-2xl border border-slate-800 bg-navy-900/50 transition-all duration-300 hover:-translate-y-1.5 hover:border-cyan-400/60"
            >
              {post.coverImage && (
                <div className="relative h-44 overflow-hidden">
                  <img
                    src={post.coverImage}
                    alt={post.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    onError={(e) => e.currentTarget.remove()}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-navy-900 via-navy-900/10 to-transparent" />
                  {post.tags?.[0] && (
                    <span className="absolute left-3 top-3 rounded border border-cyan-400/30 bg-navy-950/70 px-2.5 py-1 text-[10px] font-bold text-cyan-300 backdrop-blur-sm">
                      {post.tags[0]}
                    </span>
                  )}
                </div>
              )}
              <div className="p-6">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <Calendar size={12} /> {formatDate(post.date)}
                </div>
                <h3 className="mt-3 text-base font-bold text-white transition-colors group-hover:text-cyan-300">{post.title}</h3>
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-400">{post.excerpt}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-gold-soft">
                  {blog.readMoreLabel} <ArrowRight size={13} />
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link to="/blog" className="btn-secondary inline-flex">
            {blog.viewAllLabel} <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </section>
  )
}
