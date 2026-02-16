# 🐍 Kahoot Quiz Server (srv)

## מה זה?

שרת משחק פייתון (Flask + SocketIO) שמנהל חדונים חיים עבור PowerPoint Add-in.

**תכונות עיקריות**:
- ✅ WebSocket real-time communication (SocketIO)
- ✅ HTTP REST API למשחקים
- ✅ תמיכה ב-Load Balancer (srv-lb) לניהול מספר שרתים
- ✅ עבודה עצמאית או כחלק ממערך מבוזר

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

# הפעל שרת (standalone)
python server.py
```

## 🌐 שימוש

### מצב Standalone (ללא Load Balancer)

#### 1. הפעל את השרת
```bash
python server.py
# ברירת מחדל: http://localhost:5001
```

#### 2. הפעלה עם פורט מותאם אישית
```bash
python server.py --port 5002
```

#### 3. בדוק שהכל עובד
```bash
# סטטוס שרת
curl http://localhost:5001/

# תיעוד API
curl http://localhost:5001/docs
```

#### 4. עדכן את ה-Add-in
ב-`add-in/modules/core/api.js` וודא:
```javascript
// לפיתוח מקומי
const API_BASE = 'http://localhost:5001';
```

---

### מצב Load Balancer (מומלץ לפרודקציה)

#### 1. הפעל את Load Balancer
```bash
cd ../srv-lb
python server.py
# רץ על: http://localhost:5000
```

#### 2. הפעל שרת אחד או יותר
```bash
# שרת 1
python server.py --port 5001 \
  --lb-url http://localhost:5000 \
  --address http://192.168.31.22:5001

# שרת 2 (טרמינל נפרד)
python server.py --port 5002 \
  --lb-url http://localhost:5000 \
  --address http://192.168.31.22:5002

# שרת 3 (טרמינל נפרד)
python server.py --port 5003 \
  --lb-url http://localhost:5000 \
  --address http://192.168.31.22:5003
```

**פרמטרים**:
- `--port`: הפורט שהשרת ירוץ עליו
- `--lb-url`: כתובת ה-Load Balancer
- `--address`: כתובת ציבורית של השרת הזה (clients יתחברו לכתובת הזו)

#### 3. עדכן Clients להשתמש ב-Load Balancer
```bash
# Add-in
cd add-in
# עדכן .env:
VITE_LB_URL=http://localhost:5000

# Game client
cd game
# עדכן .env:
VITE_LB_URL=http://localhost:5000

# Admin client
cd admin
# עדכן .env:
VITE_LB_URL=http://localhost:5000

# Sim client
cd sim
# עדכן .env:
VITE_LB_URL=http://localhost:5000
```

#### 4. בדוק מצב Load Balancer
```bash
# סטטוס כללי
curl http://localhost:5000/

# רשימת שרתים רשומים
curl http://localhost:5000/api/admin/servers

# רשימת PINs פעילים
curl http://localhost:5000/api/admin/pins
```

## 🔗 Load Balancer Integration

### איך זה עובד?

#### 1. Registration (רישום)
כש-srv מופעל עם `--lb-url`:
```python
# srv מנסה לרשום את עצמו ב-LB
POST {LB_URL}/api/servers/register
{
  "address": "http://192.168.31.22:5001"
}

# LB מחזיר server_id
{
  "status": "success",
  "server_id": "srv-a1b2c3"
}
```

#### 2. Heartbeat (פעימות לב)
srv שולח stats כל 30 שניות:
```python
POST {LB_URL}/api/servers/{server_id}/heartbeat
{
  "active_ws_connections": 12,
  "cpu_percent": 15.5,
  "memory_mb": 256.3,
  "active_games_count": 3
}
```

#### 3. Game Lifecycle
```python
# כשמשחק נוצר - LB מקצה את ה-srv
POST {LB_URL}/api/resolve
{"game_pin": "123456"}
→ {"server_url": "http://192.168.31.22:5001"}

# כשמשחק מסתיים - srv מדווח ל-LB
POST {LB_URL}/api/servers/{server_id}/game-ended
{"game_pin": "123456"}
```

#### 4. Health Checks
- LB בודק heartbeat timeout (90s)
- אם srv לא שלח heartbeat, סטטוס → `down`
- srv down לא מקבל משחקים חדשים

### תרחיש נפילת שרת (Failover)

```
t=0:    srv-1 (3 games), srv-2 (2 games), srv-3 (1 game)
        ↓
t=30s:  srv-2 heartbeat timeout
        ↓
t=90s:  LB marks srv-2 as DOWN
        ↓
        New games → srv-3 (least loaded)
        Existing games on srv-2 → continue (no migration)
```

**הערה**: אין migration אוטומטית של משחקים בין שרתים!

## 📋 API Endpoints

### Game Management
| Endpoint | Method | תיאור |
|----------|--------|--------|
| `/?create_room` | GET | יצירת חדר משחק חדש |
| `/?register_session` | GET/POST | רישום session של add-in |
| `/?start_game` | GET | התחלת משחק |
| `/?close_game` | GET | סגירת משחק |
| `/?check_active_game` | GET | בדיקת משחק פעיל |

### Player Management
| Endpoint | Method | תיאור |
|----------|--------|--------|
| `/?join_player` | GET/POST | הצטרפות שחקן |
| `/?leave_player` | GET/POST | יציאת שחקן |

### Navigation
| Endpoint | Method | תיאור |
|----------|--------|--------|
| `/?next_page` | GET | מעבר לשקף הבא |
| `/?next_slide` | GET | מעבר לשקף הבא (alias) |
| `/?click_action` | GET | ביצוע action בשקף |
| `/?reset_animations` | GET | איפוס אנימציות |

### Info
| Endpoint | Method | תיאור |
|----------|--------|--------|
| `/` | GET | סטטוס שרת |
| `/docs` | GET | תיעוד API מלא |

### WebSocket Events (SocketIO)

**Client → Server**:
```javascript
// התחברות לחדר משחק
socket.emit('join_room', {gamePin: '123456', uid: 'player-123'})

// שליחת תשובה
socket.emit('submit_answer', {
  gamePin: '123456',
  uid: 'player-123',
  answer: 'A',
  timestamp: 1708099200
})

// עדכון שם שחקן
socket.emit('update_name', {
  gamePin: '123456',
  uid: 'player-123',
  name: 'John'
})

// ניתוק
socket.emit('disconnect')
```

**Server → Client**:
```javascript
// אישור הצטרפות
socket.on('joined_room', {status: 'success', gamePin: '123456'})

// רשימת שחקנים מעודכנת
socket.on('players_update', {players: [...]})

// המשחק התחיל
socket.on('game_started', {gamePin: '123456'})

// שקף חדש
socket.on('slide_changed', {slideIndex: 2})

// התשובה נקלטה
socket.on('answer_received', {uid: 'player-123', correct: true})

// תוצאות שאלה
socket.on('question_results', {results: [...]})

// המשחק הסתיים
socket.on('game_ended', {gamePin: '123456'})
```

## 🔧 בדיקות

### בדיקת שרת בסיסית
```bash
# בדוק שהשרת רץ
curl http://localhost:5001/

# צפוי:
# {
#   "status": "ok",
#   "server": "kahoot-srv",
#   "timestamp": 1708099200
# }
```

### בדיקת WebSocket
```bash
# בדוק ש-SocketIO פעיל
curl http://localhost:5001/socket.io/

# צפוי: תגובה מ-SocketIO server
```

### בדיקת משחק מלא (Manual)
```bash
# 1. צור חדר
curl "http://localhost:5001/?create_room&gamePin=123456"

# 2. רשום session
curl "http://localhost:5001/?register_session&gamePin=123456"

# 3. התחל משחק
curl "http://localhost:5001/?start_game&gamePin=123456"

# 4. בדוק משחק פעיל
curl "http://localhost:5001/?check_active_game&gamePin=123456"

# 5. סגור משחק
curl "http://localhost:5001/?close_game&gamePin=123456"
```

### בדיקת Load Balancer Integration
```bash
# הפעל LB
cd ../srv-lb && python server.py &

# הפעל srv עם LB
python server.py --port 5001 --lb-url http://localhost:5000 --address http://localhost:5001

# בדוק רישום
curl http://localhost:5000/api/admin/servers

# צפוי: srv מופיע ברשימה עם status: active
```

## 📁 מבנה קבצים

```
srv/
├── server.py               # Entry point ראשי
├── requirements.txt        # Python dependencies
├── README.md               # התיעוד הזה
│
├── handlers/               # WebSocket handlers
│   └── websocket_handlers.py
│
├── routes/                 # HTTP API routes
│   ├── player_routes.py    # הצטרפות/יציאה של שחקנים
│   ├── game_routes.py      # יצירה/סגירה של משחקים
│   ├── navigation_routes.py # ניווט בשקפים
│   └── info_routes.py      # מידע ותיעוד
│
├── utils/                  # Utilities
│   └── room_utils.py       # פונקציות עזר לחדרים
│
├── logs/                   # Log files
│   └── kahoot.log
│
├── install_python.sh       # התקנה Linux/Mac
├── install_python.bat      # התקנה Windows
├── start_python.sh         # הפעלה Linux/Mac
└── start_python.bat        # הפעלה Windows
```

## 🏗️ ארכיטקטורה

### מצב Standalone
```
┌─────────────┐
│   Add-in    │
│ PowerPoint  │
└──────┬──────┘
       │ HTTP + WebSocket
       v
┌─────────────┐
│ srv (5001)  │
│ Flask+      │
│ SocketIO    │
└─────────────┘
       ^
       │ WebSocket
┌──────┴──────┐
│ Game Client │
│   (React)   │
└─────────────┘
```

### מצב Load Balancer
```
┌─────────────┐
│   Add-in    │ (יוצר PIN)
└──────┬──────┘
       │ 1. POST /api/resolve
       v
┌─────────────┐
│   srv-lb    │ 2. מחזיר server_url
│ (Port 5000) │
└─────────────┘
       │ 3. התחברות ישירה
       v
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ srv (5001)   │ │ srv (5002)   │ │ srv (5003)   │
│ 3 games      │ │ 1 game       │◄─ בחירה! │ 2 games      │
└──────────────┘ └──────────────┘ └──────────────┘
       ^
       │ WebSocket (ישיר)
┌──────┴──────┐
│ Game Client │ (עשה resolve על PIN)
└─────────────┘
```

**תהליך**:
1. Add-in יוצר PIN ושואל את srv-lb: "איזה שרת?"
2. srv-lb בוחר את השרת הכי פחות עמוס
3. Add-in מתחבר **ישירות** לשרת שנבחר
4. Game clients עושים resolve על ה-PIN ומתחברים לאותו שרת

## 🔄 Deploy לפרודקציה

### אופציה 1: Standalone (שרת יחיד)
```bash
# התקן gunicorn
pip install gunicorn

# הפעל עם gunicorn (לא ימליץ - SocketIO עדיף eventlet)
# במקום זאת, השתמש ב-eventlet (built-in):
python server.py --port 5001

# או עם systemd service
sudo systemctl start kahoot-server
```

### אופציה 2: Load Balancer (מספר שרתים)
```bash
# שרת 1: Load Balancer
cd srv-lb
python server.py

# שרת 2-4: Game servers
cd srv
python server.py --port 5001 --lb-url http://lb-server:5000 --address http://game-server-1:5001
python server.py --port 5002 --lb-url http://lb-server:5000 --address http://game-server-2:5002
python server.py --port 5003 --lb-url http://lb-server:5000 --address http://game-server-3:5003
```

### systemd Service Example
```ini
# /etc/systemd/system/kahoot-srv.service
[Unit]
Description=Kahoot Game Server
After=network.target

[Service]
Type=simple
User=kahoot
WorkingDirectory=/opt/kahoot/srv
Environment="PATH=/opt/kahoot/srv/venv/bin"
ExecStart=/opt/kahoot/srv/venv/bin/python server.py --port 5001 --lb-url http://localhost:5000 --address http://192.168.31.22:5001
Restart=always

[Install]
WantedBy=multi-user.target
```

## 🚨 פתרון בעיות

### השרת לא מתחיל
```bash
# בדוק Python
python3 --version

# בדוק virtual environment
source venv/bin/activate
pip list

# בדוק לוגים
tail -f logs/kahoot.log
```

### שרת לא נרשם ב-Load Balancer
```bash
# וודא ש-LB רץ
curl http://localhost:5000/

# בדוק לוגים של srv
tail -f logs/kahoot.log | grep -i "register"

# וודא שהפרמטרים נכונים
python server.py --lb-url http://localhost:5000 --address http://192.168.31.22:5001
```

**שגיאות נפוצות**:
- ❌ `--address` לא נגיש מ-clients (IP פנימי במקום ציבורי)
- ❌ LB לא רץ לפני srv
- ❌ Firewall חוסם את הפורט

### WebSocket לא מתחבר
```bash
# בדוק שהשרת תומך ב-SocketIO
curl http://localhost:5001/socket.io/

# בדוק CORS
# צריך להיות: Access-Control-Allow-Origin: *

# בדוק לוגים של client
# F12 -> Console -> חפש שגיאות WebSocket
```

### CORS שגיאות
השרת מאפשר כל origins (`*`) - אם יש שגיאה, בדוק את ה-client

### חבילות חסרות
```bash
pip install -r requirements.txt --upgrade
```

## 🎯 תכונות עיקריות

✅ **Real-time WebSocket** - תקשורת דו-כיוונית מהירה
✅ **Load Balancer Support** - מדרגיות אופקית
✅ **Health Monitoring** - heartbeats ו-health checks
✅ **In-memory State** - ביצועים גבוהים
✅ **Thread-safe** - eventlet async mode
✅ **לוגים מפורטים** - debug וניטור

## 📊 Monitoring

### לוגים
```bash
# צפה בלוגים חיים
tail -f logs/kahoot.log

# חפש שגיאות
grep ERROR logs/kahoot.log

# חפש WebSocket connections
grep "socket" logs/kahoot.log -i
```

### Health Check
```bash
# בדיקת בריאות בסיסית
curl http://localhost:5001/

# בדיקת מצב משחק ספציפי
curl http://localhost:5001/api/game/123456/status
```

### Stats (אם רשום ב-LB)
השרת שולח stats ל-LB כל 30 שניות:
- `active_ws_connections` - מספר חיבורי WebSocket פעילים
- `cpu_percent` - אחוז שימוש ב-CPU
- `memory_mb` - שימוש בזיכרון (MB)
- `active_games_count` - מספר משחקים פעילים

## 📞 תמיכה

- **לוגים**: `logs/kahoot.log`
- **תיעוד API**: `http://localhost:5001/docs`
- **Load Balancer**: [srv-lb/README.md](../srv-lb/README.md)

---

**🎉 שרת המשחק מוכן לשימוש!**

ראה גם:
- [srv-lb/README.md](../srv-lb/README.md) - Load Balancer documentation
- [Architecture Diagram](../ARCHITECTURE.md) - ארכיטקטורה מלאה
