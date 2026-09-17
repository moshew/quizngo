import { solid } from './base.js'

const INK = '#111827'
const ACCENT = '#6D5DFC'

export default {
  id: 'minimal-light',
  preview: { background: '#f6f7fb', accent: ACCENT, ink: INK, text: INK, card: '#fff' },
  fonts: {
    he: { display: 'Heebo', body: 'Assistant' },
    ar: { display: 'Rubik', body: 'Rubik' },
    default: { display: 'Plus Jakarta Sans', body: 'Plus Jakarta Sans' },
  },
  palette: [ACCENT, '#111827', '#6B7280', '#E5E7EB', '#ffffff', '#F59E0B', '#10B981', '#EF4444'],
  colors: {
    text: INK,
    textMuted: '#6B7280',
    ink: INK,
    accent: ACCENT,
    accent2: '#F59E0B',
    surface: '#ffffff',
    surfaceText: INK,
  },
  text: { titleShadow: null },
  backgrounds: {
    opening: solid('#F6F7FB'),
    question: solid('#FFFFFF'),
    statistics: solid('#F6F7FB'),
    leaderboard: solid('#F6F7FB'),
    transition: solid('#F6F7FB'),
    summary: solid('#EEF2FF'),
  },
  answer: {
    variant: 'flat',
    background: '#ffffff',
    borderRadius: 18,
    border: { width: 2, color: '#E5E7EB' },
    shadow: '0 6px 18px rgba(17,24,39,0.06)',
    color: INK,
    fontSize: 40,
    showShape: true,
    bold: true,
  },
  widget: {
    background: '#ffffff',
    borderRadius: 20,
    border: { width: 2, color: '#E5E7EB' },
    shadow: '0 6px 18px rgba(17,24,39,0.06)',
  },
  widgets: {
    timerVariant: 'circle',
    participantsAvatar: 'card',
  },
  decorations(type, ctx, { createShape }) {
    // A quiet accent bar at the top of every slide.
    return [
      createShape({ shape: 'rect', x: 0, y: 0, w: 1920, h: 14, fill: ACCENT, stroke: { width: 0 }, fromTemplate: true, locked: true }),
    ]
  },
}
