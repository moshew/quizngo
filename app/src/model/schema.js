import { uid } from './ids.js'
import {
  SCHEMA_VERSION, SLIDE_TYPES, ANSWER_INDICES, DEFAULT_SETTINGS, LIMITS, WIDGET_DEFAULTS, WIDGET_TYPES, RTL_LANGS, QUESTION_LAYOUTS,
} from './constants.js'
import { sanitizeHtml } from './sanitize.js'

// ───────────────────────── Defaults ─────────────────────────

export const DEFAULT_TEXT_STYLE = {
  fontFamily: 'Rubik',
  fontSize: 40,
  color: '#ffffff',
  align: 'center',
  valign: 'middle',
  lineHeight: 1.2,
  letterSpacing: 0,
  direction: 'auto',
  padding: 16,
  background: null,
  borderRadius: 0,
  border: null,          // { width, color }
  shadow: null,          // css box-shadow
  textShadow: null,      // css text-shadow
  autoFit: false,
  bold: false,
}

export const DEFAULT_IMAGE_PROPS = {
  crop: { x: 0, y: 0, w: 1, h: 1 },
  frame: 'none',
  border: null,
  shadow: null,
  flipH: false,
  flipV: false,
  filters: { brightness: 100, contrast: 100, saturate: 100, blur: 0, grayscale: 0, sepia: 0 },
  borderRadius: 0,
  placeholder: false,
}

export const DEFAULT_SHAPE_PROPS = {
  shape: 'rect',
  fill: '#a16bff',
  stroke: { width: 0, color: '#ffffff', dash: false },
  borderRadius: 0,
  shadow: null,
}

/**
 * Answers and widgets are drawn by the template's skin (CSS). Every look-related field below is an
 * OVERRIDE: `null` means "as the template says", so re-theming stays cheap and the skin can use
 * effects inline styles cannot express (glows, glass, pseudo-elements).
 */
export const DEFAULT_ANSWER_STYLE = {
  variant: 'card',
  background: null,      // null → canonical answer color, drawn by the skin
  color: null,
  fontFamily: null,
  fontSize: 38,
  borderRadius: null,
  border: null,          // { width, color } — width 0 means "explicitly none"
  shadow: null,
  showShape: true,
  showIndex: false,
  imagePosition: 'start',
  bold: true,
}

export const DEFAULT_WIDGET_STYLE = {
  fontFamily: null,
  color: null,
  accent: null,
  ink: null,
  background: null,
  borderRadius: null,
  border: null,
  shadow: null,
}

/** Look-related keys that "reset to template style" clears. */
export const SKIN_STYLE_KEYS = ['background', 'color', 'fontFamily', 'borderRadius', 'border', 'shadow', 'accent', 'ink']

// ───────────────────────── Factories ─────────────────────────

function base(kind, geo = {}) {
  return {
    id: uid(kind.slice(0, 2)),
    kind,
    name: '',
    x: geo.x ?? 100,
    y: geo.y ?? 100,
    w: geo.w ?? 400,
    h: geo.h ?? 200,
    rotation: geo.rotation ?? 0,
    opacity: 1,
    locked: false,
    hidden: false,
    fromTemplate: !!geo.fromTemplate,
  }
}

export function createText({ html = '', style = {}, binding = null, role = null, ...geo } = {}) {
  // `role` ("title" | "eyebrow" | "subtitle") marks template-owned texts so re-theming keeps their wording.
  return { ...base('text', geo), html: sanitizeHtml(html), binding, role, style: { ...DEFAULT_TEXT_STYLE, ...style } }
}

export function createImage({ src = '', binding = null, placeholder = false, ...rest } = {}) {
  const { x, y, w, h, rotation, fromTemplate, ...props } = rest
  return {
    ...base('image', { x, y, w, h, rotation, fromTemplate }),
    src,
    binding,
    ...DEFAULT_IMAGE_PROPS,
    ...props,
    placeholder: placeholder || !src,
  }
}

export function createShape({ shape = 'rect', ...rest } = {}) {
  const { x, y, w, h, rotation, fromTemplate, ...props } = rest
  return { ...base('shape', { x, y, w, h, rotation, fromTemplate }), ...DEFAULT_SHAPE_PROPS, shape, ...props }
}

export function createAnswer(index, { style = {}, ...geo } = {}) {
  return { ...base('answer', geo), index, style: { ...DEFAULT_ANSWER_STYLE, ...style } }
}

export function createWidget(widget, { props = {}, style = {}, ...geo } = {}) {
  const def = WIDGET_DEFAULTS[widget] || { w: 400, h: 200, props: {} }
  return {
    ...base('widget', { w: def.w, h: def.h, ...geo }),
    widget,
    props: { ...def.props, ...props },
    style: { ...DEFAULT_WIDGET_STYLE, ...style },
  }
}

export function createQuestion(partial = {}) {
  const answers = ANSWER_INDICES.map((i) => ({
    text: partial.answers?.[i - 1]?.text ?? '',
    image: partial.answers?.[i - 1]?.image ?? null,
  }))
  return {
    text: partial.text ?? '',
    media: partial.media ?? null,
    answers,
    correctAnswer: ANSWER_INDICES.includes(partial.correctAnswer) ? partial.correctAnswer : 1,
    timeLimit: partial.timeLimit ?? null,
  }
}

export function createSlide(type, { background, elements = [], question, hidden = false, notes = '', layout } = {}) {
  const slide = {
    id: uid('s'),
    type: SLIDE_TYPES.includes(type) ? type : 'transition',
    hidden,
    background: background || { kind: 'color', color: '#1a0a2e', decor: true },
    elements,
    notes,
  }
  if (slide.type === 'question') {
    slide.question = createQuestion(question)
    if (QUESTION_LAYOUTS.includes(layout)) slide.layout = layout
  }
  return slide
}

export function createEmptyQuiz({ title = '', templateId = 'magenta-party', language = 'he' } = {}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    title,
    description: '',
    templateId,
    language,
    settings: { ...DEFAULT_SETTINGS },
    slides: [],
  }
}

// ───────────────────────── Normalization ─────────────────────────

const clamp = (v, [min, max], fallback) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function normalizeElement(el) {
  if (!el || typeof el !== 'object') return null
  const geo = {
    id: el.id || uid('el'),
    kind: el.kind,
    name: el.name || '',
    x: Number(el.x) || 0,
    y: Number(el.y) || 0,
    w: Math.max(8, Number(el.w) || 100),
    h: Math.max(8, Number(el.h) || 100),
    rotation: Number(el.rotation) || 0,
    opacity: el.opacity === undefined ? 1 : clamp(el.opacity, [0, 1], 1),
    locked: !!el.locked,
    hidden: !!el.hidden,
    fromTemplate: !!el.fromTemplate,
  }
  switch (el.kind) {
    case 'text':
      return { ...geo, html: sanitizeHtml(el.html || ''), binding: el.binding || null, role: el.role || null, style: { ...DEFAULT_TEXT_STYLE, ...(el.style || {}) } }
    case 'image':
      return {
        ...geo,
        src: el.src || '',
        binding: el.binding || null,
        crop: { ...DEFAULT_IMAGE_PROPS.crop, ...(el.crop || {}) },
        frame: el.frame || 'none',
        border: el.border || null,
        shadow: el.shadow || null,
        flipH: !!el.flipH,
        flipV: !!el.flipV,
        filters: { ...DEFAULT_IMAGE_PROPS.filters, ...(el.filters || {}) },
        borderRadius: Number(el.borderRadius) || 0,
        placeholder: !!el.placeholder || !el.src,
      }
    case 'shape':
      return {
        ...geo,
        shape: el.shape || 'rect',
        fill: el.fill ?? DEFAULT_SHAPE_PROPS.fill,
        stroke: { ...DEFAULT_SHAPE_PROPS.stroke, ...(el.stroke || {}) },
        borderRadius: Number(el.borderRadius) || 0,
        shadow: el.shadow || null,
      }
    case 'answer':
      return { ...geo, index: ANSWER_INDICES.includes(el.index) ? el.index : 1, style: { ...DEFAULT_ANSWER_STYLE, ...(el.style || {}) } }
    case 'widget': {
      const widget = WIDGET_TYPES.includes(el.widget) ? el.widget : 'game-pin'
      const def = WIDGET_DEFAULTS[widget]
      return { ...geo, widget, props: { ...def.props, ...(el.props || {}) }, style: { ...DEFAULT_WIDGET_STYLE, ...(el.style || {}) } }
    }
    default:
      return null
  }
}

function normalizeSlide(slide) {
  const type = SLIDE_TYPES.includes(slide?.type) ? slide.type : 'transition'
  const out = {
    id: slide?.id || uid('s'),
    type,
    hidden: !!slide?.hidden,
    background: slide?.background && typeof slide.background === 'object' ? slide.background : { kind: 'color', color: '#1a0a2e' },
    elements: Array.isArray(slide?.elements) ? slide.elements.map(normalizeElement).filter(Boolean) : [],
    notes: slide?.notes || '',
  }
  if (type === 'question') {
    out.question = createQuestion(slide?.question || {})
    if (QUESTION_LAYOUTS.includes(slide?.layout)) out.layout = slide.layout
  }
  return out
}

/** Fill defaults / migrate an incoming document so the editor can rely on every field. */
export function normalizeQuiz(raw) {
  const q = raw && typeof raw === 'object' ? raw : {}
  return {
    schemaVersion: SCHEMA_VERSION,
    title: typeof q.title === 'string' ? q.title : '',
    description: typeof q.description === 'string' ? q.description : '',
    templateId: q.templateId || 'magenta-party',
    language: q.language || 'he',
    settings: {
      questionWaitTime: clamp(q.settings?.questionWaitTime, LIMITS.questionWaitTime, DEFAULT_SETTINGS.questionWaitTime),
      clockActivationDelay: clamp(q.settings?.clockActivationDelay, LIMITS.clockActivationDelay, DEFAULT_SETTINGS.clockActivationDelay),
      leaderboardSize: clamp(q.settings?.leaderboardSize, LIMITS.leaderboardSize, DEFAULT_SETTINGS.leaderboardSize),
    },
    slides: Array.isArray(q.slides) && q.slides.length ? q.slides.map(normalizeSlide) : [],
  }
}

// ───────────────────────── Queries ─────────────────────────

export const isRtlLang = (lang) => RTL_LANGS.has(lang)

export function slideIndexById(quiz, slideId) {
  return quiz.slides.findIndex((s) => s.id === slideId)
}

export function questionSlides(quiz) {
  return quiz.slides.filter((s) => s.type === 'question')
}

/** 1-based question number of a question slide, or null. */
export function questionNumber(quiz, slideId) {
  let n = 0
  for (const s of quiz.slides) {
    if (s.type === 'question') n++
    if (s.id === slideId) return s.type === 'question' ? n : null
  }
  return null
}

/** The nearest question slide before `index` (results slides show its data). */
export function previousQuestionSlide(quiz, index) {
  for (let i = index - 1; i >= 0; i--) {
    if (quiz.slides[i]?.type === 'question') return quiz.slides[i]
  }
  return null
}

export function effectiveTimeLimit(quiz, slide) {
  return slide?.question?.timeLimit || quiz.settings.questionWaitTime
}

export function findElement(slide, elementId) {
  return slide?.elements.find((e) => e.id === elementId) || null
}
