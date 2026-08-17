import { useTranslation } from 'react-i18next'

interface Props {
  compact?: boolean
}

export default function LanguageSwitcher({ compact }: Props) {
  const { i18n } = useTranslation()

  const languages = [
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  ]

  const changeLanguage = (code: string) => {
    i18n.changeLanguage(code)
  }

  const current = languages.find(l => l.code === i18n.language) || languages[0]

  if (compact) {
    return (
      <select
        value={i18n.language}
        onChange={(e) => changeLanguage(e.target.value)}
        className="text-xs bg-transparent border border-gray-200 rounded-lg px-2 py-1 text-gray-600 cursor-pointer focus:outline-none focus:border-emerald-500"
      >
        {languages.map(l => (
          <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
        ))}
      </select>
    )
  }

  return (
    <div className="flex gap-2">
      {languages.map(l => (
        <button
          key={l.code}
          onClick={() => changeLanguage(l.code)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            i18n.language === l.code
              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
              : 'text-gray-500 hover:bg-gray-100 border border-transparent'
          }`}
        >
          {l.flag} {l.label}
        </button>
      ))}
    </div>
  )
}
