# 🎯 לוגיקת מעבר שקפים במשחק - Slide Navigation Logic

## סקירה כללית

מסמך זה מתאר את הלוגיקה המלאה לקביעת השקף הבא במשחק Kahoot, הכוללת טיפול בשקפים מסוגים שונים והגדרות משחק.

---

## 🎮 עקרונות בסיסיים

### 1. סוגי שקפים במערכת

| סוג שקף | תיאור | צבע זיהוי |
|---------|-------|-----------|
| `opening` | שקף פתיחה | 💜 סגול |
| `question` | שקף שאלה | 🎀 ורוד |
| `statistics` | סטטיסטיקת מענה | 🔵 תכלת |
| `leaderboard` | מובילים | 🟡 זהב |
| `summary` | סיכום | 🌈 צבעוני |
| `transition` | מעבר | 💚 ירוק |
| `settings` | הגדרות | ⚙️ אפור |

### 2. הגדרות משחק רלוונטיות

```javascript
window.presentationSettings = {
    questionWaitTime: 30,                    // זמן המתנה לתשובה (שניות)
    clockActivationDelay: 5,                 // השהיית הפעלת שעון (שניות)
    afterQuestionStatistics: true,           // האם להציג סטטיסטיקה אחרי שאלה
    afterQuestionLeaderboard: false          // האם להציג מובילים אחרי שאלה
};
```

### 3. עקרון שקפים משותפים (Shared Slides) ⭐

**חשוב!** שקפי סטטיסטיקה ומובילים הם **שקפים משותפים** שמשמשים לכל השאלות:
- יש **שקף סטטיסטיקה אחד** במצגת שמשמש לכל השאלות
- יש **שקף מובילים אחד** במצגת שמשמש לכל השאלות
- המערכת **קופצת** לשקפים אלה אחרי כל שאלה ואז **חוזרת** למיקום המקורי

**דוגמה:**
```
1. פתיחה
2. שאלה 1
3. שאלה 2
4. שאלה 3
5. סטטיסטיקה (משותף)
6. מובילים (משותף)

זרימת המשחק:
1 → 2 → 5 → 6 → 3 → 5 → 6 → 4 → 5 → 6
     ↑_______|    ↑_______|    ↑_______|
   חזרה למיקום  חזרה למיקום  חזרה למיקום
   אחרי שאלה 1  אחרי שאלה 2  אחרי שאלה 3
```

**מנגנון הזיכרון:**
```javascript
window.lastQuestionSlideIndex  // שומר את מיקום השאלה האחרונה
```

כאשר עוברים משאלה, המערכת:
1. שומרת את מיקום השאלה ב-`lastQuestionSlideIndex`
2. קופצת לשקף סטטיסטיקה/מובילים
3. אחרי השקפים המיוחדים - חוזרת למיקום שנשמר + 1
4. מאפסת את `lastQuestionSlideIndex`

---

## 📋 לוגיקת ניווט מפורטת

### מקרה 1: שקפים שאינם שאלה, סטטיסטיקה או מובילים

**תרחיש:** המשתמש נמצא על שקף "רגיל" (לדוגמה: `opening`, `transition`, `summary`)

**לוגיקה:**
```
1. נסה לעבור לשקף הבא במצגת (current_index + 1)
2. אם השקף הבא הוא מסוג statistics או leaderboard:
   - דלג עליו
   - המשך לשקף הבא
   - חזור על התהליך עד שתמצא שקף שאינו statistics/leaderboard
3. אם הגעת לסוף המצגת:
   - הישאר בשקף האחרון
```

**דוגמה:**
```
המצגת:
0: opening
1: question
2: statistics    ← דלג
3: leaderboard   ← דלג
4: transition    ← עבור לכאן
5: question

משתמש בשקף 0 (opening):
→ לוחץ "הבא"
→ מדלג על 1 (question מדלג רק אם זה לא שקף נוכחי)
→ מדלג על 2 (statistics)
→ מדלג על 3 (leaderboard)
→ עובר לשקף 4 (transition) ✓
```

**הערה חשובה:** ההתנהגות של דילוג על שקפי statistics ו-leaderboard היא רק כאשר עוברים מ**שקפים רגילים**. כאשר עוברים מ**שקף שאלה**, **שקף סטטיסטיקה**, או **שקף מובילים**, הלוגיקה שונה (ראה מקרים 2-4).

---

### מקרה 2: שקף סטטיסטיקה

**תרחיש:** המשתמש נמצא על שקף מסוג `statistics`

**לוגיקה החדשה (Shared Slides):**
```
1. בדוק את ההגדרה afterQuestionLeaderboard
2. אם afterQuestionLeaderboard = true:
   - חפש את שקף המובילים הראשון במצגת (מכל מקום)
   - עבור אליו
3. אחרת:
   - קרא את window.lastQuestionSlideIndex (המיקום שממנו הגענו)
   - חזור למיקום הזה + 1
   - דלג על כל statistics/leaderboard בדרך
   - אפס את lastQuestionSlideIndex
```

**דוגמה 1: עם מובילים (שקפים משותפים)**
```
המצגת:
0: opening
1: question 1      ← הגענו מכאן (lastQuestionSlideIndex = 1)
2: question 2
3: statistics      ← כאן אנחנו
4: leaderboard     ← עבור לכאן ✓

הגדרות:
- afterQuestionLeaderboard = true

תוצאה: עובר לשקף 4 (leaderboard)
אחר כך: מ-leaderboard חוזרים לשקף 2 (question 2)
```

**דוגמה 2: ללא מובילים - חזרה למיקום המקורי**
```
המצגת:
0: opening
1: question 1      ← הגענו מכאן (lastQuestionSlideIndex = 1)
2: question 2
3: statistics      ← כאן אנחנו
4: leaderboard     ← דלג

הגדרות:
- afterQuestionLeaderboard = false

תוצאה: חוזרים לשקף 2 (question 2) - המיקום אחרי השאלה המקורית
```

---

### מקרה 3: שקף מובילים

**תרחיש:** המשתמש נמצא על שקף מסוג `leaderboard`

**לוגיקה החדשה (Shared Slides):**
```
1. קרא את window.lastQuestionSlideIndex (המיקום שממנו הגענו)
2. חזור למיקום הזה + 1
3. דלג על כל שקפי statistics/leaderboard בדרך
4. אפס את lastQuestionSlideIndex
```

**דוגמה (שקפים משותפים):**
```
המצגת:
0: opening
1: question 1      ← הגענו מכאן (lastQuestionSlideIndex = 1)
2: question 2
3: statistics
4: leaderboard     ← כאן אנחנו
5: transition

תוצאה: חוזרים לשקף 2 (question 2) - המיקום אחרי השאלה המקורית
מדלגים על 3,4 (statistics, leaderboard) ועוברים ישר ל-2
```

---

### מקרה 4: שקף שאלה

**תרחיש:** המשתמש נמצא על שקף מסוג `question`

הלוגיקה מורכבת יותר ותלויה בהגדרות המשחק.

**עקרון חדש: שקפים משותפים**
- המערכת מחפשת את שקף הסטטיסטיקה/מובילים **הראשון במצגת** (לא בהכרח אחרי השאלה)
- שומרת את מיקום השאלה ב-`window.lastQuestionSlideIndex`
- קופצת לשקף המשותף ואז חוזרת למיקום שנשמר

#### 4.1: שאלה + הצג סטטיסטיקה (afterQuestionStatistics = true)

```
1. שמור את currentIndex ב-window.lastQuestionSlideIndex
2. חפש את שקף הסטטיסטיקה הראשון במצגת (מכל מקום)
3. אם נמצא שקף statistics:
   - עבור אליו
4. אם לא נמצא:
   - עבור לשקף הבא (רגיל)
   - אפס את lastQuestionSlideIndex
```

**דוגמה (שקפים משותפים):**
```
המצגת:
0: opening
1: question 1      ← כאן אנחנו
2: question 2
3: statistics      ← עבור לכאן ✓ (השקף המשותף)
4: leaderboard

הגדרות:
- afterQuestionStatistics = true
- afterQuestionLeaderboard = false

תוצאה: 
1. שומר lastQuestionSlideIndex = 1
2. עובר לשקף 3 (statistics)
3. מ-statistics חוזר לשקף 2 (question 2)
```

#### 4.2: שאלה + הצג סטטיסטיקה + הצג מובילים

```
1. שמור את currentIndex ב-window.lastQuestionSlideIndex
2. חפש את שקף הסטטיסטיקה הראשון במצגת
3. עבור לסטטיסטיקה
4. אחרי הצגת הסטטיסטיקה (בלחיצה נוספת על "הבא"):
   - חפש שקף leaderboard הראשון במצגת
   - עבור אליו
5. אחרי הצגת המובילים (בלחיצה נוספת על "הבא"):
   - חזור למיקום lastQuestionSlideIndex + 1
   - דלג על statistics/leaderboard
   - אפס את lastQuestionSlideIndex
```

**דוגמה (שקפים משותפים):**
```
המצגת:
0: opening
1: question 1      ← נקודת התחלה
2: question 2
3: question 3
4: statistics      ← לחיצה 1: כאן (משותף)
5: leaderboard     ← לחיצה 2: כאן (משותף)

הגדרות:
- afterQuestionStatistics = true
- afterQuestionLeaderboard = true

זרימת משחק מלאה:
1 → 4 → 5 → 2 → 4 → 5 → 3 → 4 → 5

הסבר:
1. question 1 (1) → statistics (4) [שמור: lastQuestionSlideIndex=1]
2. statistics (4) → leaderboard (5)
3. leaderboard (5) → question 2 (2) [חזרה ל-1+1=2, אפס את last]
4. question 2 (2) → statistics (4) [שמור: lastQuestionSlideIndex=2]
5. statistics (4) → leaderboard (5)
6. leaderboard (5) → question 3 (3) [חזרה ל-2+1=3]
```

#### 4.3: שאלה + רק מובילים (ללא סטטיסטיקה)

```
1. שמור את currentIndex ב-window.lastQuestionSlideIndex
2. חפש שקף leaderboard הראשון במצגת
3. עבור ישירות אליו
4. אחרי המובילים:
   - חזור למיקום lastQuestionSlideIndex + 1
   - דלג על statistics/leaderboard
   - אפס את lastQuestionSlideIndex
```

**דוגמה (שקפים משותפים):**
```
המצגת:
0: opening
1: question 1      ← כאן אנחנו
2: question 2
3: statistics      (לא משמש)
4: leaderboard     ← עבור לכאן ✓ (משותף)

הגדרות:
- afterQuestionStatistics = false
- afterQuestionLeaderboard = true

זרימה:
1 → 4 → 2 → 4 → סיום

הסבר:
1. question 1 (1) → leaderboard (4) [שמור: lastQuestionSlideIndex=1]
2. leaderboard (4) → question 2 (2) [חזרה ל-1+1=2, מדלג על 3]
3. question 2 (2) → leaderboard (4) [שמור: lastQuestionSlideIndex=2]
```

#### 4.4: שאלה + ללא סטטיסטיקה וללא מובילים

```
1. אל תשמור את lastQuestionSlideIndex (לא צריך)
2. עבור לשקף הרגיל הבא
3. דלג על כל שקפי statistics/leaderboard בדרך
```

**דוגמה:**
```
המצגת:
0: opening
1: question 1      ← כאן אנחנו
2: statistics      ← דלג
3: leaderboard     ← דלג
4: question 2      ← עבור לכאן ✓

הגדרות:
- afterQuestionStatistics = false
- afterQuestionLeaderboard = false

תוצאה: עובר ישירות לשקף 4 (question 2), מדלג על 2,3
```

---

## 🔄 תרשים זרימה (Flowchart)

```
                    ┌─────────────────┐
                    │  לחיצה על "הבא"  │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ האם זה שקף      │
                    │    שאלה?        │
                    └────┬──────┬─────┘
                         │      │
                      כן │      │ לא
                         │      │
         ┌───────────────▼      ▼────────────────┐
         │                                        │
    ┌────▼─────────────────┐        ┌────────────▼────────────┐
    │ האם afterQuestion    │        │ עבור לשקף הבא           │
    │ Statistics = true?   │        │                         │
    └────┬──────────┬──────┘        │ דלג על statistics       │
         │          │                │ ו-leaderboard בדרך      │
      כן │          │ לא            └─────────────────────────┘
         │          │
    ┌────▼──────────▼─────────────┐
    │ האם afterQuestion           │
    │ Leaderboard = true?         │
    └────┬────────────┬────────────┘
         │            │
      כן │            │ לא
         │            │
    ┌────▼────────┐   └──────────────┐
    │             │                  │
    │ 1. עבור    │         ┌─────────▼──────────┐
    │ לסטטיסטיקה │         │ עבור לשקף הבא      │
    │             │         │ (דלג על statistics │
    │ 2. לחיצה   │         │  ו-leaderboard)    │
    │ נוספת:     │         └────────────────────┘
    │ עבור       │
    │ למובילים   │
    │             │
    │ 3. לחיצה   │
    │ נוספת:     │
    │ עבור לשקף  │
    │ הבא        │
    └─────────────┘
```

---

## 💻 יישום טכני

### ⭐ הלוגיקה מיושמת ב-Add-in (לא בשרת!)

הלוגיקה כולה מתבצעת **בצד הלקוח** (add-in) ללא צורך בשרת. השרת רק שולח הודעת WebSocket פשוטה.

---

### Client-Side: Office.js Add-in

**קובץ:** `add-in/taskpane.js`

#### 1. פונקציית חישוב מקומית

```javascript
function calculateNextSlideLocally(currentIndex, currentSlideType, slideIds, slideTypeData, settings, totalSlides) {
    // Build slide types by index
    const slideTypesByIndex = {};
    for (let i = 0; i < slideIds.length; i++) {
        const slideId = slideIds[i];
        if (slideTypeData[slideId]) {
            const slideTypeValue = slideTypeData[slideId];
            if (typeof slideTypeValue === 'object' && slideTypeValue.type) {
                slideTypesByIndex[i] = slideTypeValue.type;
            } else {
                slideTypesByIndex[i] = slideTypeValue;
            }
        }
    }
    
    // LOGIC IMPLEMENTATION
    if (currentSlideType !== 'question') {
        // עבור שקפים רגילים: דלג על statistics ו-leaderboard
        let nextIndex = currentIndex + 1;
        while (nextIndex < totalSlides) {
            const nextType = slideTypesByIndex[nextIndex];
            if (nextType === 'statistics' || nextType === 'leaderboard') {
                nextIndex++;
            } else {
                break;
            }
        }
        return { nextIndex: nextIndex, reason: '...' };
    } else {
        // עבור שקפי שאלה: לוגיקה מורכבת
        const showStatistics = settings.afterQuestionStatistics || false;
        const showLeaderboard = settings.afterQuestionLeaderboard || false;
        
        // חפש סטטיסטיקה
        let statisticsIndex = null;
        if (showStatistics) {
            for (let i = currentIndex + 1; i < totalSlides; i++) {
                if (slideTypesByIndex[i] === 'statistics') {
                    statisticsIndex = i;
                    break;
                }
            }
        }
        
        // חפש מובילים
        let leaderboardIndex = null;
        if (showLeaderboard) {
            for (let i = currentIndex + 1; i < totalSlides; i++) {
                if (slideTypesByIndex[i] === 'leaderboard') {
                    leaderboardIndex = i;
                    break;
                }
            }
        }
        
        // החלט לאן לעבור
        if (showStatistics && statisticsIndex !== null) {
            return { nextIndex: statisticsIndex, reason: 'Going to statistics' };
        } else if (showLeaderboard && leaderboardIndex !== null) {
            return { nextIndex: leaderboardIndex, reason: 'Going to leaderboard' };
        } else {
            // דלג על statistics/leaderboard
            let nextIndex = currentIndex + 1;
            while (nextIndex < totalSlides) {
                const nextType = slideTypesByIndex[nextIndex];
                if (nextType === 'statistics' || nextType === 'leaderboard') {
                    nextIndex++;
                } else {
                    break;
                }
            }
            return { nextIndex: nextIndex, reason: 'Going to next regular slide' };
        }
    }
}
```

#### 2. פונקציית מעבר שקף

```javascript
async function goToNextSlideInPowerPoint() {
    // 1. קבל מידע מ-PowerPoint
    const slideContext = await PowerPoint.run(async (context) => {
        const slides = context.presentation.slides;
        slides.load('items');
        await context.sync();
        
        const selectedSlides = context.presentation.getSelectedSlides();
        selectedSlides.load('items');
        await context.sync();
        
        const currentSlide = selectedSlides.items[0];
        currentSlide.load('id');
        
        const slideIds = [];
        for (let i = 0; i < slides.items.length; i++) {
            slides.items[i].load('id');
        }
        await context.sync();
        
        for (let i = 0; i < slides.items.length; i++) {
            slideIds.push(slides.items[i].id);
        }
        
        return {
            currentIndex: currentIndex,
            currentSlideId: currentSlide.id,
            slideIds: slideIds,
            totalSlides: slides.items.length
        };
    });
    
    // 2. חשב את השקף הבא מקומית
    const currentSlideType = getSlideType(slideContext.currentSlideId);
    const result = calculateNextSlideLocally(
        slideContext.currentIndex,
        currentSlideType,
        slideContext.slideIds,
        window.slideTypeData,
        window.presentationSettings,
        slideContext.totalSlides
    );
    
    // 3. עבור לשקף
    const targetSlideId = slideContext.slideIds[result.nextIndex];
    await navigateToSlideByIndex(result.nextIndex, targetSlideId);
}
```

---

### Server-Side: Python Flask

השרת **אינו מעורב** בלוגיקת החישוב. הוא רק מעביר הודעת WebSocket:

```python
# srv/app.py
@app.route('/', methods=['GET'])
def api_handler():
    if 'next_slide' in request.args:
        hash_id = request.args.get('hash_id')
        
        # שולח הודעה פשוטה - אין חישוב!
        slide_command = {
            'action': 'go_to_next_slide',
            'timestamp': time.time(),
            'hashId': hash_id
        }
        emit_to_room('slide_navigation', slide_command, hash_id)
```

---

## 🧪 מקרי בדיקה (Test Cases)

### מקרה 1: שקף פתיחה → דלג על statistics

```
מצגת:
0: opening       ← נקודת התחלה
1: statistics    ← צריך לדלג
2: question      ← יעד

פעולה: לחץ "הבא" בשקף 0
תוצאה צפויה: עובר לשקף 2 ✓
```

### מקרה 2: שאלה → סטטיסטיקה

```
מצגת:
0: question      ← נקודת התחלה
1: statistics    ← יעד
2: transition

הגדרות: afterQuestionStatistics = true

פעולה: לחץ "הבא" בשקף 0
תוצאה צפויה: עובר לשקף 1 ✓
```

### מקרה 3: שאלה → סטטיסטיקה → מובילים → שקף רגיל

```
מצגת:
0: question        ← התחלה
1: statistics      ← לחיצה 1
2: leaderboard     ← לחיצה 2
3: transition      ← לחיצה 3

הגדרות:
- afterQuestionStatistics = true
- afterQuestionLeaderboard = true

פעולה: 3 לחיצות על "הבא"
תוצאה צפויה: 0 → 1 → 2 → 3 ✓
```

### מקרה 4: שאלה ללא סטטיסטיקה/מובילים

```
מצגת:
0: question        ← התחלה
1: statistics      ← דלג
2: leaderboard     ← דלג
3: transition      ← יעד

הגדרות:
- afterQuestionStatistics = false
- afterQuestionLeaderboard = false

פעולה: לחץ "הבא" בשקף 0
תוצאה צפויה: עובר לשקף 3 ✓
```

### מקרה 5: סטטיסטיקה → מובילים

```
מצגת:
0: question
1: statistics     ← נקודת התחלה
2: leaderboard    ← יעד
3: question

הגדרות: afterQuestionLeaderboard = true

פעולה: לחץ "הבא" בשקף 1
תוצאה צפויה: עובר לשקף 2 (leaderboard) ✓
```

### מקרה 6: מובילים → שקף רגיל

```
מצגת:
0: question
1: statistics
2: leaderboard    ← נקודת התחלה
3: statistics     ← דלג
4: question       ← יעד

פעולה: לחץ "הבא" בשקף 2
תוצאה צפויה: עובר לשקף 4 (question), מדלג על statistics ✓
```

### מקרה 7: סוף מצגת

```
מצגת:
0: opening
1: question
2: summary       ← נקודת התחלה (שקף אחרון)

פעולה: לחץ "הבא" בשקף 2
תוצאה צפויה: נשאר בשקף 2 (הודעה: "כבר בשקף האחרון") ✓
```

---

## 🎯 תרחישים נפוצים

### תרחיש 1: משחק קלאסי (עם סטטיסטיקה ומובילים)

```
מבנה מצגת:
1. opening
2. question 1
3. statistics 1
4. leaderboard
5. transition
6. question 2
7. statistics 2
8. leaderboard
9. summary

הגדרות:
- afterQuestionStatistics = true
- afterQuestionLeaderboard = true

זרימת משחק:
opening → q1 → stat1 → leader → trans → q2 → stat2 → leader → summary
```

### תרחיש 2: משחק מהיר (ללא סטטיסטיקה/מובילים)

```
מבנה מצגת:
1. opening
2. question 1
3. statistics 1     ← לא יוצג
4. question 2
5. statistics 2     ← לא יוצג
6. summary

הגדרות:
- afterQuestionStatistics = false
- afterQuestionLeaderboard = false

זרימת משחק:
opening → q1 → q2 → summary
(דילוג אוטומטי על כל ה-statistics)
```

### תרחיש 3: רק סטטיסטיקה (ללא מובילים)

```
מבנה מצגת:
1. opening
2. question 1
3. statistics 1
4. leaderboard      ← לא יוצג
5. question 2
6. statistics 2
7. summary

הגדרות:
- afterQuestionStatistics = true
- afterQuestionLeaderboard = false

זרימת משחק:
opening → q1 → stat1 → q2 → stat2 → summary
```

---

## 🐛 טיפול בשגיאות ומקרי קצה

### מקרה קצה 1: אין סטטיסטיקה אחרי השאלה

```
הגדרה: afterQuestionStatistics = true
אבל: אין שקף statistics במצגת

פתרון: עבור לשקף הרגיל הבא (התעלם מההגדרה)
```

### מקרה קצה 2: אין מובילים במצגת

```
הגדרה: afterQuestionLeaderboard = true
אבל: אין שקף leaderboard במצגת

פתרון: עבור לשקף הרגיל הבא (התעלם מההגדרה)
```

### מקרה קצה 3: סטטיסטיקה/מובילים בתחילת המצגת

```
מצגת:
0: statistics    ← כאן אנחנו
1: opening

פעולה: לחץ "הבא"
תוצאה: עובר לשקף 1 (opening)

הסבר: ההגדרות של דילוג חלות רק כאשר עוברים מ-שקף רגיל,
לא כאשר נמצאים בפועל על שקף statistics/leaderboard
```

---

## 📊 טבלת סיכום (Shared Slides)

| מצב | afterQuestionStatistics | afterQuestionLeaderboard | תוצאה | שומר lastQuestionSlideIndex? |
|-----|------------------------|-------------------------|-------|------------------------------|
| שקף רגיל | כל ערך | כל ערך | דלג על statistics ו-leaderboard | לא |
| שקף שאלה | ✓ true | ✓ true | statistics → leaderboard → חזרה למיקום | כן (שומר) |
| שקף שאלה | ✓ true | ✗ false | statistics → חזרה למיקום | כן (שומר) |
| שקף שאלה | ✗ false | ✓ true | leaderboard → חזרה למיקום | כן (שומר) |
| שקף שאלה | ✗ false | ✗ false | רגיל (דלג על statistics/leaderboard) | לא |
| שקף סטטיסטיקה | כל ערך | ✓ true | leaderboard (שומר last) | כן (משתמש) |
| שקף סטטיסטיקה | כל ערך | ✗ false | חזרה למיקום (מאפס last) | כן (משתמש ומאפס) |
| שקף מובילים | כל ערך | כל ערך | חזרה למיקום (מאפס last) | כן (משתמש ומאפס) |

**הסבר:**
- **"שומר"** = שומר את האינדקס הנוכחי לשימוש עתידי
- **"משתמש"** = משתמש באינדקס שנשמר בעבר כדי לדעת לאן לחזור
- **"מאפס"** = מאפס את המשתנה אחרי שימוש

---

## 🔄 Flow פשוט ומהיר

```
Admin → Server (HTTP GET)
  ↓
Server → Add-in (WebSocket): {action: 'go_to_next_slide'}
  ↓
Add-in:
  1. קורא slideIds מ-PowerPoint
  2. משתמש ב-window.slideTypeData (זיכרון)
  3. משתמש ב-window.presentationSettings (זיכרון)
  4. מחשב לוגיקה מקומית (calculateNextSlideLocally)
  5. עובר לשקף
```

**יתרונות:**
- ✅ רק 1 WebSocket - פשוט ומהיר
- ✅ אין HTTP roundtrips
- ✅ כל המידע כבר נמצא ב-add-in
- ✅ PowerPoint הוא מקור האמת
- ✅ אין צורך לשמור מידע נוסף בשרת

---

## 🔗 קבצים רלוונטיים

| קובץ | תפקיד | פונקציות רלוונטיות |
|------|-------|-------------------|
| `add-in/taskpane.js` | **לוגיקת הניווט המלאה** | `calculateNextSlideLocally()`, `goToNextSlideInPowerPoint()` |
| `srv/app.py` | שליחת WebSocket בלבד | `api_handler()` - endpoint `?next_slide` |
| `add-in/slide-types/settings.html` | ממשק הגדרות | `saveSettings()`, `loadSettings()` |
| `instructions/GAME_START_FLOW.md` | תיעוד הפעלת משחק | - |
| `instructions/DYNAMIC_BUTTONS_TAGS_GUIDE.md` | תיעוד כפתורים דינמיים | - |

---

## 📝 הערות למפתחים

1. **מזהי שקפים:** המערכת משתמשת ב-UUID של כל שקף (לא מספר שקף) כדי לזהות סוגי שקפים. זה מבטיח שסוגי השקפים נשמרים נכון גם אם משנים את סדר השקפים.

2. **שמירה אוטומטית:** השינויים בהגדרות נשמרים אוטומטית ב-`window.presentationSettings` ונשמרים לשרת.

3. **WebSocket vs HTTP:** מעבר שקפים מתבצע דרך WebSocket (real-time), אבל חישוב השקף הבא מתבצע דרך HTTP POST.

4. **תאימות לאחור:** הקוד תומך גם בגישה הישנה (מעבר ישיר לשקף הבא) לתאימות לאחור.

---

נוצר: 2025-01-05  
עודכן אחרון: 2025-11-04  
גרסה: 2.0 - שקפים משותפים (Shared Slides) עם מנגנון זיכרון  
מחבר: AI Assistant


