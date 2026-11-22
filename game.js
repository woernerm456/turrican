'use strict';
(function () {
const TILE = 32, ROWS = 17, COLS = 160;
const W = 960, H = 540;
const GRAV = 0.55, MAXFALL = 13, RUN = 3.2, JUMPV = -20.41875;
const BULLET_DMG = 0.5;
const FUEL_MAX = 600;

let canvas, ctx;
let map = [];
let enemies = [], pickups = [], bullets = [], ebullets = [], particles = [];
let goal = null, spawn = { x: 64, y: 400 };
let player = null;
let cam = { x: 0 };
let shake = 0;
let state = 'title', stateT = 0;
let level = 1;
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

function theme() { return level === 2 ? 'water' : level === 3 ? 'station' : level >= 4 ? 'hive' : 'lava'; }

function buildLevel(n) {
  if (n >= 4) return buildHuntLevel();
  if (n >= 3) return buildStationLevel();
  if (n === 2) return buildWaterLevel();
  return buildLavaLevel();
}

function buildLavaLevel() {
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
  put(27, 9, 'd'); put(47, 9, 'd'); put(95, 8, 'd'); put(141, 9, 'd');
  put(148, 9, 'D');
  put(3, 13, 'P');
  put(157, 13, 'G');
  return g;
}

function buildWaterLevel() {
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
  [[24, 4], [55, 4], [90, 4]].forEach(([px, pw]) => {
    fill(px, 15, pw, 1, ' ');
    fill(px, 16, pw, 1, '^');
  });
  plat(10, 11, 4); plat(16, 8, 4);
  plat(33, 10, 4); plat(40, 7, 5);
  plat(62, 10, 4); plat(70, 8, 4); plat(78, 11, 3);
  plat(98, 10, 5); plat(108, 7, 4);
  plat(118, 10, 4); plat(126, 8, 3); plat(134, 11, 3);
  [7, 8, 9].forEach(x => put(x, 13, 'o'));
  put(17, 7, 'O');
  put(34, 9, 'o'); put(35, 9, 'o'); put(41, 6, 'O');
  put(63, 9, 'o'); put(71, 7, 'H'); put(79, 10, 'o');
  put(99, 9, 'W');
  put(109, 6, 'O');
  put(119, 9, 'o'); put(120, 9, 'o');
  put(127, 7, 'O');
  put(135, 10, 'o');
  put(150, 13, 'o'); put(151, 13, 'o');
  put(14, 12, 's'); put(20, 9, 's'); put(36, 12, 's'); put(48, 9, 's');
  put(66, 12, 's'); put(80, 9, 's'); put(100, 12, 's'); put(112, 9, 's');
  put(124, 12, 's'); put(134, 10, 's');
  put(138, 8, 'F');
  put(60, 13, 't'); put(108, 13, 't');
  put(18, 13, 'r'); put(44, 13, 'r'); put(72, 13, 'r'); put(96, 13, 'r'); put(116, 13, 'r');
  put(3, 13, 'P');
  put(157, 13, 'G');
  return g;
}

function buildStationLevel() {
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
  [[20, 4], [48, 4], [78, 4], [108, 4]].forEach(([px, pw]) => {
    fill(px, 15, pw, 1, ' ');
    fill(px, 16, pw, 1, '^');
  });
  plat(8, 11, 3); plat(14, 8, 4);
  plat(28, 10, 4); plat(35, 7, 4);
  fill(41, 12, 2, 3, '#');
  plat(56, 10, 4); plat(64, 8, 3);
  plat(86, 10, 4); plat(94, 7, 4);
  plat(118, 10, 4); plat(126, 8, 4); plat(136, 11, 3); plat(144, 8, 3);
  [6, 7, 8].forEach(x => put(x, 13, 'o'));
  put(15, 7, 'O');
  put(29, 9, 'o'); put(30, 9, 'o'); put(36, 6, 'O');
  put(57, 9, 'o'); put(65, 7, 'H'); put(87, 9, 'o');
  put(95, 6, 'W');
  put(119, 9, 'o'); put(120, 9, 'o'); put(127, 7, 'O');
  put(137, 10, 'o'); put(145, 7, 'H');
  put(150, 13, 'o'); put(151, 13, 'o');
  [12, 26, 33, 44, 55, 63, 70, 88, 100, 118].forEach(x => put(x, 13, 't'));
  [18, 38, 60, 90, 105, 130].forEach(x => put(x, 13, 'a'));
  put(150, 7, 'B');
  put(3, 13, 'P');
  put(157, 13, 'G');
  return g;
}

function buildHuntLevel() {
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
  [[24, 5], [40, 5], [58, 5], [76, 5], [94, 5], [112, 5], [130, 5]].forEach(([px, pw]) => {
    fill(px, 15, pw, 1, ' ');
    fill(px, 16, pw, 1, '^');
  });
  plat(7, 12, 3); plat(13, 9, 3); plat(19, 12, 3);
  plat(30, 10, 3); plat(36, 7, 3); plat(45, 11, 3); plat(51, 8, 3);
  plat(63, 11, 3); plat(69, 8, 3); plat(73, 12, 3);
  plat(81, 10, 3); plat(87, 7, 3); plat(93, 12, 3);
  plat(99, 10, 3); plat(105, 7, 3); plat(111, 12, 3);
  plat(117, 10, 3); plat(123, 7, 3); plat(129, 12, 3);
  plat(135, 10, 3); plat(141, 7, 3); plat(147, 11, 3); plat(152, 9, 3);
  put(8, 11, 'o'); put(14, 8, 'o'); put(20, 11, 'o');
  put(31, 9, 'o'); put(37, 6, 'O'); put(46, 10, 'o'); put(52, 7, 'o');
  put(64, 10, 'o'); put(70, 7, 'H'); put(74, 11, 'o');
  put(82, 9, 'o'); put(88, 6, 'o');
  put(100, 9, 'o'); put(106, 6, 'O');
  put(118, 9, 'o'); put(124, 6, 'o');
  put(136, 9, 'H'); put(142, 6, 'o'); put(148, 10, 'o');
  put(4, 4, 'X');
  put(3, 13, 'P');
  put(157, 13, 'G');
  return g;
}

function spawnFromMap() {
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const c = map[y][x];
    if (c === 'P') { spawn = { x: x * TILE - 4, y: y * TILE - 24 }; map[y][x] = ' '; }
    else if (c === 'G') { goal = { x: x * TILE - 16, y: y * TILE - 64, w: TILE * 2, h: TILE * 4 }; map[y][x] = ' '; }
    else if (c === 'e') {
      enemies.push({ type: 'walker', x: x * TILE - 8, y: y * TILE - 16, w: 48, h: 48, vx: 0, vy: 0, dir: Math.random() < 0.5 ? -1 : 1, hp: 2, flash: 0, onGround: false });
      map[y][x] = ' ';
    } else if (c === 'f') {
      enemies.push({ type: 'flyer', x: x * TILE - 6, y: y * TILE - 2, baseY: y * TILE, w: 44, h: 36, dir: 1, hp: 1, flash: 0, t: 0 });
      map[y][x] = ' ';
    } else if (c === 't') {
      enemies.push({ type: 'turret', blue: level === 2, double: level === 2, five: level >= 3, x: x * TILE - 12, y: y * TILE - 20, w: 56, h: 52, vx: 0, vy: 0, hp: 3, flash: 0, fire: 60 + Math.floor(Math.random() * 60), onGround: false });
      map[y][x] = ' ';
    } else if (c === 'r') {
      enemies.push({ type: 'robot', x: x * TILE - 10, y: y * TILE - 20, w: 52, h: 52, vx: 0, vy: 0, dir: Math.random() < 0.5 ? -1 : 1, hp: 3, flash: 0, onGround: false, atkCd: 90 + Math.floor(Math.random() * 60) });
      map[y][x] = ' ';
    } else if (c === 's') {
      enemies.push({ type: 'fish', big: false, x: x * TILE - 10, y: y * TILE - 8, baseY: y * TILE, w: 52, h: 32, dir: Math.random() < 0.5 ? -1 : 1, hp: 2, flash: 0, t: Math.floor(Math.random() * 40) });
      map[y][x] = ' ';
    } else if (c === 'F') {
      enemies.push({ type: 'fish', big: true, x: x * TILE - 48, y: y * TILE - 20, baseY: y * TILE, w: 128, h: 72, dir: -1, hp: 8, flash: 0, t: 0, fire: 60 });
      map[y][x] = ' ';
    } else if (c === 'a') {
      enemies.push({ type: 'alien', x: x * TILE - 10, y: y * TILE - 20, w: 52, h: 52, vx: 0, vy: 0, dir: Math.random() < 0.5 ? -1 : 1, hp: 3, flash: 0, onGround: false, atkCd: 80 + Math.floor(Math.random() * 60) });
      map[y][x] = ' ';
    } else if (c === 'X') {
      enemies.push({ type: 'hunter', x: x * TILE - 96, y: y * TILE - 96, w: 256, h: 256, dir: 1, hp: 999999, immortal: true, flash: 0, t: 0 });
      map[y][x] = ' ';
    } else if (c === 'B') {
      enemies.push({ type: 'boss', x: x * TILE - 48, y: y * TILE - 20, baseY: y * TILE - 20, w: 128, h: 128, dir: -1, hp: 40, flash: 0, t: 0, rot: 0, fire: 120 });
      map[y][x] = ' ';
    } else if (c === 'd') {
      enemies.push({ type: 'dreher', big: false, x: x * TILE - 14, y: y * TILE - 14, w: 60, h: 60, dir: 1, hp: 4, flash: 0, t: 0, rot: 0, fire: 90 + Math.floor(Math.random() * 60) });
      map[y][x] = ' ';
    } else if (c === 'D') {
      enemies.push({ type: 'dreher', big: true, x: x * TILE - 40, y: y * TILE - 40, w: 112, h: 112, dir: 1, hp: 8, flash: 0, t: 0, rot: 0, fire: 60 + Math.floor(Math.random() * 40) });
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

function tryRocket() {
  const p = player;
  if (!p || p.rocketCd > 0 || state !== 'play') return;
  p.rocketCd = 600;
  const ox = p.x + p.w / 2, oy = p.y + p.h / 2;
  bullets.push({ x: ox + p.aim.x * 24, y: oy + p.aim.y * 24, vx: p.aim.x * 7, vy: p.aim.y * 7, rocket: true });
  shake = Math.max(shake, 8);
  sfx.boom();
}

function updatePlayer() {
  const p = player;
  const left = kd('ArrowLeft') || kd('KeyA');
  const right = kd('ArrowRight');
  const up = kd('ArrowUp') || kd('KeyW');
  const down = kd('ArrowDown') || kd('KeyS');
  const jump = kd('KeyZ') || kd('Space');
  const fire = kd('KeyX') || kd('KeyJ');
  const jet = kd('KeyC');
  if (edge.KeyD) tryRocket();
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
  if (jet && p.fuel > 0) {
    p.fuel = Math.max(0, p.fuel - 1);
    p.vy = Math.max(p.vy - 1.6, -7);
    if (frameNo % 4 === 0) puff(p.x + p.w / 2, p.y + p.h, 2, '#ffb03d');
    if (frameNo % 12 === 0) beep(140, 0.05, 'sawtooth', 0.03, 30);
  } else if (p.fuel < FUEL_MAX) {
    p.fuel = Math.min(FUEL_MAX, p.fuel + FUEL_MAX / 300);
  }
  if (p.rocketCd > 0) p.rocketCd--;
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
      hurt(e.type === 'hunter' ? 2 : 1, (cx < 0 ? -1 : 1) * 5, -7);
      if (e.type !== 'turret' && !e.immortal) {
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
  const pts = e.type === 'turret' ? 300 : e.type === 'flyer' ? 150 : e.type === 'dreher' ? (e.big ? 1000 : 400) : e.type === 'fish' ? (e.big ? 1200 : 200) : e.type === 'robot' ? 250 : e.type === 'alien' ? 250 : e.type === 'boss' ? 5000 : 100;
  score += pts;
  burst(e.x + e.w / 2, e.y + e.h / 2, e.type === 'boss' ? 40 : e.big ? 30 : 18, e.type === 'fish' ? '#4ade80' : e.type === 'flyer' ? '#f87171' : e.type === 'robot' ? '#94a3b8' : e.type === 'alien' ? '#4ade80' : e.type === 'boss' ? '#ff3b5c' : '#dc2626');
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
    } else if (e.type === 'fish') {
      e.t++;
      const dx = player.x + player.w / 2 - (e.x + e.w / 2);
      const dy = player.y + player.h / 2 - (e.y + e.h / 2);
      const d = Math.hypot(dx, dy);
      const chase = e.big ? 0.55 : 1.5;
      const patrol = e.big ? 0.3 : 0.7;
      if (d < 520 && Math.abs(dy) < 220 && state === 'play') {
        e.dir = dx < 0 ? -1 : 1;
        e.x += e.dir * chase;
        e.y += (dy / (Math.abs(dy) + 60)) * (e.big ? 0.6 : 1.4);
      } else {
        e.x += e.dir * patrol;
        e.y = Math.max(TILE, e.baseY + Math.sin(e.t * 0.07) * (e.big ? 14 : 22));
      }
      const wx = e.dir > 0 ? e.x + e.w + 2 : e.x - 2;
      if (solid(Math.floor(wx / TILE), Math.floor((e.y + e.h / 2) / TILE))) e.dir *= -1;
      e.x = Math.max(TILE, Math.min(COLS * TILE - TILE - e.w, e.x));
      e.y = Math.max(TILE, Math.min(13 * TILE, e.y));
      if (e.big) {
        e.fire--;
        if (e.fire <= 0 && d < 560 && state === 'play') {
          e.fire = 60;
          const a = Math.atan2(dy, dx);
          if (ebullets.length < 40) ebullets.push({ x: e.x + e.w / 2 + Math.cos(a) * 30, y: e.y + e.h / 2 + Math.sin(a) * 18, vx: Math.cos(a) * 4.5, vy: Math.sin(a) * 4.5 });
          sfx.eshoot();
        }
      }
    } else if (e.type === 'dreher') {
      e.rot += 0.09;
      e.t++;
      const dx = player.x + player.w / 2 - (e.x + e.w / 2);
      const dy = player.y + player.h / 2 - (e.y + e.h / 2);
      const d = Math.hypot(dx, dy);
      const spd = e.big ? 0.55 : 0.8;
      if (d < 420 && d > 40 && state === 'play') {
        e.x += dx / d * spd;
        e.y += dy / d * spd;
      }
      e.x = Math.max(TILE, Math.min(COLS * TILE - TILE - e.w, e.x));
      e.y = Math.max(TILE, Math.min(ROWS * TILE - e.h - TILE, e.y));
      e.fire--;
      if (e.fire <= 0 && d < 480 && state === 'play') {
        e.fire = e.big ? 50 : 150;
        const bspd = e.big ? 3.6 : 3.2;
        for (let i = 0; i < 8; i++) {
          const a = e.rot + i / 8 * Math.PI * 2;
          if (ebullets.length < 40) ebullets.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, vx: Math.cos(a) * bspd, vy: Math.sin(a) * bspd });
        }
        sfx.eshoot();
      }
    } else if (e.type === 'alien') {
      e.vy = Math.min(MAXFALL, e.vy + GRAV);
      e.vx = e.dir * 0.7;
      const hitWall = moveAndCollide(e);
      if (hitWall) e.dir *= -1;
      if (e.onGround) {
        const aheadX = e.dir > 0 ? e.x + e.w + 3 : e.x - 3;
        if (!solid(Math.floor(aheadX / TILE), Math.floor((e.y + e.h + 4) / TILE))) e.dir *= -1;
      }
      e.atkCd--;
      const dx = player.x + player.w / 2 - (e.x + e.w / 2);
      const dy = player.y + player.h / 2 - (e.y + e.h / 2);
      const d = Math.hypot(dx, dy);
      if (e.atkCd <= 0 && d < 110 && Math.abs(dy) < 90 && state === 'play') {
        e.atkCd = 100;
        const a = Math.atan2(dy, dx);
        if (ebullets.length < 40) ebullets.push({ x: e.x + e.w / 2 + Math.cos(a) * 26, y: e.y + e.h / 2 + Math.sin(a) * 26, vx: Math.cos(a) * 4, vy: Math.sin(a) * 4, dmg: 2, range: 64, dist: 0, tentacle: true });
        sfx.eshoot();
      }
    } else if (e.type === 'hunter') {
      e.t++;
      const dx = player.x + player.w / 2 - (e.x + e.w / 2);
      const dy = player.y + player.h / 2 - (e.y + e.h / 2);
      const d = Math.hypot(dx, dy) || 1;
      const spd = 1.15;
      e.x += dx / d * spd;
      e.y += dy / d * spd * 0.8;
      e.x = Math.max(TILE, Math.min(COLS * TILE - TILE - e.w, e.x));
      e.y = Math.max(TILE, Math.min(ROWS * TILE - e.h - TILE, e.y));
      if (Math.abs(dx) > 4) e.dir = dx < 0 ? -1 : 1;
    } else if (e.type === 'boss') {
      e.t++;
      e.rot += 0.02;
      const dx = player.x + player.w / 2 - (e.x + e.w / 2);
      const dy = player.y + player.h / 2 - (e.y + e.h / 2);
      const d = Math.hypot(dx, dy);
      if (Math.abs(dx) > 260 && state === 'play') e.x += Math.sign(dx) * 0.5;
      e.y = e.baseY + Math.sin(e.t * 0.04) * 20;
      e.x = Math.max(TILE, Math.min(COLS * TILE - TILE - e.w, e.x));
      e.y = Math.max(64, Math.min(12 * TILE, e.y));
      e.fire--;
      if (e.fire <= 0 && d < 720 && state === 'play') {
        e.fire = 120;
        for (let i = 0; i < 16; i++) {
          const a = e.rot + i / 16 * Math.PI * 2;
          if (ebullets.length < 60) ebullets.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, vx: Math.cos(a) * 3.5, vy: Math.sin(a) * 3.5, dmg: 2 });
        }
        sfx.eshoot();
      }
    } else if (e.type === 'turret') {
      e.vy = Math.min(MAXFALL, e.vy + GRAV);
      e.vx = 0;
      moveAndCollide(e);
      e.fire--;
      const dx = player.x + player.w / 2 - (e.x + e.w / 2);
      const dy = player.y + player.h / 2 - (e.y + e.h / 2);
      const d = Math.hypot(dx, dy);
      if (e.fire <= 0 && d < 430 && state === 'play') {
        e.fire = e.double ? 150 : 130;
        const a = Math.atan2(dy, dx);
        const offs = e.five ? [-0.3, -0.15, 0, 0.15, 0.3] : e.double ? [-0.15, 0.15] : [0];
        for (const off of offs) {
          if (ebullets.length < 40) ebullets.push({ x: e.x + e.w / 2, y: e.y + e.h / 2 - 4, vx: Math.cos(a + off) * 4.6, vy: Math.sin(a + off) * 4.6 });
        }
        sfx.eshoot();
      }
    } else if (e.type === 'robot') {
      e.vy = Math.min(MAXFALL, e.vy + GRAV);
      e.vx = e.dir * 1.0;
      const hitWall = moveAndCollide(e);
      if (hitWall) e.dir *= -1;
      if (e.onGround) {
        const aheadX = e.dir > 0 ? e.x + e.w + 3 : e.x - 3;
        if (!solid(Math.floor(aheadX / TILE), Math.floor((e.y + e.h + 4) / TILE))) e.dir *= -1;
      }
      e.atkCd--;
      const dx = player.x + player.w / 2 - (e.x + e.w / 2);
      const dy = player.y + player.h / 2 - (e.y + e.h / 2);
      const d = Math.hypot(dx, dy);
      if (e.atkCd <= 0 && d < 380 && Math.abs(dy) < 140 && state === 'play') {
        e.atkCd = 140;
        const a = Math.atan2(dy, dx);
        if (ebullets.length < 40) ebullets.push({ x: e.x + e.w / 2, y: e.y + 8, vx: Math.cos(a) * 5, vy: Math.sin(a) * 5, boom: true, owner: e, t: 0 });
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
      if (b.x > e.x - 6 && b.x < e.x + e.w + 6 && b.y > e.y - 6 && b.y < e.y + e.h + 6) {
        b.dead = true;
        if (!e.immortal) e.hp -= b.rocket ? 4 * BULLET_DMG : BULLET_DMG;
        e.flash = 6;
        if (e.type === 'walker') e.vx += b.vx * 0.15;
        if (b.rocket) {
          burst(b.x, b.y, 18, '#ffb03d');
          burst(b.x, b.y, 10, '#ff4d5e');
          shake = Math.max(shake, 8);
          sfx.boom();
        } else {
          burst(b.x, b.y, 5, '#ffffff');
        }
        if (!e.immortal && e.hp <= 0) killEnemy(e);
        break;
      }
    }
  }
  bullets = bullets.filter(b => !b.dead && b.x > cam.x - 40 && b.x < cam.x + W + 40 && b.y > -20 && b.y < ROWS * TILE + 20);
  for (const b of ebullets) {
    if (b.range) {
      b.dist = (b.dist || 0) + Math.hypot(b.vx, b.vy);
      if (b.dist >= b.range) { b.dead = true; burst(b.x, b.y, 3, '#4ade80'); }
    }
    if (b.boom) {
      b.t++;
      if (b.t > 35 && b.owner && !b.owner.dead) {
        const ox = b.owner.x + b.owner.w / 2, oy = b.owner.y + b.owner.h / 2;
        const a = Math.atan2(oy - b.y, ox - b.x);
        b.vx = Math.cos(a) * 4.5;
        b.vy = Math.sin(a) * 4.5;
        if (Math.hypot(ox - b.x, oy - b.y) < 16) b.dead = true;
      } else if (b.t > 170) b.dead = true;
    }
    b.x += b.vx;
    b.y += b.vy;
    if (solid(Math.floor(b.x / TILE), Math.floor(b.y / TILE))) {
      b.dead = true;
      burst(b.x, b.y, 4, b.boom ? '#93c5fd' : '#ff4d5e');
    }
    const p = player;
    if (state === 'play' && p && b.x > p.x - 2 && b.x < p.x + p.w + 2 && b.y > p.y - 2 && b.y < p.y + p.h + 2) {
      if (!b.boom) b.dead = true;
      hurt(b.dmg || 1, b.vx * 0.8, -6);
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
    if (Math.abs(dx) < 44 && Math.abs(dy) < 52) {
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
    if (level >= 4) {
      state = 'win';
      score += 1000 + lives * 500;
    } else {
      state = 'levelclear';
      stateT = 150;
      score += 500;
    }
    sfx.win();
  }
}

function updateCamera() {
  const target = Math.max(0, Math.min(COLS * TILE - W, player.x + player.w / 2 - W / 2 + player.dir * 50));
  cam.x += (target - cam.x) * 0.12;
  if (Math.abs(target - cam.x) < 0.5) cam.x = target;
}

function startGame(resetAll) {
  if (resetAll) { level = 1; score = 0; lives = 3; }
  const wpn = resetAll ? 1 : (player ? player.weapon : 1);
  stars = makeSky(theme());
  map = buildLevel(level);
  enemies = [];
  pickups = [];
  bullets = [];
  ebullets = [];
  particles = [];
  goal = null;
  spawn = { x: 64, y: 400 };
  spawnFromMap();
  player = { x: spawn.x, y: spawn.y, w: 40, h: 56, vx: 0, vy: 0, dir: 1, onGround: false, coyote: 0, jumpBuf: 0, fireCd: 0, invuln: 90, hp: 3, weapon: wpn, aim: { x: 1, y: 0 }, fuel: FUEL_MAX, rocketCd: 0 };
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
  player.fuel = FUEL_MAX;
  player.rocketCd = 0;
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
    KeyC: bp(5),
    KeyD: bp(6),
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
    if (edge.Enter || edge.Space) startGame(true);
  } else if (state === 'play') {
    if (edge.KeyP) { state = 'pause'; return; }
    updatePlayer();
    updateBullets();
    updateEnemies();
    updatePickups();
    updateParticles();
    checkGoal();
    updateCamera();
  } else if (state === 'levelclear') {
    updateParticles();
    stateT--;
    if (stateT <= 0) { level++; startGame(false); }
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
    if (edge.KeyR) startGame(true);
  }
}

function frac(v) { return v - Math.floor(v); }

function makeSky(theme) {
  const arr = [];
  const cols = theme === 'water' ? ['#bfefff', '#67e8f9', '#e0f2fe', '#38bdf8'] : theme === 'station' ? ['#e2e8f0', '#7dd3fc', '#ffffff', '#93c5fd'] : theme === 'hive' ? ['#4ade80', '#a3e635', '#bbf7d0', '#22d3ee'] : ['#ffd23d', '#ff9a1f', '#ff6a00', '#ff3d00'];
  for (let i = 0; i < 130; i++) {
    arr.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() < 0.6 ? 2 : 3, p: Math.random() * 6.28, vy: 0.2 + Math.random() * 0.7, c: cols[(Math.random() * cols.length) | 0] });
  }
  return arr;
}

function drawBG() {
  const th = theme();
  const g = ctx.createLinearGradient(0, 0, 0, H);
  if (th === 'water') {
    g.addColorStop(0, '#010d18');
    g.addColorStop(0.55, '#013a5c');
    g.addColorStop(1, '#0a6ea8');
  } else if (th === 'station') {
    g.addColorStop(0, '#050510');
    g.addColorStop(1, '#0d0d24');
  } else if (th === 'hive') {
    g.addColorStop(0, '#0b0316');
    g.addColorStop(0.6, '#170a2b');
    g.addColorStop(1, '#07130b');
  } else {
    g.addColorStop(0, '#2a0700');
    g.addColorStop(0.45, '#6b1a00');
    g.addColorStop(0.8, '#a83000');
    g.addColorStop(1, '#d04800');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  if (th === 'water') drawRays();
  if (th === 'station') {
    drawStation();
  } else {
    for (const s of stars) {
      const ex = ((s.x - cam.x * 0.15 + Math.sin(frameNo * 0.05 + s.p) * 8) % W + W) % W;
      const ey = ((s.y - frameNo * s.vy) % H + H) % H;
      ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(frameNo * 0.06 + s.p));
      ctx.fillStyle = s.c;
      ctx.fillRect(ex, ey, s.r, s.r);
    }
    ctx.globalAlpha = 1;
  }
  if (th === 'water') {
    ridge(0.35, 200, 150, '#04263b', '#22d3ee');
    ridge(0.6, 260, 110, '#062f4d', '#67e8f9');
    drawSand();
  } else if (th === 'hive') {
    ridge(0.35, 220, 160, '#0c1a10', '#4ade80');
    ridge(0.6, 280, 120, '#0a140c', '#22c55e');
    for (let i = 0; i < 6; i++) {
      const bx = ((i * 260 - cam.x * 0.3) % (W + 200) + W + 200) % (W + 200) - 100;
      const by = 120 + ((i * 173) % 260);
      const r = 26 + Math.sin(frameNo * 0.03 + i * 2) * 6 + i * 6;
      ctx.fillStyle = 'rgba(34,197,94,0.10)';
      ctx.beginPath(); ctx.arc(bx, by, r, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(163,230,53,0.14)';
      ctx.beginPath(); ctx.arc(bx, by, r * 0.5, 0, 7); ctx.fill();
    }
  } else if (th !== 'station') {
    ridge(0.35, 200, 150, '#200502', '#ff5a00');
    ridge(0.6, 260, 110, '#330a03', '#ff8a00');
    drawLava();
  }
}
function drawStation() {
  ctx.fillStyle = '#0a0a18';
  ctx.fillRect(0, 0, W, H);
  const winW = 240, winH = 170, winY = 70;
  for (let i = 0; i < 4; i++) {
    const wx = ((i * 320 - cam.x * 0.25) % (W + 320) + W + 320) % (W + 320) - 160;
    ctx.fillStyle = '#020210';
    ctx.fillRect(wx, winY, winW, winH);
    for (let s = 0; s < 14; s++) {
      const sx = wx + (((s * 53.7 - cam.x * 0.4) % winW) + winW) % winW;
      const sy = winY + (((s * 31.3) % winH) + winH) % winH;
      ctx.fillStyle = s % 4 === 0 ? '#7dd3fc' : '#e2e8f0';
      ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(frameNo * 0.03 + s));
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.globalAlpha = 1;
    if (i === 1) {
      ctx.fillStyle = '#1d4ed8';
      ctx.beginPath(); ctx.arc(wx + winW - 50, winY + winH - 40, 34, 0, 7); ctx.fill();
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath(); ctx.arc(wx + winW - 58, winY + winH - 48, 30, 0, 7); ctx.fill();
    }
    ctx.strokeStyle = '#3f3f5a';
    ctx.lineWidth = 8;
    ctx.strokeRect(wx, winY, winW, winH);
    ctx.strokeStyle = '#55557a';
    ctx.lineWidth = 2;
    ctx.strokeRect(wx + 6, winY + 6, winW - 12, winH - 12);
    ctx.strokeStyle = '#3f3f5a';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(wx + winW / 2, winY); ctx.lineTo(wx + winW / 2, winY + winH); ctx.stroke();
    ctx.fillStyle = '#6b6b8f';
    for (let r = 0; r < 4; r++) {
      ctx.fillRect(wx + 10 + r * (winW - 20) / 3, winY - 4, 4, 4);
      ctx.fillRect(wx + 10 + r * (winW - 20) / 3, winY + winH, 4, 4);
    }
  }
  ctx.strokeStyle = 'rgba(80,80,120,0.35)';
  ctx.lineWidth = 2;
  for (let x = -cam.x * 0.5 % 160; x < W; x += 160) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H - 70); ctx.stroke();
  }
  for (let i = 0; i < 3; i++) {
    const lx = ((i * 400 - cam.x * 0.5) % (W + 100) + W + 100) % (W + 100) - 50;
    ctx.fillStyle = (frameNo >> 4) % 2 === 0 ? '#ff3b5c' : '#7f1d1d';
    ctx.beginPath(); ctx.arc(lx, 30, 4, 0, 7); ctx.fill();
  }
  const baseY = H - 70;
  ctx.fillStyle = '#23233a';
  ctx.fillRect(0, baseY, W, H - baseY);
  ctx.fillStyle = '#2e2e4a';
  ctx.fillRect(0, baseY, W, 8);
  ctx.strokeStyle = '#1a1a2e';
  ctx.lineWidth = 2;
  for (let x = -cam.x % 64; x < W; x += 64) {
    ctx.beginPath(); ctx.moveTo(x, baseY); ctx.lineTo(x, H); ctx.stroke();
  }
}
function drawRays() {
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = '#bfefff';
  for (let i = 0; i < 5; i++) {
    const bx = ((i * 260 - cam.x * 0.2) % (W + 400) + W + 400) % (W + 400) - 200;
    ctx.beginPath();
    ctx.moveTo(bx, 0);
    ctx.lineTo(bx + 60, 0);
    ctx.lineTo(bx + 160, H);
    ctx.lineTo(bx + 60, H);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
function drawSand() {
  const off = cam.x * 0.1;
  const baseY = H - 70;
  const glow = ctx.createLinearGradient(0, baseY - 120, 0, H);
  glow.addColorStop(0, 'rgba(56,189,248,0)');
  glow.addColorStop(1, 'rgba(56,189,248,0.25)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, baseY - 120, W, H - baseY + 120);
  ctx.fillStyle = '#7a5c2e';
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W + 16; x += 16) {
    ctx.lineTo(x, baseY + Math.sin((x + off) * 0.02 + frameNo * 0.04) * 6);
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c9a86a';
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W + 16; x += 16) {
    ctx.lineTo(x, baseY + 8 + Math.sin((x + off) * 0.03 - frameNo * 0.05) * 4);
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();
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
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(2, 2);
  ctx.translate(-cx, -cy);
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = i % 2 ? 'rgba(232,121,249,0.85)' : 'rgba(34,211,238,0.85)';
    ctx.lineWidth = 3 - i * 0.6;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 14 - i * 3 + Math.sin(frameNo * 0.08 + i) * 2, goal.h / 2 - i * 4 + Math.cos(frameNo * 0.06 + i) * 2, 0, 0, 7);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPickups() {
  for (const pk of pickups) {
    const y = pk.y + Math.sin(pk.t) * 3;
    ctx.save();
    ctx.translate(pk.x, y);
    ctx.scale(2, 2);
    ctx.translate(-pk.x, -y);
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
    ctx.restore();
  }
}

function drawEnemies() {
  for (const e of enemies) {
    if (e.dead) continue;
    ctx.save();
    ctx.translate(e.x + e.w / 2, e.y + e.h / 2);
    if (e.type === 'walker') {
      ctx.scale(e.dir * 2, 2);
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#7f1d1d';
      ctx.beginPath(); ctx.arc(0, 0, 11, 0, 7); ctx.fill();
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#b91c1c';
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2 + frameNo * 0.05;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 11, Math.sin(a) * 11);
        ctx.lineTo(Math.cos(a + 0.3) * 15, Math.sin(a + 0.3) * 15);
        ctx.lineTo(Math.cos(a - 0.3) * 15, Math.sin(a - 0.3) * 15);
        ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath(); ctx.arc(4, -2, 3.5, 0, 7); ctx.fill();
      ctx.fillStyle = '#450a0a';
      ctx.fillRect(-9, 9, 7, 4);
      ctx.fillRect(2, 9, 7, 4);
    } else if (e.type === 'flyer') {
      ctx.scale(2, 2);
      const f = Math.sin(frameNo * 0.4 + e.t) * 6;
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#7f1d1d';
      ctx.beginPath(); ctx.ellipse(0, 0, 9, 7, 0, 0, 7); ctx.fill();
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#dc2626';
      ctx.beginPath();
      ctx.moveTo(-6, 0); ctx.lineTo(-16, -8 - f); ctx.lineTo(-14, 2);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(6, 0); ctx.lineTo(16, -8 + f); ctx.lineTo(14, 2);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath(); ctx.arc(0, -1, 3, 0, 7); ctx.fill();
    } else if (e.type === 'fish') {
      const RX = e.big ? 32 : 13, RY = e.big ? 18 : 8;
      ctx.scale(e.dir * 2, 2);
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#166534';
      ctx.beginPath(); ctx.ellipse(0, 0, RX, RY, 0, 0, 7); ctx.fill();
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#22c55e';
      ctx.beginPath();
      ctx.moveTo(-RX + 2, 0); ctx.lineTo(-RX - (e.big ? 14 : 8), -RY - 1); ctx.lineTo(-RX - (e.big ? 14 : 8), RY + 1);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-RX * 0.15, -RY); ctx.lineTo(RX * 0.25, -RY - (e.big ? 10 : 5)); ctx.lineTo(RX * 0.45, -RY);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath(); ctx.arc(RX * 0.55, -RY * 0.25, e.big ? 4 : 2.5, 0, 7); ctx.fill();
    } else if (e.type === 'dreher') {
      const R = e.big ? 24 : 13;
      const spokes = e.big ? 8 : 6;
      ctx.scale(2, 2);
      ctx.rotate(e.rot);
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : (e.big ? '#450a0a' : '#7f1d1d');
      ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.fill();
      ctx.strokeStyle = e.flash > 0 ? '#ffffff' : '#b91c1c';
      ctx.lineWidth = e.big ? 5 : 3;
      ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.stroke();
      for (let i = 0; i < spokes; i++) {
        const a = i / spokes * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * (R - 1), Math.sin(a) * (R - 1));
        ctx.stroke();
      }
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath(); ctx.arc(0, 0, e.big ? 7 : 4, 0, 7); ctx.fill();
    } else if (e.type === 'robot') {
      ctx.scale(e.dir * 2, 2);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-10, 8, 8, 6);
      ctx.fillRect(2, 8, 8, 6);
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#334155';
      ctx.fillRect(-12, -8, 24, 17);
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#475569';
      ctx.fillRect(-8, -4, 16, 9);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, -14); ctx.stroke();
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath(); ctx.arc(0, -14, 2.5, 0, 7); ctx.fill();
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#22d3ee';
      ctx.fillRect(4, -2, 5, 4);
    } else if (e.type === 'boss') {
      ctx.scale(2, 2);
      const fl = e.flash > 0;
      ctx.fillStyle = fl ? '#ffffff' : '#0f172a';
      ctx.fillRect(-34, -8, 68, 22);
      ctx.fillStyle = fl ? '#ffffff' : '#1e293b';
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(i * 13, 14, 6, 0, 7); ctx.fill(); }
      ctx.fillStyle = fl ? '#ffffff' : '#334155';
      ctx.fillRect(-30, -28, 60, 24);
      ctx.fillStyle = fl ? '#ffffff' : '#475569';
      ctx.fillRect(-24, -34, 48, 10);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(0, -42); ctx.stroke();
      ctx.fillStyle = (frameNo >> 4) % 2 === 0 ? '#ff3b5c' : '#7f1d1d';
      ctx.beginPath(); ctx.arc(0, -44, 3, 0, 7); ctx.fill();
      ctx.fillStyle = '#ff3b5c';
      ctx.beginPath(); ctx.arc(0, -22, 5 + Math.sin(frameNo * 0.1), 0, 7); ctx.fill();
      ctx.fillStyle = fl ? '#ffffff' : '#0f172a';
      ctx.fillRect(-40, -24, 10, 18);
      ctx.fillRect(30, -24, 10, 18);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(-6, -32, 5, 4);
      ctx.fillRect(2, -32, 5, 4);
    } else if (e.type === 'alien') {
      ctx.scale(e.dir * 2, 2);
      const fl = e.flash > 0;
      const wob = Math.sin(frameNo * 0.08 + e.x) * 2;
      ctx.strokeStyle = fl ? '#ffffff' : '#16a34a';
      ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + i * Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 12, Math.sin(a) * 12);
        ctx.lineTo(Math.cos(a) * 20, Math.sin(a) * 20 + wob);
        ctx.lineTo(Math.cos(a) * 26, Math.sin(a) * 26 - wob);
        ctx.stroke();
      }
      ctx.fillStyle = fl ? '#ffffff' : '#22c55e';
      ctx.beginPath(); ctx.ellipse(0, 0, 13, 11, 0, 0, 7); ctx.fill();
      ctx.fillStyle = fl ? '#ffffff' : '#4ade80';
      ctx.beginPath(); ctx.ellipse(0, -4, 9, 7, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath(); ctx.arc(4, -5, 3.5, 0, 7); ctx.fill();
      ctx.fillStyle = '#052e16';
      ctx.beginPath(); ctx.arc(5, -5, 1.6, 0, 7); ctx.fill();
      ctx.fillStyle = fl ? '#ffffff' : '#14532d';
      ctx.fillRect(-6, 8, 4, 4);
      ctx.fillRect(2, 8, 4, 4);
    } else if (e.type === 'hunter') {
      ctx.scale(e.dir * 2, 2);
      const fl = e.flash > 0;
      const wob = Math.sin(frameNo * 0.06 + e.t) * 4;
      ctx.strokeStyle = fl ? '#ffffff' : '#15803d';
      ctx.lineWidth = 6;
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI * 0.75 + i * (Math.PI * 1.5 / 5) + Math.sin(frameNo * 0.05 + i) * 0.15;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 40, Math.sin(a) * 40 + 10);
        ctx.lineTo(Math.cos(a) * 58, Math.sin(a) * 58 + 14 + wob);
        ctx.lineTo(Math.cos(a) * 72, Math.sin(a) * 70 + 20 - wob);
        ctx.stroke();
      }
      ctx.fillStyle = fl ? '#ffffff' : '#16a34a';
      ctx.beginPath(); ctx.ellipse(0, 0, 62, 54, 0, 0, 7); ctx.fill();
      ctx.fillStyle = fl ? '#ffffff' : '#22c55e';
      ctx.beginPath(); ctx.ellipse(0, -18, 46, 34, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath(); ctx.arc(-20, -24, 12, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(20, -24, 12, 0, 7); ctx.fill();
      const look = player ? Math.sign((player.x + player.w / 2) - (e.x + e.w / 2)) : 0;
      ctx.fillStyle = '#7f1d1d';
      ctx.beginPath(); ctx.arc(-20 + look * 4, -24, 5, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(20 + look * 4, -24, 5, 0, 7); ctx.fill();
      ctx.fillStyle = '#052e16';
      ctx.beginPath(); ctx.ellipse(0, 18, 30, 14, 0, 0, Math.PI); ctx.fill();
      ctx.fillStyle = '#f8fafc';
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 11 - 4, 18);
        ctx.lineTo(i * 11, 28);
        ctx.lineTo(i * 11 + 4, 18);
        ctx.closePath(); ctx.fill();
      }
    } else if (e.type === 'turret') {
      const base = e.blue ? '#1e3a8a' : '#450a0a';
      const dome = e.blue ? '#1d4ed8' : '#7f1d1d';
      const barrel = e.blue ? '#3b82f6' : '#b91c1c';
      const tip = e.blue ? '#93c5fd' : '#fbbf24';
      ctx.fillStyle = base;
      ctx.fillRect(-13, 4, 26, 9);
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : dome;
      ctx.fillRect(-9, -6, 18, 12);
      const a = Math.atan2((player.y + player.h / 2) - (e.y + e.h / 2), (player.x + player.w / 2) - (e.x + e.w / 2));
      ctx.scale(2, 2);
      ctx.rotate(a);
      ctx.fillStyle = barrel;
      ctx.fillRect(0, -3, 16, 6);
      ctx.fillStyle = tip;
      ctx.fillRect(12, -2, 4, 4);
    }
    ctx.restore();
  }
}

function drawBullets() {
  for (const b of bullets) {
    if (b.rocket) {
      ctx.fillStyle = 'rgba(255,140,40,0.4)';
      ctx.beginPath(); ctx.arc(b.x, b.y, 11, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffb03d';
      ctx.beginPath(); ctx.arc(b.x, b.y, 6, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff7ed';
      ctx.beginPath(); ctx.arc(b.x - b.vx, b.y - b.vy, 3, 0, 7); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(255,220,80,0.35)';
      ctx.beginPath(); ctx.arc(b.x, b.y, 7, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffe066';
      ctx.beginPath(); ctx.arc(b.x, b.y, 3.5, 0, 7); ctx.fill();
    }
  }
  for (const b of ebullets) {
    if (b.boom) {
      ctx.strokeStyle = '#93c5fd';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(b.x, b.y, 7, 0, 7); ctx.stroke();
      const sa = frameNo * 0.3;
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.x - Math.cos(sa) * 7, b.y - Math.sin(sa) * 7);
      ctx.lineTo(b.x + Math.cos(sa) * 7, b.y + Math.sin(sa) * 7);
      ctx.stroke();
    } else if (b.tentacle) {
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 2, b.y - b.vy * 2);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.fillStyle = '#22c55e';
      ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, 7); ctx.fill();
      ctx.fillStyle = '#bbf7d0';
      ctx.beginPath(); ctx.arc(b.x, b.y, 2.2, 0, 7); ctx.fill();
    } else {
      const rr = b.dmg === 2 ? 6 : 4;
      ctx.fillStyle = 'rgba(255,60,80,0.35)';
      ctx.beginPath(); ctx.arc(b.x, b.y, rr + 4, 0, 7); ctx.fill();
      ctx.fillStyle = '#ff4d5e';
      ctx.beginPath(); ctx.arc(b.x, b.y, rr, 0, 7); ctx.fill();
    }
  }
}

function drawPlayer() {
  const p = player;
  if (!p) return;
  if (p.invuln > 0 && (frameNo >> 2) % 2 === 0) return;
  ctx.save();
  ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
  ctx.scale(p.dir * 2, 2);
  const run = Math.abs(p.vx) > 0.4 && p.onGround;
  const lp = run ? Math.sin(frameNo * 0.35) * 4 : 0;
  const th = theme();
  const water = th === 'water';
  const suit = th === 'station';
  ctx.fillStyle = suit ? '#9ca3af' : water ? '#14532d' : '#3a3a5e';
  ctx.fillRect(-7 + lp, 8, 6, 6);
  ctx.fillRect(1 - lp, 8, 6, 6);
  if (suit) {
    ctx.fillStyle = '#9ca3af';
    ctx.fillRect(-14, -6, 6, 12);
  }
  ctx.fillStyle = suit ? '#e5e7eb' : water ? '#16a34a' : '#e8641c';
  ctx.fillRect(-8, -4, 16, 13);
  ctx.fillStyle = suit ? '#6b7280' : water ? '#15803d' : '#c24e12';
  ctx.fillRect(-8, 4, 16, 5);
  ctx.fillStyle = suit ? '#d1d5db' : water ? '#4ade80' : '#f2a03d';
  ctx.fillRect(-11, -5, 5, 7);
  ctx.fillRect(6, -5, 5, 7);
  ctx.fillStyle = suit ? '#f3f4f6' : '#e8e8f2';
  ctx.fillRect(-7, -14, 14, 10);
  ctx.fillStyle = suit ? '#38bdf8' : water ? '#3b82f6' : '#22d3ee';
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
  ctx.fillStyle = '#a5b4fc';
  ctx.fillText('LV' + level, 225, 18);
  ctx.fillStyle = '#334155';
  ctx.fillRect(280, 10, 100, 14);
  ctx.fillStyle = player.fuel > 0 ? '#38bdf8' : '#1e293b';
  ctx.fillRect(280, 10, 100 * (player.fuel / FUEL_MAX), 14);
  ctx.strokeStyle = '#64748b';
  ctx.strokeRect(280.5, 10.5, 100, 14);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('JET', 284, 20);
  ctx.fillStyle = '#334155';
  ctx.fillRect(390, 10, 100, 14);
  ctx.fillStyle = player.rocketCd <= 0 ? '#fb923c' : '#7c2d12';
  ctx.fillRect(390, 10, 100 * (1 - player.rocketCd / 600), 14);
  ctx.strokeStyle = '#64748b';
  ctx.strokeRect(390.5, 10.5, 100, 14);
  ctx.fillStyle = '#e2e8f0';
  ctx.fillText('RCKT', 394, 20);
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
    'C            jetpack: fly 10s, recharges in 5s',
    'D            rocket: 4x damage, 10s recharge',
    '',
    'Grab orbs, collect the star to upgrade your weapon,',
    'blast the enemies and clear all three sectors through the portals!',
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
  if (state === 'play' || state === 'dying' || state === 'pause' || state === 'levelclear') drawHUD();
  if (state === 'title') {
    drawTitle();
  } else if (state === 'pause') {
    overlay(0.6);
    centerText('PAUSED', H / 2 - 10, 40, '#e2e8f0');
    centerText('P to resume', H / 2 + 36, 16, '#94a3b8');
  } else if (state === 'dying') {
    ctx.fillStyle = 'rgba(255,40,60,' + (stateT / 55) * 0.35 + ')';
    ctx.fillRect(0, 0, W, H);
  } else if (state === 'levelclear') {
    overlay(0.6);
    centerText('LEVEL ' + level + ' CLEAR!', H / 2 - 30, 48, '#22d3ee', true);
    centerText(level === 1 ? 'next: the flooded sector...' : 'next: the space station...', H / 2 + 24, 18, '#a5b4fc');
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

const GAMEKEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyZ', 'KeyX', 'KeyJ', 'KeyA', 'KeyW', 'KeyS', 'Space', 'Enter', 'KeyP', 'KeyR', 'KeyM', 'KeyC', 'KeyD'];

function init() {
  canvas = document.getElementById('game');
  ctx = canvas.getContext('2d');
  stars = makeSky('lava');
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
    get level() { return level; },
    get ebullets() { return ebullets; },
    get bullets() { return bullets; },
    get goal() { return goal; },
    solidAt(tx, ty) { return solid(tx, ty); },
  };
}
})();
