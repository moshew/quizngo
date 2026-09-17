import React from 'react'
import { useI18n } from '../../i18n/index.js'
import { ANSWERS, ANSWER_INDICES, LIMITS, QUESTION_LAYOUTS, RESULT_SLIDE_TYPES } from '../../model/constants.js'
import { autoQuestionLayout } from '../../model/templates/index.js'
import { assetUrl } from '../../api/client.js'
import {
  updateQuestion, setAnswer, setCorrectAnswer, setQuestionLayout, setQuestionMediaSrc, addResultsAfter, deleteSlide,
  insertAnswerElement, selectSlide,
} from '../../state/editorStore.js'
import { NumberField } from '../../components/Field.jsx'
import Button, { IconButton } from '../../components/Button.jsx'
import Icon from '../../components/Icon.jsx'
import { AnswerGlyph } from '../render/elements/AnswerView.jsx'
import { pickFiles, setQuestionMedia, setAnswerImage } from '../image/useImageUpload.js'
import { Section } from './controls.jsx'

/** Wireframe of a question layout: where the image, the question and the answers go. */
function LayoutIcon({ layout }) {
  const tile = (x, y, w, h, i) => <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} rx="1.5" fill={ANSWERS[i].color} />
  const bar = <><circle cx="6" cy="5.5" r="2.4" fill="currentColor" opacity=".55" /><rect x="22" y="4" width="20" height="3" rx="1.5" fill="currentColor" opacity=".55" /><rect x="54" y="3.5" width="6" height="4" rx="1" fill="currentColor" opacity=".55" /></>
  const line = (x, y, w) => <rect x={x} y={y} width={w} height="3" rx="1.5" fill="currentColor" />
  const pic = (x, y, w, h) => <><rect x={x} y={y} width={w} height={h} rx="2" fill="currentColor" opacity=".28" /><circle cx={x + w * 0.32} cy={y + h * 0.4} r={Math.min(w, h) * 0.13} fill="currentColor" opacity=".55" /></>
  return (
    <svg viewBox="0 0 64 36" aria-hidden="true">
      {layout === 'text' && <>{bar}{line(12, 12, 40)}{line(18, 17, 28)}{tile(4, 23, 27, 5, 1)}{tile(33, 23, 27, 5, 2)}{tile(4, 29.5, 27, 5, 3)}{tile(33, 29.5, 27, 5, 4)}</>}
      {layout === 'banner' && <>{bar}{line(14, 10, 36)}{pic(14, 14.5, 36, 9)}{tile(4, 25, 27, 4.5, 1)}{tile(33, 25, 27, 4.5, 2)}{tile(4, 30.5, 27, 4.5, 3)}{tile(33, 30.5, 27, 4.5, 4)}</>}
      {layout === 'side' && <>{pic(3, 6, 19, 25)}{line(26, 5, 22)}{line(26, 11, 32)}{tile(26, 16, 35, 4, 1)}{tile(26, 21, 35, 4, 2)}{tile(26, 26, 35, 4, 3)}{tile(26, 31, 35, 4, 4)}</>}
      {layout === 'image-answers' && <>{bar}{line(14, 10, 36)}{[[4, 15, 1], [33, 15, 2], [4, 26, 3], [33, 26, 4]].map(([x, y, i]) => <g key={i}>{pic(x, y, 27, 6)}{tile(x, y + 6, 27, 3.2, i)}</g>)}</>}
    </svg>
  )
}

function AnswerRow({ slide, index }) {
  const { t } = useI18n()
  const answer = slide.question.answers[index - 1]
  const correct = slide.question.correctAnswer === index
  const onSlide = slide.elements.some((el) => el.kind === 'answer' && el.index === index)
  return (
    <div className={`q-answer ${correct ? 'correct' : ''}`}>
      <span className="glyph" style={{ background: ANSWERS[index].color, color: index === 3 ? '#1a0a2e' : '#fff' }}><AnswerGlyph index={index} size={14} /></span>
      <input dir="auto" value={answer.text} placeholder={t('questions.answerPlaceholder', { n: index })} onChange={(e) => setAnswer(slide.id, index, { text: e.target.value })} />
      {!onSlide && <IconButton icon="plusSquare" size="sm" className="img-btn" label={t('editor.restoreAnswer')} onClick={() => insertAnswerElement(index)} />}
      {answer.image?.src ? (
        <button type="button" className="ibtn sm" data-tip={t('common.remove')} onClick={() => setAnswer(slide.id, index, { image: null }, null)}><img className="img-thumb" src={assetUrl(answer.image.src)} alt="" /></button>
      ) : (
        <IconButton icon="image" size="sm" className="img-btn" label={t('questions.media')} onClick={() => pickFiles({ onFiles: (f) => setAnswerImage(slide.id, index, f[0]) })} />
      )}
      <button type="button" className="correct-btn" data-tip={t('editor.markCorrect')} aria-label={t('editor.markCorrect')} aria-pressed={correct} onClick={() => setCorrectAnswer(slide.id, index)}><Icon name="check" /></button>
    </div>
  )
}

/**
 * The question, editable as a form — the main way to write a quiz (SPEC FR-04). Everything here
 * writes to `slide.question`, the single source of truth the canvas renders from.
 */
export default function QuestionForm({ slide, quiz }) {
  const { t } = useI18n()
  const q = slide.question
  const layout = autoQuestionLayout(slide)
  const idx = quiz.slides.indexOf(slide)
  const results = []
  for (let j = idx + 1; quiz.slides[j] && RESULT_SLIDE_TYPES.includes(quiz.slides[j].type); j++) results.push(quiz.slides[j])
  const toggleResult = (type) => {
    const existing = results.find((s) => s.type === type)
    if (existing) deleteSlide(existing.id)
    else addResultsAfter(slide.id, type)
    selectSlide(slide.id)
  }

  return (
    <>
      <Section title={t('questions.question')}>
        <textarea className="textarea q-text" rows={3} dir="auto" placeholder={t('questions.questionPlaceholder')} value={q.text} onChange={(e) => updateQuestion(slide.id, { text: e.target.value })} />
        <div className="q-answers one-col">
          {ANSWER_INDICES.map((i) => <AnswerRow key={i} slide={slide} index={i} />)}
        </div>
        <p className="xs dim q-hint"><Icon name="check" size={12} /> {t('editor.correctHint')}</p>

        <div className="q-meta">
          <div className="q-media">
            {q.media?.src ? <img src={assetUrl(q.media.src)} alt="" /> : null}
            <Button size="sm" icon="image" onClick={() => pickFiles({ onFiles: (f) => setQuestionMedia(slide.id, f[0]) })}>{q.media?.src ? t('editor.replaceImage') : t('editor.questionMedia')}</Button>
            {q.media?.src && <IconButton icon="trash" size="sm" label={t('common.remove')} onClick={() => setQuestionMediaSrc(slide.id, null)} />}
          </div>
          <div className="q-time" data-tip={t('editor.timeLimit')}>
            <Icon name="timer" size={15} className="dim" />
            <NumberField value={q.timeLimit || quiz.settings.questionWaitTime} min={LIMITS.questionWaitTime[0]} max={LIMITS.questionWaitTime[1]} onChange={(v) => updateQuestion(slide.id, { timeLimit: v === quiz.settings.questionWaitTime ? null : v })} suffix={t('editor.secShort')} />
          </div>
        </div>
      </Section>

      <Section title={t('editor.layout')}>
        <div className="layout-tiles">
          {QUESTION_LAYOUTS.map((id) => (
            <button key={id} type="button" className={`layout-tile ${layout === id ? 'active' : ''}`} onClick={() => layout !== id && setQuestionLayout(slide.id, id)} aria-pressed={layout === id}>
              <LayoutIcon layout={id} />
              <span>{t(`editor.layouts.${id}`)}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title={t('questions.resultsAfter')}>
        <div className="row gap-6">
          <button type="button" className={`toggle-chip ${results.some((s) => s.type === 'statistics') ? 'on' : ''}`} onClick={() => toggleResult('statistics')}><Icon name="barChart" size={15} />{t('questions.stats')}</button>
          <button type="button" className={`toggle-chip ${results.some((s) => s.type === 'leaderboard') ? 'on' : ''}`} onClick={() => toggleResult('leaderboard')}><Icon name="trophy" size={15} />{t('questions.leaders')}</button>
        </div>
      </Section>
    </>
  )
}
