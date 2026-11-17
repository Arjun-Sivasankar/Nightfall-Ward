import * as THREE from 'three';
import { COLORS, WEAPON } from './constants';

export class Weapon {
  readonly group: THREE.Group;
  private readonly muzzleFlash: THREE.Mesh;
  private readonly muzzleLight: THREE.PointLight;
  private readonly basePosition = new THREE.Vector3(0.42, -0.32, -0.65);
  private cooldown = 0;
  private reloadRemaining = 0;
  private muzzleRemaining = 0;
  private recoil = 0;
  private _ammo = WEAPON.magazineSize;
  private _reserve = WEAPON.startingReserve;
  private readonly onReloadStart: () => void;
  private readonly onReloadComplete: () => void;

  constructor(
    camera: THREE.Camera,
    onReloadStart: () => void,
    onReloadComplete: () => void,
  ) {
    this.onReloadStart = onReloadStart;
    this.onReloadComplete = onReloadComplete;
    this.group = new THREE.Group();
    this.group.position.copy(this.basePosition);
    camera.add(this.group);

    const receiverMaterial = new THREE.MeshStandardMaterial({
      color: 0x263746,
      metalness: 0.8,
      roughness: 0.3,
    });
    const gripMaterial = new THREE.MeshStandardMaterial({
      color: 0x10151b,
      metalness: 0.25,
      roughness: 0.75,
    });
    const accentMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.cyan,
      emissive: COLORS.cyan,
      emissiveIntensity: 0.4,
      metalness: 0.35,
      roughness: 0.38,
    });

    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.72), receiverMaterial);
    receiver.position.set(0, 0.02, 0);
    this.group.add(receiver);

    const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.045, 0.6), accentMaterial);
    topRail.position.set(0, 0.15, -0.02);
    this.group.add(topRail);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.38, 0.2), gripMaterial);
    grip.position.set(0.02, -0.23, 0.2);
    grip.rotation.x = -0.18;
    this.group.add(grip);

    const magazine = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 0.19), gripMaterial);
    magazine.position.set(0, -0.18, -0.05);
    magazine.rotation.x = 0.12;
    this.group.add(magazine);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.66, 8), receiverMaterial);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -0.65);
    this.group.add(barrel);

    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.08, 0.1), accentMaterial);
    sight.position.set(0, 0.21, -0.16);
    this.group.add(sight);

    this.muzzleFlash = new THREE.Mesh(
      new THREE.ConeGeometry(0.13, 0.34, 6),
      new THREE.MeshBasicMaterial({ color: COLORS.muzzle, transparent: true, opacity: 0.95 }),
    );
    this.muzzleFlash.rotation.x = -Math.PI / 2;
    this.muzzleFlash.position.set(0, 0.02, -1.02);
    this.muzzleFlash.visible = false;
    this.group.add(this.muzzleFlash);

    this.muzzleLight = new THREE.PointLight(COLORS.muzzle, 0, 4, 2);
    this.muzzleLight.position.set(0, 0.03, -0.9);
    this.group.add(this.muzzleLight);
  }

  reset(): void {
    this._ammo = WEAPON.magazineSize;
    this._reserve = WEAPON.startingReserve;
    this.cooldown = 0;
    this.reloadRemaining = 0;
    this.muzzleRemaining = 0;
    this.recoil = 0;
  }

  update(dt: number): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.muzzleRemaining = Math.max(0, this.muzzleRemaining - dt);
    this.muzzleFlash.visible = this.muzzleRemaining > 0;
    this.muzzleLight.intensity = this.muzzleRemaining > 0 ? 3.2 : 0;

    if (this.reloadRemaining > 0) {
      this.reloadRemaining -= dt;
      if (this.reloadRemaining <= 0) {
        const needed = WEAPON.magazineSize - this._ammo;
        const loaded = Math.min(needed, this._reserve);
        this._ammo += loaded;
        this._reserve -= loaded;
        this.onReloadComplete();
      }
    }

    this.recoil = Math.max(0, this.recoil - dt * 7.5);
    const kick = this.recoil * this.recoil;
    this.group.position.lerp(this.basePosition, Math.min(1, dt * 20));
    this.group.position.z += kick * 0.08;
    this.group.rotation.x = kick * 0.045;
  }

  tryFire(): boolean {
    if (this.reloadRemaining > 0 || this.cooldown > 0) return false;
    if (this._ammo <= 0) {
      this.startReload();
      return false;
    }
    this._ammo -= 1;
    this.cooldown = WEAPON.fireInterval;
    this.muzzleRemaining = 0.055;
    this.recoil = 1;
    return true;
  }

  startReload(): boolean {
    if (this.reloadRemaining > 0 || this._ammo >= WEAPON.magazineSize || this._reserve <= 0) return false;
    this.reloadRemaining = WEAPON.reloadTime;
    this.onReloadStart();
    return true;
  }

  addReserve(amount: number): void {
    this._reserve = Math.min(240, this._reserve + amount);
  }

  get ammo(): number {
    return this._ammo;
  }

  get reserve(): number {
    return this._reserve;
  }

  get isReloading(): boolean {
    return this.reloadRemaining > 0;
  }

  get reloadProgress(): number {
    return this.reloadRemaining > 0 ? 1 - this.reloadRemaining / WEAPON.reloadTime : 0;
  }
}
