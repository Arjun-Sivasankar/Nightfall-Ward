import * as THREE from 'three';

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

export class Effects {
  readonly group = new THREE.Group();
  private readonly geometry = new THREE.SphereGeometry(0.055, 5, 4);
  private readonly particles: Particle[] = [];

  burst(position: THREE.Vector3, color: number, count: number, speed = 2.4): void {
    const actualCount = Math.min(count, 18);
    for (let index = 0; index < actualCount; index += 1) {
      const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
      const mesh = new THREE.Mesh(this.geometry, material);
      mesh.position.copy(position);
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * speed,
        Math.random() * speed * 0.85,
        (Math.random() - 0.5) * speed,
      );
      const life = 0.25 + Math.random() * 0.35;
      this.group.add(mesh);
      this.particles.push({ mesh, velocity, life, maxLife: life });
    }
    this.trim();
  }

  update(dt: number): void {
    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const particle = this.particles[index];
      particle.life -= dt;
      if (particle.life <= 0) {
        this.group.remove(particle.mesh);
        this.disposeParticleMaterial(particle.mesh);
        this.particles.splice(index, 1);
        continue;
      }
      particle.velocity.y -= 5.8 * dt;
      particle.mesh.position.addScaledVector(particle.velocity, dt);
      particle.mesh.scale.setScalar(Math.max(0.12, particle.life / particle.maxLife));
      (particle.mesh.material as THREE.MeshBasicMaterial).opacity = particle.life / particle.maxLife;
    }
  }

  clear(): void {
    for (const particle of this.particles) this.disposeParticleMaterial(particle.mesh);
    this.particles.length = 0;
    this.group.clear();
  }

  private trim(): void {
    while (this.particles.length > 180) {
      const particle = this.particles.shift();
      if (!particle) break;
      this.group.remove(particle.mesh);
      this.disposeParticleMaterial(particle.mesh);
    }
  }

  private disposeParticleMaterial(mesh: THREE.Mesh): void {
    if (Array.isArray(mesh.material)) mesh.material.forEach((material) => material.dispose());
    else mesh.material.dispose();
  }
}
