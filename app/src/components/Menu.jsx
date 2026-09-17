import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon.jsx'

/**
 * Floating menu positioned near an anchor (a DOMRect-like {x,y,width,height} or a point {x,y}).
 * items: [{ label, icon, onClick, danger, disabled, kbd, checked }, { sep: true }, { title: '...' }]
 */
export default function Menu({ anchor, items, onClose, align = 'start', minWidth }) {
  const ref = useRef(null)
  const [pos, setPos] = useState({ left: 0, top: 0, visibility: 'hidden' })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !anchor) return
    const rect = el.getBoundingClientRect()
    const a = { x: anchor.x ?? anchor.left ?? 0, y: anchor.y ?? anchor.top ?? 0, w: anchor.width ?? 0, h: anchor.height ?? 0 }
    const rtl = document.documentElement.dir === 'rtl'
    let left = align === 'end' !== rtl ? a.x + a.w - rect.width : a.x
    if (align === 'center') left = a.x + a.w / 2 - rect.width / 2
    let top = a.y + a.h + 6
    const pad = 8
    if (left + rect.width > window.innerWidth - pad) left = window.innerWidth - rect.width - pad
    if (left < pad) left = pad
    if (top + rect.height > window.innerHeight - pad) top = Math.max(pad, a.y - rect.height - 6)
    setPos({ left, top, visibility: 'visible' })
  }, [anchor, align, items])

  useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose?.() }
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    const onScroll = () => onClose?.()
    window.addEventListener('mousedown', onDown, true)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('mousedown', onDown, true)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [onClose])

  return createPortal(
    <div ref={ref} className="menu" role="menu" style={{ left: pos.left, top: pos.top, visibility: pos.visibility, minWidth }}>
      {items.filter(Boolean).map((item, i) => {
        if (item.sep) return <div key={`sep-${i}`} className="menu-sep" />
        if (item.title) return <div key={`title-${i}`} className="menu-title">{item.title}</div>
        return (
          <button
            key={item.key || item.label || i}
            type="button"
            role="menuitem"
            className={`menu-item ${item.danger ? 'danger' : ''} ${item.checked ? 'active' : ''}`}
            disabled={item.disabled}
            onClick={(e) => { e.stopPropagation(); item.onClick?.(e); if (!item.keepOpen) onClose?.() }}
          >
            {item.icon ? <Icon name={item.icon} /> : item.checked !== undefined ? <Icon name={item.checked ? 'check' : 'circle'} style={{ opacity: item.checked ? 1 : 0.25 }} /> : <span style={{ width: 17 }} />}
            <span className="grow truncate">{item.label}</span>
            {item.badge && <span className="chip">{item.badge}</span>}
            {item.kbd && <span className="kbd">{item.kbd}</span>}
          </button>
        )
      })}
    </div>,
    document.body,
  )
}

/** Hook: manage a menu anchored to a click/contextmenu event or element. */
export function useMenu() {
  const [state, setState] = useState(null) // { anchor, data }
  const open = (eOrEl, data) => {
    if (eOrEl?.preventDefault) {
      eOrEl.preventDefault()
      eOrEl.stopPropagation?.()
      const target = eOrEl.currentTarget
      if (eOrEl.type === 'contextmenu' || !target?.getBoundingClientRect) {
        setState({ anchor: { x: eOrEl.clientX, y: eOrEl.clientY, width: 0, height: 0 }, data })
      } else {
        setState({ anchor: target.getBoundingClientRect(), data })
      }
    } else if (eOrEl?.getBoundingClientRect) {
      setState({ anchor: eOrEl.getBoundingClientRect(), data })
    } else {
      setState({ anchor: eOrEl, data })
    }
  }
  const close = () => setState(null)
  return { menu: state, open, close, isOpen: !!state }
}
