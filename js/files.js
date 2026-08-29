/**
 * Hashverb OS — file hub (frontend). A reusable file list for a parent
 * (team/event): add a file by link, upload new versions, and move it through
 * the approval states. HVFilesBoard.render(host, parentType, parentId).
 */
var HVFilesBoard = (function () {
  var el = HVUI.el, toast = HVUI.toast;
  var STATE_COLOR = { draft: '#6d6675', submitted: '#F4A400', review: '#0FA6AE', changes: '#E11D48', approved: '#0f9d58', published: '#00b874' };
  var metaCache = null;

  function render(host, parentType, parentId) {
    host.innerHTML = '';
    ensureMeta().then(function () {
      HVApi.hv('files.list', { parentType: parentType, parentId: parentId }).then(function (r) {
        host.innerHTML = '';
        if (!r || !r.ok) { host.appendChild(HVUI.empty(HVApi.err(r, 'Could not load files.'))); return; }
        host.appendChild(el('div', { class: 'row', style: 'margin-bottom:10px' }, [
          el('div', { class: 'muted small', text: r.files.length + (r.files.length === 1 ? ' file' : ' files') }),
          el('span', { class: 'spacer' }),
          r.canAdd ? el('button', { class: 'btn primary small', onclick: function () { fileModal(host, parentType, parentId, null, r); } }, '+ File') : null
        ]));
        if (!r.files.length) { host.appendChild(el('div', { class: 'muted small', text: 'No files yet.' })); return; }
        var list = el('div', { class: 'stack' });
        r.files.forEach(function (fl) { list.appendChild(fileRow(host, parentType, parentId, fl, r)); });
        host.appendChild(list);
      });
    });
  }

  function ensureMeta() {
    if (metaCache) return Promise.resolve();
    return HVApi.hv('files.meta', {}).then(function (r) { metaCache = (r && r.ok) ? r : { states: [], categories: [] }; });
  }

  function fileRow(host, parentType, parentId, fl, listRes) {
    return el('div', { class: 'banner', style: 'border-left:4px solid ' + (STATE_COLOR[fl.state] || 'var(--line)'), cursor: 'pointer' }, [
      el('div', { class: 'row wrap', onclick: function () { fileModal(host, parentType, parentId, fl, listRes); }, style: 'cursor:pointer' }, [
        el('div', {}, [
          el('div', { style: 'font-weight:600', text: fl.name + '  v' + fl.currentVersion }),
          el('div', { class: 'muted small', text: (fl.category || 'file') + ' · ' + fl.versionCount + ' version' + (fl.versionCount === 1 ? '' : 's') })
        ]),
        el('span', { class: 'spacer' }),
        el('span', { class: 'chip', style: 'background:' + (STATE_COLOR[fl.state] || '') + '22;border-color:' + (STATE_COLOR[fl.state] || 'var(--line)'), text: fl.stateLabel })
      ])
    ]);
  }

  function fileModal(host, parentType, parentId, fl, listRes) {
    if (!fl) { addModal(host, parentType, parentId); return; }
    var body = el('div', {}, HVUI.loading('Loading…'));
    HVUI.modal({ title: fl.name, body: body });
    HVApi.hv('files.get', { fileId: fl.id }).then(function (r) {
      body.innerHTML = '';
      if (!r || !r.ok) { body.appendChild(HVUI.empty(HVApi.err(r))); return; }
      var file = r.file, canManage = r.canManage;

      body.appendChild(el('div', { class: 'row wrap', style: 'gap:6px' }, [
        el('span', { class: 'chip', style: 'background:' + (STATE_COLOR[file.state] || '') + '22', text: file.stateLabel }),
        el('span', { class: 'chip', text: file.category || 'file' })
      ]));

      /* current + version history */
      body.appendChild(el('div', { class: 'grp-title', text: 'Versions' }));
      var vlist = el('div', { class: 'stack' });
      r.versions.forEach(function (v) {
        vlist.appendChild(el('div', { class: 'banner' }, [
          el('div', { class: 'row' }, [
            el('a', { href: v.url, target: '_blank', rel: 'noopener', style: 'font-weight:600', text: 'v' + v.version + ' — open' }),
            el('span', { class: 'spacer' }), el('span', { class: 'muted small', text: HVUI.timeAgo(v.created) })
          ]),
          v.note ? el('div', { class: 'small', text: v.note }) : null,
          el('div', { class: 'muted small', text: v.by })
        ]));
      });
      body.appendChild(vlist);

      /* add version */
      var vurl = el('input', { placeholder: 'new version link' });
      var vnote = el('input', { placeholder: 'note (optional)' });
      body.appendChild(el('div', { class: 'field' }, [ el('label', { text: 'Upload a new version' }), vurl, vnote,
        el('button', { class: 'btn primary small', style: 'margin-top:6px', onclick: function () {
          if (!vurl.value.trim()) { toast('Paste a link.', true); return; }
          HVApi.hv('files.addVersion', { fileId: fl.id, url: vurl.value.trim(), note: vnote.value.trim() }).then(function (rr) {
            if (rr && rr.ok) { HVUI.closeModal(); toast('Version added.'); render(host, parentType, parentId); } else toast(HVApi.err(rr), true);
          });
        } }, 'Add version') ]));

      /* approval controls */
      var stateRow = el('div', { class: 'row wrap', style: 'gap:6px;margin-top:10px' });
      var settable = canManage ? ['review', 'changes', 'approved', 'published', 'draft', 'submitted'] : ['draft', 'submitted'];
      settable.forEach(function (s) {
        if (s === file.state) return;
        stateRow.appendChild(el('button', { class: 'btn ghost small', onclick: function () {
          HVApi.hv('files.setState', { fileId: fl.id, state: s }).then(function (rr) {
            if (rr && rr.ok) { HVUI.closeModal(); toast('Set to ' + s + '.'); render(host, parentType, parentId); } else toast(HVApi.err(rr), true);
          });
        } }, 'Set ' + (metaLabel(s))));
      });
      body.appendChild(el('div', { class: 'field' }, [ el('label', { text: 'Change state' }), stateRow ]));

      /* comments */
      var cHost = el('div', {});
      body.appendChild(el('div', { class: 'field' }, [ el('label', { text: 'Discussion' }), cHost ]));
      if (window.HVComments) HVComments.thread(cHost, 'file', fl.id);
    });
  }

  function addModal(host, parentType, parentId) {
    var name = el('input', { placeholder: 'File name' });
    var url = el('input', { placeholder: 'Link (Google Drive or any URL)' });
    var cat = el('select', { style: 'width:100%;padding:10px;border:2px solid var(--line)' },
      (metaCache.categories || []).map(function (c) { var o = document.createElement('option'); o.value = c; o.textContent = c; return o; }));
    var note = el('input', { placeholder: 'note (optional)' });
    HVUI.modal({ title: 'Add a file', body: el('div', {}, [
      el('p', { class: 'muted small', text: 'Paste a link to the file in Drive (or anywhere). The OS tracks versions and approval; the bytes stay in Drive.' }),
      el('div', { class: 'field' }, [ el('label', { text: 'Name' }), name ]),
      el('div', { class: 'field' }, [ el('label', { text: 'Link' }), url ]),
      el('div', { class: 'field' }, [ el('label', { text: 'Category' }), cat ]),
      el('div', { class: 'field' }, [ el('label', { text: 'Note' }), note ])
    ]), foot: HVUI.footer([ { label: 'Cancel', class: 'ghost' }, { label: 'Add file', class: 'primary', closes: false, onClick: function () {
      if (!name.value.trim() || !url.value.trim()) { toast('Name and link are required.', true); return; }
      HVApi.hv('files.create', { parentType: parentType, parentId: parentId, name: name.value.trim(), url: url.value.trim(), category: cat.value, note: note.value.trim() }).then(function (r) {
        if (r && r.ok) { HVUI.closeModal(); toast('File added.'); render(host, parentType, parentId); } else toast(HVApi.err(r), true);
      });
    } } ]) });
  }

  function metaLabel(key) {
    var found = key;
    (metaCache.states || []).forEach(function (s) { if (s.key === key) found = s.label; });
    return found;
  }

  return { render: render };
})();
