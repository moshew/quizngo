# ⏱️ לוגיקת טיימר שאלה - Question Timer Logic

## סקירה כללית

מסמך זה מתאר את מנגנון הטיימר האוטומטי לשקפי שאלות במערכת Kahoot PowerPoint.

---

## 🎯 זרימת העבודה

### כאשר מגיעים לשקף שאלה דרך WebSocket:

```
1. Admin לוחץ "עמוד הבא" בפאנל הניהול

2. שרת שולח WebSocket:
   └─ {action: 'go_to_next_slide', hashId: '...'}

3. Add-in מקבל:
   └─ goToNextSlideInPowerPoint()
      └─ navigateToSlideByIndex()
         ├─ Office.context.document.goToByIdAsync() (מעבר פיזי)
         └─ setTimeout 300ms (המתנה לסיום מעבר)
            └─ processSlideChange(htmlCache, fromWebSocket=true)

4. processSlideChange() בודק:
   └─ האם fromWebSocket === true && slideType === 'question'?
      └─ אם כן: מפעיל טיימר אוטומטית

5. הטיימר מתחיל:
   
   שלב א': ממתין clockActivationDelay שניות (ברירת מחדל: 5)
   └─ זמן להציג את השאלה ולהתכונן
   
   שלב ב': מתחיל ספירה לאחור מ-questionWaitTime שניות (ברירת מחדל: 30)
   └─ מעדכן את kahoot-question-time כל שנייה
   
   שלב ג': כאשר הזמן מגיע ל-0
   └─ עוצר את הטיימר
   └─ מציג הודעה: "⏰ זמן התשובה הסתיים!"
```

### למה setTimeout של 300ms?

**הסיבה:** PowerPoint לוקח זמן להשלים את המעבר בין שקפים.

**התהליך:**
1. `goToByIdAsync()` נקרא ומבקש מ-PowerPoint לעבור לשקף
2. PowerPoint מתחיל אנימציית מעבר (fade, slide, וכו')
3. הפונקציה מחזירה מיד (**לא** מחכה לסיום האנימציה!)
4. אם נקרא ל-`processSlideChange()` מיד → השקף עדיין לא מוכן
5. ה-300ms נותן זמן ל-PowerPoint לסיים את המעבר

**ללא ההמתנה:**
- ❌ `getCurrentSlideNumber()` עלול להחזיר שקף ישן
- ❌ התגים לא יהיו זמינים
- ❌ הטיימר עלול להתחיל בשקף הלא נכון

**עם 300ms:**
- ✅ PowerPoint מסיים את המעבר
- ✅ השקף החדש מוכן וזמין
- ✅ הטיימר מתחיל בשקף הנכון

### מניעת עיבוד כפול (Duplicate Processing Prevention)

**הבעיה:** כאשר מבצעים ניווט דרך WebSocket, קורים 2 דברים:
1. `navigateToSlideByIndex()` קורא ל-`processSlideChange()` (מכוון)
2. PowerPoint מפעיל `DocumentSelectionChanged` event → קורא ל-`processSlideChange()` שוב (לא רצוי!)

**הפתרון:** דגל `isNavigatingViaWebSocket`

```javascript
// event-handlers.js
let isNavigatingViaWebSocket = false;

export async function onSlideChanged(eventArgs, htmlCache) {
    // התעלם מ-events כאשר ניווט דרך WebSocket בתהליך
    if (isNavigatingViaWebSocket) {
        console.log('IGNORED - WebSocket navigation in progress');
        return;
    }
    // ... המשך עיבוד רגיל
}
```

**זרימה:**
```
WebSocket → navigateToSlideByIndex()
              ├─ setWebSocketNavigationFlag(true) 🚩
              ├─ goToByIdAsync() (מעבר פיזי)
              │   └─ DocumentSelectionChanged event → IGNORED ✋
              ├─ setTimeout 300ms
              │   └─ processSlideChange(fromWebSocket=true) ✅
              └─ setTimeout +100ms
                  └─ setWebSocketNavigationFlag(false) 🏁
```

---

## ⚙️ הגדרות הטיימר

### מיקום ההגדרות

הגדרות הטיימר נמצאות ב-`window.presentationSettings`:

```javascript
window.presentationSettings = {
    questionWaitTime: 30,          // זמן המתנה למענה (שניות)
    clockActivationDelay: 5,       // השהיית הפעלת שעון (שניות)
    afterQuestionStatistics: true,
    afterQuestionLeaderboard: false
};
```

### שינוי הגדרות

ניתן לשנות את ההגדרות דרך:
1. לחצן "⚙️ הגדרות" בממשק
2. מסך ההגדרות (`settings.html`)
3. שמירה אוטומטית למצגת

---

## 📋 פונקציות עיקריות

### 1. `startTimer()` - הפעלת הטיימר

**מיקום:** `add-in/modules/game-actions.js`

**תהליך:**
```javascript
export async function startTimer() {
    // 1. עצור טיימר קיים (אם יש)
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
    // 2. קרא הגדרות
    const questionWaitTime = settings.questionWaitTime || 30;
    const clockActivationDelay = settings.clockActivationDelay || 5;
    
    // 3. המתן delay
    setTimeout(() => {
        // 4. אתחל טיימר
        timerRemaining = questionWaitTime;
        updateQuestionTimeDisplay(timerRemaining);
        
        // 5. התחל ספירה לאחור
        timerInterval = setInterval(() => {
            timerRemaining--;
            
            if (timerRemaining <= 0) {
                // סיים טיימר
                clearInterval(timerInterval);
                updateQuestionTimeDisplay(0);
                showStatus('⏰ זמן התשובה הסתיים!');
            } else {
                // עדכן תצוגה
                updateQuestionTimeDisplay(timerRemaining);
            }
        }, 1000);
    }, clockActivationDelay * 1000);
}
```

### 2. `stopTimer()` - עצירת הטיימר

**מיקום:** `add-in/modules/game-actions.js`

```javascript
export async function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
        timerRemaining = 0;
        showStatus('⏸️ טיימר הופסק');
    }
}
```

### 3. `updateQuestionTimeDisplay(timeValue)` - עדכון התצוגה

**תהליך:**
1. חיפוש בכל השקפים
2. איתור shapes עם tag `kahoot-question-time`
3. עדכון הטקסט לערך הנוכחי

```javascript
async function updateQuestionTimeDisplay(timeValue) {
    await PowerPoint.run(async (context) => {
        // עבור על כל השקפים
        for (slide in slides) {
            for (shape in shapes) {
                // מצא tag kahoot-question-time
                if (tag.key === 'kahoot-question-time') {
                    // עדכן טקסט
                    shape.textFrame.textRange.text = timeValue.toString();
                }
            }
        }
    });
}
```

---

## 🔄 טריגרים אוטומטיים

### מתי הטיימר מופעל אוטומטית?

**רק דרך WebSocket (מעבר שקפים מ-Admin):**

```javascript
// taskpane.js - WebSocket handler
socket.on('slide_navigation', (data) => {
    if (data.action === 'go_to_next_slide') {
        goToNextSlideInPowerPoint();
        // ↓ קורא ל-navigateToSlideByIndex()
        //   ↓ setTimeout 300ms (המתנה לסיום מעבר PowerPoint)
        //     ↓ processSlideChange(htmlCache, fromWebSocket=true)
        //       ↓ בודק: fromWebSocket && slideType === 'question'
        //         ↓ מפעיל טיימר!
    }
});
```

```javascript
// event-handlers.js - processSlideChange()
if (fromWebSocket && slideType === 'question') {
    // ✅ תנאים התקיימו - התחל טיימר
    await startTimer();
}
```

**תנאים להפעלה:**
1. ✅ `fromWebSocket === true` - המעבר הגיע מפקודת WebSocket (לא ידני)
2. ✅ `slideType === 'question'` - השקף הוא מסוג שאלה

**למה רק WebSocket?**
- במצב עריכה (מעבר ידני) - לא רוצים שהטיימר יתחיל בכל פעם שעוברים לשקף
- במצב משחק (WebSocket מ-Admin) - רוצים שהטיימר יתחיל אוטומטית

### מתי הטיימר נעצר אוטומטית?

```javascript
if (slideType !== 'question') {
    // עוברים לשקף שאינו שאלה
    await stopTimer();
}
```

**דוגמאות:**
- ✅ עובר משקף שאלה לשקף מעבר → טיימר נעצר
- ✅ עובר משקף שאלה לשקף סטטיסטיקה → טיימר נעצר
- ✅ עובר משקף שאלה לשקף שאלה אחרת → טיימר נעצר והתחיל מחדש (אם דרך WebSocket)

---

## 🎮 מצבי פעולה

### מצב 1: משחק פעיל (`window.gameStarted = true`)

```
opening slide → question slide
                     ↓
              🎯 טיימר מתחיל אוטומטית!
                     ↓
              ⏳ 5 שניות המתנה
                     ↓
              ⏱️ 30 שניות ספירה לאחור
                     ↓
              ⏰ זמן הסתיים
```

### מצב 2: עריכה רגילה (`window.gameStarted = false`)

```
question slide
     ↓
❌ טיימר לא מתחיל אוטומטית
     ↓
✋ ניתן להפעיל ידנית דרך כפתור "התחל טיימר"
```

---

## 🎨 ממשק משתמש

### אלמנט זמן לשקף

**כפתור הוספה:**
```html
<button onclick="addQuestionTime()">⏱️ זמן שאלה</button>
```

**מה זה עושה:**
- יוצר textbox חדש בשקף
- מוסיף tag: `kahoot-question-time = true`
- גודל גופן: 36, צבע: #667eea
- ערך התחלתי: "30"

### טיימר אוטומטי

הטיימר מתחיל **אוטומטית** כאשר:
- המשחק במצב פעיל (`window.gameStarted = true`)
- עוברים לשקף מסוג "question"

**אין צורך בכפתורים ידניים** - הטיימר מופעל באופן אוטומטי על סמך מעבר השקפים.

---

## 🏷️ Tags דינמיים

### Tag: `kahoot-question-time`

**תכונות:**
- **Key:** `kahoot-question-time`
- **Value:** `true`
- **מטרה:** אלמנט שמציג את זמן השאלה הנותר

**עדכון אוטומטי:**
- מתעדכן כל שנייה במהלך הטיימר
- ניתן להציב מספר אלמנטים עם אותו tag
- כל האלמנטים מתעדכנים בו-זמנית

**דוגמה:**
```
שקף 1 - שאלה:
┌─────────────────────────┐
│ שאלה: מהי בירת ישראל?   │
│                         │
│ זמן נותר: [30] שניות   │  ← kahoot-question-time
│                         │
│ א) תל אביב              │
│ ב) ירושלים             │
└─────────────────────────┘

אחרי 10 שניות:
┌─────────────────────────┐
│ שאלה: מהי בירת ישראל?   │
│                         │
│ זמן נותר: [20] שניות   │  ← מתעדכן אוטומטית!
│                         │
│ א) תל אביב              │
│ ב) ירושלים             │
└─────────────────────────┘
```

---

## 🧪 מקרי בדיקה (Test Cases)

### מקרה 1: הפעלה אוטומטית דרך WebSocket

```
נתונים:
- questionWaitTime: 30
- clockActivationDelay: 5

פעולות:
1. Admin שולח: {action: 'go_to_next_slide'}
2. המערכת עוברת לשקף שאלה

תוצאה צפויה:
1. ✅ WebSocket מתקבל
2. ✅ goToNextSlideInPowerPoint() מבוצע
3. ✅ navigateToSlideByIndex() עובר לשקף
4. ⏳ setTimeout 300ms (המתנה לסיום מעבר)
5. ✅ processSlideChange(htmlCache, fromWebSocket=true)
6. ✅ זיהוי: fromWebSocket=true && slideType='question'
7. ⏳ המתנה של 5 שניות (clockActivationDelay)
8. ⏱️ ספירה לאחור: 30, 29, 28... 1, 0
9. ⏰ הודעה: "זמן התשובה הסתיים!"
```

### מקרה 2: ללא הפעלה במעבר ידני (עריכה)

```
נתונים:
- המשתמש עורך את המצגת (לא במצב משחק)

פעולות:
1. עבור לשקף שאלה (חץ/קליק/מעבר ידני)

תוצאה צפויה:
- ✅ processSlideChange(htmlCache, fromWebSocket=false)
- ✅ fromWebSocket=false → הטיימר לא מתחיל
- ✅ ניתן לערוך את השקף בשקט
```

### מקרה 3: עצירה בעבור שקף

```
נתונים:
- טיימר רץ (15 שניות נותרו)

פעולות:
1. Admin שולח מעבר לשקף מעבר (transition)

תוצאה צפויה:
- ⏹️ טיימר נעצר אוטומטית (slideType !== 'question')
```

### מקרה 4: מספר אלמנטי זמן באותו שקף

```
נתונים:
- 3 textboxes עם tag kahoot-question-time
- timerRemaining: 25

פעולות:
1. Admin שולח מעבר לשקף שאלה

תוצאה צפויה:
- ✅ כל 3 ה-textboxes מתעדכנים ל-"25"
- ✅ אחרי שנייה: כולם מתעדכנים ל-"24"
```

### מקרה 5: בדיקת setTimeout 300ms

```
נתונים:
- PowerPoint במצב הצגה
- אנימציית מעבר פעילה

פעולות:
1. Admin שולח go_to_next_slide
2. goToByIdAsync() נקרא

תוצאה צפויה:
- ⏳ t=0ms: goToByIdAsync מתחיל מעבר
- ⏳ t=0-300ms: PowerPoint מבצע אנימציה
- ✅ t=300ms: processSlideChange נקרא
- ✅ השקף החדש מוכן ונגיש
- ✅ הטיימר מתחיל בשקף הנכון
```

---

## 📊 תרשים זמנים (Timeline)

```
t=0s    ┌──────────────────┐
        │ עובר לשקף שאלה   │
        └─────────┬────────┘
                  │
t=0s-5s ┌─────────▼────────┐
        │ המתנת delay      │  clockActivationDelay
        │ (5 שניות)        │
        └─────────┬────────┘
                  │
t=5s    ┌─────────▼────────┐
        │ טיימר מתחיל      │
        │ תצוגה: 30        │
        └─────────┬────────┘
                  │
t=6s    ┌─────────▼────────┐
        │ תצוגה: 29        │  ← עדכון כל שנייה
        └─────────┬────────┘
                  │
        ... (28, 27, 26...)
                  │
t=34s   ┌─────────▼────────┐
        │ תצוגה: 1         │
        └─────────┬────────┘
                  │
t=35s   ┌─────────▼────────┐
        │ תצוגה: 0         │
        │ ⏰ הודעה         │
        │ "זמן הסתיים!"    │
        └──────────────────┘
```

---

## 🔧 קבצים רלוונטיים

| קובץ | תפקיד | פונקציות עיקריות |
|------|-------|------------------|
| `add-in/modules/game-actions.js` | לוגיקת הטיימר | `startTimer()`, `stopTimer()`, `updateQuestionTimeDisplay()` |
| `add-in/modules/event-handlers.js` | הפעלה אוטומטית | `processSlideChange()` - מזהה שקף שאלה ומפעיל טיימר |
| `add-in/modules/navigation.js` | ניווט והפעלת טיימר | `navigateToSlideByIndex()` - קורא ל-processSlideChange אחרי ניווט |
| `add-in/modules/powerpoint-shapes.js` | יצירת אלמנט זמן | `addQuestionTime()` |
| `add-in/slide-types/question.html` | ממשק שקף שאלה | UI לשקף שאלה (ללא כפתורי טיימר ידניים) |
| `add-in/slide-types/settings.html` | הגדרות | `questionWaitTime`, `clockActivationDelay` |
| `add-in/taskpane.js` | WebSocket handlers | מטפל ב-`slide_navigation` events מהשרת |

---

## 💡 טיפים למפתחים

### 1. ניפוי שגיאות (Debugging)

```javascript
// הוסף לוגים לבדיקה:
console.log('⏱️ Timer started, waiting:', clockActivationDelay);
console.log('⏱️ Countdown from:', questionWaitTime);
console.log('🔄 Timer tick:', timerRemaining);
```

### 2. שינוי זמנים באופן דינמי

```javascript
// ניתן לשנות הגדרות תוך כדי:
window.presentationSettings.questionWaitTime = 60; // דקה
window.presentationSettings.clockActivationDelay = 10; // 10 שניות
```

### 3. תמיכה במספר טיימרים

כרגע הטיימר הוא **גלובלי** - רק אחד בכל זמן.
אם צריך מספר טיימרים במקביל, יש לשנות את המבנה ל-Map:

```javascript
const timers = new Map(); // slideId -> timerInterval

function startTimerForSlide(slideId) {
    if (timers.has(slideId)) {
        clearInterval(timers.get(slideId));
    }
    
    const interval = setInterval(() => {
        // ... timer logic
    }, 1000);
    
    timers.set(slideId, interval);
}
```

---

## 🚀 שיפורים עתידיים

### אפשרויות להרחבה:

1. **סאונד בסיום טיימר**
   ```javascript
   if (timerRemaining === 0) {
       playSound('timer-end.mp3');
   }
   ```

2. **התראה ב-10 שניות אחרונות**
   ```javascript
   if (timerRemaining === 10) {
       showWarning('⚠️ 10 שניות נותרו!');
   }
   ```

3. **אנימציה של הטיימר**
   ```javascript
   if (timerRemaining <= 10) {
       // Change color to red, make it pulse
       updateTimerStyle('pulse-red');
   }
   ```

4. **טיימר ויזואלי (Progress Bar)**
   ```javascript
   updateProgressBar(timerRemaining / questionWaitTime * 100);
   ```

---

נוצר: 2025-11-07  
גרסה: 1.0  
מחבר: AI Assistant
