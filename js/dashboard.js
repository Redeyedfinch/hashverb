/**
 * Hashverb OS — dashboards (frontend).
 *   HVDash.homeTiles(host)     personal "at a glance" tiles for Home
 *   HVDashView                 the leadership Command Center view
 */
var HVDash = (function () {
  var el = HVUI.el;
  var HEALTH = { green: { c: '#0f9d58', t: 'On track' }, yellow: { c: '#F4A400', t: 'Needs attention' }, red: { c: '#E11D48', t: 'At risk' } };

  function homeTiles(host, seed) {
    host.innerHTML = '';
    host.classList.remove('hidden');
    /* seed !== undefined means Home already fetched this in home.summary */
    var p = (seed !== undefined) ? Promise.resolve(seed) : HVApi.hv('dash.me', {});
    p.then(function (r) {
      if (!r || !r.ok) { host.classList.add('hidden'); return; }
      var t = r.tasks;
      var tiles = el('div', { class: 'tiles' }, [
        tile(String(t.open), 'Open tasks'),
        tile(String(t.overdue), 'Overdue', t.overdue ? '#E11D48' : null),
        tile(String(t.dueSoon), 'Due soon'),
        tile(String(r.unread), 'Unread'),
        tile(r.checkinDone ? '✓' : '—', 'Check-in', r.checkinDone ? '#0f9d58' : '#F4A400')
      ]);
      host.innerHTML = '';
      host.appendChild(tiles);
    });
  }
  function tile(n, label, color) {
    return el('div', { class: 'tile' }, [
      el('div', { class: 'n', style: color ? 'color:' + color : '', text: n }),
      el('div', { class: 'l', text: label })
    ]);
  }

  var view = {
    render: function (host, ctx) {
      host.innerHTML = '';
      host.appendChild(el('div', { class: 'page-head' }, [
        el('div', {}, [ el('div', { class: 'eyebrow', text: '// command center' }), el('h1', { class: 'section-title', text: 'Command Center' }) ])
      ]));
      var body = el('div', {}, HVUI.loading('Aggregating…'));
      host.appendChild(body);
      HVApi.hv('dash.org', {}).then(function (r) {
        body.innerHTML = '';
        if (!r || !r.ok) { body.appendChild(HVUI.empty(HVApi.err(r, 'Could not load the command center.'))); return; }

        /* headline tiles */
        body.appendChild(el('div', { class: 'tiles' }, [
          num(r.events.active.length, 'Active events'),
          num(r.flags.open, 'Open flags', r.flags.urgent ? '#E11D48' : null),
          num(r.approvals.total, 'Pending approvals', r.approvals.total ? '#F4A400' : null),
          num(r.overdueTasks, 'Overdue tasks', r.overdueTasks ? '#E11D48' : null)
        ]));

        /* team health */
        var teamCard = el('div', { class: 'card', style: 'margin-top:16px' }, [ el('h3', { text: 'Team health' }) ]);
        if (!r.teams.length) teamCard.appendChild(el('div', { class: 'muted small', text: 'No teams yet.' }));
        else {
          var trow = el('div', { class: 'row wrap', style: 'gap:8px;margin-top:8px' });
          r.teams.forEach(function (tm) {
            var h = HEALTH[tm.health] || HEALTH.green;
            trow.appendChild(el('button', { class: 'chip', style: 'cursor:pointer;border-color:' + h.c + ';color:' + h.c,
              title: (tm.reasons || []).join(', ') || 'On track',
              onclick: function () { location.hash = '#/teams'; } },
              '● ' + tm.name));
          });
          teamCard.appendChild(trow);
          teamCard.appendChild(el('div', { class: 'muted small', style: 'margin-top:6px', text: '● green = on track · amber = needs attention · red = at risk' }));
        }
        body.appendChild(teamCard);

        /* active events */
        if (r.events.active.length) {
          var evCard = el('div', { class: 'card' }, [ el('h3', { text: 'Active events' }) ]);
          r.events.active.forEach(function (e) {
            var h = HEALTH[e.health] || HEALTH.green;
            evCard.appendChild(el('div', { class: 'banner', style: 'margin-top:6px;border-left:4px solid ' + h.c, cursor: 'pointer',
              onclick: function () { location.hash = '#/events'; } }, [
              el('div', { class: 'row' }, [ el('div', { style: 'font-weight:600', text: e.name }), el('span', { class: 'spacer' }), el('span', { class: 'chip', text: e.stageLabel }) ])
            ]));
          });
          body.appendChild(evCard);
        }

        /* recent activity */
        var actCard = el('div', { class: 'card' }, [ el('h3', { text: 'Recent activity' }) ]);
        if (!r.activity.length) actCard.appendChild(el('div', { class: 'muted small', text: 'Nothing yet.' }));
        else r.activity.forEach(function (a) {
          actCard.appendChild(el('div', { class: 'small', style: 'padding:4px 0;border-bottom:1px solid #eee' }, [
            el('span', { class: 'muted', text: HVUI.timeAgo(a.when) + ' · ' }),
            el('span', { style: 'font-family:var(--mono)', text: a.action + ' ' }),
            el('span', { class: 'muted', text: a.detail })
          ]));
        });
        body.appendChild(actCard);
      });
    }
  };

  function num(n, label, color) {
    return el('div', { class: 'tile' }, [ el('div', { class: 'n', style: color ? 'color:' + color : '', text: String(n) }), el('div', { class: 'l', text: label }) ]);
  }

  return { homeTiles: homeTiles, view: view };
})();
var HVDashView = HVDash.view;
