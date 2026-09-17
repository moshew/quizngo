/** Small color utilities shared by the renderer and the color picker. */

const NAMED = { white: '#ffffff', black: '#000000', transparent: 'rgba(0,0,0,0)' }

export function parseColor(input) {
  if (!input || typeof input !== 'string') return null
  let s = input.trim().toLowerCase()
  if (NAMED[s]) s = NAMED[s]
  let m = s.match(/^#([0-9a-f]{3,4})$/)
  if (m) {
    const h = m[1]
    const r = parseInt(h[0] + h[0], 16), g = parseInt(h[1] + h[1], 16), b = parseInt(h[2] + h[2], 16)
    const a = h.length === 4 ? parseInt(h[3] + h[3], 16) / 255 : 1
    return { r, g, b, a }
  }
  m = s.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/)
  if (m) {
    const h = m[1]
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: m[2] ? parseInt(m[2], 16) / 255 : 1 }
  }
  m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+%?)\s*)?\)$/)
  if (m) {
    let a = 1
    if (m[4] !== undefined) a = m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])
    return { r: Math.round(+m[1]), g: Math.round(+m[2]), b: Math.round(+m[3]), a: Math.min(1, Math.max(0, a)) }
  }
  m = s.match(/^rgba?\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+%?)\s*)?\)$/)
  if (m) {
    let a = 1
    if (m[4] !== undefined) a = m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])
    return { r: Math.round(+m[1]), g: Math.round(+m[2]), b: Math.round(+m[3]), a }
  }
  return null
}

const hex2 = (n) => Math.round(n).toString(16).padStart(2, '0')

export function toHex({ r, g, b, a = 1 }) {
  const base = `#${hex2(r)}${hex2(g)}${hex2(b)}`
  return a < 1 ? `${base}${hex2(a * 255)}` : base
}

export function toCss({ r, g, b, a = 1 }) {
  if (a >= 1) return `#${hex2(r)}${hex2(g)}${hex2(b)}`
  return `rgba(${r}, ${g}, ${b}, ${Math.round(a * 100) / 100})`
}

/** Relative luminance (0..1) ignoring alpha. */
export function luminance(css) {
  const c = parseColor(css)
  if (!c) return 0
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b)
}

/** True when the color reads as "light" (translucent colors over dark slides count as dark). */
export function isLightColor(css) {
  const c = parseColor(css)
  if (!c || c.a < 0.5) return false
  return luminance(css) > 0.45
}

export function withAlpha(css, a) {
  const c = parseColor(css)
  if (!c) return css
  return toCss({ ...c, a })
}

export function mix(cssA, cssB, t) {
  const a = parseColor(cssA), b = parseColor(cssB)
  if (!a || !b) return cssA
  return toCss({ r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t, a: a.a + (b.a - a.a) * t })
}

/** Convert a CSS box-shadow string ("x y blur [spread] color") into a drop-shadow filter. */
export function shadowToFilter(shadow) {
  if (!shadow) return 'none'
  const parts = shadow.trim().split(/\s+(?![^(]*\))/)
  const lengths = parts.filter((p) => /^-?[\d.]+(px)?$/.test(p))
  const color = parts.find((p) => !/^-?[\d.]+(px)?$/.test(p)) || 'rgba(0,0,0,0.3)'
  const [x = '0', y = '0', blur = '0'] = lengths
  return `drop-shadow(${x} ${y} ${blur} ${color})`
}
