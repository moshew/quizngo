import { useState } from 'react'
import { USER_ICONS } from '../icons'
import { t } from '../i18n'

function NameScreen({ onJoin, error, loading, language, defaultName = '', defaultIcon = USER_ICONS[0] }) {
  const [name, setName] = useState(defaultName)
  const [selectedIcon, setSelectedIcon] = useState(
    USER_ICONS.includes(defaultIcon) ? defaultIcon : USER_ICONS[0]
  )

  const handleSubmit = (e) => {
    e.preventDefault()
    if (name.trim()) {
      onJoin(name.trim(), selectedIcon)
    }
  }

  return (
    <form className="qng-screen qng-screen--idle" onSubmit={handleSubmit}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingTop: 20, gap: 14 }}>
        <div className="qng-name-title">
          {t(language, 'chooseName').split(' ').map((word, i, arr) => {
            if (i === 0) return <span key={i}>{word} </span>
            const isLast = i === arr.length - 1
            const punct = word.slice(-1)
            const hasPunct = isLast && /[?؟？]/.test(punct)
            const base = hasPunct ? word.slice(0, -1) : word
            const space = i < arr.length - 1 ? ' ' : ''
            return (
              <span key={i} className="qng-name-title-accent">
                {base}{space}{hasPunct && <span style={{ color: '#fff' }}>{punct}</span>}
              </span>
            )
          })}
        </div>
        <div className="qng-name-subtitle">{t(language, 'nameSubtitle')}</div>

        {/* Name + sidekick chip row */}
        <div className="qng-name-input-row">
          <div className="qng-name-chip">{selectedIcon}</div>
          <input
            className="qng-name-text-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 16))}
            placeholder={t(language, 'yourNickname')}
            autoFocus
          />
        </div>

        <div className="qng-sidekick-label">{t(language, 'pickSidekick')}</div>

        {/* 4×3 emoji grid */}
        <div className="qng-sidekick-grid">
          {USER_ICONS.map((icon) => (
            <button
              key={icon}
              type="button"
              className={`qng-sidekick-tile${selectedIcon === icon ? ' qng-sidekick-tile--selected' : ''}`}
              onClick={() => setSelectedIcon(icon)}
            >
              {icon}
            </button>
          ))}
        </div>

        <button
          className="qng-btn qng-btn--lime"
          type="submit"
          disabled={!name.trim() || loading}
          style={{ marginTop: 'auto' }}
        >
          {loading ? t(language, 'joining') : `${t(language, 'letsGo')} 🚀`}
        </button>
      </div>

      <div className={`qng-error-drawer${error ? ' qng-error-drawer--open' : ''}`}>
        {error}
      </div>
    </form>
  )
}

export default NameScreen
