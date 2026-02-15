import { t } from '../i18n'

function AnswerScreen({ onAnswer, hasAnswered, selectedAnswer, language }) {
  if (hasAnswered) {
    const colors = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71']
    return (
      <div className="answered-overlay">
        <div className="answered-check" style={{ color: colors[selectedAnswer - 1] }}>
          {selectedAnswer === 1 && <span>&#9650;</span>}
          {selectedAnswer === 2 && <span>&#9670;</span>}
          {selectedAnswer === 3 && <span>&#9679;</span>}
          {selectedAnswer === 4 && <span>&#9632;</span>}
        </div>
        <div className="answered-text">{t(language, 'answerSent')}</div>
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div className="answer-grid fullscreen">
      <button className="answer-btn red" onClick={() => onAnswer(1)}>
        <div className="shape"><div className="shape-triangle"></div></div>
      </button>
      <button className="answer-btn blue" onClick={() => onAnswer(2)}>
        <div className="shape"><div className="shape-diamond"></div></div>
      </button>
      <button className="answer-btn yellow" onClick={() => onAnswer(3)}>
        <div className="shape"><div className="shape-circle"></div></div>
      </button>
      <button className="answer-btn green" onClick={() => onAnswer(4)}>
        <div className="shape"><div className="shape-square"></div></div>
      </button>
    </div>
  )
}

export default AnswerScreen
