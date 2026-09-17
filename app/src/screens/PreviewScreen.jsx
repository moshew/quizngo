import React, { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../i18n/index.js'
import { navigate } from '../router.jsx'
import * as quizApi from '../api/quizzes.js'
import { normalizeQuiz } from '../model/schema.js'
import { SLIDE_W, SLIDE_H } from '../model/constants.js'
import { sampleLiveData } from '../model/sample.js'
import SlideRenderer from '../editor/render/SlideRenderer.jsx'
import { IconButton } from '../components/Button.jsx'
import Icon from '../components/Icon.jsx'

function useStageSize() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight - 56 })
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight - 56 })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return size
}

/** Full-screen slideshow of a quiz with sample live data. Hidden slides are skipped (as in the game). */
export default function PreviewScreen({ quizId, quizDoc, startIndex = 0, onExit }) {
  const { t } = useI18n()
  const [quiz, setQuiz] = useState(quizDoc ? normalizeQuiz(quizDoc) : null)
  const [error, setError] = useState(null)
  const [index, setIndex] = useState(startIndex)
  const [showCorrect, setShowCorrect] = useState(false)
  const stage = useStageSize()

  useEffect(() => {
    if (quizDoc) return
    quizApi.getQuiz(quizId).then((q) => setQuiz(normalizeQuiz(q.data))).catch((e) => setError(e.message))
  }, [quizId, quizDoc])

  const visibleSlides = useMemo(() => (quiz ? quiz.slides.filter((s) => !s.hidden) : []), [quiz])
  const total = visibleSlides.length
  const current = visibleSlides[Math.min(index, Math.max(0, total - 1))]
  const liveData = useMemo(() => (quiz ? sampleLiveData(quiz.language) : null), [quiz])

  const exit = () => (onExit ? onExit() : navigate(quizId ? `/edit/${quizId}` : '/'))
  const go = (delta) => { setShowCorrect(false); setIndex((i) => Math.min(total - 1, Math.max(0, i + delta))) }

  useEffect(() => {
    const onKey = (e) => {
      const rtl = document.documentElement.dir === 'rtl'
      if (e.key === 'Escape') exit()
      else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') go(rtl && e.key === 'ArrowRight' ? -1 : 1)
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(rtl && e.key === 'ArrowLeft' ? 1 : -1)
      else if (e.key === 'Home') setIndex(0)
      else if (e.key === 'End') setIndex(total - 1)
      else if (e.key.toLowerCase() === 'c') setShowCorrect((v) => !v)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [total]) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <div className="preview-loading"><div className="empty"><div className="emoji">😵</div><p>{error}</p><button type="button" className="btn" onClick={exit}>{t('common.back')}</button></div></div>
  if (!quiz || !current) return <div className="preview-loading"><span className="spinner lg" /></div>

  const scale = Math.min((stage.w - 48) / SLIDE_W, (stage.h - 48) / SLIDE_H)
  const originalIndex = quiz.slides.indexOf(current)

  return (
    <div className="preview-screen">
      <div className="preview-progress" style={{ width: `${((index + 1) / total) * 100}%` }} />
      <div className="preview-stage">
        <div className="slide-holder" style={{ width: SLIDE_W * scale, height: SLIDE_H * scale }}>
          <SlideRenderer key={current.id} quiz={quiz} slide={current} scale={scale} mode="preview" liveData={liveData} showCorrect={showCorrect} />
        </div>
        {index > 0 && <div className="preview-nav prev" onClick={() => go(-1)}><Icon name="chevronLeft" /></div>}
        {index < total - 1 && <div className="preview-nav next" onClick={() => go(1)}><Icon name="chevronRight" /></div>}
        {quiz.slides.some((s) => s.hidden) && originalIndex >= 0 && quiz.slides[originalIndex].hidden && (
          <div className="preview-hidden-badge">{t('preview.hiddenSlide')}</div>
        )}
      </div>
      <div className="preview-bar">
        <IconButton icon="x" label={t('preview.exit')} onClick={exit} />
        <span className="chip"><Icon name="slide" />{t(`slideTypes.${current.type}`)}</span>
        <span className="grow dim small">{t('preview.hint')}</span>
        {current.type === 'question' && (
          <button type="button" className={`btn btn-sm ${showCorrect ? 'btn-primary' : ''}`} onClick={() => setShowCorrect((v) => !v)}><Icon name="check" />{t('preview.showCorrect')}</button>
        )}
        <IconButton icon="chevronLeft" label="prev" onClick={() => go(-1)} disabled={index === 0} className="ltr" />
        <span className="counter">{t('preview.slideOf', { n: index + 1, total })}</span>
        <IconButton icon="chevronRight" label="next" onClick={() => go(1)} disabled={index >= total - 1} className="ltr" />
      </div>
    </div>
  )
}
