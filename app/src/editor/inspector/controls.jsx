import React, { useState } from 'react'
import { useI18n } from '../../i18n/index.js'
import Icon from '../../components/Icon.jsx'
import { Switch } from '../../components/Field.jsx'
import ColorInput from '../../components/ColorInput.jsx'
import { NumberField } from '../../components/Field.jsx'
import { fontOptions } from '../text/TextToolbar.jsx'
import { useEditor } from '../../state/editorStore.js'
import { getTemplate } from '../../model/templates/index.js'

const FOLD_KEY = 'qng.studio.fold.'

function readFold(id, fallback) {
  try { const v = localStorage.getItem(FOLD_KEY + id); return v === null ? fallback : v === '1' } catch { return fallback }
}

/**
 * Inspector section. With `foldId` it becomes collapsible and remembers its state across
 * visits (SPEC FR-04: content first, design on demand) — power users open it once and it stays.
 */
export function Section({ title, children, action, foldId, defaultOpen = false, icon }) {
  const [open, setOpen] = useState(() => (foldId ? readFold(foldId, defaultOpen) : true))
  if (!foldId) {
    return (
      <div className="prop-section">
        {title && <div className="prop-title">{title}<span className="spacer" />{action}</div>}
        {children}
      </div>
    )
  }
  const toggle = () => {
    const next = !open
    setOpen(next)
    try { localStorage.setItem(FOLD_KEY + foldId, next ? '1' : '0') } catch { /* private mode */ }
  }
  return (
    <div className={`prop-section is-fold ${open ? 'is-open' : ''}`}>
      <button type="button" className="prop-fold" onClick={toggle} aria-expanded={open}>
        {icon && <Icon name={icon} size={15} />}
        <span className="grow">{title}</span>
        <Icon name="chevronDown" size={15} className="chev" />
      </button>
      {open && <div className="prop-fold-body">{children}</div>}
    </div>
  )
}

export function Row({ label, children }) {
  return (
    <div className="prop-row">
      {label !== undefined && <label>{label}</label>}
      <div className="grow">{children}</div>
    </div>
  )
}

export function ToggleRow({ label, checked, onChange }) {
  return (
    <div className="prop-row">
      <label style={{ flex: 1 }}>{label}</label>
      <Switch checked={!!checked} onChange={onChange} label={label} />
    </div>
  )
}

export function usePalette() {
  const templateId = useEditor((s) => s.quiz?.templateId)
  return getTemplate(templateId).palette
}

/** `allowTemplate` adds the "as the template says" choice (value null) for skin-driven elements. */
export function FontSelect({ value, onChange, allowTemplate = false }) {
  const { t } = useI18n()
  const lang = useEditor((s) => s.quiz?.language)
  return (
    <select className="select sm font-select" value={value || ''} onChange={(e) => onChange(e.target.value || null)} style={{ fontFamily: value || undefined }}>
      {allowTemplate && <option value="">{t('inspector.fromTemplate')}</option>}
      {fontOptions(lang).map((f) => <option key={f.family} value={f.family} style={{ fontFamily: f.family }}>{f.family}</option>)}
    </select>
  )
}

export const SHADOW_PRESETS = {
  none: null,
  soft: '0 12px 32px rgba(0,0,0,0.35)',
  hard: '0 10px 0 #1a0a2e',
  glow: '0 0 40px rgba(255,255,255,0.55)',
  deep: '0 24px 60px rgba(0,0,0,0.55)',
}

/** `allowTemplate`: for skin-driven elements an empty value means "as the template says", not "none". */
export function ShadowSelect({ value, onChange, allowTemplate = false }) {
  const { t } = useI18n()
  const key = Object.keys(SHADOW_PRESETS).find((k) => SHADOW_PRESETS[k] === (value || null)) || (value ? 'custom' : 'none')
  return (
    <select className="select sm" value={key} onChange={(e) => onChange(SHADOW_PRESETS[e.target.value] ?? null)}>
      <option value="none">{allowTemplate ? t('inspector.fromTemplate') : t('common.none')}</option>
      <option value="soft">Soft</option>
      <option value="hard">Hard</option>
      <option value="glow">Glow</option>
      <option value="deep">Deep</option>
      {key === 'custom' && <option value="custom">{t('common.custom')}</option>}
    </select>
  )
}

export function BorderControl({ value, onChange, allowTemplate = false }) {
  const palette = usePalette()
  const width = value?.width || 0
  const color = value?.color || '#ffffff'
  return (
    <>
      <NumberField value={allowTemplate && !value ? null : width} min={0} max={60} onChange={(w) => onChange(value || w > 0 ? { width: w, color } : null)} prefix="W" />
      <ColorInput size="sm" value={color} allowNull={false} palette={palette} onChange={(c) => onChange({ width: width || 3, color: c })} />
    </>
  )
}
