import React, { useMemo } from 'react'
import { ANSWERS, ANSWER_INDICES } from '../../../model/constants.js'
import { effectiveTimeLimit, previousQuestionSlide, questionNumber, questionSlides, slideIndexById } from '../../../model/schema.js'
import { sampleLiveData, formatPin } from '../../../model/sample.js'
import { contentT } from '../../../model/content-i18n.js'
import { isLightColor } from '../color.js'
import { AnswerGlyph, skinOverrides } from './AnswerView.jsx'

/**
 * Dynamic game widgets. Each renders ONE semantic markup; the template's skin draws it
 * (styles/skins/*.css). Sizes are expressed relative to the element box through the
 * `--w / --h / --m` variables so widgets stay resizable. Author overrides (non-null style
 * fields) are applied inline on the widget's main surface.
 */

function boxVars(el) {
  return { '--w': `${el.w}px`, '--h': `${el.h}px`, '--m': `${Math.min(el.w, el.h)}px` }
}

/** Inline overrides for a widget surface (+ readable foreground on an author-picked light fill). */
function surface(style) {
  const out = skinOverrides(style)
  if (style.background && !style.color) out.color = isLightColor(style.background) ? (style.ink || 'var(--t-ink)') : '#ffffff'
  if (style.accent) out['--w-accent'] = style.accent
  if (style.ink) out['--w-ink'] = style.ink
  return out
}

export default function WidgetView({ el, quiz, slide, mode, liveData }) {
  const lang = quiz?.language || 'he'
  const data = useMemo(() => liveData || sampleLiveData(lang), [liveData, lang])
  const props = el.props || {}
  const style = el.style || {}
  const ctx = { el, quiz, slide, props, style, data, lang, mode, vars: boxVars(el), t: (k, p) => contentT(lang, k, p) }

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

// ───────────────────────── Join card (game PIN) ─────────────────────────

function GamePin({ el, props, style, data, vars, t }) {
  const digits = formatPin(data.gamePin)
  const host = String(data.joinUrl || '').replace(/^https?:\/\//, '').replace(/\/$/, '')
  const withUrl = props.showJoinUrl && host && el.w / el.h >= 3
  return (
    <div className={`wg wg-join ${withUrl ? 'has-url' : ''}`} style={{ ...vars, ...surface(style) }}>
      {withUrl && (
        <>
          <div className="join-left">
            <div className="sm">{t('joinAt')}<b className="ltr">{host}</b></div>
            <div className="sm">{t('joinOr')}</div>
          </div>
          <div className="join-divider" />
        </>
      )}
      <div className="join-right">
        {props.showLabel && <div className="lbl">{props.label || t('pinLabel')}</div>}
        <div className="pin ltr">{digits}</div>
      </div>
    </div>
  )
}

function ParticipantsCount({ props, style, data, vars, t }) {
  return (
    <div className="wg wg-count" style={{ ...vars, ...surface(style) }}>
      <span className="n ltr">{data.participantsCount}</span>
      {props.showLabel && <span className="l">{props.label || t('participants')}</span>}
    </div>
  )
}

function QuestionNumber({ quiz, slide, props, style, vars, t }) {
  const n = questionNumber(quiz, slide?.id) || 1
  const total = Math.max(questionSlides(quiz).length, 1)
  const pattern = props.label || t('questionOf', { n: '{{n}}', total: '{{total}}' })
  const text = pattern.replace('{{n}}', n).replace('{{total}}', total)
  return (
    <div className="wg wg-qnum" style={vars}>
      <span className="qnum" dir="auto" style={surface(style)}>{text}</span>
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

export function QrSvg({ seed = 'quizngo', dark = '#1a0a2e', light = '#ffffff' }) {
  const modules = useMemo(() => pseudoQrModules(seed), [seed])
  const n = modules.length
  const rects = []
  modules.forEach((row, y) => row.forEach((on, x) => {
    if (on) rects.push(<rect key={`${x}-${y}`} x={x + 1} y={y + 1} width={1.02} height={1.02} fill={dark} />)
  }))
  return (
    <svg viewBox={`0 0 ${n + 2} ${n + 2}`} shapeRendering="crispEdges" aria-hidden="true">
      <rect width={n + 2} height={n + 2} fill={light} />
      {rects}
    </svg>
  )
}

function QrCode({ props, style, data, vars }) {
  const labeled = props.showLabel && props.label
  return (
    <div className={`wg wg-qr ${labeled ? 'has-label' : ''}`} style={{ ...vars, ...surface(style) }}>
      <div className="qr-box"><QrSvg seed={data.joinUrl + data.gamePin} dark="#0b0614" /></div>
      {labeled && <div className="lbl">{props.label}</div>}
    </div>
  )
}

// ───────────────────────── Timer / answered ─────────────────────────

function Ring({ ratio }) {
  const r = 43, c = 2 * Math.PI * r
  return (
    <svg className="ring" viewBox="0 0 100 100" aria-hidden="true">
      <circle className="ring-track" cx="50" cy="50" r={r} />
      <circle className="ring-fill" cx="50" cy="50" r={r} strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, Math.max(0, ratio)))} transform="rotate(-90 50 50)" />
    </svg>
  )
}

const ClockIcon = () => <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
const PeopleIcon = () => <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></svg>

function Timer({ quiz, slide, props, style, data, vars }) {
  const total = effectiveTimeLimit(quiz, slide)
  const value = data.timeLeft ?? total
  // In the editor the clock is full; show a partly used ring so the design reads as a timer.
  const ratio = data.timeLeft == null ? 0.78 : total ? value / total : 1
  const variant = props.variant || 'circle'
  if (variant === 'number') return <div className="wg wg-number ltr" style={{ ...vars, ...surface(style) }}>{value}</div>
  if (variant === 'pill') return <div className="wg wg-pill" style={{ ...vars, ...surface(style) }}><ClockIcon /><span className="ltr">{value}</span></div>
  return (
    <div className="wg wg-timer" style={vars}>
      <div className="timer">
        <div className="disc" style={surface(style)} />
        <Ring ratio={ratio} />
        <div className="num ltr">{value}{props.label && <small>{props.label}</small>}</div>
      </div>
    </div>
  )
}

function Respondents({ props, style, data, vars }) {
  const answered = data.respondents ?? 0
  const total = data.participantsCount ?? 0
  const text = props.showTotal ? `${answered}/${total}` : `${answered}`
  const variant = props.variant || 'box'
  if (variant === 'number') return <div className="wg wg-number ltr" style={{ ...vars, ...surface(style) }}>{text}</div>
  if (variant === 'pill') return <div className="wg wg-pill" style={{ ...vars, ...surface(style) }}><PeopleIcon /><span className="ltr">{text}</span>{props.label && <small>{props.label}</small>}</div>
  if (variant === 'circle') {
    return (
      <div className="wg wg-timer" style={vars}>
        <div className="timer">
          <div className="disc" style={surface(style)} />
          <Ring ratio={total ? answered / total : 0} />
          <div className={`num ltr ${props.showTotal ? 'is-long' : ''}`}>{text}{props.label && <small>{props.label}</small>}</div>
        </div>
      </div>
    )
  }
  return (
    <div className={`wg wg-answered ${props.showTotal ? 'is-long' : ''}`} style={{ ...vars, ...surface(style) }}>
      <span className="n ltr">{text}</span>
      {props.label && <span className="l">{props.label}</span>}
    </div>
  )
}

// ───────────────────────── Lobby: players ─────────────────────────

function ParticipantsList({ el, props, style, data, vars, t }) {
  const columns = Math.max(1, Math.min(8, props.columns || 5))
  const maxRows = Math.max(1, Math.min(8, props.maxRows || 4))
  const shown = data.participants.slice(0, columns * maxRows)
  const hasHeader = !!(props.headerText || props.showCount)
  const headerH = hasHeader ? Math.min(96, el.h * 0.18) : 0
  const gap = 18
  const chipH = Math.max(34, Math.min(78, (el.h - headerH - (hasHeader ? 30 : 0) - gap * (maxRows - 1)) / maxRows))
  return (
    <div className="wg wg-players" style={{ ...vars, '--chip': `${chipH}px`, '--head': `${headerH}px` }}>
      {hasHeader && (
        <div className="waiting-pill">
          <span className="emoji">👾</span>
          {props.headerText && <span dir="auto">{props.headerText}</span>}
          {props.showCount && <span className="count"><b className="ltr">{data.participantsCount}</b>&nbsp;{t('playersIn')}</span>}
        </div>
      )}
      <div className="player-grid" style={{ gap, maxWidth: columns * (chipH * 3.7 + gap) }}>
        {shown.map((p) => (
          <div key={p.id} className="pchip" style={surface(style)}>
            <span className="av">{p.icon}</span>
            <span className="nm" dir="auto">{p.nickname}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ───────────────────────── Results graph ─────────────────────────

function AnswersChart({ el, quiz, slide, props, style, data, lang, mode, vars, t }) {
  const dist = data.distribution || {}
  const max = Math.max(1, ...ANSWER_INDICES.map((i) => dist[i] || 0))
  const idx = slideIndexById(quiz, slide?.id)
  const prev = previousQuestionSlide(quiz, idx)
  const prevNumber = prev ? questionNumber(quiz, prev.id) : 1
  const question = prev?.question
  // On the projector an unwritten question shows nothing rather than the editor's placeholder.
  const qText = question?.text || (mode === 'preview' ? '' : contentT(lang, 'sampleQuestion'))
  const correct = question?.correctAnswer ?? (mode === 'preview' ? null : 1)

  const headH = props.showQuestion ? Math.min(190, el.h * 0.2) : 0
  const countH = props.showValues ? 82 : 0
  const flagH = 66
  const baseH = props.showShapes || props.showLabels ? 84 : 0
  const barsH = Math.max(60, el.h - headH - countH - flagH - baseH)

  return (
    <div className="wg wg-graph" style={{ ...vars, ...surface(style) }}>
      {props.showQuestion && (
        <div className="graph-head" style={{ height: headH }}>
          <div className="eyebrow">{t('resultsEyebrow', { n: prevNumber })}</div>
          <div className="qtext" dir="auto">{qText}</div>
        </div>
      )}
      <div className="graph">
        {ANSWER_INDICES.map((i) => {
          const v = dist[i] || 0
          const h = Math.max(barsH * 0.07, (v / max) * barsH)
          const label = question?.answers?.[i - 1]?.text || contentT(lang, 'sampleAnswer', { n: i })
          return (
            <div key={i} className={`gcol ${correct && correct !== i ? 'dim' : ''}`}>
              {correct === i && <div className="correct-flag">✓ {t('correct')}</div>}
              {props.showValues && <div className="gcount ltr">{v}</div>}
              <div className={`gbar c-${ANSWERS[i].name}`} style={{ height: h, borderTopLeftRadius: props.barRadius, borderTopRightRadius: props.barRadius }} />
              {baseH > 0 && (
                <div className="base" style={{ height: baseH }}>
                  {props.showShapes && <span className={`glyph c-${ANSWERS[i].name}`}><AnswerGlyph index={i} /></span>}
                  {props.showLabels !== false && <span className="lbl" dir="auto">{label}</span>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ───────────────────────── Leaderboard / podium ─────────────────────────

const AVATAR_TINTS = ['var(--t-surface, #fff)', 'var(--t-secondary)', 'var(--t-danger)', 'var(--t-primary)']

function Leaderboard({ el, props, style, data, vars, t }) {
  const count = Math.max(1, Math.min(10, props.count || 5))
  const rows = data.leaderboard.slice(0, count)

  if (props.variant === 'podium') {
    const top = rows.slice(0, 3)
    const order = [[top[1], 2], [top[0], 1], [top[2], 3]]
    const medals = { 1: '🏆', 2: '🥈', 3: '🥉' }
    // Column anatomy follows the design (blocks 336/252/190 on a 1080 slide), scaled to the box.
    const k = Math.min(1, el.h / 844, el.w / 1000)
    return (
      <div className="wg wg-podium" style={{ ...vars, '--k': k }}>
        {order.map(([p, rank]) => (
          <div key={rank} className={`pod p${rank}`}>
            {p && (
              <>
                <div className="medal">{medals[rank]}</div>
                {props.showAvatar && <div className="av">{p.icon}</div>}
                <div className="nm" dir="auto">{p.nickname}</div>
                {props.showScore && <div className="sc ltr">{p.score.toLocaleString()}</div>}
              </>
            )}
            <div className="block" style={surface(style)}>{rank}</div>
          </div>
        ))}
      </div>
    )
  }

  const gap = Math.min(26, el.h * 0.03)
  const rowH = Math.max(40, Math.min(132, (el.h - 14 - gap * (count - 1)) / count))
  return (
    <div className="wg wg-board" style={{ ...vars, '--row': `${rowH}px`, gap }}>
      {rows.map((p, i) => (
        <div key={p.id} className={`row ${i === 0 ? 'lead' : ''}`} style={surface(style)}>
          <span className="rk ltr">{i + 1}</span>
          {props.showAvatar && <span className="av" style={{ '--tint': AVATAR_TINTS[i % AVATAR_TINTS.length] }}>{p.icon}</span>}
          <span className="nm" dir="auto">{p.nickname}</span>
          {p.delta ? <span className="delta ltr">+{p.delta}</span> : null}
          {props.showScore && <span className="sc ltr">{p.score.toLocaleString()}</span>}
        </div>
      ))}
      {rows.length === 0 && <div className="row is-empty">{t('waitingForPlayers')}</div>}
    </div>
  )
}
