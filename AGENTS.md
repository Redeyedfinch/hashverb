# AGENTS.md — read this first

This is the **frontend** of the **Hashverb OS**, the #Hash student tech club's
internal operations platform. Read this one file and you can work without
scanning every module.

## What it is / how it runs

A **static site, no build step**: plain ES5-style JS modules loaded via
`<script>` tags in `index.html`, RetroUI CSS in `styles/app.css`. Deployed to
**GitHub Pages (`redeyedfinch.github.io/hashverb`)** simply by `git push`
(~1 min to go live). No bundler, no framework.

The **backend is a separate repo**, `dev/hash` (`apps/os/`, Google Apps Script).
This site calls it through **`HVApi` (`js/api.js`)**: a `POST` to
`HV_CONFIG.EXEC_URL` with body `{api:"hv.<fn>", args:[payload]}` (token in the
payload, `text/plain` so it stays a CORS simple request). See that repo's
`AGENTS.md` for the API surface, auth model, and how to deploy the backend.

## Boot flow

`app.js` owns it: not-configured → **public landing / sign-in gate**
(`landing.js`, rendered into `#gate`, contains the Google button host `#gsiBtn`)
→ Google Sign-In → the server mints a session token (`auth.js`) → the app shell
(nav + hash router over the view objects). First-time visitors (no stored token)
get the landing with **no** backend round-trip.

## Module map (`js/`)

- `api.js` — transport + **SWR cache** (`load`/`bust`/`patch`/`seed`) + auto-bust
  on writes. **The one seam to the backend.**
- `core.js` — `HVUI`: `el` (DOM builder), `toast`, `modal`, `loading`, helpers.
- `auth.js` — Google Sign-In → session token; `restore()`.
- `app.js` — boot, hash router, nav/shell, the notification bell, `showGate`.
- `landing.js` — the public front door (hero, pillars, teams, Apply + sign-in).
- `views.js` — **Home** (the dashboard) + members / roles / profile / activity.
- `teams.js  events.js  taskboard.js  budgets.js  checkins.js  comments.js`
  (comments + the announcements board) `files.js  flags.js  dashboard.js
  applications.js` (recruitment review) `mascot.js` (Shroomy) `assist.js`
  (Ask-Shroomy AI card).
- `perm.js` — client-side permission checks + which nav tabs a user sees.
- `config.js` — `EXEC_URL` (OS `/exec`) + `OAUTH_CLIENT_ID`; `CONFIGURED`
  requires both.

## The performance model — DON'T regress this

Apps Script calls are **~1.5s each and Apps Script serialises concurrent calls
from one session**, so call count on load is what matters:

- Reads go through **`HVApi.load(fn, args, render)`** = stale-while-revalidate:
  it paints cached data instantly, then revalidates. Writes auto-bust their
  namespace so the next paint is correct.
- **Home fires ONE `home.summary` call** and seeds every card from it. Each Home
  card (quest, tiles, my tasks, check-in, announcements, assistant) takes an
  optional `seed` arg — with it they render without their own fetch; without it
  they fetch normally (so the same functions still work on other screens).
  **Do not reintroduce per-card fetches on Home.** The bell is set from the
  summary via `window.__hvSetBell`.

## Conventions / landmines

- **Theme is RetroUI** — tokens in `app.css` (cream `#FFF3D9`, near-black hard
  borders, solid offset shadows, zero radius, pixel/mono fonts). Keep it. Use
  existing classes (`card`, `btn`, `tile`, `chip`, `banner`, `dash`, `lp-*`).
- Scripts in `index.html` load **in dependency order** — add a new module
  **before `app.js`**.
- The join page's fallback team list (`join.html`) must stay in sync with
  `JA_TEAMS` in the backend's `Join.js`.
- **No emoji in UI copy** (glyphs like `✕`/`✓` as controls are fine).
- Never edit these files through PowerShell string-replace (UTF-8 corruption) —
  use editor tools.
- Verify JS with `node --check js/<file>.js`; there are no unit tests here (the
  tests live in the backend repo).

## Deploy

`git push` → GitHub Pages. That's it. (Pages caches ~1 min; hard-refresh to
confirm.)
