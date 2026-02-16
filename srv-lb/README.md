# ⚖️ Kahoot Load Balancer (srv-lb)

## מה זה?

Load Balancer (מאזן עומסים) לשרתי Kahoot - מנהל מספר שרתי משחק (srv) ומפנה שחקנים לשרת הפחות עמוס.

**תפקיד מרכזי**:
- מקבל PIN של משחק חדש מה-Add-in
- בוחר את השרת הכי פחות עמוס
- מחזיר ל-Add-in את כתובת השרת שנבחר
- משחקנים/מנהלים מבצעים resolve על ה-PIN כדי למצוא את השרת הנכון

## 🏗️ ארכיטקטורה

```
┌─────────────┐
│   Add-in    │ (יוצר PIN חדש)
│ PowerPoint  │
└──────┬──────┘
       │ POST /api/resolve (game_pin)
       v
┌─────────────────────┐
│     srv-lb          │ ◄─── Health checks
│   (Port 5000)       │ ◄─── Heartbeats (30s)
│  Load Balancer      │
└──────┬──────────────┘
       │ מחזיר: server_url
       │
       │ ┌──────────────────┐
       ├─► srv (5001)       │
       │  game_sessions: 3  │
       │  connections: 12   │
       │                    │
       ├─► srv (5002)       │
       │  game_sessions: 1  │◄─── בחירה! (הכי פחות עמוס)
       │  connections: 5    │
       │                    │
       └─► srv (5003)       │
          game_sessions: 2  │
          connections: 8    │
          └──────────────────┘

┌──────────────┐
│ Game Client  │ (רוצה להצטרף למשחק)
│   (React)    │
└──────┬───────┘
       │ GET /api/resolve/:pin
       v
┌─────────────────────┐
│     srv-lb          │ מחפש PIN במאגר
│                     │ מחזיר: server_url
└─────────────────────┘
       │
       v
┌─────────────────────┐
│   srv (5002)        │ התחברות ישירה לשרת
│  WebSocket + HTTP   │
└─────────────────────┘
```

## 🚀 התקנה והפעלה

### התקנה
```bash
cd srv-lb

# צור virtual environment
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# או: venv\Scripts\activate.bat  # Windows

# התקן חבילות
pip install -r requirements.txt
```

### הפעלה בסיסית
```bash
python server.py
# רץ על: http://localhost:5000
```

### הפעלה עם פורט מותאם אישית
```bash
python server.py --port 8000
```

## 🌐 API Endpoints

### 1. PIN Resolution - הקצאת שרת למשחק חדש
```http
POST /api/resolve
Content-Type: application/json

{
  "game_pin": "123456"
}
```

**תגובה:**
```json
{
  "status": "success",
  "game_pin": "123456",
  "server_url": "http://192.168.31.22:5002"
}
```

**שימוש**: Add-in קורא לזה כשיוצרים משחק חדש

---

### 2. PIN Lookup - חיפוש שרת קיים
```http
GET /api/resolve/123456
```

**תגובה:**
```json
{
  "status": "success",
  "game_pin": "123456",
  "server_url": "http://192.168.31.22:5002"
}
```

**שימוש**: Game/Admin/Sim clients קוראים לזה כדי למצוא את השרת

---

### 3. Server Registration - רישום שרת חדש
```http
POST /api/servers/register
Content-Type: application/json

{
  "address": "http://192.168.31.22:5001"
}
```

**תגובה:**
```json
{
  "status": "success",
  "server_id": "srv-a1b2c3"
}
```

**שימוש**: srv קורא לזה בהפעלה (אוטומטי)

---

### 4. Heartbeat - עדכון סטטוס שרת
```http
POST /api/servers/{server_id}/heartbeat
Content-Type: application/json

{
  "active_ws_connections": 12,
  "cpu_percent": 15.5,
  "memory_mb": 256.3,
  "active_games_count": 3
}
```

**תגובה:**
```json
{
  "status": "success"
}
```

**שימוש**: srv שולח כל 30 שניות (אוטומטי)

---

### 5. Game Ended Notification
```http
POST /api/servers/{server_id}/game-ended
Content-Type: application/json

{
  "game_pin": "123456"
}
```

**שימוש**: srv מדווח כשמשחק מסתיים

---

### 6. Admin - רשימת שרתים
```http
GET /api/admin/servers
```

**תגובה:**
```json
{
  "status": "success",
  "servers": [
    {
      "server_id": "srv-a1b2c3",
      "address": "http://192.168.31.22:5001",
      "status": "active",
      "registered_at": 1708099200.0,
      "last_heartbeat": 1708099230.0,
      "stats": {
        "active_ws_connections": 12,
        "cpu_percent": 15.5,
        "memory_mb": 256.3,
        "active_games_count": 3
      }
    }
  ]
}
```

---

### 7. Admin - רשימת PINs
```http
GET /api/admin/pins
```

**תגובה:**
```json
{
  "status": "success",
  "pins": [
    {
      "game_pin": "123456",
      "server_id": "srv-a1b2c3",
      "server_address": "http://192.168.31.22:5001",
      "assigned_at": 1708099200.0
    }
  ]
}
```

---

### 8. Status - בדיקת בריאות
```http
GET /
```

**תגובה:**
```json
{
  "status": "ok",
  "service": "kahoot-lb",
  "servers_total": 3,
  "servers_active": 2,
  "active_pins": 5
}
```

## 🔧 אלגוריתם בחירת שרת

השרת נבחר לפי **least-loaded** strategy:

```python
# 1. סינון - רק שרתים פעילים ובריאים
candidates = [s for s in servers
              if s['status'] == 'active'
              and (now - s['last_heartbeat']) < 90]

# 2. מיון - לפי עומס (משחקים פעילים, ואז חיבורים)
candidates.sort(key=lambda s: (
    s['stats']['active_games_count'],
    s['stats']['active_ws_connections']
))

# 3. בחירה - הראשון ברשימה (הכי פחות עמוס)
selected_server = candidates[0]
```

## 🏥 Health Monitoring

### Heartbeat Timeout
- שרת שלא שלח heartbeat ב-**90 שניות** האחרונות נחשב **down**
- Health checker רץ כל **60 שניות** ובודק את כל השרתים
- שרת down לא מקבל משחקים חדשים

### Stale PIN Cleanup
- מוחק PINs של משחקים שהסתיימו לפני **10 דקות**
- רץ כל **10 דקות**
- מונע הצטברות PINs ישנים

## 📁 מבנה קבצים

```
srv-lb/
├── server.py                   # Entry point ראשי
├── requirements.txt            # Python dependencies
├── README.md                   # התיעוד הזה
│
├── models/                     # Data models
│   ├── server_registry.py      # ניהול שרתים
│   └── pin_registry.py         # ניהול PIN->Server mapping
│
├── routes/                     # API routes
│   ├── resolve_routes.py       # /api/resolve
│   ├── registration_routes.py  # /api/servers/register
│   └── admin_routes.py         # /api/admin/*
│
├── utils/                      # Utilities
│   └── scheduler.py            # Background tasks
│
└── logs/                       # Log files
    └── lb.log
```

## 🔗 אינטגרציה עם srv

### הפעלת srv עם load balancer

```bash
# שרת 1
cd srv
python server.py --port 5001 \
  --lb-url http://localhost:5000 \
  --address http://192.168.31.22:5001

# שרת 2
python server.py --port 5002 \
  --lb-url http://localhost:5000 \
  --address http://192.168.31.22:5002

# שרת 3
python server.py --port 5003 \
  --lb-url http://localhost:5000 \
  --address http://192.168.31.22:5003
```

כל srv:
1. ירשום את עצמו ב-LB בהפעלה
2. ישלח heartbeat כל 30 שניות
3. ידווח כשמשחק מסתיים

## 🎯 תרחישי שימוש

### תרחיש 1: יצירת משחק חדש
1. Add-in יוצר PIN: `123456`
2. Add-in שולח `POST /api/resolve` עם `game_pin: 123456`
3. LB בוחר srv פחות עמוס (למשל srv:5002)
4. LB מחזיר `server_url: http://192.168.31.22:5002`
5. Add-in מתחבר ישירות ל-srv:5002

### תרחיש 2: שחקן מצטרף למשחק
1. Game client מבקש PIN מהמשתמש: `123456`
2. Game client שולח `GET /api/resolve/123456`
3. LB מחפש ב-pin_registry ומוצא srv:5002
4. LB מחזיר `server_url: http://192.168.31.22:5002`
5. Game client מתחבר ישירות ל-srv:5002

### תרחיש 3: שרת נופל
1. srv:5002 קורס או מאבד רשת
2. Health checker מגלה אחרי 90 שניות (timeout)
3. LB מסמן srv:5002 כ-`down`
4. משחקים חדשים מופנים לשרתים אחרים
5. PINs קיימים של srv:5002 נשארים זמינים (clients יכולים להמשיך)

### תרחיש 4: משחק מסתיים
1. Add-in סוגר משחק `123456` ב-srv:5002
2. srv:5002 שולח `POST /api/servers/{id}/game-ended` עם `game_pin: 123456`
3. LB מוחק את ה-PIN מה-registry
4. Stale cleanup ינקה PINs שלא דווחו (fallback)

## 🚨 פתרון בעיות

### אין שרתים זמינים (503)
```bash
# בדוק סטטוס LB
curl http://localhost:5000/

# בדוק רשימת שרתים
curl http://localhost:5000/api/admin/servers

# בדוק לוגים
tail -f logs/lb.log
```

**פתרון**: וודא שיש לפחות srv אחד רץ עם `--lb-url`

### PIN לא נמצא (404)
```bash
# בדוק רשימת PINs
curl http://localhost:5000/api/admin/pins

# בדוק אם המשחק עדיין פעיל ב-srv
curl http://192.168.31.22:5001/api/game/123456/status
```

**פתרון**: PIN עלול להימחק אם המשחק הסתיים או ה-srv נפל

### שרת לא מופיע ב-registry
```bash
# וודא ש-srv רץ עם הפרמטרים הנכונים
python server.py --lb-url http://localhost:5000 --address http://192.168.31.22:5001

# בדוק לוגים של srv
tail -f ../srv/logs/kahoot.log
```

**פתרון**: srv צריך לרוץ עם `--lb-url` ו-`--address` תקינים

## 📊 Monitoring

### לוגים
```bash
# צפה בלוגים חיים
tail -f logs/lb.log

# חפש שגיאות
grep ERROR logs/lb.log

# חפש registrations
grep "Registered" logs/lb.log
```

### Metrics
```bash
# סטטוס כללי
curl http://localhost:5000/ | jq

# רשימת שרתים עם stats
curl http://localhost:5000/api/admin/servers | jq

# רשימת PINs פעילים
curl http://localhost:5000/api/admin/pins | jq
```

## 🔒 אבטחה

**הערה**: LB זה **לא** מאובטח ברמת production!

לפרודקציה, הוסף:
- ✅ Authentication בין srv ל-LB (API keys)
- ✅ HTTPS/TLS encryption
- ✅ Rate limiting
- ✅ IP whitelisting
- ✅ Validation מתקדמת של inputs

## 📝 הערות טכניות

### Thread Safety
- `ServerRegistry` ו-`PinRegistry` משתמשים ב-`threading.Lock` לכל פעולה
- אין race conditions במיפוי PINs

### In-Memory Storage
- כל המידע ב-RAM (אין DB)
- Restart של LB = אובדן כל המיפויים
- srv צריך לרשום את עצמו מחדש אחרי restart של LB

### Scalability
- בדיקות: עובד טוב עד ~10 srv instances
- ל-scale גדול יותר: שקול Redis/DB במקום in-memory

---

**🎯 Load Balancer מוכן לשימוש!**

ראה גם:
- [srv/README.md](../srv/README.md) - תיעוד שרת המשחק
- [Architecture Diagram](../ARCHITECTURE.md) - ארכיטקטורה מלאה
