import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useContent, deepMerge } from './ContentContext'
import { contentEn } from '../data/contentEn'

const LANG_KEY = 'nusatech_lang'

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try {
      return window.localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'id'
    } catch {
      return 'id'
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(LANG_KEY, lang)
    } catch {
      // Storage tidak tersedia (mis. private mode) — abaikan, tetap jalan di memori.
    }
  }, [lang])

  const toggleLang = () => setLang((prev) => (prev === 'id' ? 'en' : 'id'))

  const value = useMemo(() => ({ lang, setLang, toggleLang }), [lang])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage harus dipakai di dalam LanguageProvider')
  return ctx
}

// Dipakai komponen publik (bukan CMS admin) untuk menampilkan konten sesuai
// bahasa aktif. Konten mentah (Bahasa Indonesia, sumber kebenaran CMS) tidak
// pernah diubah — hanya di-overlay untuk tampilan saat mode EN aktif.
export function useDisplayContent() {
  const { content, updateSection, remoteLoaded } = useContent()
  const { lang } = useLanguage()
  const displayed = useMemo(() => (lang === 'en' ? deepMerge(content, contentEn) : content), [content, lang])
  return { content: displayed, updateSection, remoteLoaded }
}
