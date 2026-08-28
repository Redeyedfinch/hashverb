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

  /* The Hashverb OS Apps Script web app — its OWN project, independent of the
     games. Paste its /exec URL here after you create and deploy it (see
     apps/os/README in the backend repo). The hv.* API is reached by POSTing
     to this URL. It is NOT the games' /exec. */
  EXEC_URL: 'PASTE-YOUR-HASHVERB-OS-EXEC-URL-ENDING-IN/exec',

  /* Session token lives here (first-party origin → survives reloads, including
     on iOS, unlike anything inside the Apps Script iframe). */
  TOKEN_KEY: 'hv_session',

  /* Cosmetic. */
  ORG_NAME: 'Hashverb',
  APP_NAME: '#Hash'
};

/* True only once BOTH the client ID and the OS /exec URL have been filled in. */
HV_CONFIG.CONFIGURED = HV_CONFIG.OAUTH_CLIENT_ID.indexOf('PASTE-') !== 0
                    && HV_CONFIG.EXEC_URL.indexOf('PASTE-') !== 0;
