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
          if (typeof HVApi.onAuthLost === 'function') HVApi.onAuthLost();
        }
        return data;
      });
    }).catch(function () {
      return { ok: false, errors: ['Could not reach the server. Check your connection and try again.'] };
    });
  }

  /* Convenience: first-line error text from a result, for toasts. */
  function err(res, fallback) {
    if (res && res.errors && res.errors.length) return res.errors[0];
    return fallback || 'Something went wrong.';
  }

  return {
    hv: hv, token: token, setToken: setToken, signedIn: signedIn, err: err,
    onAuthLost: null
  };
})();
