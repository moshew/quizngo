import React, { memo } from 'react'

/**
 * The template's atmospheric layer (SPEC FR-18): drawn above the background and below every
 * element, never selectable. Pure CSS — see styles/skins/decor.css. Motion runs in preview only.
 */

// Deterministic pseudo-random so canvas, thumbnails and preview paint identical pieces.
function rng(seed) {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}

const CONFETTI = (() => {
  const rnd = rng(7)
  const colors = ['var(--t-primary)', 'var(--t-secondary)', 'var(--t-danger)', '#ffffff', 'var(--c-blue)', 'var(--c-green)']
  return Array.from({ length: 56 }, (_, i) => ({
    left: `${(rnd() * 100).toFixed(2)}%`,
    top: `${(rnd() * 100).toFixed(2)}%`,
    rotate: Math.round(rnd() * 360),
    color: colors[i % colors.length],
    duration: (4 + rnd() * 4).toFixed(2),
    delay: (-rnd() * 8).toFixed(2),
    round: i % 5 === 0,
  }))
})()

const STARS = (() => {
  const rnd = rng(42)
  return Array.from({ length: 30 }, () => ({
    left: `${(rnd() * 100).toFixed(2)}%`,
    top: `${(rnd() * 62).toFixed(2)}%`,
    size: (2 + rnd() * 2.5).toFixed(1),
    duration: (3 + rnd() * 4).toFixed(1),
    delay: (-rnd() * 6).toFixed(1),
  }))
})()

function Confetti() {
  return (
    <div className="decor-confetti">
      {CONFETTI.map((c, i) => (
        <i key={i} className={c.round ? 'round' : ''} style={{ left: c.left, '--top': c.top, '--rot': `${c.rotate}deg`, background: c.color, animationDuration: `${c.duration}s`, animationDelay: `${c.delay}s` }} />
      ))}
    </div>
  )
}

function SlideDecor({ template, type }) {
  const festive = type === 'summary'
  switch (template.decor) {
    case 'party':
      return (
        <div className="slide-decor decor-party" aria-hidden="true">
          <i className="blob b1" /><i className="blob b2" />
          <i className="ghost g-tri" /><i className="ghost g-dia" /><i className="ghost g-cir" /><i className="ghost g-sq" />
          <i className="dot d1" /><i className="dot d2" /><i className="dot d3" /><i className="dot d4" />
          <i className="sheen" />
          {festive && <Confetti />}
        </div>
      )
    case 'arcade':
      return (
        <div className="slide-decor decor-arcade" aria-hidden="true">
          <i className="glow" /><i className="matrix" /><i className="floor" />
          {STARS.map((s, i) => <i key={i} className="star" style={{ left: s.left, top: s.top, '--s': `${s.size}px`, '--d': `${s.duration}s`, '--dl': `${s.delay}s` }} />)}
          {festive && <Confetti />}
          <i className="hud" />
        </div>
      )
    case 'gold':
      return (
        <div className="slide-decor decor-gold" aria-hidden="true">
          <i className="glow" />
          {festive && <Confetti />}
          <i className="hud" />
        </div>
      )
    default:
      return null
  }
}

export default memo(SlideDecor)
