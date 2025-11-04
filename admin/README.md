# 🎮 Kahoot Admin Panel

לוח בקרה ויזואלי לניהול המשחק מרחוק - שליטה מלאה על המצגת ב-PowerPoint.

## 📋 תיאור

לוח הבקרה הוא אפליקציית React שמאפשרת לך לשלוט על המצגת ב-PowerPoint מכל מקום ברשת. הוא פועל כממשק ויזואלי נוח ל-API של השרת.

### איך זה עובד?

```
Admin Panel (React)  →  REST API  →  Python Server  →  WebSocket  →  Add-in (PowerPoint)
     3002                             5000                              [PowerPoint]
```

**תהליך:**
1. 👤 לחיצה על כפתור בלוח הבקרה
2. 📡 בקשת REST נשלחת לשרת: `GET http://localhost:5000/?next_slide`
3. 🔄 השרת שולח הודעת WebSocket לכל הלקוחות המחוברים
4. 🎯 Add-in ב-PowerPoint מקבל את ההודעה ומבצע את הפעולה

## 🚀 התקנה מהירה

### דרך 1: סקריפט הפעלה מהיר (מומלץ)

**Windows:**
```bash
# פעם ראשונה - התקנה
npm install

# הפעלה
start.bat
```

**Mac/Linux:**
```bash
# פעם ראשונה - התקנה
npm install

# הפעלה
chmod +x start.sh
./start.sh
```

### דרך 2: באמצעות npm

```bash
# התקנה
npm install

# הפעלה
npm run dev
```

האפליקציה תיפתח על: **http://localhost:3002**

## ⚙️ דרישות מקדימות

לפני שימוש בלוח הבקרה, וודא:

### 1. ✅ השרת Python רץ

```bash
cd ../srv/
./start_python.bat    # Windows
./start_python.sh     # Mac/Linux
```

וודא שהשרת זמין: http://localhost:5000/docs

### 2. ✅ Add-in מחובר ב-PowerPoint

1. פתח PowerPoint עם המצגת
2. טען את Add-in (Insert → My Add-ins → Shared Folder)
3. בחר `manifest.xml` מתיקייה `add-in/`
4. **חשוב:** עבור למצב הצגה (Slide Show) - הפקודות לא עובדות במצב עריכה!

### 3. ✅ Add-in מחובר לשרת דרך WebSocket

בקונסול של Add-in (F12 ב-PowerPoint), חפש:
```
🌐 Connected to server
WebSocket connection established
```

## 🎮 שימוש

### מסך ראשי

לאחר פתיחת האפליקציה, תראה:

```
┌─────────────────────────────────────┐
│   🎮 Kahoot Admin Panel             │
│   לוח בקרה לניהול המשחק            │
├─────────────────────────────────────┤
│                                     │
│   בקרת שקפים                        │
│   [  ➡️ עבור לשקף הבא  ]           │
│                                     │
│   ✅ הפקודה נשלחה בהצלחה!          │
│                                     │
├─────────────────────────────────────┤
│ ℹ️ מידע:                            │
│ • השרת רץ על פורט 5000              │
│ • Add-in מחובר דרך WebSocket        │
│ • לחיצה שולחת הודעה דרך השרת       │
└─────────────────────────────────────┘
```

### כפתורים זמינים

#### ➡️ עבור לשקף הבא

- **קורא ל:** `GET /?next_slide`
- **עושה:** מעביר את המצגת ב-PowerPoint לשקף הבא
- **דורש:** Add-in מחובר, PowerPoint במצב הצגה

## 🛠️ מבנה הקבצים

```
admin/
├── src/
│   ├── App.jsx          # קומפוננטה ראשית
│   │                    # מכיל את הלוגיקה של הכפתורים
│   ├── App.css          # עיצוב הממשק
│   │                    # גרדיאנטים, אנימציות, responsive
│   └── main.jsx         # Entry point של React
├── index.html           # HTML ראשי (עברית RTL)
├── package.json         # תלויות: React, Vite
├── vite.config.js       # הגדרות Vite
│                        # פורט 3002, proxy ל-API
├── start.bat            # הפעלה מהירה Windows
├── start.sh             # הפעלה מהירה Mac/Linux
├── QUICK_START.md       # מדריך התחלה מהירה
└── README.md            # המדריך הזה
```

## 🔧 הוספת פיצ'רים

### הוספת כפתור חדש

ערוך את `src/App.jsx`:

```jsx
// 1. הוסף פונקציה חדשה
const handleClickAction = async () => {
  setLoading(true)
  setStatus('שולח פקודת קליק...')
  
  try {
    const response = await fetch('/api/?click_action')
    const data = await response.json()
    
    if (data.status === 'success') {
      setStatus('✅ סימולציית קליק הצליחה!')
    } else {
      setStatus('❌ שגיאה: ' + data.message)
    }
  } catch (error) {
    setStatus('❌ שגיאת רשת: ' + error.message)
  } finally {
    setLoading(false)
  }
}

// 2. הוסף כפתור בתוך הרכיב
<button 
  className="btn btn-primary"
  onClick={handleClickAction}
  disabled={loading}
>
  {loading ? '⏳ שולח...' : '🖱️ סימולציית קליק'}
</button>
```

### API Endpoints זמינים

| Endpoint | תיאור | דוגמה |
|----------|-------|--------|
| `/?next_slide` | עבור לשקף הבא | `fetch('/api/?next_slide')` |
| `/?click_action` | סימולציית מקש רווח | `fetch('/api/?click_action')` |
| `/?reset_animations` | איפוס אנימציות | `fetch('/api/?reset_animations')` |
| `/?reset` | איפוס משחק | `fetch('/api/?reset')` |
| `/?status` | קבלת סטטוס מלא | `fetch('/api/?status')` |
| `/?init` | אתחול משחק חדש | `fetch('/api/?init')` |
| `/?start&time=30` | התחל טיימר (30 שניות) | `fetch('/api/?start&time=30')` |
| `/?stop` | עצור טיימר | `fetch('/api/?stop')` |

### שינוי פורט

ערוך את `vite.config.js`:

```javascript
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3003,  // שנה לפורט אחר
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
```

## 🌐 גישה מרחוק

### מחשב אחר באותה רשת

**שלב 1:** מצא את ה-IP של המחשב עם השרת

```bash
# Windows
ipconfig

# Mac/Linux
ifconfig
```

חפש את ה-IP המקומי (לדוגמה: `192.168.1.100`)

**שלב 2:** פתח את לוח הבקרה מכל דפדפן ברשת

```
http://192.168.1.100:3002
```

**שלב 3 (אופציונלי):** אם הפקודות לא עובדות, ערוך את `src/App.jsx`:

```jsx
// במקום:
const response = await fetch('/api/?next_slide')

// כתוב:
const response = await fetch('http://192.168.1.100:5000/?next_slide')
```

**חשוב:** וודא שחומת האש מאפשרת חיבורים לפורטים 3002 ו-5000.

## 🚨 פתרון בעיות

### ❌ שגיאה: "Failed to fetch"

**סיבות אפשריות:**
1. השרת Python לא רץ
2. חומת אש חוסמת את הפורט
3. URL לא נכון

**פתרון:**
```bash
# בדוק שהשרת זמין
curl http://localhost:5000/docs

# או פתח בדפדפן
http://localhost:5000/docs
```

### ✅ "הפקודה נשלחה" אבל שום דבר לא קרה

**סיבות אפשריות:**
1. Add-in לא מחובר לשרת דרך WebSocket
2. PowerPoint לא במצב הצגה (Slide Show)
3. Add-in לא פתוח

**פתרון:**
1. פתח את הקונסול ב-Add-in (F12)
2. חפש: "🌐 Connected to server"
3. אם לא מחובר, רענן את ה-Add-in
4. וודא שאתה במצב הצגה (לא עריכה!)

### 🔌 פורט 3002 תפוס

**שגיאה:**
```
Error: Port 3002 is already in use
```

**פתרון:**
```bash
# הרוג תהליכים קיימים
# Windows
netstat -ano | findstr :3002
taskkill /PID [PID] /F

# Mac/Linux
lsof -ti:3002 | xargs kill -9

# או שנה את הפורט ב-vite.config.js
```

### 🐛 שגיאות קונסול

פתח את הקונסול בדפדפן (F12) וחפש:
- שגיאות Network (בדוק Headers, Response)
- שגיאות CORS (בדוק הגדרות השרת)
- שגיאות WebSocket (בדוק חיבור)

## 🎨 התאמה אישית

### שינוי עיצוב

ערוך את `src/App.css`:

```css
/* שנה צבעים */
:root {
  --primary-color: #667eea;
  --secondary-color: #764ba2;
}

/* שנה גרדיאנט רקע */
body {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

/* שנה צבעי כפתורים */
.btn-primary {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}
```

### הוספת אנימציות

```css
/* אנימציית פולס לכפתורים */
@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.btn-primary:hover {
  animation: pulse 1s infinite;
}
```

## 💡 רעיונות לפיתוח

### פיצ'רים בסיסיים
- [ ] כפתור "שקף קודם"
- [ ] כפתור "התחל משחק"
- [ ] כפתור "סיום משחק"
- [ ] כפתור "איפוס"

### פיצ'רים מתקדמים
- [ ] הצגת סטטיסטיקות בזמן אמת (משתתפים, זמן)
- [ ] טבלת משתתפים מחוברים
- [ ] היסטוריית פעולות
- [ ] טיימר ויזואלי
- [ ] קפיצה לשקף ספציפי (dropdown)
- [ ] מצב "פיילוט אוטומטי" (מעבר שקפים אוטומטי)

### UI/UX
- [ ] מצב כהה (Dark Mode)
- [ ] התאמה למובייל
- [ ] קיצורי מקלדת (Keyboard Shortcuts)
- [ ] התראות קוליות
- [ ] אנימציות מתקדמות

## 📚 מסמכים קשורים

- **התחלה מהירה:** [QUICK_START.md](./QUICK_START.md)
- **תיעוד השרת:** [../srv/README.md](../srv/README.md)
- **תיעוד Add-in:** [../add-in/README.md](../add-in/README.md)
- **API Documentation:** http://localhost:5000/docs

## 🐞 דיווח באגים

מצאת בעיה? פתח issue בפרויקט עם:
1. תיאור הבעיה
2. צילום מסך (אם רלוונטי)
3. שגיאות מהקונסול (F12)
4. סביבה (OS, דפדפן, גרסת Node.js)

## 📄 רישיון

MIT License - ראה קובץ LICENSE בשורש הפרויקט.

---

**🎉 בהצלחה עם השליטה על המשחק!**

אם יש לך שאלות או רעיונות לשיפור, אל תהסס לפתוח issue או pull request.

