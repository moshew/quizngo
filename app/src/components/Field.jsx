import React, { useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'

/** Labeled numeric input with a small prefix letter; commits on Enter/blur/arrows. */
export function NumberField({ value, onChange, prefix, min = -Infinity, max = Infinity, step = 1, precision = 0, suffix, className = '', title, disabled }) {
  const [text, setText] = useState(format(value, precision))
  const focused = useRef(false)

  useEffect(() => { if (!focused.current) setText(format(value, precision)) }, [value, precision])

  const commit = (raw) => {
    const n = parseFloat(String(raw).replace(',', '.'))
    if (!Number.isFinite(n)) { setText(format(value, precision)); return }
    const clamped = Math.min(max, Math.max(min, n))
    const rounded = Number(clamped.toFixed(precision))
    setText(format(rounded, precision))
    if (rounded !== value) onChange(rounded)
  }

  return (
    <label className={`num-field ${className}`} title={title}>
      {prefix && <span>{prefix}</span>}
      <input
        type="text"
        inputMode="decimal"
        value={text}
        disabled={disabled}
        onFocus={(e) => { focused.current = true; e.target.select() }}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => { focused.current = false; commit(e.target.value) }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { commit(e.currentTarget.value); e.currentTarget.blur() }
          if (e.key === 'Escape') { setText(format(value, precision)); e.currentTarget.blur() }
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            const dir = e.key === 'ArrowUp' ? 1 : -1
            const mult = e.shiftKey ? 10 : 1
            commit((parseFloat(e.currentTarget.value) || 0) + dir * step * mult)
          }
        }}
      />
      {suffix && <span>{suffix}</span>}
    </label>
  )
}

function format(v, precision) {
  if (v === null || v === undefined || Number.isNaN(v)) return ''
  return Number(v).toFixed(precision).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1')
}

export function Switch({ checked, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="switch"
      disabled={disabled}
      onClick={() => onChange(!checked)}
    />
  )
}

/** options: [{ value, label?, icon?, tip? }] */
export function Segmented({ value, onChange, options, block = false, size }) {
  return (
    <div className={`seg ${block ? 'block' : ''}`} role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? 'active' : ''}
          data-tip={o.tip}
          onClick={() => onChange(o.value)}
          style={size === 'sm' ? { height: 22, minWidth: 24, padding: '0 6px' } : undefined}
        >
          {o.icon ? <Icon name={o.icon} size={size === 'sm' ? 14 : 16} /> : null}
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Slider({ value, onChange, min = 0, max = 100, step = 1, onCommit }) {
  return (
    <input
      type="range"
      className="range"
      min={min}
      max={max}
      step={step}
      value={value ?? min}
      onChange={(e) => onChange(Number(e.target.value))}
      onPointerUp={() => onCommit?.()}
      onKeyUp={() => onCommit?.()}
    />
  )
}
