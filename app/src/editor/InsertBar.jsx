import React from 'react'
import { useI18n } from '../i18n/index.js'
import { SHAPES, WIDGET_TYPES, ANSWER_INDICES, ANSWERS } from '../model/constants.js'
import { useEditor, currentSlide, insertText, insertShape, insertWidget, insertAnswerElement, select } from '../state/editorStore.js'
import Icon from '../components/Icon.jsx'
import Menu, { useMenu } from '../components/Menu.jsx'
import { useImageUpload } from './image/useImageUpload.js'
import { AnswerGlyph } from './render/elements/AnswerView.jsx'

const WIDGET_ICON = {
  'game-pin': 'hash', 'qr-code': 'qr', 'participants-count': 'users', 'participants-list': 'grid',
  timer: 'timer', respondents: 'user', 'answers-chart': 'barChart', leaderboard: 'trophy', 'question-number': 'numberSign',
}

function BarButton({ icon, label, onClick, active }) {
  return (
    <button type="button" className={`ibtn ${active ? 'active' : ''}`} onClick={onClick} aria-label={label} data-tip={label} data-tip-pos="end">
      <Icon name={icon} />
      <span>{label}</span>
    </button>
  )
}

export default function InsertBar() {
  const { t } = useI18n()
  const slide = useEditor(currentSlide)
  const shapeMenu = useMenu()
  const widgetMenu = useMenu()
  const imageMenu = useMenu()
  const answerMenu = useMenu()
  const { pickFiles, addImagesFromUrl } = useImageUpload()

  const presentAnswers = new Set(slide?.elements.filter((e) => e.kind === 'answer').map((e) => e.index))

  return (
    <div className="insert-bar" role="toolbar" aria-label="insert">
      <BarButton icon="type" label={t('editor.insertText')} onClick={() => insertText()} />
      <BarButton icon="image" label={t('editor.insertImage')} onClick={(e) => imageMenu.open(e)} />
      <BarButton icon="shapes" label={t('editor.insertShape')} onClick={(e) => shapeMenu.open(e)} />
      <BarButton icon="zap" label={t('editor.insertWidget')} onClick={(e) => widgetMenu.open(e)} />
      {slide?.type === 'question' && <BarButton icon="listChecks" label={t('editor.insertAnswer')} onClick={(e) => answerMenu.open(e)} />}
      <div className="divider" />
      <BarButton icon="paint" label={t('editor.background')} onClick={() => select([])} />

      {imageMenu.menu && (
        <Menu anchor={imageMenu.menu.anchor} onClose={imageMenu.close} items={[
          { label: t('editor.uploadImage'), icon: 'upload', onClick: () => pickFiles({ multiple: true }) },
          { label: t('editor.imageFromUrl'), icon: 'link', onClick: () => { const url = window.prompt(t('editor.imageUrlPrompt')); if (url) addImagesFromUrl(url.trim()) } },
        ]} />
      )}
      {shapeMenu.menu && (
        <Menu anchor={shapeMenu.menu.anchor} onClose={shapeMenu.close} items={[
          { title: t('editor.insertShape') },
          ...SHAPES.map((shape) => ({ label: t(`inspector.shapes.${shape}`), icon: shape === 'rect' ? 'square' : shape === 'ellipse' ? 'circle' : shape === 'arrow' ? 'arrowRight' : shape, onClick: () => insertShape(shape) })),
        ]} />
      )}
      {widgetMenu.menu && (
        <Menu anchor={widgetMenu.menu.anchor} onClose={widgetMenu.close} minWidth={260} items={[
          { title: t('editor.insertWidget') },
          ...WIDGET_TYPES.map((w) => ({ label: t(`inspector.widgets.${w}`), icon: WIDGET_ICON[w], onClick: () => insertWidget(w), badge: undefined })),
        ]} />
      )}
      {answerMenu.menu && (
        <Menu anchor={answerMenu.menu.anchor} onClose={answerMenu.close} items={[
          { title: t('editor.insertAnswer') },
          ...ANSWER_INDICES.map((i) => ({
            key: i,
            label: (
              <span className="row gap-6"><span style={{ width: 18, height: 18, borderRadius: 5, background: ANSWERS[i].color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><AnswerGlyph index={i} color="#fff" size={11} /></span>{t('editor.answerN', { n: i })}</span>
            ),
            disabled: presentAnswers.has(i),
            onClick: () => insertAnswerElement(i),
          })),
        ]} />
      )}
    </div>
  )
}
