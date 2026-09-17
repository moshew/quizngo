import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../i18n/index.js'
import { SHAPES, WIDGET_TYPES } from '../model/constants.js'
import { insertText, insertShape, insertWidget } from '../state/editorStore.js'
import Icon from '../components/Icon.jsx'
import Menu, { useMenu } from '../components/Menu.jsx'
import { useImageUpload } from './image/useImageUpload.js'
import { shapePath } from './render/shapes.js'

const WIDGET_ICON = {
  'game-pin': 'hash', 'qr-code': 'qr', 'participants-count': 'users', 'participants-list': 'grid',
  timer: 'timer', respondents: 'user', 'answers-chart': 'barChart', leaderboard: 'trophy', 'question-number': 'numberSign',
}

function BarButton({ icon, label, onClick, active }) {
  return (
    <button type="button" className={`ibtn ${active ? 'active' : ''}`} onClick={onClick} aria-label={label}>
      <Icon name={icon} />
      <span>{label}</span>
    </button>
  )
}

/** Shapes are picked by eye, so show them — not a list of their names. */
function ShapePopover({ anchor, onPick, onClose }) {
  const { t } = useI18n()
  const ref = useRef(null)
  useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('mousedown', onDown, true)
    window.addEventListener('keydown', onKey, true)
    return () => { window.removeEventListener('mousedown', onDown, true); window.removeEventListener('keydown', onKey, true) }
  }, [onClose])
  const rtl = document.documentElement.dir === 'rtl'
  const style = { top: anchor.top, ...(rtl ? { right: window.innerWidth - anchor.left + 8 } : { left: anchor.right + 8 }) }
  return createPortal(
    <div ref={ref} className="menu shape-pop" style={style} role="menu">
      <div className="shape-menu-grid">
        {SHAPES.map((shape) => (
          <button key={shape} type="button" className="tile" onClick={() => { onPick(shape); onClose() }} aria-label={t(`inspector.shapes.${shape}`)} data-tip={t(`inspector.shapes.${shape}`)} data-tip-pos="top">
            <svg viewBox="0 0 24 24"><path d={shapePath(shape, 24, 24, 4)} fill={shape === 'line' ? 'none' : 'currentColor'} stroke="currentColor" strokeWidth={shape === 'line' ? 3 : 0} /></svg>
          </button>
        ))}
      </div>
    </div>,
    document.body,
  )
}

/** The four things an author adds to a slide. Background lives in the slide panel (SPEC FR-04). */
export default function InsertBar() {
  const { t } = useI18n()
  const [shapeAnchor, setShapeAnchor] = useState(null)
  const widgetMenu = useMenu()
  const imageMenu = useMenu()
  const { pickFiles, addImagesFromUrl } = useImageUpload()

  return (
    <div className="insert-bar" role="toolbar" aria-label={t('common.add')}>
      <BarButton icon="type" label={t('editor.insertText')} onClick={() => insertText()} />
      <BarButton icon="image" label={t('editor.insertImage')} onClick={(e) => imageMenu.open(e)} />
      <BarButton icon="shapes" label={t('editor.insertShape')} active={!!shapeAnchor} onClick={(e) => setShapeAnchor(shapeAnchor ? null : e.currentTarget.getBoundingClientRect())} />
      <BarButton icon="zap" label={t('editor.insertWidget')} onClick={(e) => widgetMenu.open(e)} />

      {imageMenu.menu && (
        <Menu anchor={imageMenu.menu.anchor} onClose={imageMenu.close} items={[
          { label: t('editor.uploadImage'), icon: 'upload', onClick: () => pickFiles({ multiple: true }) },
          { label: t('editor.imageFromUrl'), icon: 'link', onClick: () => { const url = window.prompt(t('editor.imageUrlPrompt')); if (url) addImagesFromUrl(url.trim()) } },
        ]} />
      )}
      {shapeAnchor && <ShapePopover anchor={shapeAnchor} onPick={insertShape} onClose={() => setShapeAnchor(null)} />}
      {widgetMenu.menu && (
        <Menu anchor={widgetMenu.menu.anchor} onClose={widgetMenu.close} minWidth={260} items={[
          { title: t('editor.insertWidgetTitle') },
          ...WIDGET_TYPES.map((w) => ({ label: t(`inspector.widgets.${w}`), icon: WIDGET_ICON[w], onClick: () => insertWidget(w) })),
        ]} />
      )}
    </div>
  )
}
