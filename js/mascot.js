/**
 * Hashverb OS — "Shroomy" the pixel red-mushroom mascot (ported from the club
 * site's Mascot.html). Living face (blink + pupil tracking), a neko engine
 * (walks the screen, chases the pointer, naps), 12 emotions with particles.
 * All inline SVG - no assets, no external library (particles use a CSS
 * fallback). Respects the MOTION: OFF toggle and prefers-reduced-motion.
 *
 * The club version hooked specific page elements (#pCheckIn, .banner, #pStreak);
 * here Shroomy is driven by a small public API instead:
 *     HVMascot.react('happy'|'sad'|'confused'|'celebratory'|...)  one-shot
 *     HVMascot.say(text, ms)          speech bubble
 *     HVMascot.xp(text)               floating "+10 XP"
 *     HVMascot.superMode()            lock the super aura (e.g. big streak)
 * app.js / core.js call these on toasts, check-ins, etc.
 */
var HVMascot = (function () {
  'use strict';

  function prefersReduced() { try { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function reducedNow() { return document.body.classList.contains('reduce-motion') || prefersReduced(); }
  function rnd(n) { return Math.random() * n; }
  function pick(a) { return a[Math.floor(rnd(a.length))]; }
  function now() { return (window.performance && performance.now) ? performance.now() : +new Date(); }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  var isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  var hasMouse = !isTouch;

  var SVG = '<svg viewBox="0 -10 64 88" xmlns="http://www.w3.org/2000/svg">'
    + '<g class="v a-hat"><path d="M46 8 L42 -8 L55 1 Z" fill="#4ECCD3" stroke="#3a1214" stroke-width="2" stroke-linejoin="round"/><circle cx="42" cy="-8" r="2.6" fill="#F4A400" stroke="#3a1214" stroke-width="1.2"/></g>'
    + '<g class="v a-crown"><path d="M19 3 L24 -6 L32 1 L40 -6 L45 3 Z" fill="#FFD700" stroke="#3a1214" stroke-width="1.8" stroke-linejoin="round"/><circle cx="24" cy="-6" r="1.6" fill="#E94560"/><circle cx="40" cy="-6" r="1.6" fill="#0FA6AE"/></g>'
    + '<path class="shroom-cap" d="M5 34 C5 15 18 7 32 7 C46 7 59 15 59 34 C59 35.5 58 37 56 37 L8 37 C6 37 5 35.5 5 34 Z" fill="#e5322f" stroke="#3a1214" stroke-width="2.5" stroke-linejoin="round"/>'
    + '<g fill="#fff"><circle cx="17" cy="22" r="4"/><circle cx="40" cy="15" r="5"/><circle cx="29" cy="27" r="3"/><circle cx="49" cy="26" r="3.4"/><circle cx="11" cy="30" r="2.4"/></g>'
    + '<path class="shroom-body" d="M20 35 L44 35 L43 56 C43 63 38 66 32 66 C26 66 21 63 21 56 Z" fill="#f4ead2" stroke="#3a1214" stroke-width="2.5" stroke-linejoin="round"/>'
    + '<g class="feet"><ellipse cx="26" cy="67" rx="4" ry="3" fill="#f4ead2" stroke="#3a1214" stroke-width="2"/><ellipse cx="38" cy="67" rx="4" ry="3" fill="#f4ead2" stroke="#3a1214" stroke-width="2"/></g>'
    + '<path class="arm arm-l" d="M21 45 q-6 1 -7 7" fill="none" stroke="#3a1214" stroke-width="2.5" stroke-linecap="round"/>'
    + '<path class="arm arm-r" d="M43 45 q6 1 7 7" fill="none" stroke="#3a1214" stroke-width="2.5" stroke-linecap="round"/>'
    + '<circle cx="23" cy="51" r="2.7" fill="#ff9db0"/><circle cx="41" cy="51" r="2.7" fill="#ff9db0"/>'
    + '<g id="eyes">'
      + '<ellipse class="ew" cx="27" cy="46" rx="4.2" ry="4.6" fill="#fff" stroke="#3a1214" stroke-width="1.4"/>'
      + '<ellipse class="ew" cx="39" cy="46" rx="4.2" ry="4.6" fill="#fff" stroke="#3a1214" stroke-width="1.4"/>'
      + '<g class="pupil" id="pupL"><circle cx="27" cy="46" r="2.2" fill="#241017"/><circle cx="26.1" cy="45" r=".8" fill="#fff"/></g>'
      + '<g class="pupil" id="pupR"><circle cx="39" cy="46" r="2.2" fill="#241017"/><circle cx="38.1" cy="45" r=".8" fill="#fff"/></g>'
    + '</g>'
    + '<g class="v e-arc"><path d="M23 47 q4 -5 7 0" fill="none" stroke="#3a1214" stroke-width="2.2" stroke-linecap="round"/><path d="M35 47 q4 -5 7 0" fill="none" stroke="#3a1214" stroke-width="2.2" stroke-linecap="round"/></g>'
    + '<g class="v e-sleepy"><path d="M23 46 q4 3 7 0" fill="none" stroke="#3a1214" stroke-width="2" stroke-linecap="round"/><path d="M35 46 q4 3 7 0" fill="none" stroke="#3a1214" stroke-width="2" stroke-linecap="round"/></g>'
    + '<g class="v e-wink"><circle cx="27" cy="46" r="2.4" fill="#241017"/><path d="M35 46 q4 -3 7 0" fill="none" stroke="#3a1214" stroke-width="2.2" stroke-linecap="round"/></g>'
    + '<g class="v e-squint"><path d="M23 46 l7 0" stroke="#3a1214" stroke-width="2.6" stroke-linecap="round"/><path d="M35 46 l7 0" stroke="#3a1214" stroke-width="2.6" stroke-linecap="round"/></g>'
    + '<g class="v e-wide"><circle cx="27" cy="46" r="5" fill="#fff" stroke="#3a1214" stroke-width="1.5"/><circle cx="39" cy="46" r="5" fill="#fff" stroke="#3a1214" stroke-width="1.5"/><circle cx="27" cy="46" r="2" fill="#241017"/><circle cx="39" cy="46" r="2" fill="#241017"/></g>'
    + '<g class="v e-angry"><path d="M22 43 l7 3" stroke="#3a1214" stroke-width="2.4" stroke-linecap="round"/><path d="M43 43 l-7 3" stroke="#3a1214" stroke-width="2.4" stroke-linecap="round"/><circle cx="27" cy="47" r="2" fill="#241017"/><circle cx="39" cy="47" r="2" fill="#241017"/></g>'
    + '<g class="v a-brow"><path d="M22 40 l7 2.6" stroke="#3a1214" stroke-width="2.6" stroke-linecap="round"/><path d="M43 40 l-7 2.6" stroke="#3a1214" stroke-width="2.6" stroke-linecap="round"/></g>'
    + '<g class="v a-glasses"><circle cx="27" cy="46" r="5.4" fill="none" stroke="#3a1214" stroke-width="1.6"/><circle cx="39" cy="46" r="5.4" fill="none" stroke="#3a1214" stroke-width="1.6"/><path d="M32.4 46 l1.2 0" stroke="#3a1214" stroke-width="1.6"/></g>'
    + '<path class="v m-smile" d="M28 53 q4 4 8 0" fill="none" stroke="#3a1214" stroke-width="2" stroke-linecap="round"/>'
    + '<path class="v m-grin" d="M27 52 q5 6 10 0 Z" fill="#7a2b2b" stroke="#3a1214" stroke-width="1.4" stroke-linejoin="round"/>'
    + '<circle class="v m-oh" cx="32" cy="55" r="3" fill="#7a2b2b" stroke="#3a1214" stroke-width="1.4"/>'
    + '<path class="v m-frown" d="M28 56 q4 -4 8 0" fill="none" stroke="#3a1214" stroke-width="2" stroke-linecap="round"/>'
    + '<g class="v m-tongue"><path d="M28 53 q4 4 8 0" fill="none" stroke="#3a1214" stroke-width="2" stroke-linecap="round"/><rect x="31" y="54" width="4" height="4" rx="2" fill="#ff6b81"/></g>'
    + '<path class="v m-flat" d="M29 55 l6 0" stroke="#3a1214" stroke-width="2" stroke-linecap="round"/>'
    + '</svg>';

  var EMO = {
    idle:        { eyes: 'live',     show: ['m-smile'],            fx: '',        persist: true },
    happy:       { eyes: 'e-arc',    show: ['m-grin'],             fx: 'fx-jump', p: 'star' },
    focused:     { eyes: 'live',     show: ['m-flat', 'a-glasses'], fx: '',       persist: true, look: [0, 1.6] },
    sleepy:      { eyes: 'e-sleepy', show: ['m-flat'],             fx: 'fx-sleepy', p: 'zzz', persist: true },
    surprised:   { eyes: 'e-wide',   show: ['m-oh'],               fx: 'fx-pop',  p: 'excl' },
    confused:    { eyes: 'e-squint', show: ['m-flat'],             fx: 'fx-wobble', p: 'quest' },
    angry:       { eyes: 'e-angry',  show: ['m-frown', 'a-brow'],  fx: 'fx-jitter', p: 'steam', tint: 'angry-tint' },
    celebratory: { eyes: 'e-arc',    show: ['m-grin', 'a-hat'],    fx: 'fx-spin', p: 'confetti' },
    sad:         { eyes: 'e-sleepy', show: ['m-frown'],            fx: 'fx-droop', p: 'tear' },
    scared:      { eyes: 'e-wide',   show: ['m-oh'],               fx: 'fx-shiver', p: 'sweat' },
    cheeky:      { eyes: 'e-wink',   show: ['m-tongue'],           fx: 'fx-dance' },
    super:       { eyes: 'e-arc',    show: ['m-grin', 'a-crown'],  fx: '',        p: 'spark', persist: true, tint: 'super-aura' }
  };
  var DUR = { fx: 700, 'fx-jump': 720, 'fx-spin': 860, 'fx-wobble': 820, 'fx-jitter': 1200, 'fx-shiver': 1900, 'fx-pop': 520, 'fx-droop': 720, 'fx-dance': 1700 };

  var mascot, inner, flip, body, eyesG, pupL, pupR, bubble;
  var cur = 'idle', revertT = null, pTimer = null, superLocked = false;
  var lookBias = null, lookX = 0, lookY = 0;
  var MW = 76, MH = 92, px = 0, py = 0, faceLeft = false, faceDir = 1;
  var curPointer = { x: null, y: null, t: 0 };
  var restMs = 0, napped = false, pauseUntil = 0, engineT = null, bornAt = 0, parked = false;
  var roam = { x: 0, y: 0 };
  var built = false;

  function build() {
    if (built) return; built = true;
    mascot = document.createElement('div'); mascot.className = 'mascot'; mascot.setAttribute('aria-hidden', 'true');
    bubble = document.createElement('div'); bubble.className = 'mascot-bubble';
    inner = document.createElement('div'); inner.className = 'm-inner breathe';
    flip = document.createElement('div'); flip.className = 'm-flip';
    body = document.createElement('div'); body.className = 'm-body'; body.innerHTML = SVG;
    flip.appendChild(body); inner.appendChild(flip);
    mascot.appendChild(bubble); mascot.appendChild(inner);
    document.body.appendChild(mascot);

    eyesG = body.querySelector('#eyes'); pupL = body.querySelector('#pupL'); pupR = body.querySelector('#pupR');
    px = innerWidth - MW - 20; py = innerHeight - MH - 20; place();
    applyEmo('idle'); wireEvents(); startBlink(); startEngine();
    newRoam();
    setTimeout(function () { say('hi!', 1600); emote('happy'); }, 900);
  }

  function byCls(c) { return body.querySelector('.' + c); }
  function applyEmo(name) {
    var e = EMO[name] || EMO.idle; cur = name;
    Array.prototype.forEach.call(body.querySelectorAll('.v'), function (el) { el.style.display = 'none'; });
    var liveEyes = (e.eyes === 'live');
    eyesG.style.display = liveEyes ? '' : 'none';
    if (!liveEyes) { var ev = byCls(e.eyes); if (ev) ev.style.display = 'inline'; }
    (e.show || []).forEach(function (c) { var el = byCls(c); if (el) el.style.display = 'inline'; });
    mascot.classList.remove('angry-tint', 'super-aura');
    if (e.tint && !reducedNow()) mascot.classList.add(e.tint);
    lookBias = e.look || null;
    if (pTimer) { clearInterval(pTimer); pTimer = null; }
    inner.removeEventListener('animationend', endOnce);
    inner.className = 'm-inner breathe';
    if (reducedNow()) { mascot.classList.remove('busy'); return; }
    if (e.fx) { mascot.classList.add('busy'); void inner.offsetWidth; inner.className = 'm-inner ' + e.fx;
      if (!e.persist) { inner.addEventListener('animationend', endOnce, { once: true }); } }
    else { mascot.classList.remove('busy'); }
    if (e.p) startParticles(e.p);
  }
  function endOnce() { mascot.classList.remove('busy'); inner.className = 'm-inner breathe'; }
  function emote(name) {
    clearTimeout(revertT); applyEmo(name);
    pauseUntil = now() + (DUR[EMO[name] && EMO[name].fx] || 600);
    var e = EMO[name];
    if (e && !e.persist) { var d = DUR[e.fx] || DUR.fx; revertT = setTimeout(function () { applyEmo(superLocked ? 'super' : 'idle'); }, d + 380); }
  }
  function persistEmo(name) { clearTimeout(revertT); applyEmo(name); }

  function startBlink() {
    (function schedule() {
      var wait = 2200 + rnd(3200);
      setTimeout(function () {
        if (!reducedNow() && (cur === 'idle' || cur === 'focused')) { blinkOnce(); if (Math.random() < 0.25) setTimeout(blinkOnce, 240); }
        schedule();
      }, wait);
    })();
  }
  function blinkOnce() { if (reducedNow() || eyesG.style.display === 'none') return; eyesG.classList.add('blink'); setTimeout(function () { eyesG.classList.remove('blink'); }, 180); }
  function aimEyes() {
    if (!pupL) return;
    var tx, ty;
    if (lookBias) { tx = lookBias[0]; ty = lookBias[1]; }
    else {
      var cx = px + MW / 2, cy = py + MH * 0.55, gx, gy;
      if (hasMouse && curPointer.x != null) { gx = curPointer.x; gy = curPointer.y; }
      else { gx = cx + faceDir * 40; gy = cy; }
      var dx = gx - cx, dy = gy - cy, m = Math.hypot(dx, dy) || 1;
      tx = clamp(dx / m * 2.1, -2.1, 2.1); ty = clamp(dy / m * 1.7, -1.5, 2.1);
      if (faceLeft) tx = -tx;
    }
    lookX += (tx - lookX) * 0.25; lookY += (ty - lookY) * 0.25;
    var t = 'translate(' + lookX.toFixed(2) + 'px,' + lookY.toFixed(2) + 'px)';
    pupL.style.transform = t; pupR.style.transform = t;
  }

  function place() { mascot.style.transform = 'translate3d(' + px + 'px,' + py + 'px,0)'; }
  function setFacing(left) { if (left === faceLeft) return; faceLeft = left; faceDir = left ? -1 : 1; flip.style.transform = 'scaleX(' + faceDir + ')'; }
  function startEngine() { bornAt = now(); if (engineT) clearInterval(engineT); engineT = setInterval(tick, 1000 / 30); }

  function tick() {
    MW = innerWidth < 900 ? 64 : 76; MH = innerWidth < 900 ? 76 : 92;
    if (reducedNow()) { if (!parked) { px = innerWidth - MW - 16; py = innerHeight - MH - 16; place(); body.classList.remove('walk'); parked = true; } return; }
    parked = false;
    var t = now();
    var frozen = t < pauseUntil || cur === 'focused' || cur === 'super';
    var tx, ty, chasing = false;
    var haveCursor = hasMouse && curPointer.x != null && (t - curPointer.t) < 6000;
    if (haveCursor) {
      var cx = px + MW / 2, cy = py + MH * 0.6, dx = curPointer.x - cx, dy = curPointer.y - cy, d = Math.hypot(dx, dy) || 1, gap = 90;
      tx = curPointer.x - dx / d * gap - MW / 2; ty = curPointer.y - dy / d * gap - MH * 0.6; chasing = d > gap + 6;
    } else { tx = roam.x; ty = roam.y; chasing = Math.hypot((tx - px), (ty - py)) > 10; }
    tx = clamp(tx, 8, innerWidth - MW - 8); ty = clamp(ty, 110, innerHeight - MH - 10);
    var vx = tx - px, vy = ty - py, dist = Math.hypot(vx, vy);
    var age = t - bornAt, boost = age < 5000 ? (1 + 2.6 * (1 - age / 5000)) : 1;
    var speed = (hasMouse ? 2.6 : 2.0) * boost;
    if (!frozen && chasing && dist > 1.5) {
      var step = Math.min(speed, dist);
      px += vx / dist * step; py += vy / dist * step;
      setFacing(vx < -0.4 ? true : (vx > 0.4 ? false : faceLeft));
      body.classList.add('walk'); restMs = 0; napped = false;
      if (cur === 'sleepy') persistEmo('idle');
    } else {
      body.classList.remove('walk');
      if (!frozen) {
        restMs += 1000 / 30;
        if (restMs > 6500 && !napped && cur === 'idle' && !superLocked) { napped = true; persistEmo('sleepy'); say('zzz...', 1400); }
        else if (restMs > 2600 && restMs < 2700 && cur === 'idle' && Math.random() < 0.6) { emote(pick(['surprised', 'cheeky', 'confused', 'happy'])); }
      }
    }
    place(); aimEyes();
  }
  function newRoam() { roam.x = 20 + rnd(Math.max(40, innerWidth - MW - 40)); roam.y = 110 + rnd(Math.max(40, innerHeight - MH - 190)); }
  setInterval(function () { if (built && !reducedNow()) newRoam(); }, 4200);

  function spawn(ch, opts) {
    opts = opts || {}; var el = document.createElement('span'); el.className = 'm-fx'; el.textContent = ch;
    if (opts.color) el.style.color = opts.color; if (opts.size) el.style.fontSize = opts.size; if (opts.left != null) el.style.left = opts.left;
    mascot.appendChild(el);
    el.style.animation = 'm-rise .9s steps(5,end) forwards'; setTimeout(function () { el.remove(); }, 950);
  }
  function burst(chars, n) { for (var i = 0; i < n; i++) spawn(chars[i % chars.length], { }); }
  function startParticles(kind) {
    if (reducedNow()) return;
    if (kind === 'star') burst(['⭐', '✨', '🌟'], 5);
    else if (kind === 'confetti') burst(['🎉', '🎊', '🟥', '🟨', '🟦'], 9);
    else if (kind === 'excl') spawn('❗', { color: '#E94560' });
    else if (kind === 'quest') spawn('❓', { color: '#0FA6AE' });
    else if (kind === 'steam') { spawn('💢', {}); spawn('💢', {}); }
    else if (kind === 'tear') spawn('💧', { color: '#4aa3ff' });
    else if (kind === 'sweat') spawn('💦', {});
    else if (kind === 'zzz') { var z = function () { spawn('💤', {}); }; z(); pTimer = setInterval(z, 900); }
    else if (kind === 'spark') { var s = function () { spawn('✨', { color: '#FFD700' }); }; s(); pTimer = setInterval(s, 700); }
  }
  function xpText(str) { if (built && !reducedNow()) spawn(str, { color: '#F4A400', size: '13px', left: '28%' }); }

  var sayT = null;
  function say(txt, ms) { if (!built) return; bubble.textContent = txt; bubble.classList.add('show'); clearTimeout(sayT); sayT = setTimeout(function () { bubble.classList.remove('show'); }, ms || 1500); }

  var clickTimes = [], delCount = 0, delT = null;
  function wireEvents() {
    window.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      hasMouse = true;
      var wasNapping = napped || cur === 'sleepy';
      curPointer.x = e.clientX; curPointer.y = e.clientY; curPointer.t = now();
      if (wasNapping) { napped = false; restMs = 0; emote('surprised'); }
    }, { passive: true });
    window.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'touch') return;
      curPointer.x = e.clientX; curPointer.y = e.clientY; curPointer.t = now();
      if (e.clientX >= px && e.clientX <= px + MW && e.clientY >= py && e.clientY <= py + MH) {
        var under = (document.elementsFromPoint ? document.elementsFromPoint(e.clientX, e.clientY) : []);
        var interactive = under.some(function (el) { return el.closest && el.closest('button,a,input,select,textarea,label,.chip,.tab'); });
        if (!interactive) onClick();
      }
    }, { passive: true });
    mascot.addEventListener('click', onClick);
    document.addEventListener('focusin', function (e) { if (e.target.matches && e.target.matches('input,textarea')) persistEmo('focused'); });
    document.addEventListener('focusout', function (e) { if (e.target.matches && e.target.matches('input,textarea')) { if (cur === 'focused') persistEmo(superLocked ? 'super' : 'idle'); } });
    document.addEventListener('input', function (e) {
      if (!e.target.matches || !e.target.matches('input,textarea')) return;
      if (e.inputType === 'deleteContentBackward') { delCount++; clearTimeout(delT); delT = setTimeout(function () { delCount = 0; }, 800); if (delCount >= 6) { delCount = 0; emote('scared'); } }
    });
    window.addEventListener('resize', function () { px = clamp(px, 8, innerWidth - MW - 8); py = clamp(py, 74, innerHeight - MH - 10); place(); });
  }
  function onClick() {
    var t = now(); clickTimes.push(t); clickTimes = clickTimes.filter(function (x) { return t - x < 1600; });
    restMs = 0; napped = false;
    if (clickTimes.length >= 5) { emote('angry'); say('hey!', 1400); return; }
    emote('surprised'); setTimeout(function () { emote('happy'); xpText('+1 XP'); }, 380);
  }

  /* ---- public API ---- */
  function react(name) { if (built && EMO[name]) emote(name); }
  function superMode() { if (!superLocked) { superLocked = true; persistEmo('super'); say('SUPER!', 1800); } }

  function boot() { try { build(); } catch (e) { /* never let Shroomy break the app */ } }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 300);

  return { react: react, say: say, xp: xpText, superMode: superMode,
    happy: function () { react('happy'); }, sad: function () { react('sad'); },
    confused: function () { react('confused'); }, celebrate: function () { react('celebratory'); } };
})();
