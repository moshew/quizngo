# 🐍 Kahoot Quiz Server - Python Version

## מה זה?

שרת פייתון (Flask) שמספק API לניהול חידון טריוויה דרך PowerPoint Add-in.
**גרסה זו מיועדת לבדיקה מקומית פשוטה לפני העלאה לשרת מרוחק.**

## 🚀 התקנה מהירה

### Windows
```batch
# התקן Python מ-python.org אם לא מותקן
install_python.bat
start_python.bat
```

### Linux/Mac
```bash
# ודא ש-Python 3.7+ מותקן
./install_python.sh
./start_python.sh
```

### התקנה ידנית
```bash
# צור virtual environment
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# או: venv\Scripts\activate.bat  # Windows

# התקן חבילות
pip install -r requirements.txt

# הפעל שרת
python app.py
```

## 🌐 שימוש

### 1. הפעל את השרת
```bash
python app.py
```
השרת יתחיל על: `http://localhost:5000`

### 2. בדוק שהכל עובד
- דפדפן: `http://localhost:5000`
- API: `http://localhost:5000/?status`
- או הפעל: `python test_python.py`

### 3. עדכן את ה-Add-in
ב-`add-in/taskpane.js` שנה ל:
```javascript
const API_BASE = 'http://localhost:5000/';
```

### 4. הפעל את ה-Add-in
```bash
cd add-in/
npm start
```

## 📋 API Endpoints

| Endpoint | תיאור | דוגמה |
|----------|--------|--------|
| `/?init` | אתחול משחק | `http://localhost:5000/?init` |
| `/?next_page` | מעבר לעמוד הבא | `http://localhost:5000/?next_page` |
| `/?get_users` | קבלת מספר משתמשים | `http://localhost:5000/?get_users` |
| `/?get_time` | קבלת זמן נותר | `http://localhost:5000/?get_time` |
| `/?status` | סטטוס מלא | `http://localhost:5000/?status` |
| `/?reset` | איפוס משחק | `http://localhost:5000/?reset` |

## 🔧 בדיקות

### בדיקה אוטומטית
```bash
python test_python.py
```

### בדיקה ידנית
```bash
# בדוק סטטוס
curl http://localhost:5000/?status

# אתחל משחק
curl http://localhost:5000/?init

# קבל מספר משתמשים
curl http://localhost:5000/?get_users
```

## 📁 מבנה קבצים

```
srv/
├── app.py                  # שרת Flask ראשי
├── config.py              # הגדרות
├── requirements.txt       # חבילות Python
├── install_python.sh      # התקנה Linux/Mac
├── install_python.bat     # התקנה Windows
├── start_python.sh        # הפעלה Linux/Mac
├── start_python.bat       # הפעלה Windows
├── test_python.py         # בדיקת מערכת
├── data/                  # נתוני משחק
├── logs/                  # קבצי לוג
└── venv/                  # סביבה וירטואלית
```

## 🔄 מעבר לשרת מרוחק

כשאתה מוכן לעבור לשרת מרוחק:

### 1. עדכן הגדרות
ב-`config.py` שנה:
```python
ALLOWED_ORIGINS = [
    'https://din-online.co.il',
    # הסר 'http://localhost:5000'
]
DEBUG = False  # לפרודקציה
```

### 2. העלה לשרת
```bash
# עם gunicorn (מומלץ)
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app

# או עם systemd service
sudo systemctl start kahoot-server
```

### 3. עדכן Add-in
```javascript
const API_BASE = 'https://your-server.com/kahoot/';
```

## 🚨 פתרון בעיות

### השרת לא מתחיל
```bash
# בדוק Python
python3 --version

# בדוק virtual environment
source venv/bin/activate
pip list
```

### CORS שגיאות
עדכן `ALLOWED_ORIGINS` ב-`config.py`

### חבילות חסרות
```bash
pip install -r requirements.txt --upgrade
```

## 🎯 יתרונות הגרסה הזו

✅ **התקנה פשוטה** - רק Python ו-pip  
✅ **בדיקה מקומית** - ללא צורך בשרת  
✅ **פיתוח מהיר** - שינויים מיידיים  
✅ **לוגים ברורים** - קל לdebug  
✅ **בדיקות אוטומטיות** - test_python.py  

## 📞 תמיכה

- **לוגים**: `logs/kahoot.log`
- **נתונים**: `data/game_data.json`
- **בדיקה**: `python test_python.py`
- **ממשק**: `http://localhost:5000`

---

**🎉 בהצלחה עם הבדיקה המקומית!**
