/**
 * Hashverb OS — public landing (the club's front door).
 *
 * When a visitor isn't signed in, the OS root shows this instead of a bare
 * sign-in card: the #Hash landing absorbed from the standalone club site —
 * hero, what the club is about, the four teams, and two clear paths (sign in
 * for members, apply to join for everyone else).
 *
 * It renders INTO the existing gate element and includes the #gsiBtn container
 * where Google Identity Services mounts its button, so app.js's boot flow is
 * unchanged — it just calls HVLanding.render then renders the GIS button as
 * before. Content is faithful to the club site; only the arrangement is new.
 */
var HVLanding = (function () {
  var el = HVUI.el;

  /* the four teams — same copy as join.html / JA_TEAMS (marketing content, so
     kept inline: the landing must paint instantly with no pre-auth fetch) */
  var TEAMS = [
    { name: 'Events',  blurb: 'Plan and run everything we host — logistics, venues, schedules and the crew on event day.' },
    { name: 'Tech',    blurb: 'Build the projects, workshops and tools — AI, robotics, cybersecurity, web. The maker core.' },
    { name: 'PR',      blurb: 'The club\'s voice — outreach, sponsors, speaker invites and collabs with other clubs.' },
    { name: 'Socials', blurb: 'Content and community — Instagram and LinkedIn, posters, reels, photos and the memes.' }
  ];
  var PILLARS = [
    { h: 'Hands-on from day one', p: 'Workshops, guided labs and hackathons over slideshows. Simulation-first, so you can start without hardware.' },
    { h: 'Portfolio, not certificates', p: 'Every phase ends in a reviewable deliverable — repos, demo videos and reports that make you internship-ready.' },
    { h: 'A network across batches', p: 'Seniors mentor juniors, teams collaborate on the flagship builds, and everyone ships together.' }
  ];

  function logo() {
    var wrap = el('div', { class: 'lp-logo' });
    wrap.innerHTML =
      '<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<defs><linearGradient id="lphg" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">' +
      '<stop stop-color="#7dffc4"/><stop offset=".5" stop-color="#00e58a"/><stop offset="1" stop-color="#04a765"/>' +
      '</linearGradient></defs>' +
      '<g stroke="url(#lphg)" stroke-width="13" stroke-linecap="round">' +
      '<line x1="44" y1="16" x2="34" y2="104"/><line x1="86" y1="16" x2="76" y2="104"/>' +
      '<line x1="20" y1="46" x2="104" y2="42"/><line x1="16" y1="78" x2="100" y2="74"/>' +
      '</g></svg>';
    return wrap;
  }

  /* render the landing into `host` (the gate element). Returns nothing; app.js
     then renders the GIS button into #gsiBtn as usual. */
  function render(host, opts) {
    opts = opts || {};
    host.innerHTML = '';

    var stats = el('div', { class: 'lp-stats' }, [
      stat('4', 'teams'), stat('20+', 'roadmap phases'), stat('∞', 'projects to ship')
    ]);

    var signInBox = el('div', { class: 'lp-signin' }, [
      el('div', { class: 'lp-signin-h', text: 'Already a member?' }),
      el('div', { class: 'gsi', id: 'gsiBtn' }, HVUI.loading('Loading Google sign-in…'))
    ]);

    var hero = el('div', { class: 'lp-hero' }, [
      el('div', { class: 'lp-hero-copy' }, [
        el('span', { class: 'lp-badge', text: 'Recruitment open · School of Sciences' }),
        el('h1', { class: 'lp-title' }, [ el('span', { class: 'lp-hash', text: '#' }), document.createTextNode('Hash') ]),
        el('p', { class: 'lp-lede', text: 'The tech community at Jain University for builders, breakers and the perpetually curious. Ship real projects, learn out loud, and find your people.' }),
        el('div', { class: 'lp-cta' }, [
          el('a', { class: 'btn primary', style: 'text-decoration:none', href: 'join.html' }, 'Apply to join →'),
          el('a', { class: 'btn ghost', style: 'text-decoration:none', href: '#teams' }, 'See the teams')
        ]),
        stats
      ]),
      el('div', { class: 'lp-hero-art' }, [ logo(), signInBox ])
    ]);

    var pillars = el('div', { class: 'lp-pillars' }, PILLARS.map(function (f) {
      return el('div', { class: 'lp-pillar card' }, [ el('h3', { text: f.h }), el('p', { class: 'muted', text: f.p }) ]);
    }));

    var teamCards = el('div', { class: 'lp-teams', id: 'teams' }, TEAMS.map(function (t) {
      return el('div', { class: 'lp-team card' }, [
        el('div', { class: 'lp-team-nm', text: t.name }),
        el('div', { class: 'muted small', text: t.blurb })
      ]);
    }));

    var content = el('div', { class: 'lp' }, [
      el('div', { class: 'lp-bar' }, [
        el('div', { class: 'brand' }, [ el('span', { class: 'dot' }), document.createTextNode('#HASH'), el('small', { text: 'OS' }) ]),
        el('span', { class: 'spacer' }),
        el('a', { class: 'btn ghost small', style: 'text-decoration:none', href: 'https://redeyedfinch.github.io/play/arcade.html', target: '_blank', rel: 'noopener' }, 'Arcade'),
        el('a', { class: 'btn ghost small', style: 'text-decoration:none', href: 'join.html' }, 'Apply to join')
      ]),
      opts.message ? el('div', { class: 'container' }, el('div', { class: 'banner info', style: 'margin-top:14px', text: opts.message })) : null,
      el('div', { class: 'container' }, [
        hero,
        el('div', { class: 'lp-section' }, [
          el('div', { class: 'eyebrow', text: '// why #hash' }),
          el('h2', { class: 'section-title', text: 'Build proof, not slides.' }),
          pillars
        ]),
        el('div', { class: 'lp-section' }, [
          el('div', { class: 'eyebrow', text: '// four teams, one club' }),
          el('h2', { class: 'section-title', text: 'Find where you fit.' }),
          el('p', { class: 'section-sub', text: 'You join #Hash as a member of a team. Pick where you want to work — the crew takes it from there.' }),
          teamCards
        ]),
        el('div', { class: 'lp-foot muted small', text: '#Hash · School of Sciences, Jain University' })
      ])
    ]);

    host.appendChild(content);

    function stat(n, l) { return el('div', { class: 'lp-stat' }, [ el('div', { class: 'n', text: n }), el('div', { class: 'l', text: '// ' + l }) ]); }
  }

  return { render: render };
})();
