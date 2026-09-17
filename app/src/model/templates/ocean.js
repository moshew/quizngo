import { gradient } from './base.js'
import magenta from './magenta.js'

const INK = '#06183a'

/** Chunky skin, deep blue → azure → turquoise. */
export default {
  ...magenta,
  id: 'ocean',
  preview: { accent: '#9BFFE9' },
  palette: ['#FFD400', '#9BFFE9', '#FF5C8A', '#0A2A7A', '#1477D4', '#ffffff', INK, '#22D3C5'],
  colors: { ...magenta.colors, ink: INK, accent: '#FFD400', accent2: '#9BFFE9', eyebrow: '#9BFFE9' },
  vars: {
    ...magenta.vars,
    '--t-ink': INK,
    '--t-primary': '#FFD400',
    '--t-secondary': '#9BFFE9',
    '--t-danger': '#FF5C8A',
    '--t-surface-muted': '#4a5b78',
    '--t-glass-strong': 'rgba(6,24,58,0.45)',
    '--t-blob-1': '#3b82ff',
    '--t-blob-2': '#22d3c5',
  },
  background: gradient(155, ['#0A2A7A', 0], ['#1477D4', 58], ['#22D3C5', 116]),
  image: { border: { width: 7, color: INK }, borderRadius: 28, shadow: `0 18px 0 ${INK}, 0 34px 52px rgba(0,0,0,0.34)` },
}
