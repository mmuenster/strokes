# Strokes Gained Tracker

Track your strokes gained across all 4 categories (OTT, APP, ARG, PUTT) with
shot-by-shot data entry.

## Quick Start

```bash
# 1. Install all dependencies (one time)
npm install

# 2. Run both server and client
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

**Shot entry:**
- Each shot pre-fills the starting position from the previous shot's end
- Tap "Holed it!" to record a make
- SG is shown immediately after saving

**Data storage:** SQLite file at `server/strokes.db`. Back it up any time.

## Scripts

```bash
npm run dev           # start both server (port 3001) + client (port 5173)
npm run install:all   # install all workspace deps
```

## Tech

- React 18 + Vite + Tailwind CSS
- Node.js + Express
- SQLite via sql.js (no native compilation needed)
- Recharts for summary charts
