# מסמך איפיון מערכת Dashboard (מבוסס מימוש)

תאריך: 17 בפברואר 2026  
גרסה: 1.0 (As-Is Specification)

## 1. מטרה והיקף

מטרות המערכת:
- מתן תמונת מצב תפעולית בזמן אמת על שרתי המשחק.
- ניהול מצב שרתים דרך פעולות מנהליות (`drain` / `activate` / `remove`).
- הצגת מדדי עומס ותפעול מצטברים.
- צפייה במשחקים (PINs) פעילים/ממתינים בכל שרת.

גבולות המערכת:
- המערכת היא ממשק ניהול Frontend מבוסס React.
- נתוני המקור מגיעים מ-`srv-lb` ומקריאה ישירה לכל `srv`.
- המערכת לא מנהלת משחקים או שחקנים ישירות, אלא מציגה ומפעילה פעולות ניהול תשתית.

## 2. רכיבי מערכת

### 2.1 רכיב Dashboard (Frontend)
- מיקום: `dashboard/`
- טכנולוגיה: React 18 + Vite 5
- פורט פיתוח/Preview: `5010`
- קובץ כניסה: `dashboard/src/main.jsx`
- רכיב אפליקציה ראשי: `dashboard/src/App.jsx`
- שכבת API: `dashboard/src/api/lbApi.js`

### 2.2 רכיב Load Balancer
- מיקום: `srv-lb/`
- תפקיד: ניהול Registry של שרתים ו-PINs, חשיפת API מנהלי, וניתוב לשרת פנוי.
- API ניהולי עבור ה-Dashboard: תחת `/api/admin/*`

### 2.3 רכיבי Game Server (`srv`)
- מיקום: `srv/`
- כל שרת מדווח Heartbeat ל-LB, ורושם את עצמו בזמן עלייה.
- כל שרת חושף `/sim_gamePIN` לצפייה במשחקים שעליו.

## 3. ארכיטקטורה וזרימת מידע

```text
Dashboard (React, :5010)
  ├─ GET  LB /api/admin/servers
  ├─ GET  LB /api/admin/pins
  ├─ POST LB /api/admin/servers/{id}/drain
  ├─ POST LB /api/admin/servers/{id}/activate
  ├─ DELETE LB /api/admin/servers/{id}
  └─ GET  srv-address /sim_gamePIN

srv (N instances)
  ├─ POST LB /api/servers/register
  ├─ POST LB /api/servers/{id}/heartbeat (כל 30 שניות)
  └─ POST LB /api/servers/{id}/game-ended (best effort)

LB background jobs
  ├─ Health check כל 60 שניות
  └─ Stale PIN cleanup כל 600 שניות
```

## 4. קונפיגורציה והרצה

### 4.1 Dashboard
- פקודות:
  - `npm install`
  - `npm run dev`
- כתובת LB ברירת מחדל:
  - `VITE_LB_URL` אם מוגדר
  - אחרת: `http://<window.location.hostname>:5000`
- נרמול URL:
  - הסרת `/` מסיים (`normalizeBaseUrl`).

### 4.2 תלויות עיקריות
- `react`, `react-dom`
- `vite`, `@vitejs/plugin-react`

## 5. מודל נתונים

### 5.1 Server (מ-`/api/admin/servers`)
- `server_id: string`
- `address: string`
- `registered_at: unix_seconds`
- `last_heartbeat: unix_seconds`
- `status: "active" | "draining" | "down" | <other>`
- `stats`:
  - `active_ws_connections: number`
  - `cpu_percent: number`
  - `memory_mb: number`
  - `active_games_count: number`
- `active_pins: string[]` (נוסף בצד LB)

### 5.2 PIN Mapping (מ-`/api/admin/pins`)
- `game_pin: string`
- `server_id: string`
- `server_address: string`
- `assigned_at: unix_seconds`

### 5.3 Server Games (מ-`/sim_gamePIN`)
- `gamePin: string`
- `timestamp: unix_seconds`
- `active: boolean`
- `gameStarted: boolean`

### 5.4 State פנימי בדשבורד
- `servers`, `pins`, `history[]` (עד 30 נקודות זמן)
- `viewMode: "table" | "cards"`
- `autoRefreshMs: 0 | 5000 | 10000 | 30000`
- `gamesPanel` להצגת משחקי שרת נבחר
- `actionBusy` לנעילת כפתורים לפי `server_id:action`

## 6. חוזה API של הדשבורד

### 6.1 קריאות ל-Load Balancer
- `GET /api/admin/servers`
  - שימוש: טעינת רשימת שרתים ומדדים.
- `GET /api/admin/pins`
  - שימוש: ספירת PINs כוללת.
- `POST /api/admin/servers/{server_id}/drain`
  - שימוש: מעבר שרת למצב `draining`.
- `POST /api/admin/servers/{server_id}/activate`
  - שימוש: החזרת שרת ל-`active`.
- `DELETE /api/admin/servers/{server_id}`
  - שימוש: הסרת שרת ומחיקת כל ה-PINs המשויכים.

### 6.2 קריאה ישירה לשרת משחק
- `GET {server.address}/sim_gamePIN`
  - שימוש: הצגת משחקים בשרת ספציפי.
  - תלות: `server.address` חייב להיות נגיש מהדפדפן של המפעיל.

### 6.3 טיפול בשגיאות API
- כל קריאה עוברת דרך `requestJson`.
- אם `response.ok=false` או `payload.status==="error"` נזרקת שגיאה.
- הודעת שגיאה מועדפת:
  - `message` -> `error` -> `Request failed (<status>)`

## 7. דרישות פונקציונליות והתנהגות UI

### 7.1 טעינה ורענון
- בטעינה ראשונה מתבצע Refresh מלא (טעינה עם `loading`).
- רענון ידני דרך כפתור `Refresh` (מצב `refreshing`).
- רענון אוטומטי לפי תדירות שנבחרה (`כבוי/5/10/30 שניות`).
- שינוי כתובת LB מפעיל טעינה מחדש.

### 7.2 חישובי KPI עליונים
- מחושבים בזמן ריצה מתוך `servers` + `pins`:
  - סה"כ שרתים, active/draining/down
  - סה"כ חיבורי WS
  - סה"כ משחקים פעילים
  - סה"כ זיכרון (MB)
  - ממוצע CPU
  - סה"כ PINs פעילים

### 7.3 גרפים חיים
- 4 גרפים: CPU, Memory, WS, Games.
- גרף מבוסס `svg polyline`.
- נשמרות עד 30 דגימות היסטוריות (Sliding Window).

### 7.4 תצוגות שרתים
- `table`:
  - כולל כל שדות הניטור + Heartbeat יחסי + פעולות ניהול.
  - כולל פעולת `remove`.
- `cards`:
  - תצוגה קומפקטית.
  - כוללת `drain/activate` ו-`games`.
  - לא כוללת `remove` במימוש הנוכחי.

### 7.5 פעולות ניהול שרת
- `drain`:
  - זמין כאשר השרת `active`.
  - משנה סטטוס ב-LB ל-`draining`.
- `activate`:
  - זמין כאשר השרת אינו `active`.
  - משנה סטטוס ב-LB ל-`active`.
- `remove`:
  - זמין בתצוגת טבלה בלבד.
  - מציג חלון אישור.
  - מוחק גם PIN mappings של השרת ב-LB.

### 7.6 פאנל משחקים לשרת
- פתיחה בלחיצה על `משחקים`.
- מציג כתובת שרת, מצב טעינה, שגיאה או טבלה.
- שדות מוצגים: `gamePin`, `active`, `gameStarted`, `timestamp`.

## 8. כללי דומיין ותפעול (LB + srv)

### 8.1 סטטוס שרתים
- `active`: יכול לקבל משחקים חדשים ולהמשיך לשרת קיימים.
- `draining`: לא מקבל משחקים חדשים, כן משרת PINs קיימים.
- `down`: לא מקבל תעבורה; מתקבל אוטומטית בחוסר heartbeat.

### 8.2 בחירת שרת למשחק חדש (ב-LB)
- רק שרתים `active` ובריאים (< 90 שניות מה-heartbeat האחרון).
- מיון לפי:
  - `active_games_count` (עיקרי)
  - `active_ws_connections` (משני)

### 8.3 בריאות וניקוי
- Heartbeat מתקבל מ-`srv` כל 30 שניות.
- Health checker מסמן `down` אחרי timeout של 90 שניות (בדיקה כל 60).
- Stale cleanup כל 10 דקות:
  - LB קורא `/sim_gamePIN` לכל שרת שאינו `down`.
  - מוחק PINs ממופים שכבר לא קיימים על השרת.

## 9. חוויית משתמש ו-UI

### 9.1 שפה וכיווניות
- כיווניות: `RTL`.
- פורמט מספרים/תאריכים: `he-IL`.
- חלק מהטקסטים באנגלית (כמו `Refresh`, `Table`, `Cards`, `s ago`).

### 9.2 רספונסיביות
- נקודת שבירה `1160px`:
  - top panel לשורה אחת.
  - גרידים ל-2 עמודות.
- נקודת שבירה `760px`:
  - גרידים לעמודה אחת.
  - התאמות כפתורים ושדות להזנה נוחה במובייל.

## 10. אבטחה, אמינות ומגבלות

### 10.1 אבטחה (מימוש נוכחי)
- אין אימות משתמשים בדשבורד.
- נקודות `/api/admin/*` פתוחות ללא auth במימוש LB.
- CORS פתוח (`origins="*"`) גם ב-LB וגם ב-srv.

### 10.2 אמינות
- מצב `actionBusy` מונע לחיצות כפולות לכל שרת/פעולה.
- רוב עדכוני המידע נשענים על polling; אין push ייעודי לדשבורד.
- כשל זמני ב-LB או ב-srv מוצג כ-banner שגיאה.

### 10.3 מגבלות ארכיטקטורליות
- Registry ב-LB נשמר בזיכרון בלבד (Restart מאפס mappings).
- `showServerGames` תלוי נגישות ישירה ל-`server.address` מצד הדפדפן.
- מיון סטטוסים בדשבורד הוא לקסיקוגרפי (לא לפי עדיפות עסקית).
- היסטוריית גרפים נשמרת בצד לקוח בלבד ומתאפסת ברענון עמוד.

## 11. דרישות לא פונקציונליות שנגזרות מהמימוש

- זמן תגובה UI:
  - תלוי latency לרשת; אין timeout ייעודי ב-fetch frontend.
- עומס:
  - בכל רענון מתבצעות 2 קריאות LB; בפאנל משחקים קריאה נוספת ל-srv.
- תאימות:
  - דורש דפדפן מודרני תומך `fetch` ו-ES Modules.

## 12. תרחישים מרכזיים

### תרחיש A: ניטור שוטף
1. המפעיל פותח Dashboard.
2. נטענים שרתים ו-PINs.
3. מוצגים KPI + גרפים + רשימת שרתים.
4. רענון אוטומטי ממשיך לפי ההגדרה.

### תרחיש B: הוצאת שרת מקבלת משחקים חדשים
1. המפעיל לוחץ `עצור פתיחה` על שרת `active`.
2. הדשבורד שולח `POST /drain`.
3. סטטוס מתעדכן ל-`draining`.
4. משחקים חדשים ינותבו לשרתים אחרים.

### תרחיש C: הסרת שרת תקול
1. המפעיל לוחץ `הסר` ומאשר.
2. הדשבורד שולח `DELETE /api/admin/servers/{id}`.
3. השרת ו-PIN mappings שלו מוסרים מה-LB.

### תרחיש D: תחקור משחקים על שרת
1. המפעיל לוחץ `משחקים` בשורת שרת.
2. הדשבורד קורא `{server.address}/sim_gamePIN`.
3. מוצגת רשימת המשחקים או הודעת שגיאה.

## 13. מטריצת מימוש (Traceability)

- Dashboard UI ולוגיקה: `dashboard/src/App.jsx`
- API Client לדשבורד: `dashboard/src/api/lbApi.js`
- עיצוב ורספונסיביות: `dashboard/src/App.css`, `dashboard/src/index.css`
- קונפיגורציית ריצה: `dashboard/vite.config.js`
- API ניהולי LB: `srv-lb/routes/admin_routes.py`
- בחירת שרת ו-resolve: `srv-lb/routes/resolve_routes.py`
- Registry שרתים: `srv-lb/models/server_registry.py`
- Registry PINs: `srv-lb/models/pin_registry.py`
- Health/Stale schedulers: `srv-lb/utils/scheduler.py`
- Heartbeat והרשמה של srv: `srv/server.py`
- מקור נתוני משחקים ל-Panel: `srv/routes/game_routes.py` (`/sim_gamePIN`)

## 14. החלטות תכן בולטות

- הפרדה ברורה בין UI לבין שכבת API (`lbApi.js`).
- שימוש ב-polling פשוט במקום Streaming לדשבורד.
- הסתמכות על LB כמקור אמת למצב שרתים ומיפויי PIN.
- גישה ישירה ל-srv עבור רשימת משחקים, בלי תיווך LB.

## 15. פערים לשיפור עתידי (נגזר מהמימוש הקיים)

- הוספת Authentication/Authorization ל-`/api/admin/*`.
- הוספת timeout ו-retry במדיניות fetch של הדשבורד.
- חשיפת endpoint דרך LB לרשימת משחקים לשרת (במקום קריאה ישירה ל-srv).
- הוספת `remove` גם בתצוגת `cards` או הגדרה ברורה שזה מחוץ להיקף.
- אחידות שפה מלאה (עברית/אנגלית) ב-UI.
- התמדה לנתוני LB (Redis/DB) במקום In-Memory בלבד.
