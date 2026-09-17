import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import Moveable from 'react-moveable'
import { SLIDE_W, SLIDE_H } from '../model/constants.js'
import { updateElements, breakUndoCoalescing } from '../state/editorStore.js'

const round = (v) => Math.round(v * 10) / 10

function normalizeRotation(deg) {
  let r = deg % 360
  if (r > 180) r -= 360
  if (r <= -180) r += 360
  return round(r)
}

/**
 * Drag / resize / rotate / snap for the selected elements (react-moveable).
 * During gestures the DOM is updated directly for 60fps; the document is committed on gesture end.
 */
const SelectionLayer = forwardRef(function SelectionLayer({ elements, nodes, otherNodes, rootContainer, scale, disabled }, ref) {
  const moveableRef = useRef(null)
  const [shift, setShift] = useState(false)

  useEffect(() => {
    const down = (e) => { if (e.key === 'Shift') setShift(true) }
    const up = (e) => { if (e.key === 'Shift') setShift(false) }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', () => setShift(false))
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [])

  // Keep the control box in sync when the document changes positions (nudge, inspector edits, zoom).
  useEffect(() => {
    const id = requestAnimationFrame(() => moveableRef.current?.updateRect())
    return () => cancelAnimationFrame(id)
  }, [elements, scale])

  useImperativeHandle(ref, () => ({
    /**
     * Continue a press on a just-selected element as a drag. Pass the MOUSEDOWN event: Moveable
     * prevents the default of the event it starts from, and preventing a pointerdown suppresses the
     * mouseup it later waits for — the element would stay glued to the pointer.
     * The target switch is asynchronous, so the press may already be over when Moveable is ready;
     * `wasReleased` covers the time before this call.
     */
    startDrag(mouseDownEvent, wasReleased = () => false) {
      const m = moveableRef.current
      if (!m) return
      let released = false
      const onUp = () => { released = true }
      window.addEventListener('mouseup', onUp, true)
      m.waitToChangeTarget().then(() => {
        window.removeEventListener('mouseup', onUp, true)
        if (released || wasReleased()) return // it was a click, not a drag
        try { m.dragStart(mouseDownEvent) } catch { /* target changed mid-gesture */ }
      })
    },
    updateRect() { moveableRef.current?.updateRect() },
  }))

  const locked = elements.some((el) => el.locked) || disabled
  const single = elements.length === 1 ? elements[0] : null
  const keepRatio = shift || (single ? single.kind === 'image' || single.kind === 'widget' && ['timer', 'respondents', 'qr-code'].includes(single.widget) : false)
  const targets = useMemo(() => elements.map((el) => nodes.get(el.id)).filter(Boolean), [elements, nodes])

  if (!targets.length) return null

  const commit = (events) => {
    const patches = events.map((ev) => {
      const target = ev.target
      const el = elements.find((x) => x.id === target.dataset.id)
      if (!el) return null
      const patch = {
        x: round(parseFloat(target.style.left) || 0),
        y: round(parseFloat(target.style.top) || 0),
        w: round(parseFloat(target.style.width) || el.w),
        h: round(parseFloat(target.style.height) || el.h),
      }
      const m = /rotate\((-?[\d.]+)deg\)/.exec(target.style.transform || '')
      patch.rotation = m ? normalizeRotation(parseFloat(m[1])) : el.rotation
      return { id: el.id, patch }
    }).filter(Boolean)
    if (patches.length) updateElements(patches, null)
    breakUndoCoalescing()
  }

  const applyDrag = (ev) => {
    ev.target.style.left = `${ev.left}px`
    ev.target.style.top = `${ev.top}px`
  }
  const applyResize = (ev) => {
    ev.target.style.width = `${ev.width}px`
    ev.target.style.height = `${ev.height}px`
    ev.target.style.left = `${ev.drag.left}px`
    ev.target.style.top = `${ev.drag.top}px`
  }
  const applyRotate = (ev) => {
    ev.target.style.transform = ev.rotation ? `rotate(${ev.rotation}deg)` : ''
    if (ev.drag) { ev.target.style.left = `${ev.drag.left}px`; ev.target.style.top = `${ev.drag.top}px` }
  }

  return (
    <Moveable
      ref={moveableRef}
      target={targets}
      rootContainer={rootContainer}
      draggable={!locked}
      resizable={!locked}
      rotatable={!locked}
      keepRatio={keepRatio}
      throttleDrag={0}
      throttleResize={0}
      throttleRotate={shift ? 15 : 0}
      rotationPosition="top"
      origin={false}
      edge={false}
      padding={{ left: 0, top: 0, right: 0, bottom: 0 }}
      renderDirections={locked ? [] : ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se']}
      snappable
      snapThreshold={6}
      snapGap
      isDisplaySnapDigit
      isDisplayInnerSnapDigit={false}
      snapDirections={{ top: true, left: true, bottom: true, right: true, center: true, middle: true }}
      elementSnapDirections={{ top: true, left: true, bottom: true, right: true, center: true, middle: true }}
      elementGuidelines={otherNodes}
      verticalGuidelines={[0, SLIDE_W / 2, SLIDE_W]}
      horizontalGuidelines={[0, SLIDE_H / 2, SLIDE_H]}
      maxSnapElementGuidelineDistance={400}
      checkInput
      useResizeObserver
      useMutationObserver
      onDrag={applyDrag}
      onDragEnd={(e) => { if (e.isDrag) commit([e]) }}
      onResize={applyResize}
      onResizeEnd={(e) => { if (e.isDrag) commit([e]) }}
      onRotate={applyRotate}
      onRotateEnd={(e) => { if (e.isDrag) commit([e]) }}
      onDragGroup={(e) => e.events.forEach(applyDrag)}
      onDragGroupEnd={(e) => { if (e.isDrag) commit(e.events) }}
      onResizeGroup={(e) => e.events.forEach(applyResize)}
      onResizeGroupEnd={(e) => { if (e.isDrag) commit(e.events) }}
      onRotateGroup={(e) => e.events.forEach(applyRotate)}
      onRotateGroupEnd={(e) => { if (e.isDrag) commit(e.events) }}
    />
  )
})

export default SelectionLayer
