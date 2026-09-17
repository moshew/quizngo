/**
 * Allowlist HTML sanitizer for rich-text elements.
 * Keeps inline formatting produced by the contentEditable editor and nothing else.
 */

const ALLOWED_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 's', 'strike', 'br', 'div', 'p', 'span', 'ul', 'ol', 'li', 'sub', 'sup', 'font'])
const ALLOWED_STYLES = new Set([
  'color', 'background-color', 'font-family', 'font-size', 'font-weight', 'font-style',
  'text-decoration', 'text-decoration-line', 'text-align', 'direction', 'line-height', 'letter-spacing',
])
const URL_RE = /url\s*\(|expression\s*\(|javascript:/i

function sanitizeStyle(styleText) {
  const out = []
  for (const decl of styleText.split(';')) {
    const idx = decl.indexOf(':')
    if (idx === -1) continue
    const prop = decl.slice(0, idx).trim().toLowerCase()
    const value = decl.slice(idx + 1).trim()
    if (!ALLOWED_STYLES.has(prop) || !value || URL_RE.test(value)) continue
    out.push(`${prop}: ${value}`)
  }
  return out.join('; ')
}

function cleanNode(node, doc) {
  const children = Array.from(node.childNodes)
  for (const child of children) {
    if (child.nodeType === Node.TEXT_NODE) continue
    if (child.nodeType !== Node.ELEMENT_NODE) { node.removeChild(child); continue }

    const tag = child.tagName.toLowerCase()
    if (!ALLOWED_TAGS.has(tag)) {
      // Unwrap: keep the text/children, drop the element.
      cleanNode(child, doc)
      while (child.firstChild) node.insertBefore(child.firstChild, child)
      node.removeChild(child)
      continue
    }

    // Strip every attribute except a filtered style (and legacy <font> attributes → style).
    const style = child.getAttribute('style')
    const fontColor = tag === 'font' ? child.getAttribute('color') : null
    const fontFace = tag === 'font' ? child.getAttribute('face') : null
    for (const attr of Array.from(child.attributes)) child.removeAttribute(attr.name)
    let cleaned = style ? sanitizeStyle(style) : ''
    if (fontColor) cleaned += `${cleaned ? '; ' : ''}color: ${fontColor}`
    if (fontFace) cleaned += `${cleaned ? '; ' : ''}font-family: ${fontFace}`
    if (cleaned) child.setAttribute('style', cleaned)

    cleanNode(child, doc)
  }
}

export function sanitizeHtml(html) {
  if (!html) return ''
  if (typeof DOMParser === 'undefined') return String(html).replace(/<[^>]*>/g, '')
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  cleanNode(doc.body, doc)
  return doc.body.innerHTML
}

export function htmlToText(html) {
  if (!html) return ''
  if (typeof DOMParser === 'undefined') return String(html).replace(/<[^>]*>/g, '')
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  // Preserve line breaks between block elements.
  doc.body.querySelectorAll('br').forEach((br) => br.replaceWith('\n'))
  doc.body.querySelectorAll('div, p, li').forEach((el) => el.append('\n'))
  return doc.body.textContent.replace(/\n{2,}/g, '\n').trim()
}

export function textToHtml(text) {
  if (!text) return ''
  return String(text)
    .split('\n')
    .map((line) => escapeHtml(line))
    .join('<br>')
}

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
