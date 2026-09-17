import React from 'react'
import { useI18n } from '../../i18n/index.js'
import { useEditor, currentSlide, duplicateElements, deleteElements, toggleLock } from '../../state/editorStore.js'
import Icon from '../../components/Icon.jsx'
import { IconButton } from '../../components/Button.jsx'
import { CommonPanel, SlidePanel, TextPanel, ImagePanel, ShapePanel, AnswerPanel, WidgetPanel } from './panels.jsx'

const KIND_ICON = { text: 'type', image: 'image', shape: 'shapes', answer: 'listChecks', widget: 'zap' }
const SLIDE_ICON = { opening: 'flag', question: 'help', statistics: 'barChart', leaderboard: 'trophy', transition: 'slide', summary: 'star' }

/**
 * The right-hand panel. Nothing selected → the slide (for a question: the question form).
 * An element selected → only that element's content controls; look and geometry are folded away.
 */
export default function Inspector() {
  const { t } = useI18n()
  const quiz = useEditor((s) => s.quiz)
  const slide = useEditor(currentSlide)
  const selectedIds = useEditor((s) => s.selectedIds)
  if (!slide) return <aside className="inspector" />

  const elements = selectedIds.map((id) => slide.elements.find((e) => e.id === id)).filter(Boolean)
  const one = elements.length === 1 ? elements[0] : null
  const ids = elements.map((e) => e.id)
  const anyLocked = elements.some((e) => e.locked)

  let header
  if (!elements.length) {
    const n = quiz.slides.indexOf(slide) + 1
    header = { icon: SLIDE_ICON[slide.type], label: `${t('editor.slideN', { n })} · ${t(`slideTypes.${slide.type}`)}` }
  } else if (one) {
    let label = t(`inspector.${one.kind}`) || one.kind
    if (one.kind === 'text') label = one.binding === 'question' ? t('editor.questionText') : one.binding === 'quiz-title' ? t('settings.name') : t('editor.freeText')
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
        {elements.length > 0 && (
          <span className="inspector-actions">
            <IconButton icon="copy" size="sm" label={`${t('common.duplicate')} (Ctrl+D)`} onClick={() => duplicateElements(ids)} />
            <IconButton icon={anyLocked ? 'lock' : 'unlock'} size="sm" label={anyLocked ? t('editor.unlock') : t('editor.lock')} active={anyLocked} onClick={() => toggleLock(ids)} />
            <IconButton icon="trash" size="sm" label={`${t('common.delete')} (Del)`} danger onClick={() => deleteElements(ids)} />
          </span>
        )}
      </div>
      <div className="inspector-body" key={one ? one.id : elements.length ? 'multi' : slide.id}>
        {!elements.length && <SlidePanel slide={slide} quiz={quiz} />}
        {one && one.kind === 'text' && <TextPanel el={one} slide={slide} />}
        {one && one.kind === 'image' && <ImagePanel el={one} slide={slide} />}
        {one && one.kind === 'shape' && <ShapePanel el={one} />}
        {one && one.kind === 'answer' && slide.question && <AnswerPanel el={one} slide={slide} />}
        {one && one.kind === 'widget' && <WidgetPanel el={one} />}
        {elements.length > 0 && <CommonPanel elements={elements} />}
      </div>
    </aside>
  )
}
