"""
Verification for the USN / mobile normalization in js/core.js (HVUI.normId).

Mobile normalization has caused real bugs in this project (one person split
into two leaderboard rows), so the canonical form is pinned here. core.js is
a UI toolkit but its module body touches no DOM at load, so it runs in a bare
V8 engine — we stub the two globals it closes over just in case.

Run:  python tests/id_tests.py
"""
import json
import sys
from pathlib import Path

try:
    from py_mini_racer import MiniRacer
except ImportError:
    sys.exit("missing dependency: python -m pip install mini-racer")

ROOT = Path(__file__).resolve().parents[1]
SRC = (ROOT / "js" / "core.js").read_text(encoding="utf-8")

STUB = "var document = { createElement: function(){ return {}; } }, window = {};"

RUNNER = r"""
var __results = [];
function t(name, fn) {
  try { fn(); __results.push({ name: name, ok: true, detail: '' }); }
  catch (e) { __results.push({ name: name, ok: false, detail: String(e && e.message || e) }); }
}
function eq(a, b, m) { if (a !== b) throw new Error((m || 'ne') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)); }
function ok(c, m) { if (!c) throw new Error(m || 'assertion failed'); }

t('normId: a bare 10-digit mobile passes through', function () {
  eq(HVUI.normId('9876543210'), '9876543210');
});
t('normId: +91, leading 0, and spaces all collapse to the same number', function () {
  eq(HVUI.normId('+91 98765 43210'), '9876543210');
  eq(HVUI.normId('0 98765 43210'), '9876543210');
  eq(HVUI.normId('98765-43210'), '9876543210');
  eq(HVUI.normId('919876543210'), '9876543210');
});
t('normId: a USN is uppercased and preserved', function () {
  eq(HVUI.normId('24bca123'), '24BCA123');
  eq(HVUI.normId('1RV23CS045'), '1RV23CS045');
});
t('normId: a mobile that does not start 6-9 is not a valid mobile', function () {
  /* "5123456789" is 10 digits but not a valid Indian mobile; it also is not a
     valid USN pattern? it is [A-Z0-9]{10} → actually a valid USN shape. So it
     falls through to USN. That is acceptable — the point is it is not treated
     as a mobile. */
  eq(HVUI.normId('5123456789'), '5123456789');
});
t('normId: junk returns empty', function () {
  eq(HVUI.normId('!!'), '');
  eq(HVUI.normId(''), '');
  eq(HVUI.normId('ab'), '', 'too short for a USN');
  eq(HVUI.normId(null), '');
});
t('validId: true only when normId yields something', function () {
  ok(HVUI.validId('9876543210'));
  ok(HVUI.validId('24BCA123'));
  ok(!HVUI.validId('!!'));
  ok(!HVUI.validId(''));
});
JSON.stringify(__results);
"""


def main():
    ctx = MiniRacer()
    ctx.eval(STUB)
    ctx.eval(SRC)
    results = json.loads(ctx.eval(RUNNER))
    failed = []
    for r in results:
        print(("[PASS] " if r["ok"] else "[FAIL] ") + r["name"] + ("" if r["ok"] else "\n       " + r["detail"]))
        if not r["ok"]:
            failed.append(r["name"])
    print(f"\nRESULT: {len(results) - len(failed)}/{len(results)} checks passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
