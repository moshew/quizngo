# 📁 Slide Types - מודולים נפרדים לכל סוג שקף

## 🎯 מבנה מודולרי

כל סוג שקף נמצא בקובץ HTML נפרד, מה שמאפשר:
- ✅ קוד מסודר ונקי
- ✅ קל לתחזוקה ועריכה
- ✅ ממשק ייעודי לכל סוג שקף
- ✅ טעינה דינמית לפי הצורך

---

## 📋 קבצים

### 1. `opening.html` - שקף פתיחה 🎯
**מטרה:** מסך הפתיחה של המשחק

**תוכן ייחודי:**
- Game PIN (מזהה משחק) גדול ובולט
- כפתור "התחל משחק"
- כפתורי משתתפים:
  - מספר משתתפים
  - הצג משתתפים
  - אזור משתתפים חי

**צבע זיהוי:** 💜 סגול (Gradient)

---

### 2. `question.html` - שקף שאלה ❓
**מטרה:** שאלה עם תשובות

**תוכן ייחודי:**
- סטטוס משחק (Game ID, משתתפים, זמן, שקופית)
- טיימר לשאלה:
  - קביעת זמן (1-300 שניות)
  - התחל טיימר
  - עצור טיימר

**צבע זיהוי:** 🎀 ורוד (Gradient)

---

### 3. `transition.html` - שקף מעבר 🔄
**מטרה:** שקף מעבר בין שאלות

**תוכן:** תוכן דיפולטי
- סטטוס משחק (Game ID, משתתפים, זמן, שקופית)

**צבע זיהוי:** 💚 ירוק (Gradient)

---

### 4. `results.html` - ניתוח תוצאות 📊
**מטרה:** תוצאות תשובות וטבלת מובילים (משלב סטטיסטיקה ומובילים)

**תוכן ייחודי:**
- סטטוס משחק (Game ID, משתתפים, זמן)
- כפתורי תצוגת תוצאות:
  - הוסף פילוג תשובות
  - בדיקה: עדכון דוגמה
- טבלת מובילים:
  - הצג מובילים

**צבע זיהוי:** 📊 כחול

**הערה:** שקף זה הוא **שקף משותף** - מוצג אחרי כל שאלה ומחזיר לשאלה הבאה

---

### 5. `summary.html` - סיכום 🎊
**מטרה:** סיכום סופי של המשחק

**תוכן ייחודי:**
- סטטוס משחק
- כפתורי סיכום:
  - הצג תוצאות סופיות
  - הכנס טבלת מובילים סופית
  - סיים משחק

**צבע זיהוי:** 🌈 צבעוני (Gradient)

---

### 6. `settings.html` - הגדרות ⚙️
**מטרה:** הגדרות תזמון המשחק

**תוכן ייחודי:**
- זמן המתנה למענה על שאלה (שניות)
- השהיית הפעלת שעון (שניות)

**הערה:** הגדרות "מעברים אוטומטיים" הוסרו - במקום זה ניתן להסתיר שקפים לא רצויים

---

## 🎨 מבנה אחיד לכל קובץ

כל קובץ בנוי מ-3 חלקים:

### 1️⃣ כותרת - סוג השקף (למעלה)
```html
<div style="background: gradient; border-radius: 8px;">
    <h2>🎯 [שם סוג השקף]</h2>
    <div>[תיאור קצר]</div>
</div>
```

### 2️⃣ תוכן ספציפי (באמצע)
```html
<div class="status-section">
    <!-- תוכן ייעודי לסוג השקף -->
    <!-- סטטוס, כפתורים, פקדים -->
</div>
```

### 3️⃣ פעולות חוצות סוג (למטה)
```html
<div class="control-section">
    <h3>⚙️ פעולות</h3>
    
    <!-- ניהול נתונים -->
    <button>💾 שמור נתונים</button>
    <button>📂 טען נתונים</button>
    
    <!-- מעבר למצב הרצה -->
    <button>▶️ התחל משחק</button>
</div>
```

---

## 🔄 איך זה עובד?

### 1. טעינה דינמית
```javascript
// taskpane.js
async function updateUIForSlideType(slideType) {
    const slideTypeFiles = {
        'פתיחה': 'opening.html',
        'שאלה': 'question.html',
        'מעבר': 'transition.html',
        'סטטיסטיקת מענה': 'statistics.html',
        'מובילים': 'leaderboard.html',
        'סיכום': 'summary.html'
    };
    
    const fileName = slideTypeFiles[slideType];
    const html = await fetch(`slide-types/${fileName}`);
    
    document.getElementById('slideContentArea').innerHTML = html;
}
```

### 2. בחירת סוג שקף
```javascript
// כאשר משתמש בוחר סוג שקף או עובר לשקף אחר
loadSlideType() → updateUIForSlideType(slideType) → טעינת HTML מתאים
```

### 3. עדכון ערכים
```javascript
// לאחר טעינת HTML חדש
updateDisplayedValues() → עדכון Game ID, משתתפים, זמן וכו'
```

---

## 🛠️ איך להוסיף סוג שקף חדש?

### שלב 1: צור קובץ HTML חדש
```bash
add-in/slide-types/new-type.html
```

### שלב 2: השתמש במבנה האחיד
```html
<!-- 1. כותרת -->
<div style="background: gradient;">
    <h2>🆕 שקף חדש</h2>
</div>

<!-- 2. תוכן ייחודי -->
<div class="status-section">
    <!-- התוכן הייחודי שלך -->
</div>

<!-- 3. פעולות חוצות סוג -->
<div class="control-section">
    <button onclick="savePresentationData()">💾 שמור</button>
    <button onclick="loadPresentationData()">📂 טען</button>
    <button onclick="startPresentationMode()">▶️ התחל משחק</button>
</div>
```

### שלב 3: הוסף למיפוי ב-`taskpane.js`
```javascript
const slideTypeFiles = {
    // ... existing types
    'שקף חדש': 'new-type.html'  // ← ADD THIS
};
```

### שלב 4: הוסף אופציה ב-`taskpane.html`
```html
<select id="slideType">
    <!-- ... existing options -->
    <option value="שקף חדש">שקף חדש</option>  <!-- ← ADD THIS -->
</select>
```

---

## 📊 פעולות משותפות (Cross-Type Actions)

### 1. שמירה וטעינה
```javascript
// Defined in taskpane.js
savePresentationData()  // שמירת נתונים לשרת
loadPresentationData()  // טעינת נתונים מהשרת
```

### 2. הרצת מצגת
```javascript
// Defined in taskpane.js
startPresentationMode()  // מעבר למצב הצגה
```

### 3. הצגת שגיאות
```javascript
// Defined in taskpane.js
showError(message)  // הצגת הודעה למשתמש
```

---

## 🎨 CSS Classes Available

כל הקבצים יכולים להשתמש ב-CSS classes המוגדרים ב-`taskpane.html`:

```css
.container          - מיכל ראשי
.status-section     - קופסת סטטוס (רקע אפור בהיר)
.control-section    - קופסת בקרה
.button             - כפתור סטנדרטי
.stat-item          - פריט סטטיסטיקה
.stat-value         - ערך סטטיסטיקה
.stat-label         - תווית סטטיסטיקה
.stats-grid         - רשת סטטיסטיקות
```

---

## 🔍 דוגמה מלאה

### מבנה קובץ `question.html`:

```html
<!-- 1️⃣ כותרת -->
<div style="text-align: center; padding: 15px; background: gradient;">
    <h2>❓ שקף שאלה</h2>
    <div>שאלה עם תשובות</div>
</div>

<!-- 2️⃣ תוכן ייחודי -->
<div class="status-section">
    <!-- Game ID & Stats -->
    <div id="gameId">-</div>
    <div id="userCount">-</div>
    
    <!-- Timer controls (unique to question) -->
    <input type="number" id="timerDuration" value="30">
    <button onclick="startTimer()">⏱️ התחל טיימר</button>
    <button onclick="stopTimer()">⏹️ עצור טיימר</button>
</div>

<!-- 3️⃣ פעולות משותפות -->
<div class="control-section">
    <button onclick="savePresentationData()">💾 שמור נתונים</button>
    <button onclick="loadPresentationData()">📂 טען נתונים</button>
    <button onclick="startPresentationMode()">▶️ התחל משחק</button>
</div>
```

---

## 🎯 יתרונות המבנה החדש

### לפני (Monolithic):
```
taskpane.html (280 שורות)
├── כל סוגי השקפים ביחד
├── הרבה if/else statements
├── קשה לתחזוקה
└── בלגן ❌
```

### אחרי (Modular):
```
slide-types/
├── opening.html (50 שורות)
├── question.html (50 שורות)
├── transition.html (40 שורות)
├── statistics.html (50 שורות)
├── leaderboard.html (50 שורות)
└── summary.html (50 שורות)

✅ קל לתחזוקה
✅ ברור ומובנה
✅ קל להוסיף סוגים חדשים
```

---

## 🎉 סיכום

המבנה החדש מאפשר:
1. **מודולריות** - כל סוג שקף בקובץ נפרד
2. **עקביות** - מבנה אחיד (כותרת → תוכן → פעולות)
3. **גמישות** - קל להוסיף סוגי שקפים חדשים
4. **תחזוקה** - קל למצוא ולערוך
5. **שימוש חוזר** - פעולות משותפות לכולם

**תאריך:** נובמבר 1, 2024  
**גרסה:** 4.3.0  
**סטטוס:** ✅ פעיל


