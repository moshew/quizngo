/**
 * Placeholder "live" data shown in the editor and preview. The game runtime will pass real
 * data with the same shape via SlideRenderer's `liveData` prop.
 */

const ICONS = ['🦊', '🐯', '🐼', '🦁', '🐸', '🐔', '🦝', '🐰', '🐱', '🐻', '🦄', '🐙']
const NAMES = {
  he: ['נועה', 'איתי', 'מאיה', 'יונתן', 'תמר', 'עומר', 'שירה', 'דניאל', 'ליה', 'אורי', 'רוני', 'אלון'],
  en: ['Noa', 'Itay', 'Maya', 'Jonathan', 'Tamar', 'Omer', 'Shira', 'Daniel', 'Lia', 'Uri', 'Roni', 'Alon'],
  ar: ['نور', 'آدم', 'ليان', 'يوسف', 'مريم', 'عمر', 'سارة', 'كريم', 'لينا', 'زيد', 'هنا', 'سامي'],
}
const SCORES = [4820, 4310, 3990, 3640, 3120, 2870, 2440, 2010, 1780, 1420, 980, 610]

export function sampleLiveData(lang = 'he', { participantsCount = 12 } = {}) {
  const names = NAMES[lang] || NAMES.en
  const participants = names.slice(0, participantsCount).map((name, i) => ({
    id: `p${i}`,
    nickname: name,
    icon: ICONS[i % ICONS.length],
    score: SCORES[i] ?? 0,
  }))
  return {
    gamePin: '123456',
    joinUrl: 'https://game.quizngo.online',
    participants,
    participantsCount: 24,
    respondents: 18,
    timeLeft: null,          // null → widget shows the question's full time
    distribution: { 1: 8, 2: 12, 3: 3, 4: 5 },
    leaderboard: participants.slice().sort((a, b) => b.score - a.score),
  }
}

export function formatPin(pin) {
  const digits = String(pin || '').replace(/\D/g, '')
  if (digits.length === 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return pin || '---'
}
