// Unit tests for pure model modules. Run with: npm test  (node --test)
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { createHistory } from '../src/model/history.js'
import { parseQuestionsText } from '../src/model/importText.js'
import { normalizeQuiz, createText, questionNumber, previousQuestionSlide, effectiveTimeLimit } from '../src/model/schema.js'
import { createQuizFromTemplate, createSlideFromTemplate, applyTemplate, applyQuestionLayout, getTemplate, TEMPLATE_IDS, roleOf } from '../src/model/templates/index.js'
import { upgradeQuiz, coverQuiz } from '../src/model/migrate.js'
import { fitFontSize } from '../src/model/fit.js'
import { SCHEMA_VERSION, QUESTION_LAYOUTS } from '../src/model/constants.js'
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

test('templates: the two approved designs lead, every template names a skin and a decor', () => {
  assert.deepEqual(TEMPLATE_IDS.slice(0, 2), ['magenta-party', 'midnight-arcade'])
  for (const id of TEMPLATE_IDS) {
    const tpl = getTemplate(id)
    assert.ok(['chunky', 'neon'].includes(tpl.skin), `${id} skin`)
    assert.ok(tpl.decor && tpl.vars['--t-ink'] && tpl.vars['--t-primary'], `${id} tokens`)
  }
})

test('templates: answers and widgets carry no look of their own (the skin draws them)', () => {
  const quiz = createQuizFromTemplate({ templateId: 'midnight-arcade', language: 'en' })
  for (const slide of quiz.slides) for (const el of slide.elements) {
    if (el.kind !== 'answer' && el.kind !== 'widget') continue
    for (const key of ['background', 'color', 'fontFamily', 'borderRadius', 'border', 'shadow']) assert.equal(el.style[key], null, `${el.kind}.${key}`)
  }
  assert.equal(quiz.slides[0].background.decor, true)
})

test('question layouts: all four stay inside the slide, in every template and direction', () => {
  for (const id of TEMPLATE_IDS) for (const language of ['he', 'en']) for (const layout of QUESTION_LAYOUTS) {
    const quiz = createQuizFromTemplate({ templateId: id, language })
    const slide = createSlideFromTemplate(quiz, 'question', { layout })
    assert.equal(slide.layout, layout)
    assert.equal(slide.elements.filter((e) => e.kind === 'answer').length, 4)
    assert.equal(slide.elements.some((e) => e.binding === 'question-media'), layout === 'banner' || layout === 'side')
    for (const el of slide.elements) {
      assert.ok(el.x >= 0 && el.x + el.w <= SLIDE_W && el.y >= 0 && el.y + el.h <= SLIDE_H, `${id}/${language}/${layout}: ${el.kind} inside slide`)
    }
  }
})

test('question layouts: switching keeps content, free elements and ids; default follows the content', () => {
  const quiz = createQuizFromTemplate({ templateId: 'magenta-party', language: 'he' })
  const slide = quiz.slides[1]
  assert.equal(slide.layout, 'text')
  slide.question.text = 'Q?'
  slide.question.correctAnswer = 4
  const free = createText({ html: 'free', x: 10, y: 10, w: 100, h: 50 })
  slide.elements.push(free)
  const answerIds = slide.elements.filter((e) => e.kind === 'answer').map((e) => e.id)
  const side = applyQuestionLayout(quiz, slide, 'side')
  assert.equal(side.layout, 'side')
  assert.equal(side.question.text, 'Q?')
  assert.equal(side.question.correctAnswer, 4)
  assert.ok(side.elements.some((e) => e.id === free.id))
  assert.deepEqual(side.elements.filter((e) => e.kind === 'answer').map((e) => e.id), answerIds)
  assert.deepEqual(side.background, slide.background)
  const roles = side.elements.map(roleOf).filter(Boolean)
  assert.equal(new Set(roles).size, roles.length)
  // a question that arrives with an image gets a layout that shows it
  const withImage = createSlideFromTemplate(quiz, 'question', { question: { text: 'x', media: { src: '/api/assets/1' } } })
  assert.equal(withImage.layout, 'banner')
})

test('applyTemplate: keeps the chosen layout and the wording of template titles', () => {
  const quiz = createQuizFromTemplate({ title: 'My quiz', templateId: 'magenta-party', language: 'en' })
  quiz.slides[1] = applyQuestionLayout(quiz, quiz.slides[1], 'image-answers')
  const title = quiz.slides[3].elements.find((e) => e.role === 'title')
  title.html = 'Who is winning?'
  const next = applyTemplate(quiz, 'midnight-arcade')
  assert.equal(next.slides[1].layout, 'image-answers')
  assert.equal(next.slides[3].elements.find((e) => e.role === 'title').html, 'Who is winning?')
  assert.equal(next.slides[0].elements.find((e) => e.binding === 'quiz-title').style.fontFamily, 'Bricolage Grotesque')
})

test('migration: a v1 document is rebuilt on its template without losing content', () => {
  const v1 = {
    schemaVersion: 1, templateId: 'ocean', language: 'he', title: 'Old',
    slides: [
      { type: 'opening', background: { kind: 'gradient', gradient: { angle: 160, stops: [] } }, elements: [{ kind: 'shape', fromTemplate: true, x: 0, y: 0, w: 10, h: 10 }] },
      {
        type: 'question', background: { kind: 'color', color: '#000' },
        question: { text: 'Q', answers: [{ text: 'a' }, { text: 'b' }], correctAnswer: 2, media: { src: '/api/assets/7' } },
        elements: [
          { kind: 'answer', index: 1, x: 0, y: 0, w: 100, h: 50, style: { background: '#123456', shadow: '0 1px 0 #000' } },
          { kind: 'widget', widget: 'timer', x: 0, y: 0, w: 100, h: 100, props: { variant: 'pill', label: 'שניות' }, style: { background: '#fff' } },
          { kind: 'text', html: 'mine', x: 5, y: 5, w: 100, h: 40 },
        ],
      },
    ],
  }
  const quiz = upgradeQuiz(v1)
  assert.equal(quiz.schemaVersion, SCHEMA_VERSION)
  assert.equal(quiz.slides[0].elements.some((e) => e.kind === 'shape'), false, 'old decoration dropped')
  assert.equal(quiz.slides[0].background.decor, true)
  const q = quiz.slides[1]
  assert.equal(q.layout, 'banner')
  assert.equal(q.question.text, 'Q')
  assert.equal(q.question.correctAnswer, 2)
  assert.ok(q.elements.some((e) => e.kind === 'text' && e.html === 'mine'), 'free text kept')
  assert.equal(q.elements.find((e) => e.kind === 'answer' && e.index === 1).style.background, null, 'legacy look not carried')
  assert.equal(q.elements.find((e) => e.widget === 'timer').props.variant, 'circle')
  // already-current documents are left alone
  const again = upgradeQuiz(JSON.parse(JSON.stringify(quiz)))
  assert.deepEqual(again.slides[1].elements.map((e) => e.id), q.elements.map((e) => e.id))
})

test('migration: library covers render with their template and direction', () => {
  const quiz = createQuizFromTemplate({ title: 'חידון', templateId: 'classic-black', language: 'he' })
  const cover = coverQuiz({ cover: quiz.slides[0], templateId: 'classic-black', title: 'חידון' })
  assert.equal(cover.templateId, 'classic-black')
  assert.equal(cover.language, 'he')
  assert.equal(cover.slides.length, 1)
  assert.equal(coverQuiz({ cover: null }), null)
})

test('fitFontSize: keeps short text at the base size and shrinks long text, never below min', () => {
  assert.equal(fitFontSize('תשובה 1', { w: 700, h: 120, base: 38 }), 38)
  const long = 'A system that does smart tasks like recognizing images, writing text, translating and much more than that'
  const fitted = fitFontSize(long, { w: 700, h: 120, base: 38 })
  assert.ok(fitted < 38 && fitted >= 18)
  assert.equal(fitFontSize('x'.repeat(2000), { w: 300, h: 60, base: 40, min: 20 }), 20)
  assert.equal(fitFontSize('', { w: 300, h: 60, base: 40 }), 40)
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
