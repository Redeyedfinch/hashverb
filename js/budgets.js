/**
 * Hashverb OS — budget board (frontend). A summary bar + line items with the
 * request/approve/pay lifecycle. HVBudgetBoard.render(host, parentType, parentId).
 */
var HVBudgetBoard = (function () {
  var el = HVUI.el, toast = HVUI.toast;
  var STATE_COLOR = { draft: '#6d6675', submitted: '#F4A400', review: '#0FA6AE', approved: '#0f9d58', rejected: '#E11D48', paid: '#00b874' };
  var metaCache = null;

  function inr(n) { return '₹' + (Number(n) || 0).toLocaleString('en-IN'); }

  function render(host, parentType, parentId) {
    host.innerHTML = '';
    ensureMeta().then(function () {
      HVApi.load('budgets.list', { parentType: parentType, parentId: parentId }, function (r) {
        host.innerHTML = '';
        if (!r || !r.ok) { host.appendChild(HVUI.empty(HVApi.err(r, 'Could not load the budget.'))); return; }
        host.appendChild(summaryBar(host, parentType, parentId, r));
        host.appendChild(el('div', { class: 'row', style: 'margin:12px 0' }, [
          el('span', { class: 'spacer' }),
          r.canRequest ? el('button', { class: 'btn primary small', onclick: function () { itemModal(host, parentType, parentId, null, r); } }, '+ Request') : null
        ]));
        if (!r.items.length) { host.appendChild(el('div', { class: 'muted small', text: 'No budget items yet.' })); return; }
        var wrap = el('div', { class: 'table-wrap' });
        var tbl = el('table', { class: 'tbl' });
        tbl.appendChild(el('thead', {}, el('tr', {}, [ th('Item'), th('Est.'), th('Actual'), th('Status'), r.canManage ? th('') : null ])));
        var tb = el('tbody', {});
        r.items.forEach(function (it) { tb.appendChild(itemRow(host, parentType, parentId, it, r)); });
        tbl.appendChild(tb); wrap.appendChild(tbl); host.appendChild(wrap);
      });
    });
  }

  function ensureMeta() {
    if (metaCache) return Promise.resolve();
    return HVApi.hv('budgets.meta', {}).then(function (r) { metaCache = (r && r.ok) ? r : { states: [], categories: [] }; });
  }

  function summaryBar(host, parentType, parentId, r) {
    var s = r.summary;
    var tiles = el('div', { class: 'tiles' }, [
      tile(s.cap ? inr(s.cap) : '—', 'Budget cap'),
      tile(inr(s.committed), 'Committed'),
      tile(inr(s.spent), 'Spent'),
      tile(s.cap ? inr(s.remaining) : '—', 'Remaining'),
      tile(String(s.pendingCount) + '  (' + inr(s.pendingAmount) + ')', 'Pending')
    ]);
    var wrap = el('div', {}, [ tiles ]);
    if (s.overCap) wrap.appendChild(el('div', { class: 'banner bad', style: 'margin-top:8px', text: 'Committed spending is over the cap.' }));
    else if (s.nearCap) wrap.appendChild(el('div', { class: 'banner warn', style: 'margin-top:8px', text: 'Committed spending is near the cap.' }));
    if (r.canManage) wrap.appendChild(el('button', { class: 'btn ghost small', style: 'margin-top:8px', onclick: function () { capModal(host, parentType, parentId, s.cap); } }, 'Set cap'));
    return wrap;
  }
  function tile(n, label) { return el('div', { class: 'tile' }, [ el('div', { class: 'n', style: 'font-size:20px', text: n }), el('div', { class: 'l', text: label }) ]); }

  function itemRow(host, parentType, parentId, it, listRes) {
    var actions = null;
    if (listRes.canManage) {
      actions = el('td', {});
      var row = el('div', { class: 'row wrap', style: 'gap:5px' });
      if (it.status === 'submitted' || it.status === 'review') {
        row.appendChild(mini('Approve', function () { setStatus(host, parentType, parentId, it, 'approved'); }, 'primary'));
        row.appendChild(mini('Reject', function () { setStatus(host, parentType, parentId, it, 'rejected'); }, 'danger'));
      }
      if (it.status === 'approved') row.appendChild(mini('Mark paid', function () { payModal(host, parentType, parentId, it); }, 'primary'));
      row.appendChild(mini('Edit', function () { itemModal(host, parentType, parentId, it, listRes); }));
      actions.appendChild(row);
    }
    return el('tr', { onclick: null }, [
      el('td', {}, [ el('div', { style: 'font-weight:600', text: it.category }), el('div', { class: 'muted small', text: it.description }),
        it.receiptUrl ? el('a', { href: it.receiptUrl, target: '_blank', rel: 'noopener', class: 'small', text: 'receipt' }) : null ]),
      el('td', { text: inr(it.estimated) }),
      el('td', { text: it.actual ? inr(it.actual) : '—' }),
      el('td', {}, el('span', { class: 'chip', style: 'background:' + (STATE_COLOR[it.status] || '') + '22;border-color:' + (STATE_COLOR[it.status] || 'var(--line)'), text: it.statusLabel })),
      actions
    ]);
  }

  function setStatus(host, parentType, parentId, it, status) {
    HVApi.hv('budgets.setStatus', { itemId: it.id, status: status }).then(function (r) {
      if (r && r.ok) { toast('Updated.'); render(host, parentType, parentId); } else toast(HVApi.err(r), true);
    });
  }

  function itemModal(host, parentType, parentId, it, listRes) {
    var cat = el('select', { style: sel() }, (metaCache.categories || []).map(function (c) { return opt(c, c); }));
    if (it) cat.value = it.category;
    var desc = el('input', { value: it ? it.description : '', placeholder: 'What is the money for?' });
    var est = el('input', { type: 'number', value: it ? it.estimated : '', placeholder: 'Estimated ₹' });
    HVUI.modal({ title: it ? 'Edit item' : 'Request budget', body: el('div', {}, [
      el('div', { class: 'field' }, [ el('label', { text: 'Category' }), cat ]),
      el('div', { class: 'field' }, [ el('label', { text: 'Description' }), desc ]),
      el('div', { class: 'field' }, [ el('label', { text: 'Estimated (₹)' }), est ])
    ]), foot: HVUI.footer([ { label: 'Cancel', class: 'ghost' }, { label: it ? 'Save' : 'Submit request', class: 'primary', closes: false, onClick: function () {
      if (!desc.value.trim()) { toast('Describe the request.', true); return; }
      if (it) {
        HVApi.hv('budgets.update', { itemId: it.id, category: cat.value, description: desc.value.trim(), estimated: est.value }).then(function (r) {
          if (r && r.ok) { HVUI.closeModal(); toast('Saved.'); render(host, parentType, parentId); } else toast(HVApi.err(r), true);
        });
      } else {
        HVApi.hv('budgets.create', { parentType: parentType, parentId: parentId, category: cat.value, description: desc.value.trim(), estimated: est.value, status: 'submitted' }).then(function (r) {
          if (r && r.ok) { HVUI.closeModal(); toast('Requested.'); render(host, parentType, parentId); } else toast(HVApi.err(r), true);
        });
      }
    } } ]) });
  }

  function payModal(host, parentType, parentId, it) {
    var actual = el('input', { type: 'number', value: it.estimated, placeholder: 'Actual ₹' });
    var receipt = el('input', { placeholder: 'receipt link (optional)' });
    var paidBy = el('input', { placeholder: 'paid by (optional)' });
    HVUI.modal({ title: 'Mark paid', body: el('div', {}, [
      el('div', { class: 'field' }, [ el('label', { text: 'Actual amount (₹)' }), actual ]),
      el('div', { class: 'field' }, [ el('label', { text: 'Receipt' }), receipt ]),
      el('div', { class: 'field' }, [ el('label', { text: 'Paid by' }), paidBy ])
    ]), foot: HVUI.footer([ { label: 'Cancel', class: 'ghost' }, { label: 'Mark paid', class: 'primary', closes: false, onClick: function () {
      HVApi.hv('budgets.update', { itemId: it.id, actual: actual.value, receiptUrl: receipt.value.trim(), paidBy: paidBy.value.trim() }).then(function () {
        HVApi.hv('budgets.setStatus', { itemId: it.id, status: 'paid' }).then(function (r) {
          if (r && r.ok) { HVUI.closeModal(); toast('Marked paid.'); render(host, parentType, parentId); } else toast(HVApi.err(r), true);
        });
      });
    } } ]) });
  }

  function capModal(host, parentType, parentId, current) {
    var cap = el('input', { type: 'number', value: current || '', placeholder: 'Total budget ₹' });
    HVUI.modal({ title: 'Set budget cap', body: el('div', { class: 'field' }, [ el('label', { text: 'Total budget (₹)' }), cap ]),
      foot: HVUI.footer([ { label: 'Cancel', class: 'ghost' }, { label: 'Save', class: 'primary', closes: false, onClick: function () {
        HVApi.hv('budgets.setCap', { parentType: parentType, parentId: parentId, cap: cap.value }).then(function (r) {
          if (r && r.ok) { HVUI.closeModal(); toast('Cap set.'); render(host, parentType, parentId); } else toast(HVApi.err(r), true);
        });
      } } ]) });
  }

  function th(t) { return el('th', { text: t }); }
  function mini(label, fn, cls) { return el('button', { class: 'btn ' + (cls || 'ghost') + ' small', onclick: fn }, label); }
  function sel() { return 'width:100%;padding:10px;border:2px solid var(--line)'; }
  function opt(v, label) { var o = document.createElement('option'); o.value = v; o.textContent = label; return o; }

  return { render: render };
})();
