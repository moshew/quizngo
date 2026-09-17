import { useSyncExternalStore } from 'react'

/**
 * Minimal History-API router. Routes are matched in order; ":param" segments are captured.
 * Paths are relative to Vite's BASE_URL (e.g. "/app/").
 */
const BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')

const ROUTES = [
  { name: 'login', pattern: '/login' },
  { name: 'home', pattern: '/' },
  { name: 'editor', pattern: '/edit/:id' },
  { name: 'preview', pattern: '/preview/:id' },
  { name: 'gallery', pattern: '/gallery' },
]

const listeners = new Set()

function currentPath() {
  let path = window.location.pathname
  if (BASE && path.startsWith(BASE)) path = path.slice(BASE.length)
  if (!path.startsWith('/')) path = '/' + path
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)
  return path
}

function match(path) {
  for (const route of ROUTES) {
    const patternParts = route.pattern.split('/').filter(Boolean)
    const pathParts = path.split('/').filter(Boolean)
    if (patternParts.length !== pathParts.length) continue
    const params = {}
    let ok = true
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i])
      else if (patternParts[i] !== pathParts[i]) { ok = false; break }
    }
    if (ok) return { name: route.name, params, path }
  }
  return { name: 'notfound', params: {}, path }
}

let snapshot = match(currentPath())

function refresh() {
  snapshot = match(currentPath())
  listeners.forEach((fn) => fn())
}

window.addEventListener('popstate', refresh)

export function navigate(to, { replace = false } = {}) {
  const url = BASE + (to.startsWith('/') ? to : '/' + to)
  if (replace) window.history.replaceState(null, '', url)
  else window.history.pushState(null, '', url)
  refresh()
}

export function useRoute() {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => listeners.delete(fn) },
    () => snapshot,
    () => snapshot,
  )
}

export function href(to) {
  return BASE + (to.startsWith('/') ? to : '/' + to)
}
