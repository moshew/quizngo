import React from 'react'
import { useI18n } from '../../i18n/index.js'
import { useEditor, currentSlide } from '../../state/editorStore.js'
import Icon from '../../components/Icon.jsx'
import { CommonPanel, SlidePanel, TextPanel, ImagePanel, ShapePanel, AnswerPanel, WidgetPanel } from './panels.jsx'

const KIND_ICON = { text: 'type', image: 'image', shape: 'shapes', answer: 'listChecks', widget: 'zap' }

export default function Inspector() {
  const { t } = useI18n()
  const quiz = useEditor((s) => s.quiz)
  const slide = useEditor(currentSlide)
  const selectedIds = useEditor((s) => s.selectedIds)
  if (!slide) return <aside className="inspector" />

  const elements = selectedIds.map((id) => slide.elements.find((e) => e.id === id)).filter(Boolean)
  const one = elements.length === 1 ? elements[0] : null

  let header
  if (!elements.length) header = { icon: 'slide', label: `${t('inspector.slide')} · ${t(`slideTypes.${slide.type}`)}` }
  else if (one) {
    let label = t(`inspector.${one.kind}`) || one.kind
    if (one.kind === 'text') label = one.binding === 'question' ? t('editor.questionText') : t('editor.freeText')
    if (one.kind === 'image') label = one.binding === 'question-media' ? t('editor.questionMedia') : t('inspector.image')
    if (one.kind === 'answer') label = t('editor.answerN', { n: one.index })
    if (one.kind === 'widget') label = t(`inspector.widgets.${one.widget}`)
    header = { icon: KIND_ICON[one.kind], label }
  } else header = { icon: 'layers', label: t('editor.selected', { count: elements.length }) }

  return (
    <aside className="inspector">
      <div className="inspector-header">
        <span className="kind"><Icon name={header.icon} size={16} /></span>
        <span className="truncate grow">{header.label}</span>
        {one?.locked && <Icon name="lock" size={14} className="dim" />}
      </div>
      <div className="inspector-body">
        {!elements.length && <SlidePanel slide={slide} quiz={quiz} />}
        {one && one.kind === 'text' && <TextPanel el={one} />}
        {one && one.kind === 'image' && <ImagePanel el={one} slide={slide} />}
        {one && one.kind === 'shape' && <ShapePanel el={one} />}
        {one && one.kind === 'answer' && slide.question && <AnswerPanel el={one} slide={slide} />}
        {one && one.kind === 'widget' && <WidgetPanel el={one} />}
        {elements.length > 0 && <CommonPanel elements={elements} />}
      </div>
    </aside>
  )
}
