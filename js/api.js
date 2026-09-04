/**
 * Hashverb OS — transport and session.
 *
 * The single seam between this static site and the Apps Script backend.
 * Everything authenticated goes through hv() as a POST, so the session token
 * travels in the request BODY, never in a URL (the server refuses hv.* over
 * GET for exactly that reason). Cross-origin POST with a text/plain body is a
 * CORS "simple request" — no preflight — and Apps Script returns
 * Access-Control-Allow-Origin: *, so the reply is readable here.
 */
var HVApi = (function () {

  var TOKEN_KEY = HV_CONFIG.TOKEN_KEY;

  function token() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
  }
  function setToken(t) {
    try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); }
    catch (e) { /* private mode — session simply won't persist */ }
  }
  function signedIn() { return !!token(); }

  /**
   * Call a backend hv.* function. Returns a Promise of the server's result
   * object ({ok:true,...} / {ok:false, errors:[...]}). The caller's session
   * token is attached automatically unless opts.anon is set (sign-in).
   *
   * On a hard transport failure the Promise still RESOLVES with a synthetic
   * {ok:false} so callers never have to write two error paths — network and
   * server errors look the same to the UI.
   */
  function hv(fn, args, opts) {
    opts = opts || {};
    var payload = (args && typeof args === 'object') ? args : {};
    if (!opts.anon) payload.token = token();

    var body = JSON.stringify({ api: 'hv.' + fn, args: [payload] });

    return fetch(HV_CONFIG.EXEC_URL, {
      method: 'POST',
      /* text/plain keeps this a simple request (no OPTIONS preflight, which
         Apps Script does not answer). The body is still JSON. */
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      credentials: 'omit',
      body: body,
      redirect: 'follow'
    }).then(function (r) {
      return r.text().then(function (txt) {
        var data;
        try { data = JSON.parse(txt); }
        catch (e) { return { ok: false, errors: ['The server sent something unexpected. Try again.'] }; }
        /* a stale/void session: clear it so the app drops back to sign-in */
        if (data && data.ok === false && data.auth) {
          setToken('');
          reset();
          if (typeof HVApi.onAuthLost === 'function') HVApi.onAuthLost();
        }
        /* A successful WRITE invalidates cached reads in its namespace, so the
           next paint of that area is correct without manual bookkeeping. */
        if (data && data.ok && !isRead(fn)) {
          var dot = fn.indexOf('.');
          bust(dot > 0 ? fn.substring(0, dot + 1) : fn);
        }
        return data;
      });
    }).catch(function () {
      return { ok: false, errors: ['Could not reach the server. Check your connection and try again.'] };
    });
  }

  /* ------------------------------------------------------------------ *
   * Perceived-speed layer. Apps Script round-trips are 0.5-2s each, so:
   *   - COALESCE: identical reads in flight at once share ONE request.
   *   - CACHE + SWR: load() paints cached data instantly, then revalidates
   *     in the background - so returning to a screen is immediate.
   *   - PATCH / BUST: mutations update or drop cached reads so the next
   *     paint is correct without a mandatory refetch.
   * Only read-shaped calls are cached; mutations always hit the network.
   * ------------------------------------------------------------------ */
  var cache = {};      // key -> last good result
  var inflight = {};   // key -> Promise (coalescing)

  var READ_RX = /\.(list|get|profile|meta|types|stages|statuses|domains|myTeams|myEvents|myTasks|unreadCount|homeTiles|summary|thread|card)$|^(dashboard|announce|notify|audit|users|roles)\./;
  function isRead(fn) { return READ_RX.test(fn); }

  function keyOf(fn, args) {
    var a = {};
    for (var k in (args || {})) if (k !== 'token') a[k] = args[k];
    return fn + '|' + JSON.stringify(a);
  }

  function fetchCoalesced(fn, args) {
    var key = keyOf(fn, args);
    if (inflight[key]) return inflight[key];
    var p = hv(fn, args).then(function (r) { delete inflight[key]; return r; },
                              function (e) { delete inflight[key]; throw e; });
    inflight[key] = p;
    return p;
  }

  /**
   * Stale-while-revalidate read. Calls render(result, isCached) with cached
   * data immediately when available, then again with fresh data. The render
   * callback must be idempotent (clear then rebuild) - the app's views are.
   * Returns the fresh-data promise.
   */
  function load(fn, args, render) {
    var key = keyOf(fn, args);
    if (render && cache.hasOwnProperty(key)) { try { render(cache[key], true); } catch (e) {} }
    return fetchCoalesced(fn, args).then(function (r) {
      if (r && r.ok) cache[key] = r;         // never cache an error
      else if (r && r.auth) delete cache[key];
      if (render) { try { render(r, false); } catch (e) {} }
      return r;
    });
  }

  /* Drop cached reads whose key contains `sub` (e.g. 'teams.list'); no arg
     clears everything. Call after a mutation that changed that data. */
  function bust(sub) {
    for (var k in cache) if (!sub || k.indexOf(sub) >= 0) delete cache[k];
  }

  /* Optimistically mutate a cached read in place (updater(result)) so the very
     next paint reflects a change before the server confirms it. */
  function patch(fn, args, updater) {
    var key = keyOf(fn, args);
    if (cache.hasOwnProperty(key)) { try { updater(cache[key]); } catch (e) {} }
  }

  /* Warm the cache with data fetched some other way (e.g. a bundled
     home.summary), so a later load() of the same read paints instantly. */
  function seed(fn, args, data) { if (data && data.ok) cache[keyOf(fn, args)] = data; }

  /* Clear all caches (e.g. on sign-out). */
  function reset() { cache = {}; inflight = {}; }

  /* Convenience: first-line error text from a result, for toasts. */
  function err(res, fallback) {
    if (res && res.errors && res.errors.length) return res.errors[0];
    return fallback || 'Something went wrong.';
  }

  return {
    hv: hv, load: load, bust: bust, patch: patch, seed: seed, reset: reset,
    token: token, setToken: setToken, signedIn: signedIn, err: err,
    onAuthLost: null
  };
})();
