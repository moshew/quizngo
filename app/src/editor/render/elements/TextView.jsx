import React from 'react'
import { textToHtml } from '../../../model/sanitize.js'
import { contentT } from '../../../model/content-i18n.js'
import { fitFontSize } from '../../../model/fit.js'
import TextEditor from '../../text/TextEditor.jsx'

export function textBoxStyle(style, el) {
  const border = style.border && style.border.width > 0 ? `${style.border.width}px solid ${style.border.color}` : undefined
  return {
    fontFamily: `"${style.fontFamily}", "Rubik", "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`,
    fontSize: style.fontSize,
    fontWeight: style.bold ? 800 : 500,
    color: style.color,
    textAlign: style.align === 'start' ? 'start' : style.align === 'end' ? 'end' : style.align,
    justifyContent: style.valign === 'top' ? 'flex-start' : style.valign === 'bottom' ? 'flex-end' : 'center',
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing ? `${style.letterSpacing}px` : undefined,
    padding: style.padding,
    background: style.background || undefined,
    borderRadius: style.borderRadius || undefined,
    border,
    boxShadow: style.shadow || undefined,
    textShadow: style.textShadow || undefined,
  }
}

/** Text the element shows on behalf of the document (question text, quiz title), or null. */
function boundText(el, quiz, slide) {
  if (el.binding === 'question') return slide?.question?.text || ''
  if (el.binding === 'quiz-title') return quiz?.title || ''
  return null
}

export default function TextView({ el, quiz, slide, mode, editing, onTextCommit, onTextAutoFit }) {
  const style = el.style
  const bound = boundText(el, quiz, slide)
  const isBound = bound !== null
  let html = el.html
  let placeholder = false
  let boxStyle = textBoxStyle(style, el)

  if (isBound) {
    const lang = quiz?.language || 'he'
    const shown = bound || contentT(lang, el.binding === 'question' ? 'sampleQuestion' : 'quizTitle')
    placeholder = !bound
    html = textToHtml(shown)
    // Bound text comes from a form, so it can be any length: shrink it rather than clip it.
    const pad = (style.padding || 0) * 2
    const fontSize = fitFontSize(shown, { w: el.w - pad, h: el.h - pad, base: style.fontSize, min: 24, lineHeight: style.lineHeight || 1.1 })
    if (fontSize !== style.fontSize) boxStyle = { ...boxStyle, fontSize }
  }
  if (!html && mode === 'edit' && !editing) { placeholder = true; html = '…' }

  const dir = style.direction === 'auto' ? 'auto' : style.direction

  if (editing) {
    return (
      <div className="el-text" style={boxStyle}>
        <TextEditor
          el={el}
          html={isBound ? textToHtml(bound) : el.html}
          plain={isBound}
          dir={dir}
          onCommit={(value) => onTextCommit?.(el, value)}
          onAutoFit={(h) => onTextAutoFit?.(el, h)}
        />
      </div>
    )
  }

  if (placeholder && mode === 'preview') return null

  return (
    <div className="el-text" style={boxStyle}>
      <div
        className={`el-text-inner ${placeholder ? 'is-placeholder' : ''}`}
        dir={dir}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}
