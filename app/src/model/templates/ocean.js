import { gradient, solid } from './base.js'

const INK = '#082540'
const ACCENT = '#7FE3E0'

export default {
  id: 'ocean',
  preview: { background: 'linear-gradient(160deg,#0f4c81 0%,#1ca7ec 60%,#7fe3e0 110%)', accent: ACCENT, ink: INK, text: '#fff', card: 'rgba(255,255,255,.18)' },
  fonts: {
    he: { display: 'Varela Round', body: 'Heebo' },
    ar: { display: 'Rubik', body: 'Rubik' },
    default: { display: 'Fredoka', body: 'Poppins' },
  },
  palette: [ACCENT, '#1CA7EC', '#0F4C81', '#FFD166', '#ffffff', '#EF476F', INK, '#06D6A0'],
  colors: {
    text: '#ffffff',
    textMuted: 'rgba(255,255,255,0.82)',
    ink: INK,
    accent: ACCENT,
    accent2: '#FFD166',
    surface: 'rgba(255,255,255,0.16)',
    surfaceText: '#ffffff',
  },
  text: { titleShadow: '0 4px 18px rgba(8,37,64,0.45)' },
  backgrounds: {
    opening: gradient(160, ['#0F4C81', 0], ['#1CA7EC', 60], ['#7FE3E0', 110]),
    question: solid('#0B2A4A'),
    statistics: gradient(160, ['#0B2A4A', 0], ['#1B5E9E', 70], ['#1CA7EC', 120]),
    leaderboard: gradient(160, ['#0B2A4A', 0], ['#1B5E9E', 70], ['#1CA7EC', 120]),
    transition: gradient(160, ['#0F4C81', 0], ['#1CA7EC', 60], ['#7FE3E0', 110]),
    summary: gradient(160, ['#00B4A0', 0], ['#3ED0C3', 55], ['#7FE3E0', 110]),
  },
  answer: {
    variant: 'card',
    borderRadius: 22,
    border: { width: 3, color: 'rgba(255,255,255,0.55)' },
    shadow: '0 12px 30px rgba(0,0,0,0.25)',
    color: '#ffffff',
    fontSize: 42,
    showShape: true,
    bold: true,
  },
  widget: {
    background: 'rgba(255,255,255,0.16)',
    borderRadius: 26,
    border: { width: 2, color: 'rgba(255,255,255,0.45)' },
    shadow: '0 12px 30px rgba(0,0,0,0.2)',
  },
  widgets: {
    timerVariant: 'circle',
    participantsAvatar: 'glass',
  },
  decorations(type, ctx, { createShape }) {
    if (type === 'question') return []
    return [
      createShape({ shape: 'ellipse', x: -220, y: -260, w: 700, h: 700, fill: 'rgba(255,255,255,0.08)', stroke: { width: 0 }, fromTemplate: true }),
      createShape({ shape: 'ellipse', x: 1450, y: 620, w: 760, h: 760, fill: 'rgba(255,255,255,0.08)', stroke: { width: 0 }, fromTemplate: true }),
    ]
  },
}
