"""
Verification for the Hashverb OS frontend permission logic (js/perm.js).

This runs the SHIPPED js/perm.js in V8. It matters because the client-side
permission match MUST mirror the server's hvHasPerm_ exactly — if it drifts,
the UI offers actions the server then refuses, or hides ones the user has.
The nav-gating and catalog are tested too, since a wrong gate is how a member
ends up staring at an admin screen (or missing their own).

These are cosmetic checks on the server's behalf — the server re-enforces
everything — but a mismatch is a real UX bug, so it is under test.

Run:  python tests/perm_tests.py
"""
import json
import re
import sys
from pathlib import Path

try:
    from py_mini_racer import MiniRacer
except ImportError:
    sys.exit("missing dependency: python -m pip install mini-racer")

ROOT = Path(__file__).resolve().parents[1]
SRC = (ROOT / "js" / "perm.js").read_text(encoding="utf-8")
# strip the CommonJS export tail so it runs in a bare context
SRC = re.sub(r"if \(typeof module.*$", "", SRC, flags=re.S)

RUNNER = r"""
var __results = [];
function t(name, fn) {
  try { fn(); __results.push({ name: name, ok: true, detail: '' }); }
  catch (e) { __results.push({ name: name, ok: false, detail: String(e && e.message || e) }); }
}
function ok(c, m) { if (!c) throw new Error(m || 'assertion failed'); }
function eq(a, b, m) { if (a !== b) throw new Error((m || 'not equal') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)); }
function arrEq(a, b, m) { if (a.join(',') !== b.join(',')) throw new Error((m || 'arrays differ') + ': [' + a + '] != [' + b + ']'); }

/* ----- has(): must match the server hvHasPerm_ exactly ----- */

t('has: exact and wildcard, matching the server contract', function () {
  ok(HVPerm.has(['*'], 'anything.at.all'));
  ok(HVPerm.has(['roles.manage'], 'roles.manage'));
  ok(!HVPerm.has(['roles.manage'], 'roles.manag'), 'prefix must not match');
  ok(HVPerm.has(['events.*'], 'events.create'));
  ok(HVPerm.has(['events.*'], 'events.stage.move'), 'namespace wildcard is deep');
  ok(!HVPerm.has(['events.*'], 'eventsx.create'), 'wildcard leaked past the dot');
  ok(!HVPerm.has([], 'anything'));
  ok(!HVPerm.has(['tasks.view'], ''), 'empty key is deny');
  ok(!HVPerm.has(null, 'x'), 'null perms must not throw');
});

t('hasAny: true if the user holds any one of the keys', function () {
  ok(HVPerm.hasAny(['members.view'], ['members.view', 'roles.manage']));
  ok(HVPerm.hasAny(['roles.manage'], ['members.view', 'roles.manage']));
  ok(!HVPerm.hasAny(['tasks.view'], ['members.view', 'roles.manage']));
});

/* ----- nav gating: the exact screens each role sees ----- */

t('nav: an admin (star) sees every nav item', function () {
  arrEq(HVPerm.navFor(['*']), ['home', 'events', 'teams', 'flags', 'command', 'members', 'apply', 'roles', 'audit', 'profile']);
});

t('nav: applications.review opens Applications (and nothing else gated)', function () {
  arrEq(HVPerm.navFor(['applications.review']), ['home', 'events', 'teams', 'flags', 'apply', 'profile']);
  ok(HVPerm.canSeeView(['applications.review'], 'apply'));
  ok(!HVPerm.canSeeView(['members.view'], 'apply'), 'members.view alone opened Applications');
});

t('nav: a plain member sees home, events, teams, flags and profile', function () {
  arrEq(HVPerm.navFor(['tasks.view', 'files.upload']), ['home', 'events', 'teams', 'flags', 'profile']);
});

t('nav: open directories (events, teams, flags) show for everyone', function () {
  arrEq(HVPerm.navFor([]), ['home', 'events', 'teams', 'flags', 'profile']);
});

t('nav: reports.view opens the Command center', function () {
  arrEq(HVPerm.navFor(['reports.view']), ['home', 'events', 'teams', 'flags', 'command', 'profile']);
});

t('nav: members.view alone opens Members but NOT Roles or Activity', function () {
  arrEq(HVPerm.navFor(['members.view']), ['home', 'events', 'teams', 'flags', 'members', 'profile']);
});

t('nav: roles.manage opens Members, Roles and Activity', function () {
  arrEq(HVPerm.navFor(['roles.manage']), ['home', 'events', 'teams', 'flags', 'members', 'roles', 'audit', 'profile']);
});

t('canSeeView: gate matches navFor, and home/events/teams/flags/profile are always visible', function () {
  ok(HVPerm.canSeeView([], 'home'));
  ok(HVPerm.canSeeView([], 'events'));
  ok(HVPerm.canSeeView([], 'teams'));
  ok(HVPerm.canSeeView([], 'flags'));
  ok(HVPerm.canSeeView([], 'profile'));
  ok(!HVPerm.canSeeView([], 'members'));
  ok(!HVPerm.canSeeView(['members.view'], 'roles'));
  ok(HVPerm.canSeeView(['*'], 'audit'));
});

/* ----- catalog integrity ----- */

t('catalog: every entry has a key and label, and keys are unique', function () {
  var seen = {};
  HVPerm.CATALOG.forEach(function (grp) {
    ok(grp.group, 'group missing a title');
    grp.keys.forEach(function (item) {
      ok(item.key && item.label, 'catalog item missing key/label');
      ok(!seen[item.key], 'duplicate catalog key: ' + item.key);
      seen[item.key] = true;
    });
  });
  /* the two permissions the whole UI gates on MUST be offered, or an admin
     could never grant them through the editor */
  ok(seen['*'] && seen['roles.manage'] && seen['members.view'], 'core permissions missing from the catalog');
});

t('catalog: every catalog key is a valid lowercase dotted/star key', function () {
  HVPerm.catalogKeys().forEach(function (k) {
    ok(/^[a-z0-9_.*\-]+$/.test(k), 'catalog key is not a valid permission key: ' + k);
  });
});

t('summarize: human-friendly permission summaries', function () {
  eq(HVPerm.summarize(['*']), 'Full control');
  eq(HVPerm.summarize([]), 'No permissions');
  eq(HVPerm.summarize(['a', 'b']), 'a, b');
  eq(HVPerm.summarize(['a', 'b', 'c', 'd']), '4 permissions');
});

JSON.stringify(__results);
"""


def main():
    ctx = MiniRacer()
    ctx.eval(SRC)
    results = json.loads(ctx.eval(RUNNER))
    failed = []
    for r in results:
        tag = "PASS" if r["ok"] else "FAIL"
        line = f"[{tag}] {r['name']}"
        if not r["ok"]:
            line += f"\n       {r['detail']}"
            failed.append(r["name"])
        print(line)
    print(f"\nRESULT: {len(results) - len(failed)}/{len(results)} checks passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
