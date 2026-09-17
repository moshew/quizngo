# תוכנית מימוש: QuizNGO Studio (`app/`)

מבוסס על [SPEC.md](SPEC.md). כל שלב מסתיים במצב שניתן לבנות (`npm run build`) ולהריץ.
סטטוס: `[ ]` לא התחיל · `[~]` בעבודה · `[x]` הושלם.

## שלב 0 — תשתית (Scaffolding)

- [x] `app/package.json`, `vite.config.js` (port 3004, base `/app/`, proxy `/api` → 5020), `index.html` (גופנים, RTL), `install.sh`, `start.sh`, `.gitignore`, `.env.example`.
- [x] `src/styles/tokens.css` — טוקני Magenta Party + טוקני chrome לעורך (כהה/נקי).
- [x] `src/styles/base.css`, `components.css` — reset, טיפוגרפיה, כפתורים, שדות, מודלים, Toast, Tooltip.
- [x] `src/i18n/` — `he.js`, `en.js`, `index.js` (`t`, `useI18n`, שמירה ב-localStorage, `dir`).
- [x] `src/api/client.js` — fetch אחיד, Bearer token, חוזה שגיאות (FR-17).
- [x] `src/router.jsx` — ראוטר קטן מבוסס History API: `/login`, `/`, `/edit/:id`, `/preview/:id`.
- [x] `src/state/authStore.js` — משתמש/טוקן; `useStore` על בסיס `useSyncExternalStore`.
- [x] חילוץ רקע `classic-black` מ-`add-in/assets/templates/classic.black.bin` אל `app/public/templates/classic-black-bg.png`; העתקת `logo.png`.

## שלב 1 — שרת האפליקציה (`app/server`)

- [x] `server.py` — Flask app factory, CORS, רישום blueprints, `GET /api/health`, הרצה על 5020.
- [x] `db.py` — SQLite (users, sessions, quizzes, assets), יצירת סכמה בעלייה, עזרי JSON.
- [x] `auth/providers.py` — `AuthProvider` בסיס, `DevProvider`; `auth/session.py` — יצירת/אימות token, decorator `require_auth`.
- [x] `routes/auth_routes.py` — login / me / logout.
- [x] `routes/quiz_routes.py` — list / create / get / update (revision, 409) / delete / duplicate; חישוב `slideCount`, `questionCount`, `cover`.
- [x] `routes/asset_routes.py` — upload (בדיקת MIME/magic/גודל, Pillow למידות), serve.
- [x] `utils/response.py` — `success(...)`, `error(message, code)`.
- [x] `requirements.txt`, `install.sh`, `start.sh`, `README.md`.
- [x] בדיקת עשן: login → create → list → update → 409 → duplicate → upload → delete.

## שלב 2 — מודל ותבניות (`src/model`)

- [x] `ids.js` — מזהים קצרים.
- [x] `constants.js` — גודל שקף 1920×1080, צבעי/צורות תשובות קנוניים, סוגי שקפים, גופנים.
- [x] `schema.js` — factories: `createQuiz`, `createSlide`, `createText`, `createImage`, `createShape`, `createAnswer`, `createWidget`; `normalizeQuiz` (מיגרציה/השלמת ברירות מחדל); עזרי שאלה (`ensureQuestion`, `questionSlides`, `previousQuestionFor`).
- [x] `sanitize.js` — סניטציה של HTML לטקסט עשיר (allowlist).
- [x] `templates/index.js` + `templates/{magenta,classicBlack,ocean,sunset,minimal}.js` — פלטה, גופנים, רקעים, layouts לכל סוג שקף, `applyTemplate(quiz, templateId)`.
- [x] `history.js` — undo/redo stack עם coalescing לפעולות רצופות.
- [x] `sample.js` — נתוני דמה ל-widgets (משתתפים, ניקוד, התפלגות).

## שלב 3 — מסכים: Login, Home, Preview

- [x] `screens/LoginScreen.jsx` — טופס Dev, ברנד, שגיאות.
- [x] `screens/HomeScreen.jsx` — גריד כרטיסים עם thumbnail חי, חיפוש/מיון, פעולות, מצבי loading/empty/error, מודל תבניות, שינוי שם, אישור מחיקה.
- [x] `components/` — `Button`, `IconButton`, `Modal`, `Menu`, `Toast`, `Tooltip`, `Field`, `Icon` (SVG inline).
- [x] `screens/PreviewScreen.jsx` — מצגת 16:9, ניווט, דילוג על מוסתרים, נתוני דמה, מקש `c`.

## שלב 4 — רנדור שקף (`src/editor/render`)

- [x] `SlideRenderer.jsx` — רקע + אלמנטים לפי סדר; props: `slide`, `quiz`, `scale`, `mode: "edit"|"thumb"|"preview"`, `liveData?`.
- [x] `elements/TextView.jsx`, `ImageView.jsx` (crop/frame/filters/border/shadow), `ShapeView.jsx` (SVG), `AnswerView.jsx` (צבע קנוני, צורה, טקסט+תמונה, ✓), `WidgetView.jsx` (game-pin, qr-code, participants-count, participants-list, timer, respondents, answers-chart, leaderboard, question-number).
- [x] `frames.js` — clip-path לכל מסגרת; `shapes.js` — paths לצורות.

## שלב 5 — מעטפת העורך

- [x] `state/editorStore.js` — מסמך + היסטוריה + בחירה + זום + מצב עריכה; פעולות: slides (add/dup/delete/reorder/hide/setType), elements (add/update/remove/reorder/duplicate/align), question (setText/setAnswer/setCorrect/setMedia/setTime), settings, template.
- [x] `screens/EditorScreen.jsx` — פריסה: TopBar / Filmstrip / CanvasArea / Inspector; טעינה ושמירה (`useAutosave`, revision, 409, טיוטה מקומית).
- [x] `editor/TopBar.jsx` — שם, מצב שמירה, undo/redo, שאלות, הגדרות, תצוגה מקדימה, הפעל (בקרוב), משתמש/שפה.
- [x] `editor/Filmstrip.jsx` — thumbnails חיים (lazy), בחירה, גרירה לשינוי סדר, תפריט הקשר, "+ שקף" עם בוחר סוג.
- [x] `editor/InsertBar.jsx` — טקסט / תמונה / צורה (תפריט) / רכיב דינמי (תפריט) / רקע.

## שלב 6 — קנבס ואינטראקציה

- [x] `editor/Canvas.jsx` — זום/fit, גלילה, marquee, לחיצה על רקע = בחירת שקף, drop של תמונות, paste.
- [x] `editor/SelectionLayer.jsx` — `react-moveable`: drag/resize/rotate/snap/guidelines, ריבוי בחירה, keepRatio, מידות בזמן resize.
- [x] `editor/useEditorShortcuts.js` — קיצורי מקלדת (FR-05).
- [x] `editor/ContextMenu.jsx` — תפריט הקשר לאלמנט/לשקף.

## שלב 7 — עריכת אלמנטים

- [x] `editor/text/TextEditor.jsx` — contentEditable inline, `TextToolbar.jsx` צף (גופן/גודל/סגנון/צבע/יישור/כיוון/רשימה), סניטציה בשמירה, autoFit.
- [x] `editor/image/ImageCropper.jsx` — מצב חיתוך; `useImageUpload.js` — הקטנה בצד לקוח + העלאה + placeholder החלפה.
- [x] `editor/inspector/` — `SlidePanel`, `TextPanel`, `ImagePanel`, `ShapePanel`, `AnswerPanel`, `WidgetPanel`, `CommonPanel` (מיקום/גודל/סיבוב/שקיפות/נעילה/שכבות), `ColorInput` (פיקר + פלטת תבנית + שקיפות), `BackgroundPanel` (צבע/גרדיאנט/תמונה).

## שלב 8 — שאלות ותוצאות

- [x] `editor/questions/QuestionsDrawer.jsx` — טופס bulk (FR-10) + פעולות רוחביות + ייבוא מטקסט.
- [x] הוספת שקפי `statistics`/`leaderboard` אחרי שאלה / אחרי כל השאלות; `leaderboard.count`.
- [x] `editor/SettingsDialog.jsx` — FR-15 כולל "החל תבנית".

## שלב 9 — ליטוש ותיעוד

- [x] Toasts, מצבי ריק/שגיאה, מיקרו-אנימציות, tooltips, בדיקת RTL/LTR.
- [x] `app/README.md`, עדכון [AGENTS.md](../AGENTS.md) (קישור לאיפיון, פורטים), `.vscode/tasks.json` (install/start ל-`app` ול-`app/server`), `.gitignore` בשורש.
- [x] `npm run build` נקי; בדיקת עשן API; בדיקת שמירה/טעינה מקצה לקצה.

## גרסה 1.1 — פישוט העורך + תבניות מעוצבות ([SPEC §16](SPEC.md))

### שלב 10 — מנוע Skins ועיטורים (FR-18)
- [x] `model/constants.js` — `SCHEMA_VERSION = 2`, `QUESTION_LAYOUTS`, גופן `Space Mono`; `index.html` — טעינת Space Mono.
- [x] `model/schema.js` — ברירות מחדל של סגנון תשובה/widget הופכות ל-`null` ("לפי התבנית"); `slide.layout`; `background.decor`.
- [x] `model/fit.js` — `fitFontSize()` דטרמיניסטי לטקסט שאלה ותשובות.
- [x] `editor/render/SlideDecor.jsx` + `styles/skins/decor.css` — שכבות העיטור של שתי המשפחות (כולל קונפטי בסיכום, אנימציות רק ב-preview).
- [x] `editor/render/SlideRenderer.jsx` — מחלקות `skin-*/theme-*/type-*`, הזרקת טוקנים כ-CSS variables, רינדור `SlideDecor`.
- [x] `AnswerView.jsx` / `WidgetView.jsx` — markup סמנטי אחד לכל רכיב, overrides בלבד כ-inline style; `TextView.jsx` — כיווץ אוטומטי לטקסט שאלה.
- [x] `styles/skins/chunky.css`, `styles/skins/neon.css` — תשובות + 9 widgets (join-card, QR, משתתפים, טיימר, עונים, מספר שאלה, גרף, מובילים, פודיום).

### שלב 11 — תבניות ופריסות (FR-03, FR-19)
- [x] `model/templates/layouts.js` — פריסות משותפות לפי הגיאומטריה של העיצובים/PPTX: פתיחה, שאלה ×4 (`text`/`banner`/`side`/`image-answers`), התפלגות, מובילים, מעבר, סיכום; שיקוף RTL.
- [x] `model/templates/{magenta,midnight,sunset,ocean,classicBlack,minimal}.js` — skin + טוקנים + רקע + decor + גופנים לכל שפה.
- [x] `model/templates/index.js` — `createSlideFromTemplate(quiz, type, {layout})`, `applyTemplate` שומר `slide.layout`, `setSlideLayout()`.
- [x] `model/migrate.js` — `upgradeQuiz()` (v1→v2) + שימוש בעורך, ב-Preview ובספרייה (cover).
- [x] `state/editorStore.js` — `setQuestionLayout`, אוטומציית פריסה בהוספת/הסרת תמונת שאלה, `resetElementStyle`, `resetBackground`.
- [x] `components/TemplatePicker.jsx` — כרטיס עם שקף ראשי + 3 קטנים; מצב "החל" על תוכן החידון; `TemplateSwitcher` משותף לסרגל העליון ולהגדרות.
- [x] `tests/model.test.mjs` — 6 תבניות × 4 פריסות בתוך הקנבס, שמירת תוכן בהחלפת פריסה/תבנית, מיגרציה v1→v2, `fitFontSize`.

### שלב 12 — פישוט העורך (FR-04, FR-20)
- [x] `editor/TopBar.jsx` — 8 פקדים + תפריט ⋯; "תצוגה מקדימה" כפעולה ראשית; כפתור "תבנית".
- [x] `editor/InsertBar.jsx` — 4 פקדים, גריד צורות; הסרת "תשובה"/"רקע".
- [x] `editor/inspector/controls.jsx` — `Section` מתקפל עם זיכרון ב-localStorage.
- [x] `editor/inspector/QuestionForm.jsx` — טופס השאלה + בוחר פריסה + "אחרי השאלה" + "החזר תשובה חסרה".
- [x] `editor/inspector/panels.jsx` + `Inspector.jsx` — תוכן גלוי, "עיצוב" ו"מיקום וגודל" מקופלים, פעולות מהירות בכותרת, "אפס לסגנון התבנית".
- [x] `editor/text/TextToolbar.jsx` — גרסה מקוצרת + "עוד"; `Canvas.jsx` — תפריט הקשר מקוצר, סרגל זום של 3 פקדים, רמז פתיחה חד-פעמי.
- [x] `i18n/he.js`, `i18n/en.js` — מחרוזות חדשות; עדכון שמות/תיאורי תבניות.

### שלב 13 — אימות
- [x] `npm test` (19 בדיקות), `npm run build`.
- [x] סיור Playwright: 6 תבניות × כל סוגי השקפים × (he, en) דרך `/app/gallery`, 4 פריסות שאלה + Undo, החלפת תבנית, Preview, מיגרציה של חידון קיים (קריאה בלבד), כל הפאנלים/מקטעים/תפריטים/דיאלוגים — 0 שגיאות קונסול.
- [x] FR-20: תשובה נבחרת = 32 פקדים גלויים במסך (קודם ~61), 8 בפאנל הימני (קודם ~33).
- [x] תיקון באג גרירה משלב א' שנחשף בסיור: לחיצה על רכיב לא-נבחר השאירה אותו "דבוק" לסמן (Moveable ביטל את ה-`pointerdown` ולכן לא קיבל `mouseup`). כעת הגרירה המתוכנתת מתחילה מ-`mousedown`, רק כשהבחירה השתנתה בלחיצה הזו, וגם בלחיצה ראשונה.
- [x] בדיקה חיה ב-https://quizngo.online/app/ (ללא שינוי nginx).
- [x] עדכון `README.md`.

## שלבים עתידיים (מחוץ להיקף שלב א')

- SSO (OIDC provider), הרשאות ברמת חידון.
- הפעלת משחק מתוך האפליקציה: מסך Host עם `SlideRenderer` + `liveData`, חיבור ל-`srv-lb`/`srv`, ניווט לפי `SLIDE_NAVIGATION_LOGIC`.
- יצירת חידון באמצעות LLM.
- ייצוא PPTX / PDF, אנימציות.
