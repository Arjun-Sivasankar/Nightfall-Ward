import { DIFFICULTIES, MAX_WAVE_ENEMIES } from './constants';
import type { Difficulty, DifficultyConfig, ZombieConfig, ZombieType } from './types';

interface WaveCallbacks {
  spawn: (config: ZombieConfig) => void;
  announce: (wave: number) => void;
  gameplayStart: () => void;
  waveBreak: (wave: number, bonus: number) => void;
}

type WaveMode = 'idle' | 'announcement' | 'spawning' | 'combat' | 'break';

export class WaveManager {
  private readonly getZombieCount: () => number;
  private readonly callbacks: WaveCallbacks;
  private difficulty: Difficulty = 'normal';
  private config: DifficultyConfig = DIFFICULTIES.normal;
  private mode: WaveMode = 'idle';
  private announcementTimer = 0;
  private breakTimer = 0;
  private spawnTimer = 0;
  private spawnRemaining = 0;
  private _wave = 0;

  constructor(getZombieCount: () => number, callbacks: WaveCallbacks) {
    this.getZombieCount = getZombieCount;
    this.callbacks = callbacks;
  }

  reset(difficulty: Difficulty): void {
    this.difficulty = difficulty;
    this.config = DIFFICULTIES[difficulty];
    this.mode = 'idle';
    this.announcementTimer = 0;
    this.breakTimer = 0;
    this.spawnTimer = 0;
    this.spawnRemaining = 0;
    this._wave = 0;
  }

  start(): void {
    this.beginWave(1);
  }

  update(dt: number): void {
    if (this.mode === 'announcement') {
      this.announcementTimer -= dt;
      if (this.announcementTimer <= 0) {
        this.mode = 'spawning';
        this.spawnTimer = 0.15;
        this.callbacks.gameplayStart();
      }
      return;
    }

    if (this.mode === 'spawning') {
      this.spawnTimer -= dt;
      if (this.spawnRemaining > 0 && this.spawnTimer <= 0) {
        this.callbacks.spawn(this.createZombieConfig());
        this.spawnRemaining -= 1;
        const baseDelay = Math.max(0.24, 0.82 - this._wave * 0.035);
        this.spawnTimer = baseDelay * this.config.spawnRate;
      }
      if (this.spawnRemaining <= 0) this.mode = 'combat';
      return;
    }

    if (this.mode === 'combat' && this.spawnRemaining === 0 && this.getZombieCount() === 0) {
      this.mode = 'break';
      this.breakTimer = this.config.breakTime;
      const bonus = 250 + this._wave * 100;
      this.callbacks.waveBreak(this._wave, bonus);
      return;
    }

    if (this.mode === 'break') {
      this.breakTimer -= dt;
      if (this.breakTimer <= 0) this.beginWave(this._wave + 1);
    }
  }

  get wave(): number {
    return this._wave;
  }

  get remainingToSpawn(): number {
    return this.spawnRemaining;
  }

  get isBreak(): boolean {
    return this.mode === 'announcement' || this.mode === 'break';
  }

  private beginWave(wave: number): void {
    this._wave = wave;
    const baseCount = 4 + wave * 2;
    // Keep late waves dangerous through stats while capping the active crowd for 60 FPS.
    this.spawnRemaining = Math.max(4, Math.min(MAX_WAVE_ENEMIES, Math.round(baseCount * this.config.waveSize)));
    this.spawnTimer = 0;
    this.announcementTimer = 1.45;
    this.mode = 'announcement';
    this.callbacks.announce(wave);
  }

  private createZombieConfig(): ZombieConfig {
    const wave = this._wave;
    let type: ZombieType = 'walker';
    if (wave >= 3 && wave % 3 === 0 && this.spawnRemaining === 1) type = 'tank';
    else if (wave >= 2 && Math.random() < Math.min(0.33, 0.08 + wave * 0.018)) type = 'runner';

    const typeHealth = type === 'tank' ? 2.7 : type === 'runner' ? 0.65 : 1;
    const typeSpeed = type === 'tank' ? 0.58 : type === 'runner' ? 1.58 : 1;
    const typeDamage = type === 'tank' ? 1.55 : type === 'runner' ? 0.82 : 1;
    const tint = type === 'tank' ? 0x8a647c : type === 'runner' ? 0xc28b61 : 0x6c9c79;
    return {
      wave,
      type,
      health: 82 * Math.pow(1.055, wave - 1) * typeHealth * this.config.zombieHealth,
      speed: (1.45 + Math.min(1.45, wave * 0.075)) * typeSpeed * this.config.zombieSpeed,
      damage: (7 + wave * 0.62) * typeDamage * this.config.zombieDamage,
      attackCooldown: Math.max(0.7, 1.55 - wave * 0.025),
      attackRange: type === 'tank' ? 1.75 : 1.52,
      radius: type === 'tank' ? 0.58 : type === 'runner' ? 0.34 : 0.43,
      tint,
    };
  }
}
