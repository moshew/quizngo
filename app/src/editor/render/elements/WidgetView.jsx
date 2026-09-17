import React, { useMemo } from 'react'
import { ANSWERS, ANSWER_INDICES } from '../../../model/constants.js'
import { effectiveTimeLimit, previousQuestionSlide, questionNumber, questionSlides, slideIndexById } from '../../../model/schema.js'
import { sampleLiveData, formatPin } from '../../../model/sample.js'
import { contentT } from '../../../model/content-i18n.js'
import { isLightColor, withAlpha } from '../color.js'
import { AnswerGlyph } from './AnswerView.jsx'

function surfaceStyle(style) {
  const border = style.border && style.border.width > 0 ? `${style.border.width}px solid ${style.border.color}` : undefined
  return {
    background: style.background || undefined,
    borderRadius: style.borderRadius,
    border,
    boxShadow: style.shadow || undefined,
    fontFamily: `"${style.fontFamily}", "Rubik", sans-serif`,
  }
}

/** Foreground color that reads on the widget surface. */
function fgFor(style) {
  if (style.background && isLightColor(style.background)) return style.ink || '#1a0a2e'
  return style.color || '#ffffff'
}

export default function WidgetView({ el, quiz, slide, mode, liveData }) {
  const lang = quiz?.language || 'he'
  const data = useMemo(() => liveData || sampleLiveData(lang), [liveData, lang])
  const props = el.props || {}
  const style = el.style || {}
  const fg = fgFor(style)
  const ctx = { el, quiz, slide, props, style, fg, data, lang, mode, t: (k, p) => contentT(lang, k, p) }

  switch (el.widget) {
    case 'game-pin': return <GamePin {...ctx} />
    case 'qr-code': return <QrCode {...ctx} />
    case 'participants-count': return <ParticipantsCount {...ctx} />
    case 'participants-list': return <ParticipantsList {...ctx} />
    case 'timer': return <Timer {...ctx} />
    case 'respondents': return <Respondents {...ctx} />
    case 'answers-chart': return <AnswersChart {...ctx} />
    case 'leaderboard': return <Leaderboard {...ctx} />
    case 'question-number': return <QuestionNumber {...ctx} />
    default: return null
  }
}

// ───────────────────────── Simple value cards ─────────────────────────

function GamePin({ el, props, style, fg, data }) {
  const digits = formatPin(data.gamePin)
  return (
    <div className="wg wg-pin" style={{ ...surfaceStyle(style), color: fg }}>
      {props.showLabel && props.label && <div className="wg-label" style={{ fontSize: el.h * 0.16 }}>{props.label}</div>}
      <div className="wg-value ltr" style={{ fontSize: el.h * (props.showLabel && props.label ? 0.5 : 0.62), letterSpacing: el.h * 0.02 }}>{digits}</div>
    </div>
  )
}

function ParticipantsCount({ el, props, style, fg, data, t }) {
  return (
    <div className="wg wg-count" style={{ ...surfaceStyle(style), color: fg }}>
      <div className="wg-value" style={{ fontSize: el.h * 0.58 }}>{data.participantsCount}</div>
      {props.showLabel && <div className="wg-label" style={{ fontSize: el.h * 0.2 }}>{props.label || t('participants')}</div>}
    </div>
  )
}

function QuestionNumber({ el, quiz, slide, props, style, fg, t }) {
  const n = questionNumber(quiz, slide?.id) || 1
  const total = Math.max(questionSlides(quiz).length, 1)
  const pattern = props.label || t('questionOf', { n: '{{n}}', total: '{{total}}' })
  const text = pattern.replace('{{n}}', n).replace('{{total}}', total)
  return (
    <div className="wg wg-qnum" style={{ ...surfaceStyle(style), color: fg, fontSize: el.h * 0.5, borderRadius: style.borderRadius }}>
      <span dir="auto">{text}</span>
    </div>
  )
}

// ───────────────────────── QR (deterministic placeholder pattern) ─────────────────────────

function pseudoQrModules(seed, size = 25) {
  let s = 0
  for (const ch of seed) s = (s * 31 + ch.charCodeAt(0)) >>> 0
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
  const grid = []
  for (let y = 0; y < size; y++) {
    const row = []
    for (let x = 0; x < size; x++) row.push(rnd() > 0.5)
    grid.push(row)
  }
  const finder = (ox, oy) => {
    for (let y = -1; y < 8; y++) for (let x = -1; x < 8; x++) {
      const gx = ox + x, gy = oy + y
      if (gx < 0 || gy < 0 || gx >= size || gy >= size) continue
      const ring = x === -1 || y === -1 || x === 7 || y === 7
      const outer = x === 0 || y === 0 || x === 6 || y === 6
      const inner = x >= 2 && x <= 4 && y >= 2 && y <= 4
      grid[gy][gx] = ring ? false : outer || inner
    }
  }
  finder(0, 0); finder(size - 7, 0); finder(0, size - 7)
  return grid
}

export function QrSvg({ seed = 'quizngo', size = 200, dark = '#1a0a2e', light = '#ffffff' }) {
  const modules = useMemo(() => pseudoQrModules(seed), [seed])
  const n = modules.length
  const cell = size / (n + 4)
  const rects = []
  modules.forEach((row, y) => row.forEach((on, x) => {
    if (on) rects.push(<rect key={`${x}-${y}`} x={(x + 2) * cell} y={(y + 2) * cell} width={cell} height={cell} fill={dark} />)
  }))
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges" aria-hidden="true">
      <rect width={size} height={size} fill={light} />
      {rects}
    </svg>
  )
}

function QrCode({ el, props, style, fg, data }) {
  const labelH = props.showLabel && props.label ? el.h * 0.16 : 0
  const pad = Math.min(el.w, el.h) * 0.08
  const qrSize = Math.max(20, Math.min(el.w - pad * 2, el.h - labelH - pad * 2))
  const lightSurface = style.background && isLightColor(style.background)
  return (
    <div className="wg wg-qr" style={{ ...surfaceStyle(style), color: fg, padding: pad }}>
      <div className="wg-qr-box" style={{ width: qrSize, height: qrSize, borderRadius: Math.min(style.borderRadius * 0.5, 18), background: '#fff', padding: lightSurface ? 0 : qrSize * 0.04 }}>
        <QrSvg seed={data.joinUrl + data.gamePin} size={lightSurface ? qrSize : qrSize * 0.92} dark={style.ink || '#1a0a2e'} />
      </div>
      {props.showLabel && props.label && <div className="wg-label" style={{ fontSize: labelH * 0.55 }}>{props.label}</div>}
    </div>
  )
}

// ───────────────────────── Timer / respondents (ring) ─────────────────────────

function Ring({ size, value, max, color, track, fg, label, labelSize, children, stroke }) {
  const r = size / 2 - stroke / 2 - 2
  const c = 2 * Math.PI * r
  const ratio = max ? Math.min(1, Math.max(0, value / max)) : 1
  return (
    <div className="wg-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - ratio)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div className="wg-ring-center" style={{ color: fg }}>
        {children}
        {label && <div className="wg-label" style={{ fontSize: labelSize }}>{label}</div>}
      </div>
    </div>
  )
}

function Timer({ el, quiz, slide, props, style, fg, data }) {
  const total = effectiveTimeLimit(quiz, slide)
  const value = data.timeLeft ?? total
  const size = Math.min(el.w, el.h)
  const variant = props.variant || 'circle'
  if (variant === 'number') {
    return <div className="wg wg-number" style={{ color: style.color, fontFamily: `"${style.fontFamily}", sans-serif`, fontSize: el.h * 0.8 }}>{value}</div>
  }
  if (variant === 'pill') {
    return (
      <div className="wg wg-pill" style={{ ...surfaceStyle(style), color: fg, borderRadius: 999, fontSize: el.h * 0.5 }}>
        <svg width={el.h * 0.45} height={el.h * 0.45} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
        <span className="ltr">{value}</span>
      </div>
    )
  }
  const stroke = Math.max(8, size * 0.075)
  return (
    <div className="wg wg-circle" style={{ ...surfaceStyle(style), borderRadius: '50%', width: size, height: size }}>
      <Ring size={size} value={value} max={total} color={style.accent} track={withAlpha(fg, 0.15)} fg={fg} stroke={stroke} label={props.label} labelSize={size * 0.11}>
        <div className="wg-value ltr" style={{ fontSize: size * (props.label ? 0.36 : 0.44) }}>{value}</div>
      </Ring>
    </div>
  )
}

function Respondents({ el, props, style, fg, data }) {
  const answered = data.respondents ?? 0
  const total = data.participantsCount ?? 0
  const size = Math.min(el.w, el.h)
  const variant = props.variant || 'circle'
  const text = props.showTotal ? `${answered}/${total}` : `${answered}`
  if (variant === 'number') {
    return <div className="wg wg-number ltr" style={{ color: style.color, fontFamily: `"${style.fontFamily}", sans-serif`, fontSize: el.h * 0.7 }}>{text}</div>
  }
  if (variant === 'pill') {
    return (
      <div className="wg wg-pill" style={{ ...surfaceStyle(style), color: fg, borderRadius: 999, fontSize: el.h * 0.45 }}>
        <svg width={el.h * 0.45} height={el.h * 0.45} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></svg>
        <span className="ltr">{text}</span>
        {props.label && <span style={{ fontSize: el.h * 0.28, opacity: 0.8 }}>{props.label}</span>}
      </div>
    )
  }
  const stroke = Math.max(8, size * 0.075)
  return (
    <div className="wg wg-circle" style={{ ...surfaceStyle(style), borderRadius: '50%', width: size, height: size }}>
      <Ring size={size} value={answered} max={total} color={style.accent} track={withAlpha(fg, 0.15)} fg={fg} stroke={stroke} label={props.label} labelSize={size * 0.11}>
        <div className="wg-value ltr" style={{ fontSize: size * (props.showTotal ? 0.24 : 0.4) }}>{text}</div>
      </Ring>
    </div>
  )
}

// ───────────────────────── Participants list ─────────────────────────

function avatarStyleFor(kind, style) {
  switch (kind) {
    case 'pill':
      return { background: 'rgba(0,0,0,0.55)', color: '#fff', border: `3px solid ${style.accent}`, borderRadius: 999, boxShadow: '0 8px 20px rgba(0,0,0,0.35)' }
    case 'glass':
      return { background: 'rgba(255,255,255,0.16)', color: '#fff', border: '2px solid rgba(255,255,255,0.45)', borderRadius: 22, boxShadow: '0 8px 20px rgba(0,0,0,0.18)', backdropFilter: 'blur(6px)' }
    case 'card':
    default:
      return { background: '#fff', color: style.ink || '#1a0a2e', border: `3px solid ${style.ink || '#1a0a2e'}`, borderRadius: 20, boxShadow: `0 5px 0 ${style.ink || '#1a0a2e'}` }
  }
}

function ParticipantsList({ el, props, style, fg, data, t }) {
  const columns = Math.max(1, Math.min(6, props.columns || 3))
  const maxRows = Math.max(1, Math.min(8, props.maxRows || 4))
  const shown = data.participants.slice(0, columns * maxRows)
  const pad = Math.min(el.w, el.h) * 0.045
  const headerH = props.headerText || props.showCount ? el.h * 0.13 : 0
  const gap = pad * 0.6
  const gridH = el.h - pad * 2 - headerH
  const cellH = Math.min(96, (gridH - gap * (maxRows - 1)) / maxRows)
  const avatar = avatarStyleFor(props.avatarStyle, style)
  const fontSize = cellH * 0.36

  return (
    <div className="wg wg-plist" style={{ ...surfaceStyle(style), color: fg, padding: pad, gap: pad * 0.6 }}>
      {headerH > 0 && (
        <div className="wg-plist-header" style={{ height: headerH, fontSize: headerH * 0.48 }}>
          <span className="truncate" dir="auto">{props.headerText}</span>
          {props.showCount && (
            <span className="wg-plist-count" style={{ background: style.accent, color: style.ink || '#1a0a2e', fontSize: headerH * 0.42, borderRadius: 999, padding: `0 ${headerH * 0.4}px`, height: headerH * 0.8 }}>
              <span className="ltr">{data.participantsCount}</span>
            </span>
          )}
        </div>
      )}
      <div className="wg-plist-grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap, alignContent: 'start' }}>
        {shown.map((p) => (
          <div key={p.id} className="wg-avatar" style={{ ...avatar, height: cellH, fontSize, paddingInline: cellH * 0.18, gap: cellH * 0.16 }}>
            <span className="wg-avatar-icon" style={{ width: cellH * 0.64, height: cellH * 0.64, fontSize: cellH * 0.38, borderRadius: props.avatarStyle === 'pill' ? '50%' : cellH * 0.18, border: `2px solid ${avatar.color === '#fff' ? 'rgba(255,255,255,0.5)' : style.ink || '#1a0a2e'}` }}>{p.icon}</span>
            <span className="truncate" dir="auto">{p.nickname}</span>
          </div>
        ))}
        {shown.length === 0 && <div className="dim" style={{ gridColumn: '1 / -1', fontSize: fontSize }}>{t('waitingForPlayers')}</div>}
      </div>
    </div>
  )
}

// ───────────────────────── Answers chart ─────────────────────────

function AnswersChart({ el, quiz, slide, props, style, fg, data, lang }) {
  const dist = data.distribution || {}
  const max = Math.max(1, ...ANSWER_INDICES.map((i) => dist[i] || 0))
  const pad = Math.min(el.w, el.h) * 0.05
  const idx = slideIndexById(quiz, slide?.id)
  const prev = props.showQuestion ? previousQuestionSlide(quiz, idx) : null
  const qText = prev?.question?.text || (props.showQuestion ? contentT(lang, 'sampleQuestion') : '')
  const questionH = props.showQuestion ? el.h * 0.16 : 0
  const glyphH = props.showShapes ? el.h * 0.12 : 0
  const valueH = props.showValues ? el.h * 0.1 : 0
  const barsH = el.h - pad * 2 - questionH - glyphH - valueH
  const correct = prev?.question?.correctAnswer

  return (
    <div className="wg wg-chart" style={{ ...surfaceStyle(style), color: fg, padding: pad }}>
      {props.showQuestion && (
        <div className="wg-chart-question truncate" dir="auto" style={{ height: questionH, fontSize: questionH * 0.42 }}>{qText}</div>
      )}
      <div className="wg-chart-bars" style={{ height: barsH + valueH, gap: pad }}>
        {ANSWER_INDICES.map((i) => {
          const v = dist[i] || 0
          const h = Math.max(barsH * 0.03, (v / max) * barsH)
          const dim = correct && correct !== i
          return (
            <div key={i} className="wg-chart-col">
              {props.showValues && <div className="wg-chart-value ltr" style={{ height: valueH, fontSize: valueH * 0.75 }}>{v}</div>}
              <div className="wg-chart-bar" style={{ height: h, background: ANSWERS[i].color, borderRadius: `${props.barRadius}px ${props.barRadius}px 6px 6px`, opacity: dim ? 0.55 : 1, boxShadow: `0 6px 0 ${ANSWERS[i].dark}` }}>
                {correct === i && <span className="wg-chart-check" style={{ fontSize: Math.min(h, el.w * 0.06) * 0.6 }}>✓</span>}
              </div>
            </div>
          )
        })}
      </div>
      {props.showShapes && (
        <div className="wg-chart-glyphs" style={{ height: glyphH, gap: pad }}>
          {ANSWER_INDICES.map((i) => (
            <div key={i} className="wg-chart-col">
              <span className="wg-chart-glyph" style={{ background: ANSWERS[i].color, width: glyphH * 0.8, height: glyphH * 0.8, borderRadius: glyphH * 0.22 }}>
                <AnswerGlyph index={i} color={i === 3 ? '#1a0a2e' : '#fff'} size={glyphH * 0.5} />
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ───────────────────────── Leaderboard ─────────────────────────

function Leaderboard({ el, props, style, fg, data, t }) {
  const count = Math.max(1, Math.min(10, props.count || 5))
  const rows = data.leaderboard.slice(0, count)
  const pad = Math.min(el.w, el.h) * 0.04
  const lightSurface = style.background && isLightColor(style.background)

  if (props.variant === 'podium') {
    const top = rows.slice(0, 3)
    const order = [top[1], top[0], top[2]]
    const heights = [0.5, 0.7, 0.4]
    const usableH = el.h - pad * 2
    const nameH = usableH * 0.14
    const tileSize = Math.min(el.w / 3 * 0.42, usableH * 0.22)
    return (
      <div className="wg wg-podium" style={{ color: fg, padding: pad, gap: pad, fontFamily: `"${style.fontFamily}", sans-serif` }}>
        {order.map((p, i) => {
          const rank = i === 1 ? 1 : i === 0 ? 2 : 3
          if (!p) return <div key={rank} className="wg-podium-col" />
          const blockH = usableH * heights[i] * 0.85
          return (
            <div key={rank} className="wg-podium-col">
              <span className="wg-podium-avatar" style={{ width: tileSize, height: tileSize, fontSize: tileSize * 0.55, background: rank === 1 ? style.accent : '#fff', border: `4px solid ${style.ink || '#1a0a2e'}`, borderRadius: tileSize * 0.28, boxShadow: `0 8px 0 ${style.ink || '#1a0a2e'}` }}>{p.icon}</span>
              <div className="wg-podium-name truncate" dir="auto" style={{ fontSize: nameH * 0.55, height: nameH }}>{p.nickname}</div>
              <div className="wg-podium-block" style={{ height: blockH, background: style.background || 'rgba(255,255,255,0.14)', border: style.border && style.border.width ? `${style.border.width}px solid ${style.border.color}` : undefined, borderRadius: `${style.borderRadius}px ${style.borderRadius}px 0 0`, boxShadow: style.shadow || undefined, color: lightSurface ? style.ink : fg }}>
                <div className="wg-podium-rank" style={{ fontSize: blockH * 0.32 }}>{rank}</div>
                {props.showScore && <div className="wg-podium-score ltr" style={{ fontSize: blockH * 0.14 }}>{p.score.toLocaleString()} {t('points')}</div>}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const gap = pad * 0.5
  const rowH = Math.min(110, (el.h - pad * 2 - gap * (count - 1)) / count)
  const rowStyle = {
    background: style.background || 'rgba(255,255,255,0.12)',
    color: lightSurface ? style.ink : fg,
    border: style.border && style.border.width ? `${style.border.width}px solid ${style.border.color}` : undefined,
    borderRadius: Math.min(style.borderRadius, rowH / 2),
    boxShadow: style.shadow || undefined,
    height: rowH,
    fontSize: rowH * 0.4,
    paddingInline: rowH * 0.25,
    gap: rowH * 0.22,
  }
  return (
    <div className="wg wg-lb" style={{ padding: pad, gap, fontFamily: `"${style.fontFamily}", sans-serif` }}>
      {rows.map((p, i) => (
        <div key={p.id} className={`wg-lb-row ${i === 0 ? 'is-first' : ''}`} style={rowStyle}>
          <span className="wg-lb-rank" style={{ width: rowH * 0.62, height: rowH * 0.62, fontSize: rowH * 0.32, background: i === 0 ? style.accent : withAlpha(rowStyle.color, 0.12), color: i === 0 ? style.ink || '#1a0a2e' : 'inherit', borderRadius: rowH * 0.2 }}>{i + 1}</span>
          {props.showAvatar && <span className="wg-lb-avatar" style={{ fontSize: rowH * 0.42 }}>{p.icon}</span>}
          <span className="wg-lb-name truncate grow" dir="auto">{p.nickname}</span>
          {props.showScore && <span className="wg-lb-score ltr" style={{ fontSize: rowH * 0.34 }}>{p.score.toLocaleString()}</span>}
        </div>
      ))}
    </div>
  )
}
