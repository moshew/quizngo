# 🎯 Kahoot PowerPoint Quiz System

מערכת חידון טריוויה מלאה הכוללת Office Add-in ל-PowerPoint ושרת Python מקומי.

## 📋 תיאור המערכת

המערכת מורכבת מארבעה חלקים עיקריים:
1. **Office Add-in** - הרחבה ל-PowerPoint שמתחברת לשרת
2. **שרת Python (Flask)** - API מקומי לבדיקה ופיתוח
3. **Simulator (React)** - אפליקציה לסימולציה של משתתפים
4. **Admin Panel (React)** - לוח בקרה לניהול המשחק מרחוק 🆕

## 📁 מבנה הפרויקט

```
kahoot/
├── add-in/                 # Office Add-in ל-PowerPoint
│   ├── manifest.xml        # הגדרות Add-in
│   ├── taskpane.html      # ממשק משתמש ראשי
│   ├── taskpane.js        # לוגיקה ראשית
│   ├── slide-types/       # 📁 ממשקים מודולריים לכל סוג שקף
│   │   ├── opening.html       # 🎯 שקף פתיחה
│   │   ├── question.html      # ❓ שקף שאלה
│   │   ├── transition.html    # 🔄 שקף מעבר
│   │   ├── statistics.html    # 📊 סטטיסטיקת מענה
│   │   ├── leaderboard.html   # 🏆 מובילים
│   │   ├── summary.html       # 🎊 סיכום
│   │   └── README.md          # תיעוד
│   ├── package.json       # תלויות Node.js
│   └── assets/           # אייקונים
├── srv/                   # שרת Python
│   ├── app.py            # שרת Flask ראשי
│   ├── config.py         # הגדרות
│   ├── requirements.txt  # חבילות Python
│   ├── data/             # נתונים שמורים
│   │   └── saved_presentations/  # קבצי JSON של מצגות
│   ├── install_python.*  # סקריפטי התקנה
│   ├── start_python.*    # סקריפטי הפעלה
│   ├── test_python.py    # בדיקות מערכת
│   └── README.md         # הוראות השרת
├── sim/                   # סימולטור משתתפים (React)
│   ├── src/
│   │   ├── App.jsx       # קומפוננטה ראשית
│   │   ├── App.css       # סגנונות
│   │   └── main.jsx      # Entry point
│   ├── package.json      # תלויות React
│   ├── vite.config.js    # הגדרות Vite
│   ├── start.bat         # הפעלה (Windows)
│   ├── start.sh          # הפעלה (Linux/Mac)
│   └── README.md         # הוראות הסימולטור
├── admin/                 # 🆕 לוח בקרה (React)
│   ├── src/
│   │   ├── App.jsx       # קומפוננטה ראשית
│   │   ├── App.css       # סגנונות
│   │   └── main.jsx      # Entry point
│   ├── package.json      # תלויות React
│   ├── vite.config.js    # הגדרות Vite (port 3002)
│   ├── start.bat         # הפעלה (Windows)
│   ├── start.sh          # הפעלה (Linux/Mac)
│   ├── QUICK_START.md    # התחלה מהירה
│   └── README.md         # הוראות לוח הבקרה
├── MODULAR_ARCHITECTURE.md      # הסבר מלא על הארכיטקטורה
├── QUICK_REFERENCE_MODULAR.md   # מדריך מהיר
└── README.md                     # המדריך הזה
```

## 🚀 התקנה מהירה

### שלב 1: הגדרת השרת Python 🐍
```bash
# התקנה
cd srv/
./install_python.sh    # Linux/Mac
# או: install_python.bat  # Windows

# הפעלה
./start_python.sh       # Linux/Mac
# או: start_python.bat   # Windows
```

השרת יאזין פנימית על `http://127.0.0.1:5000` ומוגש חיצונית דרך `https://quizngo.online/lb/`.

### שלב 2: הגדרת Add-in
```bash
# על השרת המרוחק
cd add-in/
./start.sh start
```

ה-Add-in dev נגיש דרך:
- `https://quizngo.online/addin-dev/taskpane.html`
- `https://quizngo.online/addin-dev/manifest.dev.xml` (אם אתה חושף את הקובץ דרך השרת)

### שלב 3: הסימולטור (אופציונלי) 🎮
```bash
# במחשב או בטאב נפרד
cd sim/
npm install
npm run dev
```

הסימולטור יפתח על: `https://quizngo.online/game/`

**מה זה הסימולטור?**
- 10 משתתפים פיקטיביים
- חיבור/ניתוק בלחיצת כפתור
- בדיקת WebSocket בזמן אמת
- 📖 ראה: `sim/README.md`

### שלב 4: לוח הבקרה (אופציונלי) 🎮
```bash
# במחשב או בטאב נפרד
cd admin/
npm install
npm run dev
```

לוח הבקרה יפתח על: `https://quizngo.online/admin/`

**מה זה לוח הבקרה?**
- ניהול המשחק מרחוק דרך ממשק ויזואלי
- שליטה על מעברי שקפים ב-PowerPoint
- שליחת פקודות דרך REST API → WebSocket → Add-in
- 📖 ראה: `admin/README.md` או `admin/QUICK_START.md`

### שלב 5: טעינה ב-PowerPoint
1. פתח PowerPoint
2. Insert → My Add-ins → Shared Folder
3. בפיתוח: בחר `add-in/manifest.dev.xml`
4. בפרודקשן: בחר `add-in/manifest.xml`
5. לחץ Add

**💡 טיפ**: בגרסת פיתוח ה-Add-in מוגדר לעבוד מול `https://quizngo.online/addin-dev`.

## 🎮 איך להשתמש

### 1. הכנת המצגת
במקומות שתרצה להציג נתונים דינמיים, השתמש ב:
- `!#users!` - יוחלף במספר המשתתפים
- `!time!` - יוחלף בזמן הנותר

**דוגמה:**
```
שאלה 1: מהי בירת ישראל?

משתתפים פעילים: !#users!
זמן לתשובה: !time! שניות

א) תל אביב
ב) ירושלים  
ג) חיפה
ד) באר שבע
```

### 2. שמירת המצגת ⚠️ **חשוב!**
**לפני שמירת נתונים, חובה לשמור את המצגת עם שם:**
1. לחץ **File → Save As**
2. בחר שם משמעותי (לדוגמה: `History_Quiz.pptx`)
3. שמור את הקובץ

**למה זה חשוב?**
- הנתונים נשמרים **בשרת** לפי hash ייחודי של הנתיב המלא
- כל מצגת מקבלת קובץ נתונים משלה: `srv/data/saved_presentations/{hash_id}.json`
- הנתונים **לא** צמודים לקובץ ה-pptx (לא נשמרים לצידו!)

**🔑 Hash ID - מה זה?**
- המערכת יוצרת מספר ייחודי (hash) מהנתיב המלא של הקובץ
- לדוגמה: `C:\Users\Moshe\Quiz.pptx` → Hash ID: `2075876345`
- קובץ הנתונים: `2075876345.json`
- **יתרון:** שני קבצים עם אותו שם במיקומים שונים מקבלים ID שונה!

⚠️ **הבהרה חשובה:**
- קובץ ה-PowerPoint: `C:\Users\...\MyQuiz.pptx` (איפה ששמרת)
- קובץ הנתונים: `kahoot\srv\data\saved_presentations\{hash_id}.json` (בשרת!)
- הם **לא** באותה תיקייה - זה **בכוונה**!

📖 **למידע נוסף:** ראה `srv/HASH_ID_IMPLEMENTATION.md`  
📍 **לבדיקה:** `https://quizngo.online/list_saved_files` או `https://quizngo.online/debug_save_location.html`

### 3. הגדרת סוגי שקפים
1. עבור לכל שקף במצגת
2. בחר סוג שקף מהתפריט:
   - **פתיחה** - מסך פתיחה עם Game PIN
   - **שאלה** - שקף שאלה עם משתתפים
   - **מעבר** - שקף מעבר רגיל
3. לחץ **"שמור נתונים"** כשסיימת

💡 **הנתונים נטענים אוטומטית בפתיחת המצגת!**

### 4. הפעלת המשחק
1. פתח את ה-Add-in בפאנל הצדדי
2. לחץ **"התחל משחק"** - יקרא ל-`/?init`
3. השתמש ב-**"עמוד הבא"** - יקרא ל-`/?next_page`
4. הנתונים יתעדכנו אוטומטית במצגת

### 5. טיימר אוטומטי לשאלות ⏱️ **חדש!**

המערכת כוללת טיימר אוטומטי שמתחיל **רק** כאשר מקבלים פקודת מעבר שקף מ-Admin:

**תהליך:**
1. Admin לוחץ "עמוד הבא" → שרת שולח WebSocket
2. Add-in עובר לשקף שאלה
3. המערכת מזהה שזה מעבר דרך WebSocket + שקף שאלה
4. ממתינה **השהיית הפעלת שעון** שניות (ברירת מחדל: 5)
5. מתחילה ספירה לאחור מ-**זמן המתנה למענה** שניות (ברירת מחדל: 30)
6. מעדכנת את אלמנטי `kahoot-question-time` בשקף בזמן אמת
7. כאשר הטיימר מגיע ל-0 - מוצגת הודעה

**הגדרות טיימר:**
- עבור ל-⚙️ **הגדרות**
- **זמן המתנה למענה על שאלה**: 5-300 שניות
- **השהיית הפעלת שעון**: 0-60 שניות

**שימוש:**
1. הוסף אלמנט "⏱️ זמן שאלה" לשקף השאלה
2. התחל משחק → Admin שולט על מעבר שקפים
3. הטיימר יפעל אוטומטית רק במעבר דרך Admin (לא במעבר ידני)

**למה setTimeout של 300ms?**
PowerPoint לוקח זמן להשלים את אנימציית המעבר בין שקפים. ה-300ms מבטיח שהשקף החדש מוכן לפני הפעלת הטיימר.

📖 **תיעוד מפורט:** ראה `instructions/QUESTION_TIMER_LOGIC.md`

### 6. מעקב נתונים
- **מספר משתתפים**: מתקבל מ-`/?get_users`
- **זמן נותר**: מתקבל מ-`/?get_time`
- **עדכון אוטומטי**: כל 5 שניות

## 🎨 ארכיטקטורה מודולרית (גרסה 4.3.0)

המערכת משתמשת ב**ארכיטקטורה מודולרית** - כל סוג שקף בקובץ HTML נפרד!

### מבנה סוגי השקפים

```
add-in/slide-types/
├── opening.html       🎯 פתיחה - Game PIN, התחל משחק, משתתפים
├── question.html      ❓ שאלה - טיימר, זמן תשובה
├── transition.html    🔄 מעבר - תוכן דיפולטי
├── statistics.html    📊 סטטיסטיקת מענה - תוצאות תשובות
├── leaderboard.html   🏆 מובילים - טבלת מובילים
└── summary.html       🎊 סיכום - סיום משחק
```

### יתרונות
✅ **קוד נקי ומסודר** - כל סוג שקף בקובץ נפרד  
✅ **תחזוקה קלה** - שינוי בסוג אחד לא משפיע על אחרים  
✅ **הרחבה פשוטה** - הוספת סוג חדש = קובץ חדש  
✅ **עקביות** - מבנה אחיד לכל סוג (כותרת → תוכן → פעולות)

### פעולות משותפות לכל סוג
כל סוג שקף כולל בתחתית:
- 💾 **שמור נתונים** - שמירה לשרת
- 📂 **טען נתונים** - טעינה מהשרת
- ▶️ **הפעל מצגת** - מעבר למצב הצגה

### למפתחים: הוספת סוג שקף חדש
```bash
# 1. צור קובץ
add-in/slide-types/my-type.html

# 2. הוסף למיפוי (taskpane.js)
const slideTypeFiles = {
    'הסוג שלי': 'my-type.html'
};

# 3. הוסף אופציה (taskpane.html)
<option value="הסוג שלי">הסוג שלי</option>
```

📖 **מידע מלא:** 
- `MODULAR_ARCHITECTURE.md` - הסבר מפורט
- `QUICK_REFERENCE_MODULAR.md` - מדריך מהיר
- `add-in/slide-types/README.md` - מפרט קבצים

## 🔧 API Endpoints

### משחק
| Endpoint | תפקיד | דוגמה |
|----------|--------|--------|
| `/?init` | אתחול משחק | `https://quizngo.online/lb/?init` |
| `/?next_page` | מעבר לעמוד הבא | `https://quizngo.online/lb/?next_page` |
| `/?get_users` | קבלת מספר משתמשים | `https://quizngo.online/lb/?get_users` |
| `/?get_time` | קבלת זמן נותר | `https://quizngo.online/lb/?get_time` |
| `/?status` | סטטוס מלא | `https://quizngo.online/lb/?status` |
| `/?reset` | איפוס משחק | `https://quizngo.online/lb/?reset` |

### שמירה וטעינה
| Endpoint | שיטה | תפקיד |
|----------|------|--------|
| `/save` | POST | שמירת נתונים לפי שם קובץ |
| `/load` | POST | טעינת נתונים לפי שם קובץ |

**דוגמה - שמירה:**
```json
POST /save
{
  "id": "MyQuiz",
  "data": {
    "windowId": "MyQuiz",
    "savedAt": "2024-11-01T12:00:00Z",
    "gameState": {
      "slideTypeData": { ... }
    }
  }
}
```

**דוגמה - טעינה:**
```json
POST /load
{
  "id": "MyQuiz"
}
```

💾 **מיקום נתונים שמורים:** `srv/data/saved_presentations/{filename}.json`

## 🛠️ פיתוח

### Add-in
```bash
cd add-in/
./start.sh         # הרצת add-in
npm run validate   # בדיקת manifests
```

### שרת
```bash
# בדיקת API
curl https://your-server.com/kahoot/?status

# צפייה בלוגים
tail -f /var/www/html/kahoot/logs/kahoot.log
```

## 🔐 אבטחה

### CORS
השרת מוגדר לקבל בקשות מ:
- `https://quizngo.online`

### הרשאות קבצים
```bash
# נתוני משחק
/var/www/html/kahoot/data/     (775)
/var/www/html/kahoot/logs/     (775)

# קבצי PHP
/var/www/html/kahoot/*.php     (755)
```

## 📊 מעקב ובקרה

### ממשק ניהול
גש ל: `https://your-server.com/kahoot/`

### נתוני משחק
```json
{
    "initialized": true,
    "current_slide": 3,
    "users": 24,
    "time_remaining": 15,
    "game_started": true,
    "uptime": 180,
    "server_time": "2024-01-01 15:30:45"
}
```

### לוגים
```bash
# צפייה בלוגים חיים
tail -f /var/www/html/kahoot/logs/kahoot.log

# לוגים אחרונים
tail -20 /var/www/html/kahoot/logs/kahoot.log
```

## 🚨 פתרון בעיות

### Add-in לא נטען
- ודא שהשירותים רצים: `cd add-in && ./start.sh status`
- ודא שנטען `add-in/manifest.dev.xml` לפיתוח
- בדוק גישה ל-`https://quizngo.online/addin-dev/taskpane.html`

### API לא עובד
- בדוק הרשאות קבצים
- ודא ש-PHP 7.0+ מותקן
- בדוק שהשרת זמין

### נתונים לא מתעדכנים
- בדוק חיבור לאינטרנט
- ודא ש-URL בקוד נכון
- בדוק לוגי שגיאות

## 📄 רישיון

MIT License - ראה קובץ LICENSE לפרטים

## 🤝 תמיכה

- **בעיות**: פתח issue בפרויקט
- **תיעוד**: ראה README בכל תיקייה
- **לוגים**: `/var/www/html/kahoot/logs/`

---

**🎉 בהצלחה עם החידון שלך!**
