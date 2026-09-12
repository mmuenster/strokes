<!-- /autoplan restore point: /home/mmuenster/.gstack/projects/strokes/main-autoplan-restore-20260520-062807.md -->
# Strokes Gained Tracker — Current State

> This started as a build plan; it's now a description of the shipped app.
> Original v1 scope is preserved further down for reference, with deltas noted.

## Problem Statement

Golfers who want to analyze their game beyond raw scores need strokes gained (SG) data.
This web app gives a solo golfer a clean, fast interface to enter shot-by-shot data during
or after a round and immediately see where they're gaining or losing strokes relative to
scratch/PGA Tour or ~15-handicap baselines.

## What It Does

A full-stack web application for tracking strokes gained across four scoring categories
plus penalties:

- **SG: Off the Tee (OTT)** — first shot on par 4s and par 5s
- **SG: Approach (APP)** — shots from >30 yards to the green (excluding tee shots)
- **SG: Around the Green (ARG)** — chips, pitches, bunker shots within 30 yards of the green
- **SG: Putting (PUTT)** — all strokes on the putting surface
- **PENALTY** — OB / hazard shots (added post-v1; not in original plan)

Each round stores hole-by-hole shot data. The app calculates SG in real time using a
baseline table (expected strokes to hole out from any distance/lie combination), based
on Mark Broadie's publicly available strokes-to-hole-out research.

## Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Frontend | React 18 + Vite + React Router | SPA with client-side routing |
| Styling | Tailwind CSS | Utility-first |
| Backend | Node.js + Express | REST API |
| Database | **PostgreSQL** (via `pg`) | Changed from original plan's SQLite/better-sqlite3 — deployed on Railway |
| Charts | Recharts | Round + multi-round summary charts |
| Dev proxy | Vite proxy → Express | Single-port dev experience |

## Data Model

### Tables (as implemented — see `server/db.js`)

```
rounds
  id          SERIAL PK
  course_name TEXT NOT NULL
  date        TEXT NOT NULL (YYYY-MM-DD)
  notes       TEXT NOT NULL DEFAULT ''
  profile     TEXT NOT NULL DEFAULT 'scratch'   -- scratch | ~15 handicap
  created_at  TEXT

holes
  id          SERIAL PK
  round_id    INTEGER FK → rounds.id (cascade delete)
  number      INTEGER (1-18)
  par         INTEGER (3/4/5)
  yardage     INTEGER (optional)

shots
  id             SERIAL PK
  hole_id        INTEGER FK → holes.id (cascade delete)
  sequence       INTEGER  -- shot number within hole (1, 2, 3...)
  category       TEXT     -- OTT | APP | ARG | PUTT | PENALTY
  dist_start     REAL     -- yards from hole (feet for putts stored as fractional yards)
  lie_start      TEXT     -- TEE | FAIRWAY | ROUGH | SAND | RECOVERY | GREEN | FRINGE | OB | HAZARD
  dist_end       REAL     -- yards from hole after shot (0 if holed); nullable for OB shots
  lie_end        TEXT     -- same enum, null if holed
  holed          INTEGER  -- 0/1 boolean
  sg             REAL     -- computed: baseline(start) - baseline(end) - 1

courses          -- not in original plan: course database
  id     SERIAL PK
  name   TEXT NOT NULL
  city   TEXT NOT NULL DEFAULT ''
  state  TEXT NOT NULL DEFAULT ''

course_tees
  id            SERIAL PK
  course_id     INTEGER FK → courses.id (cascade delete)
  name          TEXT NOT NULL
  gender        TEXT NOT NULL DEFAULT 'M'
  rating        REAL
  slope         INTEGER
  total_yardage INTEGER

course_holes
  id      SERIAL PK
  tee_id  INTEGER FK → course_tees.id (cascade delete)
  number  INTEGER (1-18)
  par     INTEGER (3-5)
  yardage INTEGER NOT NULL
```

Paso Robles Golf Club and Hunter Ranch Golf Course are seeded on startup
(`seedCourses()` in `server/db.js`), idempotently.

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
- **OB/Hazard:** treated as PENALTY category, not run through the baseline the same way as scoring shots

Auto-categorization rules (`server/sg.js::autoCategory`, priority OTT → PUTT → ARG → APP):
- Shot from TEE on a par 4 or par 5, sequence 1 → OTT
- Shot from GREEN → PUTT
- Shot within 30 yards (not from TEE) → ARG
- All other shots → APP

## API Routes (as implemented)

```
GET    /api/rounds              list all rounds (summary, no shots)
POST   /api/rounds              create round
GET    /api/rounds/:id          round detail with holes + shots + SG breakdown
PUT    /api/rounds/:id          update round metadata
DELETE /api/rounds/:id          delete round + cascade

GET    /api/rounds/:roundId/holes    list holes for round
POST   /api/rounds/:roundId/holes    add hole to round
PUT    /api/holes/:id                update hole (par, yardage)
DELETE /api/holes/:id                delete hole + its shots

GET    /api/holes/:holeId/shots  list shots for hole
POST   /api/holes/:holeId/shots  add shot (triggers SG computation)
PUT    /api/shots/:id            update shot (re-computes SG)
DELETE /api/shots/:id            delete shot

GET    /api/courses                    list all courses
GET    /api/courses/:id                course detail with tees + holes
POST   /api/courses                    save a course (from lookup or manual entry)
POST   /api/courses/lookup             search GolfLink autocomplete for matching courses
POST   /api/courses/fetch-scorecard    fetch + parse a GolfLink course page's scorecard
```

Not in original plan: the entire `/api/courses/*` surface, including a
GolfLink scraper (`server/routes/courses.js`) that searches courses by name,
ranks matches by city/state, and parses scorecard HTML into tees/pars/yardages.

## Frontend Pages / Views (as implemented)

```
/                    Home — round list, "New Round" form, totals per category
/rounds/:id          Round detail
  → Hole nav (wraps to 2 rows of 9)
  → Active hole: shot entry form (ShotForm) + shot list (ShotList) + edit (ShotEditForm)
  → SG summary bar (OTT / APP / ARG / PUTT + total)
/rounds/:id/summary  Round summary — category breakdown, charts, detailed stats
                      (comprehensive stats, sand shot detail, total feet of putts holed)
/multi-summary       Multi-round combined summary with round selection UI
/courses/new         Add a course — GolfLink lookup/import or manual entry
```

Not in original plan: `/multi-summary` and `/courses/new`.

## UI Components (as implemented)

- `RoundForm` — course name + date (course-aware, ties into course lookup)
- `HoleNav` — hole number tabs, 2 rows of 9, shows "Par N"
- `ShotForm` — distance input, lie selector (incl. OB/HAZARD), result inputs, auto-category display
- `ShotEditForm` — edit an existing shot
- `ShotList` — ordered shots for hole with SG per shot
- `SGSummaryBar` — category boxes showing totals + vs par
- Chart rendering via Recharts, used directly in `RoundSummary.jsx` / `MultiRoundSummary.jsx`
  (no separate `SGChart.jsx` component as originally planned)
- `client/src/roundStats.js`, `client/src/utils.js` — stats/formatting helpers (not in original plan)

## Project Structure (as implemented)

```
strokes/
├── server/
│   ├── index.js           Express entry point
│   ├── db.js              Postgres pool + schema init + course seeding
│   ├── baseline.js        SG baseline tables + interpolation
│   ├── sg.js              Auto-categorization + SG computation
│   └── routes/
│       ├── rounds.js
│       ├── holes.js
│       ├── shots.js
│       └── courses.js     GolfLink lookup/scorecard parsing + course CRUD
├── client/
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── api.js          fetch wrapper
│       ├── roundStats.js
│       ├── utils.js
│       ├── pages/
│       │   ├── Home.jsx
│       │   ├── RoundDetail.jsx
│       │   ├── RoundSummary.jsx
│       │   ├── MultiRoundSummary.jsx
│       │   └── AddCourse.jsx
│       └── components/
│           ├── RoundForm.jsx
│           ├── HoleNav.jsx
│           ├── ShotForm.jsx
│           ├── ShotEditForm.jsx
│           ├── ShotList.jsx
│           └── SGSummaryBar.jsx
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

## Deltas From Original v1 Scope

Things explicitly marked "out of scope" in the original plan, and their actual status:

- User accounts / multi-user — still out of scope
- Mobile app — still out of scope (responsive web only)
- GPS integration — still out of scope
- Video / photo attachment — still out of scope
- Custom baseline calibration per handicap level — partially addressed: round-level
  `profile` field (scratch vs. ~15 handicap), not a fully custom calibration
- Export to CSV / PDF — still out of scope
- Real-time multiplayer — still out of scope

Added beyond original scope:
- PostgreSQL (Railway) instead of local SQLite
- Course database with GolfLink-backed lookup, autocomplete, and scorecard scraping
- OB/HAZARD lies and PENALTY shot category
- Multi-round combined summary page

## Known Gaps

- No automated tests found in the repo (API routes or frontend)
- No `.env.example` — `DATABASE_URL` is required but undocumented in-repo beyond the README

## Success Criteria (original, still the bar)

1. Can enter a full 18-hole round (shot by shot) in under 20 minutes
2. SG breakdown is shown immediately after each shot
3. Historical rounds are browseable and comparable
4. No server configuration required beyond `npm install && npm run dev` (now also requires `DATABASE_URL`)
