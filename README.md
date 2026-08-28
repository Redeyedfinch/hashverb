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

## Not the games

The event games (NEXUS hunt, arcade) live at `Redeyedfinch/play`
(redeyedfinch.github.io/play). This is a different thing entirely.
