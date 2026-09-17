import React, { useEffect, useState } from 'react'
import { useI18n } from '../i18n/index.js'
import { navigate } from '../router.jsx'
import {
  useEditor, openQuiz, closeQuiz, flushOnLeave, resolveConflict, restoreDraft, discardDraft, saveNow, closeDrawer,
} from '../state/editorStore.js'
import TopBar from '../editor/TopBar.jsx'
import Filmstrip from '../editor/Filmstrip.jsx'
import Canvas from '../editor/Canvas.jsx'
import Inspector from '../editor/inspector/Inspector.jsx'
import QuestionsDrawer from '../editor/questions/QuestionsDrawer.jsx'
import SettingsDialog from '../editor/SettingsDialog.jsx'
import ShortcutsDialog from '../editor/ShortcutsDialog.jsx'
import PreviewScreen from './PreviewScreen.jsx'
import Modal from '../components/Modal.jsx'
import Button from '../components/Button.jsx'
import { useEditorShortcuts } from '../editor/useEditorShortcuts.js'

export default function EditorScreen({ quizId }) {
  const { t } = useI18n()
  const loading = useEditor((s) => s.loading)
  const loadError = useEditor((s) => s.loadError)
  const quiz = useEditor((s) => s.quiz)
  const saveState = useEditor((s) => s.saveState)
  const drawer = useEditor((s) => s.drawer)
  const draftPrompt = useEditor((s) => s.draftPrompt)
  const currentSlideId = useEditor((s) => s.currentSlideId)
  const [preview, setPreview] = useState(false)

  useEffect(() => {
    openQuiz(quizId)
    return () => { flushOnLeave(); closeQuiz() }
  }, [quizId])

  // Flush pending changes when the tab is hidden or the page unloads.
  useEffect(() => {
    const onVisibility = () => { if (document.visibilityState === 'hidden') flushOnLeave() }
    const onUnload = () => flushOnLeave()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('beforeunload', onUnload)
    return () => { document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('beforeunload', onUnload) }
  }, [])

  useEditorShortcuts({ enabled: !preview && !drawer, onPreview: () => setPreview(true) })

  if (loadError) {
    return (
      <div className="editor-loading">
        <div className="empty">
          <div className="emoji">😵</div>
          <h3>{t('common.error')}</h3>
          <p>{loadError === 'networkError' ? t('common.networkError') : loadError}</p>
          <div className="row"><Button icon="refresh" onClick={() => openQuiz(quizId)}>{t('common.retry')}</Button><Button variant="ghost" icon="arrowLeft" onClick={() => navigate('/')}>{t('editor.backToLibrary')}</Button></div>
        </div>
      </div>
    )
  }
  if (loading || !quiz) return <div className="editor-loading"><span className="spinner lg" /></div>

  if (preview) {
    const startIndex = Math.max(0, quiz.slides.filter((s) => !s.hidden).findIndex((s) => s.id === currentSlideId))
    return <PreviewScreen quizId={quizId} quizDoc={quiz} startIndex={startIndex} onExit={() => setPreview(false)} />
  }

  return (
    <div className="editor">
      <TopBar onPreview={() => setPreview(true)} />
      <Filmstrip />
      <Canvas />
      <Inspector />

      {drawer === 'questions' && <QuestionsDrawer onClose={closeDrawer} />}
      {drawer === 'settings' && <SettingsDialog onClose={closeDrawer} />}
      {drawer === 'shortcuts' && <ShortcutsDialog onClose={closeDrawer} />}

      <Modal open={saveState === 'conflict'} onClose={() => {}} size="sm" title={t('editor.conflictTitle')} closeOnBackdrop={false}
        footer={<><Button variant="ghost" onClick={() => resolveConflict('reload')}>{t('editor.conflictReload')}</Button><Button variant="danger" onClick={() => resolveConflict('overwrite')}>{t('editor.conflictOverwrite')}</Button></>}>
        <p className="muted">{t('editor.conflictBody')}</p>
      </Modal>

      <Modal open={!!draftPrompt} onClose={discardDraft} size="sm" title={t('editor.draftTitle')}
        footer={<><Button variant="ghost" onClick={discardDraft}>{t('editor.draftDiscard')}</Button><Button variant="primary" icon="refresh" onClick={restoreDraft}>{t('editor.draftRestore')}</Button></>}>
        <p className="muted">{t('editor.draftBody')}</p>
      </Modal>

      {saveState === 'error' && null}
      <span className="sr-only" aria-live="polite">{saveState === 'saving' ? t('editor.saving') : ''}</span>
      <button type="button" className="sr-only" onClick={() => saveNow({ force: true })}>save</button>
    </div>
  )
}
