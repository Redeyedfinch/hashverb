/**
 * Hashverb OS — Events view (directory + command-center detail).
 *
 * Directory of event cards, and a detail page that is the event command
 * center: the stage pipeline, roadmap, organizers, and linked teams. Controls
 * are shown/hidden by the caps object the server returns; every action is
 * re-authorized server-side.
 */
var HVEventsView = (function () {
  var el = HVUI.el, esc = HVUI.esc, toast = HVUI.toast;

  var typesCache = null, stagesCache = null;
  var state = { openId: null };

  var view = {
    render: function (host, ctx) {
      host.innerHTML = '';
      ensureMeta().then(function () {
        if (state.openId) renderDetail(host, ctx, state.openId);
        else renderDirectory(host, ctx);
      });
    },
    reset: function () { state.openId = null; }
  };

  function ensureMeta() {
    var need = [];
    if (!typesCache) need.push(HVApi.hv('events.types', {}).then(function (r) { typesCache = (r && r.ok) ? r.types : ['Other']; }));
    if (!stagesCache) need.push(HVApi.hv('events.stages', {}).then(function (r) { stagesCache = (r && r.ok) ? r.stages : []; }));
    return Promise.all(need);
  }

  /* ================= directory ================= */
  function renderDirectory(host, ctx) {
    host.innerHTML = '';
    var canCreate = HVPerm.has(ctx.me.perms, 'events.create');
    host.appendChild(el('div', { class: 'page-head' }, [
      el('div', {}, [ el('div', { class: 'eyebrow', text: '// events' }), el('h1', { class: 'section-title', text: 'Events' }) ]),
      el('span', { class: 'spacer' }),
      canCreate ? el('button', { class: 'btn primary', onclick: function () { formModal(host, ctx, null); } }, '+ New event') : null
    ]));

    var listHost = el('div', {});
    host.appendChild(listHost);
    listHost.appendChild(HVUI.loading('Loading events…'));
    HVApi.load('events.list', {}, function (r) {
      listHost.innerHTML = '';
      if (!r || !r.ok) { listHost.appendChild(HVUI.empty(HVApi.err(r, 'Could not load events.'))); return; }
      if (!r.events.length) { listHost.appendChild(HVUI.empty(canCreate ? 'No events yet — create the first one.' : 'No events yet.')); return; }
      var grid = el('div', { class: 'tiles' });
      r.events.forEach(function (ev) { grid.appendChild(card(ev)); });
      listHost.appendChild(grid);
    });

    function card(ev) {
      return el('button', { class: 'tile', style: 'text-align:left;cursor:pointer;border-left:6px solid ' + esc(ev.color || 'var(--pink)'),
        onclick: function () { state.openId = ev.id; view.render(host, ctx); } }, [
        el('div', { class: 'row' }, [
          HVUI.tile(ev.name, ev.color || 'var(--pink)', 34),
          el('span', { class: 'spacer' }),
          ev.myRank ? el('span', { class: 'chip role', text: rankLabel(ev.myRank) }) : null
        ]),
        el('div', { style: 'font-family:var(--display);font-weight:700;font-size:18px;margin-top:8px', text: ev.name }),
        el('div', { class: 'row wrap', style: 'gap:6px;margin-top:6px' }, [
          ev.type ? el('span', { class: 'chip', text: ev.type }) : null,
          el('span', { class: 'chip', style: stagePillStyle(ev.stage), text: ev.stageLabel })
        ]),
        stageBar(ev),
        ev.startDate ? el('div', { class: 'l', style: 'margin-top:8px;font-family:var(--mono);font-size:16px', text: ev.startDate + (ev.endDate ? ' -> ' + ev.endDate : '') }) : null
      ]);
    }
  }

  function stageBar(ev) {
    var pct = ev.stageCount > 1 ? Math.round((ev.stageIndex / (ev.stageCount - 1)) * 100) : 0;
    return el('div', { style: 'margin-top:10px;height:8px;border:2px solid var(--line);background:var(--bg)' },
      el('div', { style: 'height:100%;width:' + pct + '%;background:' + (ev.stage === 'completed' ? 'var(--logo)' : 'var(--gold)') }));
  }
  function stagePillStyle(stage) {
    return stage === 'completed' ? 'background:#e2f7ec' : 'background:#fff3c9';
  }

  /* ================= detail (command center) ================= */
  function renderDetail(host, ctx, eventId) {
    host.innerHTML = '';
    host.appendChild(HVUI.loading('Loading event…'));
    HVApi.load('events.get', { eventId: eventId }, function (r) {
      host.innerHTML = '';
      if (!r || !r.ok) {
        host.appendChild(el('button', { class: 'btn ghost small', onclick: back }, '← Events'));
        host.appendChild(HVUI.empty(HVApi.err(r, 'Could not open that event.')));
        return;
      }
      var ev = r.event, caps = r.caps;
      host.appendChild(el('button', { class: 'btn ghost small', style: 'margin-bottom:12px', onclick: back }, '← All events'));

      /* header */
      var headActions = el('div', { class: 'row wrap', style: 'gap:8px' });
      if (caps.edit) headActions.appendChild(el('button', { class: 'btn ghost small', onclick: function () { formModal(host, ctx, ev); } }, 'Edit'));
      if (caps.archive) headActions.appendChild(el('button', { class: 'btn danger small', onclick: function () { archive(host, ctx, ev); } }, 'Archive'));
      host.appendChild(el('div', { class: 'card', style: 'border-left:6px solid ' + esc(ev.color || 'var(--pink)') }, [
        el('div', { class: 'row wrap' }, [
          HVUI.tile(ev.name, ev.color || 'var(--pink)', 46),
          el('div', {}, [
            el('h1', { class: 'section-title', style: 'margin:0', text: ev.name }),
            el('div', { class: 'row wrap', style: 'gap:6px;margin-top:4px' }, [
              ev.type ? el('span', { class: 'chip', text: ev.type }) : null,
              ev.startDate ? el('span', { class: 'muted small', style: 'font-family:var(--mono);font-size:16px', text: ev.startDate + (ev.endDate ? ' -> ' + ev.endDate : '') }) : null
            ])
          ]),
          el('span', { class: 'spacer' }), headActions
        ]),
        ev.description ? el('p', { class: 'section-sub', style: 'margin-top:12px', text: ev.description }) : null
      ]));

      /* stage pipeline */
      host.appendChild(stagePipeline(host, ctx, ev, caps));

      /* roadmap */
      host.appendChild(roadmapCard(host, ctx, ev, r.roadmap, caps));

      /* organizers */
      host.appendChild(organizersCard(host, ctx, ev, r.members, caps));

      /* teams */
      host.appendChild(teamsCard(host, ctx, ev, r.teams, caps));

      /* tasks board for this event */
      var tasksCard = el('div', { class: 'card' }, [ el('h3', { text: 'Tasks' }) ]);
      var boardHost = el('div', { style: 'margin-top:10px' });
      tasksCard.appendChild(boardHost);
      host.appendChild(tasksCard);
      HVTaskBoard.render(boardHost, 'event', ev.id);

      /* files for this event */
      var filesCard = el('div', { class: 'card' }, [ el('h3', { text: 'Files' }) ]);
      var filesHost = el('div', { style: 'margin-top:10px' });
      filesCard.appendChild(filesHost);
      host.appendChild(filesCard);
      HVFilesBoard.render(filesHost, 'event', ev.id);

      /* budget for this event */
      var budgetCard = el('div', { class: 'card' }, [ el('h3', { text: 'Budget' }) ]);
      var budgetHost = el('div', { style: 'margin-top:10px' });
      budgetCard.appendChild(budgetHost);
      host.appendChild(budgetCard);
      HVBudgetBoard.render(budgetHost, 'event', ev.id);

      /* meetings */
      var mtgCard = el('div', { class: 'card' }, [ el('h3', { text: 'Meetings' }) ]);
      var mtgHost = el('div', { style: 'margin-top:10px' });
      mtgCard.appendChild(mtgHost); host.appendChild(mtgCard);
      HVMeetings.render(mtgHost, 'event', ev.id);
    });
    function back() { state.openId = null; view.render(host, ctx); }
  }

  function stagePipeline(host, ctx, ev, caps) {
    var wrap = el('div', { class: 'card' });
    wrap.appendChild(el('h3', { text: 'Stage' }));
    var row = el('div', { class: 'row wrap', style: 'gap:6px;margin-top:8px' });
    (stagesCache || []).forEach(function (s, i) {
      var isCur = s.key === ev.stage;
      var done = i < ev.stageIndex;
      var pill = el('button', {
        class: 'chip', style: 'cursor:' + (caps.moveStage ? 'pointer' : 'default') + ';' +
          (isCur ? 'background:var(--ink);color:#fff' : done ? 'background:#e2f7ec' : 'background:var(--bg)'),
        onclick: caps.moveStage ? function () { moveStage(host, ctx, ev, s.key); } : null
      }, (done ? '[x] ' : '') + s.label);
      row.appendChild(pill);
      if (i < stagesCache.length - 1) row.appendChild(el('span', { class: 'muted', text: '>' }));
    });
    wrap.appendChild(row);
    if (!caps.moveStage) wrap.appendChild(el('div', { class: 'muted small', style: 'margin-top:6px', text: 'Only the event manager can move stages.' }));
    return wrap;
  }

  function roadmapCard(host, ctx, ev, roadmap, caps) {
    var wrap = el('div', { class: 'card' });
    wrap.appendChild(el('div', { class: 'row' }, [
      el('h3', { text: 'Roadmap' }), el('span', { class: 'spacer' }),
      caps.edit ? el('button', { class: 'btn primary small', onclick: function () { phaseModal(host, ctx, ev, null); } }, '+ Phase') : null
    ]));
    if (!roadmap.length) { wrap.appendChild(HVUI.empty('No roadmap phases yet.')); return wrap; }
    var list = el('div', { class: 'stack', style: 'margin-top:10px' });
    roadmap.forEach(function (ph) {
      var actions = caps.edit ? el('div', { class: 'row', style: 'gap:6px' }, [
        el('button', { class: 'btn ghost small', onclick: function () { phaseModal(host, ctx, ev, ph); } }, 'Edit'),
        el('button', { class: 'btn danger small', onclick: function () { removePhase(host, ctx, ev, ph); } }, '✕')
      ]) : null;
      list.appendChild(el('div', { class: 'banner', style: 'border-left:4px solid var(--gold)' }, [
        el('div', { class: 'row wrap' }, [
          el('div', {}, [
            el('div', { style: 'font-family:var(--display);font-weight:700', text: ph.title }),
            (ph.startDate || ph.endDate) ? el('div', { class: 'muted small', text: (ph.startDate || '') + (ph.endDate ? ' → ' + ph.endDate : '') }) : null
          ]),
          el('span', { class: 'spacer' }), actions
        ]),
        ph.items ? el('div', { class: 'small', style: 'white-space:pre-wrap;margin-top:6px', text: ph.items }) : null
      ]));
    });
    wrap.appendChild(list);
    return wrap;
  }

  function organizersCard(host, ctx, ev, members, caps) {
    var wrap = el('div', { class: 'card' });
    wrap.appendChild(el('div', { class: 'row' }, [
      el('h3', { text: 'Organizers' }), el('span', { class: 'spacer' }),
      caps.manageMembers ? el('button', { class: 'btn primary small', onclick: function () { addMemberModal(host, ctx, ev, caps); } }, '+ Add' ) : null
    ]));
    var w = el('div', { class: 'table-wrap', style: 'margin-top:10px' });
    var tbl = el('table', { class: 'tbl' });
    tbl.appendChild(el('thead', {}, el('tr', {}, [ th('Person'), th('Role'), caps.manageMembers ? th('Manage') : null ])));
    var tb = el('tbody', {});
    members.forEach(function (m) { tb.appendChild(memberRow(host, ctx, ev, caps, m)); });
    tbl.appendChild(tb); w.appendChild(tbl); wrap.appendChild(w);
    return wrap;
  }

  function memberRow(host, ctx, ev, caps, m) {
    var av = m.photo
      ? el('img', { src: m.photo, alt: '', style: 'width:32px;height:32px;border:2px solid var(--line);object-fit:cover' })
      : el('div', { style: 'width:32px;height:32px;border:2px solid var(--line);display:grid;place-items:center;font-family:var(--display);font-weight:700;background:var(--bg)', text: HVUI.initials(m.name) });
    var who = el('td', {}, el('div', { class: 'row' }, [ av, el('div', {}, [ el('div', { style: 'font-weight:600', text: m.name }), el('div', { class: 'muted small', text: m.email }) ]) ]));
    var roleCell = el('td', {}, el('span', { class: 'chip ' + (m.rank === 'member' ? '' : 'role'), text: m.rankLabel }));
    var manage = null;
    if (caps.manageMembers) {
      manage = el('td', {});
      var a = el('div', { class: 'row wrap', style: 'gap:6px' });
      if (m.rank === 'member' && caps.assignManager) a.appendChild(btn('Make organizer', function () { setRole(host, ctx, ev, m, 'organizer'); }));
      if (m.rank === 'organizer' && caps.assignManager) a.appendChild(btn('Make member', function () { setRole(host, ctx, ev, m, 'member'); }));
      if (m.rank !== 'manager' && caps.assignManager) a.appendChild(btn('Make manager', function () { setManager(host, ctx, ev, m); }));
      if (m.rank !== 'manager' && (m.rank === 'member' || caps.assignManager)) a.appendChild(btnDanger('Remove', function () { removeMember(host, ctx, ev, m); }));
      if (!a.childNodes.length) a.appendChild(el('span', { class: 'muted small', text: '—' }));
      manage.appendChild(a);
    }
    return el('tr', {}, [who, roleCell, manage]);
  }

  function teamsCard(host, ctx, ev, teams, caps) {
    var wrap = el('div', { class: 'card' });
    wrap.appendChild(el('div', { class: 'row' }, [
      el('h3', { text: 'Teams on this event' }), el('span', { class: 'spacer' }),
      caps.edit ? el('button', { class: 'btn primary small', onclick: function () { linkTeamModal(host, ctx, ev); } }, '+ Link team') : null
    ]));
    if (!teams.length) { wrap.appendChild(HVUI.empty('No teams linked yet.')); return wrap; }
    var row = el('div', { class: 'row wrap', style: 'gap:8px;margin-top:10px' });
    teams.forEach(function (tm) {
      var chip = el('span', { class: 'chip role' }, [ document.createTextNode(tm.name) ]);
      if (caps.edit) chip.appendChild(el('span', { class: 'x', title: 'Unlink', onclick: function () { unlinkTeam(host, ctx, ev, tm); } }, 'x'));
      row.appendChild(chip);
    });
    wrap.appendChild(row);
    return wrap;
  }

  /* ================= mutations ================= */
  function reopen(host, ctx) { view.render(host, ctx); }

  function moveStage(host, ctx, ev, stage) {
    HVApi.hv('events.moveStage', { eventId: ev.id, stage: stage }).then(function (r) {
      if (r && r.ok) { toast('Stage updated.'); reopen(host, ctx); }
      else toast(HVApi.err(r, 'Could not move the stage.'), true);
    });
  }
  function setRole(host, ctx, ev, m, rank) {
    HVApi.hv('events.setRole', { eventId: ev.id, userId: m.userId, rank: rank }).then(function (r) {
      if (r && r.ok) { toast('Updated.'); reopen(host, ctx); } else toast(HVApi.err(r), true);
    });
  }
  function setManager(host, ctx, ev, m) {
    HVUI.confirm({ title: 'Transfer manager', message: 'Make ' + m.name + ' the manager? The current manager becomes an organizer.', yes: 'Transfer' },
      function () { HVApi.hv('events.setManager', { eventId: ev.id, userId: m.userId }).then(function (r) {
        if (r && r.ok) { toast('Manager transferred.'); reopen(host, ctx); } else toast(HVApi.err(r), true); }); });
  }
  function removeMember(host, ctx, ev, m) {
    HVUI.confirm({ title: 'Remove organizer', message: 'Remove ' + m.name + ' from this event?', yes: 'Remove', danger: true },
      function () { HVApi.hv('events.removeMember', { eventId: ev.id, userId: m.userId }).then(function (r) {
        if (r && r.ok) { toast('Removed.'); reopen(host, ctx); } else toast(HVApi.err(r), true); }); });
  }
  function archive(host, ctx, ev) {
    HVUI.confirm({ title: 'Archive event', message: 'Archive ' + ev.name + '? It leaves the list but is kept as history.', yes: 'Archive', danger: true },
      function () { HVApi.hv('events.archive', { eventId: ev.id }).then(function (r) {
        if (r && r.ok) { toast('Event archived.'); state.openId = null; reopen(host, ctx); } else toast(HVApi.err(r), true); }); });
  }
  function removePhase(host, ctx, ev, ph) {
    HVUI.confirm({ title: 'Remove phase', message: 'Remove "' + ph.title + '"?', yes: 'Remove', danger: true },
      function () { HVApi.hv('events.roadmap.remove', { eventId: ev.id, phaseId: ph.id }).then(function (r) {
        if (r && r.ok) { toast('Removed.'); reopen(host, ctx); } else toast(HVApi.err(r), true); }); });
  }
  function unlinkTeam(host, ctx, ev, tm) {
    HVApi.hv('events.unlinkTeam', { eventId: ev.id, linkId: tm.linkId }).then(function (r) {
      if (r && r.ok) { toast('Unlinked.'); reopen(host, ctx); } else toast(HVApi.err(r), true);
    });
  }

  function addMemberModal(host, ctx, ev, caps) {
    var email = el('input', { placeholder: 'their@email.com', autocomplete: 'off' });
    var rankSel = el('select', { style: 'width:100%;padding:10px;border:2px solid var(--line)' },
      [ optionNode('member', 'Member') ].concat(caps.assignManager ? [ optionNode('organizer', 'Organizer') ] : []));
    HVUI.modal({ title: 'Add an organizer',
      body: el('div', {}, [
        el('p', { class: 'muted small', text: 'Enter the email of someone who has signed in at least once.' }),
        el('div', { class: 'field' }, [ el('label', { text: 'Email' }), email ]),
        el('div', { class: 'field' }, [ el('label', { text: 'Role' }), rankSel ])
      ]),
      foot: HVUI.footer([ { label: 'Cancel', class: 'ghost' }, { label: 'Add', class: 'primary', closes: false, onClick: function () {
        var e = email.value.trim(); if (!e) { toast('Enter their email.', true); return; }
        HVApi.hv('events.addMember', { eventId: ev.id, email: e, rank: rankSel.value }).then(function (r) {
          if (r && r.ok) { HVUI.closeModal(); toast('Added.'); reopen(host, ctx); } else toast(HVApi.err(r), true); });
      }} ]) });
  }

  function linkTeamModal(host, ctx, ev) {
    var listHost = el('div', { style: 'max-height:40vh;overflow-y:auto' }, HVUI.loading('Loading teams…'));
    HVUI.modal({ title: 'Link a team', body: listHost });
    HVApi.hv('teams.list', {}).then(function (r) {
      listHost.innerHTML = '';
      if (!r || !r.ok || !r.teams.length) { listHost.appendChild(HVUI.empty('No teams to link.')); return; }
      r.teams.forEach(function (tm) {
        listHost.appendChild(el('button', { class: 'btn ghost block', style: 'justify-content:flex-start;margin-bottom:6px',
          onclick: function () {
            HVApi.hv('events.linkTeam', { eventId: ev.id, teamId: tm.id }).then(function (res) {
              if (res && res.ok) { HVUI.closeModal(); toast('Team linked.'); reopen(host, ctx); } else toast(HVApi.err(res), true); });
          } }, tm.name));
      });
    });
  }

  function phaseModal(host, ctx, ev, ph) {
    var title = el('input', { value: ph ? ph.title : '', placeholder: 'e.g. Planning' });
    var start = el('input', { type: 'date', value: ph ? ph.startDate : '' });
    var end = el('input', { type: 'date', value: ph ? ph.endDate : '' });
    var items = el('textarea', { placeholder: 'One item per line' }, ph ? ph.items : '');
    HVUI.modal({ title: ph ? 'Edit phase' : 'New roadmap phase',
      body: el('div', {}, [
        el('div', { class: 'field' }, [ el('label', { text: 'Title' }), title ]),
        el('div', { class: 'row', style: 'gap:10px' }, [
          el('div', { class: 'field', style: 'flex:1' }, [ el('label', { text: 'Start' }), start ]),
          el('div', { class: 'field', style: 'flex:1' }, [ el('label', { text: 'End' }), end ])
        ]),
        el('div', { class: 'field' }, [ el('label', { text: 'Items' }), items ])
      ]),
      foot: HVUI.footer([ { label: 'Cancel', class: 'ghost' }, { label: ph ? 'Save' : 'Add phase', class: 'primary', closes: false, onClick: function () {
        var t = title.value.trim(); if (!t) { toast('Give the phase a title.', true); return; }
        var payload = { eventId: ev.id, title: t, startDate: start.value, endDate: end.value, items: items.value.trim() };
        var fn = ph ? 'events.roadmap.update' : 'events.roadmap.add';
        if (ph) payload.phaseId = ph.id;
        HVApi.hv(fn, payload).then(function (r) {
          if (r && r.ok) { HVUI.closeModal(); toast(ph ? 'Saved.' : 'Phase added.'); reopen(host, ctx); } else toast(HVApi.err(r), true); });
      }} ]) });
  }

  function formModal(host, ctx, ev) {
    var name = el('input', { value: ev ? ev.name : '', placeholder: 'e.g. Hashverse 2026' });
    var desc = el('textarea', { placeholder: 'What is this event?' }, ev ? ev.description : '');
    var typeSel = el('select', { style: 'width:100%;padding:10px;border:2px solid var(--line)' },
      [ optionNode('', '— type —') ].concat((typesCache || []).map(function (tp) { return optionNode(tp, tp); })));
    if (ev) typeSel.value = ev.type || '';
    var start = el('input', { type: 'date', value: ev ? ev.startDate : '' });
    var end = el('input', { type: 'date', value: ev ? ev.endDate : '' });
    HVUI.modal({ title: ev ? 'Edit event' : 'New event',
      body: el('div', {}, [
        el('div', { class: 'field' }, [ el('label', { text: 'Name' }), name ]),
        el('div', { class: 'field' }, [ el('label', { text: 'Description' }), desc ]),
        el('div', { class: 'field' }, [ el('label', { text: 'Type' }), typeSel ]),
        el('div', { class: 'row', style: 'gap:10px' }, [
          el('div', { class: 'field', style: 'flex:1' }, [ el('label', { text: 'Start' }), start ]),
          el('div', { class: 'field', style: 'flex:1' }, [ el('label', { text: 'End' }), end ])
        ])
      ]),
      foot: HVUI.footer([ { label: 'Cancel', class: 'ghost' }, { label: ev ? 'Save' : 'Create event', class: 'primary', closes: false, onClick: function () {
        var n = name.value.trim(); if (!n) { toast('Give the event a name.', true); return; }
        var payload = { name: n, description: desc.value.trim(), type: typeSel.value, startDate: start.value, endDate: end.value };
        var fn = ev ? 'events.update' : 'events.create';
        if (ev) payload.eventId = ev.id;
        HVApi.hv(fn, payload).then(function (r) {
          if (r && r.ok) { HVUI.closeModal(); toast(ev ? 'Saved.' : 'Event created.'); if (!ev && r.eventId) state.openId = r.eventId; reopen(host, ctx); }
          else toast(HVApi.err(r, 'Could not save the event.'), true); });
      }} ]) });
  }

  function rankLabel(rank) { return { manager: 'Manager', organizer: 'Organizer', member: 'Member' }[rank] || rank; }
  function th(t) { return el('th', { text: t }); }
  function btn(label, fn) { return el('button', { class: 'btn ghost small', onclick: fn }, label); }
  function btnDanger(label, fn) { return el('button', { class: 'btn danger small', onclick: fn }, label); }
  function optionNode(v, label) { var o = el('option', { value: v }); o.textContent = label; return o; }

  return view;
})();
