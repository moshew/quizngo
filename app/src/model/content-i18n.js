/**
 * Strings that end up INSIDE slides (template placeholders, widget labels).
 * These follow the quiz content language, not the UI language, and are stored in the document
 * so the author can edit them freely afterwards.
 */

const strings = {
  he: {
    quizTitle: 'שם החידון',
    openingSubtitle: 'סרקו את הקוד או היכנסו לכתובת והצטרפו למשחק',
    waitingForPlayers: 'מחכים למשתתפים...',
    pinLabel: 'קוד משחק',
    scanToJoin: 'סרקו להצטרפות',
    participants: 'משתתפים',
    answered: 'ענו',
    seconds: 'שניות',
    questionOf: 'שאלה {{n}} מתוך {{total}}',
    sampleQuestion: 'כתבו כאן את השאלה',
    sampleAnswer: 'תשובה {{n}}',
    statsTitle: 'איך עניתם?',
    leaderboardTitle: 'המובילים עד כאן',
    summaryTitle: 'תודה ששיחקתם!',
    summarySubtitle: 'ואלו המנצחים הגדולים',
    transitionTitle: 'הפסקה קצרה',
    transitionSubtitle: 'עוד רגע ממשיכים',
    points: 'נק׳',
  },
  en: {
    quizTitle: 'Quiz title',
    openingSubtitle: 'Scan the code or open the link to join the game',
    waitingForPlayers: 'Waiting for players...',
    pinLabel: 'Game PIN',
    scanToJoin: 'Scan to join',
    participants: 'players',
    answered: 'answered',
    seconds: 'seconds',
    questionOf: 'Question {{n}} of {{total}}',
    sampleQuestion: 'Type your question here',
    sampleAnswer: 'Answer {{n}}',
    statsTitle: 'How did you answer?',
    leaderboardTitle: 'Leaders so far',
    summaryTitle: 'Thanks for playing!',
    summarySubtitle: 'And the big winners are',
    transitionTitle: 'Short break',
    transitionSubtitle: 'Back in a moment',
    points: 'pts',
  },
  ar: {
    quizTitle: 'اسم المسابقة',
    openingSubtitle: 'امسح الرمز أو افتح الرابط للانضمام',
    waitingForPlayers: 'في انتظار اللاعبين...',
    pinLabel: 'رمز اللعبة',
    scanToJoin: 'امسح للانضمام',
    participants: 'مشاركون',
    answered: 'أجابوا',
    seconds: 'ثانية',
    questionOf: 'سؤال {{n}} من {{total}}',
    sampleQuestion: 'اكتب السؤال هنا',
    sampleAnswer: 'إجابة {{n}}',
    statsTitle: 'كيف أجبتم؟',
    leaderboardTitle: 'المتصدرون حتى الآن',
    summaryTitle: 'شكرًا للمشاركة!',
    summarySubtitle: 'وهؤلاء هم الفائزون',
    transitionTitle: 'استراحة قصيرة',
    transitionSubtitle: 'نعود بعد لحظات',
    points: 'نقطة',
  },
}

export function contentT(lang, key, params = {}) {
  const dict = strings[lang] || strings.en
  let value = dict[key] ?? strings.en[key] ?? key
  return value.replace(/\{\{(\w+)\}\}/g, (_, k) => (params[k] !== undefined ? params[k] : `{{${k}}}`))
}

export const CONTENT_LANG_KEYS = Object.keys(strings)
