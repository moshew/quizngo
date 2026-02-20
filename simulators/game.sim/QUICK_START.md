# ⚡ התחלה מהירה - Kahoot Simulator

## 🚀 3 שלבים להפעלה

### 1️⃣ התקן תלויות
```bash
cd sim
npm install
```

### 2️⃣ הפעל את השרת (בחלון נפרד)
```bash
# חלון טרמינל 1
cd srv
./start_python.sh    # Linux/Mac
# או
start_python.bat     # Windows
```

**ודא שרואה:**
```
🚀 Server running on http://localhost:5000
```

### 3️⃣ הפעל את הסימולטור
```bash
# חלון טרמינל 2
cd sim
npm run dev
```

**פתח דפדפן:**
```
http://localhost:3001
```

---

## 🎮 שימוש

1. **לחץ** "🚀 התחל משחק חדש"
2. **לחץ** "🎮 הצטרף" על המשתתפים
3. **ראה** את העדכונים בזמן אמת!

---

## 🐛 בעיות?

### השרת לא רץ?
```bash
# בדוק תהליכים
Get-Process python

# הרוג והתחל מחדש
cd srv
./start_python.sh
```

### הסימולטור לא נפתח?
```bash
# נקה cache
rm -rf node_modules
npm install
npm run dev
```

---

**זהו! מוכן לשימוש!** 🎉







