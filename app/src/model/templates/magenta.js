import { gradient, solid } from './base.js'

const INK = '#1a0a2e'

const CONFETTI = ['#FFD400', '#B6FF3C', '#FF2E93', '#ffffff', '#6B2BFF', '#2BD68A']

export default {
  id: 'magenta-party',
  preview: { background: 'linear-gradient(160deg,#6B2BFF 0%,#B620C9 60%,#FF2E93 110%)', accent: '#FFD400', ink: INK, text: '#fff', card: '#fff' },
  fonts: {
    he: { display: 'Secular One', body: 'Rubik' },
    ar: { display: 'Rubik', body: 'Rubik' },
    default: { display: 'Bricolage Grotesque', body: 'Plus Jakarta Sans' },
  },
  palette: ['#FFD400', '#B6FF3C', '#FF2E93', '#6B2BFF', '#B620C9', '#2BD68A', '#ffffff', INK],
  colors: {
    text: '#ffffff',
    textMuted: 'rgba(255,255,255,0.8)',
    ink: INK,
    accent: '#FFD400',
    accent2: '#B6FF3C',
    surface: '#ffffff',
    surfaceText: INK,
  },
  text: { titleShadow: '0 6px 0 rgba(26,10,46,0.9)' },
  backgrounds: {
    opening: gradient(160, ['#6B2BFF', 0], ['#B620C9', 60], ['#FF2E93', 110]),
    question: solid(INK),
    statistics: gradient(160, ['#2B1A6B', 0], ['#4A23B8', 60], ['#6B2BFF', 110]),
    leaderboard: gradient(160, ['#2B1A6B', 0], ['#4A23B8', 60], ['#6B2BFF', 110]),
    transition: gradient(160, ['#6B2BFF', 0], ['#B620C9', 60], ['#FF2E93', 110]),
    summary: gradient(160, ['#00B36B', 0], ['#2BD68A', 60], ['#B6FF3C', 110]),
  },
  answer: {
    variant: 'card',
    borderRadius: 24,
    border: { width: 4, color: INK },
    shadow: '0 10px 0 #1a0a2e',
    color: '#ffffff',
    fontSize: 44,
    showShape: true,
    bold: true,
  },
  widget: {
    background: '#ffffff',
    borderRadius: 28,
    border: { width: 4, color: INK },
    shadow: '0 10px 0 #1a0a2e',
  },
  widgets: {
    timerVariant: 'circle',
    participantsAvatar: 'card',
  },
  decorations(type, ctx, { createShape }) {
    if (!['opening', 'summary', 'transition'].includes(type)) return []
    const spots = [[120, 300], [1750, 240], [300, 950], [1650, 900], [960, 1000], [1500, 120]]
    return spots.map(([x, y], i) => createShape({
      shape: i % 2 ? 'ellipse' : 'rect',
      x, y, w: 26 + (i % 3) * 8, h: 26 + (i % 3) * 8,
      rotation: (i * 37) % 90,
      fill: CONFETTI[i % CONFETTI.length],
      stroke: { width: 0, color: INK, dash: false },
      borderRadius: 6,
      opacity: 0.85,
      fromTemplate: true,
    }))
  },
}
