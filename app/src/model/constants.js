export const SCHEMA_VERSION = 1

/** Logical slide size. Every element coordinate is expressed in these units. */
export const SLIDE_W = 1920
export const SLIDE_H = 1080

export const SLIDE_TYPES = ['opening', 'question', 'statistics', 'leaderboard', 'transition', 'summary']
export const RESULT_SLIDE_TYPES = ['statistics', 'leaderboard']

/** Canonical answer colors & shapes — shared with the player app; never themed. */
export const ANSWERS = {
  1: { color: '#e74c3c', dark: '#b73a2d', shape: 'triangle', name: 'red' },
  2: { color: '#3498db', dark: '#2a78ad', shape: 'diamond', name: 'blue' },
  3: { color: '#f1c40f', dark: '#c19c0c', shape: 'circle', name: 'yellow' },
  4: { color: '#2ecc71', dark: '#25a35a', shape: 'square', name: 'green' },
}
export const ANSWER_INDICES = [1, 2, 3, 4]

export const DEFAULT_SETTINGS = {
  questionWaitTime: 30,
  clockActivationDelay: 5,
  leaderboardSize: 5,
}
export const LIMITS = {
  questionWaitTime: [5, 300],
  clockActivationDelay: [0, 60],
  leaderboardSize: [1, 10],
}

export const ELEMENT_KINDS = ['text', 'image', 'shape', 'answer', 'widget']

export const WIDGET_TYPES = [
  'game-pin', 'qr-code', 'participants-count', 'participants-list',
  'timer', 'respondents', 'answers-chart', 'leaderboard', 'question-number',
]

/** Default props and sizes for widgets when inserted from the toolbar. */
export const WIDGET_DEFAULTS = {
  'game-pin': { w: 460, h: 170, props: { showLabel: true, label: '' } },
  'qr-code': { w: 300, h: 340, props: { showLabel: true, label: '' } },
  'participants-count': { w: 320, h: 120, props: { showLabel: true, label: '' } },
  'participants-list': { w: 1100, h: 700, props: { headerText: '', showCount: true, columns: 3, maxRows: 4, avatarStyle: 'card' } },
  timer: { w: 200, h: 200, props: { variant: 'circle', label: '' } },
  respondents: { w: 200, h: 200, props: { variant: 'circle', showTotal: true, label: '' } },
  'answers-chart': { w: 1400, h: 700, props: { showValues: true, showShapes: true, barRadius: 18, showQuestion: false } },
  leaderboard: { w: 1100, h: 760, props: { count: 5, variant: 'list', showAvatar: true, showScore: true } },
  'question-number': { w: 380, h: 80, props: { label: '' } },
}

export const FRAMES = ['none', 'rounded', 'circle', 'squircle', 'hexagon', 'diamond', 'star', 'heart', 'blob', 'arch', 'triangle']
export const SHAPES = ['rect', 'ellipse', 'triangle', 'diamond', 'star', 'hexagon', 'arrow', 'line', 'speech', 'heart']

/** Google Fonts loaded in index.html. `he` marks Hebrew coverage. */
export const FONTS = [
  { family: 'Rubik', he: true },
  { family: 'Heebo', he: true },
  { family: 'Assistant', he: true },
  { family: 'Secular One', he: true, display: true },
  { family: 'Varela Round', he: true },
  { family: 'Frank Ruhl Libre', he: true, serif: true },
  { family: 'Suez One', he: true, display: true },
  { family: 'Karantina', he: true, display: true },
  { family: 'Amatic SC', he: true, display: true },
  { family: 'Noto Sans Hebrew', he: true },
  { family: 'Bellefair', he: true, serif: true },
  { family: 'Alef', he: true },
  { family: 'Miriam Libre', he: true },
  { family: 'Bricolage Grotesque', display: true },
  { family: 'Plus Jakarta Sans' },
  { family: 'Poppins' },
  { family: 'Montserrat' },
  { family: 'Fredoka', display: true },
  { family: 'Bangers', display: true },
  { family: 'Lilita One', display: true },
  { family: 'Playfair Display', serif: true },
  { family: 'Arial' },
  { family: 'Georgia', serif: true },
  { family: 'Impact', display: true },
]

export const FONT_SIZES = [16, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 80, 96, 112, 128, 160, 200]

export const RTL_LANGS = new Set(['he', 'ar', 'fa', 'ur'])
