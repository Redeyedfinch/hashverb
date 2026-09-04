/**
 * Hashverb OS — join applications (crew review view).
 *
 * The review side of the public join page (join.html): every application to
 * join the club as a member of Events / Tech / PR / Socials, with the contact
 * details the crew needs to follow up. The whole view is gated by
 * applications.review (nav + server both) because of those contact details.
 *
 * Actions map to hv join.setStatus: contacted / accepted / declined, a note,
 * and archive (soft delete). join.list rides the SWR cache; setStatus is a
 * write, so api.js busts the join.* cache automatically.
 */
var HVAppsView = (function () {
  var el = HVUI.el;
  var esc = HVUI.esc;

  var filter = 'all';
  var last = null;   /* last good join.list result, for local re-filtering */

  var STATUS = {
    'new':       { label: 'New',       color: '#2563EB' },
    'contacted': { label: 'Contacted', color: '#F4A400' },
    'accepted':  { label: 'Accepted',  color: '#0f9d58' },
    'declined':  { label: 'Declined',  color: '#E11D48' }
  };

  function teamName(r, key) {
    var teams = (r && r.teams) || [];
    for (var i = 0; i < teams.length; i++) if (teams[i].key === key) return teams[i].name;
    return key || '';
  }

  function joinPageUrl() {
    return String(location.href).replace(/[#?].*$/, '').replace(/[^/]*$/, 'join.html');
  }

  function render(host, ctx) {
    host.innerHTML = '';
    host.appendChild(el('div', { class: 'page-head' }, [
      el('div', {}, [
        el('div', { class: 'eyebrow', text: '// recruitment' }),
        el('h1', { class: 'section-title', text: 'Applications' })
      ]),
      el('div', { class: 'row', style: 'gap:8px' }, [
        el('a', { class: 'btn ghost small', href: joinPageUrl(), target: '_blank', rel: 'noopener' }, 'Open join page'),
        el('button', { class: 'btn ghost small', onclick: function () {
          var url = joinPageUrl();
          try {
            navigator.clipboard.writeText(url).then(
              function () { HVUI.toast('Join page link copied.'); },
              function () { HVUI.toast(url); });
          } catch (e) { HVUI.toast(url); }
        } }, 'Copy link')
      ])
    ]));

    var body = el('div', {}, HVUI.loading('Loading applications…'));
    host.appendChild(body);
    HVApi.load('join.list', {}, function (r) { paint(body, r); });
  }

  function refresh(body) {
    HVApi.load('join.list', {}, function (r) { paint(body, r); });
  }

  function paint(body, r) {
    body.innerHTML = '';
    if (!r || !r.ok) { body.appendChild(HVUI.empty(HVApi.err(r, 'Could not load applications.'))); return; }
    last = r;

    /* intake state — the toggle itself is the HV_JOIN_CLOSED script property */
    body.appendChild(el('div', { class: 'banner ' + (r.closed ? 'warn' : 'good'), style: 'margin-bottom:12px' }, [
      el('strong', { text: r.closed ? 'Intake paused. ' : 'Intake open. ' }),
      el('span', { class: 'small', text: r.closed
        ? 'The join page refuses new applications. Clear the HV_JOIN_CLOSED script property in the backend to reopen.'
        : 'Anyone with the join page link can apply. Set the HV_JOIN_CLOSED script property to 1 in the backend to pause.' })
    ]));

    /* filter chips with counts */
    var total = r.applications.length;
    var chips = el('div', { class: 'row wrap', style: 'gap:8px;margin-bottom:12px' });
    chipFor(chips, body, 'all', 'All', total);
    ['new', 'contacted', 'accepted', 'declined'].forEach(function (st) {
      chipFor(chips, body, st, STATUS[st].label, r.counts[st] || 0);
    });
    body.appendChild(chips);

    var apps = r.applications.filter(function (a) { return filter === 'all' || a.status === filter; });
    if (!apps.length) {
      body.appendChild(HVUI.empty(total ? 'Nothing with this status.' : 'No applications yet. Share the join page to start recruiting.'));
      return;
    }
    var list = el('div', { class: 'stack' });
    apps.forEach(function (a) { list.appendChild(appCard(body, r, a)); });
    body.appendChild(list);
  }

  function chipFor(host, body, key, label, count) {
    host.appendChild(el('button', {
      class: 'chip', style: 'cursor:pointer' + (filter === key ? ';background:var(--line);color:#FFF3D9' : ''),
      onclick: function () { filter = key; paint(body, last); }
    }, label + ' · ' + count));
  }

  function appCard(body, r, a) {
    var st = STATUS[a.status] || STATUS['new'];
    var teams = teamName(r, a.team) + (a.team2 ? ' · 2nd: ' + teamName(r, a.team2) : '');

    var head = el('div', { class: 'row', style: 'gap:8px;align-items:baseline' }, [
      el('div', { style: 'font-weight:700;font-family:var(--display)', text: a.name }),
      el('span', { class: 'chip', text: teams }),
      el('span', { class: 'spacer' }),
      el('span', { class: 'chip', style: 'border-color:' + st.color + ';color:' + st.color, text: st.label })
    ]);

    var meta = el('div', { class: 'small muted', style: 'margin-top:4px' }, [
      el('span', { text: a.usn + ' · ' + a.program + ' · Sem ' + a.semester + ' · applied ' + HVUI.timeAgo(a.created) })
    ]);
    var contact = el('div', { class: 'small', style: 'margin-top:6px' }, [
      el('a', { href: 'mailto:' + esc(a.email), text: a.email }),
      el('span', { class: 'muted', text: '  ·  ' }),
      el('a', { href: 'tel:+91' + esc(a.mobile), text: a.mobile })
    ]);

    var kids = [head, meta, contact];
    if (a.why) kids.push(el('div', { class: 'small', style: 'margin-top:6px;font-style:italic', text: '“' + a.why + '”' }));
    if (a.note) kids.push(el('div', { class: 'banner info small', style: 'margin-top:6px', text: 'Note: ' + a.note }));

    var actions = el('div', { class: 'row wrap', style: 'gap:6px;margin-top:10px' });
    ['contacted', 'accepted', 'declined'].forEach(function (next) {
      if (a.status === next) return;
      actions.appendChild(el('button', { class: 'btn ghost small',
        onclick: function () { act(body, a.id, { status: next }, 'Marked ' + STATUS[next].label.toLowerCase() + '.'); }
      }, STATUS[next].label));
    });
    actions.appendChild(el('button', { class: 'btn ghost small', onclick: function () { noteModal(body, a); } }, a.note ? 'Edit note' : 'Add note'));
    actions.appendChild(el('button', { class: 'btn ghost small', onclick: function () {
      HVUI.confirm({ title: 'Archive application?',
        body: el('p', { text: a.name + '’s application is hidden from this list (never deleted — it stays in the sheet).' }) },
        function () { act(body, a.id, { archive: true }, 'Archived.'); });
    } }, 'Archive'));
    kids.push(actions);

    return el('div', { class: 'card' }, kids);
  }

  function act(body, id, patch, doneMsg) {
    var p = { applicationId: id };
    for (var k in patch) p[k] = patch[k];
    HVApi.hv('join.setStatus', p).then(function (r) {
      if (r && r.ok) { HVUI.toast(doneMsg); refresh(body); }
      else HVUI.toast(HVApi.err(r, 'Could not update.'), true);
    });
  }

  function noteModal(body, a) {
    var ta = el('textarea', { maxlength: '500', style: 'width:100%;min-height:90px;box-sizing:border-box' });
    ta.value = a.note || '';
    HVUI.modal({
      title: 'Note on ' + a.name,
      body: el('div', { class: 'field' }, [ ta ]),
      foot: HVUI.footer([
        { label: 'Cancel', class: 'ghost' },
        { label: 'Save note', class: 'primary', onClick: function () { act(body, a.id, { note: ta.value }, 'Note saved.'); } }
      ])
    });
  }

  return { render: render, reset: function () { filter = 'all'; } };
})();
