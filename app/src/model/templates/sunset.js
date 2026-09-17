import { gradient, solid } from './base.js'

const INK = '#2B0F2F'
const ACCENT = '#FFD200'

export default {
  id: 'sunset',
  preview: { background: 'linear-gradient(160deg,#ff512f 0%,#f09819 100%)', accent: ACCENT, ink: INK, text: '#fff', card: '#fff' },
  fonts: {
    he: { display: 'Suez One', body: 'Rubik' },
    ar: { display: 'Rubik', body: 'Rubik' },
    default: { display: 'Lilita One', body: 'Poppins' },
  },
  palette: [ACCENT, '#FF512F', '#F09819', '#A4508B', '#5F0A87', '#ffffff', INK, '#FF7EB3'],
  colors: {
    text: '#ffffff',
    textMuted: 'rgba(255,255,255,0.85)',
    ink: INK,
    accent: ACCENT,
    accent2: '#FF7EB3',
    surface: '#ffffff',
    surfaceText: INK,
  },
  text: { titleShadow: '0 5px 0 rgba(43,15,47,0.55)' },
  backgrounds: {
    opening: gradient(160, ['#FF512F', 0], ['#F09819', 100]),
    question: solid(INK),
    statistics: gradient(160, ['#5F0A87', 0], ['#A4508B', 100]),
    leaderboard: gradient(160, ['#5F0A87', 0], ['#A4508B', 100]),
    transition: gradient(160, ['#FF512F', 0], ['#F09819', 100]),
    summary: gradient(160, ['#F7971E', 0], ['#FFD200', 100]),
  },
  answer: {
    variant: 'pill',
    borderRadius: 999,
    border: { width: 0, color: INK },
    shadow: '0 10px 26px rgba(0,0,0,0.32)',
    color: '#ffffff',
    fontSize: 42,
    showShape: true,
    bold: true,
  },
  widget: {
    background: '#ffffff',
    borderRadius: 40,
    border: null,
    shadow: '0 12px 30px rgba(0,0,0,0.28)',
  },
  widgets: {
    timerVariant: 'circle',
    participantsAvatar: 'pill',
  },
  decorations(type, ctx, { createShape, mirrorX }) {
    if (!['opening', 'transition', 'summary'].includes(type)) return []
    return [
      createShape({ shape: 'ellipse', x: mirrorX(1380, 620), y: 560, w: 620, h: 620, fill: 'rgba(255,210,0,0.35)', stroke: { width: 0 }, fromTemplate: true }),
      createShape({ shape: 'ellipse', x: mirrorX(1480, 420), y: 660, w: 420, h: 420, fill: 'rgba(255,255,255,0.22)', stroke: { width: 0 }, fromTemplate: true }),
    ]
  },
}
