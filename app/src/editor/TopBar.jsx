import React, { useEffect, useState } from 'react'
import { useI18n, LANGUAGES } from '../i18n/index.js'
import { navigate } from '../router.jsx'
import { authStore, logout } from '../state/authStore.js'
import { useEditor, undo, redo, setTitle, openDrawer, saveNow, flushOnLeave } from '../state/editorStore.js'
import Button, { IconButton } from '../components/Button.jsx'
import Icon from '../components/Icon.jsx'
import Menu, { useMenu } from '../components/Menu.jsx'
import TemplateSwitcher from '../components/TemplateSwitcher.jsx'

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

/**
 * Three zones (SPEC FR-04): where am I · undo · what can I do next. Everything occasional
 * (settings, shortcuts, language, account) lives behind one "more" menu.
 */
export default function TopBar({ onPreview }) {
  const { t, lang, setLang } = useI18n()
  const user = authStore.useStore((s) => s.user)
  const title = useEditor((s) => s.quiz?.title || '')
  const canUndo = useEditor((s) => s.canUndo)
  const canRedo = useEditor((s) => s.canRedo)
  const questionCount = useEditor((s) => s.quiz?.slides.filter((x) => x.type === 'question').length || 0)
  const [draft, setDraft] = useState(title)
  const more = useMenu()

  useEffect(() => { setDraft(title) }, [title])

  const commitTitle = () => {
    const next = draft.trim()
    if (next && next !== title) setTitle(next)
    else setDraft(title)
  }
  const leave = (fn) => () => { flushOnLeave(); fn() }

  return (
    <header className="topbar">
      <IconButton icon="arrowLeft" label={t('editor.backToLibrary')} onClick={leave(() => navigate('/'))} className="rtl-flip" />
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
      <div className="vdivider" />
      <Button variant="ghost" icon="listChecks" onClick={() => openDrawer('questions')}>{t('editor.questions')} <span className="chip" style={{ height: 20 }}>{questionCount}</span></Button>
      <TemplateSwitcher>{(open) => <Button variant="ghost" icon="palette" onClick={open}>{t('settings.template')}</Button>}</TemplateSwitcher>
      <Button variant="primary" icon="play" onClick={onPreview}>{t('editor.preview')}</Button>
      <IconButton icon="more" label={t('common.more')} onClick={(e) => more.open(e)} />
      {more.menu && (
        <Menu anchor={more.menu.anchor} align="end" onClose={more.close} minWidth={230} items={[
          { title: user?.email },
          { label: t('editor.settings'), icon: 'settings', onClick: () => openDrawer('settings') },
          { label: t('editor.shortcuts'), icon: 'keyboard', onClick: () => openDrawer('shortcuts') },
          { label: t('home.play'), icon: 'monitor', disabled: true, badge: t('common.comingSoon') },
          { sep: true },
          ...Object.entries(LANGUAGES).map(([code, meta]) => ({ label: `${meta.flag} ${meta.nativeName}`, checked: lang === code, onClick: () => setLang(code) })),
          { sep: true },
          { label: t('editor.backToLibrary'), icon: 'home', onClick: leave(() => navigate('/')) },
          { label: t('common.logout'), icon: 'logout', onClick: leave(logout) },
        ]} />
      )}
    </header>
  )
}
