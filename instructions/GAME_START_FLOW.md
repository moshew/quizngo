# 🎮 מנגנון הפעלת משחק - Game Start Flow

## סקירה כללית

המערכת תומכת בהפעלת מספר משחקים במקביל, כאשר כל משחק מזוהה באופן ייחודי ע"י שני מזהים:
- **Hash ID** - מזהה המצגת (נוצר מנתיב הקובץ)
- **Session ID (Game PIN)** - מזהה ה-session הספציפי (נוצר על ידי Admin)

---

## 🔄 זרימת העבודה המלאה

### שלב 1: יצירת QR Code ב-PowerPoint Add-in

```
1. משתמש פותח מצגת ב-PowerPoint
2. שומר את המצגת לדיסק
3. לוחץ על כפתור "משחק" בתוסף
   ├─ Add-in מחשב Hash ID מנתיב הקובץ
   ├─ Add-in שולח בקשה לשרת: GET /game-info/{hash_id}
   └─ מוצג QR code + URL: http://192.168.31.22:3002/{hash_id}
```

**קוד רלוונטי:**
```javascript
// taskpane.js - createHashFromPath()
const hashId = createHashFromPath(fileInfo.fullPath);
// Result: "a65445f6664e"
```

---

### שלב 2: Admin נטען וגנרציית Game PIN

```
1. Admin סורק את QR code או נכנס ל-URL
2. Admin נטען עם hash_id בנתיב: /a65445f6664e
3. Admin בודק שיש hash_id תקין
   ├─ אם אין → 403 Forbidden
   └─ אם יש → ממשיך
4. Admin מפיק Game PIN אקראי (6 ספרות)
5. Admin שולח לשרת: GET /api/?register_session&hash_id={hash}&game_pin={pin}
```

**קוד רלוונטי:**
```javascript
// Admin - App.jsx
const generateGamePin = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
  // Result: "123456" (displayed as 123-456)
}
```

---

### שלב 3: רישום Session בשרת

```
Server מקבל:
├─ hash_id: "a65445f6664e"
└─ game_pin: "123456"

Server שומר:
└─ game_sessions = {
    "a65445f6664e": {
      "gamePin": "123456",
      "timestamp": 1234567890
    }
  }

Server שולח WebSocket ל-Add-in:
└─ emit_to_room('game_pin_registered', {
    gamePin: "123456"
  }, hash_id)
```

**קוד רלוונטי:**
```python
# srv/app.py
@app.route('/', methods=['GET'])
def api_handler():
    if 'register_session' in request.args:
        hash_id = request.args.get('hash_id')
        game_pin = request.args.get('game_pin')
        
        # Store session
        game_sessions[hash_id] = {
            'gamePin': game_pin,
            'timestamp': time.time()
        }
        
        # Notify add-in
        emit_to_room('game_pin_registered', {
            'gamePin': game_pin
        }, hash_id)
```

---

### שלב 4: Add-in מקבל ומציג את Game PIN

```
Add-in מקבל WebSocket:
└─ Event: 'game_pin_registered'
   └─ Data: { gamePin: "123456" }

Add-in מציג:
├─ מחפש בשקף את kahoot-game-id tag
├─ מעדכן את הערך ל-"123-456" (עם מקף)
└─ מציג בממשק: "Game PIN: 123-456"
```

**קוד רלוונטי:**
```javascript
// taskpane.js
socket.on('game_pin_registered', (data) => {
  console.log('🎮 Game PIN registered:', data.gamePin);
  
  // Format as XXX-XXX for display
  const formattedPin = data.gamePin.slice(0, 3) + '-' + data.gamePin.slice(3);
  
  // Update kahoot-game-id in PowerPoint slides
  updateGameIdInSlides(data.gamePin);
  
  // Update UI elements
  document.getElementById('gameId').textContent = formattedPin;
});
```

---

### שלב 5: שחקנים נכנסים למשחק

```
1. שחקן נכנס לאפליקציה (sim)
2. מזין Game PIN: "123456"
3. שחקן שולח לשרת: POST /join-game
   └─ { pin: "123456", nickname: "Player1" }
4. שרת מחפש איזה hash_id תואם ל-PIN
5. שרת מצרף שחקן ל-room של hash_id
6. שרת שולח עדכון ל-Add-in (רק למשחק הזה!)
```

---

## 🏗️ ארכיטקטורה - Rooms & Isolation

### מבנה ה-Rooms

```
WebSocket Rooms:
├─ Room: "a65445f6664e" (Hash ID)
│  ├─ Add-in Client #1 (PowerPoint)
│  ├─ Player #1 (sim)
│  ├─ Player #2 (sim)
│  └─ Admin (web)
│
└─ Room: "f049ebb08096" (Hash ID)
   ├─ Add-in Client #2 (PowerPoint)
   ├─ Player #3 (sim)
   └─ Admin (web)
```

### בידוד בין משחקים

```
משחק A (hash: aaa111, PIN: 123456):
├─ Admin A שולח "עבור לשקף"
└─ emit_to_room('slide_navigation', data, 'aaa111')
   └─ רק Add-in A מקבל! ✅

משחק B (hash: bbb222, PIN: 789012):
├─ לא מושפע כלל מ-A ✅
└─ ממשיך לעבוד עצמאית
```

---

## 📋 טבלת מזהים

| מזהה | מקור | תפקיד | דוגמה |
|------|------|-------|-------|
| **Hash ID** | נוצר מנתיב PPTX | זיהוי מצגת | `a65445f6664e` |
| **Session ID (PIN)** | נוצר על ידי Admin | זיהוי משחק live | `123456` |
| **Player ID** | נוצר בהצטרפות | זיהוי שחקן | `player_abc123` |

---

## 🔐 אבטחה ובידוד

### 1. **אין גישה ללא Hash ID**
```
Admin ללא hash בURL → 403 Forbidden
```

### 2. **WebSocket Messages מבודדים**
```python
# לא:
socketio.emit('slide_navigation', data)  # לכולם! ❌

# כן:
emit_to_room('slide_navigation', data, hash_id)  # רק למשחק! ✅
```

### 3. **Session מנוהל על ידי Admin**
- רק Admin יכול ליצור Session ID
- רק Admin יכול לשלוח פקודות (עבור שקף, וכו')
- Add-in רק מקבל ומציג

---

## 🎯 דוגמה מלאה

### תרחיש: מורה מפעיל 2 כיתות במקביל

#### כיתה א'
```
1. מורה פותח presentation_a.pptx
2. Hash: aaa111
3. Admin נטען → Session PIN: 123456
4. תלמידים נכנסים עם PIN: 123456
5. מורה לוחץ "עבור שקף" → רק כיתה א' עוברת
```

#### כיתה ב'
```
1. מורה פותח presentation_b.pptx  
2. Hash: bbb222
3. Admin נטען → Session PIN: 789012
4. תלמידים נכנסים עם PIN: 789012
5. מורה לוחץ "עבור שקף" → רק כיתה ב' עוברת
```

**תוצאה:** שתי הכיתות עובדות במקביל ללא הפרעות! 🎉

---

## 📝 רשימת בדיקה (Checklist)

לפני שמתחילים משחק:

- [ ] המצגת נשמרה לדיסק
- [ ] לחצת על "משחק" והקוד QR מוצג
- [ ] Admin נטען עם ה-URL הנכון
- [ ] Game PIN מוצג ב-Admin
- [ ] Add-in מציג את אותו Game PIN
- [ ] השרת רץ ומחובר
- [ ] WebSocket מחובר (אין שגיאות בקונסול)

---

## 🐛 Troubleshooting

### בעיה: Admin מציג 403 Forbidden
**פתרון:** ודא שיש hash_id בURL (http://192.168.31.22:3002/{hash_id})

### בעיה: Game PIN לא מוצג ב-Add-in
**פתרון:** 
1. בדוק שהשרת רץ
2. בדוק WebSocket connection בקונסול
3. ודא ש-Add-in רשום ל-room הנכון

### בעיה: פקודות מ-Admin לא מגיעות
**פתרון:**
1. בדוק שה-hash_id נשלח בבקשה
2. בדוק ב-server logs שההודעה נשלחת
3. ודא ש-emit_to_room מקבל את ה-hash הנכון

---

## 🔗 קבצים רלוונטיים

| קובץ | תפקיד |
|------|-------|
| `add-in/taskpane.js` | Hash generation, WebSocket handling |
| `admin/src/App.jsx` | Session ID generation, Admin UI |
| `srv/app.py` | Session management, Room routing |
| `sim/src/App.jsx` | Player join with PIN |

---

## 📊 Sequence Diagram

```
PowerPoint      Add-in          Server          Admin           Player
    |             |               |               |               |
    |--[Open]--->|               |               |               |
    |             |--hash_id---->|               |               |
    |             |<---QR code---|               |               |
    |             |               |<---[Scan]-----|               |
    |             |               |               |               |
    |             |               |<--register----|               |
    |             |<---game_pin---|               |               |
    |             |               |               |               |
    |             |               |<--join_game---|---------------|
    |             |<--player_add--|               |               |
    |             |               |               |               |
    |             |               |<--next_slide--|               |
    |             |<--navigation--|               |               |
    |--[Next]-----|               |               |               |
```

---

נוצר: 2025-01-05
עודכן אחרון: 2025-01-05
גרסה: 2.0

