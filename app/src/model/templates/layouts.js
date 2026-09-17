/**
 * Shared layout engine for templates.
 *
 * A theme supplies the skin, tokens, fonts and background; this module turns it into concrete
 * slide layouts (element lists in 1920×1080 units) for every slide type. The geometry follows the
 * approved host-deck designs (and their PowerPoint export, game/new_design/quizngov.pptx).
 * Positions are authored for LTR and mirrored horizontally for RTL content languages.
 *
 * Answers and widgets carry no look of their own — the skin CSS draws them (SPEC FR-18).
 */
import { SLIDE_W, ANSWER_INDICES, QUESTION_LAYOUTS, DEFAULT_QUESTION_LAYOUT } from '../constants.js'
import { createText, createImage, createShape, createAnswer, createWidget, isRtlLang } from '../schema.js'
import { ANSWERS } from '../constants.js'
import { contentT } from '../content-i18n.js'
import { textToHtml } from '../sanitize.js'
import { fontsFor } from './base.js'

const PAD_X = 88

function makeCtx(theme, quiz) {
  const lang = quiz.language || 'he'
  const rtl = isRtlLang(lang)
  return {
    theme, quiz, lang, rtl,
    fonts: fontsFor(theme, lang),
    t: (key, params) => contentT(lang, key, params),
    mx: (x, w) => (rtl ? SLIDE_W - x - w : x),
  }
}

// ───────────────────────── Element helpers ─────────────────────────

function text(ctx, { text: value = '', x, y, w, h, size, role, binding = null, kind = 'title', align = 'center', valign = 'middle', extra = {} }) {
  const { theme, fonts } = ctx
  const display = kind !== 'body'
  const color = kind === 'eyebrow' ? theme.colors.eyebrow : kind === 'body' ? theme.colors.textMuted : theme.colors.text
  return createText({
    x: ctx.mx(x, w), y, w, h,
    html: textToHtml(value),
    binding,
    role: role || null,
    fromTemplate: true,
    style: {
      fontFamily: kind === 'eyebrow' ? fonts.eyebrow || fonts.display : display ? fonts.display : fonts.body,
      fontSize: size,
      color,
      align,
      valign,
      bold: kind !== 'body',
      lineHeight: kind === 'body' ? 1.25 : 1.06,
      letterSpacing: kind === 'eyebrow' && !ctx.rtl ? Math.round(size * (theme.text?.eyebrowSpacing ?? 0.14)) : 0,
      textShadow: kind === 'title' ? theme.text?.titleShadow || null : kind === 'eyebrow' ? theme.text?.eyebrowShadow || null : null,
      padding: 8,
      ...extra,
    },
  })
}

function widget(ctx, type, { x, y, w, h, props = {}, mirror = true }) {
  return createWidget(type, { x: mirror ? ctx.mx(x, w) : x, y, w, h, fromTemplate: true, props })
}

function answerGrid(ctx, { xs, ys, w, h, fontSize, imagePosition = 'start' }) {
  // xs.length === 2 → 2×2 grid (1,2 on the first row); xs.length === 1 → a single column.
  return ANSWER_INDICES.map((index) => {
    const col = xs.length === 2 ? (index - 1) % 2 : 0
    const row = xs.length === 2 ? Math.floor((index - 1) / 2) : index - 1
    return createAnswer(index, { x: ctx.mx(xs[col], w), y: ys[row], w, h, fromTemplate: true, style: { fontSize, imagePosition } })
  })
}

function questionText(ctx, { x, y, w, h, size, align = 'center' }) {
  return text(ctx, { x, y, w, h, size, binding: 'question', align })
}

function questionImage(ctx, { x, y, w, h, rotation = 0 }) {
  const img = ctx.theme.image
  return createImage({
    x: ctx.mx(x, w), y, w, h,
    rotation: ctx.rtl ? -rotation : rotation,
    binding: 'question-media',
    fromTemplate: true,
    placeholder: true,
    frame: 'rounded',
    borderRadius: img.borderRadius,
    border: img.border,
    shadow: img.shadow,
  })
}

/** Timer · question number · answered counter, across `x0..x0+width`. */
function questionBar(ctx, { x0 = PAD_X, width = SLIDE_W - PAD_X * 2, y = 64, compact = false }) {
  const timer = compact ? 118 : 150
  const counter = compact ? { w: 190, h: 118 } : { w: 214, h: 154 }
  const pill = { w: Math.min(520, width - timer - counter.w - 60), h: compact ? 70 : 78 }
  const t = ctx.t
  return [
    widget(ctx, 'timer', { x: x0, y, w: timer, h: timer, props: { variant: 'circle', label: '' } }),
    widget(ctx, 'question-number', { x: x0 + (width - pill.w) / 2, y: y + (timer - pill.h) / 2, w: pill.w, h: pill.h, props: { label: t('questionOf', { n: '{{n}}', total: '{{total}}' }) } }),
    widget(ctx, 'respondents', { x: x0 + width - counter.w, y: y - 2, w: counter.w, h: counter.h, props: { variant: 'box', showTotal: false, label: t('answers') } }),
  ]
}

const GRID_W = (SLIDE_W - PAD_X * 2 - 26) / 2 // 859
const GRID_XS = [PAD_X, PAD_X + GRID_W + 26]

const QUESTION_BUILDERS = {
  text: (ctx) => [
    ...questionBar(ctx, {}),
    questionText(ctx, { x: 140, y: 246, w: 1640, h: 340, size: 84 }),
    ...answerGrid(ctx, { xs: GRID_XS, ys: [630, 830], w: GRID_W, h: 170, fontSize: 42 }),
  ],
  banner: (ctx) => [
    ...questionBar(ctx, {}),
    questionText(ctx, { x: 140, y: 226, w: 1640, h: 132, size: 64 }),
    questionImage(ctx, { x: 410, y: 376, w: 1100, h: 272 }),
    ...answerGrid(ctx, { xs: GRID_XS, ys: [680, 856], w: GRID_W, h: 150, fontSize: 38 }),
  ],
  side: (ctx) => {
    const x0 = 704, width = SLIDE_W - PAD_X - x0
    return [
      questionImage(ctx, { x: PAD_X, y: 180, w: 560, h: 720, rotation: -2 }),
      ...questionBar(ctx, { x0, width, compact: true }),
      questionText(ctx, { x: x0, y: 204, w: width, h: 168, size: 60, align: 'start' }),
      ...answerGrid(ctx, { xs: [x0], ys: [392, 540, 688, 836], w: width, h: 124, fontSize: 36 }),
    ]
  },
  'image-answers': (ctx) => [
    ...questionBar(ctx, {}),
    questionText(ctx, { x: 140, y: 226, w: 1640, h: 112, size: 60 }),
    ...answerGrid(ctx, { xs: GRID_XS, ys: [352, 696], w: GRID_W, h: 318, fontSize: 32, imagePosition: 'top' }),
  ],
}

function shapesRow(ctx, y, size = 40, gap = 18) {
  const kinds = ['triangle', 'diamond', 'ellipse', 'rect']
  const total = size * 4 + gap * 3
  const start = (SLIDE_W - total) / 2
  return kinds.map((shape, i) => createShape({
    shape,
    x: start + i * (size + gap), y, w: size, h: size,
    fill: ANSWERS[i + 1].color,
    stroke: { width: 0, color: ctx.theme.colors.ink, dash: false },
    borderRadius: shape === 'rect' ? 8 : 0,
    fromTemplate: true,
    locked: true,
  }))
}

// ───────────────────────── Public ─────────────────────────

export function buildLayouts(theme) {
  return {
    opening(quiz) {
      const ctx = makeCtx(theme, quiz)
      const t = ctx.t
      return [
        widget(ctx, 'game-pin', { x: 445, y: 56, w: 794, h: 210, props: { showLabel: true, label: t('pinLabel'), showJoinUrl: true } }),
        widget(ctx, 'qr-code', { x: 1265, y: 56, w: 210, h: 210, props: { showLabel: false, label: t('scanToJoin') } }),
        text(ctx, { text: quiz.title || t('quizTitle'), binding: 'quiz-title', x: 160, y: 296, w: 1600, h: 136, size: 92 }),
        widget(ctx, 'participants-list', { x: 160, y: 452, w: 1600, h: 580, props: { headerText: t('waitingForPlayers'), showCount: true, columns: 5, maxRows: 4 }, mirror: false }),
      ]
    },

    question(quiz, { layout } = {}) {
      const ctx = makeCtx(theme, quiz)
      const build = QUESTION_BUILDERS[QUESTION_LAYOUTS.includes(layout) ? layout : DEFAULT_QUESTION_LAYOUT]
      return build(ctx)
    },

    statistics(quiz) {
      const ctx = makeCtx(theme, quiz)
      return [
        widget(ctx, 'answers-chart', { x: PAD_X, y: 56, w: SLIDE_W - PAD_X * 2, h: 968, props: { showValues: true, showShapes: true, showLabels: true, showQuestion: true, barRadius: 20 }, mirror: false }),
      ]
    },

    leaderboard(quiz) {
      const ctx = makeCtx(theme, quiz)
      const t = ctx.t
      return [
        text(ctx, { text: t('scoreboardEyebrow'), role: 'eyebrow', kind: 'eyebrow', x: 160, y: 60, w: 1600, h: 58, size: 32 }),
        text(ctx, { text: t('leaderboardTitle'), role: 'title', x: 160, y: 116, w: 1600, h: 122, size: 84 }),
        widget(ctx, 'leaderboard', { x: 320, y: 268, w: 1280, h: 764, props: { count: quiz.settings?.leaderboardSize || 5, variant: 'list', showAvatar: true, showScore: true }, mirror: false }),
      ]
    },

    transition(quiz) {
      const ctx = makeCtx(theme, quiz)
      const t = ctx.t
      return [
        ...shapesRow(ctx, 316),
        text(ctx, { text: t('transitionTitle'), role: 'title', x: 160, y: 384, w: 1600, h: 220, size: 132 }),
        text(ctx, { text: t('transitionSubtitle'), role: 'subtitle', kind: 'body', x: 360, y: 616, w: 1200, h: 90, size: 44 }),
      ]
    },

    summary(quiz) {
      const ctx = makeCtx(theme, quiz)
      const t = ctx.t
      return [
        text(ctx, { text: t('winnersEyebrow'), role: 'eyebrow', kind: 'eyebrow', x: 160, y: 50, w: 1600, h: 66, size: 38 }),
        text(ctx, { text: t('summaryTitle'), role: 'title', x: 160, y: 112, w: 1600, h: 116, size: 82 }),
        widget(ctx, 'leaderboard', { x: 360, y: 236, w: 1200, h: 844, props: { count: 3, variant: 'podium', showAvatar: true, showScore: true }, mirror: false }),
      ]
    },
  }
}
