/**
 * Shared layout engine for templates.
 *
 * A theme supplies colors, fonts, backgrounds and element styles; this module turns it into
 * concrete slide layouts (element lists in 1920×1080 units) for every slide type.
 * Positions are authored for LTR and mirrored horizontally for RTL content languages.
 */
import { SLIDE_W, ANSWER_INDICES } from '../constants.js'
import { createText, createImage, createShape, createAnswer, createWidget, isRtlLang } from '../schema.js'
import { contentT } from '../content-i18n.js'
import { textToHtml } from '../sanitize.js'

export function fontsFor(theme, lang) {
  return theme.fonts[lang] || theme.fonts.default
}

function mirrorX(ctx, x, w) {
  return ctx.rtl ? SLIDE_W - x - w : x
}

function makeCtx(theme, quiz) {
  const lang = quiz.language || 'he'
  return {
    theme,
    quiz,
    lang,
    rtl: isRtlLang(lang),
    fonts: fontsFor(theme, lang),
    t: (key, params) => contentT(lang, key, params),
  }
}

function title(ctx, { text, x, y, w, h, size, role = 'display', color, align = 'center', mirror = false, bold = true, extra = {} }) {
  const theme = ctx.theme
  return createText({
    x: mirror ? mirrorX(ctx, x, w) : x, y, w, h,
    html: textToHtml(text),
    fromTemplate: true,
    style: {
      fontFamily: role === 'display' ? ctx.fonts.display : ctx.fonts.body,
      fontSize: size,
      color: color || theme.colors.text,
      align,
      bold,
      textShadow: role === 'display' ? theme.text?.titleShadow || null : null,
      ...extra,
    },
  })
}

function widget(ctx, type, { x, y, w, h, props = {}, style = {}, mirror = true }) {
  const theme = ctx.theme
  return createWidget(type, {
    x: mirror ? mirrorX(ctx, x, w) : x, y, w, h,
    fromTemplate: true,
    props,
    style: {
      fontFamily: ctx.fonts.display,
      color: theme.colors.text,
      accent: theme.colors.accent,
      ink: theme.colors.ink,
      background: theme.widget.background,
      borderRadius: theme.widget.borderRadius,
      border: theme.widget.border,
      shadow: theme.widget.shadow,
      ...(theme.widgets?.[type] || {}),
      ...style,
    },
  })
}

function answers(ctx) {
  const theme = ctx.theme
  const cols = [110, 985]
  const rows = [730, 905]
  const w = 825
  const h = 155
  return ANSWER_INDICES.map((index) => {
    const col = (index - 1) % 2
    const row = index <= 2 ? 0 : 1
    return createAnswer(index, {
      x: mirrorX(ctx, cols[col], w), y: rows[row], w, h,
      fromTemplate: true,
      style: { fontFamily: ctx.fonts.display, ...theme.answer },
    })
  })
}

function decorations(ctx, type) {
  return ctx.theme.decorations ? ctx.theme.decorations(type, ctx, { createShape, mirrorX: (x, w) => mirrorX(ctx, x, w) }) : []
}

export function buildLayouts(theme) {
  return {
    opening(quiz) {
      const ctx = makeCtx(theme, quiz)
      const t = ctx.t
      return [
        ...decorations(ctx, 'opening'),
        title(ctx, { text: quiz.title || t('quizTitle'), x: 120, y: 60, w: 1680, h: 180, size: 104 }),
        title(ctx, { text: t('openingSubtitle'), x: 260, y: 245, w: 1400, h: 70, size: 32, role: 'body', bold: false, color: theme.colors.textMuted }),
        widget(ctx, 'game-pin', { x: 110, y: 390, w: 560, h: 190, props: { showLabel: true, label: t('pinLabel') } }),
        widget(ctx, 'qr-code', { x: 240, y: 610, w: 300, h: 390, props: { showLabel: true, label: t('scanToJoin') } }),
        widget(ctx, 'participants-list', {
          x: 760, y: 360, w: 1050, h: 660,
          props: { headerText: t('waitingForPlayers'), showCount: true, columns: 3, maxRows: 4, avatarStyle: theme.widgets?.participantsAvatar || 'card' },
        }),
      ]
    },

    question(quiz) {
      const ctx = makeCtx(theme, quiz)
      const t = ctx.t
      return [
        ...decorations(ctx, 'question'),
        widget(ctx, 'question-number', { x: 80, y: 44, w: 440, h: 72, props: { label: t('questionOf', { n: '{{n}}', total: '{{total}}' }) } }),
        createText({
          x: 200, y: 90, w: 1520, h: 210,
          binding: 'question',
          fromTemplate: true,
          style: { fontFamily: ctx.fonts.display, fontSize: 60, color: theme.colors.text, align: 'center', bold: true, autoFit: false, textShadow: theme.text?.titleShadow || null },
        }),
        createImage({
          x: 660, y: 320, w: 600, h: 370,
          binding: 'question-media',
          fromTemplate: true,
          placeholder: true,
          frame: 'rounded',
          borderRadius: 28,
          shadow: theme.widget.shadow,
        }),
        widget(ctx, 'timer', { x: 110, y: 400, w: 210, h: 210, props: { variant: theme.widgets?.timerVariant || 'circle', label: t('seconds') } }),
        widget(ctx, 'respondents', { x: 1600, y: 400, w: 210, h: 210, props: { variant: theme.widgets?.timerVariant || 'circle', showTotal: true, label: t('answered') } }),
        ...answers(ctx),
      ]
    },

    statistics(quiz) {
      const ctx = makeCtx(theme, quiz)
      const t = ctx.t
      return [
        ...decorations(ctx, 'statistics'),
        title(ctx, { text: t('statsTitle'), x: 160, y: 50, w: 1600, h: 140, size: 84 }),
        widget(ctx, 'answers-chart', { x: 260, y: 220, w: 1400, h: 800, props: { showValues: true, showShapes: true, barRadius: theme.answer.borderRadius > 30 ? 40 : 18, showQuestion: true }, mirror: false }),
      ]
    },

    leaderboard(quiz) {
      const ctx = makeCtx(theme, quiz)
      const t = ctx.t
      return [
        ...decorations(ctx, 'leaderboard'),
        title(ctx, { text: t('leaderboardTitle'), x: 160, y: 50, w: 1600, h: 140, size: 84 }),
        widget(ctx, 'leaderboard', { x: 410, y: 220, w: 1100, h: 810, props: { count: quiz.settings?.leaderboardSize || 5, variant: 'list', showAvatar: true, showScore: true }, mirror: false }),
      ]
    },

    transition(quiz) {
      const ctx = makeCtx(theme, quiz)
      const t = ctx.t
      return [
        ...decorations(ctx, 'transition'),
        title(ctx, { text: t('transitionTitle'), x: 160, y: 370, w: 1600, h: 190, size: 100 }),
        title(ctx, { text: t('transitionSubtitle'), x: 360, y: 580, w: 1200, h: 80, size: 40, role: 'body', bold: false, color: theme.colors.textMuted }),
      ]
    },

    summary(quiz) {
      const ctx = makeCtx(theme, quiz)
      const t = ctx.t
      return [
        ...decorations(ctx, 'summary'),
        title(ctx, { text: t('summaryTitle'), x: 160, y: 50, w: 1600, h: 150, size: 92 }),
        title(ctx, { text: t('summarySubtitle'), x: 360, y: 205, w: 1200, h: 70, size: 36, role: 'body', bold: false, color: theme.colors.textMuted }),
        widget(ctx, 'leaderboard', { x: 260, y: 300, w: 1400, h: 740, props: { count: 3, variant: 'podium', showAvatar: true, showScore: true }, mirror: false }),
      ]
    },
  }
}

/** Convenience for theme decoration hooks. */
export const gradient = (angle, ...stops) => ({
  kind: 'gradient',
  gradient: { angle, stops: stops.map(([color, at]) => ({ color, at })) },
})
export const solid = (color) => ({ kind: 'color', color })
export const image = (src, overlay = null) => ({ kind: 'image', src, overlay, fit: 'cover' })
