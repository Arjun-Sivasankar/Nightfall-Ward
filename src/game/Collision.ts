import * as THREE from 'three';
import type { ArenaBox } from './types';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Resolves a circular actor against axis-aligned cover and the arena boundary. */
export function resolveCircleCollisions(
  position: THREE.Vector3,
  radius: number,
  obstacles: readonly ArenaBox[],
  arenaHalfX: number,
  arenaHalfZ: number,
): void {
  for (let pass = 0; pass < 3; pass += 1) {
    position.x = clamp(position.x, -arenaHalfX + radius, arenaHalfX - radius);
    position.z = clamp(position.z, -arenaHalfZ + radius, arenaHalfZ - radius);

    for (const box of obstacles) {
      const closestX = clamp(position.x, box.minX, box.maxX);
      const closestZ = clamp(position.z, box.minZ, box.maxZ);
      let deltaX = position.x - closestX;
      let deltaZ = position.z - closestZ;
      const distanceSq = deltaX * deltaX + deltaZ * deltaZ;

      if (distanceSq > 0 && distanceSq < radius * radius) {
        const distance = Math.sqrt(distanceSq);
        const push = (radius - distance) / distance;
        position.x += deltaX * push;
        position.z += deltaZ * push;
        continue;
      }

      // If the center is inside the box, push it through the closest face.
      if (position.x > box.minX && position.x < box.maxX && position.z > box.minZ && position.z < box.maxZ) {
        const left = position.x - box.minX;
        const right = box.maxX - position.x;
        const top = position.z - box.minZ;
        const bottom = box.maxZ - position.z;
        const smallest = Math.min(left, right, top, bottom);
        if (smallest === left) position.x = box.minX - radius;
        else if (smallest === right) position.x = box.maxX + radius;
        else if (smallest === top) position.z = box.minZ - radius;
        else position.z = box.maxZ + radius;
      }
    }
  }
}
