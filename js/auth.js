/**
 * Hashverb OS — sign-in with Google.
 *
 * Uses Google Identity Services (loaded in index.html). The flow:
 *   GIS renders a "Sign in with Google" button →
 *   on click, Google returns an ID token (JWT) to onCredential →
 *   we POST it to the backend hv.signin, which verifies it with Google and
 *   returns OUR session token + the user profile →
 *   we store the session token (first-party localStorage) and boot the app.
 *
 * The ID token never touches localStorage; only our own session token does.
 */
var HVAuth = (function () {

  var profile = null;      /* the signed-in user's profile from the server */
  var onReady = null;      /* called with the profile once signed in */

  function me() { return profile; }

  /* Called by GIS with {credential: <ID token JWT>}. */
  function onCredential(resp) {
    if (!resp || !resp.credential) { HVUI.toast('Google sign-in did not complete.', true); return; }
    var btn = HVUI.$('#gsiBtn');
    if (btn) btn.style.opacity = '.5';
    HVUI.toast('Signing you in…');
    HVApi.hv('signin', { idToken: resp.credential }, { anon: true }).then(function (r) {
      if (btn) btn.style.opacity = '';
      if (!r || !r.ok) { HVUI.toast(HVApi.err(r, 'Sign-in was refused.'), true); return; }
      HVApi.setToken(r.token);
      profile = r.user;
      if (onReady) onReady(profile);
    });
  }

  /* Draw the Google button into #gsiBtn. Requires GIS + a configured client ID. */
  function renderButton() {
    if (!HV_CONFIG.CONFIGURED) return false;
    if (!window.google || !google.accounts || !google.accounts.id) return false;
    try {
      google.accounts.id.initialize({
        client_id: HV_CONFIG.OAUTH_CLIENT_ID,
        callback: onCredential,
        auto_select: false,
        cancel_on_tap_outside: true
      });
      var host = HVUI.$('#gsiBtn');
      host.innerHTML = '';
      google.accounts.id.renderButton(host, {
        theme: 'filled_black', size: 'large', shape: 'rectangular',
        text: 'signin_with', width: 260
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  /* Restore an existing session: if a token is stored, ask the server who we
     are. Resolves with the profile or null. */
  function restore() {
    if (!HVApi.signedIn()) return Promise.resolve(null);
    return HVApi.hv('me', {}).then(function (r) {
      if (r && r.ok) { profile = r.user; return profile; }
      HVApi.setToken('');
      return null;
    });
  }

  /* Sign out everywhere (server bumps the epoch), then drop local state. */
  function signOutEverywhere() {
    return HVApi.hv('signout', {}).then(function () { localOut(); });
  }
  /* Local-only sign out (this device). */
  function signOut() { localOut(); return Promise.resolve(); }
  function localOut() {
    HVApi.setToken('');
    profile = null;
    try { if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect(); } catch (e) {}
  }

  /* Re-fetch the profile (after linking a USN, etc.). */
  function refresh() {
    return HVApi.hv('me', {}).then(function (r) {
      if (r && r.ok) profile = r.user;
      return profile;
    });
  }

  return {
    me: me, restore: restore, renderButton: renderButton,
    signOut: signOut, signOutEverywhere: signOutEverywhere, refresh: refresh,
    set onReady(fn) { onReady = fn; }, get onReady() { return onReady; }
  };
})();
