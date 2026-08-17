import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { Language } from './translations'
import { DEFAULT_LANGUAGE, applyDocumentLanguage, ensureDefaultLanguage } from '../lib/locale'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  dir: 'rtl' | 'ltr'
}

const LanguageContext = createContext<LanguageContextType>({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {},
  dir: 'ltr',
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    return (ensureDefaultLanguage() as Language) || DEFAULT_LANGUAGE
  })

  useEffect(() => {
    localStorage.setItem('language', language)
    applyDocumentLanguage(language)
  }, [language])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
  }

  const dir = language === 'ar' ? 'rtl' : 'ltr'

  return (
    <LanguageContext.Provider value={{ language, setLanguage, dir }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used within LanguageProvider')
  return context
}
