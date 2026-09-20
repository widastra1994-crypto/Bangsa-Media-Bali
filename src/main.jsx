import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import AdminApp from './admin/AdminApp.jsx'
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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ContentProvider>
      <LanguageProvider>
        <BrowserRouter>
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
            <Route path="/portal" element={<PortalPage />} />
          </Routes>
        </BrowserRouter>
      </LanguageProvider>
    </ContentProvider>
  </StrictMode>,
)
