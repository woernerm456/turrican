# STARBLASTER — a Turrican-style HTML5 run & gun

A side-scrolling jump-and-run shooter inspired by Turrican, written in plain
HTML5 canvas + JavaScript. No build step, no dependencies — just open
`index.html` in any modern browser.

## Controls

| Key | Action |
| --- | --- |
| ← → or A / D | run |
| ↑ ↓ or W / S | aim |
| Z or Space | jump (hold for a higher jump) |
| X or J | fire — combine with the direction keys for 8-way shots, Turrican style |
| Enter | start |
| P | pause |
| M | mute |
| R | restart (on the win / game-over screens) |

## Features

- Fixed-timestep physics: run, variable-height jump, coyote time, jump buffering
- 8-directional shooting with 3 weapon levels (single → twin → triple spread),
  upgraded by collecting the orange star pickup
- 3 enemy types: ground walkers, flying bats, and aimed turrets
- Spike pits, score orbs, big orbs, health pickups, weapon upgrades
- Animated fire & lava background everywhere (ember sky, basalt ridges, lava sea), screen shake, particles, floating score text
- WebAudio chiptune-style sound effects (mutable with M)
- HUD with hearts, lives, weapon level and score; title, pause, dying, game-over and win screens
- One hand-designed level (~160 tiles wide) ending in a portal

## Files

- `index.html` — page shell and canvas
- `game.js` — the whole game (level, physics, AI, rendering, audio)
- `test-smoke.js` — headless smoke test (`node test-smoke.js`) that stubs the DOM,
  runs simulated play and asserts the player moves and nothing throws
- `run-demo.js` — headless ASCII playthrough (`node run-demo.js`) that prints
  tile-based frames of a bot beating the level
- `render-shot.js` — headless screenshot renderer (`node render-shot.js`) that
  rasterizes the real canvas output and writes PNG frames to `shots/`
