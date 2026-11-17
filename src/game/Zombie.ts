import * as THREE from 'three';
import { ARENA_HALF_X, ARENA_HALF_Z, COLORS } from './constants';
import { resolveCircleCollisions } from './Collision';
import type { ArenaBox, ZombieConfig } from './types';

export type ZombieAttackHandler = (zombie: Zombie, damage: number) => void;

export class Zombie {
  readonly group: THREE.Group;
  readonly body: THREE.Mesh;
  readonly head: THREE.Mesh;
  readonly config: ZombieConfig;
  private bodyMaterial: THREE.MeshStandardMaterial;
  private headMaterial: THREE.MeshStandardMaterial;
  private readonly targetMeshes: THREE.Mesh[];
  private readonly debugMeshes: THREE.Mesh[] = [];
  private health: number;
  private attackTimer: number;
  private deathTimer = 0;
  private hitFlashTimer = 0;
  private walkTime = Math.random() * Math.PI * 2;
  private alive = true;
  private stuckTime = 0;

  constructor(config: ZombieConfig, position: THREE.Vector3) {
    this.config = config;
    this.group = new THREE.Group();
    this.group.position.copy(position);
    this.health = config.health;
    this.attackTimer = 0.25 + Math.random() * 0.6;

    const scale = config.type === 'tank' ? 1.18 : config.type === 'runner' ? 0.9 : 1;
    this.group.scale.setScalar(scale);

    this.bodyMaterial = new THREE.MeshStandardMaterial({
      color: config.tint,
      roughness: 0.9,
      metalness: 0.05,
      emissive: 0x000000,
    });
    this.headMaterial = new THREE.MeshStandardMaterial({
      color: config.type === 'tank' ? 0x9a7782 : COLORS.zombieHead,
      roughness: 0.95,
      emissive: 0x000000,
    });
    const limbMaterial = this.bodyMaterial.clone();

    this.body = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.5, 1.45, 8), this.bodyMaterial);
    this.body.position.y = 1.08;
    this.body.castShadow = true;
    this.body.userData = { zombie: this, hitZone: 'body' };
    this.group.add(this.body);

    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 8), this.headMaterial);
    this.head.position.y = 2.13;
    this.head.castShadow = true;
    this.head.userData = { zombie: this, hitZone: 'head' };
    this.group.add(this.head);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.24, 8), limbMaterial);
    neck.position.y = 1.78;
    this.group.add(neck);

    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.12, 1.05, 7), limbMaterial);
      arm.position.set(side * 0.48, 1.18, -0.04);
      arm.rotation.z = side * -0.28;
      arm.rotation.x = -0.1;
      arm.castShadow = true;
      this.group.add(arm);
    }

    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 6, 5),
        new THREE.MeshBasicMaterial({ color: 0xffb15b }),
      );
      eye.position.set(side * 0.13, 2.2, -0.31);
      this.group.add(eye);
    }

    this.targetMeshes = [this.body, this.head];
    const debugMaterial = new THREE.MeshBasicMaterial({
      color: 0xffdb72,
      wireframe: true,
      transparent: true,
      opacity: 0.72,
      depthTest: false,
    });
    const bodyDebug = new THREE.Mesh(new THREE.BoxGeometry(0.92, 1.5, 0.92), debugMaterial);
    bodyDebug.position.y = 1.08;
    const headDebug = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.7, 0.76), debugMaterial.clone());
    headDebug.position.y = 2.13;
    this.debugMeshes.push(bodyDebug, headDebug);
    this.group.add(bodyDebug, headDebug);
    this.setDebugVisible(false);
  }

  get isAlive(): boolean {
    return this.alive;
  }

  get isDying(): boolean {
    return !this.alive && this.deathTimer > 0;
  }

  get targetObjects(): readonly THREE.Mesh[] {
    return this.targetMeshes;
  }

  get hitPoints(): { body: THREE.Vector3; head: THREE.Vector3 } {
    return {
      body: this.body.getWorldPosition(new THREE.Vector3()),
      head: this.head.getWorldPosition(new THREE.Vector3()),
    };
  }

  setDebugVisible(visible: boolean): void {
    for (const mesh of this.debugMeshes) mesh.visible = visible && this.alive;
  }

  update(
    dt: number,
    playerPosition: THREE.Vector3,
    obstacles: readonly ArenaBox[],
    others: readonly Zombie[],
    onAttack: ZombieAttackHandler,
  ): boolean {
    if (!this.alive) {
      this.deathTimer -= dt;
      this.group.rotation.z += dt * 2.8;
      this.group.position.y = Math.max(-0.2, this.group.position.y - dt * 0.45);
      const fade = Math.max(0.05, this.deathTimer / 0.72);
      this.group.scale.y = Math.max(0.08, fade) * (this.config.type === 'tank' ? 1.18 : this.config.type === 'runner' ? 0.9 : 1);
      for (const mesh of this.debugMeshes) mesh.visible = false;
      return this.deathTimer > 0;
    }

    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= dt;
      this.bodyMaterial.emissive.setHex(0xffa66b);
      this.bodyMaterial.emissiveIntensity = 1.6;
      this.headMaterial.emissive.setHex(0xffd49b);
      this.headMaterial.emissiveIntensity = 1.2;
    } else {
      this.bodyMaterial.emissive.setHex(0x000000);
      this.bodyMaterial.emissiveIntensity = 0;
      this.headMaterial.emissive.setHex(0x000000);
      this.headMaterial.emissiveIntensity = 0;
    }

    this.attackTimer -= dt;
    const deltaX = playerPosition.x - this.group.position.x;
    const deltaZ = playerPosition.z - this.group.position.z;
    const distance = Math.hypot(deltaX, deltaZ);
    if (distance > 0.001) this.group.rotation.y = Math.atan2(deltaX, deltaZ);

    if (distance > this.config.attackRange) {
      let moveX = deltaX / Math.max(distance, 0.001);
      let moveZ = deltaZ / Math.max(distance, 0.001);

      // Lightweight separation keeps the crowd readable without a full navmesh.
      for (const other of others) {
        if (other === this || !other.isAlive) continue;
        const awayX = this.group.position.x - other.group.position.x;
        const awayZ = this.group.position.z - other.group.position.z;
        const separationSq = awayX * awayX + awayZ * awayZ;
        if (separationSq > 0.0001 && separationSq < 1.35 * 1.35) {
          const separation = Math.sqrt(separationSq);
          const strength = (1.35 - separation) / 1.35;
          moveX += (awayX / separation) * strength * 1.5;
          moveZ += (awayZ / separation) * strength * 1.5;
        }
      }

      const moveLength = Math.hypot(moveX, moveZ) || 1;
      moveX /= moveLength;
      moveZ /= moveLength;
      const previousX = this.group.position.x;
      const previousZ = this.group.position.z;
      const step = this.config.speed * dt;
      this.group.position.x += moveX * step;
      this.group.position.z += moveZ * step;
      resolveCircleCollisions(this.group.position, this.config.radius, obstacles, ARENA_HALF_X, ARENA_HALF_Z);
      const moved = Math.hypot(this.group.position.x - previousX, this.group.position.z - previousZ);
      if (moved < step * 0.2) {
        this.stuckTime += dt;
        // Strafe around cover when a direct approach is blocked.
        const sideX = -moveZ;
        const sideZ = moveX;
        this.group.position.x = previousX + sideX * step * 0.85;
        this.group.position.z = previousZ + sideZ * step * 0.85;
        resolveCircleCollisions(this.group.position, this.config.radius, obstacles, ARENA_HALF_X, ARENA_HALF_Z);
      } else {
        this.stuckTime = Math.max(0, this.stuckTime - dt * 2);
      }
      this.walkTime += dt * (this.config.speed * 2.2);
      this.group.position.y = Math.sin(this.walkTime) * 0.035;
    } else {
      this.group.position.y = Math.sin(this.walkTime += dt * 4) * 0.018;
      if (this.attackTimer <= 0) {
        this.attackTimer = this.config.attackCooldown;
        onAttack(this, this.config.damage);
      }
    }

    if (this.stuckTime > 2.5) this.stuckTime = 0;
    for (const mesh of this.debugMeshes) mesh.visible = this.alive && mesh.visible;
    return true;
  }

  takeDamage(amount: number, headshot: boolean): boolean {
    if (!this.alive) return false;
    this.health -= amount;
    this.hitFlashTimer = 0.09;
    if (this.health > 0) return false;
    this.alive = false;
    this.deathTimer = 0.72;
    this.group.rotation.z = headshot ? -0.18 : 0.12;
    for (const mesh of this.debugMeshes) mesh.visible = false;
    return true;
  }

  dispose(): void {
    this.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
      else object.material.dispose();
    });
  }
}
