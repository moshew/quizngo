import React, { useMemo, useState } from 'react'
import Modal from './Modal.jsx'
import Button from './Button.jsx'
import SlideThumb from './SlideThumb.jsx'
import Icon from './Icon.jsx'
import { useI18n, CONTENT_LANGUAGES } from '../i18n/index.js'
import { TEMPLATES, createQuizFromTemplate, applyTemplate } from '../model/templates/index.js'

const STRIP_TYPES = ['question', 'statistics', 'summary']

/** The slides a template card shows: a hero + one of each kind the audience will see most. */
function previewSlides(quiz) {
  const hero = quiz.slides[0]
  const strip = STRIP_TYPES.map((type) => quiz.slides.find((s) => s.type === type && s !== hero)).filter(Boolean)
  return { hero, strip }
}

/**
 * Template gallery. In "create" mode it also collects a title + content language and calls
 * onCreate({ title, templateId, language }). In "apply" mode (pass `quiz`) every card previews
 * the author's own quiz in that template and it calls onApply(templateId).
 */
export default function TemplatePicker({ open, onClose, mode = 'create', quiz: sourceQuiz, currentTemplateId, onCreate, onApply, busy = false, defaultLanguage }) {
  const { t, lang } = useI18n()
  const [templateId, setTemplateId] = useState(currentTemplateId || TEMPLATES[0].id)
  const [title, setTitle] = useState('')
  const [language, setLanguage] = useState(defaultLanguage || lang)

  // Honest previews: the typed title (create) or the author's real content (apply).
  const previews = useMemo(
    () => TEMPLATES.map((tpl) => {
      const quiz = mode === 'apply' && sourceQuiz
        ? applyTemplate(sourceQuiz, tpl.id)
        : createQuizFromTemplate({ title: title || t('templates.quizTitle'), templateId: tpl.id, language })
      return { tpl, quiz, ...previewSlides(quiz) }
    }),
    [mode, sourceQuiz, title, language, t],
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
        {previews.map(({ tpl, quiz, hero, strip }) => (
          <button
            key={tpl.id}
            type="button"
            className={`tpl-card ${templateId === tpl.id ? 'active' : ''}`}
            data-template={tpl.id}
            onClick={() => setTemplateId(tpl.id)}
            onDoubleClick={submit}
          >
            <SlideThumb slide={hero} quiz={quiz} className="tpl-thumb" />
            <div className="tpl-strip">
              {strip.map((slide) => <SlideThumb key={slide.id} slide={slide} quiz={quiz} lazy />)}
            </div>
            <div className="tpl-card-body">
              <div className="row">
                <span className="tpl-dot" style={{ background: tpl.preview.accent }} />
                <strong className="grow truncate">{t(`templates.names.${tpl.id}`)}</strong>
                {currentTemplateId === tpl.id && mode === 'apply' && <span className="chip">{t('templates.current')}</span>}
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
