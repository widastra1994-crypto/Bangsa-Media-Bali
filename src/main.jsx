import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import AdminApp from './admin/AdminApp.jsx'
import SetPasswordPage from './admin/SetPasswordPage.jsx'
import { initialAuthLinkType } from './lib/supabaseClient'
import PortalPage from './pages/PortalPage.jsx'
import AboutPage from './pages/AboutPage.jsx'
import PricingOverviewPage from './pages/PricingOverviewPage.jsx'
import PricingPage from './pages/PricingPage.jsx'
import PortfolioPage from './pages/PortfolioPage.jsx'
import PortfolioDetailPage from './pages/PortfolioDetailPage.jsx'
import BlogListPage from './pages/BlogListPage.jsx'
import BlogPostPage from './pages/BlogPostPage.jsx'
import { ContentProvider } from './context/ContentContext.jsx'
import { LanguageProvider } from './context/LanguageContext.jsx'

// Kalau Supabase mendaratkan link undangan/reset di halaman lain (mis. Site URL
// beranda, saat redirect URL belum di-allowlist), tetap arahkan ke form password.
function AuthLinkRedirect() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  useEffect(() => {
    if ((initialAuthLinkType === 'invite' || initialAuthLinkType === 'recovery') && pathname !== '/admin/set-password') {
      navigate('/admin/set-password', { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ContentProvider>
      <LanguageProvider>
        <BrowserRouter>
          <AuthLinkRedirect />
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/tentang" element={<AboutPage />} />
            <Route path="/paket" element={<PricingOverviewPage />} />
            <Route path="/paket/:slug" element={<PricingPage />} />
            <Route path="/portofolio" element={<PortfolioPage />} />
            <Route path="/portofolio/:slug" element={<PortfolioDetailPage />} />
            <Route path="/blog" element={<BlogListPage />} />
            <Route path="/blog/:slug" element={<BlogPostPage />} />
            <Route path="/admin" element={<AdminApp />} />
            <Route path="/admin/set-password" element={<SetPasswordPage />} />
            <Route path="/portal" element={<PortalPage />} />
          </Routes>
        </BrowserRouter>
      </LanguageProvider>
    </ContentProvider>
  </StrictMode>,
)
