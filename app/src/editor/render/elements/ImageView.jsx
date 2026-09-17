import React from 'react'
import { assetUrl } from '../../../api/client.js'
import { frameClipPathFor } from '../frames.js'
import { shadowToFilter } from '../color.js'
import { t } from '../../../i18n/index.js'
import Icon from '../../../components/Icon.jsx'

export function imageFilter(filters) {
  if (!filters) return undefined
  const parts = []
  if (filters.brightness !== 100) parts.push(`brightness(${filters.brightness}%)`)
  if (filters.contrast !== 100) parts.push(`contrast(${filters.contrast}%)`)
  if (filters.saturate !== 100) parts.push(`saturate(${filters.saturate}%)`)
  if (filters.blur > 0) parts.push(`blur(${filters.blur}px)`)
  if (filters.grayscale > 0) parts.push(`grayscale(${filters.grayscale}%)`)
  if (filters.sepia > 0) parts.push(`sepia(${filters.sepia}%)`)
  return parts.length ? parts.join(' ') : undefined
}

/** Style for the <img> so that only the crop rectangle (fractions of the source) fills the box. */
export function croppedImageStyle(crop) {
  const c = crop || { x: 0, y: 0, w: 1, h: 1 }
  // An untouched crop means "fill the box": layouts and re-theming change the box aspect, and a
  // cover fit never stretches the picture. An explicit crop (from crop mode) is honored exactly.
  if (c.x === 0 && c.y === 0 && c.w === 1 && c.h === 1) {
    return { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', maxWidth: 'none' }
  }
  const w = Math.max(c.w, 0.01), h = Math.max(c.h, 0.01)
  return {
    position: 'absolute',
    width: `${(1 / w) * 100}%`,
    height: `${(1 / h) * 100}%`,
    left: `${(-c.x / w) * 100}%`,
    top: `${(-c.y / h) * 100}%`,
    maxWidth: 'none',
  }
}

export default function ImageView({ el, quiz, slide, mode, cropping }) {
  const bound = el.binding === 'question-media'
  let src = el.src
  if (bound) src = slide?.question?.media?.src || ''
  const isPlaceholder = !src

  if (isPlaceholder) {
    if (mode === 'preview') return null
    return (
      <div className="el-image el-image-placeholder" style={{ borderRadius: el.frame === 'circle' ? '50%' : el.borderRadius || 24 }}>
        <Icon name="image" size={Math.min(el.w, el.h) * 0.22} strokeWidth={1.5} />
        {mode === 'edit' && <span style={{ fontSize: Math.max(18, Math.min(el.w, el.h) * 0.08) }}>{t('editor.addPlaceholderImage')}</span>}
      </div>
    )
  }

  const clip = frameClipPathFor(el.frame, el.w, el.h, el.borderRadius)
  const borderW = el.border?.width || 0
  const simpleFrame = el.frame === 'none' || el.frame === 'rounded'
  const flip = `${el.flipH ? 'scaleX(-1) ' : ''}${el.flipV ? 'scaleY(-1)' : ''}`.trim()

  const img = (
    <img
      src={assetUrl(src)}
      alt=""
      draggable={false}
      style={{ ...croppedImageStyle(el.crop), filter: imageFilter(el.filters), transform: flip || undefined }}
    />
  )

  if (simpleFrame) {
    return (
      <div
        className={`el-image ${cropping ? 'is-cropping' : ''}`}
        style={{
          borderRadius: el.frame === 'rounded' ? el.borderRadius : 0,
          border: borderW ? `${borderW}px solid ${el.border.color}` : undefined,
          boxShadow: el.shadow || undefined,
        }}
      >
        <div className="el-image-clip" style={{ borderRadius: el.frame === 'rounded' ? Math.max(0, el.borderRadius - borderW) : 0 }}>{img}</div>
      </div>
    )
  }

  // Framed: outer (border color) and inner (inset by border width) share the same clip-path.
  const innerW = el.w - borderW * 2, innerH = el.h - borderW * 2
  return (
    <div className={`el-image el-image-framed ${cropping ? 'is-cropping' : ''}`} style={{ filter: el.shadow ? shadowToFilter(el.shadow) : undefined }}>
      <div className="el-image-frame-outer" style={{ clipPath: clip, background: borderW ? el.border.color : 'transparent' }}>
        <div
          className="el-image-clip"
          style={{
            position: 'absolute', left: borderW, top: borderW, width: innerW, height: innerH,
            clipPath: frameClipPathFor(el.frame, innerW, innerH, Math.max(0, el.borderRadius - borderW)),
          }}
        >
          {img}
        </div>
      </div>
    </div>
  )
}
