import React from 'react'
import { ANSWERS } from '../../../model/constants.js'
import { contentT } from '../../../model/content-i18n.js'
import { fitFontSize } from '../../../model/fit.js'
import { assetUrl } from '../../../api/client.js'
import { answerGlyphPath } from '../shapes.js'
import { isLightColor } from '../color.js'
import TextEditor from '../../text/TextEditor.jsx'
import Icon from '../../../components/Icon.jsx'
import { textToHtml } from '../../../model/sanitize.js'

export function AnswerGlyph({ index, color = 'currentColor', size }) {
  const meta = ANSWERS[index]
  return (
    <svg className="answer-glyph" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <path d={answerGlyphPath(meta.shape)} fill={color} />
    </svg>
  )
}

/** Inline styles only for what the author overrode; everything else is the skin's (SPEC FR-18). */
export function skinOverrides(style, { radius = true } = {}) {
  const out = {}
  if (style.background) out.background = style.background
  if (style.border) out.border = style.border.width > 0 ? `${style.border.width}px solid ${style.border.color}` : 'none'
  if (radius && style.borderRadius !== null && style.borderRadius !== undefined) out.borderRadius = style.borderRadius
  if (style.shadow) out.boxShadow = style.shadow
  if (style.fontFamily) out.fontFamily = `"${style.fontFamily}", "Rubik", sans-serif`
  if (style.color) out.color = style.color
  return out
}

/**
 * One answer tile. The markup is the same for every template; the skin draws it
 * (`.skin-chunky .atile`, `.skin-neon .atile` in styles/skins).
 */
export default function AnswerView({ el, quiz, slide, mode, editing, showCorrect, onTextCommit }) {
  const meta = ANSWERS[el.index]
  const style = el.style
  const answer = slide?.question?.answers?.[el.index - 1] || { text: '', image: null }
  const isCorrect = slide?.question?.correctAnswer === el.index
  const lang = quiz?.language || 'he'

  const hasImage = !!answer.image?.src
  const imagePos = style.imagePosition || 'start'
  const topLayout = imagePos === 'top' && (hasImage || mode !== 'preview')
  const showText = !(hasImage && imagePos === 'cover' && !answer.text && !editing)
  const empty = !answer.text && !hasImage
  const placeholderText = contentT(lang, 'sampleAnswer', { n: el.index })

  const overrides = skinOverrides(style)
  if (style.variant === 'pill') overrides.borderRadius = 999
  // An author-picked light fill needs dark text unless they also picked a text color.
  const lightOverride = style.background && isLightColor(style.background)
  if (lightOverride && !style.color) overrides.color = 'var(--t-ink)'

  // Shrink long answers instead of clipping them.
  const glyphSpace = style.showShape ? Math.min(el.h * 0.42, 62) + 28 : 0
  const thumbSpace = hasImage && imagePos === 'start' ? el.h * 0.78 + 24 : 0
  const textBox = topLayout
    ? { w: el.w - 56 - (style.showShape ? 62 : 0), h: Math.max(40, el.h * 0.3) }
    : { w: el.w - 76 - glyphSpace - thumbSpace, h: el.h - 28 }
  const fontSize = fitFontSize(answer.text || placeholderText, { ...textBox, base: style.fontSize, min: 18, lineHeight: 1.1 })

  const classes = [
    'atile', `c-${meta.name}`, `variant-${style.variant || 'card'}`,
    hasImage ? `img-${imagePos}` : '', topLayout ? 'is-top' : '',
    style.background ? 'has-fill' : '', lightOverride ? 'is-light' : '',
    style.bold === false ? 'is-regular' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={`el-answer ${empty ? 'is-empty' : ''}`}>
      <div className={classes} style={{ ...overrides, '--th': `${el.h}px` }}>
        {hasImage && imagePos === 'cover' && <img className="atile-cover" src={assetUrl(answer.image.src)} alt="" draggable={false} />}
        {topLayout && (
          <div className="atile-media">
            {hasImage
              ? <img src={assetUrl(answer.image.src)} alt="" draggable={false} />
              : <span className="atile-media-empty"><Icon name="image" size={44} strokeWidth={1.5} /></span>}
          </div>
        )}
        <div className="atile-cap">
          {style.showShape && <span className="glyph"><AnswerGlyph index={el.index} /></span>}
          {style.showIndex && <span className="idx">{el.index}</span>}
          {hasImage && imagePos === 'start' && <img className="atile-thumb" src={assetUrl(answer.image.src)} alt="" draggable={false} />}
          {showText && (
            <div className="txt" style={{ fontSize }}>
              {editing ? (
                <TextEditor el={el} html={textToHtml(answer.text)} plain dir="auto" onCommit={(value) => onTextCommit?.(el, value)} />
              ) : answer.text ? (
                <span dir="auto">{answer.text}</span>
              ) : mode === 'preview' ? null : (
                <span className="is-placeholder" dir="auto">{placeholderText}</span>
              )}
            </div>
          )}
        </div>
      </div>
      {isCorrect && (mode === 'edit' || mode === 'thumb' || showCorrect) && (
        <span className={`answer-correct ${mode === 'preview' ? 'reveal' : ''}`} style={{ width: Math.min(el.h * 0.34, 58), height: Math.min(el.h * 0.34, 58) }} title="✓">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </span>
      )}
    </div>
  )
}
