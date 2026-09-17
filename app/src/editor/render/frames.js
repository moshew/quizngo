/** clip-path definitions for image frames. Returns a CSS clip-path value or null. */

const POLYGONS = {
  hexagon: 'polygon(25% 3%, 75% 3%, 100% 50%, 75% 97%, 25% 97%, 0% 50%)',
  diamond: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
  triangle: 'polygon(50% 0%, 100% 100%, 0% 100%)',
  star: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
  arch: 'inset(0 round 50% 50% 0 0)',
}

const PATHS = {
  // Paths are in a 0..1 box and scaled with objectBoundingBox units through clipPath in SVG.
  heart: 'M0.5,0.95 C0.5,0.95 0.05,0.62 0.05,0.32 C0.05,0.15 0.18,0.05 0.31,0.05 C0.4,0.05 0.47,0.1 0.5,0.17 C0.53,0.1 0.6,0.05 0.69,0.05 C0.82,0.05 0.95,0.15 0.95,0.32 C0.95,0.62 0.5,0.95 0.5,0.95 Z',
  blob: 'M0.53,0.02 C0.7,0.02 0.9,0.12 0.95,0.3 C1,0.48 0.92,0.7 0.82,0.84 C0.7,1 0.42,1 0.26,0.9 C0.1,0.8 0,0.62 0.03,0.42 C0.06,0.2 0.32,0.02 0.53,0.02 Z',
  squircle: 'M0.5,0 C0.9,0 1,0.1 1,0.5 C1,0.9 0.9,1 0.5,1 C0.1,1 0,0.9 0,0.5 C0,0.1 0.1,0 0.5,0 Z',
}

export function frameClipPath(frame, borderRadius = 0) {
  switch (frame) {
    case 'circle': return 'ellipse(50% 50% at 50% 50%)'
    case 'rounded': return `inset(0 round ${borderRadius}px)`
    case 'none': return null
    default:
      if (POLYGONS[frame]) return POLYGONS[frame]
      if (PATHS[frame]) return `path("${scalePath(PATHS[frame])}")`
      return null
  }
}

/**
 * CSS `path()` does not support objectBoundingBox units, so we scale the unit path to the element
 * size at render time via a wrapper that sets `--fw/--fh`. Simpler: the renderer passes actual
 * pixel dimensions and we scale here.
 */
export function frameClipPathFor(frame, w, h, borderRadius = 0) {
  if (PATHS[frame]) return `path("${scalePath(PATHS[frame], w, h)}")`
  return frameClipPath(frame, borderRadius)
}

function scalePath(d, w = 1, h = 1) {
  // Multiply every coordinate pair by (w, h). Coordinates alternate x,y after commands.
  let isX = true
  return d.replace(/-?\d*\.?\d+/g, (num) => {
    const v = parseFloat(num) * (isX ? w : h)
    isX = !isX
    return String(Math.round(v * 100) / 100)
  })
}

/** Tiny SVG preview path (24×24) for frame tiles in the inspector. */
export function framePreview(frame) {
  const clip = frameClipPathFor(frame, 24, 24, 6)
  return clip
}
