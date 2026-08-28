/**
 * Hashverb OS — boot and router.
 *
 * Owns the top-level states: not-configured → sign-in → app. The app is a
 * hash router (#/home, #/members, …) over the HVViews objects, with nav
 * filtered by the signed-in user's permissions. Everything auth flows through
 * HVAuth; everything data flows through HVApi.
 */
(function () {
  var el = HVUI.el;
  var motion = HVUI.initMotion();

  var VIEWS = {
    home: HVViews.home, members: HVViews.members, roles: HVViews.roles,
    audit: HVViews.audit, profile: HVViews.profile
  };
  var LABEL = { home: 'Home', members: 'Members', roles: 'Roles', audit: 'Activity', profile: 'Profile' };

  var app = HVUI.$('#app');
  var gate = HVUI.$('#gate');

  /* if a call ever reports the session is gone, drop to sign-in */
  HVApi.onAuthLost = function () { showGate('Your session ended. Please sign in again.'); };

  boot();

  function boot() {
    if (!HV_CONFIG.CONFIGURED) { showNotConfigured(); return; }
    /* try to resume an existing session */
    gate.innerHTML = '';
    gate.appendChild(el('div', { class: 'gate' }, el('div', { class: 'gate-card card' },
      HVUI.loading('Checking your session…'))));
    gate.classList.remove('hidden');
    app.classList.add('hidden');

    HVAuth.restore().then(function (me) {
      if (me) enterApp(me);
      else showGate();
    });
  }

  /* ---------------- not configured ---------------- */
  function showNotConfigured() {
    app.classList.add('hidden');
    gate.classList.remove('hidden');
    gate.innerHTML = '';
    gate.appendChild(el('div', { class: 'gate' }, el('div', { class: 'gate-card card' }, [
      el('h1', { text: '#Hash' }),
      el('div', { class: 'eyebrow', text: '// hashverb operating system' }),
      el('div', { class: 'banner warn', style: 'margin-top:16px;text-align:left' }, [
        el('strong', { text: 'Almost ready.' }),
        el('p', { style: 'margin:6px 0 0', text: 'Sign-in needs a Google OAuth client ID. Add it in config.js (OAUTH_CLIENT_ID) and set the matching HV_OAUTH_CLIENT_ID script property in the backend. Steps are in notes/PHASE1-AUTH.md.' })
      ])
    ])));
  }

  /* ---------------- sign-in gate ---------------- */
  function showGate(message) {
    HVAuth.signOut();
    app.classList.add('hidden');
    gate.classList.remove('hidden');
    gate.innerHTML = '';
    gate.appendChild(el('div', { class: 'gate' }, el('div', { class: 'gate-card card' }, [
      el('h1', { text: '#Hash' }),
      el('div', { class: 'eyebrow', text: '// hashverb operating system' }),
      el('p', { class: 'section-sub', style: 'margin-top:10px', text: 'Sign in with your Google account to continue.' }),
      message ? el('div', { class: 'banner info', style: 'margin-top:12px;text-align:left', text: message }) : null,
      el('div', { class: 'gsi', id: 'gsiBtn' }, HVUI.loading('Loading Google sign-in…'))
    ])));
    tryRenderButton(0);
  }

  /* GIS may still be loading; retry the button render a few times. */
  function tryRenderButton(n) {
    if (HVAuth.renderButton()) return;
    if (n > 40) {
      var host = HVUI.$('#gsiBtn');
      if (host) { host.innerHTML = ''; host.appendChild(el('div', { class: 'banner bad', text: 'Google sign-in could not load. Check your connection and reload.' })); }
      return;
    }
    setTimeout(function () { tryRenderButton(n + 1); }, 150);
  }

  HVAuth.onReady = function (me) { enterApp(me); };

  /* ---------------- the app ---------------- */
  function enterApp(me) {
    gate.classList.add('hidden');
    app.classList.remove('hidden');
    renderShell(me);
    routeFromHash(me);
  }

  function renderShell(me) {
    app.innerHTML = '';

    /* top nav */
    var navItems = HVPerm.navFor(me.perms);
    var navPills = el('div', { class: 'tabs', id: 'navTabs' }, navItems.map(function (id) {
      return el('button', { class: 'tab', 'data-view': id, onclick: function () { location.hash = '#/' + id; } }, LABEL[id]);
    }));

    var who = el('div', { class: 'who' }, [
      me.photo ? el('img', { src: me.photo, alt: '' })
        : el('div', { style: 'width:30px;height:30px;border:2px solid var(--line);display:grid;place-items:center;font-family:var(--display);font-weight:700;background:var(--panel)', text: HVUI.initials(me.name) }),
      el('span', { class: 'nm', text: (me.name || me.email).split(/\s+/)[0] })
    ]);

    var motionBtn = el('button', { class: 'btn ghost small', onclick: function () {
      var r = motion.toggle(); motionBtn.textContent = 'MOTION: ' + (r ? 'OFF' : 'ON');
    }}, 'MOTION: ' + (motion.reduced() ? 'OFF' : 'ON'));

    var header = el('header', { class: 'nav' }, el('div', { class: 'container nav-inner' }, [
      el('div', { class: 'brand' }, [ el('span', { class: 'dot' }), document.createTextNode('#HASH'),
        el('small', { text: 'OS' }) ]),
      el('div', { class: 'nav-right' }, [ navPills, who, motionBtn,
        el('button', { class: 'btn ghost small', title: 'Sign out',
          onclick: function () { HVAuth.signOut().then(function () { showGate(); location.hash = ''; }); } }, 'Sign out') ])
    ]));

    var main = el('main', { class: 'app' }, el('div', { class: 'container', id: 'viewHost' }, []));

    app.appendChild(header);
    app.appendChild(main);
  }

  function highlightNav(id) {
    HVUI.$$('#navTabs .tab').forEach(function (t) {
      t.classList.toggle('on', t.getAttribute('data-view') === id);
    });
  }

  function routeFromHash(me) {
    var id = (location.hash || '').replace(/^#\/?/, '') || 'home';
    if (!VIEWS[id]) id = 'home';
    /* permission gate: never render a view the user can't see */
    if (!HVPerm.canSeeView(me.perms, id) && id !== 'home' && id !== 'profile') id = 'home';
    highlightNav(id);
    var host = HVUI.$('#viewHost');
    if (!host) return;
    try {
      VIEWS[id].render(host, {
        me: me,
        go: function (to) { location.hash = '#/' + to; },
        reload: function () { boot(); location.hash = ''; }
      });
    } catch (e) {
      host.innerHTML = '';
      host.appendChild(el('div', { class: 'banner bad', text: 'This view hit an error. Reload the page.' }));
    }
    window.scrollTo(0, 0);
  }

  window.addEventListener('hashchange', function () {
    var me = HVAuth.me();
    if (me) routeFromHash(me);
  });
})();
