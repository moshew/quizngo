import { useEffect } from 'react'
import {
  getState, currentSlide, undo, redo, deleteElements, duplicateElements, copySelection, cutSelection, pasteClipboard,
  select, clearSelection, setEditing, setCropping, nudgeElements, setZoom, selectSlide, breakUndoCoalescing, reorderElements,
} from '../state/editorStore.js'

const ZOOM_STEPS = [0.1, 0.15, 0.2, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4]

export function zoomStep(current, dir) {
  const idx = ZOOM_STEPS.findIndex((z) => z >= current - 0.001)
  if (dir > 0) return ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, (idx < 0 ? ZOOM_STEPS.length - 1 : idx) + 1)]
  const below = ZOOM_STEPS.filter((z) => z < current - 0.001)
  return below.length ? below[below.length - 1] : ZOOM_STEPS[0]
}

function isTypingTarget(target) {
  if (!target) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

export function useEditorShortcuts({ enabled = true, onPreview } = {}) {
  useEffect(() => {
    if (!enabled) return undefined
    const onKey = (e) => {
      const state = getState()
      if (!state.quiz) return
      const mod = e.ctrlKey || e.metaKey
      const typing = isTypingTarget(e.target)

      if (e.key === 'Escape') {
        if (state.croppingId) { setCropping(null); return }
        if (state.editingId) { setEditing(null); e.target?.blur?.(); return }
        if (typing) return
        clearSelection()
        return
      }
      if (typing) return

      const ids = state.selectedIds
      const slide = currentSlide(state)

      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return }
      if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); if (slide) select(slide.elements.filter((el) => !el.locked).map((el) => el.id)); return }
      if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); if (ids.length) duplicateElements(ids); return }
      if (mod && e.key.toLowerCase() === 'c') { if (ids.length) { e.preventDefault(); copySelection() } return }
      if (mod && e.key.toLowerCase() === 'x') { if (ids.length) { e.preventDefault(); cutSelection() } return }
      if (mod && e.key.toLowerCase() === 'v') { if (state.clipboard?.length) { e.preventDefault(); pasteClipboard() } return }
      if (mod && (e.key === '=' || e.key === '+')) { e.preventDefault(); setZoom(zoomStep(currentZoom(), 1)); return }
      if (mod && e.key === '-') { e.preventDefault(); setZoom(zoomStep(currentZoom(), -1)); return }
      if (mod && e.key === '0') { e.preventDefault(); setZoom('fit'); return }
      if (mod && e.key === ']') { e.preventDefault(); if (ids.length) reorderElements(ids, e.shiftKey ? 'front' : 'forward'); return }
      if (mod && e.key === '[') { e.preventDefault(); if (ids.length) reorderElements(ids, e.shiftKey ? 'back' : 'backward'); return }
      if (e.key === 'F5' || (e.shiftKey && e.key === 'F5')) { e.preventDefault(); onPreview?.(); return }

      if (e.key === 'Delete' || e.key === 'Backspace') { if (ids.length) { e.preventDefault(); deleteElements(ids) } return }
      if (e.key === 'Enter' && ids.length === 1) {
        const el = slide && slide.elements.find((x) => x.id === ids[0])
        if (el && (el.kind === 'text' || el.kind === 'answer')) { e.preventDefault(); setEditing(el.id) }
        return
      }
      if (e.key.startsWith('Arrow')) {
        if (!ids.length) {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            const idx = state.quiz.slides.findIndex((s) => s.id === state.currentSlideId)
            const next = state.quiz.slides[idx + (e.key === 'ArrowDown' ? 1 : -1)]
            if (next) selectSlide(next.id)
          }
          return
        }
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        nudgeElements(ids, dx, dy)
        return
      }
      if (e.key === 'PageDown' || e.key === 'PageUp') {
        e.preventDefault()
        const idx = state.quiz.slides.findIndex((s) => s.id === state.currentSlideId)
        const next = state.quiz.slides[idx + (e.key === 'PageDown' ? 1 : -1)]
        if (next) selectSlide(next.id)
      }
    }
    const onKeyUp = (e) => { if (e.key.startsWith('Arrow')) breakUndoCoalescing() }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKeyUp)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp) }
  }, [enabled, onPreview])
}

let lastNumericZoom = 1
export function reportZoom(z) { lastNumericZoom = z }
function currentZoom() { return lastNumericZoom }
