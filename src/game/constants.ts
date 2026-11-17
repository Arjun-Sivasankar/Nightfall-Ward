import type { Difficulty, DifficultyConfig } from './types';

export const ARENA_HALF_X = 24;
export const ARENA_HALF_Z = 18;
export const PLAYER_RADIUS = 0.42;
export const PLAYER_EYE_HEIGHT = 1.72;
export const PLAYER_MAX_HEALTH = 100;
export const PLAYER_WALK_SPEED = 5.8;
export const PLAYER_SPRINT_SPEED = 8.8;
export const DEFAULT_SENSITIVITY = 1.0;
export const MIN_SENSITIVITY = 0.35;
export const MAX_SENSITIVITY = 2.2;
export const WORLD_FOG_NEAR = 26;
export const WORLD_FOG_FAR = 66;
export const MAX_WAVE_ENEMIES = 30;

export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  easy: {
    label: 'Easy',
    playerDamage: 1.15,
    zombieHealth: 0.85,
    zombieDamage: 0.75,
    zombieSpeed: 0.9,
    waveSize: 0.82,
    spawnRate: 1.18,
    breakTime: 5.5,
  },
  normal: {
    label: 'Normal',
    playerDamage: 1,
    zombieHealth: 1,
    zombieDamage: 1,
    zombieSpeed: 1,
    waveSize: 1,
    spawnRate: 1,
    breakTime: 4.2,
  },
  hard: {
    label: 'Hard',
    playerDamage: 0.9,
    zombieHealth: 1.2,
    zombieDamage: 1.25,
    zombieSpeed: 1.1,
    waveSize: 1.18,
    spawnRate: 0.82,
    breakTime: 3.1,
  },
};

export const WEAPON = {
  magazineSize: 30,
  startingReserve: 120,
  fireInterval: 0.105,
  reloadTime: 1.65,
  bodyDamage: 31,
  headshotMultiplier: 1.85,
};

export const COLORS = {
  void: 0x07090f,
  floor: 0x171d27,
  floorLine: 0x283242,
  wall: 0x303947,
  wallEdge: 0x536173,
  hazard: 0xd76d3d,
  cyan: 0x62d9d5,
  cyanBright: 0xb8fff4,
  zombie: 0x6c9c79,
  zombieDark: 0x253934,
  zombieHead: 0x9abb7e,
  runner: 0xc28b61,
  tank: 0x8a647c,
  blood: 0xf06165,
  muzzle: 0xffb45a,
};
