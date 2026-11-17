# Nightfall Ward

A compact first-person survival shooter that runs in the browser. You hold a ward against waves of the dead, with a magazine you empty faster than you expect and a reload you have to commit to.

Built with **TypeScript**, **Vite** and **Three.js**. No game engine, no physics library, no asset pipeline. The arena, the enemies, the effects and the audio are all generated in code.

**Play it:** https://arjun-sivasankar.github.io/Nightfall-Ward/

## What it is

Nightfall Ward is a study in the parts of game feel that are easy to skip when you are only writing code. How hard a camera should recoil. How long a reload should actually take before it stops being tense and starts being annoying. How much a headshot multiplier changes the rhythm of a fight, and how a wave announcement buys a player two seconds to breathe.

It is deliberately small: one arena, one weapon, three enemy types, three difficulties.

## Controls

| Input | Action |
|---|---|
| `W` `A` `S` `D` | Move |
| `Shift` | Sprint |
| Mouse | Look (after pointer lock) |
| Left mouse button | Fire |
| `R` | Reload |
| `Esc` | Pause / release pointer lock |
| `F3` | Toggle debug view: hitboxes, shot ray, FPS |

Mouse sensitivity, mute state and the last difficulty are remembered between sessions in `localStorage`.

## Systems

- **Waves** — a wave announces itself, spawns up to 30 enemies, then runs a break before the next. Wave size and enemy stats scale with difficulty.
- **Enemies** — three types. `walker` is the baseline, `runner` is smaller and faster, `tank` is larger and tougher.
- **Difficulty** — `easy`, `normal` and `hard` adjust player damage, enemy health, enemy damage, enemy speed, wave size, spawn rate and the length of the break between waves.
- **Weapon** — a 30-round magazine with 120 in reserve, a 0.105 s fire interval, 31 body damage and a 1.85× headshot multiplier. The reload takes 1.65 s and cannot be cancelled.
- **Scoring** — 100 points for a body shot, 150 for a headshot.
- **Pause on focus loss** — losing pointer lock pauses the game, so you never come back to a dead player.
- **Debug view** — `F3` draws enemy hitboxes and the shot ray. This is how the collision and hit detection were tuned.

## Architecture

```
src/
├── main.ts                 entry point, wires canvas, HUD and menu
├── game/
│   ├── Game.ts             loop, state machine, raycast hit detection
│   ├── Player.ts           movement, health, camera
│   ├── Weapon.ts           ammo, fire interval, reload, recoil
│   ├── Zombie.ts           enemy behaviour by type
│   ├── WaveManager.ts      state machine: announce, spawn, combat, break
│   ├── Collision.ts        arena and obstacle collision
│   ├── Effects.ts          particle bursts on impact
│   ├── Audio.ts            synthesised effects through the Web Audio API
│   ├── Input.ts            keyboard and mouse, pointer lock
│   ├── storage.ts          persisted settings
│   └── constants.ts        every tuning number in one place
├── ui/
│   ├── HUD.ts              health, ammo, score, wave
│   └── Menu.ts             main menu, pause, difficulty, settings
└── styles/main.css
```

Every gameplay number lives in `constants.ts` — damage, fire interval, reload time, wave size, enemy stats, arena bounds, fog range. Tuning the game never means hunting through logic.

The arena is 48 × 36 units inside fog that ends at 66, which keeps the draw distance honest and hides the fact that the world is a box.

## Run locally

```bash
npm install
npm run dev
```

Production build and verification:

```bash
npm run build     # tsc --noEmit, then vite build
npm run preview
```

Requires a current Node LTS release and a browser with WebGL and pointer-lock support.

## Notes and limitations

- Pointer lock makes this desktop-first. It expects a keyboard and a mouse, and it does not pretend otherwise.
- No external art. Enemies and arena are primitives; audio is synthesised with the Web Audio API; effects are capped particle bursts.
- Enemies use simple seek-and-attack behaviour with no navigation mesh. The arena is open enough that this holds up, and it would not in a corridor-heavy map.

## License

MIT — see [LICENSE](LICENSE).
