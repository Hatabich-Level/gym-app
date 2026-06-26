# 🏋️ Gym App — React + Node.js

## Структура проекту

```
gym-app/
├── client/               ← React (Vite)
│   ├── src/
│   │   ├── App.jsx       ← головний компонент, роутинг
│   │   ├── api.js        ← запити до сервера
│   │   ├── utils.js      ← допоміжні функції
│   │   ├── index.css     ← всі стилі
│   │   ├── hooks/
│   │   │   └── useStore.js    ← стан (members, abons, payments)
│   │   ├── components/
│   │   │   └── UI.jsx         ← спільні компоненти
│   │   └── pages/
│   │       ├── LoginPage.jsx
│   │       ├── HomePage.jsx
│   │       ├── MembersPage.jsx
│   │       ├── MemberDetail.jsx
│   │       ├── CheckinPage.jsx
│   │       ├── SessionsPage.jsx
│   │       └── FinancePage.jsx
│   └── public/
│       ├── manifest.json
│       ├── icon-192.png
│       └── icon-512.png
├── server.js             ← Express + PostgreSQL
├── package.json
└── README.md
```

---

## Розгортання на Render

### 1. Підготовка репозиторію

```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR/gym-app.git
git push -u origin main
```

### 2. Збірка клієнта (робити перед кожним деплоєм)

```bash
cd client
npm install
npm run build     # збирає в ../public/
cd ..
git add public/
git commit -m "build"
git push
```

### 3. Налаштування Render

1. Зайди на [render.com](https://render.com) → **New → Web Service**
2. Підключи репозиторій
3. Налаштування:
   - **Environment:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `node server.js`

4. **Environment Variables** (додай у Render → Environment):

| Змінна | Значення |
|--------|----------|
| `DATABASE_URL` | (автоматично якщо додав PostgreSQL) |
| `ADMIN_PASSWORD` | твій пароль адміна |
| `TRAINER_PASSWORD` | пароль тренера |
| `SECRET` | будь-який довгий рядок |

5. **Додай PostgreSQL:** Render → New → PostgreSQL → скопіюй `Internal Database URL` в `DATABASE_URL`

---

## Локальна розробка

```bash
# Термінал 1 — сервер
npm install
DATABASE_URL=postgresql://... ADMIN_PASSWORD=admin TRAINER_PASSWORD=trener SECRET=dev node server.js

# Термінал 2 — React dev сервер (з hot reload)
cd client
npm install
npm run dev     # відкриє http://localhost:5173
# проксі на сервер налаштований автоматично в vite.config.js
```

---

## Після змін у коді

```bash
# Збудувати React і задеплоїти
cd client && npm run build && cd ..
git add -A && git commit -m "update" && git push
# Render автоматично перезапустить сервер
```

---

## Паролі за замовчуванням (змінити!)

- Адмін: `admin123`
- Тренер: `trener123`
