# QuizNGO Studio (`app/`)

אפליקציית Web ליצירה ועריכה של חידוני QuizNGO — מחליפה את PowerPoint + ה-Add-in כסביבת היצירה.
איפיון מלא: [SPEC.md](SPEC.md) · תוכנית מימוש: [PLAN.md](PLAN.md).

## מה יש כאן

- **`app/`** — React 18 + Vite 5 (פורט `3004`, base `/app/`): התחברות, ספריית חידונים, בוחר תבניות, עורך שקפים מלא (קנבס, סרט שקפים, פאנל מאפיינים, סרגל טקסט צף, חיתוך תמונות, רכיבים דינמיים), טופס שאלות, תצוגה מקדימה.
- **`app/server/`** — Flask + SQLite (פורט `5020`): משתמשים, sessions, מסמכי חידון, נכסי תמונה. ראו [server/README.md](server/README.md).

## הרצה מקומית

```bash
# API
cd app/server && ./install.sh && ./start.sh        # http://127.0.0.1:5020/api/health

# UI (טרמינל נפרד)
cd app && ./install.sh && ./start.sh               # http://127.0.0.1:3004/app/
```

או דרך משימות VS Code: `install: app`, `install: app-server`, `start: app (port 3004)`, `start: app-server (port 5020)` (כלולות גם ב-`install: ALL` / `start: ALL`).

ה-Vite dev server מפנה `/api` ל-`127.0.0.1:5020`. בפרודקציה nginx מנתב `/app/` → 3004 ו-`/api/` → 5020 (ראו [../instructions/nginx.quizngo.online.conf](../instructions/nginx.quizngo.online.conf)).

התחברות בשלב זה היא Dev provider (אימייל + שם). SSO יתחבר דרך `server/auth/providers.py`.

## תבניות ועיצוב (1.1)

- 6 תבניות בשתי משפחות עיצוב (skins): **chunky** — `magenta-party` (העיצוב המאושר; זהה ל-`game/new_design/quizngov.pptx`), `sunset`, `ocean`, `minimal-light`; **neon** — `midnight-arcade` (העיצוב המאושר), `classic-black`.
- תבנית חדשה = קובץ ב-`src/model/templates/` שמגדיר `skin`, `decor`, גופנים, פלטה ו-`vars` (טוקני CSS). המראה עצמו נמצא ב-`src/styles/skins/{chunky,neon,decor}.css`; הגיאומטריה המשותפת ב-`src/model/templates/layouts.js`. תשובות ו-widgets לא נושאים ערכי סגנון — `null` = "לפי התבנית" (SPEC FR-18).
- שקף שאלה מגיע ב-4 פריסות (`text` / `banner` / `side` / `image-answers`) שנבחרות מטופס השאלה בפאנל הימני (SPEC FR-19).
- **גלריית QA**: `/app/gallery` (דורש התחברות; פרמטרים `?t=<templateId>&lang=he|en&cols=N`) מציגה כל תבנית × סוג שקף × פריסה עם תוכן אמיתי. לא מקושרת מהממשק.
- מסמכים ישנים (`schemaVersion 1`) משודרגים בטעינה ב-`src/model/migrate.js` — התוכן נשמר, האלמנטים שבבעלות התבנית נבנים מחדש.

## בדיקות

```bash
cd app && npm test        # בדיקות יחידה למודל (history, templates, layouts, migration, fit, sanitize, import, colors)
cd app && npm run build   # בנייה לפרודקציה
```

## מבנה הקוד

```
src/
├── api/            client אחיד (Bearer, חוזה שגיאות), quizzes, assets, auth
├── i18n/           he / en לממשק (שפת התוכן של השקפים נפרדת — model/content-i18n.js)
├── model/          סכמת המסמך, תבניות (themes + layouts.js), migrate.js, fit.js, היסטוריה, סניטציה, ייבוא טקסט
├── state/          authStore, editorStore (כל שינוי במסמך עובר דרך mutate())
├── screens/        Login, Home, Editor, Preview, Gallery (QA)
├── editor/
│   ├── render/     SlideRenderer + SlideDecor + אלמנטים (text/image/shape/answer/widget) — משותף לקנבס, לתמונות ממוזערות ול-Preview
│   ├── Canvas.jsx, SelectionLayer.jsx (react-moveable), TopBar, Filmstrip, InsertBar
│   ├── text/       TextEditor (contentEditable), TextToolbar
│   ├── image/      ImageCropper, useImageUpload
│   ├── inspector/  QuestionForm (טופס השאלה + פריסות) ופאנלים מתקפלים ("עיצוב", "מיקום וגודל")
│   └── questions/  QuestionsDrawer (עריכה מרוכזת של כל השאלות)
└── styles/         tokens, base, components, screens, editor, slide + skins/ (decor, chunky, neon)
```

## מודל הנתונים בקצרה

`Quiz { title, templateId, language, settings, slides[], schemaVersion: 2 }` · `Slide { type, hidden, background{…, decor}, layout?, elements[], question? }` ·
אלמנטים: `text` (עם `binding: "question"` לטקסט השאלה או `"quiz-title"` לשם החידון), `image` (`binding: "question-media"`), `shape`, `answer` (`index 1..4`, תוכן מ-`slide.question.answers`), `widget` (game-pin, qr-code, participants-count, participants-list, timer, respondents, answers-chart, leaderboard, question-number).
המודל מכיל כל מה שנדרש להרצת המשחק בהמשך (תשובה נכונה, זמנים, רכיבים דינמיים) — ראו SPEC סעיפים 6, 8, 9.
