# 🚀 Quick Start Guide

## תחילת עבודה מהירה - 3 דקות

### 1. הגדרת השרת Python (1 דקה)
```bash
cd srv/
install_python.bat     # Windows
# או: ./install_python.sh  # Linux/Mac
start_python.bat       # Windows  
# או: ./start_python.sh    # Linux/Mac
```

### 2. הגדרת Add-in (2 דקות)
```bash
# במחשב עם PowerPoint:
cd add-in/
npm install && npm start
```

### 3. טעינה ב-PowerPoint (1 דקה)
1. פתח PowerPoint
2. Insert → My Add-ins → Shared Folder
3. בחר `manifest.xml` מתיקיית `add-in`
4. לחץ Add

## ✅ בדיקה מהירה

### בדוק שהשרת עובד:
```
http://localhost:5000
```

### בדוק API:
```bash
curl "http://localhost:5000/?status"
# או הפעל בדיקה מלאה:
cd srv/
python test_python.py
```

## 🎮 שימוש ראשון

1. **צור מצגת** עם הטקסט:
   ```
   ברוכים הבאים!
   משתתפים: !#users!
   זמן: !time!
   ```

2. **פתח Add-in** בפאנל הצדדי

3. **לחץ "התחל משחק"**

4. **התבונן** איך הטקסט מתחלף לנתונים אמיתיים!

## 🔧 הגדרת URL

ה-Add-in כבר מוגדר נכון ל-`http://localhost:5000/`
אם תרצה לשנות, ערוך ב-`add-in/taskpane.js`:
```javascript
const API_BASE = 'http://localhost:5000/';
```

## 📞 תמיכה מהירה

- **שרת לא עובד**: `cd srv && python test_python.py`
- **חבילות חסרות**: `cd srv && pip install -r requirements.txt`
- **פורט תפוס**: שנה פורט ב-`app.py` (שורה אחרונה)
- **Add-in לא נטען**: ודא ש-`npm start` רץ על פורט 3000
- **לא מתחבר**: בדוק ש-השרת רץ על `http://localhost:5000`

**זהו! אתה מוכן להתחיל! 🎉**
