'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const W = 960, H = 540;

const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t;
})();
function crc32(buf) { let c = -1; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(rgba, w, h) {
  const stride = w * 4 + 1;
  const raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * stride + 1);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const FONT = {
  A: ['01110','10001','10001','11111','10001','10001','10001'], B: ['11110','10001','10001','11110','10001','10001','11110'],
  C: ['01110','10001','10000','10000','10000','10001','01110'], D: ['11110','10001','10001','10001','10001','10001','11110'],
  E: ['11111','10000','10000','11110','10000','10000','11111'], F: ['11111','10000','10000','11110','10000','10000','10000'],
  G: ['01110','10001','10000','10111','10001','10001','01111'], H: ['10001','10001','10001','11111','10001','10001','10001'],
  I: ['01110','00100','00100','00100','00100','00100','01110'], J: ['00111','00010','00010','00010','00010','10010','01100'],
  K: ['10001','10010','10100','11000','10100','10010','10001'], L: ['10000','10000','10000','10000','10000','10000','11111'],
  M: ['10001','11011','10101','10101','10001','10001','10001'], N: ['10001','11001','10101','10011','10001','10001','10001'],
  O: ['01110','10001','10001','10001','10001','10001','01110'], P: ['11110','10001','10001','11110','10000','10000','10000'],
  Q: ['01110','10001','10001','10001','10101','10010','01101'], R: ['11110','10001','10001','11110','10100','10010','10001'],
  S: ['01111','10000','10000','01110','00001','00001','11110'], T: ['11111','00100','00100','00100','00100','00100','00100'],
  U: ['10001','10001','10001','10001','10001','10001','01110'], V: ['10001','10001','10001','10001','10001','01010','00100'],
  W: ['10001','10001','10001','10101','10101','11011','10001'], X: ['10001','10001','01010','00100','01010','10001','10001'],
  Y: ['10001','10001','01010','00100','00100','00100','00100'], Z: ['11111','00001','00010','00100','01000','10000','11111'],
  '0': ['01110','10001','10011','10101','11001','10001','01110'], '1': ['00100','01100','00100','00100','00100','00100','01110'],
  '2': ['01110','10001','00001','00110','01000','10000','11111'], '3': ['11110','00001','00001','01110','00001','00001','11110'],
  '4': ['00010','00110','01010','10010','11111','00010','00010'], '5': ['11111','10000','11110','00001','00001','10001','01110'],
  '6': ['00110','01000','10000','11110','10001','10001','01110'], '7': ['11111','00001','00010','00100','01000','01000','01000'],
  '8': ['01110','10001','10001','01110','10001','10001','01110'], '9': ['01110','10001','10001','01111','00001','00010','01100'],
  ' ': ['00000','00000','00000','00000','00000','00000','00000'], '+': ['00000','00100','00100','11111','00100','00100','00000'],
  '-': ['00000','00000','00000','11111','00000','00000','00000'], '/': ['00001','00010','00010','00100','01000','01000','10000'],
  ':': ['00000','00100','00100','00000','00100','00100','00000'], '.': ['00000','00000','00000','00000','00000','00110','00110'],
  '(': ['00010','00100','01000','01000','01000','00100','00010'], ')': ['00100','00010','00001','00001','00001','00010','00100'],
  '&': ['01100','10010','10100','01000','10101','10010','01101'], ',': ['00000','00000','00000','00000','00110','00100','01000'],
  '!': ['00100','00100','00100','00100','00100','00000','00100'], '?': ['01110','10001','00001','00110','00100','00000','00100'],
  '♥': ['01010','11111','11111','11111','01110','00100','00000'],
};

function parseColor(s) {
  if (s && typeof s === 'object') return s;
  if (typeof s === 'string' && s[0] === '#') {
    let hex = s.slice(1);
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16), a: 1 };
  }
  const mm = typeof s === 'string' && s.match(/rgba?\(([^)]+)\)/);
  if (mm) { const p = mm[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; }
  return { r: 0, g: 0, b: 0, a: 1 };
}

function makeCtx(buf, w, h, canvasStub) {
  const S = { fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1, globalAlpha: 1, font: '10px monospace', textAlign: 'left', textBaseline: 'alphabetic', lineCap: 'butt', shadowColor: '#000', shadowBlur: 0 };
  const stack = [];
  let m = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  let subpaths = [];
  let cur = null;
  let shot = false;

  function applyM(x, y) { return [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]; }
  function mulM(m2) {
    m = { a: m.a * m2.a + m.c * m2.b, b: m.b * m2.a + m.d * m2.b, c: m.a * m2.c + m.c * m2.d, d: m.b * m2.c + m.d * m2.d, e: m.a * m2.e + m.c * m2.f + m.e, f: m.b * m2.e + m.d * m2.f + m.f };
  }
  function plot(x, y, c) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const a = c.a * S.globalAlpha;
    if (a <= 0) return;
    const i = (y * w + x) * 4;
    const ia = 1 - a;
    buf[i] = Math.round(c.r * a + buf[i] * ia);
    buf[i + 1] = Math.round(c.g * a + buf[i + 1] * ia);
    buf[i + 2] = Math.round(c.b * a + buf[i + 2] * ia);
    buf[i + 3] = 255;
  }
  function devPts(pts) { return pts.map(p => applyM(p[0], p[1])); }
  function colorAt(style, y) {
    if (style && style.stops) {
      const t = Math.max(0, Math.min(1, (y - style.y0) / ((style.y1 - style.y0) || 1)));
      const st = style.stops;
      let i = 0;
      while (i < st.length - 1 && st[i + 1][0] < t) i++;
      const [p0, c0] = st[i], [p1, c1] = st[Math.min(i + 1, st.length - 1)];
      const f = (t - p0) / ((p1 - p0) || 1);
      return { r: c0.r + (c1.r - c0.r) * f, g: c0.g + (c1.g - c0.g) * f, b: c0.b + (c1.b - c0.b) * f, a: (c0.a + (c1.a - c0.a) * f) };
    }
    return style;
  }
  function fill() {
    if (!shot) { subpaths = []; return; }
    const edges = [];
    let minY = 1e9, maxY = -1e9;
    for (const sp of subpaths) {
      const pts = devPts(sp.pts);
      const n = sp.closed ? pts.length : pts.length - 1;
      for (let i = 0; i < n; i++) {
        const p = pts[i], q = pts[(i + 1) % pts.length];
        edges.push([p, q]);
        if (p[1] < minY) minY = p[1];
        if (q[1] < minY) minY = q[1];
        if (p[1] > maxY) maxY = p[1];
        if (q[1] > maxY) maxY = q[1];
      }
    }
    const style = parseColor(S.fillStyle);
    const y0 = Math.max(0, Math.floor(minY)), y1 = Math.min(h - 1, Math.ceil(maxY));
    for (let y = y0; y <= y1; y++) {
      const ys = y + 0.5;
      const xs = [];
      for (const [p, q] of edges) {
        if ((p[1] <= ys && q[1] > ys) || (q[1] <= ys && p[1] > ys)) {
          xs.push(p[0] + (ys - p[1]) / (q[1] - p[1]) * (q[0] - p[0]));
        }
      }
      xs.sort((a, b) => a - b);
      const col = colorAt(style, ys);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const xa = Math.max(0, Math.ceil(xs[i] - 0.5)), xb = Math.min(w - 1, Math.floor(xs[i + 1] - 0.5));
        for (let x = xa; x <= xb; x++) plot(x, y, col);
      }
    }
    subpaths = [];
  }
  function stroke() {
    if (!shot) { subpaths = []; return; }
    const style = parseColor(S.strokeStyle);
    const lw = Math.max(1, S.lineWidth);
    const r = lw / 2;
    for (const sp of subpaths) {
      const pts = devPts(sp.pts);
      const n = sp.closed ? pts.length : pts.length - 1;
      for (let i = 0; i < n; i++) {
        const p = pts[i], q = pts[(i + 1) % pts.length];
        const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
        const steps = Math.max(1, Math.ceil(d / Math.max(1, r / 2)));
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const cx = p[0] + (q[0] - p[0]) * t, cy = p[1] + (q[1] - p[1]) * t;
          const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(w - 1, Math.ceil(cx + r));
          const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(h - 1, Math.ceil(cy + r));
          for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
            const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
            if (dx * dx + dy * dy <= r * r) plot(x, y, style);
          }
        }
      }
    }
    subpaths = [];
  }
  function rectSub(x, y, rw, rh) { return { pts: [[x, y], [x + rw, y], [x + rw, y + rh], [x, y + rh]], closed: true }; }
  function text(str, x, y) {
    if (!shot) return;
    const px = parseInt((S.font.match(/(\d+)px/) || [0, 10])[1], 10) || 10;
    const sc = px / 7;
    const s = String(str).toUpperCase();
    const total = s.length * 6 * sc;
    let sx = x;
    if (S.textAlign === 'center') sx = x - total / 2;
    else if (S.textAlign === 'right') sx = x - total;
    let sy = y;
    if (S.textBaseline === 'middle') sy = y - 3.5 * sc;
    const style = parseColor(S.fillStyle);
    for (let ci = 0; ci < s.length; ci++) {
      const g = FONT[s[ci]] || FONT['?'];
      const ox = sx + ci * 6 * sc, oy = sy;
      const [dx, dy] = applyM(ox, oy);
      for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) {
        if (g[r][c] === '1') {
          const x0 = Math.round(dx + c * sc * m.a), y0 = Math.round(dy + r * sc * m.d);
          const x1 = Math.round(dx + (c + 1) * sc * m.a), y1 = Math.round(dy + (r + 1) * sc * m.d);
          for (let yy = Math.min(y0, y1); yy < Math.max(y0, y1); yy++) for (let xx = Math.min(x0, x1); xx < Math.max(x0, x1); xx++) plot(xx, yy, style);
        }
      }
    }
  }

  const api = {};
  for (const k of Object.keys(S)) {
    Object.defineProperty(api, k, { get: () => S[k], set: v => { S[k] = v; } });
  }
  api.canvas = canvasStub;
  api.setShot = v => { shot = v; };
  api.save = () => { stack.push({ m: { ...m }, S: { ...S } }); };
  api.restore = () => { const s = stack.pop(); if (s) { m = s.m; Object.assign(S, s.S); } };
  api.translate = (x, y) => mulM({ a: 1, b: 0, c: 0, d: 1, e: x, f: y });
  api.scale = (x, y) => mulM({ a: x, b: 0, c: 0, d: y, e: 0, f: 0 });
  api.rotate = a => { const c = Math.cos(a), s = Math.sin(a); mulM({ a: c, b: s, c: -s, d: c, e: 0, f: 0 }); };
  api.beginPath = () => { subpaths = []; cur = null; };
  api.moveTo = (x, y) => { cur = { pts: [[x, y]], closed: false }; subpaths.push(cur); };
  api.lineTo = (x, y) => { if (!cur) api.moveTo(x, y); else cur.pts.push([x, y]); };
  api.closePath = () => { if (cur) cur.closed = true; };
  api.arc = (x, y, r, a0, a1) => {
    const steps = 28;
    for (let i = 0; i <= steps; i++) {
      const a = a0 + (a1 - a0) * i / steps;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (i === 0) api.moveTo(px, py); else api.lineTo(px, py);
    }
  };
  api.ellipse = (x, y, rx, ry, rot, a0, a1) => {
    const steps = 36;
    const cr = Math.cos(rot), sr = Math.sin(rot);
    for (let i = 0; i <= steps; i++) {
      const a = a0 + (a1 - a0) * i / steps;
      const ex = Math.cos(a) * rx, ey = Math.sin(a) * ry;
      const px = x + ex * cr - ey * sr, py = y + ex * sr + ey * cr;
      if (i === 0) api.moveTo(px, py); else api.lineTo(px, py);
    }
  };
  api.fill = fill;
  api.stroke = stroke;
  api.fillRect = (x, y, rw, rh) => { subpaths = [rectSub(x, y, rw, rh)]; fill(); };
  api.strokeRect = (x, y, rw, rh) => { subpaths = [rectSub(x, y, rw, rh)]; stroke(); };
  api.clearRect = (x, y, rw, rh) => { if (!shot) return; const c = { r: 0, g: 0, b: 0, a: 1 }; const pts = devPts(rectSub(x, y, rw, rh).pts); const x0 = Math.max(0, Math.floor(Math.min(...pts.map(p => p[0])))), x1 = Math.min(w - 1, Math.ceil(Math.max(...pts.map(p => p[0])))); const y0 = Math.max(0, Math.floor(Math.min(...pts.map(p => p[1])))), y1 = Math.min(h - 1, Math.ceil(Math.max(...pts.map(p => p[1])))); for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) plot(xx, yy, c); };
  api.fillText = text;
  api.strokeText = () => {};
  api.createLinearGradient = (x0, y0, x1, y1) => {
    const g = { stops: [], y0, y1, addColorStop(o, c) { this.stops.push([o, parseColor(c)]); } };
    return g;
  };
  return api;
}

const buf = Buffer.alloc(W * H * 4, 0);
const handlers = {};
let rafCb = null;
const noop = () => {};
const canvasStub = { width: W, height: H, style: {} };
const ctx = makeCtx(buf, W, H, canvasStub);
canvasStub.getContext = () => ctx;
global.window = { innerWidth: W, innerHeight: H, addEventListener: (t, f) => { (handlers[t] = handlers[t] || []).push(f); } };
global.document = { getElementById: () => canvasStub };
global.requestAnimationFrame = cb => { rafCb = cb; };

require('./game.js');
const fire = (type, code) => (handlers[type] || []).forEach(fn => fn({ code, preventDefault: noop }));
const G = global.window.__STARBLASTER__;

const TILE = 32, ROWS = 17, COLS = 160;
let ts = 0;
function step(n) { for (let i = 0; i < n; i++) { ts += 16.7; const cb = rafCb; rafCb = null; cb(ts); } }

const outDir = path.join(__dirname, 'shots');
fs.mkdirSync(outDir, { recursive: true });
let shotIdx = 0;
function capture(label) {
  ctx.setShot(true);
  step(1);
  ctx.setShot(false);
  const file = path.join(outDir, 'frame-' + String(shotIdx++).padStart(2, '0') + '-' + label + '.png');
  fs.writeFileSync(file, encodePNG(buf, W, H));
  console.log('saved', file);
  asciiPreview(label);
}

function asciiPreview(label) {
  const p = G.player;
  const camX = G.cam.x;
  const x0 = Math.max(0, Math.floor(camX / TILE)), x1 = Math.min(COLS - 1, x0 + 30);
  console.log('=== ' + label + ' === state=' + G.state + ' score=' + G.score + ' hp=' + (p ? p.hp : '-') + ' lives=' + G.lives + ' wpn=' + (p ? p.weapon : '-') + ' x=' + (p ? p.x.toFixed(0) : '-'));
  for (let y = 0; y < ROWS; y++) {
    let line = '';
    for (let x = x0; x <= x1; x++) {
      let ch = ' ';
      if (x < 0 || x >= COLS || y < 0 || y >= ROWS) ch = '#';
      else { try { if (G.solidAt(x, y)) ch = '#'; } catch (e) {} }
      if (ch === ' ') {
        for (const e of G.enemies) {
          if (!e.dead && Math.floor((e.x + e.w / 2) / TILE) === x && Math.floor((e.y + e.h / 2) / TILE) === y) {
            ch = e.type === 'walker' ? 'w' : e.type === 'flyer' ? 'f' : e.type === 'turret' ? 't' : e.type === 'fish' ? (e.big ? 'F' : 's') : e.type === 'robot' ? 'r' : e.type === 'alien' ? 'a' : e.type === 'boss' ? 'B' : e.type === 'hunter' ? 'X' : e.type === 'snake' ? 'S' : e.type === 'scorpion' ? 'k' : (e.big ? 'D' : 'd');
          }
        }
      }
      if (p && Math.floor((p.x + p.w / 2) / TILE) === x && Math.floor((p.y + p.h / 2) / TILE) === y) ch = '@';
      line += ch;
    }
    console.log('  ' + line);
  }
  console.log('');
}

fire('load');
step(5);
capture('title');
fire('keydown', 'Enter');
fire('keydown', 'ArrowRight');
fire('keydown', 'KeyX');
step(30);
capture('start');

let snapMid = false, snapLate = false;
for (let i = 0; i < 40000; i++) {
  const p = G.player;
  if (!p) break;
  if (G.state === 'win' || G.state === 'gameover') break;
  if (G.state === 'play') {
    const aheadX = Math.floor((p.x + p.w + 6) / TILE);
    const footY = Math.floor((p.y + p.h + 4) / TILE);
    const midY = Math.floor((p.y + p.h / 2) / TILE);
    const blocked = Math.abs(p.vx) < 0.3 && p.onGround;
    const pitAhead = p.onGround && footY < ROWS && !G.solidAt(aheadX, footY);
    const wallAhead = p.onGround && G.solidAt(aheadX, midY);
    if (blocked || pitAhead || wallAhead) {
      fire('keydown', 'KeyZ');
      step(20);
      fire('keyup', 'KeyZ');
      continue;
    }
  }
  step(1);
  if (!snapMid && G.player && G.player.x > 1900) { snapMid = true; capture('mid'); }
  if (!snapLate && G.player && G.player.x > 3900) { snapLate = true; capture('late'); }
}
fire('keyup', 'ArrowRight');
fire('keyup', 'KeyX');
step(30);
capture('end-' + G.state);
console.log('RENDER DONE');
