import * as THREE from 'three';

export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  WAVE_BREAK = 'WAVE_BREAK',
  GAME_OVER = 'GAME_OVER',
}

export type Difficulty = 'easy' | 'normal' | 'hard';
export type ZombieType = 'walker' | 'runner' | 'tank';

export interface DifficultyConfig {
  label: string;
  playerDamage: number;
  zombieHealth: number;
  zombieDamage: number;
  zombieSpeed: number;
  waveSize: number;
  spawnRate: number;
  breakTime: number;
}

export interface ArenaBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface ZombieConfig {
  wave: number;
  type: ZombieType;
  health: number;
  speed: number;
  damage: number;
  attackCooldown: number;
  attackRange: number;
  radius: number;
  tint: number;
}

export interface GameStats {
  score: number;
  kills: number;
  headshots: number;
  shotsFired: number;
  shotsHit: number;
  wave: number;
}

export interface HitResult {
  point: THREE.Vector3;
  zombie?: import('./Zombie').Zombie;
  headshot: boolean;
}
