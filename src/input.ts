import { W, H } from './game';

const MOVE: Record<string, [number, number]> = {
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};

export class Input {
  keys = new Set<string>();
  mx = W / 2;
  my = H / 2;
  down = false;
  private skillEdge = false;
  private pauseEdge = false;

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      if (e.code in MOVE || e.code === 'Space') e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'Space') this.skillEdge = true;
      if (e.code === 'Escape' || e.code === 'KeyP') this.pauseEdge = true;
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.down = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('mousemove', (e) => this.track(e));
    canvas.addEventListener('mousedown', (e) => {
      this.track(e);
      if (e.button === 0) this.down = true;
      if (e.button === 2) this.skillEdge = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.down = false;
    });
  }

  private track(e: MouseEvent) {
    const r = this.canvas.getBoundingClientRect();
    this.mx = ((e.clientX - r.left) / r.width) * W;
    this.my = ((e.clientY - r.top) / r.height) * H;
  }

  axis(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    for (const k of this.keys) {
      const m = MOVE[k];
      if (m) {
        x += m[0];
        y += m[1];
      }
    }
    const len = Math.hypot(x, y);
    return len > 0 ? { x: x / len, y: y / len } : { x: 0, y: 0 };
  }

  takeSkill(): boolean {
    const v = this.skillEdge;
    this.skillEdge = false;
    return v;
  }

  takePause(): boolean {
    const v = this.pauseEdge;
    this.pauseEdge = false;
    return v;
  }
}
