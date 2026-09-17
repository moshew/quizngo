import React, { memo, useRef } from 'react'
import { SLIDE_W, SLIDE_H } from '../../model/constants.js'
import { isRtlLang } from '../../model/schema.js'
import { assetUrl } from '../../api/client.js'
import TextView from './elements/TextView.jsx'
import ImageView from './elements/ImageView.jsx'
import ShapeView from './elements/ShapeView.jsx'
import AnswerView from './elements/AnswerView.jsx'
import WidgetView from './elements/WidgetView.jsx'

export function backgroundStyle(bg) {
  if (!bg) return { background: '#1a0a2e' }
  switch (bg.kind) {
    case 'gradient': {
      const stops = (bg.gradient?.stops || []).map((s) => `${s.color} ${s.at}%`).join(', ')
      return { background: `linear-gradient(${bg.gradient?.angle ?? 160}deg, ${stops})` }
    }
    case 'image':
      return {
        backgroundImage: bg.src ? `url("${assetUrl(bg.src)}")` : 'none',
        backgroundColor: bg.color || '#1a0a2e',
        backgroundSize: bg.fit === 'contain' ? 'contain' : 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }
    case 'color':
    default:
      return { background: bg.color || '#1a0a2e' }
  }
}

/**
 * Renders one slide at logical size (1920×1080), scaled with CSS transform.
 *
 * mode: "edit" | "thumb" | "preview"
 * liveData: runtime values for widgets (sample data when omitted).
 * In edit mode the parent supplies interaction callbacks and element refs for the selection layer.
 */
function SlideRenderer({
  quiz, slide, scale = 1, mode = 'thumb', liveData, showCorrect = false,
  selectedIds, editingId, croppingId, onElementPointerDown, onElementDoubleClick, onElementContextMenu, registerRef,
  onTextCommit, onTextAutoFit, onImageDrop, children,
}) {
  // One stable ref callback per element id — a fresh closure each render would make React
  // re-register every node (null → node) on every render and loop the parent's state updates.
  const refCache = useRef(new Map())
  const getRef = (id) => {
    if (!registerRef) return undefined
    let fn = refCache.current.get(id)
    if (!fn) {
      fn = (node) => registerRef(id, node)
      refCache.current.set(id, fn)
    }
    return fn
  }

  if (!slide) return null
  const dir = isRtlLang(quiz?.language || 'he') ? 'rtl' : 'ltr'
  const editable = mode === 'edit'

  return (
    <div
      className={`slide mode-${mode}`}
      dir={dir}
      style={{ width: SLIDE_W, height: SLIDE_H, transform: `scale(${scale})`, transformOrigin: '0 0' }}
    >
      <div className="slide-bg" style={backgroundStyle(slide.background)} />
      {slide.background?.kind === 'image' && slide.background.overlay && (
        <div className="slide-bg-overlay" style={{ background: slide.background.overlay }} />
      )}
      {slide.elements.map((el) => {
        if (el.hidden && mode !== 'edit') return null
        const selected = editable && selectedIds?.includes(el.id)
        const common = { el, quiz, slide, mode, liveData, showCorrect, editing: editingId === el.id, cropping: croppingId === el.id, onTextCommit, onTextAutoFit, onImageDrop }
        let body = null
        switch (el.kind) {
          case 'text': body = <TextView {...common} />; break
          case 'image': body = <ImageView {...common} />; break
          case 'shape': body = <ShapeView {...common} />; break
          case 'answer': body = <AnswerView {...common} />; break
          case 'widget': body = <WidgetView {...common} />; break
          default: body = null
        }
        return (
          <div
            key={el.id}
            ref={getRef(el.id)}
            className={`el el-kind-${el.kind} ${selected ? 'is-selected' : ''} ${el.locked ? 'is-locked' : ''} ${el.hidden ? 'is-hidden' : ''} ${editingId === el.id ? 'is-editing' : ''}`}
            data-id={el.id}
            style={{
              left: el.x, top: el.y, width: el.w, height: el.h,
              transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
              opacity: el.hidden && editable ? Math.min(el.opacity, 0.35) : el.opacity,
              pointerEvents: editable ? 'auto' : 'none',
            }}
            onPointerDown={editable ? (e) => onElementPointerDown?.(e, el) : undefined}
            onDoubleClick={editable ? (e) => onElementDoubleClick?.(e, el) : undefined}
            onContextMenu={editable ? (e) => onElementContextMenu?.(e, el) : undefined}
          >
            {body}
          </div>
        )
      })}
      {children}
    </div>
  )
}

export default memo(SlideRenderer)
