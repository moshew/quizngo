# srv-lb Dashboard

דשבורד React לניטור וניהול שרתי המשחק דרך `srv-lb`.

## יכולות

- תצוגת שרתים בטבלה או ב־cards
- נתוני ניטור לכל שרת (CPU, Memory, WS, Games, PINs)
- טעינת רשימת משחקים/שולחנות לשרת ספציפי (`/sim_gamePIN`)
- פעולות ניהול שרת: `drain`, `activate`, `remove`
- רענון ידני ורענון אוטומטי
- גרפים חיים לנתוני מוניטורינג

## הרצה

```bash
npm install
npm run dev
```

ה־Dashboard עולה על `http://localhost:5010`.
ברירת המחדל לכתובת ה־Load Balancer היא `http://localhost:5000`.
אפשר לשנות דרך קובץ `.env`:

```bash
VITE_LB_URL=http://your-lb-host:5000
```
