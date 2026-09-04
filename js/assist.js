/**
 * Hashverb OS — Shroomy's overview assistant (frontend).
 *
 * A small, friendly card: the member asks Shroomy for an overview, or types a
 * short question, and gets a grounded reply about their own #Hash work. All the
 * intelligence and the provider key live server-side (assist.ask); this only
 * renders the card, shows the answer, and nudges the mascot.
 *
 * The card hides itself entirely when the backend has no key configured, so
 * nothing broken ever shows to members.
 */
var HVAssist = (function () {
  var el = HVUI.el, toast = HVUI.toast;
  var enabled = null;   /* cached across renders this session */

  function card(host, me, seedEnabled) {
    /* Home passes the enabled flag from home.summary, so no separate
       assist.status round-trip is needed on the initial load. */
    if (seedEnabled !== undefined) enabled = !!seedEnabled;
    if (enabled === false) return;
    if (enabled === null) {
      HVApi.hv('assist.status', {}).then(function (r) {
        enabled = !!(r && r.ok && r.enabled);
        if (enabled) build(host, me);
      });
      return;
    }
    build(host, me);
  }

  function build(host, me) {
    host.innerHTML = '';
    var out = el('div', { class: 'assist-out hidden' });
    var input = el('input', { placeholder: 'Ask about your tasks, teams, events…', 'aria-label': 'Ask Shroomy' });
    var askBtn = el('button', { class: 'btn small', onclick: function () { ask(input.value.trim()); } }, 'Ask');
    var overviewBtn = el('button', { class: 'btn primary small', onclick: function () { ask(''); } }, 'My overview');

    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') ask(input.value.trim()); });

    host.appendChild(el('div', { class: 'card' }, [
      el('div', { class: 'row' }, [
        el('h2', { text: 'Ask Shroomy' }), el('span', { class: 'spacer' }),
        el('span', { class: 'chip', title: 'Read-only — Shroomy only summarises your own work', text: 'read-only' })
      ]),
      el('p', { class: 'muted small', style: 'margin:2px 0 0', text: 'A quick, friendly overview of where your #Hash work stands.' }),
      out,
      el('div', {}, [ overviewBtn ]),
      el('div', { class: 'assist-row' }, [ input, askBtn ])
    ]));

    function ask(question) {
      overviewBtn.disabled = askBtn.disabled = true;
      out.classList.remove('hidden');
      out.innerHTML = '';
      out.appendChild(HVUI.loading('Shroomy is looking…'));
      try { if (window.HVMascot) { HVMascot.react('confused'); HVMascot.say('hmm…'); } } catch (e) {}

      HVApi.hv('assist.ask', question ? { question: question } : {}).then(function (r) {
        overviewBtn.disabled = askBtn.disabled = false;
        out.innerHTML = '';
        if (r && r.ok) {
          out.textContent = r.text;      /* textContent — model output is shown verbatim, never as HTML */
          input.value = '';
          try { if (window.HVMascot) { HVMascot.react('happy'); HVMascot.say('there you go!'); } } catch (e) {}
        } else if (r && r.notConfigured) {
          enabled = false; host.innerHTML = '';   /* got disabled server-side — hide */
        } else {
          out.textContent = HVApi.err(r, 'Shroomy could not answer just now.');
          try { if (window.HVMascot) HVMascot.react('sad'); } catch (e) {}
        }
      });
    }
  }

  return { card: card };
})();
