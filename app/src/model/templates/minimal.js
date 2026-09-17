import { gradient } from './base.js'
import magenta from './magenta.js'

const INK = '#1a0a2e'

/** "Daylight" — the chunky skin on a bright background, for lit rooms and weak projectors. */
export default {
  ...magenta,
  id: 'minimal-light',
  preview: { accent: '#B620C9' },
  palette: ['#B620C9', '#FFD400', '#B6FF3C', '#FF2E93', '#6B2BFF', '#ffffff', INK, '#5b5570'],
  colors: { text: INK, textMuted: 'rgba(26,10,46,0.72)', ink: INK, accent: '#FFD400', accent2: '#B6FF3C', eyebrow: '#B620C9' },
  vars: {
    ...magenta.vars,
    '--t-text': INK,
    '--t-glass': INK,
    '--t-glass-strong': INK,
    '--t-chip': 'rgba(255,255,255,0.2)',
    '--t-blob-1': '#ffd9a0',
    '--t-blob-2': '#ffb8e0',
    '--t-ghost': INK,
    '--t-ghost-opacity': '0.06',
  },
  background: gradient(155, ['#FFF9EE', 0], ['#FFEFD6', 58], ['#FFE0F0', 116]),
  text: { titleShadow: null, eyebrowShadow: null },
}
