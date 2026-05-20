<!-- /autoplan restore point: /home/mmuenster/.gstack/projects/strokes/main-autoplan-restore-20260520-062807.md -->
# Strokes Gained Tracker — Build Plan

## Problem Statement

Golfers who want to analyze their game beyond raw scores need strokes gained (SG) data.
Currently, tracking SG requires expensive apps (Arccos, Shot Scope) or manual spreadsheets.
This web app gives a solo golfer a clean, fast interface to enter shot-by-shot data during
or after a round and immediately see where they're gaining or losing strokes relative to
scratch/PGA Tour baselines.

## What It Does

A full-stack web application for tracking strokes gained across all four categories:

- **SG: Off the Tee (OTT)** — first shot on par 4s and par 5s
- **SG: Approach (APP)** — shots from >30 yards to the green (excluding tee shots)
- **SG: Around the Green (ARG)** — chips, pitches, bunker shots within 30 yards of the green
- **SG: Putting (PUTT)** — all strokes on the putting surface

Each round stores hole-by-hole shot data. The app calculates SG in real time using a
baseline table (expected strokes to hole out from any distance/lie combination), based
on Mark Broadie's publicly available strokes-to-hole-out research.

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend | React 18 + Vite | Modern SPA, fast HMR, user confirmed |
| Styling | Tailwind CSS v3 | Utility-first, no design system needed |
| Backend | Node.js + Express | Simple REST API, user confirmed |
| Database | SQLite via better-sqlite3 | Local persistence, no server setup, easy backup |
| Dev proxy | Vite proxy → Express | Single-port dev experience |

## Data Model

### Tables

```
rounds
  id          INTEGER PK
  course_name TEXT NOT NULL
  date        TEXT NOT NULL (YYYY-MM-DD)
  notes       TEXT
  created_at  TEXT

holes
  id          INTEGER PK
  round_id    INTEGER FK → rounds.id
  number      INTEGER (1-18)
  par         INTEGER (3/4/5)
  yardage     INTEGER (optional)

shots
  id             INTEGER PK
  hole_id        INTEGER FK → holes.id
  sequence       INTEGER  -- shot number within hole (1, 2, 3...)
  category       TEXT     -- OTT | APP | ARG | PUTT
  dist_start     REAL     -- yards from hole (feet for putts stored as fractional yards)
  lie_start      TEXT     -- TEE | FAIRWAY | ROUGH | SAND | RECOVERY | GREEN | FRINGE
  dist_end       REAL     -- yards from hole after shot (0 if holed)
  lie_end        TEXT     -- same enum, null if holed
  holed          INTEGER  -- 0/1 boolean
  sg             REAL     -- computed: baseline(start) - baseline(end) - 1
```

### SG Computation

SG for a single shot = `expected_strokes(dist_start, lie_start) - expected_strokes(dist_end, lie_end) - 1`

If `holed = 1`: `expected_strokes(dist_end) = 0`.

The baseline is a lookup table with linear interpolation between known data points.
Separate baseline curves exist for:
- **Green (putting):** distance in feet → expected putts
- **Fairway:** distance in yards → expected strokes
- **Rough:** distance in yards → expected strokes  
- **Sand:** distance in yards → expected strokes
- **Recovery:** distance in yards → expected strokes
- **Fringe/Tee:** mapped to Fairway baseline

Auto-categorization rules (applied on save, overrideable by user):
- Shot from TEE on a par 4 or par 5 → OTT
- Shot from GREEN → PUTT
- Shot from any lie within 30 yards → ARG
- All other shots → APP

## API Routes

```
GET    /api/rounds              list all rounds (summary, no shots)
POST   /api/rounds              create round
GET    /api/rounds/:id          round detail with holes + shots + SG breakdown
PUT    /api/rounds/:id          update round metadata
DELETE /api/rounds/:id          delete round + cascade

GET    /api/rounds/:id/holes    list holes for round
POST   /api/rounds/:id/holes    add hole to round
PUT    /api/holes/:id           update hole (par, yardage)
DELETE /api/holes/:id           delete hole + its shots

GET    /api/holes/:id/shots     list shots for hole
POST   /api/holes/:id/shots     add shot (triggers SG computation)
PUT    /api/shots/:id           update shot (re-computes SG)
DELETE /api/shots/:id           delete shot
```

## Frontend Pages / Views

```
/                   Round list (home)
  → shows all rounds, total SG per category, date, course
  → "New Round" button

/rounds/new         Round creation form (course, date)

/rounds/:id         Round detail
  → Hole selector (tabs or list)
  → Active hole: shot entry form + shot list
  → SG summary bar (OTT / APP / ARG / PUTT + total)
  → Per-hole SG breakdown table

/rounds/:id/summary Full round summary
  → Category breakdown charts (bar chart)
  → Hole-by-hole heatmap
  → Comparison to previous rounds (trend)
```

## UI Components

- `RoundList` — card per round, SG badges, click to open
- `RoundForm` — course name + date
- `HoleNav` — hole number tabs (1-18)
- `ShotForm` — distance input, lie selector, result inputs, auto-category display
- `ShotList` — ordered shots for hole with SG per shot
- `SGSummaryBar` — 4 category boxes showing totals + vs par
- `SGChart` — recharts bar chart for round summary

## Project Structure

```
strokes/
├── server/
│   ├── index.js           Express entry point
│   ├── db.js              SQLite init + migrations
│   ├── baseline.js        SG baseline tables + interpolation
│   ├── sg.js              SG computation logic
│   └── routes/
│       ├── rounds.js
│       ├── holes.js
│       └── shots.js
├── client/
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── api.js          fetch wrapper
│       ├── pages/
│       │   ├── Home.jsx
│       │   ├── RoundDetail.jsx
│       │   └── RoundSummary.jsx
│       └── components/
│           ├── RoundForm.jsx
│           ├── HoleNav.jsx
│           ├── ShotForm.jsx
│           ├── ShotList.jsx
│           ├── SGSummaryBar.jsx
│           └── SGChart.jsx
├── package.json            root (workspaces)
├── server/package.json
├── client/package.json
└── PLAN.md
```

## Baseline Data Source

Using Mark Broadie's publicly available strokes-to-hole-out data from
"Every Shot Counts" (2014) supplemented with publicly available PGA Tour ShotLink averages.

Putting curve (feet → expected putts):
1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 25, 30, 40, 50, 60, 70, 80, 100 feet

Full shot curves (yards → expected strokes) by lie: Fairway, Rough, Sand, Recovery.
Distance range: 20 to 600 yards. Curves are interpolated linearly between data points.

## Out of Scope (v1)

- User accounts / multi-user
- Mobile app (responsive web only)
- GPS integration
- Video / photo attachment
- Custom baseline calibration per handicap level
- Export to CSV / PDF
- Real-time multiplayer

## Success Criteria

1. Can enter a full 18-hole round (shot by shot) in under 20 minutes
2. SG breakdown is shown immediately after each shot
3. Historical rounds are browseable and comparable
4. No server configuration required beyond `npm install && npm run dev`

## Implementation Order

1. Project scaffold (package.json, Vite config, Tailwind, Express)
2. SQLite schema + migrations
3. SG baseline data + interpolation logic
4. Express API routes + tests
5. React frontend: Round list → Round detail → Shot entry → SG display
6. Round summary with charts
7. Manual QA pass
