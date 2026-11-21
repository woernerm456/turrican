'use strict';
const handlers = {};
let rafCb = null;
const noop = () => {};
const gradient = { addColorStop: noop };
const ctxStub = new Proxy({}, {
  get(t, k) { if (k === 'createLinearGradient') return () => gradient; if (!(k in t)) t[k] = noop; return t[k]; },
  set(t, k, v) { t[k] = v; return true; },
});
const canvasStub = { width: 960, height: 540, style: {}, getContext: () => ctxStub };
global.window = { innerWidth: 960, innerHeight: 540, addEventListener: (t, f) => { (handlers[t] = handlers[t] || []).push(f); } };
global.document = { getElementById: () => canvasStub };
global.requestAnimationFrame = (cb) => { rafCb = cb; };
require('./game.js');
const fire = (type, code) => (handlers[type] || []).forEach(fn => fn({ code, preventDefault: noop }));
const G = global.window.__STARBLASTER__;

const TILE = 32, ROWS = 17, COLS = 160;
let ts = 0;
function step(n) { for (let i = 0; i < n; i++) { ts += 16.7; const cb = rafCb; rafCb = null; cb(ts); } }

function snapshot(label) {
  const p = G.player;
  const camX = G.cam.x;
  const safeSolid = (x, y) => {
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return true;
    try { return G.solidAt(x, y); } catch (e) { return false; }
  };
  const x0 = Math.floor(camX / TILE), x1 = Math.min(COLS - 1, x0 + 30);
  const rows = [];
  for (let y = 0; y < ROWS; y++) {
    let line = '';
    for (let x = x0; x <= x1; x++) {
      let ch = safeSolid(x, y) ? '#' : ' ';
      for (const e of G.enemies) {
        if (!e.dead && Math.floor((e.x + e.w / 2) / TILE) === x && Math.floor((e.y + e.h / 2) / TILE) === y) {
          ch = e.type === 'walker' ? 'w' : e.type === 'flyer' ? 'f' : e.type === 'turret' ? 't' : e.type === 'fish' ? (e.big ? 'F' : 's') : e.type === 'robot' ? 'r' : (e.big ? 'D' : 'd');
        }
      }
      if (p && Math.floor((p.x + p.w / 2) / TILE) === x && Math.floor((p.y + p.h / 2) / TILE) === y) ch = '@';
      rows[y] = null;
      line += ch;
    }
    rows[y] = line;
  }
  console.log('=== ' + label + ' ===  state=' + G.state + '  score=' + G.score + '  hp=' + (p ? p.hp : '-') +
    '  lives=' + G.lives + '  wpn=' + (p ? p.weapon : '-') + '  x=' + (p ? p.x.toFixed(0) : '-'));
  for (let y = 0; y < ROWS; y++) console.log('  ' + rows[y]);
  console.log('');
}

fire('load');
step(5);
snapshot('TITLE SCREEN (world not started yet)');
fire('keydown', 'Enter');
fire('keydown', 'ArrowRight');
fire('keydown', 'KeyX');
step(5);
snapshot('START OF LEVEL (holding right + fire)');

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
    const pitAhead = p.onGround && !safeSolidProbe(aheadX, footY) && footY < ROWS;
    const wallAhead = p.onGround && safeSolidProbe(aheadX, midY);
    if (blocked || pitAhead || wallAhead) {
      fire('keydown', 'KeyZ');
      step(20);
      fire('keyup', 'KeyZ');
      continue;
    }
  }
  step(1);
  if (!snapMid && p && p.x > 1900) { snapMid = true; snapshot('MID-LEVEL (~x ' + p.x.toFixed(0) + ')'); }
  if (!snapLate && p && p.x > 3900) { snapLate = true; snapshot('LATE LEVEL (~x ' + p.x.toFixed(0) + ')'); }
}
function safeSolidProbe(x, y) {
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return true;
  try { return G.solidAt(x, y); } catch (e) { return false; }
}
fire('keyup', 'ArrowRight');
fire('keyup', 'KeyX');
step(30);
snapshot('END: state=' + G.state + ' (score ' + G.score + ')');
console.log('DEMO DONE');
