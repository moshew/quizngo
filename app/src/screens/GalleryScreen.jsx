import React, { useMemo, useState } from 'react'
import { TEMPLATES, createQuizFromTemplate, applyQuestionLayout } from '../model/templates/index.js'
import { createSlideFromTemplate } from '../model/templates/index.js'
import { QUESTION_LAYOUTS } from '../model/constants.js'
import { navigate } from '../router.jsx'
import SlideThumb from '../components/SlideThumb.jsx'

/**
 * Design QA board (route: /gallery): every template × slide type × question layout, with
 * realistic content, in either content language. Not linked from the product UI.
 */
const SAMPLE = {
  he: {
    title: 'חידון יום הולדת 50 לדני',
    question: 'מהי בינה מלאכותית?',
    answers: ['מחשב שחושב בדיוק כמו אדם', 'מערכת שמבצעת משימות "חכמות" — זיהוי תמונות, כתיבת טקסט', 'רק רובוט פיזי', 'תוכנה שמפעילה את האינטרנט'],
  },
  en: {
    title: 'AI, Demystified',
    question: 'What is artificial intelligence?',
    answers: ['A computer that thinks exactly like a human', 'A system that does “smart” tasks — recognizing images, writing text', 'Only a physical robot', 'Software that runs the internet'],
  },
}

// A tiny inline picture so image layouts can be judged without the asset server.
const SAMPLE_IMAGE = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2b1a6b"/><stop offset="1" stop-color="#ff2e93"/></linearGradient></defs><rect width="800" height="500" fill="url(#g)"/><circle cx="400" cy="250" r="120" fill="#ffd400"/><circle cx="360" cy="225" r="18" fill="#1a0a2e"/><circle cx="440" cy="225" r="18" fill="#1a0a2e"/><path d="M345 290 Q400 340 455 290" stroke="#1a0a2e" stroke-width="14" fill="none" stroke-linecap="round"/></svg>')}`

function buildBoard(templateId, language) {
  const sample = SAMPLE[language] || SAMPLE.en
  const quiz = createQuizFromTemplate({ title: sample.title, templateId, language })
  const question = { text: sample.question, answers: sample.answers.map((text) => ({ text, image: null })), correctAnswer: 2, media: { src: SAMPLE_IMAGE } }
  const withImages = { ...question, answers: question.answers.map((a) => ({ ...a, image: { src: SAMPLE_IMAGE } })) }
  const base = createSlideFromTemplate(quiz, 'question', { question, layout: 'text' })
  const questions = QUESTION_LAYOUTS.map((layout) => {
    const slide = applyQuestionLayout(quiz, base, layout)
    return { label: `question · ${layout}`, slide: layout === 'image-answers' ? { ...slide, question: withImages } : slide }
  })
  // The results slides read the previous question, so keep the deck order realistic.
  quiz.slides = [quiz.slides[0], questions[1].slide, quiz.slides[2], quiz.slides[3], createSlideFromTemplate(quiz, 'transition'), quiz.slides[4]]
  const others = [
    { label: 'opening', slide: quiz.slides[0] },
    ...questions,
    { label: 'statistics', slide: quiz.slides[2] },
    { label: 'leaderboard', slide: quiz.slides[3] },
    { label: 'transition', slide: quiz.slides[4] },
    { label: 'summary', slide: quiz.slides[5] },
  ]
  return { quiz, items: others }
}

export default function GalleryScreen() {
  const params = new URLSearchParams(window.location.search)
  const [language, setLanguage] = useState(params.get('lang') || 'he')
  const only = params.get('t')
  const cols = Number(params.get('cols')) || 3
  const templates = TEMPLATES.filter((t) => !only || t.id === only)
  const boards = useMemo(() => templates.map((tpl) => ({ tpl, ...buildBoard(tpl.id, language) })), [language, only]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="gallery" dir="ltr" style={{ height: '100%', overflow: 'auto', padding: 24, background: '#0d0716', color: '#fff' }}>
      <div className="row gap-12" style={{ marginBottom: 16 }}>
        <button type="button" className="btn btn-sm" onClick={() => navigate('/')}>← Library</button>
        <strong style={{ fontSize: 18 }}>Template gallery</strong>
        <span className="grow" />
        {['he', 'en'].map((l) => <button key={l} type="button" className={`btn btn-sm ${language === l ? 'btn-primary' : ''}`} onClick={() => setLanguage(l)}>{l}</button>)}
      </div>
      {boards.map(({ tpl, quiz, items }) => (
        <section key={tpl.id} data-template={tpl.id} style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 16, margin: '0 0 10px', opacity: 0.8 }}>{tpl.id} · {tpl.skin}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 14 }}>
            {items.map(({ label, slide }) => (
              <figure key={label} style={{ margin: 0 }}>
                <SlideThumb slide={slide} quiz={quiz} mode="thumb" style={{ borderRadius: 8 }} />
                <figcaption style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>{label}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
