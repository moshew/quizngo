# מדריך התקנה ל-Microsoft 365 / Office 2021+ 

## 🎯 המטרה
להתקין את תוספת Kahoot ב-PowerPoint בגרסאות החדשות של Office.

## 🚀 התחלה מהירה

### שלב 1: ודא שהשרת רץ
```bash
cd add-in
npm start
```
השרת צריך לרוץ על: `http://localhost:3000`

### שלב 2: פתח PowerPoint ונסה אחת מהשיטות הבאות:

## 🔧 שיטה 1: Developer Tab (המומלצת)

1. **פתח PowerPoint**
2. **הפעל Developer Tab**:
   - File → Options → Customize Ribbon
   - סמן ✅ "Developer" ברשימה הימנית  
   - לחץ OK
3. **עבור ל-Developer Tab**
4. **לחץ על "Add-ins"** 
5. **בחר "COM Add-ins"** או **"Office Add-ins"**
6. **לחץ "Browse"** ובחר את `manifest.xml`

## 🏪 שיטה 2: דרך Insert Menu

1. **פתח PowerPoint**
2. **עבור ל-Insert**
3. **חפש אחד מאלה**:
   - "Add-ins" 
   - "Get Add-ins"
   - "Store" (חנות)
   - "My Add-ins"
4. **חפש אפשרות של**:
   - "Upload My Add-in"
   - "Shared Folder" 
   - "My Organization"
   - "Developer"
5. **בחר את `manifest.xml`**

## 📝 שיטה 3: Windows Registry

אם השיטות למעלה לא עובדות:

1. **סגור PowerPoint לגמרי**
2. **הרץ כ-Administrator**:
   ```cmd
   cd add-in
   regedit /s register-addin.reg
   ```
3. **הפעל מחדש את PowerPoint**
4. **התוספת אמורה להופיע אוטומטית**

## 🎪 שיטה 4: Office Deployment Tool

לארגונים עם ניהול מרכזי:

1. **פנה למנהל ה-IT**
2. **בקש להוסיף את התוספת דרך Office Admin Center**
3. **העבר את קובץ `manifest.xml`**

## 🔍 איתור בעיות

### בעיה: "אין אפשרות Upload My Add-in"
**פתרון**: נסה Developer Tab או Registry

### בעיה: "Add-in לא נטען" 
**פתרון**: 
1. ודא שהשרת רץ על localhost:3000
2. בדוק שאין Antivirus שחוסם
3. נסה לפתוח http://localhost:3000/taskpane.html בדפדפן

### בעיה: "שגיאת CORS"
**פתרון**: הפעל מחדש את השרת עם:
```bash
npm run dev
```

### בעיה: "לא רואה את התוספת ברשימה"
**פתרון**:
1. סגור PowerPoint לגמרי (כולל ב-Task Manager)
2. הפעל מחדש
3. נסה שיטת Registry

## 📱 גרסאות נתמכות

- ✅ PowerPoint Desktop (Office 365, 2019, 2021)
- ✅ PowerPoint Online (חלקית)
- ❌ PowerPoint Mobile Apps

## 🆘 עזרה נוספת

אם שום דבר לא עובד:

1. **הרץ**: `install-modern-office.bat` כ-Administrator
2. **בדוק לוגים**: פתח Developer Tools ב-PowerPoint (F12)
3. **צור קשר**: עם תמיכה טכנית

## 📍 מיקומי קבצים חשובים

- **Manifest**: `add-in/manifest.xml`
- **Server**: `http://localhost:3000`  
- **Registry**: `add-in/register-addin.reg`
- **התקנה**: `add-in/install-modern-office.bat`
