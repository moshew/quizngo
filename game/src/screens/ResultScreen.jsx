import { t } from '../i18n'

function ResultScreen({ results, selectedAnswer, language }) {
  if (!results) {
    return (
      <div className="screen">
        <div className="spinner"></div>
        <div className="subtitle">{t(language, 'loadingResults')}</div>
      </div>
    )
  }

  const { isCorrect, answered, questionScore, cumulativeScore, rank } = results

  let icon, label, labelClass
  if (!answered) {
    icon = '⏰'
    label = t(language, 'timesUp')
    labelClass = 'timeout'
  } else if (isCorrect) {
    icon = '✅'
    label = t(language, 'correct')
    labelClass = 'correct'
  } else {
    icon = '❌'
    label = t(language, 'incorrect')
    labelClass = 'incorrect'
  }

  return (
    <div className="screen">
      <div className="result-card">
        <div className="result-icon">{icon}</div>
        <div className={`result-label ${labelClass}`}>{label}</div>

        <div className="result-score">+{questionScore || 0}</div>
        <div className="result-score-label">{t(language, 'points')}</div>

        {rank && (
          <div className="result-rank">{t(language, 'rank', { rank })}</div>
        )}

        <div className="result-cumulative">
          {t(language, 'total', { score: cumulativeScore || 0 })}
        </div>
      </div>
    </div>
  )
}

export default ResultScreen
