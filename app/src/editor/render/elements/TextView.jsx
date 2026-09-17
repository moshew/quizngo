import React from 'react'
import { textToHtml } from '../../../model/sanitize.js'
import { contentT } from '../../../model/content-i18n.js'
import TextEditor from '../../text/TextEditor.jsx'

export function textBoxStyle(style, el) {
  const border = style.border && style.border.width > 0 ? `${style.border.width}px solid ${style.border.color}` : undefined
  return {
    fontFamily: `"${style.fontFamily}", "Rubik", sans-serif`,
    fontSize: style.fontSize,
    fontWeight: style.bold ? 700 : 400,
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

export default function TextView({ el, quiz, slide, mode, editing, onTextCommit, onTextAutoFit }) {
  const style = el.style
  const bound = el.binding === 'question'
  let html = el.html
  let placeholder = false
  if (bound) {
    const text = slide?.question?.text || ''
    if (text) html = textToHtml(text)
    else { html = textToHtml(contentT(quiz?.language || 'he', 'sampleQuestion')); placeholder = true }
  }
  if (!html && mode === 'edit' && !editing) { placeholder = true; html = '…' }

  const dir = style.direction === 'auto' ? 'auto' : style.direction

  if (editing) {
    return (
      <div className="el-text" style={textBoxStyle(style, el)}>
        <TextEditor
          el={el}
          html={bound ? textToHtml(slide?.question?.text || '') : el.html}
          plain={bound}
          dir={dir}
          onCommit={(value) => onTextCommit?.(el, value)}
          onAutoFit={(h) => onTextAutoFit?.(el, h)}
        />
      </div>
    )
  }

  if (placeholder && mode === 'preview') return null

  return (
    <div className="el-text" style={textBoxStyle(style, el)}>
      <div
        className={`el-text-inner ${placeholder ? 'is-placeholder' : ''}`}
        dir={dir}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}
