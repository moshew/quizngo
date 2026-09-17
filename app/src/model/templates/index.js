import { buildLayouts } from './layouts.js'
import { fontsFor } from './base.js'
import magenta from './magenta.js'
import midnight from './midnight.js'
import sunset from './sunset.js'
import ocean from './ocean.js'
import classicBlack from './classicBlack.js'
import minimal from './minimal.js'
import { createEmptyQuiz, createSlide, createQuestion, isRtlLang } from '../schema.js'
import { QUESTION_LAYOUTS, DEFAULT_QUESTION_LAYOUT } from '../constants.js'
import { contentT } from '../content-i18n.js'
import { uid } from '../ids.js'

// The two approved designs lead; the rest are re-colorings of their skins.
const THEMES = [magenta, midnight, sunset, ocean, classicBlack, minimal]

export const TEMPLATES = THEMES.map((theme) => ({ ...theme, layouts: buildLayouts(theme) }))
export const TEMPLATE_IDS = TEMPLATES.map((t) => t.id)

export function getTemplate(id) {
  return TEMPLATES.find((t) => t.id === id) || TEMPLATES[0]
}

/** The layout a question slide should use when none was chosen: follow its content. */
export function autoQuestionLayout(slide) {
  if (QUESTION_LAYOUTS.includes(slide?.layout)) return slide.layout
  return slide?.question?.media?.src ? 'banner' : DEFAULT_QUESTION_LAYOUT
}

/** Build a slide of `type` using the quiz's template (background + layout elements). */
export function createSlideFromTemplate(quiz, type, { question, layout } = {}) {
  const template = getTemplate(quiz.templateId)
  const build = template.layouts[type] || template.layouts.transition
  const background = cloneBackground(template.backgrounds?.[type] || template.background)
  const resolved = type === 'question' ? (QUESTION_LAYOUTS.includes(layout) ? layout : autoQuestionLayout({ question })) : undefined
  return createSlide(type, { background, elements: build(quiz, { layout: resolved }), question, layout: resolved })
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

// Widget props that are the author's content (kept across re-theme / re-layout); everything else
// — variants, labels the template words differently — comes fresh from the new layout.
const CARRIED_PROPS = {
  leaderboard: ['count', 'showAvatar', 'showScore'],
  'participants-list': ['headerText', 'showCount'],
  'answers-chart': ['showValues', 'showShapes', 'showLabels', 'showQuestion'],
  'game-pin': ['showLabel'],
  'qr-code': ['showLabel'],
}

function pick(obj, keys) {
  const out = {}
  for (const k of keys) if (obj && obj[k] !== undefined) out[k] = obj[k]
  return out
}

/**
 * Replace a slide's template-owned elements with `fresh` ones, keeping the author's content:
 * free elements, edited titles, images/crops, hidden flags and content-like widget props.
 */
function mergeSlide(slide, fresh, { keepBackground = false, legacy = false } = {}) {
  const owned = new Map()
  const free = []
  for (const el of slide.elements) {
    const role = roleOf(el)
    if (role) { if (!owned.has(role)) owned.set(role, el); continue }
    if (el.fromTemplate) continue // decoration of the previous template
    free.push(el)
  }

  const merged = fresh.elements.map((el) => {
    const old = owned.get(roleOf(el))
    if (!old || old.kind !== el.kind) return el
    if (el.kind === 'widget') {
      const carried = legacy ? pick(old.props, ['count']) : pick(old.props, CARRIED_PROPS[el.widget] || [])
      return { ...el, id: old.id, props: { ...el.props, ...carried }, hidden: old.hidden }
    }
    if (el.kind === 'text') return { ...el, id: old.id, html: el.binding || legacy ? el.html : old.html, hidden: old.hidden }
    if (el.kind === 'image') {
      // A crop only survives if the new box has the same proportions; otherwise fall back to "fill".
      const sameAspect = Math.abs(old.w / old.h - el.w / el.h) < 0.01
      return { ...el, id: old.id, src: old.src, placeholder: old.placeholder, crop: sameAspect ? old.crop : el.crop, hidden: old.hidden }
    }
    if (el.kind === 'answer') return { ...el, id: old.id, hidden: old.hidden }
    return el
  })

  const next = { ...slide, background: keepBackground ? slide.background : fresh.background, elements: [...merged, ...free] }
  if (fresh.layout) next.layout = fresh.layout
  return next
}

/**
 * Re-theme an existing quiz. Bound/template elements are replaced by the new template's layout;
 * question content, the chosen question layout and free elements are preserved.
 * `legacy` is used by the v1→v2 migration, where old widget props/titles must not leak in.
 */
export function applyTemplate(quiz, templateId, { legacy = false } = {}) {
  const next = { ...quiz, templateId }
  next.slides = quiz.slides.map((slide) => {
    const fresh = createSlideFromTemplate(next, slide.type, { question: slide.question, layout: autoQuestionLayout(slide) })
    return mergeSlide(slide, fresh, { legacy })
  })
  return next
}

/** Re-arrange one question slide (SPEC FR-19). Pure: returns the new slide. */
export function applyQuestionLayout(quiz, slide, layout) {
  if (slide.type !== 'question' || !QUESTION_LAYOUTS.includes(layout)) return slide
  const fresh = createSlideFromTemplate(quiz, 'question', { question: slide.question, layout })
  return mergeSlide(slide, fresh, { keepBackground: true })
}

/** A stable role key for elements the template owns (bound text/image, titles, answers, widgets). */
export function roleOf(el) {
  if (!el) return null
  if (el.kind === 'answer') return `answer:${el.index}`
  if (el.kind === 'widget') return `widget:${el.widget}`
  if (el.binding) return `binding:${el.binding}`
  if (el.kind === 'text' && el.role && el.fromTemplate) return `text:${el.role}`
  return null
}

function cloneBackground(bg) {
  return JSON.parse(JSON.stringify(bg))
}

/** The template's own background for a slide type (for "reset background"). */
export function templateBackground(quiz, type) {
  const template = getTemplate(quiz.templateId)
  return cloneBackground(template.backgrounds?.[type] || template.background)
}

export function templateFonts(quiz) {
  return fontsFor(getTemplate(quiz.templateId), quiz.language)
}

export { isRtlLang, uid }
