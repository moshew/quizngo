import { gradient } from './base.js'

const INK = '#1a0a2e'

/**
 * "Magenta Party" — the approved chunky-3D host deck: flat fills, hard ink shadows, ink borders,
 * big radii. Sunset / Ocean / Daylight are re-colorings of this same skin.
 */
export default {
  id: 'magenta-party',
  skin: 'chunky',
  decor: 'party',
  preview: { accent: '#FFD400' },
  fonts: {
    he: { display: 'Rubik', body: 'Heebo', mono: 'Rubik' },
    ar: { display: 'Rubik', body: 'Rubik', mono: 'Rubik' },
    default: { display: 'Bricolage Grotesque', body: 'Plus Jakarta Sans', mono: 'Plus Jakarta Sans' },
  },
  palette: ['#FFD400', '#B6FF3C', '#FF2E93', '#6B2BFF', '#B620C9', '#ffffff', INK, '#2BD68A'],
  colors: { text: '#ffffff', textMuted: 'rgba(255,255,255,0.92)', ink: INK, accent: '#FFD400', accent2: '#B6FF3C', eyebrow: '#FFD400' },
  vars: {
    '--t-ink': INK,
    '--t-primary': '#FFD400',
    '--t-secondary': '#B6FF3C',
    '--t-danger': '#FF2E93',
    '--t-text': '#ffffff',
    '--t-surface': '#ffffff',
    '--t-surface-muted': '#5b5570',
    '--t-glass': 'rgba(0,0,0,0.28)',
    '--t-glass-strong': 'rgba(26,10,46,0.42)',
    '--t-chip': 'rgba(255,255,255,0.22)',
    '--t-blob-1': '#8a3bff',
    '--t-blob-2': '#ff2e93',
    '--t-ghost': '#ffffff',
    '--t-ghost-opacity': '0.10',
  },
  background: gradient(155, ['#6B2BFF', 0], ['#B620C9', 58], ['#FF2E93', 116]),
  text: { titleShadow: '0 4px 0 rgba(0,0,0,0.22)', eyebrowShadow: '0 3px 0 rgba(0,0,0,0.2)' },
  image: { border: { width: 7, color: INK }, borderRadius: 28, shadow: '0 18px 0 #1a0a2e, 0 34px 52px rgba(0,0,0,0.34)' },
}
