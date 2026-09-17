import React from 'react'
import { ANSWERS } from '../../../model/constants.js'
import { contentT } from '../../../model/content-i18n.js'
import { assetUrl } from '../../../api/client.js'
import { answerGlyphPath } from '../shapes.js'
import { isLightColor } from '../color.js'
import TextEditor from '../../text/TextEditor.jsx'
import { textToHtml } from '../../../model/sanitize.js'

export function AnswerGlyph({ index, color, size }) {
  const meta = ANSWERS[index]
  return (
    <svg className="answer-glyph" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <path d={answerGlyphPath(meta.shape)} fill={color} />
    </svg>
  )
}

export default function AnswerView({ el, quiz, slide, mode, editing, showCorrect, onTextCommit }) {
  const meta = ANSWERS[el.index]
  const style = el.style
  const answer = slide?.question?.answers?.[el.index - 1] || { text: '', image: null }
  const isCorrect = slide?.question?.correctAnswer === el.index
  const lang = quiz?.language || 'he'

  const background = style.background || meta.color
  const flat = style.variant === 'flat'
  const lightBg = isLightColor(background)
  // Auto-contrast: white text on the canonical yellow is unreadable.
  let textColor = style.color
  if (!flat && lightBg && (!textColor || textColor.toLowerCase() === '#ffffff' || textColor === 'white')) textColor = '#1a0a2e'
  if (flat && !style.color) textColor = '#111827'
  const glyphColor = flat ? meta.color : lightBg ? '#1a0a2e' : '#ffffff'

  const radius = style.variant === 'pill' ? 999 : style.borderRadius
  const border = style.border && style.border.width > 0 ? `${style.border.width}px solid ${style.border.color}` : undefined
  const glyphSize = Math.min(el.h * 0.46, 92)
  const hasImage = !!answer.image?.src
  const imagePos = style.imagePosition || 'start'
  const showText = !(hasImage && imagePos === 'cover' && !answer.text && !editing)
  const empty = !answer.text && !hasImage

  const boxStyle = {
    background,
    color: textColor,
    borderRadius: radius,
    border,
    boxShadow: style.shadow || undefined,
    fontFamily: `"${style.fontFamily}", "Rubik", sans-serif`,
    fontSize: style.fontSize,
    fontWeight: style.bold ? 700 : 500,
    flexDirection: hasImage && imagePos === 'top' ? 'column' : 'row',
  }

  const placeholderText = contentT(lang, 'sampleAnswer', { n: el.index })

  return (
    <div className={`el-answer variant-${style.variant} ${empty ? 'is-empty' : ''} ${hasImage ? `img-${imagePos}` : ''}`} style={boxStyle}>
      {flat && <span className="answer-accent" style={{ background: meta.color }} />}
      {hasImage && imagePos === 'cover' && (
        <img className="answer-cover" src={assetUrl(answer.image.src)} alt="" draggable={false} style={{ borderRadius: radius }} />
      )}
      {style.showShape && (
        <span className="answer-glyph-wrap" style={{ width: glyphSize, height: glyphSize }}>
          <AnswerGlyph index={el.index} color={glyphColor} size={glyphSize} />
        </span>
      )}
      {style.showIndex && <span className="answer-index" style={{ fontSize: style.fontSize * 0.7 }}>{el.index}</span>}
      {hasImage && imagePos !== 'cover' && (
        <img className="answer-thumb" src={assetUrl(answer.image.src)} alt="" draggable={false} style={{ borderRadius: Math.min(radius, 18) }} />
      )}
      {showText && (
        <div className={`answer-text ${hasImage && imagePos === 'cover' ? 'on-cover' : ''}`}>
          {editing ? (
            <TextEditor
              el={el}
              html={textToHtml(answer.text)}
              plain
              dir="auto"
              onCommit={(value) => onTextCommit?.(el, value)}
            />
          ) : answer.text ? (
            <span dir="auto">{answer.text}</span>
          ) : mode === 'preview' ? null : (
            <span className="is-placeholder" dir="auto">{placeholderText}</span>
          )}
        </div>
      )}
      {isCorrect && (mode === 'edit' || mode === 'thumb' || showCorrect) && (
        <span className={`answer-correct ${mode === 'preview' ? 'reveal' : ''}`} style={{ width: el.h * 0.34, height: el.h * 0.34 }} title="✓">
          <svg viewBox="0 0 24 24" fill="none" stroke="#1a0a2e" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </span>
      )}
    </div>
  )
}
