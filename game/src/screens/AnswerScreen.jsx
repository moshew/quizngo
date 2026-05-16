import { t } from '../i18n'

const ANS_COLORS = {
  1: '#e74c3c',
  2: '#3498db',
  3: '#f1c40f',
  4: '#2ecc71',
}

const Triangle = ({ size = 52 }) => (
  <svg width={size} height={size * 0.86} viewBox="0 0 100 86">
    <polygon points="50,4 96,82 4,82" fill="#fff" />
  </svg>
)

const Diamond = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <polygon points="50,4 96,50 50,96 4,50" fill="#fff" />
  </svg>
)

const Circle = ({ size = 50 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="46" fill="#fff" />
  </svg>
)

const Square = ({ size = 46 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <rect x="6" y="6" width="88" height="88" rx="6" fill="#fff" />
  </svg>
)

function AnswerScreen({ onAnswer, hasAnswered, selectedAnswer, language, timeRemaining }) {
  const isUrgent = timeRemaining != null && timeRemaining <= 3

  if (hasAnswered) {
    const color = ANS_COLORS[selectedAnswer] || '#3498db'
    const shapes = {
      1: <Triangle size={64} />,
      2: <Diamond size={60} />,
      3: <Circle size={62} />,
      4: <Square size={58} />,
    }

    return (
      <div className="qng-screen qng-screen--waiting">
        <div className="qng-screen-center">
          <div
            className="qng-locked-in-tile"
            style={{ background: color }}
          >
            {shapes[selectedAnswer]}
          </div>

          <div className="qng-locked-in-headline">{t(language, 'answerSent')}</div>

          <div className="qng-waiting-line">
            {t(language, 'waitingResults')}
            <span className="qng-dots"><span /><span /><span /></span>
          </div>

          {timeRemaining != null && timeRemaining > 0 && (
            <div className="qng-locked-in-timer">
              <span className="qng-locked-in-timer-label" dir="auto">
                {t(language, 'countdownIn')}
              </span>
              <span className="qng-locked-in-timer-number">
                <bdi dir="ltr">{timeRemaining}</bdi>
              </span>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="qng-answer-screen">
      <div className="qng-answer-top-bar" aria-live="polite">
        <div className={`qng-timer-chip${isUrgent ? ' qng-timer-chip--urgent' : ''}`}>
          {timeRemaining ?? '—'}
        </div>
      </div>

      <div className="qng-answer-grid">
        <button
          className="qng-answer-tile qng-answer-tile--blue"
          onClick={() => onAnswer(2)}
          type="button"
          aria-label="Answer 2"
        >
          <Diamond size={48} />
        </button>

        <button
          className="qng-answer-tile qng-answer-tile--red"
          onClick={() => onAnswer(1)}
          type="button"
          aria-label="Answer 1"
        >
          <Triangle size={52} />
        </button>

        <button
          className="qng-answer-tile qng-answer-tile--green"
          onClick={() => onAnswer(4)}
          type="button"
          aria-label="Answer 4"
        >
          <Square size={46} />
        </button>

        <button
          className="qng-answer-tile qng-answer-tile--yellow"
          onClick={() => onAnswer(3)}
          type="button"
          aria-label="Answer 3"
        >
          <Circle size={50} />
        </button>
      </div>
    </div>
  )
}

export default AnswerScreen
