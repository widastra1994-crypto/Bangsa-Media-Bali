import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Calendar } from 'lucide-react'
import { useDisplayContent, useLanguage } from '../context/LanguageContext'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import FloatingAssistant from '../components/FloatingAssistant'

function formatDate(dateStr) {
  try {
    return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return dateStr
  }
}

export default function BlogListPage() {
  const { content } = useDisplayContent()
  const { lang } = useLanguage()
  const { blog } = content

  return (
    <div className="min-h-screen bg-nusatech-gradient text-slate-100">
      <Navbar />
      <main className="pb-20 pt-32 lg:pb-28 lg:pt-40">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-cyan-royal">
            <ArrowLeft size={16} /> {lang === 'en' ? 'Back to Home' : 'Kembali ke Beranda'}
          </Link>

          <div className="mx-auto max-w-2xl text-center">
            <span className="section-eyebrow">{blog.eyebrow}</span>
            <h1 className="mt-5 text-3xl font-bold text-white sm:text-4xl">{blog.title}</h1>
            <p className="mt-4 text-slate-300">{blog.description}</p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {blog.items.map((post) => (
              <Link
                key={post.id}
                to={`/blog/${post.slug}`}
                className="group overflow-hidden rounded-2xl border border-slate-800 bg-navy-900/50 transition-all duration-300 hover:-translate-y-1.5 hover:border-cyan-400/60"
              >
                {post.coverImage && (
                  <div className="h-44 overflow-hidden">
                    <img
                      src={post.coverImage}
                      alt={post.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => e.currentTarget.remove()}
                    />
                  </div>
                )}
                <div className="p-6">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <Calendar size={12} /> {formatDate(post.date)}
                  </div>
                  <h2 className="mt-3 text-base font-bold text-white transition-colors group-hover:text-cyan-300">{post.title}</h2>
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-400">{post.excerpt}</p>
                  {post.tags?.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {post.tags.map((tag) => (
                        <span key={tag} className="rounded bg-slate-800 px-2 py-1 text-[10px] text-slate-300">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-gold-soft">
                    {blog.readMoreLabel} <ArrowRight size={13} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
      <Footer />
      <FloatingAssistant />
    </div>
  )
}
