# Tests

`perm_tests.py` runs the shipped `js/perm.js` in a V8 engine (py_mini_racer)
and checks that the client's permission logic mirrors the server's `hvHasPerm_`
exactly, plus the nav gating and catalog integrity.

```
python -m pip install mini-racer
python tests/perm_tests.py
```

The client permission match is only cosmetic — the Apps Script backend
re-enforces every action server-side — but a mismatch is a real UX bug (the UI
offering an action the server refuses, or hiding one the user has), so it is
kept under test. A separate parity check in the backend repo runs both the
client and server matchers over identical inputs to catch drift between the two
repos.
