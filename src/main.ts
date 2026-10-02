import './style.css';
import { Game, type Card } from './game';
import { Input } from './input';
import { MenuScene } from './menuScene';
import { boss3d } from './boss3d';
import { applyRunResult, discover, isUnlocked, loadSave, persist, resetSave, type RunResult } from './meta';
import { WEAPONS, makeGear, rollStartRarity, type Gear } from './gear';
import { UI } from './ui';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ui = new UI(document.getElementById('overlay')!);
const input = new Input(canvas);

let save = loadSave();
let game: Game | null = null;
let last = performance.now();
const scene = new MenuScene(canvas.getContext('2d')!);
boss3d(); // 보스 3D 모델을 메뉴에 있는 동안 미리 불러온다.

function menu() {
  game = null;
  ui.showMenu(save, {
    onStart: startRun,
    onReset: () => {
      save = resetSave();
      menu();
    },
  });
}

/** 출정: 해금된 무기 중 하나를 등급과 함께 뽑는 연출을 보여 준 뒤 그 무기로 런을 시작한다. */
function startRun(charId: string) {
  save.lastChar = charId;
  persist(save);
  const pool = WEAPONS.filter((w) => isUnlocked(save, w.id));
  const weapon = makeGear(pool[Math.floor(Math.random() * pool.length)], rollStartRarity(), 1);
  ui.showGacha(pool, weapon, () => beginRun(charId, weapon));
}

function beginRun(charId: string, weapon: Gear) {
  ui.hide();
  game = new Game(canvas, input, charId, save.unlocked, {
    onReward: (cards: Card[], room: number) => ui.showReward(cards, room, (c) => {
      ui.hide();
      game?.pickReward(c);
    }),
    onSynergy: (id) => { discover(save, id); },
    onJob: (tier, ids) => ui.showJob(save, tier, ids, (id) => {
      ui.hide();
      game?.pickJob(id);
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
        game.synergyInfo(),
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
  }, weapon);
}

// 개발 모드에서만 자동 테스트용으로 현재 게임을 노출한다.
if (import.meta.env.DEV) {
  Object.defineProperty(window, '__game', { get: () => game });
  Object.defineProperty(window, '__boss3d', { get: () => boss3d() });
}

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
