/**
 * Hashverb OS — check-ins + meetings (frontend).
 *   HVCheckins.card(host)          weekly check-in on Home
 *   HVCheckins.team(host, teamId)  the lead's team check-in view
 *   HVMeetings.render(host, pt, pid) meeting list for a parent
 */
var HVCheckins = (function () {
  var el = HVUI.el, toast = HVUI.toast;

  function card(host) {
    host.innerHTML = '';
    HVApi.hv('checkins.mine', {}).then(function (r) {
      host.innerHTML = '';
      var tw = (r && r.ok) ? r.thisWeek : null;
      host.appendChild(el('div', { class: 'row' }, [ el('h2', { text: 'Weekly check-in' }), el('span', { class: 'spacer' }),
        el('span', { class: 'chip', style: tw ? 'background:#e2f7ec' : 'background:#fff3c9', text: tw ? 'Submitted' : 'Not yet' }) ]));
      var acc = el('textarea', { placeholder: 'What did you get done this week?' }, tw ? tw.accomplished : '');
      var nxt = el('textarea', { placeholder: 'What’s next?' }, tw ? tw.next : '');
      var blk = el('textarea', { placeholder: 'Anything blocking you? (optional)' }, tw ? tw.blockers : '');
      var help = el('input', { type: 'checkbox' }); if (tw && tw.needHelp) help.checked = true;
      host.appendChild(el('div', { class: 'field' }, [ el('label', { text: 'Accomplished' }), acc ]));
      host.appendChild(el('div', { class: 'field' }, [ el('label', { text: 'Next' }), nxt ]));
      host.appendChild(el('div', { class: 'field' }, [ el('label', { text: 'Blockers' }), blk ]));
      host.appendChild(el('label', { class: 'check' }, [ help, el('span', { class: 'k', text: 'I need help' }) ]));
      host.appendChild(el('div', { style: 'margin-top:8px' }, [ el('button', { class: 'btn primary', onclick: function () {
        if (!acc.value.trim()) { toast('At least say what you accomplished.', true); return; }
        HVApi.hv('checkins.submit', { accomplished: acc.value.trim(), next: nxt.value.trim(), blockers: blk.value.trim(), needHelp: help.checked }).then(function (rr) {
          if (rr && rr.ok) { toast('Check-in saved.'); card(host); } else toast(HVApi.err(rr), true);
        });
      } }, tw ? 'Update' : 'Submit') ]));
    });
  }

  function team(host, teamId) {
    host.innerHTML = '';
    host.appendChild(HVUI.loading('Loading check-ins…'));
    HVApi.hv('checkins.team', { teamId: teamId }).then(function (r) {
      host.innerHTML = '';
      if (!r || !r.ok) { host.appendChild(HVUI.empty(HVApi.err(r, 'Not available.'))); return; }
      var s = r.summary;
      host.appendChild(el('div', { class: 'muted small', style: 'margin-bottom:8px',
        text: s.submitted + '/' + s.total + ' submitted · ' + s.blocked + ' blocked · ' + s.needHelp + ' need help' }));
      var list = el('div', { class: 'stack' });
      r.members.forEach(function (m) {
        list.appendChild(el('div', { class: 'banner' + (m.submitted ? '' : ' warn') }, [
          el('div', { class: 'row' }, [
            el('div', { style: 'font-weight:600', text: m.name + (m.rank !== 'member' ? ' (' + m.rank + ')' : '') }),
            el('span', { class: 'spacer' }),
            m.needHelp ? el('span', { class: 'chip', style: 'background:#ffe3ea;color:var(--danger)', text: 'needs help' }) : null,
            el('span', { class: 'chip', style: m.submitted ? 'background:#e2f7ec' : '', text: m.submitted ? '✓' : 'missing' })
          ]),
          m.submitted ? el('div', { class: 'small', style: 'margin-top:4px' }, [
            m.accomplished ? el('div', {}, [ el('strong', { text: 'Did: ' }), document.createTextNode(m.accomplished) ]) : null,
            m.next ? el('div', { class: 'muted' }, [ el('strong', { text: 'Next: ' }), document.createTextNode(m.next) ]) : null,
            m.blockers ? el('div', { style: 'color:var(--danger)' }, [ el('strong', { text: 'Blocked: ' }), document.createTextNode(m.blockers) ]) : null
          ]) : null
        ]));
      });
      host.appendChild(list);
    });
  }

  return { card: card, team: team };
})();

var HVMeetings = (function () {
  var el = HVUI.el, toast = HVUI.toast;
  var STATUS_COLOR = { scheduled: '#F4A400', held: '#0f9d58', cancelled: '#6d6675' };

  function render(host, parentType, parentId) {
    host.innerHTML = '';
    HVApi.hv('meetings.list', { parentType: parentType, parentId: parentId }).then(function (r) {
      host.innerHTML = '';
      if (!r || !r.ok) { host.appendChild(HVUI.empty(HVApi.err(r, 'Could not load meetings.'))); return; }
      host.appendChild(el('div', { class: 'row', style: 'margin-bottom:10px' }, [
        el('span', { class: 'spacer' }),
        r.canManage ? el('button', { class: 'btn primary small', onclick: function () { form(host, parentType, parentId, null); } }, '+ Meeting') : null
      ]));
      if (!r.meetings.length) { host.appendChild(el('div', { class: 'muted small', text: 'No meetings yet.' })); return; }
      var list = el('div', { class: 'stack' });
      r.meetings.forEach(function (m) { list.appendChild(row(host, parentType, parentId, m, r.canManage)); });
      host.appendChild(list);
    });
  }

  function row(host, parentType, parentId, m, canManage) {
    return el('div', { class: 'banner', style: 'border-left:4px solid ' + (STATUS_COLOR[m.status] || 'var(--line)'), cursor: 'pointer',
      onclick: function () { detail(host, parentType, parentId, m, canManage); } }, [
      el('div', { class: 'row' }, [
        el('div', { style: 'font-weight:700', text: m.title }), el('span', { class: 'spacer' }),
        el('span', { class: 'chip', text: m.statusLabel })
      ]),
      el('div', { class: 'muted small', text: [m.when, m.location, m.link ? 'link' : ''].filter(Boolean).join(' · ') })
    ]);
  }

  function detail(host, parentType, parentId, m, canManage) {
    var body = el('div', {}, HVUI.loading('Loading…'));
    HVUI.modal({ title: m.title, body: body });
    HVApi.hv('meetings.list', { parentType: parentType, parentId: parentId }).then(function (r) {
      var fresh = m; (r.meetings || []).forEach(function (x) { if (x.id === m.id) fresh = x; });
      body.innerHTML = '';
      body.appendChild(el('div', { class: 'muted small', text: [fresh.when, fresh.location, fresh.link].filter(Boolean).join(' · ') }));
      if (fresh.link) body.appendChild(el('a', { href: fresh.link, target: '_blank', rel: 'noopener', text: 'Join link' }));
      section(body, 'Agenda', fresh.agenda);
      if (canManage) {
        editable(body, host, parentType, parentId, fresh);
      } else {
        section(body, 'Notes', fresh.notes);
        section(body, 'Decisions', fresh.decisions);
      }
    });
  }

  function editable(body, host, parentType, parentId, m) {
    var notes = el('textarea', {}, m.notes);
    var decisions = el('textarea', {}, m.decisions);
    var status = el('select', { style: sel() }, [opt('scheduled', 'Scheduled'), opt('held', 'Held'), opt('cancelled', 'Cancelled')]);
    status.value = m.status;
    body.appendChild(el('div', { class: 'field' }, [ el('label', { text: 'Notes' }), notes ]));
    body.appendChild(el('div', { class: 'field' }, [ el('label', { text: 'Decisions (one per line)' }), decisions ]));
    body.appendChild(el('div', { class: 'field' }, [ el('label', { text: 'Status' }), status ]));
    body.appendChild(el('div', { class: 'row wrap', style: 'gap:6px' }, [
      el('button', { class: 'btn primary small', onclick: function () {
        HVApi.hv('meetings.update', { meetingId: m.id, notes: notes.value, decisions: decisions.value, status: status.value }).then(function (r) {
          if (r && r.ok) { toast('Saved.'); } else toast(HVApi.err(r), true);
        });
      } }, 'Save notes'),
      parentType !== 'org' ? el('button', { class: 'btn ghost small', onclick: function () { toTask(host, parentType, parentId, m); } }, 'Decision → task') : null,
      el('button', { class: 'btn danger small', onclick: function () {
        HVApi.hv('meetings.archive', { meetingId: m.id }).then(function (r) { if (r && r.ok) { HVUI.closeModal(); toast('Removed.'); render(host, parentType, parentId); } else toast(HVApi.err(r), true); });
      } }, 'Remove')
    ]));
  }

  function toTask(host, parentType, parentId, m) {
    var title = el('input', { placeholder: 'Action item' });
    HVUI.modal({ title: 'Decision → task', body: el('div', { class: 'field' }, [ el('label', { text: 'Task title' }), title ]),
      foot: HVUI.footer([ { label: 'Cancel', class: 'ghost' }, { label: 'Create task', class: 'primary', closes: false, onClick: function () {
        if (!title.value.trim()) { toast('Give it a title.', true); return; }
        HVApi.hv('meetings.decisionToTask', { meetingId: m.id, title: title.value.trim() }).then(function (r) {
          if (r && r.ok) { HVUI.closeModal(); toast('Task created on the ' + parentType + '.'); } else toast(HVApi.err(r), true);
        });
      } } ]) });
  }

  function form(host, parentType, parentId, m) {
    var title = el('input', { placeholder: 'Meeting title' });
    var when = el('input', { placeholder: 'e.g. Fri 1 Sep, 5 PM' });
    var loc = el('input', { placeholder: 'Location (optional)' });
    var link = el('input', { placeholder: 'Video link (optional)' });
    var agenda = el('textarea', { placeholder: 'Agenda' });
    HVUI.modal({ title: 'Schedule meeting', body: el('div', {}, [
      el('div', { class: 'field' }, [ el('label', { text: 'Title' }), title ]),
      el('div', { class: 'field' }, [ el('label', { text: 'When' }), when ]),
      el('div', { class: 'row', style: 'gap:10px' }, [
        el('div', { class: 'field', style: 'flex:1' }, [ el('label', { text: 'Location' }), loc ]),
        el('div', { class: 'field', style: 'flex:1' }, [ el('label', { text: 'Link' }), link ])
      ]),
      el('div', { class: 'field' }, [ el('label', { text: 'Agenda' }), agenda ])
    ]), foot: HVUI.footer([ { label: 'Cancel', class: 'ghost' }, { label: 'Schedule', class: 'primary', closes: false, onClick: function () {
      if (!title.value.trim()) { toast('Give the meeting a title.', true); return; }
      HVApi.hv('meetings.create', { parentType: parentType, parentId: parentId, title: title.value.trim(), when: when.value.trim(), location: loc.value.trim(), link: link.value.trim(), agenda: agenda.value.trim() }).then(function (r) {
        if (r && r.ok) { HVUI.closeModal(); toast('Scheduled.'); render(host, parentType, parentId); } else toast(HVApi.err(r), true);
      });
    } } ]) });
  }

  function section(body, label, text) {
    if (!text) return;
    body.appendChild(el('div', { class: 'grp-title', text: label }));
    body.appendChild(el('div', { class: 'small', style: 'white-space:pre-wrap', text: text }));
  }
  function sel() { return 'width:100%;padding:10px;border:2px solid var(--line)'; }
  function opt(v, label) { var o = document.createElement('option'); o.value = v; o.textContent = label; return o; }

  return { render: render };
})();
