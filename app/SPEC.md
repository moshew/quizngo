# איפיון: QuizNGO Studio — אפליקציית Web ליצירה ועריכה של חידונים

תאריך: 17 בספטמבר 2026
גרסה: 1.0 (שלב א' — עורך בלבד)
תיקייה: `app/`

## 1. מטרה

אפליקציית Web מודרנית שמחליפה לחלוטין את PowerPoint + ה-Add-in כסביבת היצירה של חידוני QuizNGO.
המשתמש מתחבר, רואה את כל החידונים שנכתבו עד כה, יוצר חידון חדש מתבנית מוכנה, ועורך את שקפי החידון בחוויית עריכה
עשירה בסגנון PowerPoint / Canva — עיצוב טקסט מלא, תמונות עם מסגרות וחיתוך, צורות, ורכיבים דינמיים של המשחק.

בשלב זה ממומש **העורך בלבד**. הפעלת המשחק והניהול החי יתווספו בהמשך ישירות באפליקציה (ללא PowerPoint וללא `admin`),
ולכן מודל הנתונים חייב להיות "מוכן להרצה" (ראו סעיף 9).

## 2. השראה ומקורות

- **Kahoot** — מבנה שאלה עם 4 תשובות בצבעים/צורות קנוניים (▲ אדום, ◆ כחול, ● צהוב, ■ ירוק), טיימר, מסך לובי, התפלגות תשובות, מובילים.
- **Canva** — קנבס חופשי, בחירת אלמנטים, גרירה/שינוי גודל/סיבוב, מסגרות לתמונות, סרגל טקסט צף, פאנל מאפיינים, תבניות.
- **PowerPoint Add-in הקיים** — סוגי השקפים, הרכיבים הדינמיים (tags), ההגדרות והלוגיקה של המשחק. ראו [add-in/modules/README.md](../add-in/modules/README.md), [instructions/DYNAMIC_BUTTONS_TAGS_GUIDE.md](../instructions/DYNAMIC_BUTTONS_TAGS_GUIDE.md), [instructions/SLIDE_NAVIGATION_LOGIC.md](../instructions/SLIDE_NAVIGATION_LOGIC.md).
- **שפת העיצוב של QuizNGO** — "Magenta Party": [game/new_design/README.md](../game/new_design/README.md), [game/new_design/src/tokens.css](../game/new_design/src/tokens.css).

## 3. גבולות והיקף

### In Scope (שלב א')

- התחברות (Dev provider: אימייל + שם) עם שכבת ספקים הניתנת להחלפה ל-SSO.
- ספריית חידונים משותפת: צפייה, חיפוש, מיון, יצירה, שכפול, שינוי שם, מחיקה.
- יצירת חידון מתבנית מוכנה (5 תבניות) ושינוי תבנית לחידון קיים.
- עורך שקפים מלא: קנבס, סרט שקפים, פאנל מאפיינים, סרגלי כלים, Undo/Redo, זום, קיצורי מקלדת, תפריט הקשר.
- אלמנטים: טקסט עשיר, תמונה (העלאה/הדבקה/גרירה, חיתוך, מסגרות, סיבוב, היפוך, פילטרים, גבול, צל), צורות, כרטיסי תשובה, רכיבים דינמיים.
- עריכת שאלות בשתי דרכים: עיצוב ידני על הקנבס, או טופס לכל השאלות במקביל (bulk).
- תשובה = טקסט, או תמונה עם טקסט. 4 תשובות בלבד. תשובה נכונה אחת.
- הוספת שקף "התפלגות תשובות" ושקף "מובילים עד כאן" (5 מובילים) אחרי שאלה — ידנית או לכל השאלות.
- כל הרכיבים הדינמיים שמומשו ב-PowerPoint (טבלת מיפוי בסעיף 8).
- הגדרות חידון: זמן מענה, השהיית שעון, שפה.
- תצוגה מקדימה (Preview) של השקפים כמצגת, עם נתוני דמה ברכיבים הדינמיים.
- שמירה אוטומטית לשרת + חיווי מצב שמירה.
- ממשק בעברית (RTL) ובאנגלית (LTR), עם תשתית להוספת שפות.

### Out of Scope (שלב א')

- הפעלת משחק חי, חיבור לשרתי `srv`/`srv-lb`, WebSocket, ניקוד בזמן אמת.
- SSO אמיתי (ממומש ספק Dev בלבד; החוזה מוכן).
- יצירת חידון באמצעות LLM (יוגדר כפעולה עתידית בממשק, לא ממומש).
- ייצוא/ייבוא PPTX.
- אנימציות ומעברי שקפים מותאמים אישית.
- שיתוף/הרשאות ברמת חידון (כל המשתמשים המחוברים רואים ועורכים את כל החידונים).

## 4. שחקנים

- **יוצר חידון (Author)** — מתחבר, יוצר ועורך חידונים.
- **צופה בספרייה** — כל משתמש מחובר רואה את כל החידונים.
- **שרת האפליקציה (`app/server`)** — מקור האמת לחידונים, נכסי תמונה ומשתמשים.
- **(עתידי) שרת המשחק** — יצרוך את מודל החידון להרצה.

## 5. ארכיטקטורה

```
app/                      React 18 + Vite 5 (port 3004, base /app/)
├── src/
│   ├── api/              שכבת client אחידה ל-REST
│   ├── i18n/             he / en
│   ├── model/            סכמת חידון, factories, תבניות, היסטוריה (undo/redo)
│   ├── state/            stores (auth, editor) — useSyncExternalStore, ללא תלות חיצונית
│   ├── screens/          Login, Home (ספרייה), Editor, Preview
│   ├── editor/           Canvas, SlideRenderer, Elements, Filmstrip, Inspector, Toolbars, QuestionForm...
│   ├── components/       רכיבי UI כלליים
│   └── styles/           tokens + base + components
└── server/               Flask + SQLite (port 5020)
    ├── server.py
    ├── auth/             providers.py (DevProvider עכשיו, OIDCProvider בהמשך)
    ├── routes/           auth_routes.py, quiz_routes.py, asset_routes.py
    └── data/             quizngo_app.db + assets/  (gitignored)
```

עקרונות:
- הפרדה מלאה בין UI לשכבת API Client (כמו ב-`dashboard`).
- ה-Vite dev server מפנה `/api` ל-`http://localhost:5020` (כמו בשאר האפליקציות).
- החוזה עם השרת: `status: "success" | "error"`, `message`, payload — לפי מוסכמות המאגר.
- הקנבס מבוסס DOM (לא `<canvas>` bitmap): הרנדרר `SlideRenderer` משמש גם לקנבס, גם לתמונות הממוזערות בסרט השקפים, גם ל-Preview וגם (בעתיד) למסך ההרצה. מערכת קואורדינטות לוגית של **1920×1080** ומתיחה ב-`transform: scale()`.

## 6. ישויות נתונים

### User
- `id: string`, `email: string`, `name: string`, `provider: "dev" | "oidc"`, `createdAt: iso`

### Quiz (מסמך JSON שלם, נשמר בשדה `data`)
```
Quiz {
  id: string
  title: string
  description?: string
  templateId: string                 // תבנית שממנה נוצר / הוחלה לאחרונה
  language: "he" | "en" | ...        // שפת התוכן (קובעת dir ברירת מחדל לטקסטים)
  settings: {
    questionWaitTime: number         // ברירת מחדל 30 (5..300)
    clockActivationDelay: number     // ברירת מחדל 5 (0..60)
    leaderboardSize: number          // ברירת מחדל 5
  }
  slides: Slide[]
  schemaVersion: 1
}
```

### Slide
```
Slide {
  id: string
  type: "opening" | "question" | "statistics" | "leaderboard" | "transition" | "summary"
  hidden: boolean                    // דילוג בזמן משחק (כמו isHidden ב-PowerPoint)
  background: { kind: "color" | "gradient" | "image", color?, gradient?: {angle, stops[]}, src?, overlay? }
  elements: Element[]                // סדר המערך = סדר שכבות (אחרון = עליון)
  question?: Question                // רק ל-type === "question"
  notes?: string
}
```

### Question
```
Question {
  text: string                       // טקסט השאלה (מקור האמת; אלמנט טקסט עם binding "question" מציג אותו)
  media?: { src: string } | null     // תמונת שאלה אופציונלית
  answers: [Answer, Answer, Answer, Answer]
  correctAnswer: 1 | 2 | 3 | 4       // 1-based, תואם PowerPoint ולשרת (correctAnswer)
  timeLimit?: number | null          // override ל-settings.questionWaitTime
}
Answer { text: string, image?: { src: string } | null }
```

### Element (בסיס משותף)
```
ElementBase {
  id: string
  kind: "text" | "image" | "shape" | "answer" | "widget"
  name?: string
  x, y, w, h: number                 // ביחידות לוגיות (1920×1080)
  rotation: number                   // מעלות
  opacity: number                    // 0..1
  locked: boolean
  hidden: boolean
}
```

- **TextElement**: `html: string` (HTML מסונן, allowlist), `binding?: "question" | null`,
  `style: { fontFamily, fontSize, color, align: "start"|"center"|"end", valign: "top"|"middle"|"bottom", lineHeight, letterSpacing, direction: "auto"|"rtl"|"ltr", padding, background, borderRadius, border, shadow, textShadow, autoFit }`.
- **ImageElement**: `src`, `binding?: "question-media" | null`, `crop: { x, y, w, h }` (חלקים 0..1 של התמונה המקורית), `frame: "none"|"rounded"|"circle"|"squircle"|"hexagon"|"diamond"|"star"|"heart"|"blob"|"arch"|"triangle"`, `border: { width, color }`, `shadow`, `flipH`, `flipV`, `filters: { brightness, contrast, saturate, blur, grayscale, sepia }`, `borderRadius`, `placeholder: boolean` (ריק — מוצג כאזור "הוסף תמונה").
- **ShapeElement**: `shape: "rect"|"ellipse"|"triangle"|"diamond"|"star"|"hexagon"|"arrow"|"line"|"speech"|"heart"`, `fill`, `stroke: { width, color, dash }`, `borderRadius`, `shadow`.
- **AnswerElement**: `index: 1..4` (קשור ל-`slide.question.answers[index-1]`), `style: { variant: "card"|"pill"|"flat", showShape, showIndex, fontFamily, fontSize, color, background (ברירת מחדל צבע קנוני), borderRadius, border, shadow, imagePosition: "top"|"start"|"cover" }`. תוכן התשובה (טקסט/תמונה) מגיע מהשאלה; עריכה inline על הכרטיס מעדכנת את `question.answers`.
- **WidgetElement**: `widget: WidgetType`, `props: object` (לכל widget), `style: object`. ראו סעיף 8.

### Asset
- `id`, `ownerId`, `filename`, `mime`, `size`, `width`, `height`, `createdAt`. נגיש ב-`GET /api/assets/{id}`.

## 7. דרישות פונקציונליות

### FR-01: התחברות
- מסך התחברות ממותג (לוגו, רקע ברנד). טופס: אימייל + שם תצוגה (Dev provider).
- `POST /api/auth/login` מחזיר token; נשמר ב-`localStorage`; נשלח כ-`Authorization: Bearer`.
- `GET /api/auth/me` בעליית האפליקציה; token לא תקין → ניתוב ל-`/login`.
- ספק ההתחברות בשרת מוגדר ב-`AUTH_PROVIDER` (`dev` כרגע). ממשק `AuthProvider.authenticate(payload) -> UserIdentity` מאפשר הוספת OIDC בלי לשנות את ה-routes.
- התנתקות מבטלת את ה-session בשרת.

### FR-02: ספריית חידונים (Home)
- גריד כרטיסים: תמונה ממוזערת חיה של השקף הראשון (רנדור `SlideRenderer` מוקטן), כותרת, מספר שאלות/שקפים, עודכן לפני X, יוצר.
- חיפוש חופשי בכותרת, מיון (עודכן לאחרונה / א-ב / נוצר).
- פעולות לכרטיס: ערוך, תצוגה מקדימה, שכפל, שנה שם, מחק (עם אישור). "הפעל משחק" מוצג כ-**בקרוב** (מושבת).
- כפתור "חידון חדש" פותח בוחר תבניות (FR-03). "צור עם AI" מוצג כ-בקרוב.
- מצבי `loading`, `empty` (מסך ריק מעוצב עם קריאה לפעולה), `error`.

### FR-03: תבניות
- 5 תבניות מובנות: `magenta-party` (ברנד), `classic-black` (זהב/שחור, רקע מתוך תבנית ה-PowerPoint הקיימת), `ocean`, `sunset`, `minimal-light`.
- תבנית = פלטה + גופנים + רקעים + **layout לכל סוג שקף** (פונקציה שמייצרת אלמנטים ב-1920×1080).
- חידון חדש מתבנית מכיל: פתיחה, שאלה לדוגמה, התפלגות, מובילים, סיכום.
- הוספת שקף חדש משתמשת ב-layout של התבנית הנוכחית של החידון.
- "החל תבנית" על חידון קיים: מחליף רקעים וסגנון של אלמנטים בעלי `binding`/`answer`/`widget` ושומר את תוכן השאלות; אלמנטים חופשיים נשמרים כפי שהם (עם אישור המשתמש).

### FR-04: עורך — מבנה מסך
- **סרגל עליון**: חזרה לספרייה, שם החידון (עריכה inline), מצב שמירה (נשמר / שומר... / שגיאה), Undo/Redo, "שאלות" (טופס bulk), "הגדרות", "תצוגה מקדימה", "הפעל" (בקרוב), משתמש.
- **סרט שקפים** (צד התחלה): תמונות ממוזערות חיות, מספר, תג סוג שקף בצבע, סמן "מוסתר", בחירה, גרירה לשינוי סדר, תפריט הקשר (שכפל, מחק, הסתר/הצג, שנה סוג, הוסף התפלגות/מובילים אחרי).
- **כפתור "+ שקף"**: בוחר סוג שקף עם תצוגה מקדימה של ה-layout.
- **קנבס**: שקף במרכז עם צל, זום (Fit / 25%–400% / גלגלת+Ctrl), רולרים לא נדרשים, קווי הצמדה (snap) למרכז/קצוות השקף ולאלמנטים אחרים.
- **סרגל הוספה** (צד סוף או מעל הקנבס): טקסט, תמונה, צורה, רכיב דינמי (תפריט), רקע.
- **פאנל מאפיינים (Inspector)**: משתנה לפי הבחירה: שקף (סוג, רקע, מוסתר, הגדרות שאלה), טקסט, תמונה, צורה, תשובה, widget. כולל מיקום/גודל/סיבוב/שקיפות/נעילה ושכבות.

### FR-05: קנבס — אינטראקציה
- בחירה בלחיצה, ריבוי בחירה ב-Shift/ Ctrl, בחירת מסגרת (marquee) על אזור ריק, `Ctrl+A`.
- גרירה, שינוי גודל מ-8 ידיות (שמירת יחס ב-Shift; תמונות שומרות יחס כברירת מחדל), סיבוב מידית סיבוב (הצמדה ל-15° ב-Shift).
- חצים להזזה ב-1 יח' (Shift = 10), `Delete`, `Ctrl+D` שכפול, `Ctrl+C/V/X`, `Ctrl+Z/Y`, `Esc` ביטול/יציאה מעריכת טקסט, `Enter` על טקסט = עריכה.
- תפריט הקשר: העתק/הדבק/שכפל/מחק, שכבות (קדימה/אחורה/לחזית/לאחור), יישור לשקף (מרכז אופקי/אנכי), נעילה, הפוך תמונה.
- קווי הצמדה בזמן גרירה ו-resize; הצגת מידות בזמן resize.
- לחיצה כפולה על טקסט/תשובה → עריכת טקסט inline; על תמונה → מצב חיתוך.
- כל שינוי נרשם להיסטוריה (Undo/Redo עד 100 צעדים; פעולות רצופות של גרירה מאוחדות לצעד אחד).

### FR-06: טקסט עשיר
- סרגל טקסט צף בזמן עריכה: גופן (רשימת גופנים עם תמיכה בעברית + Latin display), גודל (+/-, קלט חופשי), Bold/Italic/Underline/Strike, צבע, הדגשת רקע, יישור (start/center/end/justify), רשימה, גובה שורה, ריווח אותיות, כיוון (auto/rtl/ltr), ניקוי עיצוב.
- עיצוב ברמת בחירה (spans) וברמת אלמנט (ברירת מחדל).
- תיבת טקסט: מילוי רקע, גבול, רדיוס, ריפוד, צל, `autoFit` (הגדלת גובה אוטומטית לפי תוכן).
- ה-HTML נשמר לאחר סניטציה (allowlist: `b,i,u,s,br,div,p,span,ul,ol,li` ו-`style` עם מאפיינים מותרים בלבד).

### FR-07: תמונות
- הוספה: העלאת קובץ, גרירה לקנבס, הדבקה מהלוח, URL. תמונות גדולות מוקטנות בצד הלקוח (עד 2048px) לפני העלאה. פורמטים: png/jpg/webp/gif/svg.
- מצב חיתוך (Crop): שכבת overlay עם הזזת התמונה בתוך המסגרת ושינוי גודל המסגרת; אישור/ביטול; שמירה כ-`crop {x,y,w,h}` יחסי.
- מסגרות (clip-path): none, rounded, circle, squircle, hexagon, diamond, star, heart, blob, arch, triangle.
- גבול (עובי/צבע), צל, שקיפות, היפוך אופקי/אנכי, פילטרים (בהירות/קונטרסט/רוויה/טשטוש/שחור-לבן/ספיה), החלפת תמונה, "התאם לשקף כרקע".
- Placeholder לתמונה חסרה (למשל `question-media` ריק): מסגרת מקווקוות עם אייקון "הוסף תמונה"; לא מוצג ב-Preview.

### FR-08: צורות
- מלבן (רדיוס), אליפסה, משולש, מעוין, כוכב, משושה, חץ, קו, בועת דיבור, לב. מילוי (צבע/גרדיאנט), קו מתאר (עובי/צבע/מקווקו), צל.

### FR-09: שקף שאלה
- אלמנטים בעלי binding: טקסט שאלה (`binding: "question"`), תמונת שאלה (`binding: "question-media"`), 4 כרטיסי תשובה (`answer index 1..4`), widgets: טיימר, מספר עונים, מספר שאלה.
- סימון תשובה נכונה: על הקנבס (סמן ✓ על הכרטיס בבחירה / בפאנל), ובטופס. תמיד בדיוק תשובה נכונה אחת.
- תשובה יכולה להיות טקסט בלבד או תמונה + טקסט; כרטיס ללא טקסט וללא תמונה מסומן כריק (מותר, אך Preview מציג אזהרה).
- מחיקת אלמנט קשור (למשל כרטיס תשובה 3) מהקנבס אפשרית; ניתן להחזירו מ"הוסף רכיב" → "תשובה 3". נתוני השאלה נשמרים במודל גם ללא אלמנט.
- `timeLimit` פר שאלה (override) בפאנל השקף.

### FR-10: טופס שאלות (Bulk)
- מגירה/מסך צד המציגה את כל שקפי השאלה ברשימה: מספר, טקסט שאלה, 4 תשובות (טקסט + תמונה), בחירת נכונה, זמן, תמונת שאלה, תצוגה ממוזערת.
- הוספת שאלה חדשה (בסוף / אחרי), מחיקה, שכפול, שינוי סדר בגרירה.
- פעולות רוחביות: "הוסף שקף התפלגות אחרי כל שאלה", "הוסף שקף מובילים אחרי כל שאלה", "הסר שקפי תוצאות", "קבע זמן לכל השאלות", "ייבוא מטקסט" (פורמט פשוט: שורת שאלה, 4 שורות תשובה, סימון `*` לנכונה, שורה ריקה מפרידה).
- שינויים בטופס משתקפים מיידית בקנבס ולהיפך (מקור אמת יחיד: `slide.question`).

### FR-11: שקפי תוצאות
- **התפלגות תשובות** (`statistics`): widget `answers-chart` — 4 עמודות בצבעים הקנוניים, ערכים, אייקוני צורה; נתוני דמה ב-Preview. מקור הנתונים בזמן משחק: השאלה הקודמת הקרובה ביותר בסדר השקפים.
- **מובילים עד כאן** (`leaderboard`): widget `leaderboard` עם `count` (ברירת מחדל 5, טווח 1..10), מציג מקום, אווטאר, שם, ניקוד; סגנון שורות מהתבנית.
- הוספה: מהסרט (אחרי השקף הנוכחי), מהטופס, או מבוחר "+ שקף".

### FR-12: רכיבים דינמיים (Widgets)
- ניתנים להוספה לכל שקף (כמו ב-PowerPoint, "תג" אחד = עדכון בכל המופעים).
- כל widget מציג ערך דמה בעריכה (`123-456`, `24`, QR לדוגמה, `30`...) ומקבל סגנון (גופן, צבע, רקע, רדיוס, גבול).
- הטבלה המלאה בסעיף 8.

### FR-13: תצוגה מקדימה
- מסך מלא, 16:9 ממורכז, ניווט חצים/לחיצה/מקלדת, ESC לחזרה, מד התקדמות, סימון שקפים מוסתרים (מודלגים), ערכי דמה ב-widgets, סימון התשובה הנכונה בלחיצה על מקש `c`.
- זמין מהעורך ומהספרייה (`/preview/:id`).

### FR-14: שמירה
- שמירה אוטומטית 1.5 שניות אחרי השינוי האחרון, ובעת עזיבת המסך/הסתרת הטאב.
- חיווי מצב: "כל השינויים נשמרו" / "שומר..." / "שגיאה בשמירה — נסה שוב" (עם כפתור).
- `PUT /api/quizzes/{id}` עם `revision` (מספר רץ). התנגשות (409) → הודעה עם אפשרות "טען מהשרת" / "שמור בכל זאת".
- טיוטה מקומית ב-`localStorage` כגיבוי לשגיאת רשת; משוחזרת בהודעה בכניסה הבאה לעורך.

### FR-15: הגדרות חידון
- דיאלוג: שם, תיאור, שפת תוכן, זמן מענה (5..300), השהיית שעון (0..60), גודל טבלת מובילים (1..10), תבנית (החל תבנית).

### FR-16: i18n ו-RTL
- ממשק: `he` (ברירת מחדל, RTL) ו-`en` (LTR). בחירה נשמרת ב-`localStorage`. מבנה `i18n/he.js`, `i18n/en.js` עם `t(key, params)`.
- כיוון טקסט באלמנטים: `auto` (לפי תו ראשון), עם override ידני.
- כל האייקונים והפריסות מתהפכים נכון ב-RTL (`start`/`end` בלבד, ללא `left`/`right` קשיחים).

### FR-17: חוזה שגיאות בצד לקוח
- כל קריאה עוברת ב-`api/client.js`. לא-2xx או `status === "error"` → כשל. הודעה: `message` → `error` → fallback.
- שגיאות מוצגות ב-Toast; שגיאת 401 מנתבת ל-login.

## 8. מיפוי יכולות PowerPoint → Web

| PowerPoint (tag / פעולה) | Widget / מנגנון ב-Web | הערות |
|---|---|---|
| `quizngo-game-id` | `widget: "game-pin"` | מציג `123-456`; פורמט XXX-XXX |
| `quizngo-qr-code` | `widget: "qr-code"` | QR דמה בעריכה; בזמן משחק — קישור הצטרפות |
| `quizngo-participants-num` | `widget: "participants-count"` | מספר + תווית אופציונלית |
| `quizngo-content-type=participants-list` + `quizngo-header` + avatar template | `widget: "participants-list"` | props: `headerText`, `showCount`, `avatarStyle` (card/pill), `columns`, `maxRows`; דמה: 8 משתתפים |
| `quizngo-question-time` | `widget: "timer"` | variants: `circle`/`pill`/`number`; ערך = `question.timeLimit ?? settings.questionWaitTime` |
| `quizngo-respondents-count` | `widget: "respondents"` | "24 / 30" או מספר בלבד |
| `quizngo-answer-bar` + `quizngo-answer-value` | `widget: "answers-chart"` | 4 עמודות, צבעים קנוניים, `showValues`, `showShapes`, `barRadius` |
| `quizngo-leaderboard-name/score` + `leaderboard-rank` | `widget: "leaderboard"` | `count` (5 ברירת מחדל), `showAvatar`, `showScore`, `rowStyle` |
| — (חדש) | `widget: "question-number"` | "שאלה 3 / 12" |
| `slideTypeData[slideId].type` | `slide.type` | אותם שישה סוגים |
| `slideTypeData[slideId].correctAnswer` | `slide.question.correctAnswer` | 1..4 |
| `slideTypeData[slideId].isHidden` | `slide.hidden` | |
| `presentationSettings.questionWaitTime/clockActivationDelay` | `quiz.settings` | |
| `afterQuestionStatistics/afterQuestionLeaderboard` (שקף משותף) | שקפי תוצאות מוצבים אחרי שאלה | מודל פר-שאלה במקום שקף משותף; ניתן לייצר לכל השאלות בפעולה אחת |
| תבנית `classic_black` (`insertSlidesFromBase64`) | תבנית `classic-black` | הרקע חולץ מ-`classic.black.bin` |

## 9. מוכנות להרצה (Runtime-readiness)

מודל החידון צריך להספיק לשלב ההרצה העתידי ללא שינוי סכמה:
- לכל שאלה: טקסט, תשובות, נכונה, זמן.
- לכל שקף: סוג, `hidden`, רשימת widgets עם `props` — מסך ההרצה ירנדר את אותו `SlideRenderer` עם `liveData` במקום נתוני דמה.
- לוגיקת הניווט של המשחק (דילוג על מוסתרים, תוצאות אחרי שאלה) נגזרת מסדר השקפים בלבד.
- `schemaVersion` לצורך מיגרציות.

## 10. חוזה API (`app/server`, port 5020)

כל תגובה: `{ "status": "success", ...payload }` או `{ "status": "error", "message": string }`.

| Method | Path | תיאור |
|---|---|---|
| GET | `/api/health` | בריאות |
| POST | `/api/auth/login` | `{email, name}` → `{token, user}` (Dev provider) |
| GET | `/api/auth/me` | משתמש נוכחי |
| POST | `/api/auth/logout` | ביטול session |
| GET | `/api/quizzes` | `{quizzes:[{id,title,templateId,slideCount,questionCount,owner,createdAt,updatedAt,revision,cover}]}` |
| POST | `/api/quizzes` | `{title, data}` → `{quiz}` |
| GET | `/api/quizzes/{id}` | `{quiz:{...meta, data, revision}}` |
| PUT | `/api/quizzes/{id}` | `{title?, data?, revision}` → `{quiz}`; 409 בהתנגשות |
| DELETE | `/api/quizzes/{id}` | מחיקה (soft delete) |
| POST | `/api/quizzes/{id}/duplicate` | `{quiz}` |
| POST | `/api/assets` | multipart `file` → `{asset:{id,url,width,height,mime}}` |
| GET | `/api/assets/{id}` | הקובץ (Cache-Control ארוך) |

אימות: `Authorization: Bearer <token>`. כל ה-routes פרט ל-`health`, `login`, `GET assets` דורשים token.
CORS: מותר ל-origins המוגדרים ב-`APP_ALLOWED_ORIGINS` (ברירת מחדל: localhost:3004, quizngo.online).

## 11. דרישות לא פונקציונליות

- **NFR-01 ביצועים**: קנבס ב-60fps בזמן גרירה עבור שקף עם 30 אלמנטים; תמונות ממוזערות בסרט מרונדרות בעצלות (virtualized/lazy) לחידון עם 100 שקפים; טעינת ספרייה של 200 חידונים < 2s ב-LAN.
- **NFR-02 אמינות**: אין אובדן עבודה — autosave + טיוטה מקומית; כשל בהעלאת תמונה לא שובר את העריכה.
- **NFR-03 שימושיות**: RTL מלא; עבודה במקלדת; Tooltips לכל כפתור אייקון; דסקטופ ≥ 1280px (מובייל — קריא, לא לעריכה).
- **NFR-04 עיצוב**: מודרני ומרשים — שפת "Magenta Party" (ink borders, 3D shadows, Bricolage/Rubik) לסביבת האפליקציה, עם UI כרומי כהה ונקי לעורך (כדי שהשקף יבלוט). מיקרו-אנימציות עדינות (≤ 200ms). ניגודיות AA.
- **NFR-05 נגישות**: focus visible, `aria-label` לאייקונים, ניווט Tab בפאנלים.
- **NFR-06 תאימות**: Chrome/Edge/Firefox/Safari עדכניים.

## 12. אבטחה

- token אקראי (32 bytes) בטבלת `sessions`, תוקף 30 יום, מחיקה ב-logout.
- העלאות: בדיקת MIME ו-magic bytes, גודל ≤ 10MB, שם קובץ מנורמל (`uuid.ext`), הגשה עם `Content-Type` נכון ו-`X-Content-Type-Options: nosniff`; SVG מוגש כ-`image/svg+xml` רק אם עבר סניטציה בסיסית (ללא `<script>`/`on*`).
- HTML של טקסט מסונן בצד הלקוח בשמירה ובצד הרנדור.
- אין הרצת קוד מהמסמך; `dangerouslySetInnerHTML` רק לאחר סניטציה.

## 13. קריטריוני קבלה

- **AC-01**: משתמש חדש מתחבר עם אימייל ושם, מגיע לספרייה ריקה עם מסך ריק מעוצב.
- **AC-02**: יצירת חידון מתבנית מייצרת 5 שקפים; העורך נפתח על שקף הפתיחה.
- **AC-03**: הוספת טקסט, שינוי גופן/גודל/צבע, גרירה וסיבוב — נשמרים אוטומטית ומשוחזרים אחרי רענון.
- **AC-04**: העלאת תמונה, חיתוך, מסגרת עיגול, גבול וצל — נשמרים ומוצגים ב-Preview.
- **AC-05**: עריכת טקסט תשובה על הקנבס משתקפת בטופס השאלות ולהיפך.
- **AC-06**: הוספת "התפלגות אחרי כל שאלה" מייצרת שקף `statistics` אחרי כל שקף שאלה בלבד.
- **AC-07**: Undo/Redo מחזירים במדויק פעולות גרירה, מחיקה, שינוי טקסט ושינוי סדר שקפים.
- **AC-08**: שני עורכים על אותו חידון — השני מקבל הודעת התנגשות (409) ולא דורס בשקט.
- **AC-09**: החלפת שפת ממשק ל-`en` מהפכת את הפריסה ל-LTR מבלי לפגוע בכיווניות טקסטי השקף.
- **AC-10**: Preview מציג נתוני דמה בכל ה-widgets ומדלג על שקפים מוסתרים.

## 14. אילוצי מימוש

- React 18 + Vite 5 (תואם `game`/`admin`), ללא TypeScript (תואם למאגר), CSS רגיל עם tokens.
- תלויות חיצוניות מינימליות: `react`, `react-dom`, `react-moveable` (drag/resize/rotate/snap). QR דמה מרונדר ב-SVG פנימי.
- שרת: Flask + sqlite3 (stdlib), `flask-cors`, `Pillow` (מידות תמונה). ללא ORM.
- `strictPort` ב-Vite; base `/app/`; פורטים 3004 (UI) ו-5020 (API) לא מתנגשים עם הקיימים.
- `install.sh`/`start.sh` בכל תיקייה; משימות VS Code ב-`.vscode/tasks.json`.

## 15. מקורות קוד לאימות האיפיון

- `add-in/modules/core/state.js` — מבנה `slideTypeData` ו-`presentationSettings`
- `add-in/modules/elements/*.js` — הרכיבים הדינמיים והתגים
- `add-in/modules/game/navigation.js`, `scoring.js` — לוגיקת המשחק שהמודל צריך לשרת
- `game/new_design/src/tokens.css` — טוקני העיצוב
- `dashboard/SYSTEM_SPEC.md` — מוסכמות איפיון במאגר
