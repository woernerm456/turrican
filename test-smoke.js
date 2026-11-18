'use strict';
const handlers = {};
let rafCb = null;
const noop = () => {};
const gradient = { addColorStop: noop };
const ctxStub = new Proxy({}, {
  get(t, k) {
    if (k === 'createLinearGradient') return () => gradient;
    if (!(k in t)) t[k] = noop;
    return t[k];
  },
  set(t, k, v) { t[k] = v; return true; },
});
const canvasStub = { width: 960, height: 540, style: {}, getContext: () => ctxStub };
global.window = {
  innerWidth: 960,
  innerHeight: 540,
  addEventListener: (type, fn) => { (handlers[type] = handlers[type] || []).push(fn); },
};
global.document = { getElementById: () => canvasStub };
global.requestAnimationFrame = (cb) => { rafCb = cb; };

require('./game.js');

const fire = (type, code) => (handlers[type] || []).forEach(fn => fn({ code, preventDefault: noop }));
const G = global.window.__STARBLASTER__;

fire('load');
let ts = 0;
function step(n) {
  for (let i = 0; i < n; i++) {
    ts += 16.7;
    const cb = rafCb;
    rafCb = null;
    cb(ts);
  }
}

step(10);
console.log('initial state:', G.state);
if (G.state !== 'title') { console.error('FAIL: expected title state'); process.exit(1); }

fire('keydown', 'Enter');
step(5);
console.log('after enter:', G.state);
if (G.state !== 'play') { console.error('FAIL: expected play state'); process.exit(1); }
const x0 = G.player.x;

fire('keydown', 'ArrowRight');
fire('keydown', 'KeyX');
let maxBulletsSeen = 0;
for (let k = 0; k < 50; k++) {
  step(30);
  if (k % 4 === 0) {
    fire('keydown', 'KeyZ');
    step(3);
    fire('keyup', 'KeyZ');
  }
  if (G.state === 'play' && G.player) maxBulletsSeen = Math.max(maxBulletsSeen, 0);
}
fire('keyup', 'ArrowRight');
fire('keyup', 'KeyX');
step(60);

console.log('state:', G.state, '| x:', G.player ? G.player.x.toFixed(1) : 'null', '| start x:', x0.toFixed(1),
  '| score:', G.score, '| hp:', G.player ? G.player.hp : 'null', '| lives:', G.lives, '| cam:', G.cam.x.toFixed(0),
  '| enemies left:', G.enemies.length);

if (!G.player) { console.error('FAIL: player missing'); process.exit(1); }
if (G.player.x <= x0 + 50) { console.error('FAIL: player did not advance'); process.exit(1); }
if (!['play', 'dying', 'gameover', 'win'].includes(G.state)) { console.error('FAIL: bad state ' + G.state); process.exit(1); }

fire('keydown', 'ArrowLeft');
step(30);
fire('keyup', 'ArrowLeft');
fire('keydown', 'ArrowUp');
fire('keydown', 'KeyX');
step(20);
fire('keyup', 'ArrowUp');
fire('keyup', 'KeyX');
fire('keydown', 'KeyP');
step(5);
console.log('paused state:', G.state);
fire('keyup', 'KeyP');
fire('keydown', 'KeyP');
step(5);
console.log('resumed state:', G.state);

console.log('SMOKE OK');
