import * as THREE from 'three';
import { AudioManager } from './Audio';
import { ARENA_HALF_X, ARENA_HALF_Z, COLORS, DIFFICULTIES, PLAYER_EYE_HEIGHT, PLAYER_MAX_HEALTH, WORLD_FOG_FAR, WORLD_FOG_NEAR, WEAPON } from './constants';
import { Effects } from './Effects';
import { Input } from './Input';
import { Player } from './Player';
import { loadMuted, loadSensitivity, saveSensitivity } from './storage';
import type { ArenaBox, Difficulty, GameStats } from './types';
import { GameState } from './types';
import { WaveManager } from './WaveManager';
import { Weapon } from './Weapon';
import { Zombie } from './Zombie';
import { HUD } from '../ui/HUD';
import { Menu } from '../ui/Menu';

interface Solid {
  bounds: ArenaBox;
  mesh: THREE.Mesh;
}

export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly hud: HUD;
  private readonly menu: Menu;
  private readonly input: Input;
  private readonly audio = new AudioManager();
  private readonly player = new Player();
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(76, 1, 0.05, 140);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly weapon: Weapon;
  private readonly effects = new Effects();
  private readonly worldSolids: THREE.Mesh[] = [];
  private readonly obstacles: ArenaBox[] = [];
  private readonly solidRecords: Solid[] = [];
  private readonly zombies: Zombie[] = [];
  private readonly debugRayMaterial = new THREE.LineBasicMaterial({ color: 0xffd16b, transparent: true, opacity: 0.9, depthTest: false });
  private readonly debugGroup = new THREE.Group();
  private debugRay: THREE.Line | null = null;
  private readonly raycaster = new THREE.Raycaster();
  private readonly center = new THREE.Vector2(0, 0);
  private readonly clock = new THREE.Clock();
  private readonly waveManager: WaveManager;
  private state = GameState.MENU;
  private difficulty: Difficulty = 'normal';
  private sensitivity = loadSensitivity();
  private yaw = 0;
  private pitch = -0.08;
  private cameraRecoil = 0;
  private elapsed = 0;
  private fps = 60;
  private debug = false;
  private stats: GameStats = this.newStats();
  private spawnIndex = 0;

  private readonly onResize = (): void => this.resize();
  private readonly onPointerLockChange = (): void => {
    const locked = document.pointerLockElement === this.canvas;
    if (!locked && (this.state === GameState.PLAYING || this.state === GameState.WAVE_BREAK)) this.pauseGame();
    this.hud.setPointerHint(this.state === GameState.PLAYING && !locked);
  };
  private readonly onWindowBlur = (): void => {
    if (this.state === GameState.PLAYING || this.state === GameState.WAVE_BREAK) this.pauseGame();
  };

  constructor(canvas: HTMLCanvasElement, hud: HUD, menu: Menu) {
    this.canvas = canvas;
    this.hud = hud;
    this.menu = menu;
    this.input = new Input(canvas);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    this.scene.background = new THREE.Color(COLORS.void);
    this.scene.fog = new THREE.Fog(COLORS.void, WORLD_FOG_NEAR, WORLD_FOG_FAR);
    this.camera.rotation.order = 'YXZ';
    this.camera.position.set(0, PLAYER_EYE_HEIGHT, 11);
    this.scene.add(this.camera);
    this.scene.add(this.effects.group);
    this.scene.add(this.debugGroup);
    this.buildArena();
    this.weapon = new Weapon(this.camera, () => this.audio.reload(), () => undefined);
    this.waveManager = new WaveManager(
      () => this.zombies.length,
      {
        spawn: (config) => this.spawnZombie(config),
        announce: (wave) => this.onWaveAnnouncement(wave),
        gameplayStart: () => this.onGameplayStart(),
        waveBreak: (wave, bonus) => this.onWaveBreak(wave, bonus),
      },
    );

    window.addEventListener('resize', this.onResize);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    window.addEventListener('blur', this.onWindowBlur);
    canvas.addEventListener('click', () => {
      if ((this.state === GameState.PLAYING || this.state === GameState.WAVE_BREAK) && document.pointerLockElement !== canvas) {
        this.requestPointerLock();
      }
    });
    this.hud.setMuted(loadMuted());
    this.menu.showMain();
    this.resize();
    requestAnimationFrame((time) => this.frame(time));
  }

  startGame(difficulty: Difficulty): void {
    void this.audio.unlock();
    this.difficulty = difficulty;
    this.resetRun();
    this.state = GameState.WAVE_BREAK;
    this.hud.setVisible(true);
    this.menu.root.classList.remove('is-visible');
    this.waveManager.reset(difficulty);
    this.waveManager.start();
    this.requestPointerLock();
  }

  restartGame(): void {
    this.startGame(this.difficulty);
  }

  resumeGame(): void {
    if (this.state !== GameState.PAUSED) return;
    this.state = this.waveManager.isBreak ? GameState.WAVE_BREAK : GameState.PLAYING;
    this.menu.root.classList.remove('is-visible');
    this.requestPointerLock();
  }

  returnToMenu(): void {
    document.exitPointerLock();
    this.clearZombies();
    this.state = GameState.MENU;
    this.hud.setVisible(false);
    this.menu.showMain();
  }

  setSensitivity(value: number): void {
    this.sensitivity = value;
    saveSensitivity(value);
  }

  toggleMute(): void {
    this.hud.setMuted(this.audio.toggleMute());
  }

  private resetRun(): void {
    document.exitPointerLock();
    this.clearZombies();
    this.effects.clear();
    this.player.reset();
    this.weapon.reset();
    this.stats = this.newStats();
    this.yaw = 0;
    this.pitch = -0.08;
    this.cameraRecoil = 0;
    this.elapsed = 0;
    this.debug = false;
    if (this.debugRay) this.debugRay.geometry.dispose();
    this.debugRay = null;
    this.debugGroup.clear();
    this.camera.position.set(this.player.position.x, PLAYER_EYE_HEIGHT, this.player.position.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
    this.hud.setPointerHint(false);
  }

  private frame(time: number): void {
    const dt = Math.min(0.05, this.clock.getDelta());
    this.fps = this.fps * 0.92 + (1 / Math.max(dt, 0.001)) * 0.08;
    this.elapsed += dt;
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame((nextTime) => this.frame(nextTime));
    void time;
  }

  private update(dt: number): void {
    if (this.state === GameState.MENU || this.state === GameState.PAUSED || this.state === GameState.GAME_OVER) {
      this.input.consumeMouseDelta();
      this.input.clearPressed();
      return;
    }

    const mouse = this.input.consumeMouseDelta();
    if (document.pointerLockElement === this.canvas) {
      this.yaw -= mouse.x * 0.0024 * this.sensitivity;
      this.pitch -= mouse.y * 0.0024 * this.sensitivity;
      this.pitch = Math.max(-1.42, Math.min(1.42, this.pitch));
    }
    this.cameraRecoil = Math.max(0, this.cameraRecoil - dt * 7);
    this.player.update(dt, this.input, this.yaw, this.obstacles);
    this.camera.position.set(this.player.position.x, PLAYER_EYE_HEIGHT, this.player.position.z);
    this.camera.rotation.x = this.pitch - this.cameraRecoil;
    this.camera.rotation.y = this.yaw;
    this.weapon.update(dt);

    if (this.input.wasPressed('F3')) {
      this.debug = !this.debug;
      this.zombies.forEach((zombie) => zombie.setDebugVisible(this.debug));
    }
    if (this.input.wasPressed('KeyR')) this.weapon.startReload();

    this.waveManager.update(dt);
    if (this.state === GameState.PLAYING && document.pointerLockElement === this.canvas) this.handleCombat();

    for (let index = this.zombies.length - 1; index >= 0; index -= 1) {
      const zombie = this.zombies[index];
      const stillPresent = zombie.update(dt, this.player.position, this.obstacles, this.zombies, (attacker, damage) => this.onZombieAttack(attacker, damage));
      if (!stillPresent) {
        this.scene.remove(zombie.group);
        zombie.dispose();
        this.zombies.splice(index, 1);
      }
    }

    this.effects.update(dt);
    this.updateHud();
    this.input.clearPressed();
  }

  private handleCombat(): void {
    if (this.input.isMouseDown() && this.weapon.tryFire()) {
      this.stats.shotsFired += 1;
      this.audio.shoot();
      this.hud.pulseCrosshair();
      this.cameraRecoil = Math.min(0.075, this.cameraRecoil + 0.016);
      this.performShot();
    }
  }

  private performShot(): void {
    // Movement and camera rotation happen before the render pass; refresh matrices so
    // hitscan always originates from the current eye position and current crosshair.
    this.scene.updateMatrixWorld(true);
    this.raycaster.setFromCamera(this.center, this.camera);
    const worldHits = this.raycaster.intersectObjects(this.worldSolids, false);
    const targetMeshes = this.zombies.flatMap((zombie) => zombie.targetObjects);
    const targetHits = this.raycaster.intersectObjects(targetMeshes, false);
    const nearestWorld = worldHits[0];
    let nearestTarget: THREE.Intersection | undefined;
    let targetZombie: Zombie | undefined;
    let headshot = false;
    for (const hit of targetHits) {
      const candidate = hit.object.userData.zombie as Zombie | undefined;
      if (candidate?.isAlive) {
        nearestTarget = hit;
        targetZombie = candidate;
        headshot = hit.object.userData.hitZone === 'head';
        break;
      }
    }

    const targetIsVisible = Boolean(nearestTarget && (!nearestWorld || nearestTarget.distance <= nearestWorld.distance + 0.001));
    const endPoint = targetIsVisible && nearestTarget ? nearestTarget.point : this.raycaster.ray.origin.clone().add(this.raycaster.ray.direction.clone().multiplyScalar(nearestWorld?.distance ?? 28));
    if (this.debug) this.setDebugRay(endPoint);

    if (!targetIsVisible || !targetZombie || !nearestTarget) return;
    this.stats.shotsHit += 1;
    const damage = WEAPON.bodyDamage * (headshot ? WEAPON.headshotMultiplier : 1) * DIFFICULTIES[this.difficulty].playerDamage;
    const killed = targetZombie.takeDamage(damage, headshot);
    this.hud.showHitmarker(headshot);
    this.audio.hit(headshot);
    this.effects.burst(endPoint, headshot ? 0xffc469 : COLORS.blood, headshot ? 8 : 5, headshot ? 3.4 : 2.3);
    if (killed) {
      this.stats.kills += 1;
      if (headshot) this.stats.headshots += 1;
      this.stats.score += headshot ? 150 : 100;
      const deathPoint = targetZombie.group.position.clone();
      deathPoint.y += 1.1;
      this.effects.burst(deathPoint, headshot ? 0xffc469 : COLORS.blood, 12, 2.8);
    }
  }

  private onZombieAttack(zombie: Zombie, damage: number): void {
    if (this.state !== GameState.PLAYING || !zombie.isAlive) return;
    const died = this.player.damage(damage);
    this.hud.showDamage();
    this.audio.zombieAttack();
    if (died) this.endRun();
  }

  private onWaveAnnouncement(wave: number): void {
    this.state = GameState.WAVE_BREAK;
    this.stats.wave = wave;
    this.hud.showWave(`WAVE ${String(wave).padStart(2, '0')}`, wave === 1 ? 'THE WARD IS BREACHING' : 'THE DEAD ARE LEARNING');
    this.audio.wave();
  }

  private onGameplayStart(): void {
    if (this.state !== GameState.PAUSED) this.state = GameState.PLAYING;
    this.weapon.addReserve(this.difficulty === 'easy' ? 18 : 10);
  }

  private onWaveBreak(wave: number, bonus: number): void {
    this.state = GameState.WAVE_BREAK;
    this.stats.score += bonus;
    this.weapon.addReserve(30);
    this.hud.showWave('WARD SECURED', `WAVE ${wave} CLEARED  //  +${bonus} SCORE`);
  }

  private endRun(): void {
    if (this.state === GameState.GAME_OVER) return;
    this.state = GameState.GAME_OVER;
    document.exitPointerLock();
    this.hud.setPointerHint(false);
    this.audio.gameOver();
    this.menu.showGameOver(this.stats);
  }

  private updateHud(): void {
    const remaining = this.waveManager.remainingToSpawn + this.zombies.filter((zombie) => zombie.isAlive).length;
    this.hud.update({
      health: this.player.health,
      ammo: this.weapon.ammo,
      reserve: this.weapon.reserve,
      wave: this.waveManager.wave,
      remaining,
      score: this.stats.score,
      kills: this.stats.kills,
      accuracy: this.stats.shotsFired > 0 ? (this.stats.shotsHit / this.stats.shotsFired) * 100 : 0,
      reloading: this.weapon.isReloading,
      reloadProgress: this.weapon.reloadProgress,
      debug: this.debug,
      fps: this.fps,
    });
    this.hud.setPointerHint(this.state === GameState.PLAYING && document.pointerLockElement !== this.canvas);
  }

  private spawnZombie(config: import('./types').ZombieConfig): void {
    const position = this.pickSpawnPosition();
    const zombie = new Zombie(config, position);
    zombie.setDebugVisible(this.debug);
    this.zombies.push(zombie);
    this.scene.add(zombie.group);
  }

  private pickSpawnPosition(): THREE.Vector3 {
    const zones = [
      new THREE.Vector3(-ARENA_HALF_X + 2.4, 0, -ARENA_HALF_Z + 2.4),
      new THREE.Vector3(ARENA_HALF_X - 2.4, 0, -ARENA_HALF_Z + 2.4),
      new THREE.Vector3(-ARENA_HALF_X + 2.4, 0, ARENA_HALF_Z - 2.4),
      new THREE.Vector3(ARENA_HALF_X - 2.4, 0, ARENA_HALF_Z - 2.4),
    ];
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const zone = zones[this.spawnIndex++ % zones.length];
      const position = zone.clone();
      position.x += (Math.random() - 0.5) * 3.2;
      position.z += (Math.random() - 0.5) * 3.2;
      if (Math.hypot(position.x - this.player.position.x, position.z - this.player.position.z) > 10) return position;
    }
    return zones[this.spawnIndex++ % zones.length].clone();
  }

  private clearZombies(): void {
    for (const zombie of this.zombies) {
      this.scene.remove(zombie.group);
      zombie.dispose();
    }
    this.zombies.length = 0;
  }

  private setDebugRay(end: THREE.Vector3): void {
    if (this.debugRay) {
      this.debugGroup.remove(this.debugRay);
      this.debugRay.geometry.dispose();
    }
    const geometry = new THREE.BufferGeometry().setFromPoints([this.camera.position.clone(), end]);
    this.debugRay = new THREE.Line(geometry, this.debugRayMaterial);
    this.debugGroup.add(this.debugRay);
  }

  private buildArena(): void {
    const hemi = new THREE.HemisphereLight(0x8fc1d0, 0x111621, 1.25);
    this.scene.add(hemi);
    const moon = new THREE.DirectionalLight(0xa7d5e4, 2.4);
    moon.position.set(-18, 30, 12);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    moon.shadow.camera.near = 1;
    moon.shadow.camera.far = 80;
    moon.shadow.camera.left = -38;
    moon.shadow.camera.right = 38;
    moon.shadow.camera.top = 38;
    moon.shadow.camera.bottom = -38;
    this.scene.add(moon);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(ARENA_HALF_X * 2, ARENA_HALF_Z * 2),
      new THREE.MeshStandardMaterial({ color: COLORS.floor, roughness: 0.92, metalness: 0.06 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const grid = new THREE.GridHelper(ARENA_HALF_X * 2, 24, COLORS.floorLine, 0x1a222e);
    grid.position.y = 0.012;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.42;
    this.scene.add(grid);

    this.addWall(0, -ARENA_HALF_Z, ARENA_HALF_X * 2 + 1, 1, 2.8);
    this.addWall(0, ARENA_HALF_Z, ARENA_HALF_X * 2 + 1, 1, 2.8);
    this.addWall(-ARENA_HALF_X, 0, 1, ARENA_HALF_Z * 2, 2.8);
    this.addWall(ARENA_HALF_X, 0, 1, ARENA_HALF_Z * 2, 2.8);

    this.addCover(-8, -3, 5.5, 1.4, 1.8, COLORS.wall);
    this.addCover(8, 1, 1.6, 5.8, 1.8, COLORS.wall);
    this.addCover(-5, 8, 3.4, 1.2, 1.3, 0x394d55);
    this.addCover(13, -8, 3.2, 1.3, 1.6, 0x394d55);
    this.addCover(-15, 7, 2.4, 2.4, 1.5, 0x394d55);
    this.addPropCluster(-17, -8);
    this.addPropCluster(17, 7);
    this.addBeacon(0, -14);
    this.addBeacon(0, 14);
  }

  private addWall(x: number, z: number, width: number, depth: number, height: number): void {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      new THREE.MeshStandardMaterial({ color: COLORS.wall, roughness: 0.8, metalness: 0.22 }),
    );
    mesh.position.set(x, height / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    const bounds = { minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2 };
    this.obstacles.push(bounds);
    this.worldSolids.push(mesh);
    this.solidRecords.push({ bounds, mesh });
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.98, 0.055, depth * 1.015),
      new THREE.MeshBasicMaterial({ color: COLORS.wallEdge }),
    );
    strip.position.set(x, height + 0.012, z);
    this.scene.add(strip);
  }

  private addCover(x: number, z: number, width: number, depth: number, height: number, color: number): void {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.2 }),
    );
    mesh.position.set(x, height / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    const bounds = { minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2 };
    this.obstacles.push(bounds);
    this.worldSolids.push(mesh);
    this.solidRecords.push({ bounds, mesh });
    const warning = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.9, 0.035, depth * 0.92),
      new THREE.MeshBasicMaterial({ color: COLORS.hazard }),
    );
    warning.position.set(x, height + 0.02, z);
    this.scene.add(warning);
  }

  private addPropCluster(x: number, z: number): void {
    this.addCover(x, z, 2.2, 2.2, 1.2, 0x273b42);
    const barrelMaterial = new THREE.MeshStandardMaterial({ color: 0x4c5961, metalness: 0.7, roughness: 0.3 });
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.2, 12), barrelMaterial);
    barrel.position.set(x + 1.5, 0.6, z - 0.4);
    barrel.castShadow = true;
    this.scene.add(barrel);
    const hazardRing = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.035, 6, 16), new THREE.MeshBasicMaterial({ color: COLORS.hazard }));
    hazardRing.rotation.x = Math.PI / 2;
    hazardRing.position.set(x + 1.5, 0.65, z - 0.4);
    this.scene.add(hazardRing);
  }

  private addBeacon(x: number, z: number): void {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 3.2, 8), new THREE.MeshStandardMaterial({ color: 0x475964, metalness: 0.65, roughness: 0.35 }));
    pole.position.set(x, 1.6, z);
    pole.castShadow = true;
    this.scene.add(pole);
    const light = new THREE.PointLight(COLORS.cyan, 2.2, 8, 2);
    light.position.set(x, 3.2, z);
    this.scene.add(light);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: COLORS.cyanBright }));
    cap.position.copy(light.position);
    this.scene.add(cap);
  }

  private resize(): void {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private newStats(): GameStats {
    return { score: 0, kills: 0, headshots: 0, shotsFired: 0, shotsHit: 0, wave: 0 };
  }

  private pauseGame(): void {
    if (this.state !== GameState.PLAYING && this.state !== GameState.WAVE_BREAK) return;
    this.state = GameState.PAUSED;
    document.exitPointerLock();
    this.menu.showPause();
  }

  private requestPointerLock(): void {
    if (document.pointerLockElement === this.canvas) return;
    const request = this.canvas.requestPointerLock();
    if (request instanceof Promise) void request.catch(() => undefined);
  }
}
