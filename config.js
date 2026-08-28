/**
 * Hashverb OS — frontend configuration.
 *
 * This file is PUBLIC (the repo is public and GitHub Pages serves it). That is
 * fine: neither value here is a secret. The OAuth *client ID* is meant to be
 * public, and the /exec URL is already public. All secrets, data and
 * permission checks live server-side in Apps Script.
 *
 * TWO THINGS TO FILL IN before sign-in works:
 *
 *   1. OAUTH_CLIENT_ID — from Google Cloud Console:
 *        console.cloud.google.com → APIs & Services → Credentials →
 *        Create credentials → OAuth client ID → Web application.
 *      Authorized JavaScript origin MUST include:  https://redeyedfinch.github.io
 *      Paste the client ID below AND set it as the HV_OAUTH_CLIENT_ID
 *      Script Property in the Apps Script project (both sides must match).
 *
 *   2. EXEC_URL — the deployed Apps Script web-app URL ending in /exec.
 *      It is already correct below for the current deployment. It only starts
 *      answering hv.* calls once Identity.js is pushed and deployed (which is
 *      on hold during the event freeze).
 */
var HV_CONFIG = {

  /* Paste your OAuth Web client ID here. Until you do, the app shows a
     friendly "not configured yet" screen instead of a broken Google button. */
  OAUTH_CLIENT_ID: 'PASTE-YOUR-OAUTH-CLIENT-ID.apps.googleusercontent.com',

  /* The Apps Script web app. Same project that serves the club site + games;
     the hv.* API is reached by POSTing to this URL. */
  EXEC_URL: 'https://script.google.com/macros/s/AKfycbysCzWl9_dnfKGRdstzRWPFUqnGRrMFG3Z2iWoOaPnhvwJCsQEd8rreVoaJMPVjO9ve/exec',

  /* Session token lives here (first-party origin → survives reloads, including
     on iOS, unlike anything inside the Apps Script iframe). */
  TOKEN_KEY: 'hv_session',

  /* Cosmetic. */
  ORG_NAME: 'Hashverb',
  APP_NAME: '#Hash'
};

/* True until the client ID has actually been filled in. */
HV_CONFIG.CONFIGURED = HV_CONFIG.OAUTH_CLIENT_ID.indexOf('PASTE-') !== 0;
