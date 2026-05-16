import { t } from '../i18n'

function GameTimeoutScreen({ onBackHome, language }) {
  return (
    <div className="qng-screen qng-screen--disconnect">
      <div className="qng-screen-center">
        <div className="qng-game-timeout-icon-tile">⌛</div>
        <div className="qng-game-timeout-title">
          {t(language, 'gameStopped')}
        </div>
        <div className="qng-game-timeout-body">
          {t(language, 'gameTimeoutBody')}
        </div>
        <button
          className="qng-btn qng-btn--yellow"
          onClick={onBackHome}
          style={{ marginTop: 14, maxWidth: 320 }}
          type="button"
        >
          {t(language, 'backToHome')}
        </button>
      </div>
    </div>
  )
}

export default GameTimeoutScreen
