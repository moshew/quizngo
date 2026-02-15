import { t } from '../i18n'

function LobbyScreen({ playerName, playerIcon, language, gameStarted }) {
  const waitingKey = gameStarted ? 'waitingNext' : 'waiting'
  const subtitleKey = gameStarted ? 'youreInNext' : 'youreIn'

  return (
    <div className="screen">
      <div className="lobby-avatar">{playerIcon}</div>
      <div className="lobby-name">{playerName}</div>
      <div className="waiting-text">
        {t(language, waitingKey)}<span className="dots"></span>
      </div>
      <div className="subtitle" style={{ fontSize: '14px', opacity: 0.5, marginTop: '20px' }}>
        {t(language, subtitleKey)}
      </div>
    </div>
  )
}

export default LobbyScreen
