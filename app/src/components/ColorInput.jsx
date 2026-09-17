import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon.jsx'
import { Slider } from './Field.jsx'
import { useI18n } from '../i18n/index.js'
import { parseColor, toCss, toHex } from '../editor/render/color.js'

const RECENT_KEY = 'qng.studio.recentColors'
const BASE_SWATCHES = ['#ffffff', '#000000', '#1a0a2e', '#FFD400', '#B6FF3C', '#FF2E93', '#6B2BFF', '#2BD68A', '#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#f97316', '#0ea5e9', '#a855f7', '#64748b']

function readRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') } catch { return [] }
}
function pushRecent(color) {
  try {
    const list = [color, ...readRecent().filter((c) => c !== color)].slice(0, 10)
    localStorage.setItem(RECENT_KEY, JSON.stringify(list))
  } catch { /* ignore */ }
}

/**
 * Color swatch + popover picker. `value` is any CSS color or null (transparent when allowNull).
 * `palette` — extra swatches (template palette). Calls onChange with a CSS string (hex or rgba).
 */
export default function ColorInput({ value, onChange, palette = [], allowNull = true, size, label }) {
  const { t } = useI18n()
  const btnRef = useRef(null)
  const popRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ left: 0, top: 0 })
  const parsed = parseColor(value) || { r: 0, g: 0, b: 0, a: value ? 1 : 0 }
  const [hexText, setHexText] = useState(toHex(parsed))
  const alpha = value ? parsed.a : 0

  useEffect(() => { setHexText(toHex(parsed)) }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    if (!open || !btnRef.current || !popRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    const p = popRef.current.getBoundingClientRect()
    let left = r.left + r.width / 2 - p.width / 2
    let top = r.bottom + 8
    if (left + p.width > window.innerWidth - 8) left = window.innerWidth - p.width - 8
    if (left < 8) left = 8
    if (top + p.height > window.innerHeight - 8) top = Math.max(8, r.top - p.height - 8)
    setPos({ left, top })
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => {
      if (popRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('mousedown', onDown, true)
    window.addEventListener('keydown', onKey, true)
    return () => { window.removeEventListener('mousedown', onDown, true); window.removeEventListener('keydown', onKey, true) }
  }, [open])

  const emit = (rgb, a = alpha || 1) => {
    const css = toCss({ ...rgb, a })
    pushRecent(css)
    onChange(css)
  }

  const pick = (css) => {
    const c = parseColor(css)
    if (!c) return
    emit(c, c.a === 1 && alpha > 0 && alpha < 1 ? alpha : c.a)
  }

  const swatchStyle = value ? { background: value } : {}
  const recent = readRecent()

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`swatch ${!value ? 'checker' : ''} ${size === 'sm' ? 'sm' : ''}`}
        style={swatchStyle}
        aria-label={label || t('inspector.color')}
        data-tip={label}
        onClick={() => setOpen((o) => !o)}
      />
      {open && createPortal(
        <div ref={popRef} className="color-pop" style={{ left: pos.left, top: pos.top }}>
          <div className="color-pop-row">
            <input
              type="color"
              className="color-native"
              value={toHex(parsed).slice(0, 7)}
              onChange={(e) => { const c = parseColor(e.target.value); emit(c, alpha || 1) }}
            />
            <input
              className="input sm mono ltr grow"
              value={hexText}
              onChange={(e) => setHexText(e.target.value)}
              onBlur={() => pick(hexText)}
              onKeyDown={(e) => { if (e.key === 'Enter') pick(hexText) }}
              spellCheck={false}
            />
            {allowNull && (
              <button type="button" className={`swatch sm checker ${!value ? 'active' : ''}`} data-tip={t('editor.transparent')} onClick={() => onChange(null)} />
            )}
          </div>
          <div className="color-pop-row">
            <Icon name="droplet" size={14} />
            <Slider min={0} max={100} value={Math.round((value ? parsed.a : 1) * 100)} onChange={(v) => emit(parsed, v / 100)} />
            <span className="xs dim mono" style={{ width: 34, textAlign: 'end' }}>{Math.round((value ? parsed.a : 1) * 100)}%</span>
          </div>
          {palette.length > 0 && (
            <>
              <div className="color-pop-title">{t('editor.colorPalette')}</div>
              <div className="color-grid">
                {palette.map((c) => <button key={c} type="button" className={`swatch sm ${sameColor(c, value) ? 'active' : ''}`} style={{ background: c }} onClick={() => pick(c)} />)}
              </div>
            </>
          )}
          <div className="color-grid">
            {BASE_SWATCHES.map((c) => <button key={c} type="button" className={`swatch sm ${sameColor(c, value) ? 'active' : ''}`} style={{ background: c }} onClick={() => pick(c)} />)}
          </div>
          {recent.length > 0 && (
            <>
              <div className="color-pop-title">{t('editor.recentColors')}</div>
              <div className="color-grid">
                {recent.map((c) => <button key={c} type="button" className="swatch sm" style={{ background: c }} onClick={() => pick(c)} />)}
              </div>
            </>
          )}
        </div>,
        document.body,
      )}
    </>
  )
}

function sameColor(a, b) {
  const pa = parseColor(a); const pb = parseColor(b)
  return !!pa && !!pb && pa.r === pb.r && pa.g === pb.g && pa.b === pb.b && Math.abs(pa.a - pb.a) < 0.01
}
