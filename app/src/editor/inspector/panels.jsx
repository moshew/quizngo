import React from 'react'
import { useI18n } from '../../i18n/index.js'
import { ANSWERS, ANSWER_INDICES, FRAMES, SHAPES, SLIDE_TYPES, LIMITS } from '../../model/constants.js'
import { assetUrl } from '../../api/client.js'
import {
  updateElement, updateElementStyle, updateWidgetProps, reorderElements, alignElements,
  updateSlide, setBackground, setSlideType, setSlideHidden, updateQuestion, setCorrectAnswer, setAnswer, setCropping,
  resetElementStyle, resetBackground, setQuestionMediaSrc, updateSettings,
} from '../../state/editorStore.js'
import { NumberField, Segmented, Slider } from '../../components/Field.jsx'
import Button, { IconButton } from '../../components/Button.jsx'
import ColorInput from '../../components/ColorInput.jsx'
import Icon from '../../components/Icon.jsx'
import { AnswerGlyph } from '../render/elements/AnswerView.jsx'
import { frameClipPathFor } from '../render/frames.js'
import { shapePath } from '../render/shapes.js'
import { Section, Row, ToggleRow, usePalette, FontSelect, ShadowSelect, BorderControl } from './controls.jsx'
import { pickFiles, pickForElement, setAnswerImage, setBackgroundImage } from '../image/useImageUpload.js'
import QuestionForm from './QuestionForm.jsx'

const K = (id) => `insp:${id}`

// ───────────────────────── Common (geometry, layer, visibility) ─────────────────────────

export function CommonPanel({ elements }) {
  const { t } = useI18n()
  const one = elements.length === 1 ? elements[0] : null
  const ids = elements.map((e) => e.id)
  const opacity = one ? one.opacity : elements[0].opacity
  return (
    <Section title={t('inspector.arrange')} icon="move" foldId="arrange" defaultOpen={elements.length > 1}>
      {one && (
        <>
          <div className="prop-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <NumberField prefix="X" value={one.x} onChange={(v) => updateElement(one.id, { x: v }, K(one.id))} disabled={one.locked} />
            <NumberField prefix="Y" value={one.y} onChange={(v) => updateElement(one.id, { y: v }, K(one.id))} disabled={one.locked} />
            <NumberField prefix="W" value={one.w} min={8} onChange={(v) => updateElement(one.id, { w: v }, K(one.id))} disabled={one.locked} />
            <NumberField prefix="H" value={one.h} min={8} onChange={(v) => updateElement(one.id, { h: v }, K(one.id))} disabled={one.locked} />
          </div>
          <div className="prop-row" style={{ marginTop: 8 }}>
            <label>{t('inspector.rotation')}</label>
            <div className="grow">
              <NumberField prefix="°" value={one.rotation} min={-180} max={180} onChange={(v) => updateElement(one.id, { rotation: v }, K(one.id))} disabled={one.locked} />
              <IconButton icon="reset" size="sm" label="0°" onClick={() => updateElement(one.id, { rotation: 0 })} />
            </div>
          </div>
        </>
      )}
      <Row label={t('inspector.opacity')}>
        <Slider min={0} max={100} value={Math.round(opacity * 100)} onChange={(v) => ids.forEach((id) => updateElement(id, { opacity: v / 100 }, K(id)))} />
        <span className="xs dim mono" style={{ width: 36, textAlign: 'end' }}>{Math.round(opacity * 100)}%</span>
      </Row>
      <Row label={t('inspector.layer')}>
        <IconButton icon="bringFront" size="sm" label={t('editor.layerFront')} onClick={() => reorderElements(ids, 'front')} />
        <IconButton icon="bringForward" size="sm" label={t('editor.layerForward')} onClick={() => reorderElements(ids, 'forward')} />
        <IconButton icon="sendBackward" size="sm" label={t('editor.layerBackward')} onClick={() => reorderElements(ids, 'backward')} />
        <IconButton icon="sendBack" size="sm" label={t('editor.layerBack')} onClick={() => reorderElements(ids, 'back')} />
      </Row>
      <Row label={t('inspector.alignToSlide')}>
        <IconButton icon="alignCenterH" size="sm" label={t('editor.alignCenterH')} onClick={() => alignElements(ids, 'centerH')} />
        <IconButton icon="alignCenterV" size="sm" label={t('editor.alignCenterV')} onClick={() => alignElements(ids, 'centerV')} />
      </Row>
    </Section>
  )
}

// ───────────────────────── Slide ─────────────────────────

function GradientEditor({ bg, onChange }) {
  const { t } = useI18n()
  const palette = usePalette()
  const g = bg.gradient || { angle: 160, stops: [{ color: '#6B2BFF', at: 0 }, { color: '#FF2E93', at: 100 }] }
  const css = `linear-gradient(${g.angle}deg, ${g.stops.map((s) => `${s.color} ${s.at}%`).join(', ')})`
  const set = (patch) => onChange({ kind: 'gradient', gradient: { ...g, ...patch } })
  return (
    <>
      <div className="prop-row"><div className="gradient-preview" style={{ background: css }} /></div>
      <Row label={t('inspector.angle')}>
        <Slider min={0} max={360} value={g.angle} onChange={(v) => set({ angle: v })} />
        <span className="xs dim mono" style={{ width: 34 }}>{g.angle}°</span>
      </Row>
      <div className="stops">
        {g.stops.map((s, i) => (
          <div key={i} className="stop-row">
            <ColorInput size="sm" value={s.color} allowNull={false} palette={palette} onChange={(c) => set({ stops: g.stops.map((x, j) => (j === i ? { ...x, color: c } : x)) })} />
            <Slider min={0} max={100} value={s.at} onChange={(v) => set({ stops: g.stops.map((x, j) => (j === i ? { ...x, at: v } : x)) })} />
            <span className="xs dim mono" style={{ width: 34 }}>{s.at}%</span>
            <IconButton icon="x" size="sm" label={t('common.remove')} disabled={g.stops.length <= 2} onClick={() => set({ stops: g.stops.filter((_, j) => j !== i) })} />
          </div>
        ))}
        {g.stops.length < 5 && <Button size="sm" variant="ghost" icon="plus" onClick={() => set({ stops: [...g.stops, { color: '#FFD400', at: 50 }].sort((a, b) => a.at - b.at) })}>{t('common.add')}</Button>}
      </div>
    </>
  )
}

const SLIDE_ICON = { opening: 'flag', question: 'help', statistics: 'barChart', leaderboard: 'trophy', transition: 'slide', summary: 'star' }

export function SlidePanel({ slide, quiz }) {
  const { t } = useI18n()
  const palette = usePalette()
  const bg = slide.background
  const kind = bg?.kind || 'color'
  const decor = bg?.decor !== false
  const switchKind = (k) => {
    if (k === kind) return
    if (k === 'color') setBackground(slide.id, { kind: 'color', color: bg.color || bg.gradient?.stops?.[0]?.color || '#1a0a2e', decor }, null)
    if (k === 'gradient') setBackground(slide.id, { kind: 'gradient', gradient: bg.gradient || { angle: 160, stops: [{ color: bg.color || '#6B2BFF', at: 0 }, { color: '#FF2E93', at: 100 }] }, decor }, null)
    if (k === 'image') setBackground(slide.id, { kind: 'image', src: bg.src || '', overlay: 'rgba(0,0,0,0.35)', fit: 'cover', color: bg.color || '#1a0a2e', decor: false }, null)
  }
  const leaderboard = slide.type === 'leaderboard' ? slide.elements.find((el) => el.kind === 'widget' && el.widget === 'leaderboard') : null

  return (
    <>
      {slide.type === 'question' ? <QuestionForm slide={slide} quiz={quiz} /> : (
        <Section>
          <div className="slide-about">
            <span className={`badge-type type-${slide.type}`}><Icon name={SLIDE_ICON[slide.type]} size={13} /></span>
            <p>{t(`slideTypes.descriptions.${slide.type}`)}</p>
          </div>
          {leaderboard && (
            <Row label={t('inspector.count')}>
              <NumberField value={quiz.settings.leaderboardSize} min={LIMITS.leaderboardSize[0]} max={LIMITS.leaderboardSize[1]} onChange={(v) => updateSettings({ leaderboardSize: v })} prefix="#" />
            </Row>
          )}
          <p className="xs dim" style={{ marginTop: 8 }}>{t('editor.slideHint')}</p>
        </Section>
      )}

      <Section title={t('inspector.background')} icon="paint" foldId="background">
        <Segmented block value={kind} onChange={switchKind} options={[{ value: 'color', label: t('inspector.solid') }, { value: 'gradient', label: t('inspector.gradient') }, { value: 'image', label: t('inspector.image') }]} />
        <div style={{ height: 10 }} />
        {kind === 'color' && (
          <Row label={t('inspector.color')}>
            <ColorInput value={bg.color} allowNull={false} palette={palette} onChange={(c) => setBackground(slide.id, { ...bg, kind: 'color', color: c })} />
            <div className="row gap-4 wrap grow">
              {palette.slice(0, 8).map((c) => <button key={c} type="button" className="swatch sm" style={{ background: c }} onClick={() => setBackground(slide.id, { ...bg, kind: 'color', color: c }, null)} aria-label={c} />)}
            </div>
          </Row>
        )}
        {kind === 'gradient' && <GradientEditor bg={bg} onChange={(next) => setBackground(slide.id, { ...next, decor })} />}
        {kind === 'image' && (
          <>
            <div className="image-picker" style={{ marginBottom: 8 }}>
              {bg.src ? <img className="preview" src={assetUrl(bg.src)} alt="" /> : <div className="preview center dim"><Icon name="image" /></div>}
              <Button size="sm" icon="upload" onClick={() => pickFiles({ onFiles: (f) => setBackgroundImage(slide.id, f[0]) })}>{t('editor.uploadImage')}</Button>
            </div>
            <Row label={t('inspector.overlay')}>
              <ColorInput value={bg.overlay} palette={palette} onChange={(c) => setBackground(slide.id, { ...bg, overlay: c })} />
              <Segmented size="sm" value={bg.fit || 'cover'} onChange={(v) => setBackground(slide.id, { ...bg, fit: v }, null)} options={[{ value: 'cover', label: 'Cover' }, { value: 'contain', label: 'Fit' }]} />
            </Row>
          </>
        )}
        <ToggleRow label={t('inspector.decor')} checked={decor} onChange={(v) => setBackground(slide.id, { ...bg, decor: v }, null)} />
        <Button size="sm" variant="ghost" icon="reset" onClick={() => resetBackground(slide.id)}>{t('inspector.resetBackground')}</Button>
      </Section>

      <Section title={t('inspector.slideOptions')} icon="settings" foldId="slide-options">
        <Row label={t('inspector.slideType')}>
          <select className="select sm" value={slide.type} onChange={(e) => setSlideType(slide.id, e.target.value)}>
            {SLIDE_TYPES.map((type) => <option key={type} value={type}>{t(`slideTypes.${type}`)}</option>)}
          </select>
        </Row>
        <ToggleRow label={t('editor.hideSlide')} checked={slide.hidden} onChange={(v) => setSlideHidden(slide.id, v)} />
        <div className="prop-label" style={{ margin: '10px 0 6px' }}>{t('editor.notes')}</div>
        <textarea className="textarea" rows={3} value={slide.notes || ''} onChange={(e) => updateSlide(slide.id, { notes: e.target.value }, `notes:${slide.id}`)} />
      </Section>
    </>
  )
}

// ───────────────────────── Text ─────────────────────────

export function TextPanel({ el, slide }) {
  const { t } = useI18n()
  const palette = usePalette()
  const s = el.style
  const set = (patch, key = K(el.id)) => updateElementStyle(el.id, patch, key)
  return (
    <>
      <Section>
        {el.binding === 'question' && slide?.question ? (
          <textarea className="textarea q-text" rows={3} dir="auto" placeholder={t('questions.questionPlaceholder')} value={slide.question.text} onChange={(e) => updateQuestion(slide.id, { text: e.target.value })} />
        ) : (
          <p className="small muted">{el.binding === 'quiz-title' ? t('editor.titleHint') : t('editor.textHint')}</p>
        )}
      </Section>
      <Section title={t('inspector.textStyle')} icon="type" foldId="text-style">
        <Row label={t('inspector.font')}><FontSelect value={s.fontFamily} onChange={(v) => set({ fontFamily: v }, null)} /></Row>
        <Row label={t('inspector.fontSize')}>
          <NumberField value={s.fontSize} min={8} max={400} onChange={(v) => set({ fontSize: v })} />
          <IconButton icon="bold" size="sm" label="Bold" active={s.bold} onClick={() => set({ bold: !s.bold }, null)} />
          <ColorInput size="sm" value={s.color} allowNull={false} palette={palette} onChange={(c) => set({ color: c })} label={t('inspector.color')} />
        </Row>
        <Row label={t('inspector.align')}>
          <Segmented size="sm" value={s.align} onChange={(v) => set({ align: v }, null)} options={[{ value: 'start', icon: 'alignLeft' }, { value: 'center', icon: 'alignCenter' }, { value: 'end', icon: 'alignRight' }, { value: 'justify', icon: 'alignJustify' }]} />
        </Row>
        <Row label={t('inspector.valign')}>
          <Segmented size="sm" value={s.valign} onChange={(v) => set({ valign: v }, null)} options={[{ value: 'top', icon: 'alignTop' }, { value: 'middle', icon: 'alignMiddle' }, { value: 'bottom', icon: 'alignBottom' }]} />
        </Row>
        <Row label={t('inspector.direction')}>
          <Segmented size="sm" value={s.direction} onChange={(v) => set({ direction: v }, null)} options={[{ value: 'auto', label: t('inspector.auto') }, { value: 'rtl', icon: 'rtl' }, { value: 'ltr', icon: 'ltr' }]} />
        </Row>
        <Row label={t('inspector.lineHeight')}><NumberField value={s.lineHeight} min={0.6} max={3} step={0.1} precision={2} onChange={(v) => set({ lineHeight: v })} /></Row>
        <Row label={t('inspector.letterSpacing')}><NumberField value={s.letterSpacing} min={-10} max={60} onChange={(v) => set({ letterSpacing: v })} /></Row>
        <Row label={t('inspector.textShadow')}>
          <select className="select sm" value={s.textShadow ? 'on' : 'off'} onChange={(e) => set({ textShadow: e.target.value === 'on' ? '0 4px 0 rgba(0,0,0,0.25)' : null }, null)}>
            <option value="off">{t('common.none')}</option>
            <option value="on">Hard</option>
          </select>
        </Row>
        {!el.binding && <ToggleRow label={t('inspector.autoFit')} checked={s.autoFit} onChange={(v) => set({ autoFit: v }, null)} />}
        <div className="prop-subtitle">{t('inspector.box')}</div>
        <Row label={t('inspector.fill')}><ColorInput value={s.background} palette={palette} onChange={(c) => set({ background: c })} /></Row>
        <Row label={t('inspector.border')}><BorderControl value={s.border} onChange={(b) => set({ border: b })} /></Row>
        <Row label={t('inspector.radius')}><NumberField value={s.borderRadius} min={0} max={400} onChange={(v) => set({ borderRadius: v })} /></Row>
        <Row label={t('inspector.padding')}><NumberField value={s.padding} min={0} max={200} onChange={(v) => set({ padding: v })} /></Row>
        <Row label={t('inspector.shadow')}><ShadowSelect value={s.shadow} onChange={(v) => set({ shadow: v }, null)} /></Row>
      </Section>
    </>
  )
}

// ───────────────────────── Image ─────────────────────────

function FrameTile({ frame, active, onClick }) {
  return (
    <button type="button" className={`tile ${active ? 'active' : ''}`} onClick={onClick} aria-label={frame}>
      {frame === 'none' ? <Icon name="x" /> : <span className="fr" style={{ clipPath: frameClipPathFor(frame, 24, 24, 6), width: 24, height: 24 }} />}
    </button>
  )
}

export function ImagePanel({ el, slide }) {
  const { t } = useI18n()
  const set = (patch, key = K(el.id)) => updateElement(el.id, patch, key)
  const f = el.filters
  const bound = el.binding === 'question-media'
  const hasSrc = bound ? !!slide.question?.media?.src : !!el.src
  return (
    <>
      <Section>
        <div className="row gap-6 wrap">
          <Button size="sm" variant={hasSrc ? 'secondary' : 'primary'} icon="upload" onClick={() => pickForElement(el.id)}>{hasSrc ? t('editor.replaceImage') : t('editor.uploadImage')}</Button>
          <Button size="sm" icon="crop" disabled={!hasSrc} onClick={() => setCropping(el.id)}>{t('editor.crop')}</Button>
          {bound && hasSrc && <IconButton icon="trash" size="sm" label={t('common.remove')} onClick={() => setQuestionMediaSrc(slide.id, null)} />}
        </div>
        {bound && <p className="xs dim" style={{ marginTop: 8 }}>{t('editor.questionMediaHint')}</p>}
      </Section>
      <Section title={t('inspector.imageStyle')} icon="image" foldId="image-style">
        <div className="tiles">
          {FRAMES.map((frame) => <FrameTile key={frame} frame={frame} active={el.frame === frame} onClick={() => set({ frame }, null)} />)}
        </div>
        <div style={{ height: 8 }} />
        {el.frame === 'rounded' && <Row label={t('inspector.radius')}><NumberField value={el.borderRadius} min={0} max={500} onChange={(v) => set({ borderRadius: v })} /></Row>}
        <Row label={t('inspector.border')}><BorderControl value={el.border} onChange={(b) => set({ border: b && b.width > 0 ? b : null })} /></Row>
        <Row label={t('inspector.shadow')}><ShadowSelect value={el.shadow} onChange={(v) => set({ shadow: v }, null)} /></Row>
        <Row label={t('inspector.flip')}>
          <IconButton icon="flipH" size="sm" label={t('editor.flipH')} active={el.flipH} onClick={() => set({ flipH: !el.flipH }, null)} />
          <IconButton icon="flipV" size="sm" label={t('editor.flipV')} active={el.flipV} onClick={() => set({ flipV: !el.flipV }, null)} />
        </Row>
        <div className="prop-subtitle">{t('inspector.filters')}<span className="spacer" /><IconButton icon="reset" size="sm" label={t('inspector.resetFilters')} onClick={() => set({ filters: { brightness: 100, contrast: 100, saturate: 100, blur: 0, grayscale: 0, sepia: 0 } }, null)} /></div>
        {[['brightness', 0, 200], ['contrast', 0, 200], ['saturate', 0, 200], ['blur', 0, 40], ['grayscale', 0, 100], ['sepia', 0, 100]].map(([key, min, max]) => (
          <Row key={key} label={t(`inspector.${key}`)}>
            <Slider min={min} max={max} value={f[key]} onChange={(v) => set({ filters: { ...f, [key]: v } })} />
            <span className="xs dim mono" style={{ width: 30, textAlign: 'end' }}>{f[key]}</span>
          </Row>
        ))}
      </Section>
    </>
  )
}

// ───────────────────────── Shape ─────────────────────────

export function ShapePanel({ el }) {
  const { t } = useI18n()
  const palette = usePalette()
  const set = (patch, key = K(el.id)) => updateElement(el.id, patch, key)
  return (
    <>
      <Section>
        <div className="tiles" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
          {SHAPES.map((shape) => (
            <button key={shape} type="button" className={`tile ${el.shape === shape ? 'active' : ''}`} onClick={() => set({ shape }, null)} aria-label={t(`inspector.shapes.${shape}`)} data-tip={t(`inspector.shapes.${shape}`)}>
              <svg viewBox="0 0 24 24" width="60%" height="60%"><path d={shapePath(shape, 24, 24, 4)} fill={shape === 'line' ? 'none' : 'currentColor'} stroke="currentColor" strokeWidth={shape === 'line' ? 3 : 0} /></svg>
            </button>
          ))}
        </div>
        <div style={{ height: 10 }} />
        <Row label={t('inspector.fill')}><ColorInput value={el.fill} palette={palette} onChange={(c) => set({ fill: c })} /></Row>
      </Section>
      <Section title={t('inspector.shapeStyle')} icon="shapes" foldId="shape-style">
        <Row label={t('inspector.stroke')}>
          <NumberField prefix="W" value={el.stroke.width} min={0} max={60} onChange={(v) => set({ stroke: { ...el.stroke, width: v } })} />
          <ColorInput size="sm" value={el.stroke.color} allowNull={false} palette={palette} onChange={(c) => set({ stroke: { ...el.stroke, color: c } })} />
          <IconButton icon="more" size="sm" label={t('inspector.dash')} active={el.stroke.dash} onClick={() => set({ stroke: { ...el.stroke, dash: !el.stroke.dash } }, null)} />
        </Row>
        {(el.shape === 'rect' || el.shape === 'speech') && <Row label={t('inspector.radius')}><NumberField value={el.borderRadius} min={0} max={500} onChange={(v) => set({ borderRadius: v })} /></Row>}
        <Row label={t('inspector.shadow')}><ShadowSelect value={el.shadow} onChange={(v) => set({ shadow: v }, null)} /></Row>
      </Section>
    </>
  )
}

// ───────────────────────── Answer ─────────────────────────

/** "As the template says" — shown wherever a look can be overridden. */
function ResetStyle({ el }) {
  const { t } = useI18n()
  const custom = ['background', 'color', 'fontFamily', 'borderRadius', 'border', 'shadow', 'accent'].some((k) => el.style?.[k] !== null && el.style?.[k] !== undefined) || (el.kind === 'answer' && el.style.variant !== 'card')
  return <Button size="sm" variant="ghost" icon="reset" disabled={!custom} onClick={() => resetElementStyle([el.id])}>{t('inspector.resetStyle')}</Button>
}

export function AnswerPanel({ el, slide }) {
  const { t } = useI18n()
  const palette = usePalette()
  const s = el.style
  const set = (patch, key = K(el.id)) => updateElementStyle(el.id, patch, key)
  const answer = slide.question.answers[el.index - 1]
  const isCorrect = slide.question.correctAnswer === el.index
  return (
    <>
      <Section>
        <input className="input" dir="auto" value={answer.text} placeholder={t('questions.answerPlaceholder', { n: el.index })} onChange={(e) => setAnswer(slide.id, el.index, { text: e.target.value })} />
        <div className="row gap-6 wrap" style={{ marginTop: 10 }}>
          <Button size="sm" variant={isCorrect ? 'primary' : 'secondary'} icon="check" onClick={() => setCorrectAnswer(slide.id, el.index)}>{isCorrect ? t('editor.correctAnswer') : t('editor.markCorrect')}</Button>
          <Button size="sm" icon="image" onClick={() => pickFiles({ onFiles: (f) => setAnswerImage(slide.id, el.index, f[0]) })}>{answer.image?.src ? t('editor.replaceImage') : t('questions.media')}</Button>
          {answer.image?.src && <IconButton icon="trash" size="sm" label={t('common.remove')} onClick={() => setAnswer(slide.id, el.index, { image: null }, null)} />}
        </div>
        {answer.image?.src && (
          <Row label={t('inspector.imagePosition')}>
            <Segmented size="sm" value={s.imagePosition} onChange={(v) => set({ imagePosition: v }, null)} options={[{ value: 'start', label: t('inspector.start') }, { value: 'top', label: t('inspector.top') }, { value: 'cover', label: t('inspector.cover') }]} />
          </Row>
        )}
      </Section>
      <Section title={t('inspector.design')} icon="palette" foldId="answer-style">
        <Segmented block value={s.variant} onChange={(v) => set({ variant: v }, null)} options={[{ value: 'card', label: t('inspector.card') }, { value: 'pill', label: t('inspector.pill') }, { value: 'flat', label: t('inspector.flat') }]} />
        <div style={{ height: 8 }} />
        <ToggleRow label={t('inspector.showShape')} checked={s.showShape} onChange={(v) => set({ showShape: v }, null)} />
        <ToggleRow label={t('inspector.showIndex')} checked={s.showIndex} onChange={(v) => set({ showIndex: v }, null)} />
        <Row label={t('inspector.fill')}><ColorInput value={s.background} palette={palette} onChange={(c) => set({ background: c })} /></Row>
        <Row label={t('inspector.color')}><ColorInput value={s.color} palette={palette} onChange={(c) => set({ color: c })} /></Row>
        <Row label={t('inspector.font')}><FontSelect value={s.fontFamily} allowTemplate onChange={(v) => set({ fontFamily: v }, null)} /></Row>
        <Row label={t('inspector.fontSize')}>
          <NumberField value={s.fontSize} min={8} max={200} onChange={(v) => set({ fontSize: v })} />
          <IconButton icon="bold" size="sm" label="Bold" active={s.bold} onClick={() => set({ bold: !s.bold }, null)} />
        </Row>
        <Row label={t('inspector.radius')}><NumberField value={s.borderRadius} min={0} max={999} onChange={(v) => set({ borderRadius: v })} /></Row>
        <Row label={t('inspector.border')}><BorderControl allowTemplate value={s.border} onChange={(b) => set({ border: b })} /></Row>
        <Row label={t('inspector.shadow')}><ShadowSelect allowTemplate value={s.shadow} onChange={(v) => set({ shadow: v }, null)} /></Row>
        <ResetStyle el={el} />
      </Section>
    </>
  )
}

// ───────────────────────── Widget ─────────────────────────

export function WidgetPanel({ el }) {
  const { t } = useI18n()
  const palette = usePalette()
  const p = el.props
  const s = el.style
  const setP = (patch, key = K(el.id)) => updateWidgetProps(el.id, patch, key)
  const setS = (patch, key = K(el.id)) => updateElementStyle(el.id, patch, key)
  const w = el.widget
  const hasLabel = ['game-pin', 'qr-code', 'participants-count', 'timer', 'respondents', 'question-number'].includes(w)
  return (
    <>
      <Section>
        <p className="small muted" style={{ marginBottom: 10 }}>{t(`inspector.widgetHints.${w}`)}</p>
        {hasLabel && (
          <Row label={t('inspector.label')}>
            <input className="input sm" value={p.label || ''} onChange={(e) => setP({ label: e.target.value })} />
            {p.showLabel !== undefined && <IconButton icon={p.showLabel ? 'eye' : 'eyeOff'} size="sm" label={t('inspector.showLabel')} active={p.showLabel} onClick={() => setP({ showLabel: !p.showLabel }, null)} />}
          </Row>
        )}
        {(w === 'timer' || w === 'respondents') && (
          <Row label={t('inspector.variant')}>
            <Segmented size="sm" value={p.variant} onChange={(v) => setP({ variant: v }, null)} options={[...(w === 'respondents' ? [{ value: 'box', label: t('inspector.card') }] : []), { value: 'circle', label: t('inspector.circle') }, { value: 'pill', label: t('inspector.pill') }, { value: 'number', label: t('inspector.number') }]} />
          </Row>
        )}
        {w === 'respondents' && <ToggleRow label="18 / 24" checked={p.showTotal} onChange={(v) => setP({ showTotal: v }, null)} />}
        {w === 'participants-list' && (
          <>
            <Row label={t('inspector.headerText')}><input className="input sm" value={p.headerText || ''} onChange={(e) => setP({ headerText: e.target.value })} /></Row>
            <ToggleRow label={t('inspector.showCount')} checked={p.showCount} onChange={(v) => setP({ showCount: v }, null)} />
            <Row label={t('inspector.columns')}>
              <NumberField value={p.columns} min={1} max={6} onChange={(v) => setP({ columns: v })} prefix="C" />
              <NumberField value={p.maxRows} min={1} max={8} onChange={(v) => setP({ maxRows: v })} prefix="R" />
            </Row>
          </>
        )}
        {w === 'answers-chart' && (
          <>
            <ToggleRow label={t('inspector.showValues')} checked={p.showValues} onChange={(v) => setP({ showValues: v }, null)} />
            <ToggleRow label={t('inspector.showShapes')} checked={p.showShapes} onChange={(v) => setP({ showShapes: v }, null)} />
            <ToggleRow label={t('inspector.showLabels')} checked={p.showLabels !== false} onChange={(v) => setP({ showLabels: v }, null)} />
            <ToggleRow label={t('editor.questionText')} checked={p.showQuestion} onChange={(v) => setP({ showQuestion: v }, null)} />
          </>
        )}
        {w === 'leaderboard' && (
          <>
            <Row label={t('inspector.variant')}>
              <Segmented size="sm" value={p.variant} onChange={(v) => setP({ variant: v, count: v === 'podium' ? 3 : p.count }, null)} options={[{ value: 'list', icon: 'list' }, { value: 'podium', icon: 'trophy' }]} />
            </Row>
            <Row label={t('inspector.count')}><NumberField value={p.count} min={1} max={p.variant === 'podium' ? 3 : 10} onChange={(v) => setP({ count: v })} /></Row>
            <ToggleRow label={t('inspector.showAvatar')} checked={p.showAvatar} onChange={(v) => setP({ showAvatar: v }, null)} />
            <ToggleRow label={t('inspector.showScore')} checked={p.showScore} onChange={(v) => setP({ showScore: v }, null)} />
          </>
        )}
      </Section>
      <Section title={t('inspector.design')} icon="palette" foldId="widget-style">
        <p className="xs dim" style={{ marginBottom: 10 }}>{t('inspector.designHint')}</p>
        <Row label={t('inspector.font')}><FontSelect value={s.fontFamily} allowTemplate onChange={(v) => setS({ fontFamily: v }, null)} /></Row>
        <Row label={t('inspector.color')}><ColorInput value={s.color} palette={palette} onChange={(c) => setS({ color: c })} label={t('inspector.color')} /></Row>
        <Row label={t('inspector.accent')}><ColorInput value={s.accent} palette={palette} onChange={(c) => setS({ accent: c })} label={t('inspector.accent')} /></Row>
        <Row label={t('inspector.fill')}><ColorInput value={s.background} palette={palette} onChange={(c) => setS({ background: c })} /></Row>
        <Row label={t('inspector.border')}><BorderControl allowTemplate value={s.border} onChange={(b) => setS({ border: b })} /></Row>
        <Row label={t('inspector.radius')}><NumberField value={s.borderRadius} min={0} max={200} onChange={(v) => setS({ borderRadius: v })} /></Row>
        <Row label={t('inspector.shadow')}><ShadowSelect allowTemplate value={s.shadow} onChange={(v) => setS({ shadow: v }, null)} /></Row>
        <ResetStyle el={el} />
      </Section>
    </>
  )
}
