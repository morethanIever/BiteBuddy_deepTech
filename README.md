# 🦠 BiteBuddy — Eat Safe. Anywhere.

> Rapid biosensor food safety system for travelers in Malaysia.
> Detects 3 major foodborne bacteria in 15 minutes.

**Stack:** Node.js + Express + sql.js (SQLite) + WebSocket · React + Vite + Tailwind + react-leaflet

## Demo video
[![Watch this](https://img.youtube.com/vi/DOi34U8avsc/0.jpg)](https://youtu.be/DOi34U8avsc)

---

## Quick Start (Local Dev)

### Prerequisites
- Node.js 18+
- npm 9+

### 1. Clone & setup

```bash
git clone https://github.com/your-org/bitebuddy.git
cd bitebuddy
```

### 2. Backend

```bash
cd backend
cp .env .env.local          # already has dev defaults
npm install
npm run seed                # seed 20 KL restaurants + device keys
npm run dev                 # starts on http://localhost:3001
```

**Default admin credentials:**
- Email: `admin@bitebuddy.app`
- Password: `bitebuddy2024`

**Demo device key:** `BB-DEV-001-ALPHA`

### 3. Frontend

```bash
cd frontend
npm install
npm run dev                 # starts on http://localhost:5173
```

Open http://localhost:5173 — Vite proxies `/api` and `/ws` to `:3001` automatically.

---

## Architecture

```
Device (biosensor)
  │  POST /api/scans  (X-Device-Key: BB-DEV-001-ALPHA)
  ▼
Express API (Node.js)
  │  computeScore() → result: safe/warning/danger
  │  UPDATE restaurants SET status, score
  │  broadcast() → WebSocket event
  ▼
sql.js SQLite DB          WebSocket clients
  │                         │  scan_result event
  │                         ▼
  └────────────────► Admin Dashboard (React)
                     live updates without polling

Public routes (no auth):
  GET  /api/restaurants          — map page
  GET  /api/restaurants/verify/:id  — QR scan landing
  POST /api/applications         — B2B signup

Admin routes (JWT required):
  POST /auth/login               — get JWT
  GET  /api/admin/stats          — dashboard metrics
  POST /api/scans/simulate       — demo scan
  GET  /api/admin/applications   — review signups
```

---

## API Reference

### Authentication

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/auth/login` | `{email, password}` | Get JWT token |
| GET  | `/auth/me` | — | Verify current token |

### Restaurants (Public)

| Method | Endpoint | Params | Description |
|--------|----------|--------|-------------|
| GET | `/api/restaurants` | `?status=safe&area=KLCC` | List all with latest scan |
| GET | `/api/restaurants/:id` | — | Detail + 10 scan history |
| GET | `/api/restaurants/verify/:id` | — | QR verify page data |

### Scans

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/scans` | X-Device-Key header | Ingest biosensor reading |
| POST | `/api/scans/simulate` | JWT Admin | Demo simulator |
| GET  | `/api/scans` | JWT Admin | Recent scan feed |

**Device scan payload:**
```json
{
  "restaurant_id": 1,
  "salmonella": "ND",
  "ecoli": "ND",
  "staph": "ND"
}
```
Headers: `X-Device-Key: BB-DEV-001-ALPHA`

**Bacteria values:** `ND` | `Trace` | `Detected`

### Admin (JWT Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/stats` | Dashboard summary metrics |
| GET | `/api/admin/applications` | B2B applications list |
| PATCH | `/api/admin/applications/:id` | Update application status |
| GET | `/api/admin/devices` | Device key management |

### Applications (Public)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/applications` | Submit B2B certification request |

---

## Scoring Algorithm

```
Input: salmonella ∈ {ND, Trace, Detected}
       ecoli      ∈ {ND, Trace, Detected}
       staph      ∈ {ND, Trace, Detected}

Deductions from 100:
  Salmonella Detected → instant DANGER (score 10–30)
  E. coli    Detected → instant DANGER (score 10–30)
  Salmonella Trace    → -20 pts
  E. coli    Trace    → -25 pts
  Staph      Detected → -30 pts
  Staph      Trace    → -10 pts
  ±5 random variance for realism

Result thresholds:
  score ≥ 80 → SAFE    (green)
  score ≥ 50 → WARNING (amber)
  score  < 50 → DANGER (red)
```

---

## WebSocket Events

Connect to `ws://localhost:3001/ws`

**Events received by client:**

```json
{ "type": "connected",     "payload": { "message": "..." } }
{ "type": "scan_result",   "payload": { "restaurant_id": 1, "restaurant_name": "...", "result": "safe", "score": 96, "salmonella": "ND", "ecoli": "ND", "staph": "ND", "created_at": "..." } }
```

The dashboard uses these to update live without polling.

---

## Project Structure

```
bitebuddy/
├── backend/
│   ├── src/
│   │   ├── index.js            ← Express server entry
│   │   ├── db/index.js         ← sql.js SQLite adapter
│   │   ├── lib/
│   │   │   ├── scoring.js      ← bacteria → score algorithm
│   │   │   └── websocket.js    ← WS broadcast manager
│   │   ├── middleware/
│   │   │   └── auth.js         ← JWT + device key auth
│   │   └── routes/
│   │       ├── auth.js
│   │       ├── restaurants.js
│   │       ├── scans.js        ← device ingestion + simulator
│   │       ├── admin.js        ← dashboard stats
│   │       └── applications.js ← B2B signup
│   ├── scripts/seed.js         ← seed 20 KL restaurants
│   ├── .env                    ← dev config
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── main.jsx
    │   ├── App.jsx             ← router + providers
    │   ├── lib/
    │   │   ├── api.js          ← axios instance + interceptors
    │   │   ├── auth.jsx        ← AuthContext
    │   │   ├── toast.jsx       ← ToastContext
    │   │   └── utils.js        ← shared helpers
    │   ├── hooks/
    │   │   └── useWebSocket.js ← WS hook with auto-reconnect
    │   ├── components/
    │   │   ├── Nav.jsx
    │   │   ├── ProtectedRoute.jsx
    │   │   └── Skeleton.jsx
    │   └── pages/
    │       ├── Landing.jsx     ← marketing homepage
    │       ├── MapPage.jsx     ← react-leaflet map
    │       ├── VerifyPage.jsx  ← QR scan public certificate
    │       ├── Dashboard.jsx   ← admin + live WebSocket
    │       ├── Login.jsx
    │       ├── Pricing.jsx
    │       └── Apply.jsx       ← B2B application form
    ├── index.html
    ├── vite.config.js          ← API proxy config
    ├── tailwind.config.js
    └── package.json
```

---

## Deployment (Production)

### Backend → Railway

1. Push to GitHub
2. New project on [railway.app](https://railway.app) → Deploy from GitHub
3. Set environment variables:
   ```
   JWT_SECRET=<strong-random-string>
   ADMIN_EMAIL=admin@bitebuddy.app
   ADMIN_PASSWORD=<strong-password>
   NODE_ENV=production
   FRONTEND_URL=https://your-app.vercel.app
   ```
4. Add start command: `npm start`
5. Run seed: Railway → Shell → `npm run seed`

### Frontend → Vercel

1. Connect GitHub repo to [vercel.com](https://vercel.com)
2. Set root directory: `frontend`
3. Set environment variable:
   ```
   VITE_API_URL=https://your-backend.railway.app
   ```
4. Deploy — Vercel auto-detects Vite

### Post-deploy QR codes

QR codes link to `https://your-vercel-domain.vercel.app/verify/:id` — update `VITE_API_URL` and rebuild if the domain changes.

---

## Demo Flow (for judges)

1. **Map** → Show 20 KL restaurants with color-coded pins
2. **QR scan** → Scan a physical printed QR → verify page loads on judge's phone
3. **Dashboard** → Login → Simulate Scan → live update appears instantly via WebSocket
4. **Apply** → Submit B2B form → appears in admin applications list

---

## Environment Variables

### Backend (`.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `JWT_SECRET` | (required) | JWT signing secret |
| `ADMIN_EMAIL` | `admin@bitebuddy.app` | Admin login email |
| `ADMIN_PASSWORD` | `bitebuddy2024` | Admin login password |
| `NODE_ENV` | `development` | Environment |
| `FRONTEND_URL` | `*` | CORS allowed origin |

### Frontend (`.env.local`)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `""` (Vite proxy) | Backend base URL |
| `VITE_WS_URL` | Auto-derived | WebSocket URL |

---

*Built for hackathon · University of Malaya IP · PI 2024002131*
