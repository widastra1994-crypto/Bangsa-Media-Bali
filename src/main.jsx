import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import AdminApp from './admin/AdminApp.jsx'
import PricingPage from './pages/PricingPage.jsx'
import { ContentProvider } from './context/ContentContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ContentProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/paket/:slug" element={<PricingPage />} />
          <Route path="/admin" element={<AdminApp />} />
        </Routes>
      </BrowserRouter>
    </ContentProvider>
  </StrictMode>,
)
