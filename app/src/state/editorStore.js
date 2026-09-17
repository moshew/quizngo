/**
 * Editor state: the quiz document, undo/redo history, selection, zoom and save status.
 * All document changes go through `mutate()` so history and autosave stay consistent.
 */
import { createStore } from './store.js'
import { createHistory } from '../model/history.js'
import * as quizApi from '../api/quizzes.js'
import {
  createQuestion, createText, createImage, createShape, createAnswer, createWidget,
  slideIndexById, questionSlides, findElement, SKIN_STYLE_KEYS,
} from '../model/schema.js'
import { upgradeQuiz } from '../model/migrate.js'
import {
  createSlideFromTemplate, applyTemplate, applyQuestionLayout, templateBackground, getTemplate, templateFonts, roleOf,
} from '../model/templates/index.js'
import { SLIDE_W, SLIDE_H, RESULT_SLIDE_TYPES, ANSWER_INDICES, WIDGET_DEFAULTS, QUESTION_LAYOUTS } from '../model/constants.js'
import { uid } from '../model/ids.js'
import { textToHtml } from '../model/sanitize.js'

const DRAFT_PREFIX = 'qng.studio.draft.'
const AUTOSAVE_MS = 1500

const initialState = {
  quizId: null,
  quiz: null,
  revision: 0,
  meta: null,
  loading: true,
  loadError: null,
  currentSlideId: null,
  selectedIds: [],
  editingId: null,
  croppingId: null,
  zoom: 'fit',
  saveState: 'saved', // saved | pending | saving | error | conflict
  saveError: null,
  conflict: null,
  dirty: false,
  drawer: null,
  canUndo: false,
  canRedo: false,
  clipboard: null,
  draftPrompt: null,
}

export const editorStore = createStore(initialState)
export const useEditor = editorStore.useStore

let history = createHistory(100)
let saveTimer = null
let savingPromise = null

// ───────────────────────── Selectors ─────────────────────────

export function getState() { return editorStore.get() }
export function currentSlide(state = getState()) {
  return state.quiz?.slides.find((s) => s.id === state.currentSlideId) || null
}
export function selectedElements(state = getState()) {
  const slide = currentSlide(state)
  if (!slide) return []
  return state.selectedIds.map((id) => findElement(slide, id)).filter(Boolean)
}

// ───────────────────────── Lifecycle ─────────────────────────

export async function openQuiz(quizId) {
  clearTimeout(saveTimer)
  history = createHistory(100)
  editorStore.set({ ...initialState, quizId, loading: true })
  try {
    const remote = await quizApi.getQuiz(quizId)
    const quiz = upgradeQuiz(remote.data)
    quiz.title = remote.title || quiz.title
    const draft = readDraft(quizId)
    editorStore.set({
      quiz,
      revision: remote.revision,
      meta: remote,
      loading: false,
      currentSlideId: quiz.slides[0]?.id || null,
      draftPrompt: draft && draft.revision === remote.revision ? draft : null,
    })
    if (draft && draft.revision !== remote.revision) clearDraft(quizId)
  } catch (err) {
    editorStore.set({ loading: false, loadError: err.message })
  }
}

export function closeQuiz() {
  clearTimeout(saveTimer)
  editorStore.set({ ...initialState })
}

export function restoreDraft() {
  const { draftPrompt, quizId } = getState()
  if (!draftPrompt) return
  const quiz = upgradeQuiz(draftPrompt.quiz)
  editorStore.set({ quiz, draftPrompt: null, dirty: true, saveState: 'pending', currentSlideId: quiz.slides[0]?.id || null })
  clearDraft(quizId)
  scheduleSave()
}

export function discardDraft() {
  clearDraft(getState().quizId)
  editorStore.set({ draftPrompt: null })
}

// ───────────────────────── Core mutation ─────────────────────────

/**
 * Apply `producer(draft)` to a deep copy of the quiz. `key` coalesces rapid consecutive edits
 * (typing, dragging) into one undo step.
 */
export function mutate(producer, key = null, { record = true } = {}) {
  const state = getState()
  if (!state.quiz) return
  const draft = structuredClone(state.quiz)
  const result = producer(draft)
  const next = result === undefined ? draft : result
  if (record) history.commit(state.quiz, key)
  editorStore.set({ quiz: next, dirty: true, saveState: state.saveState === 'conflict' ? 'conflict' : 'pending', canUndo: history.canUndo, canRedo: history.canRedo })
  scheduleSave()
}

export function undo() {
  const state = getState()
  const doc = history.undo(state.quiz)
  if (!doc) return
  editorStore.set({ quiz: doc, dirty: true, saveState: 'pending', canUndo: history.canUndo, canRedo: history.canRedo, editingId: null, croppingId: null })
  reconcileSelection()
  scheduleSave()
}

export function redo() {
  const state = getState()
  const doc = history.redo(state.quiz)
  if (!doc) return
  editorStore.set({ quiz: doc, dirty: true, saveState: 'pending', canUndo: history.canUndo, canRedo: history.canRedo, editingId: null, croppingId: null })
  reconcileSelection()
  scheduleSave()
}

export function breakUndoCoalescing() { history.breakCoalescing() }

function reconcileSelection() {
  const state = getState()
  const quiz = state.quiz
  let currentSlideId = state.currentSlideId
  if (!quiz.slides.some((s) => s.id === currentSlideId)) currentSlideId = quiz.slides[0]?.id || null
  const slide = quiz.slides.find((s) => s.id === currentSlideId)
  const selectedIds = state.selectedIds.filter((id) => slide && findElement(slide, id))
  editorStore.set({ currentSlideId, selectedIds })
}

// ───────────────────────── Saving ─────────────────────────

function scheduleSave() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => saveNow(), AUTOSAVE_MS)
}

export async function saveNow({ force = false } = {}) {
  clearTimeout(saveTimer)
  const state = getState()
  if (!state.quiz || !state.quizId) return
  if (!state.dirty && !force) return
  if (state.saveState === 'conflict' && !force) return
  if (savingPromise) { await savingPromise.catch(() => {}); return saveNow({ force }) }

  const snapshot = state.quiz
  editorStore.set({ saveState: 'saving', saveError: null })
  savingPromise = quizApi.updateQuiz(state.quizId, { title: snapshot.title, data: snapshot, revision: state.revision, force })
  try {
    const saved = await savingPromise
    const latest = getState()
    const stillDirty = latest.quiz !== snapshot
    editorStore.set({ revision: saved.revision, meta: saved, dirty: stillDirty, saveState: stillDirty ? 'pending' : 'saved', conflict: null })
    clearDraft(state.quizId)
    if (stillDirty) scheduleSave()
  } catch (err) {
    if (err.code === 409) {
      editorStore.set({ saveState: 'conflict', conflict: err.payload?.quiz || null })
    } else {
      editorStore.set({ saveState: 'error', saveError: err.message })
    }
    writeDraft(state.quizId, snapshot, state.revision)
  } finally {
    savingPromise = null
  }
}

export async function resolveConflict(action) {
  const state = getState()
  if (action === 'overwrite') {
    await saveNow({ force: true })
    return
  }
  // reload from server
  const remote = state.conflict || (await quizApi.getQuiz(state.quizId))
  const quiz = upgradeQuiz(remote.data)
  history = createHistory(100)
  clearDraft(state.quizId)
  editorStore.set({ quiz, revision: remote.revision, meta: remote, dirty: false, saveState: 'saved', conflict: null, canUndo: false, canRedo: false, selectedIds: [], editingId: null })
  reconcileSelection()
}

/** Called on tab hide / unload: flush pending work synchronously as a draft, and try saving. */
export function flushOnLeave() {
  const state = getState()
  if (state.dirty && state.quiz) writeDraft(state.quizId, state.quiz, state.revision)
  if (state.dirty) saveNow()
}

function readDraft(quizId) {
  try { return JSON.parse(localStorage.getItem(DRAFT_PREFIX + quizId) || 'null') } catch { return null }
}
function writeDraft(quizId, quiz, revision) {
  try { localStorage.setItem(DRAFT_PREFIX + quizId, JSON.stringify({ quiz, revision, savedAt: Date.now() })) } catch { /* quota */ }
}
function clearDraft(quizId) {
  try { localStorage.removeItem(DRAFT_PREFIX + quizId) } catch { /* ignore */ }
}

// ───────────────────────── Selection / view ─────────────────────────

export function selectSlide(slideId) {
  const state = getState()
  if (state.currentSlideId === slideId) return
  editorStore.set({ currentSlideId: slideId, selectedIds: [], editingId: null, croppingId: null })
}

export function select(ids, { additive = false, toggle = false } = {}) {
  const state = getState()
  let next
  if (toggle) {
    next = state.selectedIds.slice()
    for (const id of ids) {
      const i = next.indexOf(id)
      if (i >= 0) next.splice(i, 1); else next.push(id)
    }
  } else if (additive) {
    next = Array.from(new Set([...state.selectedIds, ...ids]))
  } else {
    next = ids
  }
  editorStore.set({ selectedIds: next, editingId: next.includes(state.editingId) ? state.editingId : null, croppingId: null })
}

export function clearSelection() {
  editorStore.set({ selectedIds: [], editingId: null, croppingId: null })
}

export function setEditing(id) {
  const state = getState()
  // Leaving an empty free-text box deletes it (Canva behaviour) so stray boxes don't litter the slide.
  if (!id && state.editingId) {
    const slide = currentSlide(state)
    const el = slide && findElement(slide, state.editingId)
    if (el?.kind === 'text' && !el.binding && !el.html.replace(/<[^>]*>|&nbsp;|\s/g, '')) {
      mutate((quiz) => withCurrentSlide(quiz, (s) => { s.elements = s.elements.filter((e) => e.id !== el.id) }), null, { record: false })
      editorStore.set({ editingId: null, croppingId: null, selectedIds: [] })
      return
    }
  }
  editorStore.set({ editingId: id, croppingId: null, selectedIds: id ? [id] : state.selectedIds })
}

export function setCropping(id) {
  editorStore.set({ croppingId: id, editingId: null, selectedIds: id ? [id] : getState().selectedIds })
}

export function setZoom(zoom) { editorStore.set({ zoom }) }
export function openDrawer(name) { editorStore.set({ drawer: name }) }
export function closeDrawer() { editorStore.set({ drawer: null }) }

// ───────────────────────── Slides ─────────────────────────

export function addSlide(type, { afterId, question, select: doSelect = true } = {}) {
  let newId = null
  mutate((quiz) => {
    const slide = createSlideFromTemplate(quiz, type, { question })
    newId = slide.id
    const idx = afterId ? slideIndexById(quiz, afterId) : quiz.slides.length - 1
    quiz.slides.splice(idx + 1, 0, slide)
  })
  if (doSelect && newId) selectSlide(newId)
  return newId
}

export function duplicateSlide(slideId) {
  let newId = null
  mutate((quiz) => {
    const idx = slideIndexById(quiz, slideId)
    if (idx < 0) return
    const copy = structuredClone(quiz.slides[idx])
    copy.id = uid('s')
    copy.elements.forEach((el) => { el.id = uid(el.kind.slice(0, 2)) })
    newId = copy.id
    quiz.slides.splice(idx + 1, 0, copy)
  })
  if (newId) selectSlide(newId)
}

export function deleteSlide(slideId) {
  const state = getState()
  if (state.quiz.slides.length <= 1) return false
  const idx = slideIndexById(state.quiz, slideId)
  mutate((quiz) => { quiz.slides = quiz.slides.filter((s) => s.id !== slideId) })
  if (state.currentSlideId === slideId) {
    const slides = getState().quiz.slides
    selectSlide(slides[Math.min(idx, slides.length - 1)].id)
  }
  return true
}

export function moveSlide(slideId, toIndex) {
  mutate((quiz) => {
    const from = slideIndexById(quiz, slideId)
    if (from < 0) return
    const [slide] = quiz.slides.splice(from, 1)
    const target = Math.max(0, Math.min(quiz.slides.length, toIndex))
    quiz.slides.splice(target, 0, slide)
  })
}

export function setSlideHidden(slideId, hidden) {
  mutate((quiz) => { const s = quiz.slides.find((x) => x.id === slideId); if (s) s.hidden = hidden })
}

export function updateSlide(slideId, patch, key) {
  mutate((quiz) => { const s = quiz.slides.find((x) => x.id === slideId); if (s) Object.assign(s, patch) }, key)
}

export function setBackground(slideId, background, key = `bg:${slideId}`) {
  mutate((quiz) => { const s = quiz.slides.find((x) => x.id === slideId); if (s) s.background = background }, key)
}

/** Rebuild a slide as another type using the template layout; free elements are kept. */
export function setSlideType(slideId, type) {
  mutate((quiz) => {
    const idx = slideIndexById(quiz, slideId)
    if (idx < 0) return
    const old = quiz.slides[idx]
    if (old.type === type) return
    const fresh = createSlideFromTemplate(quiz, type, { question: old.question })
    const free = old.elements.filter((el) => !roleOf(el) && !el.fromTemplate)
    quiz.slides[idx] = { ...fresh, id: old.id, hidden: old.hidden, notes: old.notes, elements: [...fresh.elements, ...free] }
  })
  editorStore.set({ selectedIds: [], editingId: null })
}

// ───────────────────────── Elements ─────────────────────────

function withCurrentSlide(quiz, fn) {
  const slide = quiz.slides.find((s) => s.id === getState().currentSlideId)
  if (slide) fn(slide)
}

export function addElement(el, { select: doSelect = true } = {}) {
  mutate((quiz) => withCurrentSlide(quiz, (slide) => { slide.elements.push(el) }))
  if (doSelect) select([el.id])
  return el.id
}

export function updateElement(id, patch, key) {
  mutate((quiz) => withCurrentSlide(quiz, (slide) => {
    const el = findElement(slide, id)
    if (el) Object.assign(el, patch)
  }), key)
}

export function updateElements(patches, key) {
  mutate((quiz) => withCurrentSlide(quiz, (slide) => {
    for (const { id, patch } of patches) {
      const el = findElement(slide, id)
      if (el) Object.assign(el, patch)
    }
  }), key)
}

export function updateElementStyle(id, stylePatch, key) {
  mutate((quiz) => withCurrentSlide(quiz, (slide) => {
    const el = findElement(slide, id)
    if (el) el.style = { ...(el.style || {}), ...stylePatch }
  }), key)
}

export function updateSelectedStyle(stylePatch, key) {
  const ids = getState().selectedIds
  mutate((quiz) => withCurrentSlide(quiz, (slide) => {
    for (const id of ids) {
      const el = findElement(slide, id)
      if (el && el.style) el.style = { ...el.style, ...stylePatch }
    }
  }), key)
}

export function updateWidgetProps(id, propsPatch, key) {
  mutate((quiz) => withCurrentSlide(quiz, (slide) => {
    const el = findElement(slide, id)
    if (el?.kind === 'widget') el.props = { ...el.props, ...propsPatch }
  }), key)
}

export function deleteElements(ids) {
  if (!ids.length) return
  mutate((quiz) => withCurrentSlide(quiz, (slide) => {
    slide.elements = slide.elements.filter((el) => !ids.includes(el.id) || el.locked)
  }))
  editorStore.set({ selectedIds: [], editingId: null, croppingId: null })
}

export function duplicateElements(ids, offset = 40) {
  const newIds = []
  mutate((quiz) => withCurrentSlide(quiz, (slide) => {
    const copies = []
    for (const id of ids) {
      const el = findElement(slide, id)
      if (!el) continue
      const copy = structuredClone(el)
      copy.id = uid(el.kind.slice(0, 2))
      copy.x += offset; copy.y += offset
      copy.locked = false
      copy.fromTemplate = false
      newIds.push(copy.id)
      copies.push(copy)
    }
    slide.elements.push(...copies)
  }))
  if (newIds.length) select(newIds)
  return newIds
}

/** action: 'forward' | 'backward' | 'front' | 'back' */
export function reorderElements(ids, action) {
  mutate((quiz) => withCurrentSlide(quiz, (slide) => {
    const els = slide.elements
    const moving = els.filter((el) => ids.includes(el.id))
    const rest = els.filter((el) => !ids.includes(el.id))
    if (action === 'front') { slide.elements = [...rest, ...moving]; return }
    if (action === 'back') { slide.elements = [...moving, ...rest]; return }
    const dir = action === 'forward' ? 1 : -1
    const order = els.slice()
    const indices = moving.map((el) => order.indexOf(el)).sort((a, b) => (dir > 0 ? b - a : a - b))
    for (const i of indices) {
      const j = i + dir
      if (j < 0 || j >= order.length || ids.includes(order[j].id)) continue
      ;[order[i], order[j]] = [order[j], order[i]]
    }
    slide.elements = order
  }))
}

export function alignElements(ids, how) {
  mutate((quiz) => withCurrentSlide(quiz, (slide) => {
    for (const id of ids) {
      const el = findElement(slide, id)
      if (!el || el.locked) continue
      if (how === 'centerH') el.x = Math.round((SLIDE_W - el.w) / 2)
      if (how === 'centerV') el.y = Math.round((SLIDE_H - el.h) / 2)
      if (how === 'left') el.x = 0
      if (how === 'right') el.x = SLIDE_W - el.w
      if (how === 'top') el.y = 0
      if (how === 'bottom') el.y = SLIDE_H - el.h
    }
  }))
}

export function nudgeElements(ids, dx, dy) {
  mutate((quiz) => withCurrentSlide(quiz, (slide) => {
    for (const id of ids) {
      const el = findElement(slide, id)
      if (el && !el.locked) { el.x += dx; el.y += dy }
    }
  }), `nudge:${ids.join(',')}`)
}

export function toggleLock(ids) {
  mutate((quiz) => withCurrentSlide(quiz, (slide) => {
    const els = ids.map((id) => findElement(slide, id)).filter(Boolean)
    const lock = els.some((el) => !el.locked)
    els.forEach((el) => { el.locked = lock })
  }))
}

export function toggleHidden(ids) {
  mutate((quiz) => withCurrentSlide(quiz, (slide) => {
    const els = ids.map((id) => findElement(slide, id)).filter(Boolean)
    const hide = els.some((el) => !el.hidden)
    els.forEach((el) => { el.hidden = hide })
  }))
}

/** Insert helpers (positioned at the slide center unless x/y given). */
export function insertText(overrides = {}) {
  const quiz = getState().quiz
  const fonts = templateFonts(quiz)
  const template = getTemplate(quiz.templateId)
  const w = 900, h = 140
  const el = createText({
    x: (SLIDE_W - w) / 2, y: (SLIDE_H - h) / 2, w, h,
    html: textToHtml(overrides.text ?? ''),
    style: { fontFamily: fonts.body, fontSize: 48, color: template.colors.text, align: 'center', autoFit: true, ...overrides.style },
    ...(overrides.geo || {}),
  })
  if (!overrides.text) el.html = ''
  const id = addElement(el)
  if (overrides.startEditing !== false) setEditing(id)
  return id
}

export function insertShape(shape, overrides = {}) {
  const quiz = getState().quiz
  const template = getTemplate(quiz.templateId)
  const w = shape === 'line' ? 600 : 360, h = shape === 'line' ? 12 : 360
  const el = createShape({
    shape, x: (SLIDE_W - w) / 2, y: (SLIDE_H - h) / 2, w, h,
    fill: template.colors.accent, stroke: { width: 0, color: template.colors.ink, dash: false },
    borderRadius: shape === 'rect' ? 24 : 0,
    ...overrides,
  })
  return addElement(el)
}

export function insertWidget(widget, overrides = {}) {
  const quiz = getState().quiz
  const def = WIDGET_DEFAULTS[widget]
  // No look values: the template's skin draws the widget (SPEC FR-18).
  const el = createWidget(widget, {
    x: (SLIDE_W - def.w) / 2, y: (SLIDE_H - def.h) / 2,
    props: { ...(overrides.props || {}) },
  })
  if (widget === 'leaderboard') el.props.count = quiz.settings.leaderboardSize
  return addElement(el)
}

export function insertImage({ src, width, height, x, y, binding = null }) {
  const maxW = 900, maxH = 700
  const ratio = Math.min(maxW / width, maxH / height, 1)
  const w = Math.round(width * ratio), h = Math.round(height * ratio)
  const el = createImage({
    src, w, h,
    x: x !== undefined ? Math.round(x - w / 2) : Math.round((SLIDE_W - w) / 2),
    y: y !== undefined ? Math.round(y - h / 2) : Math.round((SLIDE_H - h) / 2),
    binding,
  })
  return addElement(el)
}

/** Put a deleted answer tile back where the slide's layout expects it. */
export function insertAnswerElement(index) {
  const state = getState()
  const slide = currentSlide(state)
  const fresh = slide ? createSlideFromTemplate(state.quiz, 'question', { question: slide.question, layout: slide.layout }) : null
  const el = fresh?.elements.find((e) => e.kind === 'answer' && e.index === index)
    || createAnswer(index, { x: (SLIDE_W - 859) / 2, y: 640 + (index - 1) * 40, w: 859, h: 150 })
  return addElement({ ...el, fromTemplate: true })
}

// ───────────────────────── Question data ─────────────────────────

export function updateQuestion(slideId, patch, key = `q:${slideId}`) {
  mutate((quiz) => {
    const s = quiz.slides.find((x) => x.id === slideId)
    if (!s) return
    if (!s.question) s.question = createQuestion()
    Object.assign(s.question, patch)
  }, key)
}

export function setAnswer(slideId, index, patch, key = `a:${slideId}:${index}`) {
  mutate((quiz) => {
    const s = quiz.slides.find((x) => x.id === slideId)
    if (!s?.question) return
    s.question.answers[index - 1] = { ...s.question.answers[index - 1], ...patch }
  }, key)
}

/** Re-arrange a question slide (SPEC FR-19). One undo step; content and free elements are kept. */
export function setQuestionLayout(slideId, layout) {
  if (!QUESTION_LAYOUTS.includes(layout)) return
  mutate((quiz) => {
    const idx = slideIndexById(quiz, slideId)
    if (idx < 0 || quiz.slides[idx].type !== 'question') return
    quiz.slides[idx] = applyQuestionLayout(quiz, quiz.slides[idx], layout)
  })
  editorStore.set({ selectedIds: [], editingId: null, croppingId: null })
}

/**
 * Set / clear the question image and keep the layout honest: an image needs a layout that shows
 * it, and an image layout without an image would leave a hole on the projector.
 */
export function setQuestionMediaSrc(slideId, src) {
  mutate((quiz) => {
    const idx = slideIndexById(quiz, slideId)
    const slide = quiz.slides[idx]
    if (!slide || slide.type !== 'question') return
    if (!slide.question) slide.question = createQuestion()
    slide.question.media = src ? { src } : null
    for (const el of slide.elements) {
      if (el.binding === 'question-media') { el.crop = { x: 0, y: 0, w: 1, h: 1 }; el.placeholder = !src }
    }
    const showsImage = slide.elements.some((el) => el.binding === 'question-media')
    if (src && !showsImage) quiz.slides[idx] = applyQuestionLayout(quiz, slide, 'banner')
    else if (!src && showsImage && ['banner', 'side'].includes(slide.layout)) quiz.slides[idx] = applyQuestionLayout(quiz, slide, 'text')
  })
  editorStore.set({ selectedIds: [], editingId: null, croppingId: null })
}

/** Drop the author's look overrides so the element follows the template again. */
export function resetElementStyle(ids) {
  mutate((quiz) => withCurrentSlide(quiz, (slide) => {
    for (const id of ids) {
      const el = findElement(slide, id)
      if (!el?.style || (el.kind !== 'answer' && el.kind !== 'widget')) continue
      for (const key of SKIN_STYLE_KEYS) if (key in el.style) el.style[key] = null
      if (el.kind === 'answer') el.style.variant = 'card'
    }
  }))
}

export function resetBackground(slideId) {
  mutate((quiz) => {
    const s = quiz.slides.find((x) => x.id === slideId)
    if (s) s.background = templateBackground(quiz, s.type)
  })
}

export function setCorrectAnswer(slideId, index) {
  if (!ANSWER_INDICES.includes(index)) return
  updateQuestion(slideId, { correctAnswer: index }, null)
}

export function addQuestionSlide({ afterId, question } = {}) {
  const state = getState()
  let anchor = afterId
  if (!anchor) {
    // After the last question (or its results slides), else after the current slide.
    const qs = questionSlides(state.quiz)
    if (qs.length) {
      let idx = slideIndexById(state.quiz, qs[qs.length - 1].id)
      while (state.quiz.slides[idx + 1] && RESULT_SLIDE_TYPES.includes(state.quiz.slides[idx + 1].type)) idx++
      anchor = state.quiz.slides[idx].id
    } else {
      anchor = state.currentSlideId
    }
  }
  return addSlide('question', { afterId: anchor, question })
}

/** Add a results slide right after `slideId` (after any results already following it). */
export function addResultsAfter(slideId, type) {
  let newId = null
  mutate((quiz) => {
    let idx = slideIndexById(quiz, slideId)
    if (idx < 0) return
    while (quiz.slides[idx + 1] && RESULT_SLIDE_TYPES.includes(quiz.slides[idx + 1].type)) idx++
    const slide = createSlideFromTemplate(quiz, type)
    newId = slide.id
    quiz.slides.splice(idx + 1, 0, slide)
  })
  return newId
}

/** Ensure every question is followed by a results slide of `type`. Returns how many were added. */
export function addResultsAfterAll(type) {
  let added = 0
  mutate((quiz) => {
    const out = []
    for (let i = 0; i < quiz.slides.length; i++) {
      const s = quiz.slides[i]
      out.push(s)
      if (s.type !== 'question') continue
      // Look at the results block following this question.
      const block = []
      let j = i + 1
      while (quiz.slides[j] && RESULT_SLIDE_TYPES.includes(quiz.slides[j].type)) { block.push(quiz.slides[j]); j++ }
      if (!block.some((b) => b.type === type)) {
        const fresh = createSlideFromTemplate(quiz, type)
        added++
        // statistics goes before leaderboard when both exist
        if (type === 'statistics') out.push(fresh, ...block)
        else out.push(...block, fresh)
      } else {
        out.push(...block)
      }
      i = j - 1
    }
    quiz.slides = out
  })
  return added
}

export function removeResultsSlides() {
  let removed = 0
  const state = getState()
  mutate((quiz) => {
    const before = quiz.slides.length
    quiz.slides = quiz.slides.filter((s) => !RESULT_SLIDE_TYPES.includes(s.type))
    removed = before - quiz.slides.length
  })
  if (!getState().quiz.slides.some((s) => s.id === state.currentSlideId)) selectSlide(getState().quiz.slides[0].id)
  return removed
}

export function deleteQuestion(slideId, { withResults = true } = {}) {
  const state = getState()
  const idx = slideIndexById(state.quiz, slideId)
  if (idx < 0) return
  const ids = [slideId]
  if (withResults) {
    let j = idx + 1
    while (state.quiz.slides[j] && RESULT_SLIDE_TYPES.includes(state.quiz.slides[j].type)) { ids.push(state.quiz.slides[j].id); j++ }
  }
  if (ids.length >= state.quiz.slides.length) return
  mutate((quiz) => { quiz.slides = quiz.slides.filter((s) => !ids.includes(s.id)) })
  if (ids.includes(getState().currentSlideId)) {
    const slides = getState().quiz.slides
    selectSlide(slides[Math.min(idx, slides.length - 1)].id)
  }
}

/** items: [{ text, answers: [text×4], correctAnswer }] — appended after the last question block. */
export function importQuestions(items) {
  if (!items.length) return 0
  const state = getState()
  const hasOnlySample = questionSlides(state.quiz).length === 1
  let lastId = null
  for (const item of items) {
    const question = createQuestion({ text: item.text, answers: item.answers.map((text) => ({ text, image: null })), correctAnswer: item.correctAnswer })
    lastId = addQuestionSlide({ afterId: lastId || undefined, question })
  }
  void hasOnlySample
  if (lastId) selectSlide(lastId)
  return items.length
}

export function setAllTimeLimits(seconds) {
  mutate((quiz) => { for (const s of quiz.slides) if (s.question) s.question.timeLimit = seconds })
}

// ───────────────────────── Quiz-level ─────────────────────────

export function setTitle(title) {
  mutate((quiz) => { quiz.title = title }, 'title')
}

export function updateSettings(patch) {
  mutate((quiz) => {
    Object.assign(quiz.settings, patch)
    if (patch.leaderboardSize) {
      for (const s of quiz.slides) for (const el of s.elements) {
        if (el.kind === 'widget' && el.widget === 'leaderboard' && el.props.variant !== 'podium') el.props.count = patch.leaderboardSize
      }
    }
  }, 'settings')
}

export function updateQuizMeta(patch) {
  mutate((quiz) => { Object.assign(quiz, patch) }, 'meta')
}

export function applyTemplateToQuiz(templateId) {
  mutate((quiz) => applyTemplate(quiz, templateId))
  editorStore.set({ selectedIds: [], editingId: null })
}

// ───────────────────────── Clipboard ─────────────────────────

export function copySelection() {
  const els = selectedElements()
  if (!els.length) return
  editorStore.set({ clipboard: structuredClone(els) })
}

export function cutSelection() {
  const state = getState()
  copySelection()
  deleteElements(state.selectedIds)
}

export function pasteClipboard() {
  const { clipboard } = getState()
  if (!clipboard?.length) return
  const newIds = []
  mutate((quiz) => withCurrentSlide(quiz, (slide) => {
    for (const src of clipboard) {
      const copy = structuredClone(src)
      copy.id = uid(src.kind.slice(0, 2))
      copy.x += 40; copy.y += 40
      copy.locked = false
      copy.fromTemplate = false
      // Avoid two answer cards for the same index on one slide.
      if (copy.kind === 'answer' && slide.elements.some((el) => el.kind === 'answer' && el.index === copy.index)) continue
      slide.elements.push(copy)
      newIds.push(copy.id)
    }
  }))
  if (newIds.length) select(newIds)
  // Bump offsets so repeated paste cascades.
  editorStore.set({ clipboard: clipboard.map((el) => ({ ...el, x: el.x + 40, y: el.y + 40 })) })
}
