# Flow תהליך טעינת משחק ראשונית

מסמך זה מתאר את תהליך התקשורת בין ה-Add-in, השרת, ה-Admin וה-Sim מרגע פתיחת המצגת ועד לרישום משתמש למשחק.

## סקירה כללית

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Add-in    │◄───►│   Server    │◄───►│   Admin     │     │    Sim      │
│ (PowerPoint)│     │  (Python)   │     │   (React)   │     │   (React)   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
      ▲                   ▲                                        │
      │                   │                                        │
      └───────────────────┴────────────────────────────────────────┘
                    WebSocket + REST API
```

### חזרה אוטומטית של שחקן אחרי sleep/reload במובייל

אפליקציית `game` שומרת ב-`sessionStorage` את ה-PIN הפעיל ואת `uid` השחקן לפי PIN, ושומרת ב-`localStorage` את הכינוי והאווטאר האחרונים. אם ה-WebSocket נופל בגלל sleep או מעבר רשת, ה-client מנסה להתחבר מחדש מיד ומציג מסך `Reconnecting` רק אם ההתאוששות נמשכת יותר מרגע קצר, כדי להימנע מהבהובים בניתוקים חולפים. בחזרה רגילה לטאב, אם ה-socket עדיין מחובר ולא התחיל reconnect אמיתי, לא נשלחת קריאת `join_player` רק בגלל שעבר זמן. אחרי reconnect אמיתי ה-client שולח `join_player` עם אותו `uid` ועם ה-`socketId` החדש, ואז מסנכרן את המסך לפי `gameState` ו-`remainingTime` שמוחזרים מהשרת. timeout ה-reconnect נספר רק כשהטאב visible, ו-rejoin שנכשל זמנית מנוסה שוב עד timeout. אם reconnect או rejoin נכשלים עד timeout, ה-client חוזר למסך הבית במקום להציג מסך "החיבור אבד".

ב-rejoin השרת מחזיר גם מידע פר-שחקן כשקיים: `currentAnswer` בזמן שאלה פעילה כדי לחזור למסך "התשובה נשלחה, ממתינים...", ו-`playerResult` בזמן מסך תוצאות כדי לחזור ל"נכון", "לא נכון" או "הזמן הסתיים". רק אם אין מידע פר-שחקן מתאים, ה-client חוזר ללובי להמתנה לשאלה הבאה.

אם הדף נטען מחדש באותו טאב, ה-client לא שומר `serverUrl` כאמת קבועה. הוא משתמש ב-PIN השמור כדי לבצע מחדש resolve מול ה-LB, ואז מצטרף אוטומטית עם אותו `uid` אם עדיין יש פרופיל שחקן שמור.

---

## שלב 1: חיבור Add-in ל-WebSocket ורישום לחדר

### 1.1 אתחול ה-Add-in

כאשר PowerPoint טוען את ה-Add-in, מתבצעות הפעולות הבאות:

```javascript
// taskpane.js - Office.onReady
Office.onReady(async (info) => {
    // 1. אתחול i18n
    await initI18n('he');
    
    // 2. קבלת/יצירת Hash ID ייחודי מהמצגת
    // הפונקציה getGameHashId() גם שומרת ב-state דרך setHashId()
    const hashId = await getGameHashId();  // מ-state.js
    
    // 3. חיבור WebSocket
    const socket = initializeWebSocket({...});
    setSocket(socket);  // שמירה ב-state
});
```

> **הערה ארכיטקטורה**: כל ה-state של ה-Add-in מנוהל במודול `state.js` באמצעות getters/setters (למשל `getHashId()`, `setHashId()`). אין שימוש ב-`window.*` לניהול state.

### 1.2 יצירת Hash ID

```javascript
// state.js - getGameHashId()
export async function getGameHashId() {
    return await PowerPoint.run(async (context) => {
        const presentation = context.presentation;
        presentation.tags.load("items");
        await context.sync();
        
        // חיפוש tag קיים
        for (const tag of presentation.tags.items) {
            if (tag.key.toLowerCase() === 'kahoot_id') {
                return tag.value;  // מחזיר ID קיים
            }
        }
        
        // יצירת ID חדש
        const newId = generateUniqueId();  // 12 תווים
        presentation.tags.add('kahoot_id', newId);
        await context.sync();
        
        return newId;
    });
}
```

> **הערה**: ה-Hash ID נשמר ב-PowerPoint tags של המצגת ונשאר קבוע גם אם הקובץ מועבר או משנה שם.

### 1.3 חיבור WebSocket

```javascript
// websocket.js - initializeWebSocket()
export function initializeWebSocket(config = {}) {
    socket = io(WEBSOCKET_URL, {  // http://localhost:5000
        transports: ['websocket', 'polling'],
        forceNew: true,
        timeout: 5000
    });
    
    setupSocketEventHandlers(config);
    return socket;
}
```

### 1.4 רישום Socket לחדר

מיד לאחר החיבור, ה-Add-in נרשם לחדר לפי ה-Hash ID:

```javascript
// taskpane.js - onConnect callback
onConnect: async (socket) => {
    const hashId = getHashId();  // מ-state.js
    if (hashId) {
        await registerRoom(socket.id, hashId);
    }
}

// api.js - registerRoom()
export async function registerRoom(socketId, hashId) {
    const response = await makeApiCall('register_room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ socketId, hashId })
    });
    return await response.json();
}
```

### 1.5 טיפול בשרת - רישום לחדר

```python
# game_routes.py - /register_room
@game_bp.route('/register_room', methods=['POST'])
def register_room():
    data = request.get_json()
    socket_id = data.get('socketId')
    hash_id = data.get('hashId')
    
    # הצטרפות לחדר Socket.IO
    socketio.server.enter_room(socket_id, hash_id, namespace='/')
    
    # שמירת מיפוי socket->room
    client_rooms[socket_id] = hash_id
    
    return jsonify({
        'status': 'success',
        'hashId': hash_id,
        'hasActiveGame': hash_id in game_sessions
    })
```

> **תוצאה**: ה-Add-in מחובר ל-WebSocket ורשום לחדר לפי ה-Hash ID. הוא מוכן לקבל הודעות מהשרת.

---

## שלב 2: פתיחת Admin ויצירת Game PIN

### 2.1 פתיחת Admin עם Hash ID

ה-Admin נפתח עם ה-Hash ID ב-URL, למשל: `http://localhost:5174/abc123def456`

```javascript
// admin/App.jsx - useEffect
useEffect(() => {
    // חילוץ Hash ID מה-URL
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const urlHashId = pathParts[0];
    
    if (!urlHashId || urlHashId.length < 8) {
        setError('❌ לא נמצא מזהה משחק בכתובת URL');
        return;
    }
    
    setHashId(urlHashId);
    
    // בדיקה אם יש משחק פעיל
    checkActiveGame(urlHashId);
}, []);
```

### 2.2 בדיקת משחק פעיל

```javascript
// admin/App.jsx - checkActiveGame()
const checkActiveGame = async (hashId) => {
    const url = `${SERVER_URL}/?check_active_game&hash_id=${hashId}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'success' && data.active) {
        // משחק פעיל קיים - שימוש ב-PIN קיים
        setGamePin(data.gamePin);
    } else {
        // אין משחק - יצירת משחק חדש
        const newGamePin = generateGamePin();  // 6 ספרות
        setGamePin(newGamePin);
        registerGame(hashId, newGamePin);
    }
};
```

### 2.3 רישום משחק חדש

```javascript
// admin/App.jsx - registerGame()
const registerGame = async (hashId, gamePin) => {
    const url = `${SERVER_URL}/?register_session&hash_id=${hashId}&game_pin=${gamePin}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'success') {
        console.log('✅ Session registered successfully');
    }
};
```

### 2.4 טיפול בשרת - רישום Session

```python
# game_routes.py - handle_register_session()
def handle_register_session():
    hash_id = request.args.get('hash_id')
    game_pin = request.args.get('game_pin')
    
    # ניקוי session קודם אם קיים
    if hash_id in game_sessions:
        close_game_and_cleanup(...)
    
    # יצירת session חדש
    game_sessions[hash_id] = {
        'gamePin': game_pin,
        'timestamp': time.time(),
        'active': True,
        'acceptingParticipants': False  # עדיין לא מקבל שחקנים
    }
    
    # שליחת הודעה ל-Add-in
    emit_to_room(socketio, client_rooms, logger, 'game_pin_registered', {
        'gamePin': game_pin,
        'hashId': hash_id,
        'timestamp': time.time()
    }, hash_id)
    
    # איפוס לשקף ראשון
    emit_to_room(socketio, client_rooms, logger, 'slide_navigation', {
        'action': 'go_to_first_slide',
        'hashId': hash_id
    }, hash_id)
    
    return jsonify({
        'status': 'success',
        'gamePin': game_pin,
        'resetSent': True
    })
```

### 2.5 טיפול ב-Add-in - קבלת Game PIN

```javascript
// taskpane.js - onGamePinRegistered callback
onGamePinRegistered: async (data) => {
    const gamePin = data.gamePin;
    
    // שמירת נתונים ב-state (מ-state.js)
    if (data.hashId) setHashId(data.hashId);
    if (gamePin) setGamePIN(gamePin);
    
    // עדכון ID וQR בשקפים
    await updateGameIdInSlides(gamePin);
    const currentHashId = getHashId();
    await updateQrCodeInSlides(currentHashId, gamePin);
    
    // איפוס כל מצב המשחק
    resetParticipantAcceptanceState();
    resetParticipantsList();
    resetAnimationState();
    
    // איפוס אלמנטים דינמיים בשקפים
    const settings = getPresentationSettings();
    await updateAllQuestionTimeElements(settings.questionWaitTime || 30);
    await updateAllRespondentsCountElements(0);
    await resetParticipantsNumInSlides();
    await updateParticipantsListInSlides();
    await resetAnswersDistribution();
    await resetLeaderboard();
    
    // ניווט לשקף ראשון
    await goToFirstSlideInPowerPoint();
    
    showStatus(`🎮 משחק פעיל! PIN: ${gamePin}`);
}
```

> **תוצאה**: ה-Admin יצר משחק חדש, ה-Add-in קיבל את ה-PIN, עדכן את השקפים ומוכן למשחק.

---

## שלב 3: פתיחת קבלת משתתפים

### 3.1 מעבר לשקף פתיחה

כאשר ה-Add-in מזהה מעבר לשקף מסוג "opening", הוא מפעיל קבלת משתתפים:

```javascript
// events.js - processSlideChange()
export async function processSlideChange(fromWebSocket = false) {
    // בדיקת סוג השקף
    const slideId = getCurrentSlideId();  // מ-state.js
    const slideType = getSlideType(slideId);
    
    if (slideType === 'opening') {
        // הפעלת קבלת משתתפים
        const hashId = getHashId();  // מ-state.js
        await startAcceptingParticipants(hashId);
    }
}

// api.js - startAcceptingParticipants()
export async function startAcceptingParticipants(hashId) {
    const response = await makeApiCall(
        `?start_accepting_participants&hash_id=${hashId}`
    );
    return response.ok;
}
```

### 3.2 טיפול בשרת - התחלת קבלת משתתפים

```python
# game_routes.py - handle_start_accepting_participants()
def handle_start_accepting_participants():
    hash_id = request.args.get('hash_id')
    
    if not check_game_active(game_sessions, hash_id):
        return jsonify({'status': 'no_game', 'game_closed': True})
    
    # הפעלת קבלת משתתפים
    game_sessions[hash_id]['acceptingParticipants'] = True
    
    return jsonify({
        'status': 'success',
        'message': 'Now accepting participants'
    })
```

> **תוצאה**: השרת מוכן לקבל שחקנים למשחק.

---

## שלב 4: הצטרפות שחקן (Sim)

### 4.1 הזנת Game PIN ב-Sim

```javascript
// sim/App.jsx - connectPlayer()
const connectPlayer = async (player) => {
    const cleanGamePin = gamePin.replace(/-/g, '');  // הסרת מקף
    
    // 1. יצירת WebSocket
    const playerSocket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnection: false,
        forceNew: true
    });
    
    // 2. המתנה לחיבור
    await new Promise((resolve, reject) => {
        playerSocket.on('connect', resolve);
        playerSocket.on('connect_error', reject);
    });
    
    // 3. שליחת בקשת הצטרפות עם Socket ID
    const response = await fetch(`${API_BASE}/?join_player`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            game_pin: cleanGamePin,
            name: player.name,
            icon: playerIcon,
            socketId: playerSocket.id  // לרישום אוטומטי לחדר
        })
    });
    
    const data = await response.json();
    
    if (response.ok && data.uid) {
        // שמירת UID לשחקן
        setPlayerUIDs(prev => ({ ...prev, [player.id]: data.uid }));
        setConnectedPlayers(prev => new Set([...prev, player.id]));
        
        // הגדרת מאזינים לאירועים
        playerSocket.on('answer_time_started', (data) => {...});
        playerSocket.on('player_results', (data) => {...});
        playerSocket.on('game_closed', (data) => {...});
    }
};
```

### 4.2 טיפול בשרת - הצטרפות שחקן

```python
# player_routes.py - handle_join_player()
def handle_join_player():
    data = request.get_json()
    game_pin = data.get('game_pin')
    name = data.get('name')
    icon = data.get('icon')
    socket_id = data.get('socketId')
    
    # מציאת hash_id לפי game_pin
    hash_id = None
    for h_id, session in game_sessions.items():
        if session.get('gamePin') == game_pin:
            hash_id = h_id
            break
    
    if not hash_id:
        return jsonify({'error': 'No game found'}), 404
    
    # בדיקה שהמשחק מקבל משתתפים
    if not game_sessions[hash_id].get('acceptingParticipants'):
        return jsonify({'error': 'Not accepting participants'}), 403
    
    # יצירת UID ייחודי לשחקן
    uid = str(uuid.uuid4())
    
    # רישום השחקן
    player_registry[uid] = {
        'nickname': name,
        'icon': icon,
        'hashId': hash_id,
        'gamePin': game_pin,
        'connected': True,
        'joinedAt': time.time()
    }
    
    # שליחת עדכון ל-Add-in
    emit_to_room(socketio, client_rooms, logger, 'participant_update', {
        'nick': name,
        'icon': icon,
        'type': 'add',
        'user_id': uid,
        'timestamp': time.time()
    }, hash_id)
    
    # רישום Socket לחדר
    if socket_id:
        socketio.server.enter_room(socket_id, hash_id, namespace='/')
        client_rooms[socket_id] = hash_id
        socket_to_player[socket_id] = uid  # קישור socket לשחקן
    
    return jsonify({
        'status': 'success',
        'uid': uid,
        'hashId': hash_id
    })
```

### 4.3 טיפול ב-Add-in - עדכון משתתפים

```javascript
// taskpane.js - onParticipantUpdate callback
onParticipantUpdate: async (data, participantIds) => {
    setCurrentUsers(participantIds.length);  // מ-state.js
    
    // עדכון מספר משתתפים בשקפים
    await updateParticipantsNumInSlides(participantIds.length);
    
    // עדכון רשימת משתתפים בשקפים
    await updateParticipantsListInSlides();
    
    // רענון רשימת השקפים ב-UI
    triggerRefreshSlideList();  // מ-state.js
}
```

```javascript
// websocket.js - handleParticipantUpdate()
function handleParticipantUpdate(data, callback) {
    const { nick, type, user_id, icon } = data;
    
    if (type === 'add') {
        participantsData.set(user_id, {
            userId: user_id,
            nickname: nick,
            icon: icon || '👤',
            score: 0,
            lastAnswerTime: null,
            lastAnswerCorrect: null
        });
    } else if (type === 'remove') {
        participantsData.delete(user_id);
    }
    
    if (callback) {
        callback(data, Array.from(participantsData.keys()));
    }
}
```

> **תוצאה**: השחקן מחובר למשחק, ה-Add-in מעודכן עם מספר המשתתפים, והשקפים מציגים את הנתונים.

---

## דיאגרמת רצף מלאה

```
┌─────────┐          ┌─────────┐          ┌─────────┐          ┌─────────┐
│ Add-in  │          │ Server  │          │  Admin  │          │   Sim   │
└────┬────┘          └────┬────┘          └────┬────┘          └────┬────┘
     │                    │                    │                    │
     │ 1. getGameHashId() │                    │                    │
     │ ─────────────────► │                    │                    │
     │                    │                    │                    │
     │ 2. WebSocket       │                    │                    │
     │    connect         │                    │                    │
     │ ◄─────────────────►│                    │                    │
     │                    │                    │                    │
     │ 3. POST            │                    │                    │
     │    /register_room  │                    │                    │
     │ ──────────────────►│                    │                    │
     │                    │                    │                    │
     │ 4. Joined room     │                    │                    │
     │    {hashId}        │                    │                    │
     │ ◄──────────────────│                    │                    │
     │                    │                    │                    │
     │                    │ 5. GET /{hashId}   │                    │
     │                    │◄───────────────────│                    │
     │                    │                    │                    │
     │                    │ 6. ?check_active   │                    │
     │                    │◄───────────────────│                    │
     │                    │                    │                    │
     │                    │ 7. No active game  │                    │
     │                    │───────────────────►│                    │
     │                    │                    │                    │
     │                    │ 8. ?register_      │                    │
     │                    │    session         │                    │
     │                    │◄───────────────────│                    │
     │                    │                    │                    │
     │ 9. WS:             │                    │                    │
     │    game_pin_       │                    │                    │
     │    registered      │                    │                    │
     │ ◄──────────────────│                    │                    │
     │                    │                    │                    │
     │ 10. Update slides  │                    │                    │
     │     with PIN/QR    │                    │                    │
     │                    │                    │                    │
     │ 11. ?start_        │                    │                    │
     │     accepting      │                    │                    │
     │ ──────────────────►│                    │                    │
     │                    │                    │                    │
     │                    │                    │ 12. Enter PIN      │
     │                    │                    │◄───────────────────│
     │                    │                    │                    │
     │                    │ 13. WebSocket      │                    │
     │                    │     connect        │                    │
     │                    │◄───────────────────────────────────────│
     │                    │                    │                    │
     │                    │ 14. POST           │                    │
     │                    │     ?join_player   │                    │
     │                    │◄───────────────────────────────────────│
     │                    │                    │                    │
     │                    │ 15. {uid, hashId}  │                    │
     │                    │────────────────────────────────────────►│
     │                    │                    │                    │
     │ 16. WS:            │                    │                    │
     │     participant_   │                    │                    │
     │     update         │                    │                    │
     │ ◄──────────────────│                    │                    │
     │                    │                    │                    │
     │ 17. Update slides  │                    │                    │
     │     with count     │                    │                    │
     │                    │                    │                    │
     ▼                    ▼                    ▼                    ▼
```

---

## מבני נתונים עיקריים בשרת

### game_sessions
```python
game_sessions = {
    'abc123def456': {
        'gamePin': '123456',
        'timestamp': 1706100000.0,
        'active': True,
        'acceptingParticipants': True,
        'currentState': 'waiting',  # או 'answering', 'results'
        'currentQuestion': {...}     # במהלך שאלה
    }
}
```

### player_registry
```python
player_registry = {
    'uuid-1234-5678-...': {
        'nickname': 'אלכס כהן',
        'icon': '👨',
        'hashId': 'abc123def456',
        'gamePin': '123456',
        'connected': True,
        'joinedAt': 1706100000.0
    }
}
```

### client_rooms
```python
client_rooms = {
    'socket_id_addin': 'abc123def456',
    'socket_id_player1': 'abc123def456',
    'socket_id_player2': 'abc123def456'
}
```

### socket_to_player
```python
socket_to_player = {
    'socket_id_player1': 'uuid-1234-...',
    'socket_id_player2': 'uuid-5678-...'
}
```

### pin_to_hash (O(1) Reverse Lookup)
```python
# אופטימיזציה לביצועים - מאפשרת חיפוש hash_id לפי gamePin ב-O(1)
# חיוני כאשר אלפי משחקים רצים במקביל
pin_to_hash = {
    '123456': 'abc123def456',  # gamePin -> hashId
    '654321': 'xyz789ghi012'
}
```

**למה צריך את זה:**
- כשמאות-אלפי משחקים רצים במקביל, חיפוש O(n) ב-`game_sessions` הופך ל-bottleneck
- `pin_to_hash` מאפשר לשחקן שמצטרף למשחק לפי PIN למצוא את ה-`hash_id` ב-O(1)
- מתעדכן ב-`handle_register_session` ומתנקה ב-`close_game_and_cleanup`

---

## חוזה תוצאות לשחקן

אירוע `player_results` נשלח מהשרת לכל שחקן עם תוצאה אישית:

```json
{
  "userId": "uuid-1234",
  "nickname": "Player",
  "questionScore": 850,
  "cumulativeScore": 2350,
  "rank": 3,
  "isCorrect": true,
  "correctAnswer": 2,
  "streakCount": 3,
  "answered": true,
  "timestamp": 1710000000000
}
```

`correctAnswer` הוא מספר התשובה הנכונה האמיתית לשאלה, 1-4. `streakCount` הוא מספר התשובות הנכונות ברצף עבור אותו שחקן. הוא מחושב ב-Add-in בזמן עיבוד התוצאות, מתאפס בתשובה שגויה או חוסר מענה, והשרת מעביר אותו לשחקן כחלק מהתוצאה.

ב-Game client יש להשתמש רק ב-`correctAnswer` להצגת התשובה הנכונה במסכי תוצאה שגויה או timeout. אין להשתמש בתשובה שהשחקן בחר כתחליף אם `correctAnswer` חסר.

---

## סיכום האירועים

| אירוע | מקור | יעד | תיאור |
|-------|------|-----|--------|
| `connect` | Client | Server | חיבור WebSocket חדש |
| `game_pin_registered` | Server | Add-in | Admin יצר משחק חדש |
| `slide_navigation` | Server | Add-in | פקודת ניווט לשקף |
| `participant_update` | Server | Add-in | שחקן הצטרף/יצא |
| `answer_time_started` | Server | Sim | התחלת זמן מענה על שאלה |
| `player_answer` | Server | Add-in | שחקן ענה על שאלה |
| `player_results` | Server | Sim | תוצאות שאלה לשחקן |
| `game_closed` | Server | Sim | המשחק נסגר |

---

## קבצים רלוונטיים

| קובץ | תפקיד |
|------|--------|
| `add-in/taskpane.js` | ראשי - אתחול והאזנה לאירועים |
| `add-in/modules/core/websocket.js` | ניהול WebSocket וטיפול באירועים |
| `add-in/modules/core/api.js` | קריאות REST לשרת |
| `add-in/modules/core/state.js` | ניהול Hash ID ומצב המשחק |
| `admin/src/App.jsx` | ממשק Admin ליצירת משחק |
| `sim/src/App.jsx` | סימולטור שחקנים |
| `srv/server.py` | שרת ראשי Flask-SocketIO |
| `srv/routes/game_routes.py` | Routes לניהול משחק |
| `srv/routes/player_routes.py` | Routes לניהול שחקנים |
| `srv/handlers/websocket_handlers.py` | טיפול באירועי WebSocket |
