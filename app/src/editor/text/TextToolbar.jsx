import React, { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../../i18n/index.js'
import { FONTS } from '../../model/constants.js'
import { isRtlLang } from '../../model/schema.js'
import { getTemplate } from '../../model/templates/index.js'
import { updateElementStyle, setEditing } from '../../state/editorStore.js'
import { IconButton } from '../../components/Button.jsx'
import { NumberField, Segmented } from '../../components/Field.jsx'
import ColorInput from '../../components/ColorInput.jsx'

export function fontOptions(lang) {
  const rtl = isRtlLang(lang)
  const list = FONTS.slice().sort((a, b) => (rtl ? (b.he ? 1 : 0) - (a.he ? 1 : 0) : 0))
  return list
}

/** Runs an execCommand on the current text selection; enters editing first when needed. */
function withSelection(el, editing, fn) {
  if (editing) { fn(); return }
  setEditing(el.id)
  // TextEditor mounts, focuses and selects everything; then apply.
  setTimeout(fn, 30)
}

export default function TextToolbar({ element, editing, anchorRect, quiz }) {
  const { t } = useI18n()
  const ref = useRef(null)
  const [pos, setPos] = useState({ left: 0, top: 0, visibility: 'hidden' })
  const style = element.style
  const isAnswer = element.kind === 'answer'
  const template = getTemplate(quiz.templateId)

  useLayoutEffect(() => {
    if (!ref.current || !anchorRect) return
    const r = ref.current.getBoundingClientRect()
    let left = anchorRect.left + anchorRect.width / 2 - r.width / 2
    left = Math.max(8, Math.min(window.innerWidth - r.width - 8, left))
    let top = anchorRect.top - r.height - 12
    if (top < 64) top = Math.min(window.innerHeight - r.height - 8, anchorRect.bottom + 12)
    setPos({ left, top, visibility: 'visible' })
  }, [anchorRect, element.id])

  const setStyle = (patch, key) => updateElementStyle(element.id, patch, key || `style:${element.id}`)
  const exec = (cmd, value) => withSelection(element, editing, () => document.execCommand(cmd, false, value))

  const toggleBold = () => {
    if (editing) document.execCommand('bold')
    else setStyle({ bold: !style.bold }, null)
  }

  return createPortal(
    <div ref={ref} className="text-toolbar" style={{ left: pos.left, top: pos.top, visibility: pos.visibility }} onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.preventDefault()}>
      <select
        className="select font-select"
        value={style.fontFamily}
        onChange={(e) => setStyle({ fontFamily: e.target.value }, null)}
        onMouseDown={(e) => e.stopPropagation()}
        aria-label={t('inspector.font')}
      >
        {fontOptions(quiz.language).map((f) => <option key={f.family} value={f.family} className="font-option" style={{ fontFamily: f.family }}>{f.family}</option>)}
      </select>
      <IconButton icon="minus" size="sm" label="-" onClick={() => setStyle({ fontSize: Math.max(8, Math.round(style.fontSize * 0.9)) })} />
      <NumberField value={style.fontSize} min={8} max={400} onChange={(v) => setStyle({ fontSize: v })} />
      <IconButton icon="plus" size="sm" label="+" onClick={() => setStyle({ fontSize: Math.min(400, Math.round(style.fontSize * 1.1)) })} />
      <div className="vdivider" />
      <IconButton icon="bold" size="sm" label="Bold" active={style.bold} onClick={toggleBold} />
      {!isAnswer && <IconButton icon="italic" size="sm" label="Italic" onClick={() => exec('italic')} />}
      {!isAnswer && <IconButton icon="underline" size="sm" label="Underline" onClick={() => exec('underline')} />}
      {!isAnswer && <IconButton icon="strike" size="sm" label="Strike" onClick={() => exec('strikeThrough')} />}
      <ColorInput size="sm" value={style.color} allowNull={false} palette={template.palette} label={t('inspector.color')}
        onChange={(c) => { if (editing && !isAnswer) document.execCommand('foreColor', false, c); else setStyle({ color: c }) }} />
      {!isAnswer && (
        <ColorInput size="sm" value={style.background} palette={template.palette} label={t('inspector.fill')} onChange={(c) => setStyle({ background: c })} />
      )}
      {!isAnswer && (
        <>
          <div className="vdivider" />
          <Segmented size="sm" value={style.align} onChange={(v) => setStyle({ align: v }, null)} options={[
            { value: 'start', icon: 'alignLeft' }, { value: 'center', icon: 'alignCenter' }, { value: 'end', icon: 'alignRight' }, { value: 'justify', icon: 'alignJustify' },
          ]} />
          <IconButton icon="list" size="sm" label="List" onClick={() => exec('insertUnorderedList')} />
          <Segmented size="sm" value={style.direction} onChange={(v) => setStyle({ direction: v }, null)} options={[
            { value: 'auto', label: 'A' }, { value: 'rtl', icon: 'rtl' }, { value: 'ltr', icon: 'ltr' },
          ]} />
          <IconButton icon="eraser" size="sm" label={t('inspector.resetStyle')} onClick={() => exec('removeFormat')} />
        </>
      )}
    </div>,
    document.body,
  )
}
