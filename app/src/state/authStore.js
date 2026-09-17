import { createStore } from './store.js'
import * as authApi from '../api/auth.js'
import { getToken, setToken } from '../api/client.js'

/** status: 'loading' | 'authed' | 'anon' */
export const authStore = createStore({ status: 'loading', user: null })

export async function bootstrapAuth() {
  if (!getToken()) {
    authStore.set({ status: 'anon', user: null })
    return
  }
  try {
    const user = await authApi.me()
    authStore.set({ status: 'authed', user })
  } catch {
    setToken(null)
    authStore.set({ status: 'anon', user: null })
  }
}

export async function login(credentials) {
  const user = await authApi.login(credentials)
  authStore.set({ status: 'authed', user })
  return user
}

export async function logout() {
  await authApi.logout()
  authStore.set({ status: 'anon', user: null })
}

// A 401 from any request means the session is gone.
window.addEventListener('qng:unauthorized', () => {
  setToken(null)
  authStore.set({ status: 'anon', user: null })
})
