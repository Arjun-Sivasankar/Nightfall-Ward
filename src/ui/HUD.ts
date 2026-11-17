export interface HudSnapshot {
  health: number;
  ammo: number;
  reserve: number;
  wave: number;
  remaining: number;
  score: number;
  kills: number;
  accuracy: number;
  reloading: boolean;
  reloadProgress: number;
  debug: boolean;
  fps: number;
}

export class HUD {
  readonly root: HTMLDivElement;
  private readonly healthValue: HTMLElement;
  private readonly healthFill: HTMLElement;
  private readonly ammoValue: HTMLElement;
  private readonly reserveValue: HTMLElement;
  private readonly waveValue: HTMLElement;
  private readonly remainingValue: HTMLElement;
  private readonly scoreValue: HTMLElement;
  private readonly accuracyValue: HTMLElement;
  private readonly reloadPanel: HTMLElement;
  private readonly reloadFill: HTMLElement;
  private readonly crosshair: HTMLElement;
  private readonly hitmarker: HTMLElement;
  private readonly headshotLabel: HTMLElement;
  private readonly damageVignette: HTMLElement;
  private readonly waveBanner: HTMLElement;
  private readonly pointerHint: HTMLElement;
  private readonly debugPanel: HTMLElement;
  private readonly muteButton: HTMLButtonElement;
  private hitmarkerTimeout = 0;
  private bannerTimeout = 0;
  private headshotTimeout = 0;

  constructor(parent: HTMLElement, onMute: () => void) {
    this.root = document.createElement('div');
    this.root.className = 'hud is-hidden';
    this.root.innerHTML = `
      <div class="hud-topline">
        <div class="brand-mark"><span class="brand-dot"></span> NIGHTFALL WARD <span class="brand-divider">//</span> LIVE FEED</div>
        <button class="hud-icon-button" id="mute-button" type="button" aria-label="Toggle audio">◖))</button>
      </div>
      <div class="hud-left-stack">
        <div class="stat-card health-card">
          <div class="stat-label"><span>VITALS</span><strong id="health-value">100</strong></div>
          <div class="health-track"><div class="health-fill" id="health-fill"></div></div>
        </div>
        <div class="stat-card compact-stat"><span class="stat-label">WAVE</span><strong id="wave-value">0</strong></div>
        <div class="stat-card compact-stat"><span class="stat-label">THREATS</span><strong id="remaining-value">0</strong></div>
      </div>
      <div class="hud-right-stack">
        <div class="stat-card score-card"><span class="stat-label">SCORE</span><strong id="score-value">000000</strong></div>
        <div class="stat-card ammo-card">
          <div class="ammo-main"><strong id="ammo-value">30</strong><span>/ <b id="reserve-value">120</b></span></div>
          <span class="stat-label">CARBINE // 5.56</span>
        </div>
      </div>
      <div class="combat-reticle" id="crosshair" aria-hidden="true"><i></i><i></i><i></i><i></i><b></b></div>
      <div class="hitmarker" id="hitmarker">×</div>
      <div class="headshot-label" id="headshot-label">HEADSHOT</div>
      <div class="damage-vignette" id="damage-vignette"></div>
      <div class="reload-panel" id="reload-panel"><span>RELOADING</span><div class="reload-track"><div id="reload-fill"></div></div></div>
      <div class="wave-banner" id="wave-banner"><strong></strong><span></span></div>
      <div class="pointer-hint" id="pointer-hint">CLICK TO CAPTURE MOUSE</div>
      <div class="hud-bottomline"><span>WASD MOVE</span><span>SHIFT SPRINT</span><span>LMB FIRE</span><span>R RELOAD</span><span>ESC PAUSE</span></div>
      <div class="debug-panel" id="debug-panel"></div>
    `;
    parent.appendChild(this.root);

    this.healthValue = this.require('health-value');
    this.healthFill = this.require('health-fill');
    this.ammoValue = this.require('ammo-value');
    this.reserveValue = this.require('reserve-value');
    this.waveValue = this.require('wave-value');
    this.remainingValue = this.require('remaining-value');
    this.scoreValue = this.require('score-value');
    this.accuracyValue = document.createElement('span');
    this.accuracyValue.className = 'accuracy-hidden';
    this.root.appendChild(this.accuracyValue);
    this.reloadPanel = this.require('reload-panel');
    this.reloadFill = this.require('reload-fill');
    this.crosshair = this.require('crosshair');
    this.hitmarker = this.require('hitmarker');
    this.headshotLabel = this.require('headshot-label');
    this.damageVignette = this.require('damage-vignette');
    this.waveBanner = this.require('wave-banner');
    this.pointerHint = this.require('pointer-hint');
    this.debugPanel = this.require('debug-panel');
    this.muteButton = this.requireButton('mute-button');
    this.muteButton.addEventListener('click', (event) => {
      event.stopPropagation();
      onMute();
    });
  }

  update(snapshot: HudSnapshot): void {
    this.healthValue.textContent = String(Math.ceil(snapshot.health));
    this.healthFill.style.width = `${Math.max(0, Math.min(100, snapshot.health))}%`;
    this.healthFill.classList.toggle('is-low', snapshot.health <= 30);
    this.ammoValue.textContent = String(snapshot.ammo).padStart(2, '0');
    this.reserveValue.textContent = String(snapshot.reserve).padStart(3, '0');
    this.waveValue.textContent = String(snapshot.wave).padStart(2, '0');
    this.remainingValue.textContent = String(snapshot.remaining).padStart(2, '0');
    this.scoreValue.textContent = String(snapshot.score).padStart(6, '0');
    this.reloadPanel.classList.toggle('is-visible', snapshot.reloading);
    this.reloadFill.style.width = `${snapshot.reloadProgress * 100}%`;
    this.debugPanel.classList.toggle('is-visible', snapshot.debug);
    if (snapshot.debug) {
      this.debugPanel.textContent = `DEBUG // ${snapshot.fps.toFixed(0)} FPS // ${snapshot.remaining} THREATS // ACC ${snapshot.accuracy.toFixed(1)}%`;
    }
  }

  setVisible(visible: boolean): void {
    this.root.classList.toggle('is-hidden', !visible);
  }

  setPointerHint(visible: boolean): void {
    this.pointerHint.classList.toggle('is-visible', visible);
  }

  setMuted(muted: boolean): void {
    this.muteButton.textContent = muted ? '◖×)' : '◖))';
    this.muteButton.classList.toggle('is-muted', muted);
  }

  showWave(title: string, subtitle: string): void {
    const strong = this.waveBanner.querySelector('strong');
    const span = this.waveBanner.querySelector('span');
    if (strong) strong.textContent = title;
    if (span) span.textContent = subtitle;
    this.waveBanner.classList.remove('is-active');
    window.requestAnimationFrame(() => this.waveBanner.classList.add('is-active'));
    window.clearTimeout(this.bannerTimeout);
    this.bannerTimeout = window.setTimeout(() => this.waveBanner.classList.remove('is-active'), 1800);
  }

  showHitmarker(headshot: boolean): void {
    this.hitmarker.classList.remove('is-active', 'is-headshot');
    window.requestAnimationFrame(() => {
      this.hitmarker.classList.add('is-active');
      this.hitmarker.classList.toggle('is-headshot', headshot);
    });
    if (headshot) {
      this.headshotLabel.classList.remove('is-active');
      window.requestAnimationFrame(() => this.headshotLabel.classList.add('is-active'));
      window.clearTimeout(this.headshotTimeout);
      this.headshotTimeout = window.setTimeout(() => this.headshotLabel.classList.remove('is-active'), 450);
    }
    window.clearTimeout(this.hitmarkerTimeout);
    this.hitmarkerTimeout = window.setTimeout(() => this.hitmarker.classList.remove('is-active'), 120);
  }

  showDamage(): void {
    this.damageVignette.classList.remove('is-active');
    window.requestAnimationFrame(() => this.damageVignette.classList.add('is-active'));
    window.setTimeout(() => this.damageVignette.classList.remove('is-active'), 260);
  }

  pulseCrosshair(): void {
    this.crosshair.classList.remove('is-pulsing');
    window.requestAnimationFrame(() => this.crosshair.classList.add('is-pulsing'));
  }

  private require(id: string): HTMLElement {
    const element = this.root.querySelector<HTMLElement>(`#${id}`);
    if (!element) throw new Error(`HUD element #${id} was not created`);
    return element;
  }

  private requireButton(id: string): HTMLButtonElement {
    const element = this.root.querySelector<HTMLButtonElement>(`#${id}`);
    if (!element) throw new Error(`HUD button #${id} was not created`);
    return element;
  }
}
