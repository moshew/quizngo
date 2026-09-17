import { useSyncExternalStore } from 'react'
import he from './he.js'
import en from './en.js'

export const LANGUAGES = {
  he: { nativeName: 'עברית', dir: 'rtl', flag: '🇮🇱' },
  en: { nativeName: 'English', dir: 'ltr', flag: '🇺🇸' },
}

// Content languages a quiz can be authored in (affects default text direction of slide text).
export const CONTENT_LANGUAGES = {
  he: { nativeName: 'עברית', dir: 'rtl' },
  en: { nativeName: 'English', dir: 'ltr' },
  ar: { nativeName: 'العربية', dir: 'rtl' },
  ru: { nativeName: 'Русский', dir: 'ltr' },
  es: { nativeName: 'Español', dir: 'ltr' },
  fr: { nativeName: 'Français', dir: 'ltr' },
}

const dictionaries = { he, en }
const STORAGE_KEY = 'qng.studio.lang'

function readStoredLang() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && dictionaries[stored]) return stored
  } catch { /* storage unavailable */ }
  return 'he'
}

let currentLang = readStoredLang()
const listeners = new Set()

function applyDocumentDirection(lang) {
  const dir = LANGUAGES[lang]?.dir || 'ltr'
  document.documentElement.lang = lang
  document.documentElement.dir = dir
}
applyDocumentDirection(currentLang)

export function getLang() { return currentLang }
export function getDir(lang = currentLang) { return LANGUAGES[lang]?.dir || 'ltr' }

export function setLang(lang) {
  if (!dictionaries[lang] || lang === currentLang) return
  currentLang = lang
  try { localStorage.setItem(STORAGE_KEY, lang) } catch { /* ignore */ }
  applyDocumentDirection(lang)
  listeners.forEach((fn) => fn())
}

function lookup(dict, key) {
  return key.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), dict)
}

/**
 * Translate a key with optional {{param}} interpolation. Falls back to English, then the key itself.
 */
export function t(key, params = {}) {
  let value = lookup(dictionaries[currentLang], key)
  if (value === undefined) value = lookup(dictionaries.en, key)
  if (value === undefined) return key
  if (typeof value !== 'string') return value
  return value.replace(/\{\{(\w+)\}\}/g, (_, k) => (params[k] !== undefined ? params[k] : `{{${k}}}`))
}

function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useI18n() {
  const lang = useSyncExternalStore(subscribe, getLang, getLang)
  return { t, lang, dir: getDir(lang), setLang }
}
