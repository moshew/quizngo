import React, { useEffect, useState } from 'react'
import { useI18n, LANGUAGES } from '../i18n/index.js'
import { navigate } from '../router.jsx'
import { authStore, logout } from '../state/authStore.js'
import { useEditor, undo, redo, setTitle, openDrawer, saveNow, flushOnLeave } from '../state/editorStore.js'
import Button, { IconButton } from '../components/Button.jsx'
import Icon from '../components/Icon.jsx'
import Menu, { useMenu } from '../components/Menu.jsx'

function SaveState() {
  const { t } = useI18n()
  const saveState = useEditor((s) => s.saveState)
  const saveError = useEditor((s) => s.saveError)
  const map = {
    saved: { icon: 'success', label: t('editor.saved') },
    pending: { icon: 'timer', label: t('editor.savePending') },
    saving: { icon: 'refresh', label: t('editor.saving') },
    error: { icon: 'warning', label: `${t('editor.saveError')} · ${t('editor.retrySave')}` },
    conflict: { icon: 'warning', label: t('editor.conflictTitle') },
  }
  const m = map[saveState] || map.saved
  return (
    <button type="button" className={`save-state ${saveState}`} title={saveError || m.label} onClick={() => saveState === 'error' && saveNow({ force: false })} disabled={saveState !== 'error'} style={{ cursor: saveState === 'error' ? 'pointer' : 'default' }}>
      <Icon name={m.icon} />
      <span>{m.label}</span>
    </button>
  )
}

export default function TopBar({ onPreview }) {
  const { t, lang, setLang } = useI18n()
  const user = authStore.useStore((s) => s.user)
  const title = useEditor((s) => s.quiz?.title || '')
  const canUndo = useEditor((s) => s.canUndo)
  const canRedo = useEditor((s) => s.canRedo)
  const questionCount = useEditor((s) => s.quiz?.slides.filter((x) => x.type === 'question').length || 0)
  const [draft, setDraft] = useState(title)
  const userMenu = useMenu()

  useEffect(() => { setDraft(title) }, [title])

  const commitTitle = () => {
    const next = draft.trim()
    if (next && next !== title) setTitle(next)
    else setDraft(title)
  }

  return (
    <header className="topbar">
      <IconButton icon="arrowLeft" label={t('editor.backToLibrary')} onClick={() => { flushOnLeave(); navigate('/') }} className="rtl-flip" />
      <div className="brand"><img src={`${import.meta.env.BASE_URL}logo.png`} alt="QuizNGO" /></div>
      <div className="topbar-title grow">
        <input
          value={draft}
          placeholder={t('editor.untitled')}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setDraft(title); e.currentTarget.blur() } }}
          aria-label={t('settings.name')}
        />
        <SaveState />
      </div>
      <div className="topbar-group">
        <IconButton icon="undo" label={`${t('common.undo')} (Ctrl+Z)`} onClick={undo} disabled={!canUndo} />
        <IconButton icon="redo" label={`${t('common.redo')} (Ctrl+Y)`} onClick={redo} disabled={!canRedo} />
      </div>
      <Button icon="listChecks" onClick={() => openDrawer('questions')}>{t('editor.questions')} <span className="chip" style={{ height: 20 }}>{questionCount}</span></Button>
      <IconButton icon="settings" label={t('editor.settings')} onClick={() => openDrawer('settings')} />
      <IconButton icon="keyboard" label={t('editor.shortcuts')} onClick={() => openDrawer('shortcuts')} />
      <div className="vdivider" />
      <Button icon="monitor" onClick={onPreview}>{t('editor.preview')}</Button>
      <Button variant="primary" icon="play" disabled data-tip={t('common.comingSoon')}>{t('editor.play')}</Button>
      <button type="button" className="ibtn" onClick={(e) => userMenu.open(e)} aria-label={user?.name}>
        <span className="avatar" style={{ width: 28, height: 28, fontSize: 12 }}>{(user?.name || '?').slice(0, 1).toUpperCase()}</span>
      </button>
      {userMenu.menu && (
        <Menu anchor={userMenu.menu.anchor} align="end" onClose={userMenu.close} items={[
          { title: user?.email },
          ...Object.entries(LANGUAGES).map(([code, meta]) => ({ label: `${meta.flag} ${meta.nativeName}`, checked: lang === code, onClick: () => setLang(code) })),
          { sep: true },
          { label: t('editor.backToLibrary'), icon: 'home', onClick: () => { flushOnLeave(); navigate('/') } },
          { label: t('common.logout'), icon: 'logout', onClick: () => { flushOnLeave(); logout() } },
        ]} />
      )}
    </header>
  )
}
