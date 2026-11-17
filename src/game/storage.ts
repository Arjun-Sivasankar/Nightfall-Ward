import {
  DEFAULT_SENSITIVITY,
  MAX_SENSITIVITY,
  MIN_SENSITIVITY,
} from './constants';
import type { Difficulty } from './types';

const SENSITIVITY_KEY = 'nightfall-ward:sensitivity';
const DIFFICULTY_KEY = 'nightfall-ward:difficulty';
const MUTE_KEY = 'nightfall-ward:muted';

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be disabled in private browsing; gameplay still works.
  }
}

export function loadSensitivity(): number {
  const stored = Number(read(SENSITIVITY_KEY));
  return Number.isFinite(stored)
    ? Math.min(MAX_SENSITIVITY, Math.max(MIN_SENSITIVITY, stored))
    : DEFAULT_SENSITIVITY;
}

export function saveSensitivity(value: number): void {
  write(SENSITIVITY_KEY, String(value));
}

export function loadDifficulty(): Difficulty {
  const stored = read(DIFFICULTY_KEY);
  return stored === 'easy' || stored === 'hard' || stored === 'normal' ? stored : 'normal';
}

export function saveDifficulty(value: Difficulty): void {
  write(DIFFICULTY_KEY, value);
}

export function loadMuted(): boolean {
  return read(MUTE_KEY) === 'true';
}

export function saveMuted(value: boolean): void {
  write(MUTE_KEY, String(value));
}
