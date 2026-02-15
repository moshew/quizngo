import { t } from '../i18n'

function GameOverScreen({ results, onPlayAgain, language }) {
  return (
    <div className="screen">
      <div className="gameover-title">{t(language, 'gameOver')}</div>

      {results && (
        <>
          <div className="gameover-rank">#{results.rank || '?'}</div>
          <div className="subtitle">{t(language, 'yourFinalRank')}</div>
          <div className="gameover-score">{results.cumulativeScore || 0} {t(language, 'points')}</div>
        </>
      )}

      <button className="btn-primary" onClick={onPlayAgain} style={{ marginTop: '24px' }}>
        {t(language, 'playAgain')}
      </button>
    </div>
  )
}

export default GameOverScreen
