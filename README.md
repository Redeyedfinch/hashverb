# hashverb

First-party static host for the **Hashverb Operating System** — the internal
collaboration and event-operations platform for Hashverb (the #Hash student
tech org).

This repo is HTML/JS/CSS only. It is deliberately public because GitHub Pages
serves it, and because it contains **no secrets**: the Google OAuth *client ID*
is public by design, and all data, authentication, and permissions live
server-side in the Apps Script backend (private repo `Redeyedfinch/hash`).

## How it fits together

```
Browser (this site, first-party origin)
  │  Google Sign-In → ID token
  ▼
Apps Script /exec  (private repo hash/apps/site)
  · verifies the ID token with Google
  · mints a session token
  · owns every role/permission check and all data
  ▼
Google Sheets  (never touched by the browser directly)
```

Nothing here talks to Sheets or Drive directly. Every action is an `hv.*` call
to the backend, which authenticates and authorizes it.

## Why a separate repo

- The private `hash` repo stays private (build scripts, notes, migration
  runbooks should not be public).
- The games' `play` repo stays frozen during events; the OS must be editable
  at exactly those times.

## Layout

```
index.html        the shell (loads Google Identity Services + the app)
config.js         OAuth client ID + backend /exec URL (both public, no secrets)
styles/app.css    the RetroUI design system, self-contained
js/perm.js        permission logic — mirrors the server's hvHasPerm_ (tested)
js/core.js        DOM / toast / modal / format helpers
js/api.js         transport: POST to the backend, session token handling
js/auth.js        Google Sign-In flow + session lifecycle
js/views.js       Home, Members, Roles, Profile, Activity
js/app.js         boot + hash router, nav gated by permission
tests/perm_tests.py
```

## Setup (one-time, before sign-in works)

1. In Google Cloud Console, create an OAuth **Web** client ID. Add
   `https://redeyedfinch.github.io` as an authorized JavaScript origin.
2. Put that client ID in `config.js` (`OAUTH_CLIENT_ID`) **and** set the
   matching `HV_OAUTH_CLIENT_ID` Script Property in the Apps Script backend.
3. In the backend, run `hvSetup()` once to create the tables and make yourself
   a Head. Full steps: `notes/PHASE1-AUTH.md` in the backend repo.

Until the client ID is filled in, the app shows a friendly "almost ready"
screen rather than a broken button.

## Not the games

The event games (NEXUS hunt, arcade) live at `Redeyedfinch/play`
(redeyedfinch.github.io/play). This is a different thing entirely.
