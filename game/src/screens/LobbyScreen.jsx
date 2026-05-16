import { t } from '../i18n'

function LobbyScreen({ playerName, playerIcon, language, gameStarted, mode = 'waiting' }) {
  const isBetweenQuestions = mode === 'betweenQuestions'
  const waitingKey = isBetweenQuestions
    ? 'waitingBetweenQuestions'
    : gameStarted
      ? 'waitingNext'
      : 'waiting'
  const footerKey = isBetweenQuestions ? 'betweenQuestionsHint' : 'lookAtScreen'

  return (
    <div className="qng-screen qng-screen--waiting">
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 60,  left: 30,  width: 8,  height: 8,  borderRadius: '50%', background: 'var(--qng-primary)',   opacity: 0.9 }} />
        <div style={{ position: 'absolute', top: 140, right: 25, width: 12, height: 12, borderRadius: 3,    background: 'var(--qng-secondary)', transform: 'rotate(15deg)' }} />
        <div style={{ position: 'absolute', bottom: 100, left: 18, width: 10, height: 10,                   background: 'var(--qng-primary)',   transform: 'rotate(45deg)' }} />
        <div style={{ position: 'absolute', top: 210, left: 50,  width: 6,  height: 6,  borderRadius: '50%', background: '#fff',                  opacity: 0.5 }} />
        <div style={{ position: 'absolute', bottom: 180, right: 40, width: 14, height: 14, borderRadius: '50%', background: 'var(--qng-secondary)', opacity: 0.7 }} />
      </div>
      <div className="qng-screen-center">
        <div className="qng-lobby-avatar">{playerIcon}</div>

        <div className="qng-lobby-name">{playerName}</div>

        <div className="qng-you-are-in-pill" style={{ marginTop: 22 }}>
          <span className="qng-you-are-in-dot" />
          {t(language, 'youreIn').replace(/[!.]\s.*/, '!')}
        </div>

        <div className="qng-waiting-line">
          {t(language, waitingKey)}
          <span className="qng-dots">
            <span /><span /><span />
          </span>
        </div>
      </div>

      <div className="qng-look-at-screen">
        {t(language, footerKey)}
      </div>
    </div>
  )
}

export default LobbyScreen
