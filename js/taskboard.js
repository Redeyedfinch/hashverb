/**
 * Hashverb OS — shared task board.
 *
 * Renders a kanban board for a parent (team or event) into a host element, and
 * a compact "My Tasks" list. Used inside the team detail, event detail, and
 * home views. Task authority is derived server-side from the parent; this only
 * shows/hides controls from the list response's canManage / canCreate flags.
 */
var HVTaskBoard = (function () {
  var el = HVUI.el, esc = HVUI.esc, toast = HVUI.toast;

  var COLS = [
    { key: 'backlog', label: 'Backlog' }, { key: 'todo', label: 'To Do' },
    { key: 'doing', label: 'In Progress' }, { key: 'blocked', label: 'Blocked' },
    { key: 'review', label: 'Review' }, { key: 'done', label: 'Completed' }
  ];
  var PRIORITY_COLOR = { low: '#6d6675', medium: '#0FA6AE', high: '#F4A400', urgent: '#E11D48' };

  /** Render the board for a parent into `host`. `who` = {name,email} of members
      for the assignee picker (optional; falls back to email entry). */
  function render(host, parentType, parentId) {
    host.innerHTML = '';
    host.appendChild(HVUI.loading('Loading tasks…'));
    HVApi.load('tasks.list', { parentType: parentType, parentId: parentId }, function (r) {
      host.innerHTML = '';
      if (!r || !r.ok) { host.appendChild(HVUI.empty(HVApi.err(r, 'Could not load tasks.'))); return; }
      var head = el('div', { class: 'row', style: 'margin-bottom:10px' }, [
        el('div', { class: 'muted small', text: r.tasks.length + (r.tasks.length === 1 ? ' task' : ' tasks') }),
        el('span', { class: 'spacer' }),
        r.canCreate ? el('button', { class: 'btn primary small', onclick: function () { taskModal(host, parentType, parentId, null, r); } }, '+ Task') : null
      ]);
      host.appendChild(head);

      /* group by status */
      var byStatus = {};
      COLS.forEach(function (c) { byStatus[c.key] = []; });
      r.tasks.forEach(function (t) { (byStatus[t.status] || (byStatus[t.status] = [])).push(t); });

      var board = el('div', { class: 'hv-board' });
      COLS.forEach(function (c) {
        var col = el('div', { class: 'hv-col' }, [
          el('div', { class: 'hv-col-h' }, [ el('span', { text: c.label }), el('span', { class: 'muted', text: String(byStatus[c.key].length) }) ])
        ]);
        byStatus[c.key].forEach(function (t) { col.appendChild(taskCard(host, parentType, parentId, t, r)); });
        board.appendChild(col);
      });
      host.appendChild(board);
    });
  }

  function taskCard(host, parentType, parentId, t, listRes) {
    var canEdit = listRes.canManage;  /* creator-edit is allowed server-side too, but we don't know creator id here; manage covers the common case */
    var card = el('div', { class: 'hv-task', onclick: function () { taskModal(host, parentType, parentId, t, listRes); } });
    if (t.priority) card.style.borderLeft = '4px solid ' + (PRIORITY_COLOR[t.priority] || 'var(--line)');
    card.appendChild(el('div', { style: 'font-weight:600', text: t.title }));
    var meta = el('div', { class: 'row wrap', style: 'gap:5px;margin-top:6px' });
    if (t.blockedBy) meta.appendChild(el('span', { class: 'chip', style: 'background:#ffe3ea;color:var(--danger)', text: 'Blocked x' + t.blockedBy }));
    if (t.priority) meta.appendChild(el('span', { class: 'chip', style: 'color:' + (PRIORITY_COLOR[t.priority] || ''), text: t.priority }));
    if (t.due) meta.appendChild(el('span', { class: 'chip', text: 'Due ' + t.due }));
    if (t.checklistTotal) meta.appendChild(el('span', { class: 'chip', text: t.checklistDone + '/' + t.checklistTotal }));
    if (t.assigneeName) meta.appendChild(el('span', { class: 'chip role', text: t.assigneeName.split(/\s+/)[0] }));
    if (t.project) meta.appendChild(el('span', { class: 'chip', text: '# ' + t.project }));
    if (meta.childNodes.length) card.appendChild(meta);
    return card;
  }

  function taskModal(host, parentType, parentId, t, listRes) {
    var isNew = !t;
    var canManage = listRes.canManage;
    var title = el('input', { value: t ? t.title : '', placeholder: 'Task title' });
    var desc = el('textarea', { placeholder: 'Details…' }, t ? t.description : '');
    var status = el('select', { style: sel() }, COLS.map(function (c) { return opt(c.key, c.label); }));
    if (t) status.value = t.status;
    var priority = el('select', { style: sel() }, [opt('', '—'), opt('low', 'Low'), opt('medium', 'Medium'), opt('high', 'High'), opt('urgent', 'Urgent')]);
    if (t) priority.value = t.priority || '';
    var due = el('input', { type: 'date', value: t ? t.due : '' });
    var assignee = el('input', { placeholder: 'assignee email', value: '' });
    var tags = el('input', { placeholder: 'tags, comma separated', value: t ? t.tags : '' });
    var project = el('input', { placeholder: 'project (optional)', value: t ? t.project : '' });

    var body = el('div', {}, [
      el('div', { class: 'field' }, [ el('label', { text: 'Title' }), title ]),
      el('div', { class: 'field' }, [ el('label', { text: 'Description' }), desc ]),
      el('div', { class: 'row', style: 'gap:10px' }, [
        el('div', { class: 'field', style: 'flex:1' }, [ el('label', { text: 'Status' }), status ]),
        el('div', { class: 'field', style: 'flex:1' }, [ el('label', { text: 'Priority' }), priority ])
      ]),
      el('div', { class: 'row', style: 'gap:10px' }, [
        el('div', { class: 'field', style: 'flex:1' }, [ el('label', { text: 'Due' }), due ]),
        el('div', { class: 'field', style: 'flex:1' }, [ el('label', { text: 'Project' }), project ])
      ]),
      el('div', { class: 'field' }, [ el('label', { text: 'Tags' }), tags ])
    ]);
    if (canManage) body.appendChild(el('div', { class: 'field' }, [ el('label', { text: 'Assign to (email)' }), assignee,
      el('div', { class: 'hint', text: t && t.assigneeName ? 'Currently: ' + t.assigneeName : 'Leave blank to leave unassigned.' }) ]));

    /* checklist editor (existing task only) */
    var checklistHost = null;
    if (t) {
      checklistHost = el('div', {});
      body.appendChild(el('div', { class: 'field' }, [ el('label', { text: 'Checklist' }), checklistHost ]));
      renderChecklist(checklistHost, host, parentType, parentId, t);
      /* dependencies */
      var depHost = el('div', {});
      body.appendChild(el('div', { class: 'field' }, [ el('label', { text: 'Depends on' }), depHost ]));
      renderDeps(depHost, host, parentType, parentId, t, listRes);
    }

    var footSpecs = [{ label: 'Cancel', class: 'ghost' }];
    if (isNew || canManage || t) {
      footSpecs.push({ label: isNew ? 'Create' : 'Save', class: 'primary', closes: false, onClick: function () {
        var name = title.value.trim();
        if (!name) { toast('Give the task a title.', true); return; }
        if (isNew) {
          var payload = { parentType: parentType, parentId: parentId, title: name, description: desc.value.trim(),
            status: status.value, priority: priority.value, due: due.value, tags: tags.value.trim(), project: project.value.trim() };
          HVApi.hv('tasks.create', payload).then(function (r) {
            if (r && r.ok) { HVUI.closeModal(); toast('Task created.'); render(host, parentType, parentId); }
            else toast(HVApi.err(r), true);
          });
        } else {
          /* save fields (needs manage/creator), then status (assignee allowed), then assignee (manage) */
          var chain = HVApi.hv('tasks.update', { taskId: t.id, title: name, description: desc.value.trim(),
            priority: priority.value, due: due.value, tags: tags.value.trim(), project: project.value.trim() });
          chain.then(function () { return HVApi.hv('tasks.setStatus', { taskId: t.id, status: status.value }); })
            .then(function () { if (canManage && assignee.value.trim()) return HVApi.hv('tasks.assign', { taskId: t.id, email: assignee.value.trim() }); })
            .then(function () { HVUI.closeModal(); toast('Saved.'); render(host, parentType, parentId); });
        }
      }});
    }
    if (t && canManage) footSpecs.splice(1, 0, { label: 'Archive', class: 'danger', onClick: function () {
      HVApi.hv('tasks.archive', { taskId: t.id }).then(function (r) {
        if (r && r.ok) { toast('Archived.'); render(host, parentType, parentId); } else toast(HVApi.err(r), true);
      });
    }});

    /* comments thread on an existing task */
    if (t) {
      var cHost = el('div', {});
      body.appendChild(el('div', { class: 'field' }, [ el('label', { text: 'Discussion' }), cHost ]));
      HVComments.thread(cHost, 'task', t.id);
    }

    HVUI.modal({ title: isNew ? 'New task' : 'Task', body: body, foot: HVUI.footer(footSpecs) });
  }

  function renderChecklist(chost, host, parentType, parentId, t) {
    chost.innerHTML = '';
    var items = (t.checklist || []).slice();
    items.forEach(function (it, i) {
      var cb = el('input', { type: 'checkbox' }); cb.checked = !!it.done;
      cb.addEventListener('change', function () { items[i].done = cb.checked; save(); });
      chost.appendChild(el('label', { class: 'check' }, [ cb, el('span', { class: 'k', text: it.text }) ]));
    });
    var add = el('input', { placeholder: '+ checklist item', style: 'margin-top:6px' });
    add.addEventListener('keydown', function (e) { if (e.key === 'Enter' && add.value.trim()) { items.push({ text: add.value.trim(), done: false }); add.value = ''; save(); } });
    chost.appendChild(add);
    function save() {
      HVApi.hv('tasks.update', { taskId: t.id, checklist: items }).then(function (r) {
        if (r && r.ok) { t.checklist = items; renderChecklist(chost, host, parentType, parentId, t); }
        else toast(HVApi.err(r), true);
      });
    }
  }

  function renderDeps(dhost, host, parentType, parentId, t, listRes) {
    dhost.innerHTML = '';
    (t.deps || []).forEach(function (d) {
      var chip = el('span', { class: 'chip' }, [ document.createTextNode(depTitle(listRes, d.taskId)) ]);
      if (listRes.canManage) chip.appendChild(el('span', { class: 'x', title: 'Remove', onclick: function () {
        HVApi.hv('tasks.removeDep', { depId: d.depId }).then(function (r) { if (r && r.ok) { toast('Removed.'); reopen(host, parentType, parentId, t.id); } else toast(HVApi.err(r), true); });
      }}, '✕'));
      dhost.appendChild(chip);
    });
    if (listRes.canManage) {
      var others = listRes.tasks.filter(function (x) { return x.id !== t.id; });
      if (others.length) {
        var pick = el('select', { style: sel() }, [opt('', '+ add dependency…')].concat(others.map(function (x) { return opt(x.id, x.title); })));
        pick.addEventListener('change', function () {
          if (!pick.value) return;
          HVApi.hv('tasks.addDep', { taskId: t.id, dependsOnTaskId: pick.value }).then(function (r) {
            if (r && r.ok) { toast('Dependency added.'); reopen(host, parentType, parentId, t.id); } else toast(HVApi.err(r), true);
          });
        });
        dhost.appendChild(pick);
      }
    }
    if (!(t.deps || []).length && !listRes.canManage) dhost.appendChild(el('span', { class: 'muted small', text: 'None.' }));
  }

  function depTitle(listRes, taskId) {
    var found = ''; listRes.tasks.forEach(function (x) { if (x.id === taskId) found = x.title; });
    return found || 'task';
  }

  /* reopen the modal on the same task after a dep change (re-fetch fresh list) */
  function reopen(host, parentType, parentId, taskId) {
    HVApi.hv('tasks.list', { parentType: parentType, parentId: parentId }).then(function (r) {
      if (!r || !r.ok) { render(host, parentType, parentId); return; }
      var t = null; r.tasks.forEach(function (x) { if (x.id === taskId) t = x; });
      HVUI.closeModal();
      if (t) taskModal(host, parentType, parentId, t, r);
      render(host, parentType, parentId);
    });
  }

  /** Compact "my tasks" list into a host. */
  function myTasks(host, seed) {
    host.innerHTML = '';
    host.appendChild(HVUI.loading('Loading your tasks…'));
    var paint = function (r) {
      host.innerHTML = '';
      if (!r || !r.ok) { host.appendChild(HVUI.empty(HVApi.err(r, 'Could not load your tasks.'))); return; }
      if (!r.tasks.length) { host.appendChild(HVUI.empty('No open tasks assigned to you.')); return; }
      var list = el('div', { class: 'stack' });
      r.tasks.forEach(function (t) {
        list.appendChild(el('div', { class: 'banner', style: 'border-left:4px solid ' + (PRIORITY_COLOR[t.priority] || 'var(--line)') }, [
          el('div', { class: 'row wrap' }, [
            el('div', {}, [ el('div', { style: 'font-weight:600', text: t.title }),
              el('div', { class: 'muted small', text: t.parentName + ' · ' + t.statusLabel + (t.due ? ' · due ' + t.due : '') }) ]),
            el('span', { class: 'spacer' }),
            t.blockedBy ? el('span', { class: 'chip', style: 'background:#ffe3ea;color:var(--danger)', text: 'Blocked x' + t.blockedBy }) : null
          ])
        ]));
      });
      host.appendChild(list);
    };
    /* seed !== undefined: Home already fetched this via home.summary */
    if (seed !== undefined) { HVApi.seed('tasks.myTasks', {}, seed); paint(seed); }
    else HVApi.load('tasks.myTasks', {}, paint);
  }

  function sel() { return 'width:100%;padding:10px;border:2px solid var(--line)'; }
  function opt(v, label) { var o = document.createElement('option'); o.value = v; o.textContent = label; return o; }

  return { render: render, myTasks: myTasks };
})();
