import { api, setToken } from './client.js'

export async function login({ email, name }) {
  const res = await api('/api/auth/login', { method: 'POST', body: { email, name } })
  setToken(res.token)
  return res.user
}

export async function me() {
  const res = await api('/api/auth/me')
  return res.user
}

export async function logout() {
  try { await api('/api/auth/logout', { method: 'POST' }) } catch { /* token may already be invalid */ }
  setToken(null)
}
