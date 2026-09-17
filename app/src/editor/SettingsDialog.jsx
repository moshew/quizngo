import React, { useState } from 'react'
import { useI18n, CONTENT_LANGUAGES } from '../i18n/index.js'
import { LIMITS } from '../model/constants.js'
import { useEditor, updateSettings, updateQuizMeta, applyTemplateToQuiz } from '../state/editorStore.js'
import { getTemplate } from '../model/templates/index.js'
import Modal from '../components/Modal.jsx'
import Button from '../components/Button.jsx'
import { NumberField } from '../components/Field.jsx'
import TemplatePicker from '../components/TemplatePicker.jsx'
import { toast } from '../components/Toast.jsx'

export default function SettingsDialog({ onClose }) {
  const { t } = useI18n()
  const quiz = useEditor((s) => s.quiz)
  const [picker, setPicker] = useState(false)
  const [confirmTemplate, setConfirmTemplate] = useState(null)
  const template = getTemplate(quiz.templateId)

  return (
    <>
      <Modal open onClose={onClose} title={t('settings.title')} footer={<Button variant="primary" onClick={onClose}>{t('common.done')}</Button>}>
        <div className="col gap-12">
          <div className="field">
            <label>{t('settings.name')}</label>
            <input className="input" value={quiz.title} onChange={(e) => updateQuizMeta({ title: e.target.value })} />
          </div>
          <div className="field">
            <label>{t('settings.description')}</label>
            <textarea className="textarea" rows={2} value={quiz.description} onChange={(e) => updateQuizMeta({ description: e.target.value })} />
          </div>
          <div className="prop-grid">
            <div className="field">
              <label>{t('settings.contentLanguage')}</label>
              <select className="select" value={quiz.language} onChange={(e) => updateQuizMeta({ language: e.target.value })}>
                {Object.entries(CONTENT_LANGUAGES).map(([code, meta]) => <option key={code} value={code}>{meta.nativeName}</option>)}
              </select>
            </div>
            <div className="field">
              <label>{t('settings.leaderboardSize')}</label>
              <NumberField value={quiz.settings.leaderboardSize} min={LIMITS.leaderboardSize[0]} max={LIMITS.leaderboardSize[1]} onChange={(v) => updateSettings({ leaderboardSize: v })} prefix="#" />
            </div>
            <div className="field">
              <label>{t('settings.questionWaitTime')}</label>
              <NumberField value={quiz.settings.questionWaitTime} min={LIMITS.questionWaitTime[0]} max={LIMITS.questionWaitTime[1]} onChange={(v) => updateSettings({ questionWaitTime: v })} suffix={t('common.seconds')} />
            </div>
            <div className="field">
              <label>{t('settings.clockActivationDelay')}</label>
              <NumberField value={quiz.settings.clockActivationDelay} min={LIMITS.clockActivationDelay[0]} max={LIMITS.clockActivationDelay[1]} onChange={(v) => updateSettings({ clockActivationDelay: v })} suffix={t('common.seconds')} />
            </div>
          </div>
          <p className="small dim">{t('settings.timingHelp')}</p>
          <hr />
          <div className="row gap-12">
            <div className="grow">
              <div className="label">{t('settings.template')}</div>
              <div className="row gap-6" style={{ marginTop: 4 }}>
                <span className="tpl-dot" style={{ background: template.preview.accent }} />
                <strong>{t(`templates.names.${template.id}`)}</strong>
              </div>
            </div>
            <Button icon="paint" onClick={() => setPicker(true)}>{t('settings.changeTemplate')}</Button>
          </div>
        </div>
      </Modal>

      {picker && (
        <TemplatePicker open mode="apply" currentTemplateId={quiz.templateId} onClose={() => setPicker(false)} onApply={(id) => { setPicker(false); if (id !== quiz.templateId) setConfirmTemplate(id) }} />
      )}

      <Modal open={!!confirmTemplate} onClose={() => setConfirmTemplate(null)} size="sm" title={t('templates.applyTitle', { name: confirmTemplate ? t(`templates.names.${confirmTemplate}`) : '' })}
        footer={<><Button variant="ghost" onClick={() => setConfirmTemplate(null)}>{t('common.cancel')}</Button><Button variant="primary" icon="paint" onClick={() => { applyTemplateToQuiz(confirmTemplate); setConfirmTemplate(null); toast.success(t('templates.applied')) }}>{t('common.apply')}</Button></>}>
        <p className="muted">{t('templates.applyBody')}</p>
      </Modal>
    </>
  )
}
