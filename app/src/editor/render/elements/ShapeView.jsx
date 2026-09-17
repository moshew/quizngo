import React from 'react'
import { shapePath } from '../shapes.js'
import { shadowToFilter } from '../color.js'

export default function ShapeView({ el }) {
  const { w, h } = el
  const d = shapePath(el.shape, w, h, el.borderRadius)
  const stroke = el.stroke || {}
  const isLine = el.shape === 'line'
  return (
    <svg
      className="el-shape"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{ filter: el.shadow ? shadowToFilter(el.shadow) : undefined, overflow: 'visible' }}
    >
      <path
        d={d}
        fill={isLine ? 'none' : el.fill || 'transparent'}
        stroke={isLine ? (stroke.color || el.fill || '#fff') : stroke.width > 0 ? stroke.color : 'none'}
        strokeWidth={isLine ? Math.max(stroke.width || 0, 4) : stroke.width || 0}
        strokeDasharray={stroke.dash ? `${(stroke.width || 4) * 3} ${(stroke.width || 4) * 2}` : undefined}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
