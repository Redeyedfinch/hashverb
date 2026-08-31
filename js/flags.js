/**
 * Hashverb OS — Flags view. Inbox (against me) / outbox (raised by me) with the
 * lifecycle actions each side is allowed, and a "raise a flag" modal. This is
 * the coordination surface: who is waiting on whom.
 */
var HVFlagsView = (function () {
  var el = HVUI.el, esc = HVUI.esc, toast = HVUI.toast;
  var metaCache = null;
  var STATUS_COLOR = { created: '#F4A400', ack: '#0FA6AE', in_progress: '#0FA6AE', resolved: '#0f9d58', closed: '#6d6675' };
  var PRIO_COLOR = { low: '#6d6675', medium: '#0FA6AE', high: '#F4A400', urgent: '#E11D48' };
  var state = { box: 'inbox' };

  var view = {
    render: function (host, ctx) {
      host.innerHTML = '';
      ensureMeta().then(function () { paint(host, ctx); });
    }
  };

  function ensureMeta() {
    if (metaCache) return Promise.resolve();
    return HVApi.hv('flags.meta', {}).then(function (r) { metaCache = (r && r.ok) ? r : { categories: [], statuses: [], priorities: [] }; });
  }

  function paint(host, ctx) {
    host.innerHTML = '';
    host.appendChild(el('div', { class: 'page-head' }, [
      el('div', {}, [ el('div', { class: 'eyebrow', text: '// coordination' }), el('h1', { class: 'section-title', text: 'Flags' }) ]),
      el('span', { class: 'spacer' }),
      el('button', { class: 'btn primary', onclick: function () { raiseModal(host, ctx); } }, '+ Raise a flag')
    ]));

    var tabs = el('div', { class: 'tabs', style: 'margin-bottom:14px' }, [
      tabBtn('inbox', 'Against us', host, ctx),
      tabBtn('outbox', 'Raised by us', host, ctx)
    ]);
    host.appendChild(tabs);

    var listHost = el('div', {});
    host.appendChild(listHost);
    listHost.appendChild(HVUI.loading('Loading flags…'));
    HVApi.hv('flags.list', { box: state.box }).then(function (r) {
      listHost.innerHTML = '';
      if (!r || !r.ok) { listHost.appendChild(HVUI.empty(HVApi.err(r, 'Could not load flags.'))); return; }
      if (!r.flags.length) { listHost.appendChild(HVUI.empty(state.box === 'inbox' ? 'Nothing is waiting on you.' : 'You have not raised any flags.')); return; }
      var list = el('div', { class: 'stack' });
      r.flags.forEach(function (fl) { list.appendChild(flagCard(host, ctx, fl)); });
      listHost.appendChild(list);
    });
  }

  function tabBtn(box, label, host, ctx) {
    return el('button', { class: 'tab' + (state.box === box ? ' on' : ''), onclick: function () { state.box = box; paint(host, ctx); } }, label);
  }

  function flagCard(host, ctx, fl) {
    var head = el('div', { class: 'row wrap' }, [
      el('div', {}, [
        el('div', { style: 'font-family:var(--display);font-weight:700;font-size:16px', text: fl.title }),
        el('div', { class: 'muted small', text: fl.fromName + '  →  ' + fl.toName })
      ]),
      el('span', { class: 'spacer' }),
      el('span', { class: 'chip', style: 'background:' + (STATUS_COLOR[fl.status] || '') + '22;border-color:' + (STATUS_COLOR[fl.status] || 'var(--line)'), text: fl.statusLabel })
    ]);
    var meta = el('div', { class: 'row wrap', style: 'gap:6px;margin-top:8px' }, [
      el('span', { class: 'chip', text: fl.categoryLabel }),
      el('span', { class: 'chip', style: 'color:' + (PRIO_COLOR[fl.priority] || ''), text: fl.priority }),
      fl.deadline ? el('span', { class: 'chip', text: 'Due ' + fl.deadline }) : null
    ]);
    var body = fl.detail ? el('p', { class: 'small', style: 'margin:8px 0 0;white-space:pre-wrap', text: fl.detail }) : null;
    var actions = el('div', { class: 'row wrap', style: 'gap:6px;margin-top:10px' });
    flagActions(actions, host, ctx, fl);
    /* discussion (collapsed) */
    var discussHost = el('div', { style: 'margin-top:10px;display:none' });
    actions.appendChild(el('button', { class: 'btn ghost small', onclick: function () {
      if (discussHost.style.display === 'none') { discussHost.style.display = 'block'; HVComments.thread(discussHost, 'flag', fl.id); }
      else discussHost.style.display = 'none';
    } }, 'Discuss'));
    return el('div', { class: 'card', style: 'border-left:6px solid ' + (STATUS_COLOR[fl.status] || 'var(--pink)') }, [ head, meta, body, actions, discussHost ]);
  }

  function flagActions(row, host, ctx, fl) {
    /* target side drives ack/in_progress/resolved; raiser confirms closed / reopens */
    if (fl.iAmTarget && fl.status === 'created') row.appendChild(act('Acknowledge', 'ack', host, ctx, fl));
    if (fl.iAmTarget && (fl.status === 'ack')) row.appendChild(act('Start work', 'in_progress', host, ctx, fl));
    if (fl.iAmTarget && (fl.status === 'in_progress' || fl.status === 'ack')) row.appendChild(act('Mark resolved', 'resolved', host, ctx, fl, 'primary'));
    if (fl.iAmRaiser && fl.status === 'resolved') row.appendChild(act('Confirm & close', 'closed', host, ctx, fl, 'primary'));
    if (fl.iAmRaiser && (fl.status === 'resolved' || fl.status === 'closed')) row.appendChild(act('Reopen', 'in_progress', host, ctx, fl));
    if (fl.iAmRaiser && fl.status !== 'closed') row.appendChild(el('button', { class: 'btn danger small', onclick: function () { withdraw(host, ctx, fl); } }, 'Withdraw'));
    if (!row.childNodes.length) row.appendChild(el('span', { class: 'muted small', text: fl.iAmTarget ? 'Waiting on the other side.' : 'No actions right now.' }));
  }

  function act(label, status, host, ctx, fl, cls) {
    return el('button', { class: 'btn ' + (cls || 'ghost') + ' small', onclick: function () {
      HVApi.hv('flags.setStatus', { flagId: fl.id, status: status }).then(function (r) {
        if (r && r.ok) { toast('Updated.'); paint(host, ctx); } else toast(HVApi.err(r), true);
      });
    } }, label);
  }

  function withdraw(host, ctx, fl) {
    HVUI.confirm({ title: 'Withdraw flag', message: 'Withdraw "' + fl.title + '"?', yes: 'Withdraw', danger: true },
      function () { HVApi.hv('flags.archive', { flagId: fl.id }).then(function (r) {
        if (r && r.ok) { toast('Withdrawn.'); paint(host, ctx); } else toast(HVApi.err(r), true); }); });
  }

  /* raise modal: pick FROM (a team you're on, or yourself) and TO (team/event/person) */
  function raiseModal(host, ctx) {
    var body = el('div', {}, HVUI.loading('Loading…'));
    HVUI.modal({ title: 'Raise a flag', body: body });
    /* need: my teams (for FROM + TO), all teams/events (for TO), meta */
    Promise.all([HVApi.hv('teams.myTeams', {}), HVApi.hv('teams.list', {}), HVApi.hv('events.list', {})]).then(function (res) {
      var myTeams = (res[0] && res[0].teams) || [];
      var allTeams = (res[1] && res[1].teams) || [];
      var allEvents = (res[2] && res[2].events) || [];
      body.innerHTML = '';

      var fromSel = el('select', { style: sel() }, [opt('user:', 'Me (personally)')].concat(myTeams.map(function (t) { return opt('team:' + t.id, 'Team: ' + t.name); })));
      var toSel = el('select', { style: sel() },
        [optgroupNote('— pick a target —')]
        .concat(allTeams.map(function (t) { return opt('team:' + t.id, 'Team: ' + t.name); }))
        .concat(allEvents.map(function (e) { return opt('event:' + e.id, 'Event: ' + e.name); }))
        .concat([opt('user:email', 'A person (by email)…')]));
      var toEmail = el('input', { placeholder: 'their@email.com', style: 'margin-top:6px;display:none' });
      toSel.addEventListener('change', function () { toEmail.style.display = toSel.value === 'user:email' ? 'block' : 'none'; });

      var title = el('input', { placeholder: 'What do you need?' });
      var cat = el('select', { style: sel() }, metaCache.categories.map(function (c) { return opt(c.key, c.label); }));
      var prio = el('select', { style: sel() }, metaCache.priorities.map(function (pr) { return opt(pr, pr); }));
      prio.value = 'medium';
      var deadline = el('input', { type: 'date' });
      var detail = el('textarea', { placeholder: 'Any detail…' });

      body.appendChild(el('div', { class: 'field' }, [ el('label', { text: 'From' }), fromSel ]));
      body.appendChild(el('div', { class: 'field' }, [ el('label', { text: 'To' }), toSel, toEmail ]));
      body.appendChild(el('div', { class: 'field' }, [ el('label', { text: 'Title' }), title ]));
      body.appendChild(el('div', { class: 'row', style: 'gap:10px' }, [
        el('div', { class: 'field', style: 'flex:1' }, [ el('label', { text: 'Category' }), cat ]),
        el('div', { class: 'field', style: 'flex:1' }, [ el('label', { text: 'Priority' }), prio ])
      ]));
      body.appendChild(el('div', { class: 'field' }, [ el('label', { text: 'Deadline' }), deadline ]));
      body.appendChild(el('div', { class: 'field' }, [ el('label', { text: 'Detail' }), detail ]));

      var foot = HVUI.footer([ { label: 'Cancel', class: 'ghost' }, { label: 'Raise flag', class: 'primary', closes: false, onClick: function () {
        var t = title.value.trim(); if (!t) { toast('Give the flag a title.', true); return; }
        var from = parseSide(fromSel.value, null);
        var to = parseSide(toSel.value, toEmail.value.trim());
        if (!to) { toast('Pick who this flag is for.', true); return; }
        if (toSel.value === 'user:email' && !toEmail.value.trim()) { toast('Enter the person’s email.', true); return; }
        var payload = { fromType: from.type, fromId: from.id, toType: to.type, toId: to.id, toEmail: to.email,
          title: t, category: cat.value, priority: prio.value, deadline: deadline.value, detail: detail.value.trim() };
        HVApi.hv('flags.create', payload).then(function (r) {
          if (r && r.ok) { HVUI.closeModal(); toast('Flag raised.'); state.box = 'outbox'; paint(host, ctx); }
          else toast(HVApi.err(r, 'Could not raise the flag.'), true);
        });
      } } ]);
      /* replace modal footer */
      var card = body.parentNode; card.appendChild(foot);
    });
  }

  function parseSide(v, email) {
    if (!v || v.indexOf(':') < 0) return null;
    var parts = v.split(':'); var type = parts[0]; var id = parts.slice(1).join(':');
    if (type === 'user' && (id === '' )) return { type: 'user', id: '' };          /* self */
    if (type === 'user' && id === 'email') return { type: 'user', id: '', email: email };
    return { type: type, id: id };
  }

  function sel() { return 'width:100%;padding:10px;border:2px solid var(--line)'; }
  function opt(v, label) { var o = document.createElement('option'); o.value = v; o.textContent = label; return o; }
  function optgroupNote(label) { var o = document.createElement('option'); o.value = ''; o.textContent = label; o.disabled = true; return o; }

  return view;
})();
