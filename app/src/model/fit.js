/**
 * Deterministic "shrink to fit" for slide text. No DOM measuring, so canvas, thumbnails, preview
 * and (later) the game host all agree — and hundreds of thumbnails stay cheap.
 *
 * The estimate is deliberately a little pessimistic (glyphs are assumed wider than they are):
 * slightly small text beats clipped text on a projector.
 */
const CHAR_RATIO = 0.56 // average glyph width / font size for the bold display faces we ship

function countLines(text, charsPerLine) {
  let lines = 0
  for (const paragraph of String(text).split('\n')) {
    let used = 0
    lines += 1
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const len = [...word].length
      if (len > charsPerLine) { // a word longer than the line breaks anywhere
        const rest = used ? len - (charsPerLine - used - 1) : len
        lines += Math.ceil(Math.max(0, rest) / charsPerLine) - (used ? 0 : 1)
        used = Math.max(1, rest % charsPerLine)
        continue
      }
      const next = used ? used + 1 + len : len
      if (next > charsPerLine) { lines += 1; used = len } else used = next
    }
  }
  return lines
}

/** Largest size ≤ `base` (and ≥ `min`) at which `text` fits a w×h box. */
export function fitFontSize(text, { w, h, base, min = 18, lineHeight = 1.1, step = 2 }) {
  if (!text || !(w > 0) || !(h > 0)) return base
  let size = base
  while (size > min) {
    const charsPerLine = Math.max(1, Math.floor(w / (size * CHAR_RATIO)))
    if (countLines(text, charsPerLine) * size * lineHeight <= h) return size
    size -= step
  }
  return Math.max(min, size)
}
