import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Calendar, User } from 'lucide-react'
import { useDisplayContent } from '../context/LanguageContext'
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

export default function BlogPostPage() {
  const { slug } = useParams()
  const { content } = useDisplayContent()
  const { blog } = content
  const post = blog.items.find((p) => p.slug === slug)

  if (!post) {
    return (
      <div className="min-h-screen bg-site-gradient text-slate-700">
        <Navbar />
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-5 text-center">
          <p className="text-2xl font-bold text-ink">Article not found / Artikel tidak ditemukan</p>
          <Link to="/blog" className="btn-primary">
            <ArrowLeft size={16} /> {blog.backLabel}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-site-gradient text-slate-700">
      <Navbar />
      <main className="pb-20 pt-32 lg:pb-28 lg:pt-40">
        <article className="mx-auto max-w-3xl px-5 lg:px-8">
          <Link to="/blog" className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-cyan-royal">
            <ArrowLeft size={16} /> {blog.backLabel}
          </Link>

          {post.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <span key={tag} className="rounded bg-slate-200 px-2 py-1 text-[10px] text-slate-600">
                  {tag}
                </span>
              ))}
            </div>
          )}

          <h1 className="mt-4 text-3xl font-bold text-ink sm:text-4xl">{post.title}</h1>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <User size={13} /> {post.author}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar size={13} /> {formatDate(post.date)}
            </span>
          </div>

          {post.coverImage && (
            <img
              src={post.coverImage}
              alt={post.title}
              className="mt-8 h-auto w-full rounded-2xl border border-sky-100 object-cover shadow-card"
              onError={(e) => e.currentTarget.remove()}
            />
          )}

          <div className="prose mt-8 max-w-none space-y-4 text-sm leading-relaxed text-slate-700 sm:text-base">
            {post.content.split('\n').filter(Boolean).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </article>
      </main>
      <Footer />
      <FloatingAssistant />
    </div>
  )
}
