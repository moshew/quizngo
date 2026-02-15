function ResultScreen({ results, selectedAnswer }) {
  if (!results) {
    return (
      <div className="screen">
        <div className="spinner"></div>
        <div className="subtitle">Loading results...</div>
      </div>
    )
  }

  const { isCorrect, answered, questionScore, cumulativeScore, rank } = results

  let icon, label, labelClass
  if (!answered) {
    icon = '⏰'
    label = 'Time\'s up!'
    labelClass = 'timeout'
  } else if (isCorrect) {
    icon = '✅'
    label = 'Correct!'
    labelClass = 'correct'
  } else {
    icon = '❌'
    label = 'Incorrect'
    labelClass = 'incorrect'
  }

  return (
    <div className="screen">
      <div className="result-card">
        <div className="result-icon">{icon}</div>
        <div className={`result-label ${labelClass}`}>{label}</div>

        <div className="result-score">+{questionScore || 0}</div>
        <div className="result-score-label">points</div>

        {rank && (
          <div className="result-rank">Rank #{rank}</div>
        )}

        <div className="result-cumulative">
          Total: {cumulativeScore || 0} points
        </div>
      </div>
    </div>
  )
}

export default ResultScreen
