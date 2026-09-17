/**
 * Unified API client (FR-17).
 * - Prefixes every path with the configured API base (same-origin `/api` by default).
 * - Attaches the Bearer token.
 * - Normalizes failures into ApiError: non-2xx, or a body with status === "error".
 * - Emits `qng:unauthorized` on 401 so the app can route to login.
 */

const API_BASE = (import.meta.env.VITE_APP_API_URL || '').replace(/\/$/, '')
const TOKEN_KEY = 'qng.studio.token'

let token = null
try { token = localStorage.getItem(TOKEN_KEY) } catch { /* storage unavailable */ }

export class ApiError extends Error {
  constructor(message, { code = 0, payload = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.payload = payload
  }
}

export function getToken() { return token }

export function setToken(next) {
  token = next || null
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch { /* ignore */ }
}

export function apiUrl(path) {
  if (/^https?:\/\//i.test(path)) return path
  return `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`
}

/** Resolve an asset reference (id or URL) to a fetchable URL. */
export function assetUrl(ref) {
  if (!ref) return ''
  if (/^(https?:|data:|blob:)/i.test(ref)) return ref
  if (ref.startsWith('/')) return apiUrl(ref)
  return apiUrl(`/api/assets/${ref}`)
}

function extractMessage(body, fallback) {
  if (body && typeof body === 'object') {
    if (typeof body.message === 'string' && body.message) return body.message
    if (typeof body.error === 'string' && body.error) return body.error
  }
  return fallback
}

export async function api(path, { method = 'GET', body, headers = {}, signal } = {}) {
  const init = { method, headers: { ...headers }, signal }
  if (token) init.headers.Authorization = `Bearer ${token}`

  if (body instanceof FormData) {
    init.body = body
  } else if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(body)
  }

  let response
  try {
    response = await fetch(apiUrl(path), init)
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    throw new ApiError('networkError', { code: 0 })
  }

  let payload = null
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    try { payload = await response.json() } catch { payload = null }
  } else {
    const text = await response.text().catch(() => '')
    payload = text ? { message: text } : null
  }

  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent('qng:unauthorized'))
  }

  if (!response.ok || (payload && payload.status === 'error')) {
    throw new ApiError(extractMessage(payload, `HTTP ${response.status}`), { code: response.status, payload })
  }
  return payload
}
