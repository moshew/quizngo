import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../i18n/index.js'
import { SLIDE_W, SLIDE_H } from '../model/constants.js'
import {
  useEditor, currentSlide, select, clearSelection, setEditing, setCropping, updateQuestion, setAnswer, updateElement,
  deleteElements, duplicateElements, copySelection, pasteClipboard, reorderElements, toggleLock,
  setZoom, setBackground, insertText, setTitle,
} from '../state/editorStore.js'
import SlideRenderer from './render/SlideRenderer.jsx'
import SelectionLayer from './SelectionLayer.jsx'
import TextToolbar from './text/TextToolbar.jsx'
import ImageCropper from './image/ImageCropper.jsx'
import InsertBar from './InsertBar.jsx'
import { uploadAndInsert, pickForElement } from './image/useImageUpload.js'
import { IconButton } from '../components/Button.jsx'
import Menu, { useMenu } from '../components/Menu.jsx'
import { zoomStep, reportZoom } from './useEditorShortcuts.js'

const PADDING = 48
const HINT_KEY = 'qng.studio.hint.canvas'

/** One-time orientation for new authors; dismissed forever with one click. */
function CanvasHint() {
  const { t } = useI18n()
  const [shown, setShown] = useState(() => { try { return localStorage.getItem(HINT_KEY) !== '1' } catch { return false } })
  if (!shown) return null
  const dismiss = () => { setShown(false); try { localStorage.setItem(HINT_KEY, '1') } catch { /* private mode */ } }
  return (
    <div className="canvas-hint" role="note">
      <span>{t('editor.hint1')}</span><i />
      <span>{t('editor.hint2')}</span><i />
      <span>{t('editor.hint3')}</span>
      <button type="button" className="btn btn-sm btn-ghost" onClick={dismiss}>{t('editor.hintDismiss')}</button>
    </div>
  )
}

export default function Canvas() {
  const { t } = useI18n()
  const quiz = useEditor((s) => s.quiz)
  const slide = useEditor(currentSlide)
  const selectedIds = useEditor((s) => s.selectedIds)
  const editingId = useEditor((s) => s.editingId)
  const croppingId = useEditor((s) => s.croppingId)
  const zoom = useEditor((s) => s.zoom)

  const areaRef = useRef(null)
  const slideRef = useRef(null)
  const selectionRef = useRef(null)
  const pendingDragRef = useRef(null)
  const nodesRef = useRef(new Map())
  const [nodesVersion, setNodesVersion] = useState(0)
  const [areaSize, setAreaSize] = useState({ w: 800, h: 600 })
  const [marquee, setMarquee] = useState(null)
  const [dropping, setDropping] = useState(false)
  const [toolbarRect, setToolbarRect] = useState(null)
  const menu = useMenu()

  useLayoutEffect(() => {
    const node = areaRef.current
    if (!node) return undefined
    const measure = () => setAreaSize({ w: node.clientWidth, h: node.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(node)
    return () => ro.disconnect()
  }, [])

  const fitScale = Math.max(0.05, Math.min((areaSize.w - PADDING * 2) / SLIDE_W, (areaSize.h - PADDING * 2) / SLIDE_H))
  const scale = zoom === 'fit' ? fitScale : zoom
  useEffect(() => { reportZoom(scale) }, [scale])

  const registerRef = useCallback((id, node) => {
    const map = nodesRef.current
    if (node) { if (map.get(id) !== node) { map.set(id, node); setNodesVersion((v) => v + 1) } }
    else if (map.has(id)) { map.delete(id); setNodesVersion((v) => v + 1) }
  }, [])

  const selectedElements = useMemo(() => (slide ? selectedIds.map((id) => slide.elements.find((e) => e.id === id)).filter(Boolean) : []), [slide, selectedIds])
  const otherNodes = useMemo(() => {
    if (!slide) return []
    return slide.elements.filter((e) => !selectedIds.includes(e.id) && !e.hidden).map((e) => nodesRef.current.get(e.id)).filter(Boolean)
  }, [slide, selectedIds, nodesVersion]) // eslint-disable-line react-hooks/exhaustive-deps
  const nodes = nodesRef.current

  // Position the floating text toolbar above the (single) selected text/answer element.
  const textTarget = selectedElements.length === 1 && (selectedElements[0].kind === 'text' || selectedElements[0].kind === 'answer') ? selectedElements[0] : null
  useEffect(() => {
    if (!textTarget) { setToolbarRect(null); return undefined }
    const update = () => {
      const node = nodesRef.current.get(textTarget.id)
      if (node) setToolbarRect(node.getBoundingClientRect())
    }
    update()
    const id = requestAnimationFrame(update)
    const area = areaRef.current
    area?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    return () => { cancelAnimationFrame(id); area?.removeEventListener('scroll', update); window.removeEventListener('resize', update) }
  }, [textTarget, textTarget?.x, textTarget?.y, textTarget?.w, textTarget?.h, textTarget?.rotation, scale, nodesVersion])

  // ── Element interactions ──
  const onElementPointerDown = (e, el) => {
    if (editingId === el.id || croppingId) return
    if (e.button === 2) { if (!selectedIds.includes(el.id)) select([el.id]); return }
    if (e.button !== 0) return
    e.stopPropagation()
    if (editingId) setEditing(null)
    if (e.shiftKey || e.ctrlKey || e.metaKey) { select([el.id], { toggle: true }); return }
    // An already-selected element is dragged by Moveable itself; a newly selected one needs a hand-off.
    const wasSelected = selectedIds.includes(el.id)
    if (!wasSelected) select([el.id])
    pendingDragRef.current = !wasSelected && !el.locked ? el.id : null
  }

  // Press-and-drag in one gesture, also on the first press. Started from mousedown (see SelectionLayer.startDrag).
  const onElementMouseDown = (e, el) => {
    if (e.button !== 0 || pendingDragRef.current !== el.id) return
    pendingDragRef.current = null
    const nativeEvent = e.nativeEvent
    let released = false
    const onUp = () => { released = true }
    const stop = () => window.removeEventListener('mouseup', onUp, true)
    window.addEventListener('mouseup', onUp, true)
    // The selection layer mounts a frame after the selection changes: wait for it, unless the press ended.
    const attempt = (tries) => {
      if (released) { stop(); return }
      const layer = selectionRef.current
      if (layer) { layer.startDrag(nativeEvent, () => released); setTimeout(stop, 500); return }
      if (tries < 6) requestAnimationFrame(() => attempt(tries + 1)); else stop()
    }
    attempt(0)
  }

  const onElementDoubleClick = (e, el) => {
    e.stopPropagation()
    if (el.locked) return
    if (el.kind === 'text' || el.kind === 'answer') setEditing(el.id)
    else if (el.kind === 'image') {
      const src = el.binding === 'question-media' ? slide?.question?.media?.src : el.src
      if (src) setCropping(el.id); else pickForElement(el.id)
    }
  }

  const onElementContextMenu = (e, el) => {
    e.preventDefault(); e.stopPropagation()
    if (!selectedIds.includes(el.id)) select([el.id])
    menu.open(e, { kind: 'element', el })
  }

  // ── Text commits from the inline editor ──
  const onTextCommit = (el, value) => {
    if (el.kind === 'answer') setAnswer(slide.id, el.index, { text: value })
    else if (el.binding === 'question') updateQuestion(slide.id, { text: value })
    else if (el.binding === 'quiz-title') { if (value.trim()) setTitle(value.trim()) }
    else updateElement(el.id, { html: value }, `text:${el.id}`)
  }
  const onTextAutoFit = (el, h) => {
    const next = Math.max(40, Math.round(h))
    if (Math.abs(next - el.h) > 2) updateElement(el.id, { h: next }, `text:${el.id}`)
  }

  // ── Background: marquee / clear selection ──
  const toSlideCoords = (clientX, clientY) => {
    const rect = slideRef.current.getBoundingClientRect()
    return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale }
  }
  const onBackgroundPointerDown = (e) => {
    if (e.button !== 0 || croppingId) return
    if (e.target.closest('.el') || e.target.closest('.moveable-control-box')) return
    if (editingId) setEditing(null)
    const start = toSlideCoords(e.clientX, e.clientY)
    let moved = false
    const move = (ev) => {
      const cur = toSlideCoords(ev.clientX, ev.clientY)
      if (!moved && Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 4) return
      moved = true
      setMarquee({ x: Math.min(start.x, cur.x), y: Math.min(start.y, cur.y), w: Math.abs(cur.x - start.x), h: Math.abs(cur.y - start.y) })
    }
    const up = (ev) => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up)
      if (!moved) { clearSelection(); return }
      const cur = toSlideCoords(ev.clientX, ev.clientY)
      const r = { x: Math.min(start.x, cur.x), y: Math.min(start.y, cur.y), w: Math.abs(cur.x - start.x), h: Math.abs(cur.y - start.y) }
      const hit = slide.elements.filter((el) => !el.hidden && !el.locked && el.x < r.x + r.w && el.x + el.w > r.x && el.y < r.y + r.h && el.y + el.h > r.y).map((el) => el.id)
      select(hit, { additive: ev.shiftKey })
      setMarquee(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // ── Drop / paste images ──
  const onDrop = (e) => {
    e.preventDefault(); setDropping(false)
    const files = Array.from(e.dataTransfer.files || []).filter((f) => f.type.startsWith('image/'))
    if (!files.length) return
    const p = slideRef.current ? toSlideCoords(e.clientX, e.clientY) : {}
    uploadAndInsert(files, { x: p.x, y: p.y })
  }
  useEffect(() => {
    const onPaste = (e) => {
      const target = e.target
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      const files = Array.from(e.clipboardData?.files || []).filter((f) => f.type.startsWith('image/'))
      if (files.length) { e.preventDefault(); uploadAndInsert(files); return }
      const text = e.clipboardData?.getData('text/plain')
      if (text && !useEditorClipboardHasItems()) { e.preventDefault(); insertText({ text, startEditing: false }) }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  const onWheel = (e) => {
    if (!(e.ctrlKey || e.metaKey)) return
    e.preventDefault()
    setZoom(zoomStep(scale, e.deltaY < 0 ? 1 : -1))
  }
  useEffect(() => {
    const node = areaRef.current
    if (!node) return undefined
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }) // eslint-disable-line react-hooks/exhaustive-deps

  if (!slide) return <div className="canvas-wrap" />

  const croppingEl = croppingId ? slide.elements.find((e) => e.id === croppingId) : null
  const slideRect = slideRef.current?.getBoundingClientRect()

  const elementMenuItems = (el) => {
    const ids = selectedIds.length ? selectedIds : [el.id]
    const isImage = el.kind === 'image'
    const hasSrc = isImage && (el.binding === 'question-media' ? slide.question?.media?.src : el.src)
    return [
      ...(el.kind === 'text' || el.kind === 'answer' ? [{ label: t('editor.editText'), icon: 'type', onClick: () => setEditing(el.id), kbd: 'Enter' }] : []),
      ...(isImage ? [
        { label: t('editor.crop'), icon: 'crop', disabled: !hasSrc, onClick: () => setCropping(el.id) },
        { label: t('editor.replaceImage'), icon: 'image', onClick: () => pickForElement(el.id) },
        { label: t('editor.setAsBackground'), icon: 'paint', disabled: !hasSrc, onClick: () => setBackground(slide.id, { kind: 'image', src: hasSrc, overlay: null, fit: 'cover' }, null) },
      ] : []),
      { sep: true },
      { label: t('common.copy'), icon: 'copy', kbd: 'Ctrl+C', onClick: copySelection },
      { label: t('common.duplicate'), icon: 'plusSquare', kbd: 'Ctrl+D', onClick: () => duplicateElements(ids) },
      { sep: true },
      { label: t('editor.layerFront'), icon: 'bringFront', onClick: () => reorderElements(ids, 'front') },
      { label: t('editor.layerBack'), icon: 'sendBack', onClick: () => reorderElements(ids, 'back') },
      { label: el.locked ? t('editor.unlock') : t('editor.lock'), icon: el.locked ? 'unlock' : 'lock', onClick: () => toggleLock(ids) },
      { sep: true },
      { label: t('common.delete'), icon: 'trash', danger: true, kbd: 'Del', onClick: () => deleteElements(ids) },
    ]
  }
  const backgroundMenuItems = () => [
    { label: t('common.paste'), icon: 'copy', kbd: 'Ctrl+V', onClick: pasteClipboard, disabled: !useEditorClipboardHasItems() },
    { label: t('editor.insertText'), icon: 'type', onClick: () => insertText() },
  ]

  return (
    <div className="canvas-wrap" onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDropping(true) } }} onDragLeave={() => setDropping(false)} onDrop={onDrop}>
      <InsertBar />
      <div ref={areaRef} className="canvas-area" onPointerDown={onBackgroundPointerDown} onContextMenu={(e) => { if (!e.target.closest('.el')) { e.preventDefault(); menu.open(e, { kind: 'background' }) } }}>
        <div className="canvas-inner">
          <div ref={slideRef} className="canvas-slide" style={{ width: SLIDE_W * scale, height: SLIDE_H * scale }}>
            <SlideRenderer
              quiz={quiz}
              slide={slide}
              scale={scale}
              mode="edit"
              selectedIds={selectedIds}
              editingId={editingId}
              croppingId={croppingId}
              registerRef={registerRef}
              onElementPointerDown={onElementPointerDown}
              onElementMouseDown={onElementMouseDown}
              onElementDoubleClick={onElementDoubleClick}
              onElementContextMenu={onElementContextMenu}
              onTextCommit={onTextCommit}
              onTextAutoFit={onTextAutoFit}
            >
              {marquee && <div className="canvas-marquee" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h, borderWidth: 1 / scale }} />}
            </SlideRenderer>
            {!croppingEl && selectedElements.length > 0 && !editingId && (
              <SelectionLayer ref={selectionRef} elements={selectedElements} nodes={nodes} otherNodes={otherNodes} rootContainer={areaRef.current} scale={scale} />
            )}
            {!croppingEl && selectedElements.length > 0 && editingId && (
              <SelectionLayer ref={selectionRef} elements={selectedElements} nodes={nodes} otherNodes={otherNodes} rootContainer={areaRef.current} scale={scale} disabled />
            )}
            {croppingEl && slideRect && (
              <ImageCropper el={croppingEl} slide={slide} scale={scale} barAnchor={{ left: slideRect.left + slideRect.width / 2, top: Math.min(window.innerHeight - 60, slideRect.bottom + 12) }} />
            )}
            {dropping && <div className="canvas-dropzone">{t('editor.dropHere')}</div>}
          </div>
        </div>
      </div>

      <CanvasHint />

      <div className="zoom-bar">
        <IconButton icon="zoomOut" size="sm" label={t('editor.zoomOut')} onClick={() => setZoom(zoomStep(scale, -1))} />
        <button type="button" className={`zoom-value ${zoom === 'fit' ? 'is-fit' : ''}`} onClick={() => setZoom('fit')} data-tip={t('editor.zoomFit')} data-tip-pos="top">{Math.round(scale * 100)}%</button>
        <IconButton icon="zoomIn" size="sm" label={t('editor.zoomIn')} onClick={() => setZoom(zoomStep(scale, 1))} />
      </div>

      {textTarget && toolbarRect && !croppingId && <TextToolbar element={textTarget} editing={editingId === textTarget.id} anchorRect={toolbarRect} quiz={quiz} />}

      {menu.menu && (
        <Menu anchor={menu.menu.anchor} onClose={menu.close} items={menu.menu.data.kind === 'element' ? elementMenuItems(menu.menu.data.el) : backgroundMenuItems()} />
      )}
    </div>
  )
}

// Read the internal clipboard without subscribing.
import { getState } from '../state/editorStore.js'
function useEditorClipboardHasItems() { return !!getState().clipboard?.length }
