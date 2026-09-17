import { gradient } from './base.js'
import magenta from './magenta.js'

const INK = '#2a0a1e'

/** Chunky skin, warm orange → coral → magenta. */
export default {
  ...magenta,
  id: 'sunset',
  preview: { accent: '#FFE14A' },
  palette: ['#FFE14A', '#8CF5D2', '#7A2BFF', '#FF9A1F', '#FF4D5E', '#ffffff', INK, '#D6249F'],
  colors: { ...magenta.colors, ink: INK, accent: '#FFE14A', accent2: '#8CF5D2', eyebrow: '#FFE14A' },
  vars: {
    ...magenta.vars,
    '--t-ink': INK,
    '--t-primary': '#FFE14A',
    '--t-secondary': '#8CF5D2',
    '--t-danger': '#7A2BFF',
    '--t-surface-muted': '#6b4a55',
    '--t-glass-strong': 'rgba(42,10,30,0.42)',
    '--t-blob-1': '#ffc04d',
    '--t-blob-2': '#ff2e93',
  },
  background: gradient(155, ['#FF9A1F', 0], ['#FF4D5E', 58], ['#D6249F', 116]),
  image: { border: { width: 7, color: INK }, borderRadius: 28, shadow: `0 18px 0 ${INK}, 0 34px 52px rgba(0,0,0,0.34)` },
}
