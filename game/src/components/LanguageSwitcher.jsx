import { useState, useRef, useEffect } from 'react'
import { LANGUAGES, t } from '../i18n'

const GlobeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <ellipse cx="12" cy="12" rx="4" ry="10" />
    <path d="M2 12h20" />
  </svg>
)

function LanguageSwitcher({ language, setLanguage }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (code) => {
    setLanguage(code)
    setOpen(false)
  }

  const currentLang = LANGUAGES[language]

  return (
    <div className="lang-switcher-wrapper" ref={ref}>
      <button
        className="lang-switcher-btn"
        onClick={() => setOpen(!open)}
        title={t(language, 'changeLanguage')}
        type="button"
      >
        <GlobeIcon />
        <span className="lang-switcher-code">{language.toUpperCase()}</span>
      </button>

      {open && (
        <div className="lang-dropdown">
          {Object.entries(LANGUAGES).map(([code, config]) => (
            <button
              key={code}
              className={`lang-option ${code === language ? 'active' : ''}`}
              onClick={() => handleSelect(code)}
              type="button"
            >
              <span className="lang-option-code">{code.toUpperCase()}</span>
              <span className="lang-name">{config.nativeName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default LanguageSwitcher
