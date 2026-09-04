/**
 * Hashverb OS — UI toolkit. DOM helpers, escaping, toast, modal, motion,
 * and small formatters. Deliberately dependency-free.
 */
var HVUI = (function () {

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function el(tag, attrs, kids) {
    var node = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (!attrs.hasOwnProperty(k)) continue;
      if (k === 'class') node.className = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
      else if (k === 'html') node.innerHTML = attrs[k];
      else if (k.indexOf('on') === 0 && typeof attrs[k] === 'function') node.addEventListener(k.substring(2), attrs[k]);
      else if (attrs[k] != null) node.setAttribute(k, attrs[k]);
    }
    if (kids) {
      if (!(kids instanceof Array)) kids = [kids];
      for (var i = 0; i < kids.length; i++) {
        var c = kids[i];
        if (c == null) continue;
        node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      }
    }
    return node;
  }

  /* HTML-escape — ALWAYS use this for any server/user string put into innerHTML. */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------------- toast ---------------- */
  var toastEl, toastT;
  function toast(msg, isErr) {
    if (!toastEl) { toastEl = el('div', { class: 'toast', id: 'toast' }); document.body.appendChild(toastEl); }
    toastEl.textContent = msg;
    toastEl.classList.toggle('err', !!isErr);
    toastEl.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 3400);
    /* Shroomy reacts to what happens: a happy hop on success, a puzzled look on
       an error. Guarded - the mascot is optional and must never break a toast. */
    try {
      if (window.HVMascot) {
        if (isErr) HVMascot.react('confused');
        else if (/\+\s*\d+\s*xp/i.test(msg)) { HVMascot.react('happy'); HVMascot.xp(msg.replace(/\s*-\s*streak.*/i, '')); }
        else HVMascot.react('happy');
      }
    } catch (e) {}
  }

  /* ---------------- modal ---------------- */
  /* Opens a modal from {title, body(node), foot(node), onClose}. Returns a
     close() function. One modal at a time is plenty for this app. */
  var modalHost, lastFocus;
  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  function modal(opts) {
    close();
    lastFocus = document.activeElement;           /* restore focus here on close */
    try { document.body.classList.add('modal-open'); } catch (e) {}
    modalHost = el('div', { class: 'modal open' });
    var card = el('div', { class: 'modal-card', role: 'dialog', 'aria-modal': 'true',
      'aria-label': opts.title || 'Dialog', tabindex: '-1' });
    var top = el('div', { class: 'modal-top' }, [
      el('h3', { text: opts.title || '' }),
      el('button', { class: 'x', 'aria-label': 'Close', onclick: close }, '✕')
    ]);
    card.appendChild(top);
    var body = el('div', { class: 'modal-body' });
    if (opts.body) body.appendChild(opts.body);
    card.appendChild(body);
    if (opts.foot) card.appendChild(opts.foot);
    modalHost.appendChild(card);
    modalHost.addEventListener('mousedown', function (e) { if (e.target === modalHost) close(); });
    document.body.appendChild(modalHost);
    document.addEventListener('keydown', onKey);
    modal._key = onKey;
    if (opts.onClose) modal._onClose = opts.onClose;
    /* move focus into the dialog (first field, else the card) */
    setTimeout(function () {
      var f = card.querySelector(FOCUSABLE);
      try { (f || card).focus(); } catch (e) {}
    }, 0);

    function onKey(e) {
      if (e.key === 'Escape') { close(); return; }
      if (e.key !== 'Tab') return;
      /* focus trap: keep Tab inside the dialog */
      var items = card.querySelectorAll(FOCUSABLE);
      if (!items.length) { e.preventDefault(); return; }
      var first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); try { last.focus(); } catch (x) {} }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); try { first.focus(); } catch (x) {} }
    }
    return close;
  }
  function close() {
    if (modal._key) { document.removeEventListener('keydown', modal._key); modal._key = null; }
    if (modalHost && modalHost.parentNode) modalHost.parentNode.removeChild(modalHost);
    modalHost = null;
    try { document.body.classList.remove('modal-open'); } catch (e) {}
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
    lastFocus = null;
    if (modal._onClose) { var f = modal._onClose; modal._onClose = null; f(); }
  }

  /* A standard footer row of buttons. specs: [{label, class, onClick, closes}] */
  function footer(specs) {
    var foot = el('div', { class: 'modal-foot' });
    specs.forEach(function (s) {
      foot.appendChild(el('button', {
        class: 'btn ' + (s.class || 'ghost'),
        onclick: function () { if (s.onClick) s.onClick(); if (s.closes !== false) close(); }
      }, s.label));
    });
    return foot;
  }

  function confirm(opts, onYes) {
    modal({
      title: opts.title || 'Are you sure?',
      body: el('p', { text: opts.message || '' }),
      foot: footer([
        { label: 'Cancel', class: 'ghost' },
        { label: opts.yes || 'Confirm', class: opts.danger ? 'danger' : 'primary',
          onClick: onYes }
      ])
    });
  }

  /* ---------------- motion ---------------- */
  function initMotion() {
    var reduced = false;
    try {
      var v = localStorage.getItem('hv_reduced_motion');
      reduced = v != null ? v === '1'
        : (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) {}
    apply();
    function apply() { document.body.classList.toggle('reduce-motion', reduced); }
    return {
      toggle: function () {
        reduced = !reduced;
        try { localStorage.setItem('hv_reduced_motion', reduced ? '1' : '0'); } catch (e) {}
        apply();
        return reduced;
      },
      reduced: function () { return reduced; }
    };
  }

  /* ---------------- formatters ---------------- */
  function timeAgo(ts) {
    var d = ts instanceof Date ? ts : new Date(ts);
    var t = d.getTime();
    if (!t) return '';
    var s = Math.floor((Date.now() - t) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    if (s < 604800) return Math.floor(s / 86400) + 'd ago';
    return fmtDate(d);
  }
  function fmtDate(ts) {
    var d = ts instanceof Date ? ts : new Date(ts);
    if (!d.getTime()) return '';
    var mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return d.getDate() + ' ' + mon[d.getMonth()] + ' ' + d.getFullYear();
  }
  function initials(name) {
    var parts = String(name || '').trim().split(/\s+/);
    if (!parts[0]) return '?';
    return (parts[0].charAt(0) + (parts.length > 1 ? parts[parts.length - 1].charAt(0) : '')).toUpperCase();
  }

  /* ---------------- identity (USN / mobile) ----------------
     Same rules as the arcade: a 10-digit Indian mobile is accepted in place of
     a USN, and normalised to bare digits so "+91 98765 43210" and "9876543210"
     are one person. Returns the canonical string, or '' if it is neither. */
  function normId(raw) {
    var s = String(raw == null ? '' : raw).trim().toUpperCase().replace(/\s+/g, '');
    var d = s.replace(/\D/g, '');
    if (d.length === 12 && d.indexOf('91') === 0) d = d.slice(2);
    else if (d.length === 11 && d.charAt(0) === '0') d = d.slice(1);
    if (/^[6-9][0-9]{9}$/.test(d)) return d;            /* a mobile number */
    if (/^[A-Z0-9/\-]{4,20}$/.test(s)) return s;        /* a USN */
    return '';
  }
  function validId(raw) { return !!normId(raw); }

  /* A RetroUI glyph tile: hard-bordered square with 1-2 initials in the
     display font - the house replacement for pictogram icons on teams,
     events and anything else that needs a visual handle. */
  function tile(name, color, px) {
    px = px || 34;
    return el('div', {
      class: 'glyph-tile',
      style: 'width:' + px + 'px;height:' + px + 'px;border:2px solid var(--line);' +
        'display:grid;place-items:center;font-family:var(--display);font-weight:700;' +
        'font-size:' + Math.round(px * 0.42) + 'px;background:var(--bg);flex:0 0 auto;' +
        (color ? 'color:' + color + ';border-bottom:4px solid ' + color + ';' : ''),
      text: initials(name)
    });
  }

  /* Loading placeholder node. */
  function loading(label) {
    return el('div', { class: 'loading-wrap' }, [
      el('span', { class: 'spin' }), el('span', { class: 'muted', style: 'margin-left:10px' }, label || 'Loading…')
    ]);
  }
  function empty(label) { return el('div', { class: 'empty', text: label || 'Nothing here yet.' }); }

  /* A shimmering skeleton placeholder — feels faster than a spinner because the
     final shape is already there. `rows` bars, the first one wider (a title). */
  function skeleton(rows) {
    rows = rows || 3;
    var wrap = el('div', { class: 'skel', 'aria-hidden': 'true' });
    for (var i = 0; i < rows; i++) wrap.appendChild(el('div', { class: 'skel-bar' + (i === 0 ? ' skel-title' : '') }));
    return wrap;
  }

  return {
    $: $, $$: $$, el: el, esc: esc, toast: toast,
    modal: modal, closeModal: close, footer: footer, confirm: confirm,
    initMotion: initMotion, timeAgo: timeAgo, fmtDate: fmtDate, initials: initials,
    normId: normId, validId: validId, tile: tile,
    loading: loading, empty: empty, skeleton: skeleton
  };
})();
