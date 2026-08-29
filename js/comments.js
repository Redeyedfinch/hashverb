/**
 * Hashverb OS — comment thread + announcements (frontend).
 * HVComments.thread(host, objectType, objectId) mounts a comment thread with
 * an @mention-aware composer anywhere. HVAnnounce.render(host, me) renders the
 * announcements board (with a post button for those who may post).
 */
var HVComments = (function () {
  var el = HVUI.el, toast = HVUI.toast;

  function thread(host, objectType, objectId) {
    host.innerHTML = '';
    var listHost = el('div', {});
    host.appendChild(listHost);
    listHost.appendChild(HVUI.loading('Loading…'));

    var box = el('textarea', { placeholder: 'Add a comment…  use @email to notify someone', style: 'margin-top:8px' });
    var send = el('button', { class: 'btn primary small', style: 'margin-top:6px', onclick: post }, 'Comment');
    host.appendChild(box); host.appendChild(send);

    load();
    function load() {
      HVApi.hv('comments.list', { objectType: objectType, objectId: objectId }).then(function (r) {
        listHost.innerHTML = '';
        if (!r || !r.ok) { listHost.appendChild(HVUI.empty(HVApi.err(r, 'Could not load comments.'))); return; }
        if (!r.comments.length) { listHost.appendChild(el('div', { class: 'muted small', text: 'No comments yet.' })); return; }
        r.comments.forEach(function (c) {
          var row = el('div', { class: 'banner', style: 'margin-bottom:6px' }, [
            el('div', { class: 'row' }, [
              el('div', { style: 'font-weight:600;font-size:13px', text: c.authorName }),
              el('span', { class: 'spacer' }),
              el('span', { class: 'muted small', text: HVUI.timeAgo(c.created) }),
              c.mine ? el('button', { class: 'x', style: 'margin-left:8px', title: 'Delete', onclick: function () { remove(c.id); } }, '✕') : null
            ]),
            el('div', { class: 'small', style: 'white-space:pre-wrap;margin-top:4px', text: c.body })
          ]);
          listHost.appendChild(row);
        });
      });
    }
    function post() {
      var body = box.value.trim();
      if (!body) return;
      send.disabled = true;
      HVApi.hv('comments.create', { objectType: objectType, objectId: objectId, body: body }).then(function (r) {
        send.disabled = false;
        if (r && r.ok) { box.value = ''; load(); } else toast(HVApi.err(r), true);
      });
    }
    function remove(id) {
      HVApi.hv('comments.remove', { commentId: id }).then(function (r) { if (r && r.ok) load(); else toast(HVApi.err(r), true); });
    }
  }

  return { thread: thread };
})();

var HVAnnounce = (function () {
  var el = HVUI.el, toast = HVUI.toast;

  function render(host, me) {
    host.innerHTML = '';
    var canPost = HVPerm.has(me.perms, 'announcements.post');
    host.appendChild(el('div', { class: 'row' }, [
      el('h2', { text: 'Announcements' }), el('span', { class: 'spacer' }),
      canPost ? el('button', { class: 'btn primary small', onclick: function () { postModal(host, me); } }, '+ Post') : null
    ]));
    var listHost = el('div', { style: 'margin-top:10px' });
    host.appendChild(listHost);
    listHost.appendChild(HVUI.loading('Loading…'));
    HVApi.hv('announcements.list', {}).then(function (r) {
      listHost.innerHTML = '';
      if (!r || !r.ok) { listHost.appendChild(HVUI.empty(HVApi.err(r, 'Could not load announcements.'))); return; }
      if (!r.announcements.length) { listHost.appendChild(el('div', { class: 'muted small', text: 'No announcements.' })); return; }
      r.announcements.forEach(function (a) {
        listHost.appendChild(el('div', { class: 'banner warn', style: 'margin-bottom:8px' }, [
          el('div', { class: 'row' }, [
            el('div', { style: 'font-family:var(--display);font-weight:700', text: '📣 ' + a.title }),
            el('span', { class: 'spacer' }),
            a.canRemove ? el('button', { class: 'x', title: 'Remove', onclick: function () { remove(host, me, a.id); } }, '✕') : null
          ]),
          a.body ? el('div', { class: 'small', style: 'white-space:pre-wrap;margin-top:4px', text: a.body }) : null,
          el('div', { class: 'muted small', style: 'margin-top:4px', text: a.audienceLabel + ' · ' + a.by + ' · ' + HVUI.timeAgo(a.created) })
        ]));
      });
    });
  }

  function remove(host, me, id) {
    HVUI.confirm({ title: 'Remove announcement', message: 'Remove this announcement?', yes: 'Remove', danger: true },
      function () { HVApi.hv('announcements.remove', { announcementId: id }).then(function (r) { if (r && r.ok) render(host, me); else toast(HVApi.err(r), true); }); });
  }

  function postModal(host, me) {
    var title = el('input', { placeholder: 'Announcement title' });
    var body = el('textarea', { placeholder: 'Message…' });
    var audType = el('select', { style: sel() }, [opt('everyone', 'Everyone'), opt('team', 'A team'), opt('event', 'An event')]);
    var target = el('select', { style: sel() + ';display:none' });
    audType.addEventListener('change', function () { refreshTargets(); });

    var bodyEl = el('div', {}, [
      el('div', { class: 'field' }, [ el('label', { text: 'Title' }), title ]),
      el('div', { class: 'field' }, [ el('label', { text: 'Message' }), body ]),
      el('div', { class: 'field' }, [ el('label', { text: 'Audience' }), audType, target ])
    ]);
    HVUI.modal({ title: 'Post announcement', body: bodyEl, foot: HVUI.footer([
      { label: 'Cancel', class: 'ghost' },
      { label: 'Post', class: 'primary', closes: false, onClick: function () {
        var t = title.value.trim(); if (!t) { toast('Give it a title.', true); return; }
        var payload = { title: t, body: body.value.trim(), audienceType: audType.value };
        if (audType.value !== 'everyone') { if (!target.value) { toast('Pick a target.', true); return; } payload.audienceId = target.value; }
        HVApi.hv('announcements.post', payload).then(function (r) {
          if (r && r.ok) { HVUI.closeModal(); toast('Posted.'); render(host, me); } else toast(HVApi.err(r), true);
        });
      } }
    ]) });

    function refreshTargets() {
      var kind = audType.value;
      if (kind === 'everyone') { target.style.display = 'none'; return; }
      target.style.display = 'block';
      target.innerHTML = ''; target.appendChild(opt('', 'loading…'));
      HVApi.hv(kind === 'team' ? 'teams.list' : 'events.list', {}).then(function (r) {
        target.innerHTML = '';
        var items = (r && r.ok) ? (r.teams || r.events) : [];
        target.appendChild(opt('', '— pick —'));
        items.forEach(function (x) { target.appendChild(opt(x.id, x.name)); });
      });
    }
  }

  function sel() { return 'width:100%;padding:10px;border:2px solid var(--line)'; }
  function opt(v, label) { var o = document.createElement('option'); o.value = v; o.textContent = label; return o; }

  return { render: render };
})();
