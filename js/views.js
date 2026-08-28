/**
 * Hashverb OS — views. Each view is an object with render(host, ctx), where
 * ctx = { me: profile, go: navigate(id), reload: reBoot }. Views read the
 * backend through HVApi.hv and never touch the DOM outside their own host.
 *
 * Phase 1 ships: Home, Members, Roles, Profile, Activity. Later phases add
 * their own view objects and nav entries; nothing here is a dead end.
 */
var HVViews = (function () {
  var el = HVUI.el, esc = HVUI.esc, toast = HVUI.toast;

  /* ====================================================================
     HOME — the personal landing. Shows identity, roles, and quick links to
     whatever the user is allowed to reach. Deliberately calm.
     ==================================================================== */
  var home = {
    render: function (host, ctx) {
      var me = ctx.me;
      host.innerHTML = '';

      var greetHour = new Date().getHours();
      var greet = greetHour < 12 ? 'Good morning' : greetHour < 17 ? 'Good afternoon' : 'Good evening';
      var firstName = String(me.name || me.email).split(/\s+/)[0];

      host.appendChild(el('div', { class: 'page-head' }, [
        el('div', {}, [
          el('div', { class: 'eyebrow', text: '// ' + HV_CONFIG.ORG_NAME.toLowerCase() }),
          el('h1', { class: 'section-title', text: greet + ', ' + firstName + '.' }),
          el('p', { class: 'section-sub', text: rolesLine(me) })
        ])
      ]));

      /* quick-links grid, gated by permission */
      var links = [];
      if (HVPerm.canSeeView(me.perms, 'members')) links.push(link('👥', 'Members', 'Directory, roles & access', 'members'));
      if (HVPerm.canSeeView(me.perms, 'roles')) links.push(link('🛡', 'Roles', 'Define what people can do', 'roles'));
      if (HVPerm.canSeeView(me.perms, 'audit')) links.push(link('📜', 'Activity', 'Recent administrative actions', 'audit'));
      links.push(link('🧑', 'Profile', 'Your account & devices', 'profile'));

      var grid = el('div', { class: 'tiles' });
      links.forEach(function (l) { grid.appendChild(l); });
      host.appendChild(el('div', { class: 'card' }, [
        el('h2', { text: 'Jump to' }),
        grid
      ]));

      /* a gentle note about what is and isn't built yet, so the org knows the
         roadmap without leaving the app */
      host.appendChild(el('div', { class: 'card banner info', style: 'margin-top:16px' }, [
        el('strong', { text: 'Foundation is live.' }),
        el('span', { text: ' Sign-in, roles and permissions are ready. Teams, events, tasks, flags, files and budgets arrive in the next phases.' })
      ]));

      function link(icon, title, sub, id) {
        return el('button', {
          class: 'tile', style: 'text-align:left;cursor:pointer',
          onclick: function () { ctx.go(id); }
        }, [
          el('div', { class: 'n', style: 'font-size:26px', text: icon }),
          el('div', { style: 'font-family:var(--display);font-weight:700;margin-top:6px', text: title }),
          el('div', { class: 'l', text: sub })
        ]);
      }
    }
  };

  function rolesLine(me) {
    var org = (me.roles || []).filter(function (r) { return r.scope === 'org'; });
    if (!org.length) return 'You are signed in. An admin can give you a role to unlock more.';
    return 'Your role' + (org.length > 1 ? 's' : '') + ': ' + org.map(function (r) { return r.name; }).join(', ');
  }

  /* ====================================================================
     MEMBERS — the directory + access management (needs members.view;
     mutating actions additionally need roles.manage, enforced server-side
     and reflected here).
     ==================================================================== */
  var members = {
    render: function (host, ctx) {
      host.innerHTML = '';
      var canManage = HVPerm.has(ctx.me.perms, 'roles.manage');
      var state = { users: [], roles: [], q: '', filter: 'all' };

      host.appendChild(el('div', { class: 'page-head' }, [
        el('h1', { class: 'section-title', text: 'Members' }),
        el('span', { class: 'spacer' }),
        el('span', { class: 'muted small', id: 'memCount' })
      ]));

      var controls = el('div', { class: 'row wrap', style: 'margin-bottom:14px' }, [
        el('input', { class: 'field', style: 'max-width:280px', placeholder: 'Search name or email…',
          oninput: function (e) { state.q = e.target.value.toLowerCase(); paint(); } }),
        el('select', { style: 'max-width:200px;padding:10px;border:2px solid var(--line)',
          onchange: function (e) { state.filter = e.target.value; paint(); } }, [
          optionNode('all', 'Everyone'),
          optionNode('active', 'Active only'),
          optionNode('suspended', 'Suspended only'),
          optionNode('noroles', 'No roles yet')
        ])
      ]);
      host.appendChild(controls);

      var listHost = el('div', {});
      host.appendChild(listHost);
      listHost.appendChild(HVUI.loading('Loading members…'));

      Promise.all([HVApi.hv('users.list', {}), canManage ? HVApi.hv('roles.list', {}) : Promise.resolve({ ok: true, roles: [] })])
        .then(function (res) {
          if (!res[0] || !res[0].ok) { listHost.innerHTML = ''; listHost.appendChild(HVUI.empty(HVApi.err(res[0], 'Could not load members.'))); return; }
          state.users = res[0].users || [];
          state.roles = (res[1] && res[1].roles) || [];
          paint();
        });

      function paint() {
        var rows = state.users.filter(function (u) {
          if (state.filter === 'active' && u.status !== 'active') return false;
          if (state.filter === 'suspended' && u.status !== 'suspended') return false;
          if (state.filter === 'noroles' && (u.roles || []).length) return false;
          if (state.q && (u.name + ' ' + u.email).toLowerCase().indexOf(state.q) < 0) return false;
          return true;
        });
        HVUI.$('#memCount').textContent = rows.length + ' of ' + state.users.length;
        listHost.innerHTML = '';
        if (!rows.length) { listHost.appendChild(HVUI.empty('No members match.')); return; }

        var wrap = el('div', { class: 'table-wrap' });
        var tbl = el('table', { class: 'tbl' });
        tbl.appendChild(el('thead', {}, el('tr', {}, [
          th('Member'), th('Roles'), th('Status'), canManage ? th('Actions') : null
        ])));
        var tb = el('tbody', {});
        rows.forEach(function (u) { tb.appendChild(memberRow(u)); });
        tbl.appendChild(tb);
        wrap.appendChild(tbl);
        listHost.appendChild(wrap);
      }

      function memberRow(u) {
        var isMe = u.id === ctx.me.id;
        var avatar = u.photo
          ? el('img', { src: u.photo, alt: '', style: 'width:34px;height:34px;border:2px solid var(--line);object-fit:cover' })
          : el('div', { style: 'width:34px;height:34px;border:2px solid var(--line);display:grid;place-items:center;font-family:var(--display);font-weight:700;background:var(--bg)', text: HVUI.initials(u.name) });

        var who = el('td', {}, el('div', { class: 'row' }, [
          avatar,
          el('div', {}, [
            el('div', { style: 'font-weight:600', text: (u.name || u.email) + (isMe ? ' (you)' : '') }),
            el('div', { class: 'muted small', text: u.email }),
            u.linked ? el('div', { class: 'muted small', text: '🔗 USN/mobile linked' }) : null
          ])
        ]));

        var roleCell = el('td', {});
        var chips = el('div', { class: 'row wrap', style: 'gap:6px' });
        (u.roles || []).forEach(function (r) {
          var chip = el('span', { class: 'chip ' + (r.scope === 'org' ? 'role' : 'scoped'),
            title: r.scope === 'org' ? '' : 'Scoped to ' + r.scope }, [
            document.createTextNode(r.name + (r.scope !== 'org' ? ' · ' + r.scope : ''))
          ]);
          if (canManage) {
            chip.appendChild(el('span', { class: 'x', title: 'Remove', onclick: function () { removeGrant(u, r); } }, '✕'));
          }
          chips.appendChild(chip);
        });
        if (!(u.roles || []).length) chips.appendChild(el('span', { class: 'muted small', text: '—' }));
        if (canManage) {
          chips.appendChild(el('button', { class: 'btn small ghost', onclick: function () { addRole(u); } }, '+ role'));
        }
        roleCell.appendChild(chips);

        var statusCell = el('td', {}, el('span', { class: 'pill ' + u.status, text: u.status }));

        var actionCell = null;
        if (canManage) {
          actionCell = el('td', {});
          var actions = el('div', { class: 'row wrap', style: 'gap:6px' });
          if (!isMe) {
            if (u.status === 'active') {
              actions.appendChild(el('button', { class: 'btn small ghost', onclick: function () { forceOut(u); } }, 'Sign out'));
              actions.appendChild(el('button', { class: 'btn small danger', onclick: function () { setStatus(u, 'suspended'); } }, 'Suspend'));
            } else {
              actions.appendChild(el('button', { class: 'btn small primary', onclick: function () { setStatus(u, 'active'); } }, 'Reactivate'));
            }
          } else {
            actions.appendChild(el('span', { class: 'muted small', text: 'Manage yourself in Profile' }));
          }
          actionCell.appendChild(actions);
        }

        return el('tr', {}, [who, roleCell, statusCell, actionCell]);
      }

      /* ---- mutations ---- */
      function addRole(u) {
        var grantable = state.roles.filter(function (r) { return !r.archived; });
        if (!grantable.length) { toast('No roles exist yet. Create one under Roles.', true); return; }
        var sel = el('select', { style: 'width:100%;padding:10px;border:2px solid var(--line)' },
          grantable.map(function (r) { return optionNode(r.id, r.name + ' — ' + HVPerm.summarize(r.perms)); }));
        HVUI.modal({
          title: 'Give ' + (u.name || u.email) + ' a role',
          body: el('div', {}, [ el('div', { class: 'field' }, [ el('label', { text: 'Role' }), sel ]),
            el('p', { class: 'muted small', text: 'This grants an org-wide role. Team- and event-scoped roles come with those phases.' }) ]),
          foot: HVUI.footer([
            { label: 'Cancel', class: 'ghost' },
            { label: 'Grant role', class: 'primary', onClick: function () {
              HVApi.hv('grants.add', { userId: u.id, roleId: sel.value }).then(function (r) {
                if (r && r.ok) { toast('Role granted.'); refresh(); }
                else toast(HVApi.err(r, 'Could not grant that role.'), true);
              });
            }}
          ])
        });
      }
      function removeGrant(u, r) {
        HVUI.confirm({ title: 'Remove role', message: 'Remove "' + r.name + '" from ' + (u.name || u.email) + '?', yes: 'Remove', danger: true },
          function () {
            HVApi.hv('grants.revoke', { grantId: r.grantId }).then(function (res) {
              if (res && res.ok) { toast('Role removed.'); refresh(); }
              else toast(HVApi.err(res, 'Could not remove that role.'), true);
            });
          });
      }
      function setStatus(u, status) {
        var verb = status === 'suspended' ? 'Suspend' : 'Reactivate';
        HVUI.confirm({ title: verb + ' member',
          message: verb + ' ' + (u.name || u.email) + '?' + (status === 'suspended' ? ' Their sessions end immediately.' : ''),
          yes: verb, danger: status === 'suspended' },
          function () {
            HVApi.hv('users.status', { userId: u.id, status: status }).then(function (r) {
              if (r && r.ok) { toast(verb + 'd.'); refresh(); }
              else toast(HVApi.err(r, 'Could not update.'), true);
            });
          });
      }
      function forceOut(u) {
        HVUI.confirm({ title: 'Sign out everywhere', message: 'End all of ' + (u.name || u.email) + '’s sessions? They can sign back in.', yes: 'Sign out' },
          function () {
            HVApi.hv('users.signout', { userId: u.id }).then(function (r) {
              if (r && r.ok) toast('Their sessions were ended.');
              else toast(HVApi.err(r, 'Could not sign them out.'), true);
            });
          });
      }
      function refresh() {
        HVApi.hv('users.list', {}).then(function (r) { if (r && r.ok) { state.users = r.users; paint(); } });
      }
    }
  };

  /* ====================================================================
     ROLES — create/edit/archive roles and their permission lists.
     Needs roles.manage.
     ==================================================================== */
  var roles = {
    render: function (host, ctx) {
      host.innerHTML = '';
      host.appendChild(el('div', { class: 'page-head' }, [
        el('h1', { class: 'section-title', text: 'Roles' }),
        el('span', { class: 'spacer' }),
        el('button', { class: 'btn primary', onclick: function () { editor(null); } }, '+ New role')
      ]));
      host.appendChild(el('p', { class: 'section-sub', style: 'margin-bottom:14px',
        text: 'A role is a named bundle of permissions. Grant roles to members on the Members page.' }));

      var listHost = el('div', {});
      host.appendChild(listHost);
      listHost.appendChild(HVUI.loading('Loading roles…'));
      load();

      function load() {
        HVApi.hv('roles.list', {}).then(function (r) {
          listHost.innerHTML = '';
          if (!r || !r.ok) { listHost.appendChild(HVUI.empty(HVApi.err(r, 'Could not load roles.'))); return; }
          if (!r.roles.length) { listHost.appendChild(HVUI.empty('No roles yet.')); return; }
          r.roles.forEach(function (role) { listHost.appendChild(roleCard(role)); });
        });
      }

      function roleCard(role) {
        var permChips = el('div', { class: 'row wrap', style: 'gap:6px;margin-top:8px' });
        if (HVPerm.has(role.perms, '*')) permChips.appendChild(el('span', { class: 'chip on', text: 'Full control' }));
        else if (!role.perms.length) permChips.appendChild(el('span', { class: 'muted small', text: 'No permissions' }));
        else role.perms.forEach(function (p) { permChips.appendChild(el('span', { class: 'chip', text: p })); });

        return el('div', { class: 'card' }, [
          el('div', { class: 'row wrap' }, [
            el('div', {}, [
              el('h3', { text: role.name + (role.builtin ? '' : '') }),
              role.builtin ? el('span', { class: 'pill active', text: 'built-in' }) : null,
              el('p', { class: 'muted small', style: 'margin:4px 0 0', text: role.description || '' })
            ]),
            el('span', { class: 'spacer' }),
            el('div', { class: 'row', style: 'gap:6px' }, [
              el('button', { class: 'btn small ghost', onclick: function () { editor(role); } }, 'Edit'),
              role.builtin ? null : el('button', { class: 'btn small danger', onclick: function () { archive(role); } }, 'Archive')
            ])
          ]),
          permChips
        ]);
      }

      function archive(role) {
        HVUI.confirm({ title: 'Archive role', message: 'Archive "' + role.name + '"? Members lose it; it leaves the list.', yes: 'Archive', danger: true },
          function () {
            HVApi.hv('roles.archive', { roleId: role.id }).then(function (r) {
              if (r && r.ok) { toast('Role archived.'); load(); }
              else toast(HVApi.err(r, 'Could not archive.'), true);
            });
          });
      }

      /* the editor: name, description, a checkbox tree of the catalog, and a
         free-text box for custom keys not in the catalog */
      function editor(role) {
        var chosen = {};
        (role ? role.perms : []).forEach(function (p) { chosen[p] = true; });

        var nameIn = el('input', { value: role ? role.name : '', placeholder: 'e.g. Design Lead' });
        var descIn = el('textarea', { placeholder: 'What is this role for?' }, role ? role.description : '');

        var tree = el('div', {});
        HVPerm.CATALOG.forEach(function (grp) {
          tree.appendChild(el('div', { class: 'grp-title', text: grp.group }));
          grp.keys.forEach(function (item) {
            var cb = el('input', { type: 'checkbox' });
            cb.checked = !!chosen[item.key];
            cb.addEventListener('change', function () {
              if (cb.checked) chosen[item.key] = true; else delete chosen[item.key];
              if (item.key === '*' && cb.checked) toast('“Full control” already covers everything else.');
            });
            tree.appendChild(el('label', { class: 'check' }, [
              cb,
              el('div', {}, [
                el('span', { class: 'k', text: item.key }),
                el('span', { text: '  ' + item.label }),
                item.desc ? el('div', { class: 'd', text: item.desc }) : null
              ])
            ]));
          });
        });

        /* custom keys the catalog doesn't list */
        var known = {};
        HVPerm.catalogKeys().forEach(function (k) { known[k] = true; });
        var custom = (role ? role.perms : []).filter(function (p) { return !known[p]; });
        var customIn = el('input', { value: custom.join(', '), placeholder: 'e.g. reports.export, sponsors.contact' });

        var body = el('div', {}, [
          el('div', { class: 'field' }, [ el('label', { text: 'Name' }), nameIn ]),
          el('div', { class: 'field' }, [ el('label', { text: 'Description' }), descIn ]),
          el('div', { class: 'field' }, [ el('label', { text: 'Permissions' }), tree ]),
          el('div', { class: 'field' }, [ el('label', { text: 'Custom permission keys (comma-separated)' }), customIn,
            el('div', { class: 'hint', text: 'For anything not in the list above. Lowercase dotted keys, e.g. area.action.' }) ])
        ]);

        HVUI.modal({
          title: role ? 'Edit role' : 'New role',
          body: body,
          foot: HVUI.footer([
            { label: 'Cancel', class: 'ghost' },
            { label: role ? 'Save changes' : 'Create role', class: 'primary', closes: false, onClick: function () {
              var name = nameIn.value.trim();
              if (!name) { toast('Give the role a name.', true); return; }
              var perms = Object.keys(chosen);
              customIn.value.split(',').forEach(function (c) {
                var k = c.trim().toLowerCase();
                if (k && perms.indexOf(k) < 0) perms.push(k);
              });
              var payload = { name: name, description: descIn.value.trim(), perms: perms };
              if (role) payload.roleId = role.id;
              HVApi.hv('roles.save', payload).then(function (r) {
                if (r && r.ok) { HVUI.closeModal(); toast(role ? 'Role saved.' : 'Role created.'); load(); }
                else toast(HVApi.err(r, 'Could not save the role.'), true);
              });
            }}
          ])
        });
      }
    }
  };

  /* ====================================================================
     PROFILE — the signed-in user's own account.
     ==================================================================== */
  var profile = {
    render: function (host, ctx) {
      host.innerHTML = '';
      var me = ctx.me;
      host.appendChild(el('h1', { class: 'section-title', text: 'Your profile' }));

      var avatar = me.photo
        ? el('img', { src: me.photo, alt: '', style: 'width:64px;height:64px;border:2px solid var(--line);object-fit:cover' })
        : el('div', { style: 'width:64px;height:64px;border:2px solid var(--line);display:grid;place-items:center;font-family:var(--display);font-weight:700;font-size:24px;background:var(--bg)', text: HVUI.initials(me.name) });

      host.appendChild(el('div', { class: 'card', style: 'margin-top:14px' }, [
        el('div', { class: 'row' }, [
          avatar,
          el('div', {}, [
            el('div', { style: 'font-family:var(--display);font-weight:700;font-size:20px', text: me.name || me.email }),
            el('div', { class: 'muted', text: me.email })
          ])
        ]),
        el('div', { style: 'margin-top:12px' }, [
          el('div', { class: 'grp-title', text: 'Your roles' }),
          rolesBlock(me)
        ])
      ]));

      /* link a USN / mobile */
      var usnIn = el('input', { value: me.usn || '', placeholder: 'USN or 10-digit mobile' });
      host.appendChild(el('div', { class: 'card' }, [
        el('h3', { text: 'Link your USN or mobile' }),
        el('p', { class: 'muted small', text: 'Connects your account to club registration and the arcade. Only you and admins can see whether you have linked; the value itself stays private to you.' }),
        el('div', { class: 'field' }, [ usnIn ]),
        el('div', { style: 'margin-top:10px' }, [
          el('button', { class: 'btn primary', onclick: function () {
            var canonical = HVUI.normId(usnIn.value);
            if (usnIn.value.trim() && !canonical) { toast('Enter a valid USN or 10-digit mobile.', true); return; }
            HVApi.hv('usn.link', { usn: canonical }).then(function (r) {
              if (r && r.ok) { toast('Saved.'); HVAuth.refresh(); }
              else toast(HVApi.err(r, 'Could not save.'), true);
            });
          }}, 'Save') ])
      ]));

      /* devices / sign-out */
      host.appendChild(el('div', { class: 'card' }, [
        el('h3', { text: 'Sessions' }),
        el('p', { class: 'muted small', text: 'Signed out of a shared or lost device? End every session, then sign back in here.' }),
        el('div', { class: 'row wrap', style: 'margin-top:10px;gap:10px' }, [
          el('button', { class: 'btn ghost', onclick: function () { HVAuth.signOut().then(ctx.reload); } }, 'Sign out (this device)'),
          el('button', { class: 'btn danger', onclick: function () {
            HVUI.confirm({ title: 'Sign out everywhere', message: 'End every session on every device?', yes: 'Sign out everywhere', danger: true },
              function () { HVAuth.signOutEverywhere().then(ctx.reload); });
          }}, 'Sign out everywhere')
        ])
      ]));
    }
  };

  function rolesBlock(me) {
    var wrap = el('div', { class: 'row wrap', style: 'gap:6px' });
    if (!(me.roles || []).length) { wrap.appendChild(el('span', { class: 'muted small', text: 'No roles yet — an admin can grant you one.' })); return wrap; }
    me.roles.forEach(function (r) {
      wrap.appendChild(el('span', { class: 'chip ' + (r.scope === 'org' ? 'role' : 'scoped'),
        text: r.name + (r.scope !== 'org' ? ' · ' + r.scope : '') }));
    });
    return wrap;
  }

  /* ====================================================================
     ACTIVITY — the audit trail. Needs roles.manage. Read from a dedicated
     hv.audit.list (added in Identity.js alongside this view).
     ==================================================================== */
  var audit = {
    render: function (host, ctx) {
      host.innerHTML = '';
      host.appendChild(el('div', { class: 'page-head' }, [
        el('h1', { class: 'section-title', text: 'Activity' }),
        el('span', { class: 'spacer' }),
        el('button', { class: 'btn ghost small', onclick: function () { load(); } }, '↻ Refresh')
      ]));
      host.appendChild(el('p', { class: 'section-sub', style: 'margin-bottom:14px',
        text: 'Administrative actions — role changes, grants, suspensions. The organisation’s memory.' }));

      var listHost = el('div', {});
      host.appendChild(listHost);
      load();

      function load() {
        listHost.innerHTML = '';
        listHost.appendChild(HVUI.loading('Loading activity…'));
        HVApi.hv('audit.list', { limit: 100 }).then(function (r) {
          listHost.innerHTML = '';
          if (!r || !r.ok) { listHost.appendChild(HVUI.empty(HVApi.err(r, 'Could not load activity.'))); return; }
          if (!r.entries.length) { listHost.appendChild(HVUI.empty('No activity recorded yet.')); return; }
          var wrap = el('div', { class: 'table-wrap' });
          var tbl = el('table', { class: 'tbl' });
          tbl.appendChild(el('thead', {}, el('tr', {}, [ th('When'), th('Who'), th('Action'), th('Detail') ])));
          var tb = el('tbody', {});
          r.entries.forEach(function (e) {
            tb.appendChild(el('tr', {}, [
              el('td', { class: 'muted small', text: HVUI.timeAgo(e.when) }),
              el('td', { text: e.actor }),
              el('td', {}, el('span', { class: 'chip', text: e.action })),
              el('td', { class: 'small', text: e.detail })
            ]));
          });
          tbl.appendChild(tb);
          wrap.appendChild(tbl);
          listHost.appendChild(wrap);
        });
      }
    }
  };

  /* ---- tiny shared helpers ---- */
  function th(t) { return el('th', { text: t }); }
  function optionNode(v, label) { var o = el('option', { value: v }); o.textContent = label; return o; }

  return { home: home, members: members, roles: roles, profile: profile, audit: audit };
})();
