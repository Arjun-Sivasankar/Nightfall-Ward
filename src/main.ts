import './styles/main.css';
import { Game } from './game/Game';
import { HUD } from './ui/HUD';
import { Menu } from './ui/Menu';

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('App root was not found');

const canvas = document.createElement('canvas');
canvas.id = 'game-canvas';
canvas.setAttribute('aria-label', 'Nightfall Ward game view');
app.appendChild(canvas);

let game: Game;
const hud = new HUD(app, () => game.toggleMute());
const menu = new Menu(app, {
  start: (difficulty) => game.startGame(difficulty),
  resume: () => game.resumeGame(),
  restart: () => game.restartGame(),
  mainMenu: () => game.returnToMenu(),
  sensitivity: (value) => game.setSensitivity(value),
});
game = new Game(canvas, hud, menu);
