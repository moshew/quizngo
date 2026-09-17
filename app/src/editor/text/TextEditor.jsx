import React, { useEffect, useLayoutEffect, useRef } from 'react'
import { sanitizeHtml, htmlToText } from '../../model/sanitize.js'

/**
 * Inline contentEditable used for text elements and answer cards.
 * - `plain`: the value is committed as plain text (bound question/answer text).
 * - Commits on blur and on every input (debounced by the store's history coalescing).
 * - Escape/blur ends editing (handled by the canvas); Enter inserts a line break in rich mode.
 */
export default function TextEditor({ el, html, plain = false, dir = 'auto', onCommit, onAutoFit }) {
  const ref = useRef(null)
  const lastCommitted = useRef(html)

  // Mount once with the initial content, focus and place the caret at the end.
  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    node.innerHTML = html || ''
    node.focus()
    const sel = window.getSelection()
    if (sel && node.childNodes.length) {
      const range = document.createRange()
      range.selectNodeContents(node)
      sel.removeAllRanges()
      sel.addRange(range)
    }
    // Make execCommand generate inline styles instead of <font> tags.
    try { document.execCommand('styleWithCSS', false, true) } catch { /* ignore */ }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const node = ref.current
    if (!node || !onAutoFit || !el.style?.autoFit) return undefined
    const ro = new ResizeObserver(() => onAutoFit(node.scrollHeight + (el.style.padding || 0) * 2))
    ro.observe(node)
    return () => ro.disconnect()
  }, [el.style?.autoFit, el.style?.padding, onAutoFit, el])

  const commit = () => {
    const node = ref.current
    if (!node) return
    const value = plain ? htmlToText(node.innerHTML) : sanitizeHtml(node.innerHTML)
    if (value === lastCommitted.current) return
    lastCommitted.current = value
    onCommit?.(value)
  }

  return (
    <div
      ref={ref}
      className="el-text-inner is-editor"
      contentEditable
      suppressContentEditableWarning
      dir={dir}
      spellCheck
      data-plain={plain ? 'true' : undefined}
      onInput={commit}
      onBlur={commit}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        // Let the canvas shortcuts see Escape; swallow the rest so Delete/Backspace edit text.
        if (e.key === 'Escape') return
        e.stopPropagation()
        if (plain && e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          e.currentTarget.blur()
        }
      }}
      onPaste={(e) => {
        e.preventDefault()
        const text = e.clipboardData.getData('text/plain')
        document.execCommand('insertText', false, text)
      }}
    />
  )
}
