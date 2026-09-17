import React, { useState } from 'react'
import { useI18n } from '../i18n/index.js'
import { useEditor, applyTemplateToQuiz } from '../state/editorStore.js'
import Modal from './Modal.jsx'
import Button from './Button.jsx'
import TemplatePicker from './TemplatePicker.jsx'
import { toast } from './Toast.jsx'

/**
 * "Change template" flow for the open quiz: pick → confirm → apply (one undo step).
 * Render-prop so the top bar and the settings dialog can each bring their own trigger.
 */
export default function TemplateSwitcher({ children }) {
  const { t } = useI18n()
  const quiz = useEditor((s) => s.quiz)
  const [picking, setPicking] = useState(false)
  const [pending, setPending] = useState(null)

  return (
    <>
      {children(() => setPicking(true))}
      {picking && (
        <TemplatePicker open mode="apply" quiz={quiz} currentTemplateId={quiz.templateId} onClose={() => setPicking(false)}
          onApply={(id) => { setPicking(false); if (id !== quiz.templateId) setPending(id) }} />
      )}
      <Modal open={!!pending} onClose={() => setPending(null)} size="sm" title={t('templates.applyTitle', { name: pending ? t(`templates.names.${pending}`) : '' })}
        footer={<><Button variant="ghost" onClick={() => setPending(null)}>{t('common.cancel')}</Button><Button variant="primary" icon="paint" onClick={() => { applyTemplateToQuiz(pending); setPending(null); toast.success(t('templates.applied')) }}>{t('common.apply')}</Button></>}>
        <p className="muted">{t('templates.applyBody')}</p>
      </Modal>
    </>
  )
}
