/* 94nesha Putting Challenge — 3 holes, fewest strokes wins.
   Shared leaderboard: DATA.leaderboard = Google Apps Script web-app URL (see leaderboard/Code.gs). */
(() => {
  const cv = document.getElementById('pg');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const W = 360, H = 540, BR = 7, CR = 10, MAXP = 17, CAP = 8;
  const GREEN = {x: 16, y: 16, w: 328, h: 508};
  const LB = (typeof DATA !== 'undefined' && DATA.leaderboard) || '';
  const tt = (id, en) => (document.documentElement.dataset.lang === 'en' ? en : id);
  const el = id => document.getElementById(id);

  // Courses: walls (rect), sand (circle), water (rect)
  const HOLES = [
    {par: 2, tee: [180, 470], cup: [180, 96],
      walls: [[110, 250, 60, 14], [190, 250, 60, 14]],
      sand: [[262, 160, 40], [92, 380, 34]], water: []},
    {par: 3, tee: [70, 470], cup: [286, 92],
      walls: [[16, 262, 236, 16], [200, 120, 14, 90]],
      sand: [[110, 140, 38]], water: [[260, 330, 84, 70]]},
    {par: 3, tee: [180, 482], cup: [180, 100],
      walls: [[130, 150, 14, 64], [216, 150, 14, 64]],
      sand: [[60, 120, 30], [300, 120, 30]], water: [[96, 250, 168, 96]]}
  ];
  const PAR = HOLES.reduce((a, h) => a + h.par, 0);

  let hi = 0, strokes = 0, cards = [], ball, last, aim = null, state = 'intro', t0 = 0, msg = '', msgT = 0, sunk = 0;

  // ---------- sizing ----------
  function fit() {
    const r = window.devicePixelRatio || 1;
    const w = cv.clientWidth || W;
    cv.width = Math.round(w * r); cv.height = Math.round(w * H / W * r);
    ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
  }
  window.addEventListener('resize', fit);

  // ---------- game flow ----------
  function startRound() {
    hi = 0; cards = []; t0 = performance.now(); state = 'play';
    startHole(); show(null);
  }
  function startHole() {
    const h = HOLES[hi];
    strokes = 0; sunk = 0;
    ball = {x: h.tee[0], y: h.tee[1], vx: 0, vy: 0};
    last = {x: ball.x, y: ball.y};
    flash(tt('Hole ' + (hi + 1) + ' · Par ' + h.par, 'Hole ' + (hi + 1) + ' · Par ' + h.par));
    hud();
  }
  function finishHole(score) {
    cards.push(score);
    const d = score - HOLES[hi].par;
    const word = score === 1 ? 'HOLE IN ONE!' : d <= -1 ? 'Birdie!' : d === 0 ? 'Par' : d === 1 ? 'Bogey' : '+' + d;
    flash(word);
    setTimeout(() => {
      hi++;
      if (hi < HOLES.length) startHole();
      else endRound();
    }, 1100);
  }
  function endRound() {
    state = 'done';
    const total = cards.reduce((a, b) => a + b, 0), ms = Math.round(performance.now() - t0);
    lastRound = {strokes: total, holes: cards.slice(), ms};
    let best = null; try { best = +localStorage.getItem('94putt-best') || null; } catch (e) {}
    if (!best || total < best) { best = total; try { localStorage.setItem('94putt-best', total); } catch (e) {} }
    el('g-total').textContent = total;
    el('g-card').textContent = cards.map((s, i) => 'H' + (i + 1) + ': ' + s).join(' · ') + ' (par ' + PAR + ')';
    el('g-best').textContent = best;
    el('g-sent').textContent = '';
    el('g-submit').disabled = !LB;
    show('g-end');
    hud();
  }
  let lastRound = null;
  function show(id) {
    ['g-intro', 'g-end'].forEach(x => { el(x).hidden = x !== id; });
  }
  function hud() {
    const total = cards.reduce((a, b) => a + b, 0);
    el('g-hud').textContent = state === 'play'
      ? tt(`Hole ${hi + 1}/3 · Par ${HOLES[hi].par} · Pukulan ${strokes} · Total ${total + strokes}`,
           `Hole ${hi + 1}/3 · Par ${HOLES[hi].par} · Strokes ${strokes} · Total ${total + strokes}`)
      : tt(`3 hole · par ${PAR}`, `3 holes · par ${PAR}`);
  }
  function flash(s) { msg = s; msgT = 70; }

  // ---------- input ----------
  const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
  const moving = () => Math.hypot(ball.vx, ball.vy) > 0;
  cv.addEventListener('pointerdown', e => {
    if (state !== 'play' || moving() || sunk) return;
    cv.setPointerCapture(e.pointerId);
    const [x, y] = pos(e); aim = {sx: x, sy: y, x, y};
  });
  cv.addEventListener('pointermove', e => { if (aim) { const [x, y] = pos(e); aim.x = x; aim.y = y; } });
  const release = () => {
    if (!aim) return;
    const p = power(); aim = null;
    if (p.m < 0.6) return;
    last = {x: ball.x, y: ball.y};
    ball.vx = p.dx; ball.vy = p.dy; strokes++; hud();
  };
  cv.addEventListener('pointerup', release);
  cv.addEventListener('pointercancel', () => { aim = null; });
  function power() {
    let dx = (aim.sx - aim.x) * 0.16, dy = (aim.sy - aim.y) * 0.16;
    let m = Math.hypot(dx, dy);
    if (m > MAXP) { dx *= MAXP / m; dy *= MAXP / m; m = MAXP; }
    return {dx, dy, m};
  }

  // ---------- physics ----------
  const inRect = (x, y, r) => x > r[0] && x < r[0] + r[2] && y > r[1] && y < r[1] + r[3];
  function collideRect(r) {
    const cx = Math.max(r[0], Math.min(ball.x, r[0] + r[2])), cy = Math.max(r[1], Math.min(ball.y, r[1] + r[3]));
    let dx = ball.x - cx, dy = ball.y - cy; const d = Math.hypot(dx, dy);
    if (d >= BR) return;
    if (d === 0) { dx = 0; dy = -1; } else { dx /= d; dy /= d; }
    ball.x = cx + dx * BR; ball.y = cy + dy * BR;
    const vn = ball.vx * dx + ball.vy * dy;
    if (vn < 0) { ball.vx -= 1.7 * vn * dx; ball.vy -= 1.7 * vn * dy; }
  }
  function step() {
    const h = HOLES[hi];
    let sp = Math.hypot(ball.vx, ball.vy);
    if (!sp || sunk) return;
    const n = Math.ceil(sp / 3);
    for (let i = 0; i < n; i++) {
      ball.x += ball.vx / n; ball.y += ball.vy / n;
      // green edges
      if (ball.x < GREEN.x + BR) { ball.x = GREEN.x + BR; ball.vx = Math.abs(ball.vx) * 0.7; }
      if (ball.x > GREEN.x + GREEN.w - BR) { ball.x = GREEN.x + GREEN.w - BR; ball.vx = -Math.abs(ball.vx) * 0.7; }
      if (ball.y < GREEN.y + BR) { ball.y = GREEN.y + BR; ball.vy = Math.abs(ball.vy) * 0.7; }
      if (ball.y > GREEN.y + GREEN.h - BR) { ball.y = GREEN.y + GREEN.h - BR; ball.vy = -Math.abs(ball.vy) * 0.7; }
      h.walls.forEach(collideRect);
      // water: penalty stroke, back to previous spot
      if (h.water.some(r => inRect(ball.x, ball.y, r))) {
        strokes++; ball.x = last.x; ball.y = last.y; ball.vx = ball.vy = 0;
        flash(tt('Air! +1 pukulan', 'Water! +1 stroke')); hud(); checkCap(); return;
      }
      // cup
      const cd = Math.hypot(ball.x - h.cup[0], ball.y - h.cup[1]);
      sp = Math.hypot(ball.vx, ball.vy);
      if (cd < CR - 2 && sp < 7.5) { sunk = 1; ball.x = h.cup[0]; ball.y = h.cup[1]; ball.vx = ball.vy = 0; finishHole(strokes); return; }
      if (cd < CR && sp >= 7.5) { ball.vx *= 0.92; ball.vy *= 0.92; }
    }
    const h2 = HOLES[hi];
    const cd = Math.hypot(ball.x - h2.cup[0], ball.y - h2.cup[1]);
    if (cd < 22 && sp < 3.2) { ball.vx += (h2.cup[0] - ball.x) * 0.012; ball.vy += (h2.cup[1] - ball.y) * 0.012; }
    const sand = h2.sand.some(([x, y, r]) => Math.hypot(ball.x - x, ball.y - y) < r);
    const f = sand ? 0.9 : 0.982;
    ball.vx *= f; ball.vy *= f;
    if (Math.hypot(ball.vx, ball.vy) < 0.08) {
      ball.vx = ball.vy = 0; checkCap();
    }
  }

  function checkCap() {
    if (strokes >= CAP && !sunk) { sunk = 1; flash(tt('Maks. ' + CAP + ' pukulan', 'Max ' + CAP + ' strokes')); finishHole(CAP + 1); }
  }

  // ---------- drawing ----------
  function draw() {
    const h = HOLES[hi] || HOLES[0];
    ctx.fillStyle = '#2f6b45'; ctx.fillRect(0, 0, W, H);
    ctx.save(); rr(GREEN.x, GREEN.y, GREEN.w, GREEN.h, 18); ctx.clip();
    for (let i = 0; i < 12; i++) { ctx.fillStyle = i % 2 ? '#4f9a63' : '#56a36a'; ctx.fillRect(GREEN.x, GREEN.y + i * 44, GREEN.w, 44); }
    ctx.restore();
    h.water.forEach(([x, y, w, hh]) => {
      ctx.fillStyle = '#2f73c6'; rr(x, y, w, hh, 14); ctx.fill();
      ctx.strokeStyle = '#ffffff55'; ctx.lineWidth = 2;
      for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(x + w * (0.25 + k * 0.25), y + hh / 2 + (k % 2 ? 10 : -10), 9, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
    });
    h.sand.forEach(([x, y, r]) => { ctx.fillStyle = '#e8d7a5'; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.8, 0, 0, 7); ctx.fill(); });
    h.walls.forEach(([x, y, w, hh]) => { ctx.fillStyle = '#001b42'; rr(x, y, w, hh, 4); ctx.fill(); ctx.fillStyle = '#d5ab63'; ctx.fillRect(x + 2, y + 2, w - 4, 2); });
    // tee marker
    ctx.fillStyle = '#ffffff44'; ctx.beginPath(); ctx.arc(h.tee[0], h.tee[1], 14, 0, 7); ctx.fill();
    // cup + flag
    ctx.fillStyle = '#0b1a10'; ctx.beginPath(); ctx.arc(h.cup[0], h.cup[1], CR, 0, 7); ctx.fill();
    if (!sunk || state !== 'play') {
      ctx.strokeStyle = '#fefdfb'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(h.cup[0], h.cup[1]); ctx.lineTo(h.cup[0], h.cup[1] - 52); ctx.stroke();
      ctx.fillStyle = '#d5ab63'; ctx.beginPath(); ctx.moveTo(h.cup[0], h.cup[1] - 52); ctx.lineTo(h.cup[0] + 26, h.cup[1] - 44); ctx.lineTo(h.cup[0], h.cup[1] - 36); ctx.fill();
      ctx.fillStyle = '#001b42'; ctx.font = '800 12px "Barlow Condensed",sans-serif'; ctx.fillText(String(Math.min(hi, 2) + 1), h.cup[0] + 5, h.cup[1] - 40);
    }
    if (ball && !(sunk && state === 'play')) {
      if (aim) {
        const p = power(), k = p.m / MAXP;
        ctx.strokeStyle = k > 0.85 ? '#ff6b5a' : '#d5ab63'; ctx.lineWidth = 3; ctx.setLineDash([6, 6]);
        ctx.beginPath(); ctx.moveTo(ball.x, ball.y); ctx.lineTo(ball.x + p.dx * 7, ball.y + p.dy * 7); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#00132fcc'; rr(12, H - 30, 120, 14, 7); ctx.fill();
        ctx.fillStyle = k > 0.85 ? '#ff6b5a' : '#d5ab63'; rr(14, H - 28, 116 * k, 10, 5); ctx.fill();
      }
      ctx.fillStyle = '#00000040'; ctx.beginPath(); ctx.ellipse(ball.x + 2, ball.y + 3, BR, BR * 0.7, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(ball.x, ball.y, BR, 0, 7); ctx.fill();
      ctx.strokeStyle = '#c5cedc'; ctx.lineWidth = 1; ctx.stroke();
    }
    if (msgT > 0) {
      ctx.globalAlpha = Math.min(1, msgT / 20);
      ctx.fillStyle = '#00132fd9'; rr(W / 2 - 120, H / 2 - 30, 240, 60, 14); ctx.fill();
      ctx.fillStyle = '#d5ab63'; ctx.font = '800 30px "Barlow Condensed",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(msg, W / 2, H / 2 + 1); ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic'; ctx.globalAlpha = 1;
      msgT--;
    }
  }
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }

  let acc = 0, prev = performance.now();
  function loop(now) {
    acc += Math.min(100, now - prev); prev = now;
    while (acc >= 1000 / 60) { if (state === 'play' && ball) step(); acc -= 1000 / 60; }
    draw();
    requestAnimationFrame(loop);
  }

  // ---------- leaderboard ----------
  function renderLB(rows) {
    const box = el('lb');
    if (!LB) { box.innerHTML = `<p class="note">${tt('Leaderboard bersama segera aktif. Skor terbaik Anda tetap tersimpan di perangkat ini.', 'The shared leaderboard is coming soon. Your best score is saved on this device.')}</p>`; return; }
    if (!rows) { box.innerHTML = `<p class="note">${tt('Memuat…', 'Loading…')}</p>`; return; }
    if (!rows.length) { box.innerHTML = `<p class="note">${tt('Belum ada skor. Jadilah yang pertama!', 'No scores yet. Be the first!')}</p>`; return; }
    box.innerHTML = '<ol class="lbl">' + rows.slice(0, 10).map(r => `<li><span>${esc(r.name)}</span><b>${r.strokes}</b></li>`).join('') + '</ol>';
  }
  let lbRows = null;
  async function loadLB() {
    if (!LB) return renderLB();
    try { const r = await fetch(LB + '?action=top', {cache: 'no-store'}); const j = await r.json(); lbRows = j.top || []; }
    catch (e) { lbRows = lbRows || []; }
    renderLB(lbRows);
  }
  async function submit() {
    const name = el('g-name').value.trim().slice(0, 24);
    if (!name) { el('g-name').focus(); el('g-sent').textContent = tt('Isi nama dulu.', 'Enter your name first.'); return; }
    if (!lastRound || !LB) return;
    try { localStorage.setItem('94putt-name', name); } catch (e) {}
    el('g-submit').disabled = true; el('g-sent').textContent = tt('Mengirim…', 'Sending…');
    try {
      const r = await fetch(LB, {method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'}, body: JSON.stringify({name, ...lastRound})});
      const j = await r.json();
      if (!j.ok) { el('g-submit').disabled = false; el('g-sent').textContent = j.error === 'wait' ? tt('Tunggu 20 detik lalu kirim lagi.', 'Wait 20 seconds, then send again.') : tt('Skor tidak valid.', 'Score not accepted.'); return; }
      lbRows = j.top || lbRows; renderLB(lbRows);
      el('g-sent').textContent = tt('Skor masuk leaderboard!', 'Score posted!');
      lastRound = null;
    } catch (e) {
      el('g-submit').disabled = false;
      el('g-sent').textContent = tt('Gagal mengirim. Coba lagi.', 'Could not send. Try again.');
    }
  }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

  // ---------- wire up ----------
  el('g-start').addEventListener('click', startRound);
  el('g-again').addEventListener('click', startRound);
  el('g-submit').addEventListener('click', submit);
  el('g-refresh').addEventListener('click', loadLB);
  try { el('g-name').value = localStorage.getItem('94putt-name') || ''; } catch (e) {}
  document.querySelectorAll('#l-id,#l-en').forEach(b => b.addEventListener('click', () => { hud(); renderLB(lbRows); }));
  fit(); hud(); renderLB(); loadLB();
  setInterval(() => { if (!document.hidden && state !== 'play') loadLB(); }, 60000);
  requestAnimationFrame(loop);
  window.__putt = {get state() { return state; }, get ball() { return ball; }, get hole() { return hi; }, get strokes() { return strokes; }, get cards() { return cards; }, HOLES};
})();
