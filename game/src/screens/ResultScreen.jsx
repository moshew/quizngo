import { t } from '../i18n'

const ANS_COLORS = {
  1: { color: '#e74c3c', label: '▲' },
  2: { color: '#3498db', label: '◆' },
  3: { color: '#f1c40f', label: '●' },
  4: { color: '#2ecc71', label: '■' },
}

function CorrectAnswerHint({ answer, language }) {
  const correctAns = ANS_COLORS[answer]

  if (!correctAns) {
    return null
  }

  return (
    <div className="qng-correct-answer-hint">
      {t(language, 'rightAnswerWas')}{' '}
      <span
        className="qng-correct-answer-badge"
        style={{ color: correctAns.color }}
      >
        {correctAns.label}
      </span>
    </div>
  )
}

function ResultShapes() {
  return (
    <div className="qng-result-shapes" aria-hidden="true">
      <span className="qng-result-shape qng-result-shape--one" />
      <span className="qng-result-shape qng-result-shape--two" />
      <span className="qng-result-shape qng-result-shape--three" />
      <span className="qng-result-shape qng-result-shape--four" />
      <span className="qng-result-shape qng-result-shape--five" />
      <span className="qng-result-shape qng-result-shape--six" />
      <span className="qng-result-shape qng-result-shape--seven" />
      <span className="qng-result-shape qng-result-shape--eight" />
    </div>
  )
}

function ResultScreen({ results, language }) {
  if (!results) {
    return (
      <div className="qng-screen qng-screen--waiting">
        <div className="qng-screen-center">
          <div className="qng-spinner" />
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>{t(language, 'loadingResults')}</div>
        </div>
      </div>
    )
  }

  const { isCorrect, answered, questionScore, cumulativeScore, rank, streakCount, correctAnswer } = results
  const totalFormatted = (cumulativeScore || 0).toLocaleString()
  const scoreFormatted = (questionScore || 0).toLocaleString()
  const isRtl = language === 'he' || language === 'ar'
  const timeoutRankLabel = language === 'he'
    ? (
      <>
        מקום <bdi dir="ltr">#{rank}</bdi>
      </>
    )
    : language === 'ar'
      ? (
        <>
          المرتبة <bdi dir="ltr">#{rank}</bdi>
        </>
      )
      : t(language, 'rank', { rank })

  // ── TIMEOUT ──
  if (!answered) {
    return (
      <div className="qng-screen qng-screen--timeout">
        <div className="qng-screen-frame qng-screen-frame--result">
          <ResultShapes />
          <div className="qng-screen-center">
            <div className="qng-result-feedback-heading qng-result-feedback-heading--timeout">
              <div className="qng-result-icon-tile qng-result-icon-tile--timeout" style={{ transform: 'rotate(-3deg)' }}>
                ⏰
              </div>

              <div className="qng-result-title-stack">
                <div className="qng-result-headline qng-result-headline--timeout">
                  {t(language, 'timesUp')}
                </div>
                <CorrectAnswerHint answer={correctAnswer} language={language} />
              </div>
            </div>

            <div className="qng-timeout-score-stack">
              <div className="qng-points-capsule qng-points-capsule--empty qng-points-capsule--timeout">
                <div className="qng-points-label qng-points-label--muted">+ {t(language, 'points')}</div>
                <div className="qng-points-value">0</div>
              </div>

              {rank && (
                <div className="qng-stat-chip qng-stat-chip--timeout" dir="ltr">
                  <span className="qng-stat-chip-score" dir={isRtl ? 'rtl' : 'ltr'}>
                    <bdi dir="ltr">{totalFormatted}</bdi> {t(language, 'points')}
                  </span>
                  <span className="qng-stat-chip-separator" aria-hidden="true">·</span>
                  <span className="qng-stat-chip-rank" dir={isRtl ? 'rtl' : 'ltr'}>
                    {timeoutRankLabel}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── CORRECT ──
  if (isCorrect) {
    return (
      <div className="qng-screen qng-screen--win">
        <div className="qng-screen-frame qng-screen-frame--result">
          <ResultShapes />
          <div className="qng-screen-center">
            <div className="qng-result-feedback-heading qng-result-feedback-heading--correct">
              <div className="qng-result-icon-tile" style={{ transform: 'rotate(-4deg)' }}>
                <svg width="68" height="68" viewBox="0 0 24 24" fill="none" stroke="#00B36B" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <div className="qng-result-headline qng-result-headline--lg qng-result-headline--feedback">
                {t(language, 'correct')}
              </div>
            </div>

            <div className="qng-correct-score-stack">
              <div className="qng-points-capsule qng-points-capsule--correct">
                <div className="qng-points-label">+ {t(language, 'points')}</div>
                <div className="qng-points-value">{scoreFormatted}</div>
              </div>

              <div className="qng-stat-chips">
                {rank && (
                  <div className="qng-stat-chip">
                    <span className="qng-stat-chip-icon">📈</span>
                    <span>{t(language, 'rank', { rank })}</span>
                  </div>
                )}
                {streakCount > 0 && (
                  <div className="qng-stat-chip">
                    <span className="qng-stat-chip-icon">🔥</span>
                    <span>{t(language, 'streakLabel')}</span>
                    <bdi dir="ltr">x{streakCount}</bdi>
                  </div>
                )}
              </div>
            </div>

            <div className="qng-total-line qng-total-line--win">
              {t(language, 'total', { score: totalFormatted })}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── INCORRECT ──
  return (
    <div className="qng-screen qng-screen--lose">
      <div className="qng-screen-frame qng-screen-frame--result">
        <ResultShapes />
        <div className="qng-screen-center">
          <div className="qng-result-feedback-heading qng-result-feedback-heading--incorrect">
            <div className="qng-result-icon-tile" style={{ transform: 'rotate(3deg)' }}>
              <svg width="62" height="62" viewBox="0 0 24 24" fill="none" stroke="#FF2E93" strokeWidth="4" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </div>

            <div className="qng-result-title-stack">
              <div className="qng-result-headline qng-result-headline--lg qng-result-headline--feedback">
                {t(language, 'incorrect')}
              </div>
              <CorrectAnswerHint answer={correctAnswer} language={language} />
            </div>
          </div>

          <div className="qng-incorrect-score-stack">
            <div className="qng-points-capsule qng-points-capsule--empty qng-points-capsule--incorrect">
              <div className="qng-points-label qng-points-label--muted">+ {t(language, 'points')}</div>
              <div className="qng-points-value">0</div>
            </div>

            <div className="qng-stat-chips">
              {rank && (
                <div className="qng-stat-chip qng-stat-chip--danger qng-stat-chip--result-summary" dir="ltr">
                  <span className="qng-stat-chip-score" dir={isRtl ? 'rtl' : 'ltr'}>
                    <bdi dir="ltr">{totalFormatted}</bdi> {t(language, 'points')}
                  </span>
                  <span className="qng-stat-chip-separator" aria-hidden="true">·</span>
                  <span className="qng-stat-chip-rank" dir={isRtl ? 'rtl' : 'ltr'}>
                    {timeoutRankLabel}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ResultScreen
