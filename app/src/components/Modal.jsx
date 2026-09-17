import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { IconButton } from './Button.jsx'
import { useI18n } from '../i18n/index.js'

// Stack of open modals so Escape only closes the topmost one.
const openStack = []

export default function Modal({ open, onClose, title, size, footer, children, closeOnBackdrop = true, className = '' }) {
  const { t } = useI18n()

  useEffect(() => {
    if (!open) return undefined
    const token = {}
    openStack.push(token)
    const onKey = (e) => {
      if (e.key !== 'Escape' || openStack[openStack.length - 1] !== token) return
      e.stopPropagation()
      onClose?.()
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      const i = openStack.indexOf(token)
      if (i >= 0) openStack.splice(i, 1)
    }
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => { if (closeOnBackdrop && e.target === e.currentTarget) onClose?.() }}>
      <div className={`modal ${size || ''} ${className}`} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        {(title || onClose) && (
          <div className="modal-header">
            {typeof title === 'string' ? <h2>{title}</h2> : title}
            {onClose && <IconButton icon="x" label={t('common.close')} onClick={onClose} />}
          </div>
        )}
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
