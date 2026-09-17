import React, { useLayoutEffect, useRef, useState } from 'react'
import SlideRenderer from '../editor/render/SlideRenderer.jsx'
import { SLIDE_W, SLIDE_H } from '../model/constants.js'
import { DEFAULT_SETTINGS } from '../model/constants.js'

/**
 * Live, scaled-down rendering of a slide that fills its container's width (16:9).
 * Pass `lazy` to defer rendering until the thumb scrolls into view.
 */
export default function SlideThumb({ slide, quiz, className = '', lazy = false, style, mode = 'thumb', children }) {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)
  const [visible, setVisible] = useState(!lazy)

  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return undefined
    const measure = () => setWidth(node.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(node)
    let io
    if (lazy && 'IntersectionObserver' in window) {
      io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) setVisible(true) }, { rootMargin: '300px' })
      io.observe(node)
    }
    return () => { ro.disconnect(); io?.disconnect() }
  }, [lazy])

  const scale = width / SLIDE_W
  const quizForRender = quiz || { language: 'he', settings: DEFAULT_SETTINGS, slides: slide ? [slide] : [] }

  return (
    <div ref={ref} className={`slide-thumb ${className}`} style={{ aspectRatio: `${SLIDE_W} / ${SLIDE_H}`, ...style }}>
      {visible && width > 0 && slide && (
        <div className="slide-thumb-inner" style={{ width, height: width * (SLIDE_H / SLIDE_W) }}>
          <SlideRenderer quiz={quizForRender} slide={slide} scale={scale} mode={mode} />
        </div>
      )}
      {children}
    </div>
  )
}
