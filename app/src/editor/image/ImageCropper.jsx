import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../../i18n/index.js'
import { assetUrl } from '../../api/client.js'
import { measureImage } from '../../api/assets.js'
import { updateElement, setCropping } from '../../state/editorStore.js'
import Button, { IconButton } from '../../components/Button.jsx'
import { Slider } from '../../components/Field.jsx'
import { coverCrop } from './useImageUpload.js'

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

/**
 * Crop mode for an image element: the element box is the fixed window; pan the picture behind it
 * and zoom with the slider. Crop is stored as fractions of the source image.
 */
export default function ImageCropper({ el, slide, scale, barAnchor }) {
  const { t } = useI18n()
  const src = el.binding === 'question-media' ? slide?.question?.media?.src : el.src
  const [natural, setNatural] = useState(null)
  const [crop, setCrop] = useState(el.crop)
  const dragRef = useRef(null)

  useEffect(() => {
    let alive = true
    measureImage(assetUrl(src)).then((size) => {
      if (!alive) return
      setNatural(size)
      // Normalize the starting crop so its aspect matches the element box.
      const target = el.w / el.h
      const current = (el.crop.w * size.width) / (el.crop.h * size.height)
      if (Math.abs(current - target) > 0.01) setCrop(coverCrop(size.width, size.height, el.w, el.h))
    })
    return () => { alive = false }
  }, [src]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!natural) return null

  // Aspect-consistent crop height for a given width.
  const heightFor = (w) => w * (natural.width / natural.height) * (el.h / el.w)
  const minW = coverCrop(natural.width, natural.height, el.w, el.h).w // fully zoomed out (fills the box)
  const zoomPct = Math.round(((minW - crop.w) / (minW - Math.max(0.05, minW * 0.15))) * 100)

  const setZoom = (pct) => {
    const maxZoomW = Math.max(0.05, minW * 0.15)
    const w = minW - (pct / 100) * (minW - maxZoomW)
    const h = heightFor(w)
    const cx = crop.x + crop.w / 2, cy = crop.y + crop.h / 2
    setCrop({ w, h, x: clamp(cx - w / 2, 0, 1 - w), y: clamp(cy - h / 2, 0, 1 - h) })
  }

  // Geometry in canvas pixels.
  const boxLeft = el.x * scale, boxTop = el.y * scale, boxW = el.w * scale, boxH = el.h * scale
  const imgW = boxW / crop.w, imgH = boxH / crop.h
  const imgLeft = boxLeft - crop.x * imgW, imgTop = boxTop - crop.y * imgH

  const onPointerDown = (e) => {
    e.preventDefault(); e.stopPropagation()
    dragRef.current = { sx: e.clientX, sy: e.clientY, x: crop.x, y: crop.y }
    const move = (ev) => {
      const d = dragRef.current
      if (!d) return
      const dx = (ev.clientX - d.sx) / imgW, dy = (ev.clientY - d.sy) / imgH
      const rtl = document.documentElement.dir === 'rtl'
      setCrop((c) => ({ ...c, x: clamp(d.x - (rtl ? -dx : dx), 0, 1 - c.w), y: clamp(d.y - dy, 0, 1 - c.h) }))
    }
    const up = () => { dragRef.current = null; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const done = () => { updateElement(el.id, { crop }, null); setCropping(null) }
  const cancel = () => setCropping(null)
  const reset = () => setCrop(coverCrop(natural.width, natural.height, el.w, el.h))

  return (
    <>
      <div className="cropper" onPointerDown={(e) => e.stopPropagation()} onDoubleClick={done}>
        <div className="cropper-image" style={{ left: imgLeft, top: imgTop, width: imgW, height: imgH }} onPointerDown={onPointerDown}>
          <img src={assetUrl(src)} alt="" draggable={false} />
        </div>
        <div className="cropper-window" style={{ left: boxLeft, top: boxTop, width: boxW, height: boxH, overflow: 'hidden' }}>
          <img src={assetUrl(src)} alt="" draggable={false} style={{ left: imgLeft - boxLeft, top: imgTop - boxTop, width: imgW, height: imgH, maxWidth: 'none' }} />
          <div className="cropper-grid" />
        </div>
      </div>
      {createPortal(
        <div className="cropper-bar" style={{ left: barAnchor.left, top: barAnchor.top, transform: 'translateX(-50%)' }} onPointerDown={(e) => e.stopPropagation()}>
          <IconButton icon="zoomOut" size="sm" label="-" onClick={() => setZoom(clamp(zoomPct - 10, 0, 100))} />
          <Slider min={0} max={100} value={clamp(zoomPct, 0, 100)} onChange={setZoom} />
          <IconButton icon="zoomIn" size="sm" label="+" onClick={() => setZoom(clamp(zoomPct + 10, 0, 100))} />
          <div className="vdivider" />
          <IconButton icon="reset" size="sm" label={t('inspector.resetStyle')} onClick={reset} />
          <Button size="sm" variant="ghost" onClick={cancel}>{t('common.cancel')}</Button>
          <Button size="sm" variant="primary" icon="check" onClick={done}>{t('editor.cropDone')}</Button>
        </div>,
        document.body,
      )}
    </>
  )
}
