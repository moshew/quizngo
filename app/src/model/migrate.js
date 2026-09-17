/**
 * Document upgrades. `normalizeQuiz` only fills defaults; structural migrations live here because
 * they need the templates (which themselves depend on the schema).
 */
import { normalizeQuiz } from './schema.js'
import { SCHEMA_VERSION } from './constants.js'
import { applyTemplate } from './templates/index.js'

/**
 * v1 → v2: looks moved from per-element style values to template skins (SPEC FR-18), so template
 * owned elements are rebuilt from the quiz's template. Content and free elements are preserved.
 */
export function upgradeQuiz(raw) {
  const quiz = normalizeQuiz(raw)
  const from = Number(raw?.schemaVersion) || 1
  if (from >= SCHEMA_VERSION || !quiz.slides.length) return quiz
  return applyTemplate(quiz, quiz.templateId, { legacy: true })
}

const RTL_CHARS = /[֐-׿؀-ۿ]/
const ARABIC = /[؀-ۿ]/

function guessLanguage(slide) {
  const sample = JSON.stringify([slide?.elements?.map((e) => e.html || e.props?.headerText || e.props?.label || ''), slide?.question || ''])
  if (!RTL_CHARS.test(sample)) return 'en'
  return ARABIC.test(sample) ? 'ar' : 'he'
}

/**
 * The library lists only a cover slide + templateId. Wrap it in a minimal quiz so it renders with
 * the right template and direction — upgrading pre-skin covers on the fly.
 */
export function coverQuiz({ cover, templateId, title } = {}) {
  if (!cover) return null
  const legacy = cover.background?.decor === undefined
  return upgradeQuiz({ schemaVersion: legacy ? 1 : SCHEMA_VERSION, title: title || '', templateId, language: guessLanguage(cover), slides: [cover] })
}
