import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { translations } from './translations'
import { applyDocumentLanguage, ensureDefaultLanguage, DEFAULT_LANGUAGE } from '../lib/locale'

export type { Language } from './translations'
export { translations }

const initialLang = ensureDefaultLanguage()

i18n.use(initReactI18next).init({
  resources: {
    ar: { translation: translations.ar },
    fr: { translation: translations.fr },
    en: { translation: translations.en },
  },
  lng: initialLang,
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false },
})

i18n.on('languageChanged', (lng) => {
  localStorage.setItem('language', lng)
  applyDocumentLanguage(lng)
})

applyDocumentLanguage(i18n.language)

export default i18n
