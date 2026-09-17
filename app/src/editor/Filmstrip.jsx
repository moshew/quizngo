import React, { useMemo, useState } from 'react'
import { useI18n } from '../i18n/index.js'
import { SLIDE_TYPES } from '../model/constants.js'
import { createSlideFromTemplate } from '../model/templates/index.js'
import {
  useEditor, selectSlide, addSlide, duplicateSlide, deleteSlide, moveSlide, setSlideHidden, setSlideType, addResultsAfter,
} from '../state/editorStore.js'
import SlideThumb from '../components/SlideThumb.jsx'
import Button, { IconButton } from '../components/Button.jsx'
import Icon from '../components/Icon.jsx'
import Menu, { useMenu } from '../components/Menu.jsx'
import Modal from '../components/Modal.jsx'
import { toast } from '../components/Toast.jsx'

const TYPE_ICON = { opening: 'flag', question: 'help', statistics: 'barChart', leaderboard: 'trophy', transition: 'slide', summary: 'star' }

export function AddSlideDialog({ open, onClose, onPick, quiz }) {
  const { t } = useI18n()
  const samples = useMemo(() => (open ? SLIDE_TYPES.map((type) => ({ type, slide: createSlideFromTemplate(quiz, type) })) : []), [open, quiz])
  return (
    <Modal open={open} onClose={onClose} size="lg" title={t('editor.addSlide')}>
      <div className="slide-type-grid">
        {samples.map(({ type, slide }) => (
          <button key={type} type="button" className="slide-type-card" onClick={() => { onPick(type); onClose() }}>
            <SlideThumb slide={slide} quiz={quiz} />
            <div className="row">
              <span className={`badge-type type-${type}`}>{t(`slideTypes.${type}`)}</span>
            </div>
            <small>{t(`slideTypes.descriptions.${type}`)}</small>
          </button>
        ))}
      </div>
    </Modal>
  )
}

export default function Filmstrip() {
  const { t } = useI18n()
  const quiz = useEditor((s) => s.quiz)
  const currentSlideId = useEditor((s) => s.currentSlideId)
  const [adding, setAdding] = useState(false)
  const [drag, setDrag] = useState(null) // { id, overId, position }
  const menu = useMenu()

  const slides = quiz.slides

  const onDragStart = (e, id) => {
    setDrag({ id, overId: null, position: null })
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }
  const onDragOver = (e, id) => {
    e.preventDefault()
    if (!drag || drag.id === id) return
    const rect = e.currentTarget.getBoundingClientRect()
    const position = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
    if (drag.overId !== id || drag.position !== position) setDrag({ ...drag, overId: id, position })
  }
  const onDrop = (e) => {
    e.preventDefault()
    if (!drag?.overId || drag.overId === drag.id) { setDrag(null); return }
    const from = slides.findIndex((s) => s.id === drag.id)
    let to = slides.findIndex((s) => s.id === drag.overId)
    if (drag.position === 'after') to += 1
    if (from < to) to -= 1
    moveSlide(drag.id, to)
    setDrag(null)
  }

  const menuItems = (slide) => {
    const idx = slides.findIndex((s) => s.id === slide.id)
    return [
      { label: t('editor.duplicateSlide'), icon: 'copy', onClick: () => duplicateSlide(slide.id), kbd: 'Ctrl+D' },
      { label: slide.hidden ? t('editor.showSlide') : t('editor.hideSlide'), icon: slide.hidden ? 'eye' : 'eyeOff', onClick: () => setSlideHidden(slide.id, !slide.hidden) },
      { sep: true },
      ...(slide.type === 'question' ? [
        { label: t('editor.addStatsAfter'), icon: 'barChart', onClick: () => { const id = addResultsAfter(slide.id, 'statistics'); if (id) selectSlide(id) } },
        { label: t('editor.addLeaderboardAfter'), icon: 'trophy', onClick: () => { const id = addResultsAfter(slide.id, 'leaderboard'); if (id) selectSlide(id) } },
        { sep: true },
      ] : []),
      { title: t('editor.changeType') },
      ...SLIDE_TYPES.map((type) => ({ label: t(`slideTypes.${type}`), icon: TYPE_ICON[type], checked: slide.type === type, onClick: () => setSlideType(slide.id, type) })),
      { sep: true },
      { label: t('editor.deleteSlide'), icon: 'trash', danger: true, disabled: slides.length <= 1, onClick: () => { if (!deleteSlide(slide.id)) toast.warning(t('editor.cannotDeleteLast')) } },
      ...(idx >= 0 ? [] : []),
    ]
  }

  return (
    <aside className="filmstrip">
      <div className="filmstrip-list" onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
        {slides.map((slide, i) => (
          <div
            key={slide.id}
            className={`film-item ${slide.id === currentSlideId ? 'active' : ''} ${drag?.id === slide.id ? 'dragging' : ''} ${drag?.overId === slide.id ? `drop-${drag.position}` : ''}`}
            draggable
            onDragStart={(e) => onDragStart(e, slide.id)}
            onDragOver={(e) => onDragOver(e, slide.id)}
            onDragEnd={() => setDrag(null)}
            onClick={() => selectSlide(slide.id)}
            onContextMenu={(e) => menu.open(e, slide)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') selectSlide(slide.id) }}
          >
            <div className="film-num">{i + 1}</div>
            <div className="film-thumb">
              <SlideThumb slide={slide} quiz={quiz} lazy />
              <div className="film-badges"><span className={`badge-type type-${slide.type}`}>{t(`slideTypes.${slide.type}`)}</span></div>
              {slide.hidden && <div className="film-hidden" title={t('editor.hidden')}><Icon name="eyeOff" /></div>}
              <IconButton icon="moreV" label={t('common.more')} size="sm" className="film-menu-btn" onClick={(e) => { e.stopPropagation(); menu.open(e, slide) }} />
            </div>
          </div>
        ))}
      </div>
      <div className="filmstrip-footer">
        <Button variant="primary" icon="plus" block onClick={() => setAdding(true)}>{t('editor.addSlide')}</Button>
      </div>
      <AddSlideDialog open={adding} onClose={() => setAdding(false)} quiz={quiz} onPick={(type) => addSlide(type, { afterId: currentSlideId })} />
      {menu.menu && <Menu anchor={menu.menu.anchor} items={menuItems(menu.menu.data)} onClose={menu.close} />}
    </aside>
  )
}
