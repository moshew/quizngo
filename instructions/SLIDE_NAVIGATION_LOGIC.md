# 🎯 לוגיקת מעבר שקפים במשחק - Slide Navigation Logic

## סקירה כללית

מסמך זה מתאר את הלוגיקה המלאה לקביעת השקף הבא במשחק Kahoot, הכוללת טיפול בשקפים מסוגים שונים וטיפול בשקפים מוסתרים.

---

## 🎮 עקרונות בסיסיים

### 1. סוגי שקפים במערכת

| סוג שקף | תיאור | צבע זיהוי |
|---------|-------|-----------|
| `opening` | שקף פתיחה | 💜 סגול |
| `question` | שקף שאלה | 🎀 ורוד |
| `results` | ניתוח תוצאות (סטטיסטיקה + מובילים) | 📊 כחול |
| `summary` | סיכום | 🌈 צבעוני |
| `transition` | מעבר | 💚 ירוק |
| `settings` | הגדרות | ⚙️ אפור |

### 2. הגדרות משחק רלוונטיות

```javascript
window.presentationSettings = {
    questionWaitTime: 30,        // זמן המתנה לתשובה (שניות)
    clockActivationDelay: 5      // השהיית הפעלת שעון (שניות)
};
```

### 3. עקרון שקף ניתוח תוצאות (Results Slide) ⭐

**חשוב!** שקף ניתוח תוצאות הוא **שקף משותף** שמשמש לכל השאלות:
- יש **שקף results אחד** במצגת שמשמש לכל השאלות
- המערכת **קופצת** לשקף זה אחרי כל שאלה ואז **חוזרת** למיקום המקורי

**דוגמה:**
```
1. פתיחה
2. שאלה 1
3. שאלה 2
4. שאלה 3
5. ניתוח תוצאות (משותף)
6. סיכום

זרימת המשחק:
1 → 2 → 5 → 3 → 5 → 4 → 5 → 6
     ↑_____|    ↑_____|    ↑_____|
   חזרה     חזרה      חזרה
```

**מנגנון הזיכרון:**
```javascript
window.lastQuestionSlideIndex  // שומר את מיקום השאלה האחרונה
```

### 4. טיפול בשקפים מוסתרים (Hidden Slides) 🙈

**חשוב!** שקפים מוסתרים נדלגים אוטומטית בזמן הניווט:
- אם שקף מסומן כמוסתר - המערכת תדלג עליו
- ניתן להסתיר כל סוג שקף
- במקום הגדרות "מעברים אוטומטיים" - פשוט מסתירים שקפים לא רצויים

**איך לסמן שקף כמוסתר:**
1. בחר את השקף ב-PowerPoint
2. בחלונית Taskpane, סמן את ה-checkbox: "🙈 דלג על שקף זה במשחק"
3. הסימון נשמר ב-slideTypeData של השקף

**זיהוי שקפים מוסתרים (קוד):**
```javascript
// נשמר ב-slideTypeData של כל שקף
window.slideTypeData[slideId] = {
    type: "question",
    correctAnswer: 1,
    isHidden: true  // ← שדה זה קובע אם השקף מוסתר
};
```

**שימו לב:** זה לא קשור להסתרת שקף הרגילה של PowerPoint!
המנגנון שלנו הוא עצמאי ומאפשר הסתרה רק בזמן משחק Kahoot.

---

## 📋 לוגיקת ניווט מפורטת

### מקרה 1: שקפים שאינם שאלה או results

**תרחיש:** המשתמש נמצא על שקף "רגיל" (לדוגמה: `opening`, `transition`, `summary`)

**לוגיקה:**
```
1. נסה לעבור לשקף הבא במצגת (current_index + 1)
2. אם השקף הבא הוא מסוג results או מוסתר:
   - דלג עליו
   - המשך לשקף הבא
   - חזור על התהליך עד שתמצא שקף תקין
3. אם הגעת לסוף המצגת:
   - הישאר בשקף האחרון שאינו מוסתר
```

---

### מקרה 2: שקף ניתוח תוצאות (results)

**תרחיש:** המשתמש נמצא על שקף מסוג `results`

**לוגיקה:**
```
1. קרא את window.lastQuestionSlideIndex (המיקום שממנו הגענו)
2. חזור למיקום הזה + 1
3. דלג על כל שקפי results ומוסתרים בדרך
4. אפס את lastQuestionSlideIndex
```

**דוגמה:**
```
המצגת:
0: opening
1: question 1      ← הגענו מכאן (lastQuestionSlideIndex = 1)
2: question 2
3: results         ← כאן אנחנו
4: summary

תוצאה: חוזרים לשקף 2 (question 2)
```

---

### מקרה 3: שקף שאלה

**תרחיש:** המשתמש נמצא על שקף מסוג `question`

**לוגיקה (פשוטה!):**
```
1. שמור את currentIndex ב-window.lastQuestionSlideIndex
2. חפש את שקף results הראשון במצגת (שאינו מוסתר)
3. אם נמצא שקף results:
   - עבור אליו
4. אם לא נמצא:
   - עבור לשקף הבא הרגיל (דלג על מוסתרים)
   - אפס את lastQuestionSlideIndex
```

**דוגמה:**
```
המצגת:
0: opening
1: question 1      ← כאן אנחנו
2: question 2
3: results         ← עבור לכאן ✓ (השקף המשותף)
4: summary

תוצאה: 
1. שומר lastQuestionSlideIndex = 1
2. עובר לשקף 3 (results)
3. מ-results חוזר לשקף 2 (question 2)
```

---

## 🔄 תרשים זרימה (Flowchart)

```
                    ┌─────────────────┐
                    │  לחיצה על "הבא"  │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ האם שקף נוכחי   │
                    │    מוסתר?       │
                    └────┬──────┬─────┘
                         │      │
                      כן │      │ לא
                         │      │
                    דלג   │      │
                             │
                    ┌────────▼────────┐
                    │ האם זה שקף      │
                    │    שאלה?        │
                    └────┬──────┬─────┘
                         │      │
                      כן │      │ לא
                         │      │
    ┌────────────────────▼      ▼─────────────────────┐
    │                                                  │
    │  ┌─────────────────────┐      ┌─────────────────▼─────────────┐
    │  │ שמור את המיקום      │      │ האם זה שקף results?           │
    │  │                     │      └────────┬─────────┬────────────┘
    │  │ חפש שקף results     │               │         │
    │  │                     │            כן │         │ לא
    │  │ עבור ל-results      │               │         │
    │  └─────────────────────┘      ┌────────▼────┐    │
    │                                │ חזור למיקום│    │
    │                                │ המקורי+1   │    │
    │                                │ דלג על     │    │
    │                                │ results    │    │
    │                                │ ומוסתרים   │    │
    │                                └─────────────┘    │
    │                                                   │
    │                                          ┌────────▼────────┐
    │                                          │ עבור לשקף הבא   │
    │                                          │ דלג על results  │
    │                                          │ ומוסתרים        │
    │                                          └─────────────────┘
    └──────────────────────────────────────────────────────────────┘
```

---

## 💻 יישום טכני

### ⭐ הלוגיקה מיושמת ב-Add-in (לא בשרת!)

הלוגיקה כולה מתבצעת **בצד הלקוח** (add-in) ללא צורך בשרת.

---

### Client-Side: Office.js Add-in

**קובץ:** `add-in/modules/navigation.js`

#### 1. פונקציית חישוב מקומית

```javascript
export function calculateNextSlideLocally(
    currentIndex, 
    currentSlideType, 
    slideIds, 
    slideTypeData, 
    settings, 
    totalSlides, 
    hiddenSlideIndices = []
) {
    // Helper: האם לדלג על שקף
    const shouldSkipSlide = (index, skipResults = true) => {
        if (hiddenSet.has(index)) return true;  // דלג על מוסתרים
        if (skipResults && slideTypesByIndex[index] === 'results') return true;
        return false;
    };
    
    // Handle results slide
    if (currentSlideType === 'results') {
        if (window.lastQuestionSlideIndex !== null) {
            const returnIndex = findNextValidSlide(window.lastQuestionSlideIndex + 1);
            window.lastQuestionSlideIndex = null;
            return { nextIndex: returnIndex, reason: 'Returning after question' };
        }
    }
    
    // Handle question slide - always go to results
    if (currentSlideType === 'question') {
        window.lastQuestionSlideIndex = currentIndex;
        
        // Find results slide (not hidden)
        for (let i = 0; i < totalSlides; i++) {
            if (slideTypesByIndex[i] === 'results' && !hiddenSet.has(i)) {
                return { nextIndex: i, reason: 'Going to results' };
            }
        }
    }
    
    // Default: next slide (skip hidden and results)
    return { nextIndex: findNextValidSlide(currentIndex + 1), reason: 'Default' };
}
```

---

## 🧪 מקרי בדיקה (Test Cases)

### מקרה 1: שקף פתיחה → דלג על results

```
מצגת:
0: opening       ← נקודת התחלה
1: results       ← צריך לדלג
2: question      ← יעד

פעולה: לחץ "הבא" בשקף 0
תוצאה צפויה: עובר לשקף 2 ✓
```

### מקרה 2: שאלה → ניתוח תוצאות

```
מצגת:
0: question      ← נקודת התחלה
1: results       ← יעד
2: transition

פעולה: לחץ "הבא" בשקף 0
תוצאה צפויה: עובר לשקף 1 ✓
```

### מקרה 3: שאלה → results → שאלה הבאה

```
מצגת:
0: question 1    ← התחלה
1: question 2
2: results       ← לחיצה 1
3: summary

זרימה:
0 → 2 → 1 → 2 → 3
```

### מקרה 4: דילוג על שקף מוסתר

```
מצגת:
0: opening       ← נקודת התחלה
1: transition    ← מוסתר! דלג
2: question      ← יעד

פעולה: לחץ "הבא" בשקף 0
תוצאה צפויה: עובר לשקף 2 (דילוג על 1) ✓
```

### מקרה 5: results מוסתר - לא עוברים אליו

```
מצגת:
0: question      ← נקודת התחלה
1: results       ← מוסתר! דלג
2: summary       ← יעד

פעולה: לחץ "הבא" בשקף 0
תוצאה צפויה: עובר לשקף 2 (אין results זמין) ✓
```

---

## 🎯 תרחישים נפוצים

### תרחיש 1: משחק קלאסי

```
מבנה מצגת:
1. opening
2. question 1
3. question 2
4. question 3
5. results (משותף)
6. summary

זרימת משחק:
opening → q1 → results → q2 → results → q3 → results → summary
```

### תרחיש 2: משחק מהיר (ללא ניתוח תוצאות)

```
מבנה מצגת:
1. opening
2. question 1
3. question 2
4. results      ← מוסתר!
5. summary

זרימת משחק:
opening → q1 → q2 → summary
(דילוג אוטומטי על results כי הוא מוסתר)
```

---

## 📊 טבלת סיכום

| מצב נוכחי | פעולה | תוצאה |
|-----------|-------|-------|
| שקף רגיל | הבא | שקף הבא (דלג על results ומוסתרים) |
| שקף שאלה | הבא | results (שמור מיקום) |
| שקף results | הבא | חזרה למיקום+1 (דלג על results ומוסתרים) |
| כל שקף מוסתר | הבא | דלג לשקף הבא |

---

## 🔗 קבצים רלוונטיים

| קובץ | תפקיד |
|------|-------|
| `add-in/modules/navigation.js` | לוגיקת הניווט המלאה |
| `add-in/slide-types/results.html` | ממשק ניתוח תוצאות |
| `add-in/slide-types/settings.html` | הגדרות (תזמון בלבד) |

---

נוצר: 2025-01-05  
עודכן אחרון: 2026-01-21  
גרסה: 3.0 - ניתוח תוצאות אחיד + דילוג על שקפים מוסתרים  
מחבר: AI Assistant
