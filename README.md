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
| Gamepad (standard mapping) | left stick / D-pad = move & aim, A (bottom) = jump, B/X or RT = fire, RB = jetpack, LT = rocket, START = start/restart, SELECT = pause, LB = mute |
| C | **Jetpack**: fly for 10 s, then recharges over 5 s (JET fuel bar in HUD) |
| D | **Rocket launcher**: 4× the damage of a normal shot, 10 s recharge (RCKT bar in HUD) |

The player is twice as big as before; normal shots now deal half damage (0.5 per hit), rockets deal 4× that (2.0).

## Features

- Fixed-timestep physics: run, variable-height jump, coyote time, jump buffering
- 8-directional shooting with 3 weapon levels (single → twin → triple spread),
  upgraded by collecting the orange star pickup
- 4 enemy types: ground walkers, flying bats, aimed turrets, and "Dreher"
  wheels — rotating dark-red wheels that chase you and fire radial bursts in all 8 directions
- plus a big "Dreher" near the end of each level: double HP (8), fires 3x as fast, 1000 pts
- Three levels, each reached through a portal: level 1 lava sector, level 2 a
  flooded water sector (blue water background, light rays, bubbles, sand floor;
  the player wears a green/blue outfit there), level 3 a space station (dark hull,
  big windows with a starry sky and a planet, blinking lights, metal floor; the
  player wears a white space suit with helmet visor and backpack)
- Level 2 enemies: green fish that swim at you and bite on contact, a "Riesen-Fisch"
  (giant fish, 8 HP) near the end that fires an aimed shot every second, blue cannons
  that fire two shots per volley, and 5 ground robots that throw a boomerang disc
  at you which flies to you and returns to the robot
- Level 3 (space station) has no regular units — only a giant robot **boss** at the
  end (128×128, 40 HP): it hovers toward you and fires a 16-way radial burst every
  2 seconds; each of its bullets deals 2 HP damage. 5000 pts
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
