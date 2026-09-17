import React from 'react'
import Icon from './Icon.jsx'

const VARIANT_CLASS = {
  primary: 'btn btn-primary',
  secondary: 'btn',
  ghost: 'btn btn-ghost',
  danger: 'btn btn-danger',
  brand: 'btn-brand',
}

export default function Button({
  variant = 'secondary', size, icon, iconEnd, loading = false, block = false, className = '', children, disabled, type = 'button', ...rest
}) {
  const cls = [
    VARIANT_CLASS[variant] || VARIANT_CLASS.secondary,
    size === 'sm' ? 'btn-sm' : '',
    size === 'lg' ? 'btn-lg' : '',
    block ? 'btn-block' : '',
    className,
  ].filter(Boolean).join(' ')
  return (
    <button type={type} className={cls} disabled={disabled || loading} {...rest}>
      {loading ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : icon ? <Icon name={icon} /> : null}
      {children}
      {iconEnd ? <Icon name={iconEnd} /> : null}
    </button>
  )
}

export function IconButton({ icon, label, active = false, size, danger = false, tipPos, className = '', iconSize, ...rest }) {
  const cls = ['ibtn', size === 'sm' ? 'sm' : '', size === 'lg' ? 'lg' : '', active ? 'active' : '', danger ? 'danger' : '', className].filter(Boolean).join(' ')
  return (
    <button
      type="button"
      className={cls}
      aria-label={label}
      aria-pressed={active || undefined}
      data-tip={label || undefined}
      data-tip-pos={tipPos}
      {...rest}
    >
      <Icon name={icon} size={iconSize} />
    </button>
  )
}
