# Strokes Gained Tracker

Track your strokes gained across all 4 categories (OTT, APP, ARG, PUTT), plus
penalty shots (OB/hazard), with shot-by-shot data entry.

## Quick Start

```bash
# 1. Install all dependencies (one time)
npm install

# 2. Set DATABASE_URL (PostgreSQL — see Data storage below)
echo 'DATABASE_URL=postgres://user:pass@localhost:5432/strokes' > .env

# 3. Run both server and client
npm run dev
```

The app will be at **http://localhost:5173**

Server API: http://127.0.0.1:3001

## How it works

**Baseline:** Uses Mark Broadie's strokes-to-hole-out baseline tables.
Choose between Scratch (PGA Tour) or ~15 Handicap when creating a round.

**Categories:**
- **OTT** — first shot from tee on par 4/5
- **APP** — shots from >30 yards to the green (not a tee shot)
- **ARG** — shots from ≤30 yards (chips, bunker shots)
- **PUTT** — any shot from the green
- **PENALTY** — OB / hazard shots

**Shot entry:**
- Each shot pre-fills the starting position from the previous shot's end
- Tap "Holed it!" to record a make
- SG is shown immediately after saving

**Courses:** Look up a course by name (via GolfLink) to auto-fill tees, par,
and yardage per hole, or add one manually. Paso Robles Golf Club and Hunter
Ranch Golf Course are pre-seeded.

**Summaries:** Per-round summary with category breakdowns and charts
(Recharts), plus a multi-round combined summary for comparing across rounds.

**Data storage:** PostgreSQL (works with a local Postgres or a hosted
instance such as Railway). Set `DATABASE_URL` in `.env`; the server creates
tables and seeds sample courses on startup.

## Scripts

```bash
npm run dev           # start both server (port 3001) + client (port 5173)
npm run install:all   # install all workspace deps
npm run build          # build client for production
npm start              # run server in production mode (serves built client)
```

## Tech

- React 18 + Vite + Tailwind CSS + React Router
- Node.js + Express
- PostgreSQL (via `pg`)
- Recharts for summary charts
