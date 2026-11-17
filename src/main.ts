import './style.css';
import { G, initGame, moveTo, nearestMob, save, setTarget, skillSong, skillStrike, update, usePotion } from './game';
import { Renderer } from './render';
import { closeWin, initUI, openWin, updateUI } from './ui';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const R = new Renderer(canvas);
initGame();
initUI();

let held = false;
let holdT = 0;
let mx = 0;
let my = 0;

canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  mx = e.clientX;
  my = e.clientY;
  const a = R.pick(mx, my);
  if (a) {
    setTarget(a);
    return;
  }
  const w = R.toWorld(mx, my);
  moveTo(w.x, w.y);
  held = true;
  holdT = 0.2;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  mx = e.clientX;
  my = e.clientY;
  G.hover = R.pick(mx, my);
  canvas.style.cursor = G.hover ? 'pointer' : 'default';
});
const release = () => (held = false);
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

addEventListener('keydown', (e) => {
  if (e.repeat) return;
  switch (e.key.toLowerCase()) {
    case '1': skillStrike(); break;
    case '2': skillSong(); break;
    case 'q': usePotion('hp'); break;
    case 'e': usePotion('mp'); break;
    case 'i': openWin('bag'); break;
    case 'k': openWin('stones'); break;
    case 'p': openWin('pets'); break;
    case 'b': openWin('book'); break;
    case 'h': openWin('help'); break;
    case 'escape': closeWin(); break;
    case 'tab': {
      e.preventDefault();
      const m = nearestMob(9);
      if (m) setTarget(m);
      break;
    }
  }
});
addEventListener('beforeunload', save);

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (held) {
    holdT -= dt;
    if (holdT <= 0) {
      holdT = 0.2;
      const w = R.toWorld(mx, my);
      moveTo(w.x, w.y);
    }
  }
  update(dt);
  R.draw();
  updateUI(R, dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if (import.meta.env.DEV) (window as unknown as { G: typeof G }).G = G;
