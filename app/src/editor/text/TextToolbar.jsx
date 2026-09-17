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
import Menu, { useMenu } from '../../components/Menu.jsx'

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

  const more = useMenu()
  const nextDirection = { auto: 'rtl', rtl: 'ltr', ltr: 'auto' }[style.direction] || 'auto'

  // The essentials only (SPEC FR-04); the occasional tools sit behind "more" and in the panel.
  return createPortal(
    <div ref={ref} className="text-toolbar" style={{ left: pos.left, top: pos.top, visibility: pos.visibility }} onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.preventDefault()}>
      {!isAnswer && (
        <select
          className="select font-select"
          value={style.fontFamily}
          onChange={(e) => setStyle({ fontFamily: e.target.value }, null)}
          onMouseDown={(e) => e.stopPropagation()}
          aria-label={t('inspector.font')}
        >
          {fontOptions(quiz.language).map((f) => <option key={f.family} value={f.family} className="font-option" style={{ fontFamily: f.family }}>{f.family}</option>)}
        </select>
      )}
      <IconButton icon="minus" size="sm" label={t('editor.smaller')} onClick={() => setStyle({ fontSize: Math.max(8, Math.round(style.fontSize * 0.9)) })} />
      <NumberField value={style.fontSize} min={8} max={400} onChange={(v) => setStyle({ fontSize: v })} />
      <IconButton icon="plus" size="sm" label={t('editor.bigger')} onClick={() => setStyle({ fontSize: Math.min(400, Math.round(style.fontSize * 1.1)) })} />
      <div className="vdivider" />
      <IconButton icon="bold" size="sm" label="Bold" active={style.bold} onClick={toggleBold} />
      {!isAnswer && <IconButton icon="italic" size="sm" label="Italic" onClick={() => exec('italic')} />}
      {!isAnswer && <IconButton icon="underline" size="sm" label="Underline" onClick={() => exec('underline')} />}
      <ColorInput size="sm" value={style.color || '#ffffff'} allowNull={false} palette={template.palette} label={t('inspector.color')}
        onChange={(c) => { if (editing && !isAnswer) document.execCommand('foreColor', false, c); else setStyle({ color: c }) }} />
      {!isAnswer && (
        <>
          <div className="vdivider" />
          <Segmented size="sm" value={style.align} onChange={(v) => setStyle({ align: v }, null)} options={[
            { value: 'start', icon: 'alignLeft' }, { value: 'center', icon: 'alignCenter' }, { value: 'end', icon: 'alignRight' },
          ]} />
          <IconButton icon="more" size="sm" label={t('common.more')} onClick={(e) => more.open(e)} />
          {more.menu && (
            <Menu anchor={more.menu.anchor} onClose={more.close} items={[
              { label: t('editor.bulletList'), icon: 'list', onClick: () => exec('insertUnorderedList') },
              { label: t('editor.strike'), icon: 'strike', onClick: () => exec('strikeThrough') },
              { label: t('editor.justify'), icon: 'alignJustify', checked: style.align === 'justify', onClick: () => setStyle({ align: style.align === 'justify' ? 'start' : 'justify' }, null) },
              { label: `${t('inspector.direction')}: ${style.direction === 'auto' ? t('inspector.auto') : style.direction.toUpperCase()}`, icon: nextDirection === 'ltr' ? 'ltr' : 'rtl', keepOpen: true, onClick: () => setStyle({ direction: nextDirection }, null) },
              { sep: true },
              { label: t('editor.clearFormatting'), icon: 'eraser', onClick: () => exec('removeFormat') },
            ]} />
          )}
        </>
      )}
    </div>,
    document.body,
  )
}
