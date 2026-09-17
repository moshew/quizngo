import { useSyncExternalStore } from 'react'

/**
 * Tiny external store: `get`, `set(partial | fn)`, `subscribe`, and a `useStore(selector)` hook.
 * Selectors should return stable slices or primitives (compared with Object.is).
 */
export function createStore(initialState) {
  let state = initialState
  const listeners = new Set()

  const get = () => state
  const set = (partial) => {
    const next = typeof partial === 'function' ? partial(state) : partial
    if (next === state) return
    state = { ...state, ...next }
    listeners.forEach((fn) => fn())
  }
  const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn) }

  const useStore = (selector = (s) => s) =>
    useSyncExternalStore(subscribe, () => selector(state), () => selector(state))

  return { get, set, subscribe, useStore }
}
