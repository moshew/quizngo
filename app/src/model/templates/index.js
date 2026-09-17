import { buildLayouts } from './base.js'
import magenta from './magenta.js'
import classicBlack from './classicBlack.js'
import ocean from './ocean.js'
import sunset from './sunset.js'
import minimal from './minimal.js'
import { createEmptyQuiz, createSlide, createQuestion, isRtlLang } from '../schema.js'
import { contentT } from '../content-i18n.js'
import { uid } from '../ids.js'

const THEMES = [magenta, classicBlack, ocean, sunset, minimal]

export const TEMPLATES = THEMES.map((theme) => ({ ...theme, layouts: buildLayouts(theme) }))
export const TEMPLATE_IDS = TEMPLATES.map((t) => t.id)

export function getTemplate(id) {
  return TEMPLATES.find((t) => t.id === id) || TEMPLATES[0]
}

/** Build a slide of `type` using the quiz's template (background + layout elements). */
export function createSlideFromTemplate(quiz, type, { question } = {}) {
  const template = getTemplate(quiz.templateId)
  const layout = template.layouts[type] || template.layouts.transition
  const background = cloneBackground(template.backgrounds[type] || template.backgrounds.transition)
  return createSlide(type, { background, elements: layout(quiz), question })
}

function sampleQuestion(lang) {
  const t = (k, p) => contentT(lang, k, p)
  return createQuestion({
    text: t('sampleQuestion'),
    answers: [1, 2, 3, 4].map((n) => ({ text: t('sampleAnswer', { n }), image: null })),
    correctAnswer: 1,
  })
}

/** A brand-new quiz: opening, one sample question, distribution, leaderboard, summary. */
export function createQuizFromTemplate({ title = '', templateId = 'magenta-party', language = 'he' } = {}) {
  const quiz = createEmptyQuiz({ title, templateId, language })
  quiz.slides = [
    createSlideFromTemplate(quiz, 'opening'),
    createSlideFromTemplate(quiz, 'question', { question: sampleQuestion(language) }),
    createSlideFromTemplate(quiz, 'statistics'),
    createSlideFromTemplate(quiz, 'leaderboard'),
    createSlideFromTemplate(quiz, 'summary'),
  ]
  return quiz
}

/**
 * Re-theme an existing quiz. Bound/template elements are replaced by the new template's layout
 * (keeping user-editable widget props); free elements the author added are preserved.
 */
export function applyTemplate(quiz, templateId) {
  const next = { ...quiz, templateId }
  next.slides = quiz.slides.map((slide) => {
    const fresh = createSlideFromTemplate(next, slide.type, { question: slide.question })
    const freshElements = fresh.elements.map((el) => ({ ...el }))
    const carriedProps = new Map()

    const free = []
    for (const el of slide.elements) {
      const role = roleOf(el)
      if (role) {
        carriedProps.set(role, el)
        continue // replaced by the new layout element with the same role
      }
      if (el.fromTemplate) continue // old decoration
      free.push(el)
    }

    const merged = freshElements.map((el) => {
      const old = carriedProps.get(roleOf(el))
      if (!old) return el
      // Keep author customizations that are content, not style.
      if (el.kind === 'widget' && old.kind === 'widget') return { ...el, id: old.id, props: { ...el.props, ...old.props }, hidden: old.hidden }
      if (el.kind === 'text' && old.kind === 'text') return { ...el, id: old.id, html: old.binding ? el.html : old.html, hidden: old.hidden }
      if (el.kind === 'image' && old.kind === 'image') return { ...el, id: old.id, src: old.src, placeholder: old.placeholder, crop: old.crop, hidden: old.hidden }
      if (el.kind === 'answer' && old.kind === 'answer') return { ...el, id: old.id, hidden: old.hidden }
      return el
    })

    return { ...slide, background: fresh.background, elements: [...merged, ...free] }
  })
  return next
}

/** A stable role key for elements the template owns (bound text/image, answers, widgets). */
export function roleOf(el) {
  if (!el) return null
  if (el.kind === 'answer') return `answer:${el.index}`
  if (el.kind === 'widget') return `widget:${el.widget}`
  if (el.binding) return `binding:${el.binding}`
  return null
}

function cloneBackground(bg) {
  return JSON.parse(JSON.stringify(bg))
}

export function templateFonts(quiz) {
  const template = getTemplate(quiz.templateId)
  return template.fonts[quiz.language] || template.fonts.default
}

export { isRtlLang, uid }
