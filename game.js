'use strict';
(function () {
const TILE = 32, ROWS = 17, COLS = 160;
const W = 960, H = 540;
const GRAV = 0.55, MAXFALL = 13, RUN = 3.2, JUMPV = -13.2;

let canvas, ctx;
let map = [];
let enemies = [], pickups = [], bullets = [], ebullets = [], particles = [];
let goal = null, spawn = { x: 64, y: 400 };
let player = null;
let cam = { x: 0 };
let shake = 0;
let state = 'title', stateT = 0;
let score = 0, lives = 3;
let muted = false;
let keys = {}, edge = {};
let pad = {}, padPrev = {};
let stars = [];
let frameNo = 0;
let AC = null;

function audio() {
  if (!AC) {
    const A = window.AudioContext || window.webkitAudioContext;
    if (!A) return null;
    AC = new A();
  }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}
function beep(freq, dur, type, vol, slide) {
  if (muted) return;
  try {
    const ac = audio();
    if (!ac) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, ac.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), ac.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.12, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    o.connect(g);
    g.connect(ac.destination);
    o.start();
    o.stop(ac.currentTime + dur + 0.02);
  } catch (e) {}
}
const sfx = {
  shoot() { beep(920, 0.07, 'square', 0.06, -500); },
  eshoot() { beep(220, 0.12, 'sawtooth', 0.07, -80); },
  jump() { beep(280, 0.16, 'square', 0.08, 420); },
  hurt() { beep(160, 0.25, 'sawtooth', 0.13, -100); },
  boom() { beep(90, 0.3, 'sawtooth', 0.14, -60); beep(55, 0.35, 'triangle', 0.12, -25); },
  coin() { beep(1320, 0.06, 'square', 0.07); setTimeout(() => beep(1760, 0.08, 'square', 0.07), 55); },
  power() { [660, 880, 1100, 1470].forEach((f, i) => setTimeout(() => beep(f, 0.1, 'square', 0.08), i * 70)); },
  die() { beep(400, 0.6, 'sawtooth', 0.14, -350); },
  win() { [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => beep(f, 0.14, 'square', 0.09), i * 110)); },
};

function buildLevel() {
  const g = Array.from({ length: ROWS }, () => Array(COLS).fill(' '));
  const fill = (x, y, w, h, c) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
      if (i >= 0 && i < COLS && j >= 0 && j < ROWS) g[j][i] = c;
    }
  };
  const plat = (x, y, w) => fill(x, y, w, 1, '#');
  const put = (x, y, c) => { g[y][x] = c; };
  fill(0, 15, COLS, 2, '#');
  fill(0, 0, 1, ROWS, '#');
  fill(COLS - 2, 0, 2, ROWS, '#');
  [[30, 4], [70, 4], [112, 4]].forEach(([px, pw]) => {
    fill(px, 15, pw, 1, ' ');
    fill(px, 16, pw, 1, '^');
  });
  plat(22, 10, 3);
  plat(36, 11, 3); plat(41, 8, 4);
  fill(50, 12, 2, 3, '#');
  plat(54, 10, 4); plat(59, 7, 4);
  plat(76, 11, 4); plat(84, 8, 4); plat(88, 11, 3);
  fill(96, 14, 2, 1, '#'); fill(98, 13, 2, 2, '#'); fill(100, 12, 2, 3, '#');
  plat(103, 10, 5);
  plat(120, 10, 4); plat(128, 8, 4); plat(132, 11, 3);
  plat(145, 11, 4); plat(150, 8, 3);
  [8, 9, 10].forEach(x => put(x, 13, 'o'));
  put(24, 13, 'O'); put(23, 9, 'o'); put(24, 9, 'o'); put(25, 9, 'o');
  put(38, 13, 'o'); put(39, 13, 'o'); put(42, 7, 'O');
  put(60, 6, 'H');
  put(66, 13, 'o'); put(67, 13, 'o');
  put(78, 10, 'o'); put(79, 10, 'o');
  put(85, 7, 'W');
  put(92, 13, 'o'); put(93, 13, 'o');
  put(104, 9, 'O'); put(105, 9, 'o');
  put(122, 13, 'o'); put(123, 13, 'o');
  put(129, 7, 'O');
  put(136, 13, 'o'); put(137, 13, 'o');
  put(146, 10, 'o'); put(151, 7, 'H');
  put(154, 13, 'o'); put(155, 13, 'o');
  put(14, 13, 'e'); put(20, 9, 'f');
  put(36, 13, 'e'); put(40, 13, 't'); put(44, 13, 'e');
  put(56, 13, 'e'); put(62, 7, 'f');
  put(80, 13, 'e'); put(84, 13, 't'); put(90, 13, 'e');
  put(106, 8, 'f');
  put(118, 13, 'e'); put(124, 9, 'f'); put(128, 13, 'e'); put(134, 13, 'e'); put(137, 13, 't');
  put(3, 13, 'P');
  put(157, 13, 'G');
  return g;
}

function spawnFromMap() {
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const c = map[y][x];
    if (c === 'P') { spawn = { x: x * TILE + 6, y: y * TILE + 2 }; map[y][x] = ' '; }
    else if (c === 'G') { goal = { x: x * TILE, y: y * TILE, w: TILE, h: TILE * 2 }; map[y][x] = ' '; }
    else if (c === 'e') {
      enemies.push({ type: 'walker', x: x * TILE + 4, y: y * TILE, w: 24, h: 24, vx: 0, vy: 0, dir: Math.random() < 0.5 ? -1 : 1, hp: 2, flash: 0, onGround: false });
      map[y][x] = ' ';
    } else if (c === 'f') {
      enemies.push({ type: 'flyer', x: x * TILE + 4, y: y * TILE, baseY: y * TILE, w: 22, h: 18, dir: 1, hp: 1, flash: 0, t: 0 });
      map[y][x] = ' ';
    } else if (c === 't') {
      enemies.push({ type: 'turret', x: x * TILE + 2, y: y * TILE + 6, w: 28, h: 26, vx: 0, vy: 0, hp: 3, flash: 0, fire: 60 + Math.floor(Math.random() * 60), onGround: false });
      map[y][x] = ' ';
    } else if (c === 'o' || c === 'O' || c === 'H' || c === 'W') {
      pickups.push({ x: x * TILE + TILE / 2, y: y * TILE + TILE / 2, type: c, t: Math.random() * 6 });
      map[y][x] = ' ';
    }
  }
}

function solid(tx, ty) {
  if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) return true;
  return map[ty][tx] === '#';
}

function moveAndCollide(e) {
  let hitX = false;
  e.x += e.vx;
  if (e.x < 0) { e.x = 0; e.vx = 0; hitX = true; }
  if (e.x + e.w > COLS * TILE) { e.x = COLS * TILE - e.w; e.vx = 0; hitX = true; }
  if (e.vx > 0) {
    const tx = Math.floor((e.x + e.w) / TILE);
    for (let ty = Math.floor(e.y / TILE); ty <= Math.floor((e.y + e.h - 1) / TILE); ty++) {
      if (solid(tx, ty)) { e.x = tx * TILE - e.w - 0.01; e.vx = 0; hitX = true; break; }
    }
  } else if (e.vx < 0) {
    const tx = Math.floor(e.x / TILE);
    for (let ty = Math.floor(e.y / TILE); ty <= Math.floor((e.y + e.h - 1) / TILE); ty++) {
      if (solid(tx, ty)) { e.x = (tx + 1) * TILE + 0.01; e.vx = 0; hitX = true; break; }
    }
  }
  e.y += e.vy;
  e.onGround = false;
  if (e.vy >= 0) {
    const ty = Math.floor((e.y + e.h) / TILE);
    for (let tx = Math.floor(e.x / TILE); tx <= Math.floor((e.x + e.w - 1) / TILE); tx++) {
      if (solid(tx, ty)) { e.y = ty * TILE - e.h - 0.01; e.vy = 0; e.onGround = true; break; }
    }
  } else {
    const ty = Math.floor(e.y / TILE);
    for (let tx = Math.floor(e.x / TILE); tx <= Math.floor((e.x + e.w - 1) / TILE); tx++) {
      if (solid(tx, ty)) { e.y = (ty + 1) * TILE + 0.01; e.vy = 0; break; }
    }
  }
  return hitX;
}

function burst(x, y, n, color) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 4;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.5, life: 25 + Math.random() * 25, max: 50, color, size: 2 + Math.random() * 3 });
  }
}
function puff(x, y, n, color) {
  for (let i = 0; i < n; i++) {
    particles.push({ x: x + (Math.random() - 0.5) * 12, y, vx: (Math.random() - 0.5) * 1.5, vy: -Math.random() * 1.5, life: 15 + Math.random() * 10, max: 25, color, size: 2 + Math.random() * 2 });
  }
}
function addText(text, x, y, color) {
  particles.push({ x, y, vx: 0, vy: -0.8, life: 50, max: 50, color, size: 0, text });
}
function updateParticles() {
  for (const pt of particles) {
    pt.x += pt.vx;
    pt.y += pt.vy;
    if (!pt.text) pt.vy += 0.15;
    pt.life--;
  }
  particles = particles.filter(pt => pt.life > 0);
}

function hurt(dmg, kx, ky) {
  const p = player;
  if (!p || p.invuln > 0 || state !== 'play') return;
  p.hp -= dmg;
  p.invuln = 100;
  shake = 14;
  sfx.hurt();
  if (ky !== undefined) p.vy = ky;
  if (kx) p.vx = kx;
  burst(p.x + p.w / 2, p.y + p.h / 2, 12, '#ff3b5c');
  if (p.hp <= 0) die();
}
function die() {
  const p = player;
  lives--;
  sfx.die();
  burst(p.x + p.w / 2, p.y + p.h / 2, 40, '#ffb03d');
  burst(p.x + p.w / 2, p.y + p.h / 2, 25, '#ff3b5c');
  shake = 22;
  state = 'dying';
  stateT = 55;
}

function tryFire(p, dx, dy, left, right) {
  if (p.fireCd > 0) return;
  let bx = p.dir, by = 0;
  if (dx !== 0 || dy !== 0) {
    bx = dx;
    by = dy;
    if (bx !== 0 && by !== 0) { bx *= Math.SQRT1_2; by *= Math.SQRT1_2; }
  }
  p.aim.x = bx;
  p.aim.y = by;
  p.fireCd = p.weapon >= 3 ? 13 : 11;
  const ox = p.x + p.w / 2, oy = p.y + p.h / 2;
  const add = (vx, vy, off) => {
    if (bullets.length < 12) bullets.push({ x: ox + vx * 16 + (off ? off.x : 0), y: oy + vy * 16 + (off ? off.y : 0), vx: vx * 9.5, vy: vy * 9.5 });
  };
  if (p.weapon === 1) {
    add(bx, by);
  } else if (p.weapon === 2) {
    const px = -by * 7, py = bx * 7;
    add(bx, by, { x: px, y: py });
    add(bx, by, { x: -px, y: -py });
  } else {
    for (const a of [-0.2, 0, 0.2]) {
      const c = Math.cos(a), s = Math.sin(a);
      add(bx * c - by * s, bx * s + by * c);
    }
  }
  sfx.shoot();
}

function updatePlayer() {
  const p = player;
  const left = kd('ArrowLeft') || kd('KeyA');
  const right = kd('ArrowRight') || kd('KeyD');
  const up = kd('ArrowUp') || kd('KeyW');
  const down = kd('ArrowDown') || kd('KeyS');
  const jump = kd('KeyZ') || kd('Space');
  const fire = kd('KeyX') || kd('KeyJ');
  const dx = (right ? 1 : 0) - (left ? 1 : 0);
  const dy = (down ? 1 : 0) - (up ? 1 : 0);
  if (dx !== 0) {
    p.dir = dx;
    p.vx += dx * (p.onGround ? 0.6 : 0.38);
  } else {
    p.vx *= p.onGround ? 0.7 : 0.92;
  }
  p.vx = Math.max(-RUN, Math.min(RUN, p.vx));
  if (dx !== 0 || dy !== 0) {
    let ax = dx, ay = dy;
    if (ax !== 0 && ay !== 0) { ax *= Math.SQRT1_2; ay *= Math.SQRT1_2; }
    if (ax !== 0 || ay !== 0) { p.aim.x = ax; p.aim.y = ay; }
  }
  if (edge.KeyZ || edge.Space) p.jumpBuf = 7;
  if (p.onGround) p.coyote = 7; else if (p.coyote > 0) p.coyote--;
  if (p.jumpBuf > 0) p.jumpBuf--;
  if (p.jumpBuf > 0 && p.coyote > 0) {
    p.vy = JUMPV;
    p.onGround = false;
    p.coyote = 0;
    p.jumpBuf = 0;
    sfx.jump();
    puff(p.x + p.w / 2, p.y + p.h, 5, '#9aa0b4');
  }
  if (!jump && p.vy < 0) p.vy *= 0.88;
  p.vy = Math.min(MAXFALL, p.vy + GRAV);
  moveAndCollide(p);
  if (p.y > ROWS * TILE + 40) {
    p.x = spawn.x;
    p.y = spawn.y - 40;
    hurt(1, 0, -10);
  }
  if (p.fireCd > 0) p.fireCd--;
  if (fire) tryFire(p, dx, dy, left, right);
  if (p.invuln > 0) p.invuln--;
  checkSpikes(p);
  checkEnemyContact(p);
}

function checkSpikes(p) {
  const x0 = Math.floor(p.x / TILE), x1 = Math.floor((p.x + p.w - 1) / TILE);
  const y0 = Math.floor(p.y / TILE), y1 = Math.floor((p.y + p.h - 1) / TILE);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (x >= 0 && x < COLS && y >= 0 && y < ROWS && map[y][x] === '^') {
      const cx = x * TILE + TILE / 2;
      hurt(1, (p.x + p.w / 2 < cx ? -1 : 1) * 4, -9);
      return;
    }
  }
}

function checkEnemyContact(p) {
  for (const e of enemies) {
    if (e.dead) continue;
    if (p.x < e.x + e.w && p.x + p.w > e.x && p.y < e.y + e.h && p.y + p.h > e.y) {
      const cx = (p.x + p.w / 2) - (e.x + e.w / 2);
      hurt(1, (cx < 0 ? -1 : 1) * 5, -7);
      if (e.type !== 'turret') {
        e.hp--;
        e.flash = 6;
        if (e.hp <= 0) killEnemy(e);
      }
      return;
    }
  }
}

function killEnemy(e) {
  e.dead = true;
  const pts = e.type === 'turret' ? 300 : e.type === 'flyer' ? 150 : 100;
  score += pts;
  burst(e.x + e.w / 2, e.y + e.h / 2, 18, e.type === 'flyer' ? '#a78bfa' : '#8b5cf6');
  addText('+' + pts, e.x + e.w / 2, e.y, '#7dd3fc');
  sfx.boom();
  shake = Math.max(shake, 6);
  const r = Math.random();
  if (r < 0.12) pickups.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, type: 'o', t: 0 });
  else if (r < 0.16 && player.hp < 3) pickups.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, type: 'H', t: 0 });
}

function updateEnemies() {
  for (const e of enemies) {
    if (e.dead) continue;
    if (e.flash > 0) e.flash--;
    if (e.type === 'walker') {
      e.vy = Math.min(MAXFALL, e.vy + GRAV);
      e.vx = e.dir * 1.15;
      const hitWall = moveAndCollide(e);
      if (hitWall) e.dir *= -1;
      if (e.onGround) {
        const aheadX = e.dir > 0 ? e.x + e.w + 3 : e.x - 3;
        if (!solid(Math.floor(aheadX / TILE), Math.floor((e.y + e.h + 4) / TILE))) e.dir *= -1;
      }
    } else if (e.type === 'flyer') {
      e.t++;
      e.x += e.dir * 0.9;
      const wx = e.dir > 0 ? e.x + e.w + 2 : e.x - 2;
      if (solid(Math.floor(wx / TILE), Math.floor((e.y + e.h / 2) / TILE))) e.dir *= -1;
      e.x = Math.max(TILE, Math.min(COLS * TILE - TILE - e.w, e.x));
      e.y = Math.max(TILE, e.baseY + Math.sin(e.t * 0.05) * 26);
    } else if (e.type === 'turret') {
      e.vy = Math.min(MAXFALL, e.vy + GRAV);
      e.vx = 0;
      moveAndCollide(e);
      e.fire--;
      const dx = player.x + player.w / 2 - (e.x + e.w / 2);
      const dy = player.y + player.h / 2 - (e.y + e.h / 2);
      const d = Math.hypot(dx, dy);
      if (e.fire <= 0 && d < 430 && state === 'play') {
        e.fire = 130;
        const a = Math.atan2(dy, dx);
        ebullets.push({ x: e.x + e.w / 2, y: e.y + e.h / 2 - 4, vx: Math.cos(a) * 4.6, vy: Math.sin(a) * 4.6 });
        sfx.eshoot();
      }
    }
  }
  enemies = enemies.filter(e => !e.dead);
}

function updateBullets() {
  for (const b of bullets) {
    b.x += b.vx;
    b.y += b.vy;
    if (solid(Math.floor(b.x / TILE), Math.floor(b.y / TILE))) {
      b.dead = true;
      burst(b.x, b.y, 4, '#ffe066');
    }
    for (const e of enemies) {
      if (e.dead) continue;
      if (b.x > e.x - 3 && b.x < e.x + e.w + 3 && b.y > e.y - 3 && b.y < e.y + e.h + 3) {
        b.dead = true;
        e.hp--;
        e.flash = 6;
        if (e.type === 'walker') e.vx += b.vx * 0.15;
        burst(b.x, b.y, 5, '#ffffff');
        if (e.hp <= 0) killEnemy(e);
        break;
      }
    }
  }
  bullets = bullets.filter(b => !b.dead && b.x > cam.x - 40 && b.x < cam.x + W + 40 && b.y > -20 && b.y < ROWS * TILE + 20);
  for (const b of ebullets) {
    b.x += b.vx;
    b.y += b.vy;
    if (solid(Math.floor(b.x / TILE), Math.floor(b.y / TILE))) {
      b.dead = true;
      burst(b.x, b.y, 4, '#ff4d5e');
    }
    const p = player;
    if (state === 'play' && p && b.x > p.x - 2 && b.x < p.x + p.w + 2 && b.y > p.y - 2 && b.y < p.y + p.h + 2) {
      b.dead = true;
      hurt(1, b.vx * 0.8, -6);
    }
  }
  ebullets = ebullets.filter(b => !b.dead && b.x > cam.x - 40 && b.x < cam.x + W + 40 && b.y > -20 && b.y < ROWS * TILE + 20);
}

function updatePickups() {
  const p = player;
  for (const pk of pickups) {
    pk.t += 0.08;
    const bobY = pk.y + Math.sin(pk.t) * 3;
    const dx = (p.x + p.w / 2) - pk.x;
    const dy = (p.y + p.h / 2) - bobY;
    if (Math.abs(dx) < 22 && Math.abs(dy) < 26) {
      pk.dead = true;
      if (pk.type === 'o') { score += 100; sfx.coin(); addText('+100', pk.x, bobY - 10, '#22d3ee'); }
      else if (pk.type === 'O') { score += 500; sfx.coin(); addText('+500', pk.x, bobY - 10, '#e879f9'); }
      else if (pk.type === 'H') { p.hp = Math.min(3, p.hp + 1); score += 200; sfx.power(); addText('+1 HP', pk.x, bobY - 10, '#22c55e'); }
      else if (pk.type === 'W') { p.weapon = Math.min(3, p.weapon + 1); score += 200; sfx.power(); addText('WEAPON UP!', pk.x, bobY - 10, '#fb923c'); }
      burst(pk.x, bobY, 8, '#ffffff');
    }
  }
  pickups = pickups.filter(pk => !pk.dead);
}

function checkGoal() {
  const p = player;
  if (goal && p.x < goal.x + goal.w && p.x + p.w > goal.x && p.y < goal.y + goal.h && p.y + p.h > goal.y) {
    state = 'win';
    score += 1000 + lives * 500;
    sfx.win();
  }
}

function updateCamera() {
  const target = Math.max(0, Math.min(COLS * TILE - W, player.x + player.w / 2 - W / 2 + player.dir * 50));
  cam.x += (target - cam.x) * 0.12;
  if (Math.abs(target - cam.x) < 0.5) cam.x = target;
}

function startGame() {
  map = buildLevel();
  enemies = [];
  pickups = [];
  bullets = [];
  ebullets = [];
  particles = [];
  goal = null;
  spawn = { x: 64, y: 400 };
  spawnFromMap();
  player = { x: spawn.x, y: spawn.y, w: 20, h: 28, vx: 0, vy: 0, dir: 1, onGround: false, coyote: 0, jumpBuf: 0, fireCd: 0, invuln: 0, hp: 3, weapon: 1, aim: { x: 1, y: 0 } };
  score = 0;
  lives = 3;
  shake = 0;
  cam.x = 0;
  state = 'play';
  stateT = 0;
  edge = {};
}

function respawn() {
  player.x = spawn.x;
  player.y = spawn.y;
  player.vx = 0;
  player.vy = 0;
  player.hp = 3;
  player.invuln = 120;
  ebullets = [];
  cam.x = Math.max(0, Math.min(COLS * TILE - W, spawn.x - W / 2 + 200));
  state = 'play';
}

function kd(code) { return !!(keys[code] || pad[code]); }

function readGamepad() {
  pad = {};
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
  const gps = navigator.getGamepads();
  const gp = gps && gps[0];
  if (!gp || !gp.connected) { padPrev = pad; return; }
  const ax = gp.axes.length > 0 ? gp.axes[0] : 0;
  const ay = gp.axes.length > 1 ? gp.axes[1] : 0;
  const b = gp.buttons;
  const bp = i => !!(b[i] && b[i].pressed);
  const want = {
    ArrowLeft: ax < -0.4 || bp(14),
    ArrowRight: ax > 0.4 || bp(15),
    ArrowUp: ay < -0.4 || bp(12),
    ArrowDown: ay > 0.4 || bp(13),
    KeyZ: bp(0) || bp(3),
    Space: bp(0),
    KeyX: bp(1) || bp(2) || bp(7),
    KeyJ: bp(1) || bp(2) || bp(7),
    Enter: bp(9),
    KeyR: bp(9),
    KeyP: bp(8),
    KeyM: bp(4),
  };
  for (const code of Object.keys(want)) {
    const p = !!want[code];
    pad[code] = p;
    if (p && !padPrev[code]) edge[code] = true;
  }
  padPrev = pad;
}

function update() {
  frameNo++;
  readGamepad();
  if (edge.KeyM) muted = !muted;
  if (state === 'title') {
    if (edge.Enter || edge.Space) startGame();
  } else if (state === 'play') {
    if (edge.KeyP) { state = 'pause'; return; }
    updatePlayer();
    updateBullets();
    updateEnemies();
    updatePickups();
    updateParticles();
    checkGoal();
    updateCamera();
  } else if (state === 'pause') {
    if (edge.KeyP) state = 'play';
  } else if (state === 'dying') {
    updateParticles();
    stateT--;
    if (stateT <= 0) {
      if (lives > 0) respawn();
      else state = 'gameover';
    }
  } else if (state === 'gameover' || state === 'win') {
    updateParticles();
    if (edge.KeyR) startGame();
  }
}

function frac(v) { return v - Math.floor(v); }

function drawBG() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#2a0700');
  g.addColorStop(0.45, '#6b1a00');
  g.addColorStop(0.8, '#a83000');
  g.addColorStop(1, '#d04800');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  for (const s of stars) {
    const ex = ((s.x - cam.x * 0.15 + Math.sin(frameNo * 0.05 + s.p) * 8) % W + W) % W;
    const ey = ((s.y - frameNo * s.vy) % H + H) % H;
    ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(frameNo * 0.06 + s.p));
    ctx.fillStyle = s.c;
    ctx.fillRect(ex, ey, s.r, s.r);
  }
  ctx.globalAlpha = 1;
  ridge(0.35, 200, 150, '#200502', '#ff5a00');
  ridge(0.6, 260, 110, '#330a03', '#ff8a00');
  drawLava();
}
function ridge(par, step, maxH, color, glow) {
  const off = cam.x * par;
  const start = Math.floor(off / step);
  for (let i = start; i < start + W / step + 3; i++) {
    const h = 60 + maxH * frac(Math.sin(i * 12.9898) * 43758.5453);
    const x = i * step - off;
    const peakX = x + step * frac(Math.sin(i * 78.233) * 12543.123);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - step, H);
    ctx.lineTo(peakX, H - h);
    ctx.lineTo(x + step * 2, H);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = glow;
    ctx.fillRect(peakX - 2, H - h - 2, 4, 4);
    ctx.globalAlpha = 1;
  }
}
function drawLava() {
  const off = cam.x * 0.1;
  const baseY = H - 70;
  const glow = ctx.createLinearGradient(0, baseY - 120, 0, H);
  glow.addColorStop(0, 'rgba(255,90,0,0)');
  glow.addColorStop(1, 'rgba(255,110,0,0.4)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, baseY - 120, W, H - baseY + 120);
  ctx.fillStyle = '#ff6a00';
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W + 16; x += 16) {
    const y = baseY + Math.sin((x + off) * 0.02 + frameNo * 0.06) * 6 + Math.sin((x + off) * 0.043 - frameNo * 0.09) * 4;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffc233';
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W + 16; x += 16) {
    const y = baseY + 10 + Math.sin((x + off) * 0.03 - frameNo * 0.08) * 5;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();
}

function drawTiles() {
  const x0 = Math.max(0, Math.floor(cam.x / TILE));
  const x1 = Math.min(COLS - 1, x0 + W / TILE + 2);
  for (let y = 0; y < ROWS; y++) {
    for (let x = x0; x <= x1; x++) {
      const c = map[y][x];
      const px = x * TILE, py = y * TILE;
      if (c === '#') {
        ctx.fillStyle = '#262647';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = '#31315a';
        ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
        ctx.strokeStyle = '#45457a';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 4.5, py + 4.5, TILE - 9, TILE - 9);
        ctx.fillStyle = '#1a1a33';
        ctx.fillRect(px + 7, py + 7, 3, 3);
        ctx.fillRect(px + TILE - 10, py + 7, 3, 3);
        ctx.fillRect(px + 7, py + TILE - 10, 3, 3);
        ctx.fillRect(px + TILE - 10, py + TILE - 10, 3, 3);
        if (!solid(x, y - 1)) {
          ctx.fillStyle = 'rgba(53,240,192,0.9)';
          ctx.fillRect(px, py, TILE, 4);
          ctx.fillStyle = 'rgba(53,240,192,0.22)';
          ctx.fillRect(px, py + 4, TILE, 5);
        }
      } else if (c === '^') {
        ctx.fillStyle = '#8f96b3';
        for (let i = 0; i < 2; i++) {
          const bx = px + i * TILE / 2;
          ctx.beginPath();
          ctx.moveTo(bx, py + TILE);
          ctx.lineTo(bx + TILE / 4, py + 6);
          ctx.lineTo(bx + TILE / 2, py + TILE);
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillStyle = '#ff4d5e';
        for (let i = 0; i < 2; i++) {
          const bx = px + i * TILE / 2;
          ctx.beginPath();
          ctx.moveTo(bx + TILE / 4 - 3, py + 13);
          ctx.lineTo(bx + TILE / 4, py + 6);
          ctx.lineTo(bx + TILE / 4 + 3, py + 13);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
  }
}

function drawGoal() {
  if (!goal) return;
  const cx = goal.x + goal.w / 2, cy = goal.y + goal.h / 2;
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = i % 2 ? 'rgba(232,121,249,0.85)' : 'rgba(34,211,238,0.85)';
    ctx.lineWidth = 3 - i * 0.6;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 14 - i * 3 + Math.sin(frameNo * 0.08 + i) * 2, goal.h / 2 - i * 4 + Math.cos(frameNo * 0.06 + i) * 2, 0, 0, 7);
    ctx.stroke();
  }
}

function drawPickups() {
  for (const pk of pickups) {
    const y = pk.y + Math.sin(pk.t) * 3;
    if (pk.type === 'o') {
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.moveTo(pk.x, y - 6); ctx.lineTo(pk.x + 6, y); ctx.lineTo(pk.x, y + 6); ctx.lineTo(pk.x - 6, y);
      ctx.closePath(); ctx.fill();
    } else if (pk.type === 'O') {
      ctx.fillStyle = '#e879f9';
      ctx.beginPath();
      ctx.moveTo(pk.x, y - 10); ctx.lineTo(pk.x + 10, y); ctx.lineTo(pk.x, y + 10); ctx.lineTo(pk.x - 10, y);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(pk.x, y - 4); ctx.lineTo(pk.x + 4, y); ctx.lineTo(pk.x, y + 4); ctx.lineTo(pk.x - 4, y);
      ctx.closePath(); ctx.fill();
    } else if (pk.type === 'H') {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(pk.x - 8, y - 8, 16, 16);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(pk.x - 2, y - 6, 4, 12);
      ctx.fillRect(pk.x - 6, y - 2, 12, 4);
    } else if (pk.type === 'W') {
      ctx.fillStyle = '#fb923c';
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 10 : 4.5;
        const a = -Math.PI / 2 + i / 10 * Math.PI * 2;
        const px = pk.x + Math.cos(a) * r, py = y + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill();
    }
  }
}

function drawEnemies() {
  for (const e of enemies) {
    if (e.dead) continue;
    ctx.save();
    ctx.translate(e.x + e.w / 2, e.y + e.h / 2);
    if (e.type === 'walker') {
      if (e.dir < 0) ctx.scale(-1, 1);
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#5b2d8e';
      ctx.beginPath(); ctx.arc(0, 0, 11, 0, 7); ctx.fill();
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#8b5cf6';
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2 + frameNo * 0.05;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 11, Math.sin(a) * 11);
        ctx.lineTo(Math.cos(a + 0.3) * 15, Math.sin(a + 0.3) * 15);
        ctx.lineTo(Math.cos(a - 0.3) * 15, Math.sin(a - 0.3) * 15);
        ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = '#ff3355';
      ctx.beginPath(); ctx.arc(4, -2, 3.5, 0, 7); ctx.fill();
      ctx.fillStyle = '#3a1d5e';
      ctx.fillRect(-9, 9, 7, 4);
      ctx.fillRect(2, 9, 7, 4);
    } else if (e.type === 'flyer') {
      const f = Math.sin(frameNo * 0.4 + e.t) * 6;
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#7c3aed';
      ctx.beginPath(); ctx.ellipse(0, 0, 9, 7, 0, 0, 7); ctx.fill();
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#a78bfa';
      ctx.beginPath();
      ctx.moveTo(-6, 0); ctx.lineTo(-16, -8 - f); ctx.lineTo(-14, 2);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(6, 0); ctx.lineTo(16, -8 + f); ctx.lineTo(14, 2);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ff3355';
      ctx.beginPath(); ctx.arc(0, -1, 3, 0, 7); ctx.fill();
    } else if (e.type === 'turret') {
      ctx.fillStyle = '#4b5563';
      ctx.fillRect(-13, 4, 26, 9);
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#6b7280';
      ctx.fillRect(-9, -6, 18, 12);
      const a = Math.atan2((player.y + player.h / 2) - (e.y + e.h / 2), (player.x + player.w / 2) - (e.x + e.w / 2));
      ctx.rotate(a);
      ctx.fillStyle = '#9aa0b4';
      ctx.fillRect(0, -3, 16, 6);
      ctx.fillStyle = '#ff3355';
      ctx.fillRect(12, -2, 4, 4);
    }
    ctx.restore();
  }
}

function drawBullets() {
  for (const b of bullets) {
    ctx.fillStyle = 'rgba(255,220,80,0.35)';
    ctx.beginPath(); ctx.arc(b.x, b.y, 7, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffe066';
    ctx.beginPath(); ctx.arc(b.x, b.y, 3.5, 0, 7); ctx.fill();
  }
  for (const b of ebullets) {
    ctx.fillStyle = 'rgba(255,60,80,0.35)';
    ctx.beginPath(); ctx.arc(b.x, b.y, 8, 0, 7); ctx.fill();
    ctx.fillStyle = '#ff4d5e';
    ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, 7); ctx.fill();
  }
}

function drawPlayer() {
  const p = player;
  if (!p) return;
  if (p.invuln > 0 && (frameNo >> 2) % 2 === 0) return;
  ctx.save();
  ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
  if (p.dir < 0) ctx.scale(-1, 1);
  const run = Math.abs(p.vx) > 0.4 && p.onGround;
  const lp = run ? Math.sin(frameNo * 0.35) * 4 : 0;
  ctx.fillStyle = '#3a3a5e';
  ctx.fillRect(-7 + lp, 8, 6, 6);
  ctx.fillRect(1 - lp, 8, 6, 6);
  ctx.fillStyle = '#e8641c';
  ctx.fillRect(-8, -4, 16, 13);
  ctx.fillStyle = '#c24e12';
  ctx.fillRect(-8, 4, 16, 5);
  ctx.fillStyle = '#f2a03d';
  ctx.fillRect(-11, -5, 5, 7);
  ctx.fillRect(6, -5, 5, 7);
  ctx.fillStyle = '#e8e8f2';
  ctx.fillRect(-7, -14, 14, 10);
  ctx.fillStyle = '#22d3ee';
  ctx.fillRect(0, -11, 7, 4);
  const ax = p.aim.x, ay = p.aim.y;
  ctx.strokeStyle = '#9aa0b4';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(6, -2);
  ctx.lineTo(6 + ax * 12, -2 + ay * 12);
  ctx.stroke();
  ctx.fillStyle = '#ffd23d';
  ctx.beginPath();
  ctx.arc(6 + ax * 13, -2 + ay * 13, 2.5, 0, 7);
  ctx.fill();
  ctx.restore();
}

function drawParticles() {
  for (const pt of particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    if (pt.text) {
      ctx.fillStyle = pt.color;
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(pt.text, pt.x, pt.y);
    } else {
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
  }
  ctx.globalAlpha = 1;
}

function drawHUD() {
  if (!player) return;
  ctx.fillStyle = 'rgba(4,4,16,0.55)';
  ctx.fillRect(0, 0, W, 34);
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i < player.hp ? '#ff3b5c' : 'rgba(255,59,92,0.2)';
    ctx.fillText('♥', 14 + i * 24, 18);
  }
  ctx.fillStyle = '#e2e8f0';
  ctx.fillText('x' + lives, 92, 18);
  ctx.fillStyle = '#fbbf24';
  ctx.fillText('WPN ' + player.weapon, 150, 18);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#7dd3fc';
  ctx.fillText('SCORE ' + String(score).padStart(6, '0'), W - 14, 18);
}

function overlay(alpha) {
  ctx.fillStyle = 'rgba(3,3,12,' + alpha + ')';
  ctx.fillRect(0, 0, W, H);
}
function centerText(txt, y, size, color, glow) {
  ctx.font = 'bold ' + size + 'px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (glow) { ctx.shadowColor = color; ctx.shadowBlur = 18; }
  ctx.fillStyle = color;
  ctx.fillText(txt, W / 2, y);
  ctx.shadowBlur = 0;
}
function drawTitle() {
  ctx.fillStyle = 'rgba(30,6,0,0.35)';
  ctx.fillRect(0, 0, W, H);
  centerText('STARBLASTER', H / 2 - 96, 64, '#22d3ee', true);
  centerText('a Turrican-style run & gun', H / 2 - 46, 18, '#a5b4fc');
  const lines = [
    'ARROWS / WASD   move and aim',
    'Z or SPACE      jump (hold for higher)',
    'X or J          fire - combine with directions for 8-way shots',
    'P pause    M mute    R restart',
    'GAMEPAD: stick/d-pad move, A jump, B/X/RT fire, START begin',
    '',
    'Grab orbs, collect the star to upgrade your weapon,',
    'blast the aliens and reach the portal at the far end!',
  ];
  ctx.font = '16px monospace';
  ctx.textAlign = 'center';
  lines.forEach((l, i) => {
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(l, W / 2, H / 2 + i * 24);
  });
  if ((frameNo >> 4) % 2 === 0) centerText('PRESS ENTER', H - 66, 24, '#fbbf24', true);
}

function render() {
  ctx.save();
  if (shake > 0.5) {
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    shake *= 0.88;
  } else shake = 0;
  drawBG();
  if (map.length && player) {
    ctx.save();
    ctx.translate(-Math.round(cam.x), 0);
    drawTiles();
    drawGoal();
    drawPickups();
    drawEnemies();
    drawBullets();
    drawPlayer();
    drawParticles();
    ctx.restore();
  }
  ctx.restore();
  if (state === 'play' || state === 'dying' || state === 'pause') drawHUD();
  if (state === 'title') {
    drawTitle();
  } else if (state === 'pause') {
    overlay(0.6);
    centerText('PAUSED', H / 2 - 10, 40, '#e2e8f0');
    centerText('P to resume', H / 2 + 36, 16, '#94a3b8');
  } else if (state === 'dying') {
    ctx.fillStyle = 'rgba(255,40,60,' + (stateT / 55) * 0.35 + ')';
    ctx.fillRect(0, 0, W, H);
  } else if (state === 'gameover') {
    overlay(0.75);
    centerText('GAME OVER', H / 2 - 40, 56, '#ff3b5c', true);
    centerText('SCORE ' + score, H / 2 + 10, 22, '#7dd3fc');
    if ((frameNo >> 4) % 2 === 0) centerText('PRESS R TO RETRY', H / 2 + 60, 18, '#fbbf24');
  } else if (state === 'win') {
    overlay(0.7);
    centerText('LEVEL CLEAR!', H / 2 - 40, 56, '#22d3ee', true);
    centerText('SCORE ' + score, H / 2 + 10, 22, '#7dd3fc');
    if ((frameNo >> 4) % 2 === 0) centerText('PRESS R TO PLAY AGAIN', H / 2 + 60, 18, '#fbbf24');
  }
}

const GAMEKEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyZ', 'KeyX', 'KeyJ', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'Space', 'Enter', 'KeyP', 'KeyR', 'KeyM'];

function init() {
  canvas = document.getElementById('game');
  ctx = canvas.getContext('2d');
  for (let i = 0; i < 130; i++) {
    const cols = ['#ffd23d', '#ff9a1f', '#ff6a00', '#ff3d00'];
    stars.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() < 0.6 ? 2 : 3, p: Math.random() * 6.28, vy: 0.2 + Math.random() * 0.7, c: cols[(Math.random() * cols.length) | 0] });
  }
  window.addEventListener('keydown', e => {
    if (GAMEKEYS.indexOf(e.code) >= 0) e.preventDefault();
    if (!keys[e.code]) edge[e.code] = true;
    keys[e.code] = true;
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });
  fit();
  window.addEventListener('resize', fit);
  requestAnimationFrame(frame);
}

function fit() {
  const s = Math.min(window.innerWidth / W, window.innerHeight / H);
  canvas.style.width = (W * s) + 'px';
  canvas.style.height = (H * s) + 'px';
}

let last = 0, acc = 0;
const STEP = 1000 / 60;
function frame(ts) {
  requestAnimationFrame(frame);
  if (!last) last = ts;
  let dt = ts - last;
  last = ts;
  if (dt > 120) dt = 120;
  acc += dt;
  let n = 0;
  while (acc >= STEP && n < 5) {
    update();
    acc -= STEP;
    n++;
  }
  render();
  edge = {};
}

if (typeof window !== 'undefined') {
  window.addEventListener('load', init);
  window.__STARBLASTER__ = {
    get state() { return state; },
    get player() { return player; },
    get score() { return score; },
    get lives() { return lives; },
    get cam() { return cam; },
    get enemies() { return enemies; },
    solidAt(tx, ty) { return solid(tx, ty); },
  };
}
})();
