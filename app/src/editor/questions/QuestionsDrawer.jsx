import React, { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../../i18n/index.js'
import { ANSWERS, ANSWER_INDICES, RESULT_SLIDE_TYPES, LIMITS } from '../../model/constants.js'
import { assetUrl } from '../../api/client.js'
import {
  useEditor, selectSlide, updateQuestion, setAnswer, setCorrectAnswer, addQuestionSlide, deleteQuestion, duplicateSlide,
  addResultsAfter, addResultsAfterAll, removeResultsSlides, importQuestions, setAllTimeLimits, moveSlide,
} from '../../state/editorStore.js'
import Button, { IconButton } from '../../components/Button.jsx'
import Icon from '../../components/Icon.jsx'
import Modal from '../../components/Modal.jsx'
import Menu, { useMenu } from '../../components/Menu.jsx'
import { NumberField } from '../../components/Field.jsx'
import { AnswerGlyph } from '../render/elements/AnswerView.jsx'
import { pickFiles, setQuestionMedia, setAnswerImage } from '../image/useImageUpload.js'
import { toast } from '../../components/Toast.jsx'
import { parseQuestionsText } from '../../model/importText.js'

function QuestionCard({ slide, number, quiz, active, resultsAfter, isFirst, isLast }) {
  const { t } = useI18n()
  const q = slide.question
  return (
    <div className={`q-card ${active ? 'active' : ''}`}>
      <div className="q-card-head">
        <span className="q-card-num">{number}</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => selectSlide(slide.id)}><Icon name="slide" />{t('questions.goToSlide')}</button>
        <span className="grow" />
        <IconButton icon="arrowUp" size="sm" label="↑" disabled={isFirst} onClick={() => moveSlide(slide.id, quiz.slides.indexOf(slide) - 1)} />
        <IconButton icon="arrowDown" size="sm" label="↓" disabled={isLast} onClick={() => moveSlide(slide.id, quiz.slides.indexOf(slide) + 1)} />
        <IconButton icon="copy" size="sm" label={t('common.duplicate')} onClick={() => duplicateSlide(slide.id)} />
        <IconButton icon="trash" size="sm" label={t('questions.deleteQuestion')} danger onClick={() => { if (window.confirm(t('questions.deleteConfirm'))) deleteQuestion(slide.id) }} />
      </div>
      <textarea
        className="input"
        rows={2}
        dir="auto"
        placeholder={t('questions.questionPlaceholder')}
        value={q.text}
        onChange={(e) => updateQuestion(slide.id, { text: e.target.value })}
      />
      <div className="q-answers">
        {ANSWER_INDICES.map((i) => {
          const a = q.answers[i - 1]
          const correct = q.correctAnswer === i
          return (
            <div key={i} className={`q-answer ${correct ? 'correct' : ''}`}>
              <span className="glyph" style={{ background: ANSWERS[i].color }}><AnswerGlyph index={i} color={i === 3 ? '#1a0a2e' : '#fff'} size={14} /></span>
              <input dir="auto" value={a.text} placeholder={t('questions.answerPlaceholder', { n: i })} onChange={(e) => setAnswer(slide.id, i, { text: e.target.value })} />
              {a.image?.src ? (
                <button type="button" className="ibtn sm" title={t('common.remove')} onClick={() => setAnswer(slide.id, i, { image: null }, null)}><img className="img-thumb" src={assetUrl(a.image.src)} alt="" /></button>
              ) : (
                <IconButton icon="image" size="sm" className="img-btn" label={t('questions.media')} onClick={() => pickFiles({ onFiles: (f) => setAnswerImage(slide.id, i, f[0]) })} />
              )}
              <button type="button" className="correct-btn" title={t('questions.correct')} onClick={() => setCorrectAnswer(slide.id, i)}><Icon name="check" /></button>
            </div>
          )
        })}
      </div>
      <div className="q-card-foot">
        <div className="q-media">
          {q.media?.src ? <img src={assetUrl(q.media.src)} alt="" /> : null}
          <Button size="sm" variant="ghost" icon="image" onClick={() => pickFiles({ onFiles: (f) => setQuestionMedia(slide.id, f[0]) })}>{t('questions.media')}</Button>
          {q.media?.src && <IconButton icon="x" size="sm" label={t('common.remove')} onClick={() => updateQuestion(slide.id, { media: null }, null)} />}
        </div>
        <span className="grow" />
        <div className="row gap-6">
          <Icon name="timer" size={14} className="dim" />
          <NumberField value={q.timeLimit || quiz.settings.questionWaitTime} min={LIMITS.questionWaitTime[0]} max={LIMITS.questionWaitTime[1]} onChange={(v) => updateQuestion(slide.id, { timeLimit: v === quiz.settings.questionWaitTime ? null : v })} suffix="s" />
        </div>
        <div className="q-results">
          <button type="button" className={`chip ${resultsAfter.includes('statistics') ? 'active' : ''}`} style={resultsAfter.includes('statistics') ? { background: 'rgba(47,139,230,.3)', color: '#fff' } : undefined} onClick={() => { if (!resultsAfter.includes('statistics')) addResultsAfter(slide.id, 'statistics') }} title={t('editor.addStatsAfter')}>
            <Icon name="barChart" />{t('questions.stats')}
          </button>
          <button type="button" className="chip" style={resultsAfter.includes('leaderboard') ? { background: 'rgba(242,166,0,.35)', color: '#fff' } : undefined} onClick={() => { if (!resultsAfter.includes('leaderboard')) addResultsAfter(slide.id, 'leaderboard') }} title={t('editor.addLeaderboardAfter')}>
            <Icon name="trophy" />{t('questions.leaders')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function QuestionsDrawer({ onClose }) {
  const { t } = useI18n()
  const quiz = useEditor((s) => s.quiz)
  const currentSlideId = useEditor((s) => s.currentSlideId)
  const [importing, setImporting] = useState(false)
  const [importText, setImportText] = useState('')
  const actions = useMenu()

  const questions = useMemo(() => {
    const out = []
    let n = 0
    quiz.slides.forEach((s, i) => {
      if (s.type !== 'question') return
      n++
      const results = []
      let j = i + 1
      while (quiz.slides[j] && RESULT_SLIDE_TYPES.includes(quiz.slides[j].type)) { results.push(quiz.slides[j].type); j++ }
      out.push({ slide: s, number: n, resultsAfter: results })
    })
    return out
  }, [quiz])

  const parsed = useMemo(() => parseQuestionsText(importText), [importText])

  return createPortal(
    <>
      <div className="drawer-backdrop" onMouseDown={onClose} />
      <aside className="drawer" role="dialog" aria-label={t('questions.title')}>
        <div className="drawer-header">
          <h2>{t('questions.title')} <span className="chip">{questions.length}</span></h2>
          <Button size="sm" icon="more" onClick={(e) => actions.open(e)}>{t('common.more')}</Button>
          <IconButton icon="x" label={t('common.close')} onClick={onClose} />
        </div>
        <div className="drawer-sub">{t('questions.subtitle')}</div>
        <div className="drawer-body">
          {questions.length === 0 && <div className="empty"><div className="emoji">❓</div><p>{t('questions.noQuestions')}</p></div>}
          {questions.map(({ slide, number, resultsAfter }, idx) => (
            <QuestionCard key={slide.id} slide={slide} number={number} quiz={quiz} active={slide.id === currentSlideId} resultsAfter={resultsAfter} isFirst={quiz.slides.indexOf(slide) === 0} isLast={quiz.slides.indexOf(slide) === quiz.slides.length - 1} />
          ))}
        </div>
        <div className="drawer-footer">
          <Button variant="primary" icon="plus" onClick={() => { const id = addQuestionSlide(); if (id) selectSlide(id) }}>{t('questions.addQuestion')}</Button>
          <Button icon="fileText" onClick={() => setImporting(true)}>{t('questions.importText')}</Button>
        </div>
      </aside>

      {actions.menu && (
        <Menu anchor={actions.menu.anchor} onClose={actions.close} align="end" items={[
          { label: t('questions.addStatsAll'), icon: 'barChart', onClick: () => toast.success(t('questions.addedStats', { count: addResultsAfterAll('statistics') })) },
          { label: t('questions.addLeaderboardAll'), icon: 'trophy', onClick: () => toast.success(t('questions.addedLeaderboard', { count: addResultsAfterAll('leaderboard') })) },
          { label: t('questions.removeResults'), icon: 'trash', onClick: () => toast.success(t('questions.removedResults', { count: removeResultsSlides() })) },
          { sep: true },
          { label: t('questions.setTimeAll'), icon: 'timer', onClick: () => { const v = parseInt(window.prompt(t('questions.setTimeAllPrompt'), String(quiz.settings.questionWaitTime)), 10); if (Number.isFinite(v)) setAllTimeLimits(Math.min(LIMITS.questionWaitTime[1], Math.max(LIMITS.questionWaitTime[0], v))) } },
        ]} />
      )}

      <Modal open={importing} onClose={() => setImporting(false)} size="lg" title={t('questions.importTitle')}
        footer={<><Button variant="ghost" onClick={() => setImporting(false)}>{t('common.cancel')}</Button><Button variant="primary" icon="download" disabled={!parsed.length} onClick={() => { const n = importQuestions(parsed); toast.success(t('questions.imported', { count: n })); setImporting(false); setImportText('') }}>{parsed.length ? t('questions.importApply', { count: parsed.length }) : t('questions.importNone')}</Button></>}>
        <p className="small muted" style={{ marginBottom: 10 }}>{t('questions.importHelp')}</p>
        <textarea className="textarea" rows={12} dir="auto" value={importText} placeholder={t('questions.importPlaceholder')} onChange={(e) => setImportText(e.target.value)} />
      </Modal>
    </>,
    document.body,
  )
}
