import React, { useEffect, useState } from 'react'
import Icon from './Icon.jsx'
import { createStore } from '../state/store.js'

const toastStore = createStore({ toasts: [] })
let seq = 0

function push(kind, message, { duration = 3500, action } = {}) {
  const id = ++seq
  toastStore.set((s) => ({ toasts: [...s.toasts, { id, kind, message, action }] }))
  if (duration > 0) setTimeout(() => dismiss(id), duration)
  return id
}

export function dismiss(id) {
  toastStore.set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
}

export const toast = {
  success: (m, o) => push('success', m, o),
  error: (m, o) => push('error', m, { duration: 6000, ...o }),
  info: (m, o) => push('info', m, o),
  warning: (m, o) => push('warning', m, o),
}

export function ToastHost() {
  const toasts = toastStore.useStore((s) => s.toasts)
  if (!toasts.length) return null
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          <Icon name={t.kind} />
          <span className="grow">{t.message}</span>
          {t.action && (
            <button type="button" className="btn btn-sm" onClick={() => { t.action.onClick?.(); dismiss(t.id) }}>{t.action.label}</button>
          )}
          <button type="button" className="ibtn sm" aria-label="close" onClick={() => dismiss(t.id)}><Icon name="x" size={14} /></button>
        </div>
      ))}
    </div>
  )
}

/** Small helper for components that need a transient flag (e.g. "copied!"). */
export function useFlash(ms = 1200) {
  const [on, setOn] = useState(false)
  useEffect(() => {
    if (!on) return undefined
    const id = setTimeout(() => setOn(false), ms)
    return () => clearTimeout(id)
  }, [on, ms])
  return [on, () => setOn(true)]
}
