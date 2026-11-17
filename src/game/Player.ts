import * as THREE from 'three';
import {
  ARENA_HALF_X,
  ARENA_HALF_Z,
  PLAYER_EYE_HEIGHT,
  PLAYER_MAX_HEALTH,
  PLAYER_RADIUS,
  PLAYER_SPRINT_SPEED,
  PLAYER_WALK_SPEED,
} from './constants';
import { resolveCircleCollisions } from './Collision';
import type { ArenaBox } from './types';
import type { Input } from './Input';

export class Player {
  readonly position = new THREE.Vector3(0, 0, 11);
  readonly velocity = new THREE.Vector3();
  readonly radius = PLAYER_RADIUS;
  health = PLAYER_MAX_HEALTH;

  reset(): void {
    this.position.set(0, 0, 11);
    this.velocity.set(0, 0, 0);
    this.health = PLAYER_MAX_HEALTH;
  }

  update(
    dt: number,
    input: Input,
    yaw: number,
    obstacles: readonly ArenaBox[],
  ): void {
    let forward = 0;
    let strafe = 0;
    if (input.isKeyDown('KeyW')) forward += 1;
    if (input.isKeyDown('KeyS')) forward -= 1;
    if (input.isKeyDown('KeyD')) strafe += 1;
    if (input.isKeyDown('KeyA')) strafe -= 1;

    const length = Math.hypot(forward, strafe);
    if (length === 0) {
      this.velocity.multiplyScalar(Math.max(0, 1 - dt * 12));
      return;
    }

    forward /= length;
    strafe /= length;
    const speed = input.isKeyDown('ShiftLeft') || input.isKeyDown('ShiftRight')
      ? PLAYER_SPRINT_SPEED
      : PLAYER_WALK_SPEED;

    // Camera forward is -Z at yaw zero; this basis keeps diagonal movement normalized.
    const moveX = Math.sin(yaw) * forward + Math.cos(yaw) * strafe;
    const moveZ = -Math.cos(yaw) * forward + Math.sin(yaw) * strafe;
    this.velocity.set(moveX * speed, 0, moveZ * speed);
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    resolveCircleCollisions(this.position, this.radius, obstacles, ARENA_HALF_X, ARENA_HALF_Z);
  }

  damage(amount: number): boolean {
    if (this.health <= 0) return false;
    this.health = Math.max(0, this.health - amount);
    return this.health <= 0;
  }

  get eyePosition(): THREE.Vector3 {
    return new THREE.Vector3(this.position.x, PLAYER_EYE_HEIGHT, this.position.z);
  }
}
