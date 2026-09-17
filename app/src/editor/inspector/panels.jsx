import React from 'react'
import { useI18n } from '../../i18n/index.js'
import { ANSWERS, ANSWER_INDICES, FRAMES, SHAPES, SLIDE_TYPES, LIMITS } from '../../model/constants.js'
import { assetUrl } from '../../api/client.js'
import {
  updateElement, updateElementStyle, updateWidgetProps, deleteElements, duplicateElements, reorderElements, alignElements, toggleLock,
  updateSlide, setBackground, setSlideType, setSlideHidden, updateQuestion, setCorrectAnswer, setAnswer, setCropping, useEditor,
} from '../../state/editorStore.js'
import { NumberField, Segmented, Slider } from '../../components/Field.jsx'
import Button, { IconButton } from '../../components/Button.jsx'
import ColorInput from '../../components/ColorInput.jsx'
import Icon from '../../components/Icon.jsx'
import { AnswerGlyph } from '../render/elements/AnswerView.jsx'
import { frameClipPathFor } from '../render/frames.js'
import { shapePath } from '../render/shapes.js'
import { Section, Row, ToggleRow, usePalette, FontSelect, ShadowSelect, BorderControl } from './controls.jsx'
import { pickFiles, pickForElement, setQuestionMedia, setAnswerImage, setBackgroundImage } from '../image/useImageUpload.js'

const K = (id) => `insp:${id}`

// ───────────────────────── Common (geometry, layer, visibility) ─────────────────────────

export function CommonPanel({ elements }) {
  const { t } = useI18n()
  const one = elements.length === 1 ? elements[0] : null
  const ids = elements.map((e) => e.id)
  const anyLocked = elements.some((e) => e.locked)
  const opacity = one ? one.opacity : elements[0].opacity
  return (
    <>
      {one && (
        <Section title={t('inspector.position')}>
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
        </Section>
      )}
      <Section title={t('inspector.opacity')}>
        <div className="row">
          <Slider min={0} max={100} value={Math.round(opacity * 100)} onChange={(v) => ids.forEach((id) => updateElement(id, { opacity: v / 100 }, K(id)))} />
          <span className="xs dim mono" style={{ width: 36, textAlign: 'end' }}>{Math.round(opacity * 100)}%</span>
        </div>
      </Section>
      <Section title={t('inspector.layer')}>
        <div className="row gap-4 wrap">
          <IconButton icon="bringFront" label={t('editor.layerFront')} onClick={() => reorderElements(ids, 'front')} />
          <IconButton icon="bringForward" label={t('editor.layerForward')} onClick={() => reorderElements(ids, 'forward')} />
          <IconButton icon="sendBackward" label={t('editor.layerBackward')} onClick={() => reorderElements(ids, 'backward')} />
          <IconButton icon="sendBack" label={t('editor.layerBack')} onClick={() => reorderElements(ids, 'back')} />
          <div className="vdivider" />
          <IconButton icon="alignCenterH" label={t('editor.alignCenterH')} onClick={() => alignElements(ids, 'centerH')} />
          <IconButton icon="alignCenterV" label={t('editor.alignCenterV')} onClick={() => alignElements(ids, 'centerV')} />
          <div className="vdivider" />
          <IconButton icon={anyLocked ? 'unlock' : 'lock'} label={anyLocked ? t('editor.unlock') : t('editor.lock')} active={anyLocked} onClick={() => toggleLock(ids)} />
          <IconButton icon="copy" label={t('common.duplicate')} onClick={() => duplicateElements(ids)} />
          <IconButton icon="trash" label={t('common.delete')} danger onClick={() => deleteElements(ids)} />
        </div>
      </Section>
    </>
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

export function SlidePanel({ slide, quiz }) {
  const { t } = useI18n()
  const palette = usePalette()
  const bg = slide.background
  const kind = bg?.kind || 'color'
  const switchKind = (k) => {
    if (k === kind) return
    if (k === 'color') setBackground(slide.id, { kind: 'color', color: bg.color || bg.gradient?.stops?.[0]?.color || '#1a0a2e' }, null)
    if (k === 'gradient') setBackground(slide.id, { kind: 'gradient', gradient: bg.gradient || { angle: 160, stops: [{ color: bg.color || '#6B2BFF', at: 0 }, { color: '#FF2E93', at: 100 }] } }, null)
    if (k === 'image') setBackground(slide.id, { kind: 'image', src: bg.src || '', overlay: 'rgba(0,0,0,0.35)', fit: 'cover', color: bg.color || '#1a0a2e' }, null)
  }
  return (
    <>
      <Section title={t('inspector.slideType')}>
        <select className="select sm" value={slide.type} onChange={(e) => setSlideType(slide.id, e.target.value)}>
          {SLIDE_TYPES.map((type) => <option key={type} value={type}>{t(`slideTypes.${type}`)}</option>)}
        </select>
        <p className="xs dim" style={{ marginTop: 6 }}>{t(`slideTypes.descriptions.${slide.type}`)}</p>
        <ToggleRow label={t('editor.hideSlide')} checked={slide.hidden} onChange={(v) => setSlideHidden(slide.id, v)} />
      </Section>

      {slide.type === 'question' && (
        <Section title={t('editor.correctAnswer')}>
          <div className="answer-pick">
            {ANSWER_INDICES.map((i) => (
              <button key={i} type="button" className={slide.question.correctAnswer === i ? 'active' : ''} style={{ background: ANSWERS[i].color }} onClick={() => setCorrectAnswer(slide.id, i)} aria-label={t('editor.answerN', { n: i })}>
                <AnswerGlyph index={i} color={i === 3 ? '#1a0a2e' : '#fff'} size={20} />
              </button>
            ))}
          </div>
          <div className="prop-row" style={{ marginTop: 12 }}>
            <label>{t('editor.timeLimit')}</label>
            <div className="grow">
              <select className="select sm" value={slide.question.timeLimit ? 'custom' : 'default'} onChange={(e) => updateQuestion(slide.id, { timeLimit: e.target.value === 'default' ? null : quiz.settings.questionWaitTime }, null)}>
                <option value="default">{t('editor.useDefault', { n: quiz.settings.questionWaitTime })}</option>
                <option value="custom">{t('common.custom')}</option>
              </select>
              {slide.question.timeLimit && <NumberField value={slide.question.timeLimit} min={LIMITS.questionWaitTime[0]} max={LIMITS.questionWaitTime[1]} onChange={(v) => updateQuestion(slide.id, { timeLimit: v })} suffix="s" />}
            </div>
          </div>
          <div className="prop-row" style={{ marginTop: 8 }}>
            <label>{t('editor.questionMedia')}</label>
            <div className="grow image-picker">
              {slide.question.media?.src ? <img className="preview" src={assetUrl(slide.question.media.src)} alt="" /> : <div className="preview center dim"><Icon name="image" /></div>}
              <Button size="sm" icon="upload" onClick={() => pickFiles({ onFiles: (f) => setQuestionMedia(slide.id, f[0]) })}>{t('editor.uploadImage')}</Button>
              {slide.question.media?.src && <IconButton icon="trash" size="sm" label={t('common.remove')} onClick={() => updateQuestion(slide.id, { media: null }, null)} />}
            </div>
          </div>
        </Section>
      )}

      <Section title={t('inspector.background')}>
        <Segmented block value={kind} onChange={switchKind} options={[{ value: 'color', label: t('inspector.solid') }, { value: 'gradient', label: t('inspector.gradient') }, { value: 'image', label: t('inspector.image') }]} />
        <div style={{ height: 10 }} />
        {kind === 'color' && (
          <Row label={t('inspector.color')}>
            <ColorInput value={bg.color} allowNull={false} palette={palette} onChange={(c) => setBackground(slide.id, { kind: 'color', color: c })} />
            <div className="row gap-4 wrap grow">
              {palette.slice(0, 8).map((c) => <button key={c} type="button" className="swatch sm" style={{ background: c }} onClick={() => setBackground(slide.id, { kind: 'color', color: c }, null)} aria-label={c} />)}
            </div>
          </Row>
        )}
        {kind === 'gradient' && <GradientEditor bg={bg} onChange={(next) => setBackground(slide.id, next)} />}
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
      </Section>

      <Section title={t('editor.notes')}>
        <textarea className="textarea" rows={3} value={slide.notes || ''} onChange={(e) => updateSlide(slide.id, { notes: e.target.value }, `notes:${slide.id}`)} />
      </Section>
    </>
  )
}

// ───────────────────────── Text ─────────────────────────

export function TextPanel({ el }) {
  const { t } = useI18n()
  const palette = usePalette()
  const s = el.style
  const set = (patch, key = K(el.id)) => updateElementStyle(el.id, patch, key)
  return (
    <>
      <Section title={t('inspector.text')}>
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
          <select className="select sm" value={s.textShadow ? 'on' : 'off'} onChange={(e) => set({ textShadow: e.target.value === 'on' ? '0 6px 0 rgba(26,10,46,0.9)' : null }, null)}>
            <option value="off">{t('common.none')}</option>
            <option value="on">Hard</option>
          </select>
        </Row>
        <ToggleRow label={t('inspector.autoFit')} checked={s.autoFit} onChange={(v) => set({ autoFit: v }, null)} />
      </Section>
      <Section title={t('inspector.fill')}>
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
  const palette = usePalette()
  const set = (patch, key = K(el.id)) => updateElement(el.id, patch, key)
  const f = el.filters
  const hasSrc = el.binding === 'question-media' ? !!slide.question?.media?.src : !!el.src
  return (
    <>
      <Section title={t('inspector.image')}>
        <div className="row gap-6 wrap">
          <Button size="sm" icon="upload" onClick={() => pickForElement(el.id)}>{t('editor.replaceImage')}</Button>
          <Button size="sm" icon="crop" disabled={!hasSrc} onClick={() => setCropping(el.id)}>{t('editor.crop')}</Button>
          <IconButton icon="flipH" label={t('editor.flipH')} active={el.flipH} onClick={() => set({ flipH: !el.flipH }, null)} />
          <IconButton icon="flipV" label={t('editor.flipV')} active={el.flipV} onClick={() => set({ flipV: !el.flipV }, null)} />
        </div>
      </Section>
      <Section title={t('inspector.frame')}>
        <div className="tiles">
          {FRAMES.map((frame) => <FrameTile key={frame} frame={frame} active={el.frame === frame} onClick={() => set({ frame }, null)} />)}
        </div>
        {el.frame === 'rounded' && <Row label={t('inspector.radius')}><NumberField value={el.borderRadius} min={0} max={500} onChange={(v) => set({ borderRadius: v })} /></Row>}
        <Row label={t('inspector.border')}><BorderControl value={el.border} onChange={(b) => set({ border: b })} /></Row>
        <Row label={t('inspector.shadow')}><ShadowSelect value={el.shadow} onChange={(v) => set({ shadow: v }, null)} /></Row>
      </Section>
      <Section title={t('inspector.filters')} action={<IconButton icon="reset" size="sm" label={t('inspector.resetStyle')} onClick={() => set({ filters: { brightness: 100, contrast: 100, saturate: 100, blur: 0, grayscale: 0, sepia: 0 } }, null)} />}>
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
      <Section title={t('inspector.shape')}>
        <div className="tiles" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
          {SHAPES.map((shape) => (
            <button key={shape} type="button" className={`tile ${el.shape === shape ? 'active' : ''}`} onClick={() => set({ shape }, null)} aria-label={t(`inspector.shapes.${shape}`)} data-tip={t(`inspector.shapes.${shape}`)}>
              <svg viewBox="0 0 24 24" width="60%" height="60%"><path d={shapePath(shape, 24, 24, 4)} fill={shape === 'line' ? 'none' : 'currentColor'} stroke="currentColor" strokeWidth={shape === 'line' ? 3 : 0} /></svg>
            </button>
          ))}
        </div>
      </Section>
      <Section title={t('inspector.fill')}>
        <Row label={t('inspector.fill')}><ColorInput value={el.fill} palette={palette} onChange={(c) => set({ fill: c })} /></Row>
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

export function AnswerPanel({ el, slide }) {
  const { t } = useI18n()
  const palette = usePalette()
  const s = el.style
  const set = (patch, key = K(el.id)) => updateElementStyle(el.id, patch, key)
  const answer = slide.question.answers[el.index - 1]
  const isCorrect = slide.question.correctAnswer === el.index
  return (
    <>
      <Section title={<span className="row gap-6"><span style={{ width: 16, height: 16, borderRadius: 4, background: ANSWERS[el.index].color }} />{t('editor.answerN', { n: el.index })}</span>}>
        <input className="input sm" value={answer.text} placeholder={t('questions.answerPlaceholder', { n: el.index })} onChange={(e) => setAnswer(slide.id, el.index, { text: e.target.value })} />
        <div className="row gap-6" style={{ marginTop: 8 }}>
          <Button size="sm" variant={isCorrect ? 'primary' : 'secondary'} icon="check" onClick={() => setCorrectAnswer(slide.id, el.index)}>{isCorrect ? t('editor.correctAnswer') : t('editor.markCorrect')}</Button>
        </div>
        <div className="image-picker" style={{ marginTop: 10 }}>
          {answer.image?.src ? <img className="preview" src={assetUrl(answer.image.src)} alt="" /> : <div className="preview center dim"><Icon name="image" /></div>}
          <Button size="sm" icon="upload" onClick={() => pickFiles({ onFiles: (f) => setAnswerImage(slide.id, el.index, f[0]) })}>{t('questions.media')}</Button>
          {answer.image?.src && <IconButton icon="trash" size="sm" label={t('common.remove')} onClick={() => setAnswer(slide.id, el.index, { image: null }, null)} />}
        </div>
        {answer.image?.src && (
          <Row label={t('inspector.imagePosition')}>
            <Segmented size="sm" value={s.imagePosition} onChange={(v) => set({ imagePosition: v }, null)} options={[{ value: 'start', label: t('inspector.start') }, { value: 'top', label: t('inspector.top') }, { value: 'cover', label: t('inspector.cover') }]} />
          </Row>
        )}
      </Section>
      <Section title={t('inspector.variant')}>
        <Segmented block value={s.variant} onChange={(v) => set({ variant: v }, null)} options={[{ value: 'card', label: t('inspector.card') }, { value: 'pill', label: t('inspector.pill') }, { value: 'flat', label: t('inspector.flat') }]} />
        <div style={{ height: 8 }} />
        <ToggleRow label={t('inspector.showShape')} checked={s.showShape} onChange={(v) => set({ showShape: v }, null)} />
        <ToggleRow label={t('inspector.showIndex')} checked={s.showIndex} onChange={(v) => set({ showIndex: v }, null)} />
        <Row label={t('inspector.fill')}>
          <ColorInput value={s.background} palette={palette} onChange={(c) => set({ background: c })} />
          {s.background && <Button size="sm" variant="ghost" onClick={() => set({ background: null }, null)}>{t('inspector.auto')}</Button>}
        </Row>
        <Row label={t('inspector.color')}><ColorInput value={s.color} allowNull={false} palette={palette} onChange={(c) => set({ color: c })} /></Row>
        <Row label={t('inspector.font')}><FontSelect value={s.fontFamily} onChange={(v) => set({ fontFamily: v }, null)} /></Row>
        <Row label={t('inspector.fontSize')}>
          <NumberField value={s.fontSize} min={8} max={200} onChange={(v) => set({ fontSize: v })} />
          <IconButton icon="bold" size="sm" label="Bold" active={s.bold} onClick={() => set({ bold: !s.bold }, null)} />
        </Row>
        <Row label={t('inspector.radius')}><NumberField value={s.borderRadius} min={0} max={999} onChange={(v) => set({ borderRadius: v })} /></Row>
        <Row label={t('inspector.border')}><BorderControl value={s.border} onChange={(b) => set({ border: b })} /></Row>
        <Row label={t('inspector.shadow')}><ShadowSelect value={s.shadow} onChange={(v) => set({ shadow: v }, null)} /></Row>
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
      <Section title={t(`inspector.widgets.${w}`)}>
        <p className="xs dim" style={{ marginTop: -4, marginBottom: 10 }}>{t(`inspector.widgetHints.${w}`)}</p>
        {hasLabel && (
          <Row label={t('inspector.label')}>
            <input className="input sm" value={p.label || ''} onChange={(e) => setP({ label: e.target.value })} />
            {p.showLabel !== undefined && <IconButton icon={p.showLabel ? 'eye' : 'eyeOff'} size="sm" label={t('inspector.showLabel')} active={p.showLabel} onClick={() => setP({ showLabel: !p.showLabel }, null)} />}
          </Row>
        )}
        {(w === 'timer' || w === 'respondents') && (
          <Row label={t('inspector.variant')}>
            <Segmented size="sm" value={p.variant} onChange={(v) => setP({ variant: v }, null)} options={[{ value: 'circle', label: t('inspector.circle') }, { value: 'pill', label: t('inspector.pill') }, { value: 'number', label: t('inspector.number') }]} />
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
            <Row label={t('inspector.variant')}>
              <Segmented size="sm" value={p.avatarStyle} onChange={(v) => setP({ avatarStyle: v }, null)} options={[{ value: 'card', label: t('inspector.card') }, { value: 'pill', label: t('inspector.pill') }, { value: 'glass', label: 'Glass' }]} />
            </Row>
          </>
        )}
        {w === 'answers-chart' && (
          <>
            <ToggleRow label={t('inspector.showValues')} checked={p.showValues} onChange={(v) => setP({ showValues: v }, null)} />
            <ToggleRow label={t('inspector.showShapes')} checked={p.showShapes} onChange={(v) => setP({ showShapes: v }, null)} />
            <ToggleRow label={t('editor.questionText')} checked={p.showQuestion} onChange={(v) => setP({ showQuestion: v }, null)} />
            <Row label={t('inspector.radius')}><NumberField value={p.barRadius} min={0} max={80} onChange={(v) => setP({ barRadius: v })} /></Row>
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
      <Section title={t('inspector.variant')}>
        <Row label={t('inspector.font')}><FontSelect value={s.fontFamily} onChange={(v) => setS({ fontFamily: v }, null)} /></Row>
        <Row label={t('inspector.color')}>
          <ColorInput value={s.color} allowNull={false} palette={palette} onChange={(c) => setS({ color: c })} label={t('inspector.color')} />
          <ColorInput value={s.accent} allowNull={false} palette={palette} onChange={(c) => setS({ accent: c })} label={t('inspector.accent')} />
          <span className="xs dim">{t('inspector.accent')}</span>
        </Row>
        <Row label={t('inspector.fill')}><ColorInput value={s.background} palette={palette} onChange={(c) => setS({ background: c })} /></Row>
        <Row label={t('inspector.border')}><BorderControl value={s.border} onChange={(b) => setS({ border: b })} /></Row>
        <Row label={t('inspector.radius')}><NumberField value={s.borderRadius} min={0} max={200} onChange={(v) => setS({ borderRadius: v })} /></Row>
        <Row label={t('inspector.shadow')}><ShadowSelect value={s.shadow} onChange={(v) => setS({ shadow: v }, null)} /></Row>
      </Section>
    </>
  )
}
