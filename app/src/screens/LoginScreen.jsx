import React, { useState } from 'react'
import { useI18n, LANGUAGES } from '../i18n/index.js'
import { login } from '../state/authStore.js'
import Button from '../components/Button.jsx'
import Icon from '../components/Icon.jsx'
import { toast } from '../components/Toast.jsx'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const CONFETTI = ['#FFD400', '#B6FF3C', '#FF2E93', '#ffffff', '#2BD68A']

export default function LoginScreen() {
  const { t, lang, setLang } = useI18n()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!EMAIL_RE.test(email.trim())) errs.email = t('login.invalidEmail')
    if (!name.trim()) errs.name = t('login.nameRequired')
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    try {
      await login({ email: email.trim(), name: name.trim() })
    } catch (err) {
      toast.error(err.message === 'networkError' ? t('common.networkError') : `${t('login.failed')}: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <div className="login-hero brand-bg">
        <div className="confetti" aria-hidden="true">
          {Array.from({ length: 14 }).map((_, i) => (
            <i key={i} style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%`, background: CONFETTI[i % CONFETTI.length], animationDelay: `${(i % 5) * 0.4}s`, transform: `rotate(${i * 25}deg)` }} />
          ))}
        </div>
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="QuizNGO" />
        <h1>{t('login.title')}</h1>
        <p>{t('login.subtitle')}</p>
      </div>
      <div className="login-panel">
        <div className="login-lang">
          <select className="select sm" value={lang} onChange={(e) => setLang(e.target.value)} aria-label={t('common.language')}>
            {Object.entries(LANGUAGES).map(([code, meta]) => <option key={code} value={code}>{meta.flag} {meta.nativeName}</option>)}
          </select>
        </div>
        <form className="login-card" onSubmit={submit} noValidate>
          <h2>{t('common.appName')}</h2>
          <div className="field">
            <label htmlFor="login-email">{t('login.email')}</label>
            <input id="login-email" className="input ltr" type="email" autoComplete="email" autoFocus value={email} placeholder={t('login.emailPlaceholder')} onChange={(e) => setEmail(e.target.value)} />
            {errors.email && <span className="field-error">{errors.email}</span>}
          </div>
          <div className="field">
            <label htmlFor="login-name">{t('login.name')}</label>
            <input id="login-name" className="input" autoComplete="name" value={name} placeholder={t('login.namePlaceholder')} onChange={(e) => setName(e.target.value)} />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </div>
          <Button type="submit" variant="primary" size="lg" block loading={busy} iconEnd="arrowRight">{t('login.submit')}</Button>
          <div className="hint"><Icon name="info" size={15} />{t('login.hint')}</div>
        </form>
      </div>
    </div>
  )
}
