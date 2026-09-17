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

## בדיקות

```bash
cd app && npm test        # בדיקות יחידה למודל (history, templates, sanitize, import, colors)
cd app && npm run build   # בנייה לפרודקציה
```

## מבנה הקוד

```
src/
├── api/            client אחיד (Bearer, חוזה שגיאות), quizzes, assets, auth
├── i18n/           he / en לממשק (שפת התוכן של השקפים נפרדת — model/content-i18n.js)
├── model/          סכמת המסמך, תבניות (layouts לכל סוג שקף), היסטוריה, סניטציה, ייבוא טקסט
├── state/          authStore, editorStore (כל שינוי במסמך עובר דרך mutate())
├── screens/        Login, Home, Editor, Preview
├── editor/
│   ├── render/     SlideRenderer + אלמנטים (text/image/shape/answer/widget) — משותף לקנבס, לתמונות ממוזערות ול-Preview
│   ├── Canvas.jsx, SelectionLayer.jsx (react-moveable), TopBar, Filmstrip, InsertBar
│   ├── text/       TextEditor (contentEditable), TextToolbar
│   ├── image/      ImageCropper, useImageUpload
│   ├── inspector/  פאנלי מאפיינים
│   └── questions/  QuestionsDrawer (עריכה מרוכזת של כל השאלות)
└── styles/         tokens, base, components, screens, editor, slide
```

## מודל הנתונים בקצרה

`Quiz { title, templateId, language, settings, slides[] }` · `Slide { type, hidden, background, elements[], question? }` ·
אלמנטים: `text` (עם `binding: "question"` לטקסט השאלה), `image` (`binding: "question-media"`), `shape`, `answer` (`index 1..4`, תוכן מ-`slide.question.answers`), `widget` (game-pin, qr-code, participants-count, participants-list, timer, respondents, answers-chart, leaderboard, question-number).
המודל מכיל כל מה שנדרש להרצת המשחק בהמשך (תשובה נכונה, זמנים, רכיבים דינמיים) — ראו SPEC סעיפים 6, 8, 9.
