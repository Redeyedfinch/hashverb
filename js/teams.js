/**
 * Hashverb OS — Teams view (directory + detail + management).
 *
 * One HVViews-style object with two internal states: the directory grid and a
 * single-team detail page. Management controls are shown or hidden by the caps
 * object the server returns from teams.get — but every action is re-authorized
 * server-side, so a tampered client gains nothing.
 */
var HVTeamsView = (function () {
  var el = HVUI.el, esc = HVUI.esc, toast = HVUI.toast;

  var DOMAIN_COLORS = {
    AI: '#0FA6AE', Robotics: '#E94560', Cybersecurity: '#F4A400',
    Design: '#7c5cff', Media: '#e0567a', Events: '#0f9d58',
    Operations: '#524b5c', Finance: '#0B7278', Documentation: '#6d6675',
    Sponsorship: '#b8860b', Other: '#17131f'
  };
  var TEAM_ICONS = ['🤖', '🧠', '🔐', '🎨', '📣', '🎯', '⚙️', '💰', '📄', '🤝', '🚀', '⚡'];
  var domainsCache = null;

  var state = { openId: null };

  var view = {
    render: function (host, ctx) {
      host.innerHTML = '';
      ensureDomains().then(function () {
        if (state.openId) renderDetail(host, ctx, state.openId);
        else renderDirectory(host, ctx);
      });
    }
  };

  function ensureDomains() {
    if (domainsCache) return Promise.resolve(domainsCache);
    return HVApi.hv('teams.domains', {}).then(function (r) {
      domainsCache = (r && r.ok) ? r.domains : ['AI', 'Robotics', 'Cybersecurity', 'Other'];
      return domainsCache;
    });
  }

  function domainChip(domain) {
    if (!domain) return null;
    var c = DOMAIN_COLORS[domain] || '#17131f';
    return el('span', { class: 'chip', style: 'border-color:' + c + ';color:' + c }, domain);
  }

  /* ================= directory ================= */
  function renderDirectory(host, ctx) {
    host.innerHTML = '';
    var canCreate = HVPerm.has(ctx.me.perms, 'teams.create');

    host.appendChild(el('div', { class: 'page-head' }, [
      el('div', {}, [
        el('div', { class: 'eyebrow', text: '// teams' }),
        el('h1', { class: 'section-title', text: 'Teams' })
      ]),
      el('span', { class: 'spacer' }),
      canCreate ? el('button', { class: 'btn primary', onclick: function () { createModal(host, ctx); } }, '+ New team') : null
    ]));

    var listHost = el('div', {});
    host.appendChild(listHost);
    listHost.appendChild(HVUI.loading('Loading teams…'));

    HVApi.hv('teams.list', {}).then(function (r) {
      listHost.innerHTML = '';
      if (!r || !r.ok) { listHost.appendChild(HVUI.empty(HVApi.err(r, 'Could not load teams.'))); return; }
      if (!r.teams.length) {
        listHost.appendChild(HVUI.empty(canCreate ? 'No teams yet — create the first one.' : 'No teams yet.'));
        return;
      }
      var grid = el('div', { class: 'tiles' });
      r.teams.forEach(function (tm) { grid.appendChild(teamCard(tm)); });
      listHost.appendChild(grid);
    });

    function teamCard(tm) {
      var c = DOMAIN_COLORS[tm.domain] || '#17131f';
      return el('button', {
        class: 'tile', style: 'text-align:left;cursor:pointer;border-left:6px solid ' + esc(tm.color || c),
        onclick: function () { state.openId = tm.id; view.render(host, ctx); }
      }, [
        el('div', { class: 'row' }, [
          el('div', { style: 'font-size:26px', text: tm.icon || '🚀' }),
          el('span', { class: 'spacer' }),
          tm.myRank ? el('span', { class: 'chip role', text: rankLabel(tm.myRank) }) : null
        ]),
        el('div', { style: 'font-family:var(--display);font-weight:700;font-size:18px;margin-top:8px', text: tm.name }),
        el('div', { class: 'row wrap', style: 'gap:6px;margin-top:6px' }, [ domainChip(tm.domain) ]),
        el('div', { class: 'l', style: 'margin-top:8px', text: tm.memberCount + (tm.memberCount === 1 ? ' member' : ' members') })
      ]);
    }
  }

  /* ================= detail ================= */
  function renderDetail(host, ctx, teamId) {
    host.innerHTML = '';
    host.appendChild(HVUI.loading('Loading team…'));
    HVApi.hv('teams.get', { teamId: teamId }).then(function (r) {
      host.innerHTML = '';
      if (!r || !r.ok) {
        host.appendChild(el('button', { class: 'btn ghost small', onclick: back }, '← Teams'));
        host.appendChild(HVUI.empty(HVApi.err(r, 'Could not open that team.')));
        return;
      }
      var tm = r.team, caps = r.caps, members = r.members;
      var c = DOMAIN_COLORS[tm.domain] || '#17131f';

      host.appendChild(el('button', { class: 'btn ghost small', style: 'margin-bottom:12px', onclick: back }, '← All teams'));

      /* header */
      var headActions = el('div', { class: 'row wrap', style: 'gap:8px' });
      if (caps.edit) headActions.appendChild(el('button', { class: 'btn ghost small', onclick: function () { editModal(host, ctx, tm); } }, 'Edit'));
      if (caps.archive) headActions.appendChild(el('button', { class: 'btn danger small', onclick: function () { archive(host, ctx, tm); } }, 'Archive'));

      host.appendChild(el('div', { class: 'card', style: 'border-left:6px solid ' + esc(tm.color || c) }, [
        el('div', { class: 'row wrap' }, [
          el('div', { style: 'font-size:34px', text: tm.icon || '🚀' }),
          el('div', {}, [
            el('h1', { class: 'section-title', style: 'margin:0', text: tm.name }),
            el('div', { class: 'row wrap', style: 'gap:6px;margin-top:4px' }, [ domainChip(tm.domain),
              el('span', { class: 'muted small', text: tm.memberCount + (tm.memberCount === 1 ? ' member' : ' members') }) ])
          ]),
          el('span', { class: 'spacer' }),
          headActions
        ]),
        tm.description ? el('p', { class: 'section-sub', style: 'margin-top:12px', text: tm.description }) : null,
        tm.responsibilities ? el('div', { style: 'margin-top:12px' }, [
          el('div', { class: 'grp-title', text: 'Responsibilities' }),
          el('div', { class: 'small', style: 'white-space:pre-wrap', text: tm.responsibilities })
        ]) : null
      ]));

      /* roster */
      var roster = el('div', { class: 'card' });
      roster.appendChild(el('div', { class: 'row' }, [
        el('h3', { text: 'Members' }),
        el('span', { class: 'spacer' }),
        caps.manageMembers ? el('button', { class: 'btn primary small', onclick: function () { addMemberModal(host, ctx, tm, caps); } }, '+ Add member') : null
      ]));
      var wrap = el('div', { class: 'table-wrap', style: 'margin-top:10px' });
      var tbl = el('table', { class: 'tbl' });
      tbl.appendChild(el('thead', {}, el('tr', {}, [ th('Member'), th('Role'), caps.manageMembers ? th('Manage') : null ])));
      var tb = el('tbody', {});
      members.forEach(function (m) { tb.appendChild(memberRow(host, ctx, tm, caps, m)); });
      tbl.appendChild(tb);
      wrap.appendChild(tbl);
      roster.appendChild(wrap);
      host.appendChild(roster);

      /* tasks board for this team */
      var tasksCard = el('div', { class: 'card' }, [ el('h3', { text: 'Tasks' }) ]);
      var boardHost = el('div', { style: 'margin-top:10px' });
      tasksCard.appendChild(boardHost);
      host.appendChild(tasksCard);
      HVTaskBoard.render(boardHost, 'team', tm.id);

      /* files for this team */
      var filesCard = el('div', { class: 'card' }, [ el('h3', { text: 'Files' }) ]);
      var filesHost = el('div', { style: 'margin-top:10px' });
      filesCard.appendChild(filesHost);
      host.appendChild(filesCard);
      HVFilesBoard.render(filesHost, 'team', tm.id);

      /* budget for this team */
      var budgetCard = el('div', { class: 'card' }, [ el('h3', { text: 'Budget' }) ]);
      var budgetHost = el('div', { style: 'margin-top:10px' });
      budgetCard.appendChild(budgetHost);
      host.appendChild(budgetCard);
      HVBudgetBoard.render(budgetHost, 'team', tm.id);
    });

    function back() { state.openId = null; view.render(host, ctx); }
  }

  function memberRow(host, ctx, tm, caps, m) {
    var avatar = m.photo
      ? el('img', { src: m.photo, alt: '', style: 'width:32px;height:32px;border:2px solid var(--line);object-fit:cover' })
      : el('div', { style: 'width:32px;height:32px;border:2px solid var(--line);display:grid;place-items:center;font-family:var(--display);font-weight:700;background:var(--bg)', text: HVUI.initials(m.name) });

    var who = el('td', {}, el('div', { class: 'row' }, [ avatar,
      el('div', {}, [ el('div', { style: 'font-weight:600', text: m.name }), el('div', { class: 'muted small', text: m.email }) ]) ]));

    var roleCell = el('td', {}, el('span', { class: 'chip ' + (m.rank === 'member' ? '' : 'role'), text: m.rankLabel }));

    var manageCell = null;
    if (caps.manageMembers) {
      manageCell = el('td', {});
      var actions = el('div', { class: 'row wrap', style: 'gap:6px' });
      /* promote/demote co-lead needs lead authority (caps.assignLead) */
      if (m.rank === 'member' && caps.assignLead) actions.appendChild(btn('Make co-lead', function () { setRole(host, ctx, tm, m, 'colead'); }));
      if (m.rank === 'colead' && caps.assignLead) actions.appendChild(btn('Make member', function () { setRole(host, ctx, tm, m, 'member'); }));
      if (m.rank !== 'lead' && caps.assignLead) actions.appendChild(btn('Make lead', function () { setLead(host, ctx, tm, m); }));
      /* removing a lead is blocked server-side; hide the control */
      if (m.rank !== 'lead') {
        var needLead = (m.rank === 'colead');
        if (!needLead || caps.assignLead) actions.appendChild(btnDanger('Remove', function () { removeMember(host, ctx, tm, m); }));
      }
      if (!actions.childNodes.length) actions.appendChild(el('span', { class: 'muted small', text: '—' }));
      manageCell.appendChild(actions);
    }
    return el('tr', {}, [who, roleCell, manageCell]);
  }

  /* ================= mutations ================= */
  function reopen(host, ctx) { view.render(host, ctx); }

  function setRole(host, ctx, tm, m, rank) {
    HVApi.hv('teams.setRole', { teamId: tm.id, userId: m.userId, rank: rank }).then(function (r) {
      if (r && r.ok) { toast('Updated.'); reopen(host, ctx); }
      else toast(HVApi.err(r, 'Could not change that role.'), true);
    });
  }
  function setLead(host, ctx, tm, m) {
    HVUI.confirm({ title: 'Transfer lead', message: 'Make ' + m.name + ' the lead of ' + tm.name + '? The current lead becomes a co-lead.', yes: 'Transfer lead' },
      function () {
        HVApi.hv('teams.setLead', { teamId: tm.id, userId: m.userId }).then(function (r) {
          if (r && r.ok) { toast('Lead transferred.'); reopen(host, ctx); }
          else toast(HVApi.err(r, 'Could not transfer lead.'), true);
        });
      });
  }
  function removeMember(host, ctx, tm, m) {
    HVUI.confirm({ title: 'Remove member', message: 'Remove ' + m.name + ' from ' + tm.name + '?', yes: 'Remove', danger: true },
      function () {
        HVApi.hv('teams.removeMember', { teamId: tm.id, userId: m.userId }).then(function (r) {
          if (r && r.ok) { toast('Removed.'); reopen(host, ctx); }
          else toast(HVApi.err(r, 'Could not remove that member.'), true);
        });
      });
  }
  function archive(host, ctx, tm) {
    HVUI.confirm({ title: 'Archive team', message: 'Archive ' + tm.name + '? It leaves the directory but is not deleted.', yes: 'Archive', danger: true },
      function () {
        HVApi.hv('teams.archive', { teamId: tm.id }).then(function (r) {
          if (r && r.ok) { toast('Team archived.'); state.openId = null; reopen(host, ctx); }
          else toast(HVApi.err(r, 'Could not archive.'), true);
        });
      });
  }

  function addMemberModal(host, ctx, tm, caps) {
    var email = el('input', { placeholder: 'their@email.com', autocomplete: 'off' });
    var rankSel = el('select', { style: 'width:100%;padding:10px;border:2px solid var(--line)' },
      [ optionNode('member', 'Member') ].concat(caps.assignLead ? [ optionNode('colead', 'Co-Lead') ] : []));
    HVUI.modal({
      title: 'Add a member to ' + tm.name,
      body: el('div', {}, [
        el('p', { class: 'muted small', text: 'Enter the email of someone who has signed in at least once.' }),
        el('div', { class: 'field' }, [ el('label', { text: 'Email' }), email ]),
        el('div', { class: 'field' }, [ el('label', { text: 'Role' }), rankSel ])
      ]),
      foot: HVUI.footer([
        { label: 'Cancel', class: 'ghost' },
        { label: 'Add member', class: 'primary', closes: false, onClick: function () {
          var e = email.value.trim();
          if (!e) { toast('Enter their email.', true); return; }
          HVApi.hv('teams.addMember', { teamId: tm.id, email: e, rank: rankSel.value }).then(function (r) {
            if (r && r.ok) { HVUI.closeModal(); toast('Member added.'); reopen(host, ctx); }
            else toast(HVApi.err(r, 'Could not add that member.'), true);
          });
        }}
      ])
    });
  }

  function createModal(host, ctx) { teamFormModal(host, ctx, null); }
  function editModal(host, ctx, tm) { teamFormModal(host, ctx, tm); }

  function teamFormModal(host, ctx, tm) {
    var nameIn = el('input', { value: tm ? tm.name : '', placeholder: 'e.g. Design Team' });
    var descIn = el('textarea', { placeholder: 'What does this team do?' }, tm ? tm.description : '');
    var domainSel = el('select', { style: 'width:100%;padding:10px;border:2px solid var(--line)' },
      [ optionNode('', '— domain —') ].concat((domainsCache || []).map(function (d) { return optionNode(d, d); })));
    if (tm) domainSel.value = tm.domain || '';
    var respIn = el('textarea', { placeholder: 'One responsibility per line' }, tm ? tm.responsibilities : '');

    /* icon picker */
    var chosenIcon = tm && tm.icon ? tm.icon : TEAM_ICONS[0];
    var iconRow = el('div', { class: 'row wrap', style: 'gap:6px' });
    TEAM_ICONS.forEach(function (ic) {
      var b = el('button', { class: 'btn ghost small', style: 'font-size:18px', onclick: function () {
        chosenIcon = ic; HVUI.$$('.ws-ico-btn', iconRow).forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
      }}, ic);
      b.classList.add('ws-ico-btn');
      if (ic === chosenIcon) b.classList.add('on');
      iconRow.appendChild(b);
    });

    HVUI.modal({
      title: tm ? 'Edit team' : 'New team',
      body: el('div', {}, [
        el('div', { class: 'field' }, [ el('label', { text: 'Name' }), nameIn ]),
        el('div', { class: 'field' }, [ el('label', { text: 'Description' }), descIn ]),
        el('div', { class: 'field' }, [ el('label', { text: 'Domain' }), domainSel ]),
        el('div', { class: 'field' }, [ el('label', { text: 'Icon' }), iconRow ]),
        el('div', { class: 'field' }, [ el('label', { text: 'Responsibilities' }), respIn ])
      ]),
      foot: HVUI.footer([
        { label: 'Cancel', class: 'ghost' },
        { label: tm ? 'Save' : 'Create team', class: 'primary', closes: false, onClick: function () {
          var name = nameIn.value.trim();
          if (!name) { toast('Give the team a name.', true); return; }
          var payload = { name: name, description: descIn.value.trim(), domain: domainSel.value,
            icon: chosenIcon, responsibilities: respIn.value.trim() };
          var fn = tm ? 'teams.update' : 'teams.create';
          if (tm) payload.teamId = tm.id;
          HVApi.hv(fn, payload).then(function (r) {
            if (r && r.ok) {
              HVUI.closeModal();
              toast(tm ? 'Team saved.' : 'Team created.');
              if (!tm && r.teamId) state.openId = r.teamId;
              reopen(host, ctx);
            } else toast(HVApi.err(r, 'Could not save the team.'), true);
          });
        }}
      ])
    });
  }

  /* ---- helpers ---- */
  function rankLabel(rank) { return { lead: 'Lead', colead: 'Co-Lead', member: 'Member' }[rank] || rank; }
  function th(t) { return el('th', { text: t }); }
  function btn(label, fn) { return el('button', { class: 'btn ghost small', onclick: fn }, label); }
  function btnDanger(label, fn) { return el('button', { class: 'btn danger small', onclick: fn }, label); }
  function optionNode(v, label) { var o = el('option', { value: v }); o.textContent = label; return o; }

  /* reset internal state when leaving the view entirely */
  view.reset = function () { state.openId = null; };

  return view;
})();
