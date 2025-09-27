# 🎯 Kahoot PowerPoint Quiz System

מערכת חידון טריוויה מלאה הכוללת Office Add-in ל-PowerPoint ושרת Python מקומי.

## 📋 תיאור המערכת

המערכת מורכבת משני חלקים עיקריים:
1. **Office Add-in** - הרחבה ל-PowerPoint שמתחברת לשרת
2. **שרת Python (Flask)** - API מקומי לבדיקה ופיתוח

## 📁 מבנה הפרויקט

```
kahoot/
├── add-in/                 # Office Add-in ל-PowerPoint
│   ├── manifest.xml        # הגדרות Add-in
│   ├── taskpane.html      # ממשק משתמש
│   ├── taskpane.js        # לוגיקה ראשית
│   ├── package.json       # תלויות Node.js
│   └── assets/           # אייקונים
├── srv/                   # שרת Python
│   ├── app.py            # שרת Flask ראשי
│   ├── config.py         # הגדרות
│   ├── requirements.txt  # חבילות Python
│   ├── install_python.*  # סקריפטי התקנה
│   ├── start_python.*    # סקריפטי הפעלה
│   ├── test_python.py    # בדיקות מערכת
│   └── README.md         # הוראות השרת
└── README.md            # המדריך הזה
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

השרת יתחיל על: `http://localhost:5000`

### שלב 2: הגדרת Add-in
```bash
# במחשב עם PowerPoint
cd add-in/
npm install
npm start
```

### שלב 3: טעינה ב-PowerPoint
1. פתח PowerPoint
2. Insert → My Add-ins → Shared Folder
3. בחר `add-in/manifest.xml`
4. לחץ Add

**💡 טיפ**: ה-Add-in כבר מוגדר להתחבר ל-`http://localhost:5000`

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

### 2. הפעלת המשחק
1. פתח את ה-Add-in בפאנל הצדדי
2. לחץ **"התחל משחק"** - יקרא ל-`/kahoot/?init`
3. השתמש ב-**"עמוד הבא"** - יקרא ל-`/kahoot/?next_page`
4. הנתונים יתעדכנו אוטומטית במצגת

### 3. מעקב נתונים
- **מספר משתתפים**: מתקבל מ-`/kahoot/?get_users`
- **זמן נותר**: מתקבל מ-`/kahoot/?get_time`
- **עדכון אוטומטי**: כל 5 שניות

## 🔧 API Endpoints

| Endpoint | תפקיד | דוגמה |
|----------|--------|--------|
| `/?init` | אתחול משחק | `https://din-online.co.il/kahoot/?init` |
| `/?next_page` | מעבר לעמוד הבא | `https://din-online.co.il/kahoot/?next_page` |
| `/?get_users` | קבלת מספר משתמשים | `https://din-online.co.il/kahoot/?get_users` |
| `/?get_time` | קבלת זמן נותר | `https://din-online.co.il/kahoot/?get_time` |
| `/?status` | סטטוס מלא | `https://din-online.co.il/kahoot/?status` |
| `/?reset` | איפוס משחק | `https://din-online.co.il/kahoot/?reset` |

## 🛠️ פיתוח

### Add-in
```bash
cd add-in/
npm run dev        # פיתוח
npm run validate   # בדיקת manifest
npm run sideload   # טעינה אוטומטית
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
- `https://localhost:3000` (Add-in development)
- כל מקור אחר (ניתן להגביל ב-`config.php`)

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
- ודא שהשרת רץ על פורט 3000
- בדוק הגדרות CORS
- ודא שה-manifest.xml תקין

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