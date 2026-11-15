// Bumper Buddies Pinball — table, physics, scoring and drawing.
(() => {
  'use strict';

  // ---------------- constants ----------------
  const W = 480, H = 800;          // logical table size
  const R = 10;                    // ball radius
  const GRAVITY = 900;
  const SUBSTEPS = 10;
  const MAX_SPEED = 1900;
  const LANE_X = 440, LANE_Y = 751; // ball rest spot on the plunger
  const MIN_POWER = 760, MAX_POWER = 1650;
  const START_BALLS = 3;
  const SAVE_TIME = 8;             // seconds of ball-save after each new ball
  const FL_LEN = 72, FL_REST = 0.45, FL_UP = -0.5, FL_R0 = 11, FL_R1 = 6;

  const $ = id => document.getElementById(id);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rand = (a, b) => a + Math.random() * (b - a);

  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const bg = document.createElement('canvas');
  const bgx = bg.getContext('2d');
  let scale = 1, dpr = 1;

  // ---------------- table geometry ----------------
  const walls = [];
  const slings = [];

  function seg(ax, ay, bx, by, o) {
    const s = Object.assign({ ax, ay, bx, by, e: 0.4, kick: 0, kind: 'wall', glow: 0, cool: 0 }, o);
    walls.push(s);
    return s;
  }
  function sling(ax, ay, bx, by, cx, cy) {
    seg(ax, ay, bx, by, { kind: 'slingside' });
    seg(bx, by, cx, cy, { kind: 'slingside' });
    const s = seg(ax, ay, cx, cy, { kind: 'sling', e: 0.5, kick: 620 });
    s.tri = [ax, ay, bx, by, cx, cy];
    slings.push(s);
  }

  (function buildTable() {
    const N = 40;
    for (let i = 0; i < N; i++) {
      const t0 = Math.PI + (Math.PI * i) / N, t1 = Math.PI + (Math.PI * (i + 1)) / N;
      seg(240 + 220 * Math.cos(t0), 240 + 220 * Math.sin(t0),
          240 + 220 * Math.cos(t1), 240 + 220 * Math.sin(t1), { e: 0.3, kind: 'rail' });
    }
    seg(20, 240, 20, 620);                         // left wall
    seg(460, 240, 460, 800);                       // outer right wall
    seg(420, 185, 420, 800, { kind: 'lane' });     // plunger lane wall
    seg(420, 762, 460, 762, { e: 0.1, kind: 'floor' });
    seg(20, 620, 135, 700, { e: 0.3 });            // left inlane guide
    seg(420, 620, 305, 700, { e: 0.3 });           // right inlane guide
    sling(60, 505, 60, 595, 112, 632);
    sling(380, 505, 380, 595, 328, 632);
  })();

  const bumpers = [
    { x: 150, y: 205, r: 26, pts: 100, hue: 330 },
    { x: 290, y: 205, r: 26, pts: 100, hue: 190 },
    { x: 220, y: 292, r: 28, pts: 150, hue: 48 },
  ].map(b => Object.assign(b, { glow: 0, cool: 0 }));

  const VALUES = [
    { v: 10, c: '#7CFF6B' },
    { v: 25, c: '#4FD8FF' },
    { v: 50, c: '#FFB547' },
    { v: 100, c: '#FF5FD2' },
  ];
  const markers = [];
  [[385, [70, 130, 190, 250, 310, 370]],
   [435, [100, 160, 220, 280, 340]],
   [485, [70, 130, 190, 250, 310, 370]]].forEach(([y, xs]) => {
    xs.forEach(x => markers.push({ x, y, r: 12, value: 10, color: VALUES[0].c, lit: false, glow: 0, ring: 0, cool: 0 }));
  });

  const rollovers = [
    { x: 150, y: 118 }, { x: 220, y: 98 }, { x: 290, y: 118 },
  ].map(r => Object.assign(r, { r: 14, lit: false, inside: false, glow: 0 }));

  function makeFlipper(px, py, s) { return { px, py, s, a: FL_REST, w: 0, pressed: false }; }
  const flippers = [makeFlipper(135, 700, 1), makeFlipper(305, 700, -1)];

  // ---------------- game state ----------------
  const ball = { x: LANE_X, y: LANE_Y, vx: 0, vy: 0, trail: [] };
  let state = 'menu';            // menu | launch | play | drain | over | paused
  let pausedFrom = null;
  let alias = '';
  let score = 0, balls = START_BALLS, mult = 1;
  let saveTimer = 0, ballFresh = true;
  let charging = false, power = 0, powerDir = 1;
  let stuckTimer = 0, drainTimer = 0;
  let combo = 0, comboTimer = 0;
  let shake = 0, time = 0;
  const stats = { markers: 0, bumpers: 0, supers: 0 };
  const particles = [], popups = [], messages = [];
  const stars = Array.from({ length: 45 }, () => ({ x: rand(25, 415), y: rand(40, 780), p: rand(0, 6.3), s: rand(0.6, 1.8) }));

  // ---------------- storage ----------------
  function store(k, v) { try { localStorage.setItem('bb.' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  function fetchStore(k, d) {
    try { const v = localStorage.getItem('bb.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; }
  }
  const loadScores = () => { const s = fetchStore('scores', []); return Array.isArray(s) ? s : []; };
  function addScore(name, pts) {
    const list = loadScores();
    const entry = { name, score: pts, at: Date.now() };
    list.push(entry);
    list.sort((a, b) => b.score - a.score);
    const top = list.slice(0, 10);
    store('scores', top);
    return top.indexOf(entry);
  }

  // ---------------- helpers ----------------
  function shuffleMarkers() {
    for (const m of markers) {
      const r = Math.random();
      const k = r < 0.4 ? 0 : r < 0.7 ? 1 : r < 0.9 ? 2 : 3;
      m.value = VALUES[k].v; m.color = VALUES[k].c; m.lit = false;
    }
  }

  function award(pts, x, y, color) {
    const p = pts * mult;
    score += p;
    popups.push({ x, y, text: '+' + p, color: color || '#fff', life: 1 });
    updateHud();
  }

  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), s = rand(60, 260);
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.4, 0.9), color, size: rand(1.5, 3.5) });
    }
  }

  function say(text, color, big) {
    messages.length = 0;
    messages.push({ text, color: color || '#fff', life: 1.8, max: 1.8, big: !!big });
  }

  function bumpCombo() {
    combo = comboTimer > 0 ? combo + 1 : 0;
    comboTimer = 1.3;
    return combo;
  }

  function toLane() {
    ball.x = LANE_X; ball.y = LANE_Y; ball.vx = 0; ball.vy = 0; ball.trail.length = 0;
    state = 'launch';
    charging = false; power = 0;
  }

  // ---------------- collisions ----------------
  function collideSeg(s) {
    const dx = s.bx - s.ax, dy = s.by - s.ay, L2 = dx * dx + dy * dy;
    const t = clamp(((ball.x - s.ax) * dx + (ball.y - s.ay) * dy) / L2, 0, 1);
    const px = s.ax + dx * t, py = s.ay + dy * t;
    let nx = ball.x - px, ny = ball.y - py;
    const d = Math.hypot(nx, ny);
    if (d >= R || d < 1e-6) return;
    nx /= d; ny /= d;
    ball.x = px + nx * R; ball.y = py + ny * R;
    const vn = ball.vx * nx + ball.vy * ny;
    if (vn >= 0) return;
    let nv = -vn * s.e;
    if (s.kick && -vn > 60 && s.cool <= 0) {
      nv = Math.max(nv, s.kick);
      s.cool = 0.15; s.glow = 1;
      Sound.sling();
      award(10, ball.x, ball.y - 10, '#FFE45C');
      burst(ball.x, ball.y, '#FFE45C', 8);
    } else if (-vn > 350) {
      Sound.thud(-vn);
    }
    ball.vx += (nv - vn) * nx; ball.vy += (nv - vn) * ny;
  }

  function collideCircle(o, e, kick) {
    const dx = ball.x - o.x, dy = ball.y - o.y, d = Math.hypot(dx, dy), minD = R + o.r;
    if (d >= minD || d < 1e-6) return 0;
    const nx = dx / d, ny = dy / d;
    ball.x = o.x + nx * minD; ball.y = o.y + ny * minD;
    const vn = ball.vx * nx + ball.vy * ny;
    if (vn >= 0) return 0;
    const nv = Math.max(-vn * e, kick);
    ball.vx += (nv - vn) * nx; ball.vy += (nv - vn) * ny;
    return -vn + 1;
  }

  function flipperTip(f) { return [f.px + f.s * FL_LEN * Math.cos(f.a), f.py + FL_LEN * Math.sin(f.a)]; }

  function collideFlipper(f) {
    const [tx, ty] = flipperTip(f);
    const dx = tx - f.px, dy = ty - f.py, L2 = dx * dx + dy * dy;
    const t = clamp(((ball.x - f.px) * dx + (ball.y - f.py) * dy) / L2, 0, 1);
    const cx = f.px + dx * t, cy = f.py + dy * t;
    let nx = ball.x - cx, ny = ball.y - cy;
    const d = Math.hypot(nx, ny), minD = R + FL_R0 + (FL_R1 - FL_R0) * t;
    if (d >= minD || d < 1e-6) return;
    nx /= d; ny /= d;
    ball.x = cx + nx * minD; ball.y = cy + ny * minD;
    // velocity of the flipper surface at the contact point
    const along = t * FL_LEN;
    const vcx = along * f.w * (-f.s * Math.sin(f.a)), vcy = along * f.w * Math.cos(f.a);
    const rvx = ball.vx - vcx, rvy = ball.vy - vcy, vn = rvx * nx + rvy * ny;
    if (vn < 0) {
      const j = -(1 + 0.3) * vn;
      ball.vx += j * nx; ball.vy += j * ny;
    }
  }

  function hitBumper(b) {
    b.cool = 0.1; b.glow = 1;
    stats.bumpers++;
    bumpCombo();
    Sound.bumper();
    award(b.pts, b.x, b.y - b.r - 6, `hsl(${b.hue},100%,70%)`);
    burst(b.x, b.y, `hsl(${b.hue},100%,70%)`, 14);
    shake = Math.max(shake, 0.5);
  }

  function hitMarker(m) {
    m.cool = 0.15; m.glow = 1; m.ring = 1;
    stats.markers++;
    Sound.marker(bumpCombo());
    award(m.value, m.x, m.y - 16, m.color);
    burst(m.x, m.y, m.color, 10);
    if (!m.lit) {
      m.lit = true;
      if (markers.every(k => k.lit)) superBonus();
    }
  }

  function superBonus() {
    stats.supers++;
    Sound.bonus();
    award(1000, 220, 440, '#FFE45C');
    say('SUPER STAR BONUS!', '#FFE45C', true);
    markers.forEach(m => { m.glow = 1; m.ring = 1; burst(m.x, m.y, m.color, 6); });
    shake = 1;
    setTimeout(shuffleMarkers, 900);
  }

  function checkRollovers() {
    for (const r of rollovers) {
      const inside = Math.hypot(ball.x - r.x, ball.y - r.y) < r.r + R * 0.5;
      if (inside && !r.inside && !r.lit) {
        r.lit = true; r.glow = 1;
        Sound.rollover();
        award(50, r.x, r.y - 18, '#FFE45C');
        if (rollovers.every(k => k.lit)) {
          mult = Math.min(mult + 1, 5);
          Sound.multiplier(mult);
          say(`x${mult} MULTIPLIER!`, '#7CFF6B', true);
          setTimeout(() => rollovers.forEach(k => { k.lit = false; k.glow = 1; }), 600);
          updateHud();
        }
      }
      r.inside = inside;
    }
  }

  // ---------------- simulation ----------------
  function updateFlipper(f, dt) {
    const target = f.pressed ? FL_UP : FL_REST;
    const sp = f.pressed ? 30 : 16;
    const d = clamp(target - f.a, -sp * dt, sp * dt);
    f.a += d;
    f.w = d / dt;
  }

  function physics(dt) {
    for (const f of flippers) updateFlipper(f, dt);
    if (state !== 'play') return;

    ball.vy += GRAVITY * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    for (const s of walls) collideSeg(s);
    for (const b of bumpers) if (collideCircle(b, 0.9, 560) && b.cool <= 0) hitBumper(b);
    for (const m of markers) if (collideCircle(m, 0.65, 130) > 25 && m.cool <= 0) hitMarker(m);
    for (const f of flippers) collideFlipper(f);
    checkRollovers();

    const sp = Math.hypot(ball.vx, ball.vy);
    if (sp > MAX_SPEED) { ball.vx *= MAX_SPEED / sp; ball.vy *= MAX_SPEED / sp; }

    // rolled back down the plunger lane: launch again, free
    if (ball.x > 420 && ball.y > LANE_Y - 6 && Math.abs(ball.vy) < 60) toLane();
    else if (ball.y > H + R * 2) onDrain();
  }

  function onDrain() {
    if (saveTimer > 0) {
      saveTimer = 0; ballFresh = false;
      Sound.save();
      say('BALL SAVED!', '#4FD8FF', true);
      toLane();
      return;
    }
    state = 'drain';
    drainTimer = 2.2;
    balls--;
    const lit = markers.filter(m => m.lit).length;
    const bonus = lit * 20;
    if (bonus) { score += bonus; popups.push({ x: 220, y: 640, text: `Star bonus +${bonus}`, color: '#FFE45C', life: 1.6 }); }
    Sound.drain();
    say(balls > 0 ? 'Oh no! Ball lost' : 'Last ball gone!', '#FF8AA8');
    updateHud();
  }

  function afterDrain() {
    if (balls <= 0) { gameOver(); return; }
    mult = 1;
    rollovers.forEach(r => { r.lit = false; });
    ballFresh = true;
    toLane();
    say(`Ball ${START_BALLS - balls + 1}  — ready!`, '#fff');
    updateHud();
  }

  function update(dt) {
    time += dt;

    if (state === 'launch') {
      if (charging) {
        power += powerDir * dt / 1.1;
        if (power >= 1) { power = 1; powerDir = -1; }
        if (power <= 0.05) { power = 0.05; powerDir = 1; }
        Sound.chargeUpdate(power);
      }
      ball.x = LANE_X;
      ball.y = LANE_Y + (charging ? power * 26 : 0);
    }

    const h = dt / SUBSTEPS;
    for (let i = 0; i < SUBSTEPS; i++) physics(h);

    if (state === 'play') {
      ball.trail.push(ball.x, ball.y);
      if (ball.trail.length > 16) ball.trail.splice(0, 2);
      if (Math.hypot(ball.vx, ball.vy) < 12) {
        stuckTimer += dt;
        if (stuckTimer > 2) {
          ball.vx = rand(-250, 250); ball.vy = -450; stuckTimer = 0;
          say('Boing! Unstuck!', '#fff');
        }
      } else stuckTimer = 0;
      if (saveTimer > 0) saveTimer -= dt;
    } else if (state === 'drain') {
      drainTimer -= dt;
      if (drainTimer <= 0) afterDrain();
    } else if (state === 'menu') {
      // attract mode: a wave of lights across the table
      markers.forEach((m, i) => { m.lit = Math.sin(time * 3 - i * 0.6) > 0.4; });
      rollovers.forEach((r, i) => { r.lit = Math.sin(time * 4 - i) > 0; });
      if (Math.random() < dt * 1.5) bumpers[Math.floor(Math.random() * 3)].glow = 1;
    }

    if (comboTimer > 0) comboTimer -= dt;
    shake = Math.max(0, shake - dt * 3);
    const fade = (o, rate) => { if (o.glow > 0) o.glow = Math.max(0, o.glow - dt * rate); };
    bumpers.forEach(b => { fade(b, 3); b.cool -= dt; });
    markers.forEach(m => { fade(m, 2.5); m.cool -= dt; if (m.ring > 0) m.ring = Math.max(0, m.ring - dt * 2.2); });
    rollovers.forEach(r => fade(r, 2));
    slings.forEach(s => { fade(s, 5); s.cool -= dt; });

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; p.vx *= 0.98;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = popups.length - 1; i >= 0; i--) {
      const p = popups[i];
      p.life -= dt * 0.9; p.y -= 40 * dt;
      if (p.life <= 0) popups.splice(i, 1);
    }
    for (let i = messages.length - 1; i >= 0; i--) {
      messages[i].life -= dt;
      if (messages[i].life <= 0) messages.splice(i, 1);
    }
  }

  // ---------------- controls ----------------
  function setFlipper(i, down) {
    if (state !== 'play' && state !== 'launch' && state !== 'drain') return;
    const f = flippers[i];
    if (down && !f.pressed) Sound.flipper();
    f.pressed = down;
  }

  function startCharge() {
    if (state !== 'launch' || charging) return;
    charging = true; power = 0.05; powerDir = 1;
    Sound.chargeStart();
  }

  function releaseCharge() {
    if (!charging) return;
    charging = false;
    Sound.chargeStop();
    if (state !== 'launch') return;
    ball.x = LANE_X; ball.y = LANE_Y; ball.vx = 0;
    ball.vy = -(MIN_POWER + power * (MAX_POWER - MIN_POWER));
    Sound.launch(power);
    if (ballFresh) { saveTimer = SAVE_TIME; ballFresh = false; }
    state = 'play';
    power = 0;
  }

  const LEFT_KEYS = ['ArrowLeft', 'KeyZ', 'KeyA', 'ShiftLeft'];
  const RIGHT_KEYS = ['ArrowRight', 'Slash', 'KeyL', 'KeyM', 'ShiftRight'];
  const LAUNCH_KEYS = ['Space', 'ArrowDown', 'Enter', 'KeyS'];

  window.addEventListener('keydown', e => {
    if (e.target && e.target.tagName === 'INPUT') return;
    if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); e.preventDefault(); return; }
    if (state === 'paused') return;
    if (LEFT_KEYS.includes(e.code)) { setFlipper(0, true); e.preventDefault(); }
    else if (RIGHT_KEYS.includes(e.code)) { setFlipper(1, true); e.preventDefault(); }
    else if (LAUNCH_KEYS.includes(e.code)) { if (!e.repeat) startCharge(); e.preventDefault(); }
  });
  window.addEventListener('keyup', e => {
    if (LEFT_KEYS.includes(e.code)) setFlipper(0, false);
    else if (RIGHT_KEYS.includes(e.code)) setFlipper(1, false);
    else if (LAUNCH_KEYS.includes(e.code)) releaseCharge();
  });

  // touch / mouse: left half = left flipper, right half = right flipper; while the ball waits, hold anywhere to pull
  const pointers = new Map();
  canvas.addEventListener('pointerdown', e => {
    if (state === 'paused' || state === 'menu' || state === 'over') return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    if (state === 'launch') { pointers.set(e.pointerId, 'launch'); startCharge(); return; }
    const rect = canvas.getBoundingClientRect();
    const side = (e.clientX - rect.left) / rect.width < 0.46 ? 0 : 1;
    pointers.set(e.pointerId, side);
    setFlipper(side, true);
  });
  const pointerUp = e => {
    const what = pointers.get(e.pointerId);
    if (what === undefined) return;
    pointers.delete(e.pointerId);
    if (what === 'launch') releaseCharge();
    else if (![...pointers.values()].includes(what)) setFlipper(what, false);
  };
  canvas.addEventListener('pointerup', pointerUp);
  canvas.addEventListener('pointercancel', pointerUp);
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  // ---------------- screens & HUD ----------------
  const screens = { start: $('screen-start'), over: $('screen-over'), pause: $('screen-pause') };
  function show(name) {
    for (const k in screens) screens[k].classList.toggle('hidden', k !== name);
  }

  function updateHud() {
    $('hud-alias').textContent = alias || 'Player';
    $('hud-score').textContent = score.toLocaleString();
    $('hud-mult').textContent = 'x' + mult;
    $('hud-mult').classList.toggle('hot', mult > 1);
    const ballsEl = $('hud-balls');
    ballsEl.textContent = '';
    for (let i = 0; i < START_BALLS; i++) {
      const s = document.createElement('span');
      s.className = 'ball-pip' + (i < balls ? '' : ' used');
      ballsEl.appendChild(s);
    }
  }

  function renderScoreList(el, highlight) {
    const list = loadScores();
    el.textContent = '';
    if (!list.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'No scores yet. Be the first star!';
      el.appendChild(li);
      return;
    }
    list.forEach((s, i) => {
      const li = document.createElement('li');
      if (i === highlight) li.className = 'me';
      const n = document.createElement('span'); n.className = 'name'; n.textContent = `${i + 1}. ${s.name}`;
      const v = document.createElement('span'); v.className = 'pts'; v.textContent = s.score.toLocaleString();
      li.append(n, v);
      el.appendChild(li);
    });
  }

  const FUN_A = ['Rocket', 'Bouncy', 'Super', 'Zippy', 'Happy', 'Sparkle', 'Turbo', 'Jolly', 'Cosmic', 'Lucky'];
  const FUN_B = ['Panda', 'Tiger', 'Star', 'Comet', 'Bunny', 'Dino', 'Kitten', 'Robot', 'Puffin', 'Dragon'];
  const randomAlias = () => FUN_A[Math.floor(Math.random() * FUN_A.length)] + ' ' + FUN_B[Math.floor(Math.random() * FUN_B.length)];
  const cleanAlias = s => s.replace(/[^\p{L}\p{N} _\-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 14);

  function startGame() {
    const name = cleanAlias($('alias').value);
    if (!name) {
      $('alias').value = randomAlias();
      $('alias').focus();
      $('alias-hint').textContent = 'We picked a fun name for you. Change it or press Play!';
      return;
    }
    alias = name;
    store('alias', alias);
    try { Sound.init(); Sound.click(); Sound.startMusic(); } catch (e) { /* sound must never block play */ }
    score = 0; balls = START_BALLS; mult = 1;
    stats.markers = stats.bumpers = stats.supers = 0;
    particles.length = popups.length = messages.length = 0;
    shuffleMarkers();
    rollovers.forEach(r => { r.lit = false; });
    bumpers.forEach(b => { b.glow = 0; });
    ballFresh = true;
    toLane();
    show(null);
    say(`Go, ${alias}!`, '#FFE45C', true);
    updateHud();
    canvas.focus();
  }

  function gameOver() {
    state = 'over';
    flippers.forEach(f => { f.pressed = false; });
    Sound.gameOver();
    const best = loadScores()[0];
    const rank = addScore(alias, score);
    $('over-name').textContent = alias;
    $('over-score').textContent = score.toLocaleString();
    $('over-stats').textContent = `${stats.markers} stars hit · ${stats.bumpers} bumper boings · ${stats.supers} super bonus${stats.supers === 1 ? '' : 'es'}`;
    $('over-badge').classList.toggle('hidden', !(score > 0 && (!best || score > best.score)));
    renderScoreList($('over-scores'), rank);
    setTimeout(() => { if (state === 'over') show('over'); }, 1200);
  }

  function togglePause() {
    if (state === 'paused') {
      state = pausedFrom; pausedFrom = null;
      show(null);
      Sound.startMusic();
    } else if (state === 'play' || state === 'launch' || state === 'drain') {
      releaseCharge();
      pausedFrom = state; state = 'paused';
      flippers.forEach(f => { f.pressed = false; });
      show('pause');
      Sound.stopMusic();
    }
  }

  function toMenu() {
    state = 'menu';
    Sound.stopMusic();
    alias = '';
    updateHud();
    renderScoreList($('start-scores'));
    show('start');
  }

  $('btn-play').addEventListener('click', startGame);
  $('alias').addEventListener('keydown', e => { if (e.key === 'Enter') startGame(); });
  $('btn-dice').addEventListener('click', () => { $('alias').value = randomAlias(); Sound.init(); Sound.click(); });
  $('btn-again').addEventListener('click', () => { $('alias').value = alias; startGame(); });
  $('btn-rename').addEventListener('click', () => { $('alias').value = alias; toMenu(); $('alias').select(); });
  $('btn-resume').addEventListener('click', togglePause);
  $('btn-quit').addEventListener('click', () => { pausedFrom = null; toMenu(); });
  $('btn-pause').addEventListener('click', togglePause);
  $('btn-music').addEventListener('click', e => { Sound.init(); e.currentTarget.classList.toggle('off', !Sound.toggleMusic()); });
  $('btn-sfx').addEventListener('click', e => { Sound.init(); e.currentTarget.classList.toggle('off', !Sound.toggleSfx()); });
  $('btn-music').classList.toggle('off', !Sound.musicOn);
  $('btn-sfx').classList.toggle('off', !Sound.sfxOn);
  document.addEventListener('visibilitychange', () => { if (document.hidden && state !== 'paused') togglePause(); });

  // ---------------- drawing ----------------
  function resize() {
    const stage = $('stage');
    const sw = stage.clientWidth, sh = stage.clientHeight;
    scale = Math.max(0.1, Math.min(sw / W, sh / H)); // pane may be 0×0 while hidden
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = Math.floor(W * scale) + 'px';
    canvas.style.height = Math.floor(H * scale) + 'px';
    canvas.width = bg.width = Math.floor(W * scale * dpr);
    canvas.height = bg.height = Math.floor(H * scale * dpr);
    drawBackground();
  }

  function tablePath(g) {
    g.beginPath();
    g.moveTo(20, 800);
    g.lineTo(20, 240);
    g.arc(240, 240, 220, Math.PI, 0);
    g.lineTo(460, 800);
    g.closePath();
  }

  function drawBackground() {
    const g = bgx;
    g.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    g.fillStyle = '#12062e';
    g.fillRect(0, 0, W, H);

    g.save();
    tablePath(g);
    g.clip();
    const lg = g.createLinearGradient(0, 0, 0, H);
    lg.addColorStop(0, '#3b1c8f');
    lg.addColorStop(0.55, '#2a1470');
    lg.addColorStop(1, '#170a45');
    g.fillStyle = lg;
    g.fillRect(0, 0, W, H);

    // polka-dot pattern
    g.fillStyle = 'rgba(255,255,255,0.035)';
    for (let y = 30; y < H; y += 28) for (let x = 30 + ((y / 28) % 2) * 14; x < 420; x += 28) {
      g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill();
    }
    // soft rainbow behind the bumpers
    const rainbow = ['#ff5f6d', '#ffb547', '#ffe45c', '#7cff6b', '#4fd8ff', '#a77bff'];
    g.lineWidth = 10;
    rainbow.forEach((c, i) => {
      g.strokeStyle = c; g.globalAlpha = 0.13;
      g.beginPath(); g.arc(220, 330, 170 - i * 11, Math.PI, Math.PI * 2); g.stroke();
    });
    g.globalAlpha = 1;
    // logo in the open space above the flippers
    g.textAlign = 'center';
    g.font = '700 34px Fredoka, "Baloo 2", "Comic Sans MS", system-ui, sans-serif';
    g.fillStyle = 'rgba(255,255,255,0.07)';
    g.fillText('BUMPER', 220, 585);
    g.fillText('BUDDIES', 220, 620);
    // plunger lane
    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.fillRect(420, 185, 40, 615);
    g.fillStyle = 'rgba(255,228,92,0.25)';
    for (let y = 640; y > 300; y -= 46) {
      g.beginPath(); g.moveTo(440, y - 14); g.lineTo(452, y); g.lineTo(428, y); g.closePath(); g.fill();
    }
    // drain shadow
    const dg = g.createLinearGradient(0, 730, 0, 800);
    dg.addColorStop(0, 'rgba(0,0,0,0)'); dg.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.fillStyle = dg; g.fillRect(20, 730, 400, 70);
    g.restore();

    // sling bodies
    for (const s of slings) {
      const [ax, ay, bx, by, cx, cy] = s.tri;
      g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.lineTo(cx, cy); g.closePath();
      g.fillStyle = 'rgba(255,95,210,0.35)'; g.fill();
    }

    // neon rails
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.shadowColor = '#4fd8ff'; g.shadowBlur = 14;
    g.strokeStyle = '#8ff3ff'; g.lineWidth = 4;
    for (const s of walls) {
      if (s.kind === 'floor') continue;
      if (s.kind === 'sling' || s.kind === 'slingside') { g.strokeStyle = '#ff8fe0'; g.shadowColor = '#ff5fd2'; }
      else { g.strokeStyle = '#8ff3ff'; g.shadowColor = '#4fd8ff'; }
      g.beginPath(); g.moveTo(s.ax, s.ay); g.lineTo(s.bx, s.by); g.stroke();
    }
    g.shadowBlur = 0;

    // rollover star outlines
    for (const r of rollovers) drawStar(g, r.x, r.y, r.r, 'rgba(255,228,92,0.35)', null, 2);
  }

  function drawStar(g, x, y, r, stroke, fill, lw) {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath();
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 2; g.stroke(); }
  }

  const FONT = '"Fredoka", "Baloo 2", "Comic Sans MS", system-ui, sans-serif';

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!bg.width || !bg.height) return;
    ctx.drawImage(bg, 0, 0);
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    if (shake > 0) ctx.translate(rand(-1, 1) * shake * 5, rand(-1, 1) * shake * 5);

    // twinkling stars
    for (const s of stars) {
      const a = 0.25 + 0.25 * Math.sin(time * 2 * s.s + s.p);
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }

    // sling flash
    for (const s of slings) {
      if (s.glow <= 0) continue;
      ctx.save();
      ctx.globalAlpha = s.glow;
      ctx.shadowColor = '#FFE45C'; ctx.shadowBlur = 25;
      ctx.strokeStyle = '#FFE45C'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(s.ax, s.ay); ctx.lineTo(s.bx, s.by); ctx.stroke();
      ctx.restore();
    }

    // rollover stars
    for (const r of rollovers) {
      if (!r.lit && r.glow <= 0) continue;
      ctx.save();
      ctx.shadowColor = '#FFE45C'; ctx.shadowBlur = 16 + r.glow * 20;
      drawStar(ctx, r.x, r.y, r.r * (1 + r.glow * 0.4), '#fff', r.lit ? '#FFE45C' : `rgba(255,228,92,${r.glow})`, 1.5);
      ctx.restore();
    }

    // point markers
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const m of markers) {
      const s = 1 + m.glow * 0.35;
      ctx.save();
      ctx.translate(m.x, m.y); ctx.scale(s, s);
      if (m.lit || m.glow > 0) { ctx.shadowColor = m.color; ctx.shadowBlur = 14 + m.glow * 26; }
      ctx.beginPath(); ctx.arc(0, 0, m.r, 0, Math.PI * 2);
      ctx.fillStyle = m.lit ? m.color : 'rgba(255,255,255,0.08)';
      ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = m.color; ctx.stroke();
      ctx.shadowBlur = 0;
      if (m.glow > 0) {
        ctx.fillStyle = `rgba(255,255,255,${m.glow * 0.8})`;
        ctx.beginPath(); ctx.arc(0, 0, m.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = m.lit ? '#2a0a4a' : m.color;
      ctx.font = `700 ${m.value >= 100 ? 10 : 11}px ${FONT}`;
      ctx.fillText(m.value, 0, 1);
      ctx.restore();
      if (m.ring > 0) {
        ctx.strokeStyle = m.color; ctx.globalAlpha = m.ring; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r + (1 - m.ring) * 24, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // smiley pop bumpers
    for (const b of bumpers) {
      const s = 1 + b.glow * 0.18;
      ctx.save();
      ctx.translate(b.x, b.y); ctx.scale(s, s);
      ctx.shadowColor = `hsl(${b.hue},100%,60%)`; ctx.shadowBlur = 16 + b.glow * 34;
      const rg = ctx.createRadialGradient(-b.r * 0.3, -b.r * 0.35, 2, 0, 0, b.r);
      rg.addColorStop(0, `hsl(${b.hue},100%,${82 + b.glow * 15}%)`);
      rg.addColorStop(1, `hsl(${b.hue},95%,${45 + b.glow * 20}%)`);
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(0, 0, b.r, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = `hsl(${b.hue},100%,30%)`;
      ctx.beginPath(); ctx.arc(0, 0, b.r - 5, 0, Math.PI * 2); ctx.stroke();
      // face
      ctx.strokeStyle = ctx.fillStyle = '#2a0a4a';
      ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      if (b.glow > 0.2) { // happy squint
        for (const ex of [-8, 8]) { ctx.beginPath(); ctx.arc(ex, -3, 4, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
        ctx.beginPath(); ctx.arc(0, 4, 8, 0.1 * Math.PI, 0.9 * Math.PI); ctx.fill();
      } else {
        for (const ex of [-8, 8]) { ctx.beginPath(); ctx.arc(ex, -4, 3, 0, Math.PI * 2); ctx.fill(); }
        ctx.beginPath(); ctx.arc(0, 3, 7, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,120,150,0.6)';
      for (const ex of [-14, 14]) { ctx.beginPath(); ctx.arc(ex, 4, 3, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = `700 11px ${FONT}`;
      ctx.fillText(b.pts, b.x, b.y + b.r + 10);
    }

    // flippers
    for (const f of flippers) {
      ctx.save();
      ctx.translate(f.px, f.py);
      if (f.s < 0) ctx.scale(-1, 1);
      ctx.rotate(f.a);
      ctx.shadowColor = '#FFB547'; ctx.shadowBlur = f.pressed ? 22 : 10;
      ctx.beginPath();
      ctx.arc(0, 0, FL_R0, Math.PI / 2, Math.PI * 1.5);
      ctx.lineTo(FL_LEN, -FL_R1);
      ctx.arc(FL_LEN, 0, FL_R1, -Math.PI / 2, Math.PI / 2);
      ctx.closePath();
      const fg = ctx.createLinearGradient(0, -FL_R0, 0, FL_R0);
      fg.addColorStop(0, '#FFF08A'); fg.addColorStop(1, '#FF8A2B');
      ctx.fillStyle = fg; ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.fillStyle = '#c2410c';
      ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    drawPlunger();

    // ball + trail
    if (state !== 'drain' && state !== 'over') {
      for (let i = 0; i < ball.trail.length; i += 2) {
        const a = (i / ball.trail.length) * 0.35;
        ctx.fillStyle = `rgba(143,243,255,${a})`;
        ctx.beginPath(); ctx.arc(ball.trail[i], ball.trail[i + 1], R * (0.4 + i / ball.trail.length * 0.5), 0, Math.PI * 2); ctx.fill();
      }
      ctx.save();
      ctx.shadowColor = '#fff'; ctx.shadowBlur = 12;
      const bgd = ctx.createRadialGradient(ball.x - 3, ball.y - 4, 1, ball.x, ball.y, R);
      bgd.addColorStop(0, '#ffffff'); bgd.addColorStop(0.45, '#dfe6f5'); bgd.addColorStop(1, '#7d86a8');
      ctx.fillStyle = bgd;
      ctx.beginPath(); ctx.arc(ball.x, ball.y, R, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // particles
    for (const p of particles) {
      ctx.globalAlpha = clamp(p.life * 1.5, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // score popups
    for (const p of popups) {
      ctx.globalAlpha = clamp(p.life * 1.4, 0, 1);
      ctx.font = `700 16px ${FONT}`;
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(30,8,60,0.8)';
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;

    // ball save light
    if (state === 'play' && saveTimer > 0 && (saveTimer > 2 || Math.sin(time * 20) > 0)) {
      ctx.font = `700 13px ${FONT}`;
      ctx.fillStyle = '#4FD8FF';
      ctx.shadowColor = '#4FD8FF'; ctx.shadowBlur = 12;
      ctx.fillText('★ BALL SAVE ★', 220, 760);
      ctx.shadowBlur = 0;
    }

    if (state === 'launch') {
      const pulse = 0.6 + 0.4 * Math.sin(time * 5);
      ctx.font = `700 15px ${FONT}`;
      ctx.fillStyle = `rgba(255,255,255,${pulse})`;
      ctx.fillText(charging ? 'Let go to LAUNCH!' : 'Hold SPACE or touch to pull', 220, 660);
      if (!charging) ctx.fillText('the plunger ⬇', 220, 680);
    }

    for (const m of messages) {
      const k = m.life / m.max, inT = clamp((m.max - m.life) * 6, 0, 1);
      const sz = (m.big ? 30 : 20) * (0.6 + 0.4 * inT);
      ctx.globalAlpha = clamp(k * 3, 0, 1);
      ctx.font = `700 ${sz}px ${FONT}`;
      const y = 545 + Math.sin(time * 6) * 3;
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(30,8,60,0.85)';
      ctx.strokeText(m.text, 220, y);
      ctx.shadowColor = m.color; ctx.shadowBlur = 18;
      ctx.fillStyle = m.color; ctx.fillText(m.text, 220, y);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  }

  function drawPlunger() {
    const pull = state === 'launch' && charging ? power * 26 : 0;
    const top = LANE_Y + R + pull;
    // spring
    ctx.strokeStyle = '#cfd6e6'; ctx.lineWidth = 2;
    ctx.beginPath();
    const coils = 7, bottom = 796, h = (bottom - top - 8) / coils;
    ctx.moveTo(440, top + 8);
    for (let i = 0; i < coils; i++) {
      ctx.lineTo(428, top + 8 + h * (i + 0.25));
      ctx.lineTo(452, top + 8 + h * (i + 0.75));
    }
    ctx.lineTo(440, bottom);
    ctx.stroke();
    // knob
    const kg = ctx.createLinearGradient(424, 0, 456, 0);
    kg.addColorStop(0, '#ff5f6d'); kg.addColorStop(1, '#c81e5b');
    ctx.fillStyle = kg;
    ctx.beginPath(); ctx.roundRect(424, top, 32, 9, 4); ctx.fill();

    // power meter inside the lane
    if (state === 'launch') {
      const mx = 431, my = 540, mh = 180;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath(); ctx.roundRect(mx, my, 18, mh, 9); ctx.fill();
      const fill = mh * power;
      const pg = ctx.createLinearGradient(0, my + mh, 0, my);
      pg.addColorStop(0, '#7CFF6B'); pg.addColorStop(0.5, '#FFE45C'); pg.addColorStop(1, '#FF5F6D');
      ctx.fillStyle = pg;
      ctx.save();
      ctx.shadowColor = '#FFE45C'; ctx.shadowBlur = charging ? 14 : 0;
      ctx.beginPath(); ctx.roundRect(mx + 3, my + mh - fill + 3, 12, Math.max(0, fill - 6), 6); ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.translate(mx + 9, my - 12);
      ctx.font = `700 10px ${FONT}`; ctx.fillStyle = '#FFE45C';
      ctx.fillText('POWER', 0, 0);
      ctx.restore();
    }
  }

  // ---------------- boot ----------------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    if (state !== 'paused') update(dt);
    render();
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resize);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize);
  $('alias').value = fetchStore('alias', '');
  shuffleMarkers();
  renderScoreList($('start-scores'));
  updateHud();
  resize();
  show('start');
  requestAnimationFrame(frame);

  // test hook (used only by automated checks)
  window.__bb = {
    get state() { return state; }, get score() { return score; }, get balls() { return balls; }, get mult() { return mult; },
    ball, flippers, stats, startCharge, releaseCharge, get power() { return power; },
    setPower(p) { power = p; }, sim(sec) { for (let t = 0; t < sec; t += 1 / 60) update(1 / 60); },
  };
})();
