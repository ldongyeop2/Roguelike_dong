import './style.css';
import { Game, type Card } from './game';
import { Input } from './input';
import { MenuScene } from './menuScene';
import { applyRunResult, loadSave, persist, resetSave, type RunResult } from './meta';
import { UI } from './ui';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ui = new UI(document.getElementById('overlay')!);
const input = new Input(canvas);

let save = loadSave();
let game: Game | null = null;
let last = performance.now();
const scene = new MenuScene(canvas.getContext('2d')!);

function menu() {
  game = null;
  ui.showMenu(save, {
    onStart: startRun,
    onSelect: (id) => { scene.charId = id; },
    onReset: () => {
      save = resetSave();
      menu();
    },
  });
}

function startRun(charId: string) {
  save.lastChar = charId;
  persist(save);
  ui.hide();
  game = new Game(canvas, input, charId, save.unlocked, {
    onReward: (cards: Card[], room: number) => ui.showReward(cards, room, (c) => {
      ui.hide();
      game?.pickReward(c);
    }),
    onEnd: (r: RunResult) => {
      const newly = applyRunResult(save, r);
      ui.showEnd(r, newly, save, menu);
    },
    onPause: (paused) => {
      if (!paused) return ui.hide();
      if (!game) return;
      ui.showPause(
        game.equipment(),
        () => {
          if (game) game.paused = false;
          ui.hide();
        },
        () => {
          if (!game) return;
          const r = game.abandon();
          const newly = applyRunResult(save, r);
          ui.showEnd(r, newly, save, menu);
          game = null;
        },
      );
    },
  });
}

// 개발 모드에서만 자동 테스트용으로 현재 게임을 노출한다.
if (import.meta.env.DEV) Object.defineProperty(window, '__game', { get: () => game });

function frame(now: number) {
  const dt = (now - last) / 1000;
  last = now;
  if (game) {
    game.update(dt);
    game.render();
  } else {
    scene.update(Math.min(dt, 1 / 30));
    scene.render();
  }
  requestAnimationFrame(frame);
}

menu();
requestAnimationFrame(frame);
