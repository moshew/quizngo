/** SVG path generators for shape elements, in a w×h box. */

export function shapePath(shape, w, h, radius = 0) {
  const r = Math.min(radius, w / 2, h / 2)
  switch (shape) {
    case 'ellipse':
      return `M ${w / 2} 0 A ${w / 2} ${h / 2} 0 1 0 ${w / 2} ${h} A ${w / 2} ${h / 2} 0 1 0 ${w / 2} 0 Z`
    case 'triangle':
      return `M ${w / 2} 0 L ${w} ${h} L 0 ${h} Z`
    case 'diamond':
      return `M ${w / 2} 0 L ${w} ${h / 2} L ${w / 2} ${h} L 0 ${h / 2} Z`
    case 'hexagon':
      return `M ${w * 0.25} 0 L ${w * 0.75} 0 L ${w} ${h / 2} L ${w * 0.75} ${h} L ${w * 0.25} ${h} L 0 ${h / 2} Z`
    case 'star': {
      const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2, rr = R * 0.45
      const pts = []
      for (let i = 0; i < 10; i++) {
        const ang = -Math.PI / 2 + (i * Math.PI) / 5
        const rad = i % 2 === 0 ? R : rr
        pts.push(`${cx + Math.cos(ang) * rad * (w / Math.min(w, h))} ${cy + Math.sin(ang) * rad * (h / Math.min(w, h))}`)
      }
      return `M ${pts.join(' L ')} Z`
    }
    case 'arrow': {
      const shaft = h * 0.3, head = Math.min(w * 0.35, h)
      return `M 0 ${shaft} L ${w - head} ${shaft} L ${w - head} 0 L ${w} ${h / 2} L ${w - head} ${h} L ${w - head} ${h - shaft} L 0 ${h - shaft} Z`
    }
    case 'line':
      return `M 0 ${h / 2} L ${w} ${h / 2}`
    case 'speech': {
      const tail = Math.min(h * 0.22, 60)
      const bodyH = h - tail
      const rr = Math.min(r || 24, bodyH / 2)
      return `M ${rr} 0 H ${w - rr} Q ${w} 0 ${w} ${rr} V ${bodyH - rr} Q ${w} ${bodyH} ${w - rr} ${bodyH} H ${w * 0.35} L ${w * 0.22} ${h} L ${w * 0.24} ${bodyH} H ${rr} Q 0 ${bodyH} 0 ${bodyH - rr} V ${rr} Q 0 0 ${rr} 0 Z`
    }
    case 'heart': {
      const s = (x, y) => `${x * w} ${y * h}`
      return `M ${s(0.5, 0.95)} C ${s(0.5, 0.95)} ${s(0.05, 0.62)} ${s(0.05, 0.32)} C ${s(0.05, 0.15)} ${s(0.18, 0.05)} ${s(0.31, 0.05)} C ${s(0.4, 0.05)} ${s(0.47, 0.1)} ${s(0.5, 0.17)} C ${s(0.53, 0.1)} ${s(0.6, 0.05)} ${s(0.69, 0.05)} C ${s(0.82, 0.05)} ${s(0.95, 0.15)} ${s(0.95, 0.32)} C ${s(0.95, 0.62)} ${s(0.5, 0.95)} ${s(0.5, 0.95)} Z`
    }
    case 'rect':
    default:
      if (r <= 0) return `M 0 0 H ${w} V ${h} H 0 Z`
      return `M ${r} 0 H ${w - r} Q ${w} 0 ${w} ${r} V ${h - r} Q ${w} ${h} ${w - r} ${h} H ${r} Q 0 ${h} 0 ${h - r} V ${r} Q 0 0 ${r} 0 Z`
  }
}

/** Answer shape glyph (▲ ◆ ● ■) as an SVG path in a 100×100 box. */
export function answerGlyphPath(shape) {
  switch (shape) {
    case 'triangle': return 'M 50 8 L 94 88 L 6 88 Z'
    case 'diamond': return 'M 50 4 L 96 50 L 50 96 L 4 50 Z'
    case 'circle': return 'M 50 6 A 44 44 0 1 0 50 94 A 44 44 0 1 0 50 6 Z'
    case 'square':
    default: return 'M 10 10 H 90 V 90 H 10 Z'
  }
}
