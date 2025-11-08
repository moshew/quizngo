# 🌐 הוראות גישה ברשת - Network Access Guide

## מטרה
לאפשר גישה לסימולטור ול-Admin ממחשבים אחרים ברשת המקומית.

---

## שלב 1: גלה את כתובת ה-IP של המחשב שלך

### Windows:
```bash
ipconfig
```
חפש: **IPv4 Address** (דוגמה: `192.168.1.100`)

### Mac:
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

### Linux:
```bash
ip addr show | grep "inet " | grep -v 127.0.0.1
```

**דוגמה לתוצאה:** `192.168.1.100`

---

## שלב 2: הגדר את השרת (Python)

השרת כבר מוגדר לקבל חיבורים מהרשת:
- בקובץ `srv/config.py` יש: `HOST = '0.0.0.0'`
- זה אומר שהשרת מאזין על **כל הממשקים**

**ודא שהשרת רץ:**
```bash
cd srv
./start_python.sh   # Mac/Linux
start_python.bat    # Windows
```

---

## שלב 3: הגדר את ה-SIM

### אופציה 1: קובץ .env (מומלץ)

1. צור קובץ `.env` בתיקיית `sim/`:
```bash
cd sim
cp .env.example .env
```

2. ערוך את הקובץ `.env`:
```env
VITE_SERVER_URL=http://192.168.1.100:5000
```
(החלף `192.168.1.100` בכתובת ה-IP שלך)

3. הפעל מחדש את ה-SIM:
```bash
npm start
```

### אופציה 2: שינוי ישיר בקוד (לא מומלץ)

ערוך `sim/src/App.jsx`:
```javascript
const SERVER_URL = 'http://192.168.1.100:5000'  // שנה כאן
```

---

## שלב 4: הגדר את ה-Admin

### אופציה 1: קובץ .env (מומלץ)

1. צור קובץ `.env` בתיקיית `admin/`:
```bash
cd admin
cp .env.example .env
```

2. ערוך את הקובץ `.env`:
```env
VITE_SERVER_URL=http://192.168.1.100:5000
```

3. הפעל מחדש את ה-Admin:
```bash
npm start
```

---

## שלב 5: פתח את חומת האש (Firewall)

### Windows:
1. פתח **Windows Defender Firewall**
2. לחץ על **Advanced Settings**
3. **Inbound Rules** → **New Rule**
4. בחר **Port** → הוסף פורטים: `3001, 3002, 5000`
5. אפשר את החיבור

### Mac:
```bash
# הפעל את חומת האש אם היא כבויה
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate on

# אפשר את האפליקציות
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /path/to/node
```

### Linux (Ubuntu):
```bash
sudo ufw allow 3001/tcp
sudo ufw allow 3002/tcp
sudo ufw allow 5000/tcp
sudo ufw reload
```

---

## שלב 6: גישה ממחשב אחר ברשת

### לגישה ל-SIM:
```
http://192.168.1.100:3001
```

### לגישה ל-Admin:
```
http://192.168.1.100:3002/YOUR_HASH_ID
```

### לגישה ישירה לשרת (API):
```
http://192.168.1.100:5000
```

---

## בדיקת תקינות

### 1. בדוק שהשרת זמין ברשת:
ממחשב אחר, פתח דפדפן וגש ל:
```
http://192.168.1.100:5000
```
אמור להציג: "Kahoot Quiz Manager API"

### 2. בדוק WebSocket:
פתח Console (F12) ב-SIM וחפש:
```
✅ WebSocket connected
```

### 3. בדוק CORS:
אם אתה רואה שגיאת CORS, ודא ב-`srv/config.py`:
```python
ALLOWED_ORIGINS = [
    '*'  # מאפשר גישה מכל מקור
]
```

---

## פתרון בעיות נפוצות

### 🔴 לא מצליח להתחבר לשרת

**בעיה:** "Failed to connect" או "Network Error"

**פתרונות:**
1. ✅ ודא שהשרת רץ: `ps aux | grep python` או Task Manager
2. ✅ בדוק שהכתובת נכונה: `ping 192.168.1.100`
3. ✅ ודא שחומת האש פתוחה
4. ✅ ודא ששני המחשבים באותה רשת

---

### 🔴 WebSocket לא מתחבר

**בעיה:** "WebSocket disconnected"

**פתרונות:**
1. ✅ ודא ש-CORS מוגדר נכון בשרת
2. ✅ בדוק את ה-URL ב-Console
3. ✅ נסה לרענן את הדף (F5)

---

### 🔴 חומת אש חוסמת

**בעיה:** "Connection timed out"

**פתרון:**
1. זמנית כבה את חומת האש לבדיקה
2. אם עובד, הוסף כלל קבוע לפורטים 3001, 3002, 5000

---

## טבלת פורטים

| שירות | פורט | מטרה |
|-------|------|------|
| SIM | 3001 | ממשק הסימולטור |
| Admin | 3002 | ממשק הניהול |
| Server (API) | 5000 | שרת Python - API + WebSocket |

---

## דוגמת תצורה מלאה

**מחשב Server (192.168.1.100):**
```bash
# הפעל שרת
cd srv
./start_python.sh

# הפעל SIM
cd ../sim
VITE_SERVER_URL=http://192.168.1.100:5000 npm start

# הפעל Admin
cd ../admin
VITE_SERVER_URL=http://192.168.1.100:5000 npm start
```

**מחשב Client (192.168.1.200):**
- פתח דפדפן: `http://192.168.1.100:3001` (SIM)
- פתח דפדפן: `http://192.168.1.100:3002/abc123` (Admin)

---

## אבטחה

⚠️ **לסביבת פיתוח בלבד!**

בסביבת ייצור (production):
1. השתמש ב-HTTPS (SSL/TLS)
2. הגדר CORS רק לדומיינים ספציפיים
3. השתמש ב-authentication
4. הגבל גישה לפורטים

---

**עודכן:** נובמבר 8, 2025
