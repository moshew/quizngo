import { image } from './base.js'
import midnight from './midnight.js'

const GOLD = '#F5C242'
const INK = '#0b0b0b'
// Vite inlines import.meta.env; the fallback keeps the module importable under plain Node (tests).
const BASE_URL = (typeof import.meta.env !== 'undefined' && import.meta.env.BASE_URL) || '/'
const BG = `${BASE_URL}templates/classic-black-bg.png`

/** "Black & Gold" — the neon skin in gold over the classic PowerPoint background. */
export default {
  ...midnight,
  id: 'classic-black',
  decor: 'gold',
  preview: { accent: GOLD },
  fonts: {
    he: { display: 'Frank Ruhl Libre', body: 'Assistant', mono: 'Assistant', eyebrow: 'Assistant' },
    ar: { display: 'Rubik', body: 'Rubik', mono: 'Rubik', eyebrow: 'Rubik' },
    default: { display: 'Playfair Display', body: 'Montserrat', mono: 'Montserrat', eyebrow: 'Montserrat' },
  },
  palette: [GOLD, '#FFE08A', '#ffffff', '#c9a24a', '#7a5a15', '#2a2a2a', INK, '#C9184A'],
  colors: { text: '#ffffff', textMuted: 'rgba(255,255,255,0.72)', ink: INK, accent: GOLD, accent2: '#FFE08A', eyebrow: GOLD },
  vars: {
    ...midnight.vars,
    '--t-ink': INK,
    '--t-primary': GOLD,
    '--t-secondary': '#FFE08A',
    '--t-danger': '#C9184A',
    '--t-accent': GOLD,
    '--t-accent-rgb': '245,194,66',
    '--t-glow-2-rgb': '180,120,20',
    '--t-glow-3-rgb': '255,224,138',
    '--t-grid-rgb': '245,194,66',
  },
  background: image(BG, 'rgba(0,0,0,0.35)', INK),
  text: { titleShadow: '0 2px 0 rgba(0,0,0,0.5), 0 0 30px rgba(245,194,66,0.25)', eyebrowShadow: null, eyebrowSpacing: 0.24 },
  image: { border: { width: 2, color: 'rgba(245,194,66,0.5)' }, borderRadius: 7, shadow: '0 20px 44px rgba(0,0,0,0.6), 0 0 40px rgba(245,194,66,0.18)' },
}
