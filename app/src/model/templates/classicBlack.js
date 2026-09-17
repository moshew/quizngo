import { image } from './base.js'

const GOLD = '#F5C242'
const INK = '#0b0b0b'
// Vite inlines import.meta.env; the fallback keeps the module importable under plain Node (tests).
const BASE_URL = (typeof import.meta.env !== 'undefined' && import.meta.env.BASE_URL) || '/'
const BG = `${BASE_URL}templates/classic-black-bg.png`

export default {
  id: 'classic-black',
  preview: { background: 'radial-gradient(circle at 30% 20%, #4a3512 0%, #0b0b0b 65%)', accent: GOLD, ink: INK, text: '#fff', card: 'rgba(0,0,0,.6)' },
  fonts: {
    he: { display: 'Frank Ruhl Libre', body: 'Assistant' },
    ar: { display: 'Rubik', body: 'Rubik' },
    default: { display: 'Playfair Display', body: 'Montserrat' },
  },
  palette: [GOLD, '#FFE08A', '#ffffff', '#c9a24a', '#7a5a15', '#2a2a2a', INK, '#8b0000'],
  colors: {
    text: '#ffffff',
    textMuted: 'rgba(255,255,255,0.78)',
    ink: INK,
    accent: GOLD,
    accent2: '#FFE08A',
    surface: 'rgba(0,0,0,0.6)',
    surfaceText: '#ffffff',
  },
  text: { titleShadow: '0 4px 24px rgba(0,0,0,0.7)' },
  backgrounds: {
    opening: image(BG, null),
    question: image(BG, 'rgba(0,0,0,0.62)'),
    statistics: image(BG, 'rgba(0,0,0,0.55)'),
    leaderboard: image(BG, 'rgba(0,0,0,0.55)'),
    transition: image(BG, 'rgba(0,0,0,0.2)'),
    summary: image(BG, null),
  },
  answer: {
    variant: 'card',
    borderRadius: 14,
    border: { width: 3, color: GOLD },
    shadow: '0 12px 32px rgba(0,0,0,0.5)',
    color: '#ffffff',
    fontSize: 42,
    showShape: true,
    bold: true,
  },
  widget: {
    background: 'rgba(0,0,0,0.62)',
    borderRadius: 18,
    border: { width: 3, color: GOLD },
    shadow: '0 12px 32px rgba(0,0,0,0.5)',
  },
  widgets: {
    timerVariant: 'circle',
    participantsAvatar: 'pill',
  },
}
