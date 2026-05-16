import { t } from '../i18n'

function GameOverScreen({ results, onPlayAgain, language }) {
  const rank = results?.rank
  const score = results?.cumulativeScore || 0
  const scoreFormatted = score.toLocaleString()
  const correctAnswers = results?.correctAnswers ?? 0
  const totalQuestions = results?.totalQuestions ?? 0
  const gameOverTitle = t(language, 'gameOver').replace(/[!！¡]/g, '')
  const finalStatsLabel = t(language, 'finalStats', {
    correct: correctAnswers,
    total: totalQuestions,
  })

  return (
    <div className="qng-screen qng-screen--win">
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 60,  left: 30,  width: 8,  height: 8,  borderRadius: '50%', background: 'var(--qng-primary)',   opacity: 0.9 }} />
        <div style={{ position: 'absolute', top: 140, right: 25, width: 12, height: 12, borderRadius: 3,    background: 'var(--qng-secondary)', transform: 'rotate(15deg)' }} />
        <div style={{ position: 'absolute', bottom: 100, left: 18, width: 10, height: 10,                   background: 'var(--qng-primary)',   transform: 'rotate(45deg)' }} />
        <div style={{ position: 'absolute', top: 210, left: 50,  width: 6,  height: 6,  borderRadius: '50%', background: '#fff',                  opacity: 0.5 }} />
        <div style={{ position: 'absolute', bottom: 180, right: 40, width: 14, height: 14, borderRadius: '50%', background: 'var(--qng-secondary)', opacity: 0.7 }} />
      </div>
      <div className="qng-screen-center qng-gameover-center">
        <div className="qng-gameover-eyebrow">{gameOverTitle}</div>

        <div className="qng-rank-tile">
          <div className="qng-rank-label">Rank</div>
          <div className="qng-rank-number">#{rank || '?'}</div>
        </div>

        <div className="qng-gameover-score">{scoreFormatted} {t(language, 'points')}</div>

        <div className="qng-gameover-meta"><bdi>{finalStatsLabel}</bdi></div>

        <button
          className="qng-btn qng-btn--white"
          onClick={onPlayAgain}
          style={{ marginTop: 12, width: '85%' }}
          type="button"
        >
          {t(language, 'playAgain')} ↻
        </button>
      </div>
    </div>
  )
}

export default GameOverScreen
