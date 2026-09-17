import React, { useMemo, useState } from 'react'
import Modal from './Modal.jsx'
import Button from './Button.jsx'
import SlideThumb from './SlideThumb.jsx'
import Icon from './Icon.jsx'
import { useI18n, CONTENT_LANGUAGES } from '../i18n/index.js'
import { TEMPLATES, createQuizFromTemplate } from '../model/templates/index.js'

/**
 * Template gallery. In "create" mode it also collects a title + content language and calls
 * onCreate({ title, templateId, language }). In "apply" mode it calls onApply(templateId).
 */
export default function TemplatePicker({ open, onClose, mode = 'create', currentTemplateId, onCreate, onApply, busy = false, defaultLanguage }) {
  const { t, lang } = useI18n()
  const [templateId, setTemplateId] = useState(currentTemplateId || TEMPLATES[0].id)
  const [title, setTitle] = useState('')
  const [language, setLanguage] = useState(defaultLanguage || lang)

  // Preview every template with the typed title so the picker is honest about the result.
  const previews = useMemo(
    () => TEMPLATES.map((tpl) => ({ tpl, quiz: createQuizFromTemplate({ title: title || t('templates.quizTitle'), templateId: tpl.id, language }) })),
    [title, language, t],
  )

  const submit = () => {
    if (mode === 'create') onCreate?.({ title: title.trim() || t('editor.untitled'), templateId, language })
    else onApply?.(templateId)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={t('templates.title')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" size="lg" icon={mode === 'create' ? 'sparkles' : 'paint'} loading={busy} onClick={submit}>
            {mode === 'create' ? t('templates.create') : t('common.apply')}
          </Button>
        </>
      }
    >
      <p className="muted" style={{ marginBottom: 16 }}>{t('templates.subtitle')}</p>
      {mode === 'create' && (
        <div className="row gap-12 wrap" style={{ marginBottom: 18 }}>
          <div className="field grow" style={{ minWidth: 260 }}>
            <label htmlFor="tpl-title">{t('templates.quizTitle')}</label>
            <input id="tpl-title" className="input" autoFocus value={title} placeholder={t('templates.quizTitlePlaceholder')} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit() }} />
          </div>
          <div className="field" style={{ width: 180 }}>
            <label htmlFor="tpl-lang">{t('settings.contentLanguage')}</label>
            <select id="tpl-lang" className="select" value={language} onChange={(e) => setLanguage(e.target.value)}>
              {Object.entries(CONTENT_LANGUAGES).map(([code, meta]) => <option key={code} value={code}>{meta.nativeName}</option>)}
            </select>
          </div>
        </div>
      )}
      <div className="tpl-grid">
        {previews.map(({ tpl, quiz }) => (
          <button
            key={tpl.id}
            type="button"
            className={`tpl-card ${templateId === tpl.id ? 'active' : ''}`}
            onClick={() => setTemplateId(tpl.id)}
            onDoubleClick={submit}
          >
            <SlideThumb slide={quiz.slides[0]} quiz={quiz} className="tpl-thumb" />
            <div className="tpl-card-body">
              <div className="row">
                <span className="tpl-dot" style={{ background: tpl.preview.accent }} />
                <strong className="grow truncate">{t(`templates.names.${tpl.id}`)}</strong>
                {templateId === tpl.id && <Icon name="check" size={16} />}
              </div>
              <div className="small muted">{t(`templates.descriptions.${tpl.id}`)}</div>
            </div>
          </button>
        ))}
      </div>
    </Modal>
  )
}
