import { solid } from './base.js'

const INK = '#05060F'

/**
 * "Midnight Arcade" — the approved neon HUD host deck: glass panels with luminous edges, sharp
 * corners, monospace metadata, corner-bracket screen frame, dot matrix and a perspective floor grid.
 * Black & Gold is a re-coloring of this same skin.
 */
export default {
  id: 'midnight-arcade',
  skin: 'neon',
  decor: 'arcade',
  preview: { accent: '#34E7E4' },
  fonts: {
    he: { display: 'Rubik', body: 'Heebo', mono: 'Rubik', eyebrow: 'Rubik' },
    ar: { display: 'Rubik', body: 'Rubik', mono: 'Rubik', eyebrow: 'Rubik' },
    default: { display: 'Bricolage Grotesque', body: 'Plus Jakarta Sans', mono: 'Space Mono', eyebrow: 'Space Mono' },
  },
  palette: ['#34E7E4', '#FFD400', '#B6FF3C', '#FF2E93', '#7C3AED', '#ffffff', '#0d0e15', INK],
  colors: { text: '#ffffff', textMuted: 'rgba(255,255,255,0.7)', ink: INK, accent: '#34E7E4', accent2: '#B6FF3C', eyebrow: '#34E7E4' },
  vars: {
    '--t-ink': INK,
    '--t-primary': '#FFD400',
    '--t-secondary': '#B6FF3C',
    '--t-danger': '#FF2E93',
    '--t-text': '#ffffff',
    '--t-accent': '#34E7E4',
    '--t-accent-rgb': '52,231,228',
    '--t-glow-2-rgb': '124,58,237',
    '--t-glow-3-rgb': '255,46,147',
    '--t-grid-rgb': '64,236,233',
    '--c-red': '#ff5847',
    '--c-blue': '#3aa7ee',
    '--c-yellow': '#f6c91f',
    '--c-green': '#2fd676',
  },
  background: solid('#070A12'),
  text: { titleShadow: '0 2px 0 rgba(0,0,0,0.4), 0 0 34px rgba(52,231,228,0.22)', eyebrowShadow: null, eyebrowSpacing: 0.2 },
  image: { border: { width: 2, color: 'rgba(52,231,228,0.35)' }, borderRadius: 7, shadow: '0 20px 44px rgba(0,0,0,0.5), 0 0 44px rgba(124,58,237,0.28)' },
}
