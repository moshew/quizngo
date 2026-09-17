// Unit tests for pure model modules. Run with: npm test  (node --test)
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { createHistory } from '../src/model/history.js'
import { parseQuestionsText } from '../src/model/importText.js'
import { normalizeQuiz, createText, questionNumber, previousQuestionSlide, effectiveTimeLimit } from '../src/model/schema.js'
import { createQuizFromTemplate, applyTemplate, TEMPLATE_IDS, roleOf } from '../src/model/templates/index.js'
import { parseColor, toCss, isLightColor, shadowToFilter } from '../src/editor/render/color.js'
import { shapePath } from '../src/editor/render/shapes.js'
import { frameClipPathFor } from '../src/editor/render/frames.js'
import { formatPin, sampleLiveData } from '../src/model/sample.js'
import { SLIDE_W, SLIDE_H } from '../src/model/constants.js'

test('history: undo/redo with coalescing', () => {
  const h = createHistory(10)
  h.commit({ v: 0 }, 'typing')
  h.commit({ v: 1 }, 'typing') // coalesced into the first step
  assert.equal(h.canUndo, true)
  assert.deepEqual(h.undo({ v: 2 }), { v: 0 })
  assert.equal(h.canRedo, true)
  assert.deepEqual(h.redo({ v: 0 }), { v: 2 })
  h.breakCoalescing()
  h.commit({ v: 2 }, 'typing')
  assert.deepEqual(h.undo({ v: 3 }), { v: 2 })
})

test('history: respects the size limit', () => {
  const h = createHistory(3)
  for (let i = 0; i < 6; i++) h.commit({ i }, null)
  assert.deepEqual(h.undo({}), { i: 5 })
  assert.deepEqual(h.undo({}), { i: 4 })
  assert.deepEqual(h.undo({}), { i: 3 })
  assert.equal(h.undo({}), null)
})

test('importText: parses blocks, * marks correct answer, numbering stripped', () => {
  const items = parseQuestionsText('1. מהי בירת ישראל?\nא) תל אביב\n*ירושלים\nחיפה\nבאר שבע\n\nHow many legs?\n6\n*8\n10')
  assert.equal(items.length, 2)
  assert.equal(items[0].text, 'מהי בירת ישראל?')
  assert.deepEqual(items[0].answers, ['תל אביב', 'ירושלים', 'חיפה', 'באר שבע'])
  assert.equal(items[0].correctAnswer, 2)
  assert.deepEqual(items[1].answers, ['6', '8', '10', ''])
  assert.equal(items[1].correctAnswer, 2)
  assert.deepEqual(parseQuestionsText('only\none'), [])
})

test('templates: every template builds a 5-slide quiz inside the canvas', () => {
  for (const id of TEMPLATE_IDS) {
    const quiz = createQuizFromTemplate({ title: 'T', templateId: id, language: 'he' })
    assert.equal(quiz.slides.length, 5)
    assert.deepEqual(quiz.slides.map((s) => s.type), ['opening', 'question', 'statistics', 'leaderboard', 'summary'])
    const q = quiz.slides[1]
    assert.equal(q.elements.filter((e) => e.kind === 'answer').length, 4)
    assert.ok(q.elements.some((e) => e.binding === 'question'))
    for (const el of q.elements.filter((e) => e.kind === 'answer')) {
      assert.ok(el.x >= 0 && el.x + el.w <= SLIDE_W && el.y >= 0 && el.y + el.h <= SLIDE_H, `${id} answer ${el.index} inside slide`)
    }
  }
})

test('templates: RTL mirrors x positions vs LTR', () => {
  const he = createQuizFromTemplate({ templateId: 'magenta-party', language: 'he' }).slides[1]
  const en = createQuizFromTemplate({ templateId: 'magenta-party', language: 'en' }).slides[1]
  const a1he = he.elements.find((e) => e.kind === 'answer' && e.index === 1)
  const a1en = en.elements.find((e) => e.kind === 'answer' && e.index === 1)
  assert.equal(a1he.x, SLIDE_W - a1en.x - a1en.w)
})

test('applyTemplate: keeps question content and free elements, swaps template-owned ones', () => {
  const quiz = createQuizFromTemplate({ title: 'T', templateId: 'magenta-party', language: 'he' })
  quiz.slides[1].question.text = 'Q?'
  quiz.slides[1].question.answers[2].text = 'C'
  quiz.slides[1].question.correctAnswer = 3
  const free = createText({ html: 'free', x: 10, y: 10, w: 100, h: 50 })
  quiz.slides[1].elements.push(free)
  const next = applyTemplate(quiz, 'classic-black')
  assert.equal(next.templateId, 'classic-black')
  const q = next.slides[1]
  assert.equal(q.question.text, 'Q?')
  assert.equal(q.question.correctAnswer, 3)
  assert.ok(q.elements.some((e) => e.id === free.id), 'free element preserved')
  assert.equal(q.elements.filter((e) => e.kind === 'answer').length, 4)
  assert.equal(q.background.kind, 'image')
  const roles = q.elements.map(roleOf).filter(Boolean)
  assert.equal(new Set(roles).size, roles.length, 'no duplicate roles after re-theme')
})

test('schema: normalizeQuiz fills defaults and clamps settings', () => {
  const q = normalizeQuiz({ slides: [{ type: 'question', elements: [{ kind: 'text', html: '<script>x</script><b>ok</b>' }] }], settings: { questionWaitTime: 9999 } })
  assert.equal(q.settings.questionWaitTime, 300)
  assert.equal(q.settings.leaderboardSize, 5)
  assert.equal(q.slides[0].question.answers.length, 4)
  assert.equal(q.slides[0].question.correctAnswer, 1)
  assert.equal(q.slides[0].elements[0].html.includes('<script>'), false)
  assert.equal(effectiveTimeLimit(q, q.slides[0]), 300)
})

test('schema: question numbering and previous-question lookup', () => {
  const quiz = createQuizFromTemplate({ templateId: 'ocean', language: 'en' })
  assert.equal(questionNumber(quiz, quiz.slides[1].id), 1)
  assert.equal(questionNumber(quiz, quiz.slides[0].id), null)
  assert.equal(previousQuestionSlide(quiz, 2).id, quiz.slides[1].id)
  assert.equal(previousQuestionSlide(quiz, 0), null)
})

test('color utils', () => {
  assert.deepEqual(parseColor('#fff'), { r: 255, g: 255, b: 255, a: 1 })
  assert.deepEqual(parseColor('rgba(26, 10, 46, 0.5)'), { r: 26, g: 10, b: 46, a: 0.5 })
  assert.equal(toCss({ r: 255, g: 0, b: 0, a: 1 }), '#ff0000')
  assert.equal(isLightColor('#ffffff'), true)
  assert.equal(isLightColor('#1a0a2e'), false)
  assert.equal(isLightColor('rgba(255,255,255,0.16)'), false)
  assert.equal(shadowToFilter('0 10px 0 #1a0a2e'), 'drop-shadow(0 10px 0 #1a0a2e)')
  assert.equal(shadowToFilter('0 12px 32px rgba(0,0,0,0.35)'), 'drop-shadow(0 12px 32px rgba(0,0,0,0.35))')
})

test('shapes & frames produce usable CSS/SVG', () => {
  assert.match(shapePath('rect', 100, 50, 10), /^M 10 0 H 90/)
  assert.match(shapePath('star', 100, 100), /^M .* Z$/)
  assert.equal(frameClipPathFor('circle', 100, 100), 'ellipse(50% 50% at 50% 50%)')
  assert.match(frameClipPathFor('heart', 200, 100), /^path\("M100,95/)
  assert.equal(frameClipPathFor('none', 10, 10), null)
})

test('sample data', () => {
  assert.equal(formatPin('123456'), '123-456')
  const live = sampleLiveData('en')
  assert.equal(live.leaderboard[0].score >= live.leaderboard[1].score, true)
  assert.equal(Object.keys(live.distribution).length, 4)
})
