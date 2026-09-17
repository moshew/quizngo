import React from 'react'
import { useI18n } from '../../i18n/index.js'
import { Switch } from '../../components/Field.jsx'
import ColorInput from '../../components/ColorInput.jsx'
import { NumberField } from '../../components/Field.jsx'
import { fontOptions } from '../text/TextToolbar.jsx'
import { useEditor } from '../../state/editorStore.js'
import { getTemplate } from '../../model/templates/index.js'

export function Section({ title, children, action }) {
  return (
    <div className="prop-section">
      {title && <div className="prop-title">{title}<span className="spacer" />{action}</div>}
      {children}
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

export function FontSelect({ value, onChange }) {
  const lang = useEditor((s) => s.quiz?.language)
  return (
    <select className="select sm font-select" value={value} onChange={(e) => onChange(e.target.value)} style={{ fontFamily: value }}>
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

export function ShadowSelect({ value, onChange }) {
  const { t } = useI18n()
  const key = Object.keys(SHADOW_PRESETS).find((k) => SHADOW_PRESETS[k] === (value || null)) || (value ? 'custom' : 'none')
  return (
    <select className="select sm" value={key} onChange={(e) => onChange(SHADOW_PRESETS[e.target.value] ?? null)}>
      <option value="none">{t('common.none')}</option>
      <option value="soft">Soft</option>
      <option value="hard">Hard</option>
      <option value="glow">Glow</option>
      <option value="deep">Deep</option>
      {key === 'custom' && <option value="custom">{t('common.custom')}</option>}
    </select>
  )
}

export function BorderControl({ value, onChange }) {
  const palette = usePalette()
  const width = value?.width || 0
  const color = value?.color || '#ffffff'
  return (
    <>
      <NumberField value={width} min={0} max={60} onChange={(w) => onChange(w > 0 ? { width: w, color } : null)} prefix="W" />
      <ColorInput size="sm" value={color} allowNull={false} palette={palette} onChange={(c) => onChange({ width: width || 3, color: c })} />
    </>
  )
}
