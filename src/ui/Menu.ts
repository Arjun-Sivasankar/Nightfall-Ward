import { MAX_SENSITIVITY, MIN_SENSITIVITY } from '../game/constants';
import { loadDifficulty, loadSensitivity, saveDifficulty, saveSensitivity } from '../game/storage';
import type { Difficulty, GameStats } from '../game/types';

export interface MenuCallbacks {
  start: (difficulty: Difficulty) => void;
  resume: () => void;
  restart: () => void;
  mainMenu: () => void;
  sensitivity: (value: number) => void;
}

export class Menu {
  readonly root: HTMLDivElement;
  private readonly mainPanel: HTMLElement;
  private readonly pausePanel: HTMLElement;
  private readonly gameOverPanel: HTMLElement;
  private readonly mainSensitivity: HTMLInputElement;
  private readonly pauseSensitivity: HTMLInputElement;
  private readonly sensitivityReadouts: HTMLElement[];
  private readonly difficultyButtons: HTMLButtonElement[];
  private selectedDifficulty: Difficulty = loadDifficulty();
  private readonly callbacks: MenuCallbacks;

  constructor(parent: HTMLElement, callbacks: MenuCallbacks) {
    this.callbacks = callbacks;
    this.root = document.createElement('div');
    this.root.className = 'menu-layer';
    this.root.innerHTML = `
      <section class="menu-panel main-panel" data-panel="main">
        <div class="eyebrow"><span class="eyebrow-line"></span> SECURE CHANNEL / 07</div>
        <h1>NIGHTFALL<br><em>WARD</em></h1>
        <p class="tagline">Hold the line until daylight.</p>
        <div class="menu-rule"></div>
        <div class="difficulty-block">
          <span class="menu-label">THREAT PROTOCOL</span>
          <div class="difficulty-grid">
            <button type="button" class="difficulty-button" data-difficulty="easy"><b>EASY</b><small>FIELD TRAINING</small></button>
            <button type="button" class="difficulty-button" data-difficulty="normal"><b>NORMAL</b><small>STANDARD ISSUE</small></button>
            <button type="button" class="difficulty-button" data-difficulty="hard"><b>HARD</b><small>NO SECOND CHANCES</small></button>
          </div>
        </div>
        <label class="setting-row"><span><b>SENSITIVITY</b><small>RAW POINTER-LOCK INPUT</small></span><input id="main-sensitivity" type="range" min="0.35" max="2.2" step="0.05"><output id="main-sensitivity-output">1.00</output></label>
        <button class="primary-button" id="start-button" type="button"><span>START OPERATION</span><i>↗</i></button>
        <div class="control-note"><span>WASD</span> move <span>SHIFT</span> sprint <span>LMB</span> fire <span>R</span> reload <span>ESC</span> pause</div>
        <div class="menu-footer"><span>BUILD 1.0 // NIGHTFALL SYSTEMS</span><span>NO SIGNAL REQUIRED</span></div>
      </section>
      <section class="menu-panel pause-panel" data-panel="pause">
        <div class="eyebrow"><span class="eyebrow-line"></span> OPERATION SUSPENDED</div>
        <h2>PAUSED</h2>
        <p class="tagline">The ward is waiting.</p>
        <button class="primary-button" id="resume-button" type="button"><span>RESUME</span><i>▶</i></button>
        <label class="setting-row"><span><b>SENSITIVITY</b><small>APPLIES IMMEDIATELY</small></span><input id="pause-sensitivity" type="range" min="0.35" max="2.2" step="0.05"><output id="pause-sensitivity-output">1.00</output></label>
        <button class="secondary-button" id="pause-restart-button" type="button">RESTART OPERATION</button>
        <button class="text-button" id="pause-menu-button" type="button">RETURN TO MAIN MENU</button>
        <div class="menu-footer"><span>ESC RELEASES POINTER LOCK</span><span>PROGRESS IS NOT SAVED</span></div>
      </section>
      <section class="menu-panel game-over-panel" data-panel="game-over">
        <div class="eyebrow danger"><span class="eyebrow-line"></span> SIGNAL LOST</div>
        <h2>WARD<br><em>FALLEN</em></h2>
        <div class="result-grid">
          <div><small>SCORE</small><strong id="result-score">000000</strong></div>
          <div><small>WAVE</small><strong id="result-wave">00</strong></div>
          <div><small>CONFIRMED</small><strong id="result-kills">00</strong></div>
          <div><small>HEADSHOTS</small><strong id="result-headshots">00</strong></div>
          <div><small>ACCURACY</small><strong id="result-accuracy">0.0%</strong></div>
        </div>
        <button class="primary-button" id="game-over-restart-button" type="button"><span>TRY AGAIN</span><i>↗</i></button>
        <button class="text-button" id="game-over-menu-button" type="button">RETURN TO MAIN MENU</button>
        <div class="menu-footer"><span>THE NIGHT DOES NOT END</span><span>REDEPLOY WHEN READY</span></div>
      </section>
    `;
    parent.appendChild(this.root);

    this.mainPanel = this.requirePanel('main');
    this.pausePanel = this.requirePanel('pause');
    this.gameOverPanel = this.requirePanel('game-over');
    this.mainSensitivity = this.requireInput('main-sensitivity');
    this.pauseSensitivity = this.requireInput('pause-sensitivity');
    this.sensitivityReadouts = [this.require('main-sensitivity-output'), this.require('pause-sensitivity-output')];
    this.difficultyButtons = Array.from(this.root.querySelectorAll<HTMLButtonElement>('[data-difficulty]'));

    this.setSensitivity(loadSensitivity());
    this.selectDifficulty(this.selectedDifficulty);

    this.difficultyButtons.forEach((button) => button.addEventListener('click', () => {
      const difficulty = button.dataset.difficulty;
      if (difficulty === 'easy' || difficulty === 'normal' || difficulty === 'hard') {
        this.selectDifficulty(difficulty);
        callbacks.sensitivity(Number(this.mainSensitivity.value));
      }
    }));
    this.mainSensitivity.addEventListener('input', () => this.handleSensitivity(this.mainSensitivity));
    this.pauseSensitivity.addEventListener('input', () => this.handleSensitivity(this.pauseSensitivity));
    this.requireButton('start-button').addEventListener('click', () => callbacks.start(this.selectedDifficulty));
    this.requireButton('resume-button').addEventListener('click', callbacks.resume);
    this.requireButton('pause-restart-button').addEventListener('click', callbacks.restart);
    this.requireButton('pause-menu-button').addEventListener('click', callbacks.mainMenu);
    this.requireButton('game-over-restart-button').addEventListener('click', callbacks.restart);
    this.requireButton('game-over-menu-button').addEventListener('click', callbacks.mainMenu);
  }

  showMain(): void {
    this.showPanel(this.mainPanel);
  }

  showPause(): void {
    this.showPanel(this.pausePanel);
  }

  showGameOver(stats: GameStats): void {
    this.require('result-score').textContent = String(stats.score).padStart(6, '0');
    this.require('result-wave').textContent = String(stats.wave).padStart(2, '0');
    this.require('result-kills').textContent = String(stats.kills).padStart(2, '0');
    this.require('result-headshots').textContent = String(stats.headshots).padStart(2, '0');
    this.require('result-accuracy').textContent = `${stats.shotsFired > 0 ? ((stats.shotsHit / stats.shotsFired) * 100).toFixed(1) : '0.0'}%`;
    this.showPanel(this.gameOverPanel);
  }

  get sensitivity(): number {
    return Number(this.mainSensitivity.value);
  }

  private handleSensitivity(source: HTMLInputElement): void {
    const value = Math.min(MAX_SENSITIVITY, Math.max(MIN_SENSITIVITY, Number(source.value)));
    this.setSensitivity(value);
    saveSensitivity(value);
    this.callbacks.sensitivity(value);
  }

  private setSensitivity(value: number): void {
    const fixed = value.toFixed(2);
    this.mainSensitivity.value = String(value);
    this.pauseSensitivity.value = String(value);
    this.sensitivityReadouts.forEach((readout) => { readout.textContent = fixed; });
  }

  private selectDifficulty(difficulty: Difficulty): void {
    this.selectedDifficulty = difficulty;
    saveDifficulty(difficulty);
    this.difficultyButtons.forEach((button) => button.classList.toggle('is-selected', button.dataset.difficulty === difficulty));
  }

  private showPanel(panel: HTMLElement): void {
    this.root.classList.add('is-visible');
    [this.mainPanel, this.pausePanel, this.gameOverPanel].forEach((candidate) => candidate.classList.toggle('is-active', candidate === panel));
  }

  private requirePanel(name: string): HTMLElement {
    const panel = this.root.querySelector<HTMLElement>(`[data-panel="${name}"]`);
    if (!panel) throw new Error(`Menu panel ${name} was not created`);
    return panel;
  }

  private require(id: string): HTMLElement {
    const element = this.root.querySelector<HTMLElement>(`#${id}`);
    if (!element) throw new Error(`Menu element #${id} was not created`);
    return element;
  }

  private requireInput(id: string): HTMLInputElement {
    const element = this.root.querySelector<HTMLInputElement>(`#${id}`);
    if (!element) throw new Error(`Menu input #${id} was not created`);
    return element;
  }

  private requireButton(id: string): HTMLButtonElement {
    const element = this.root.querySelector<HTMLButtonElement>(`#${id}`);
    if (!element) throw new Error(`Menu button #${id} was not created`);
    return element;
  }
}
