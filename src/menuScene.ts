// 메뉴 화면 뒤에 깔리는 움직이는 던전 장면.
// 왼쪽은 메뉴 패널이 덮으므로 볼거리는 오른쪽에 모은다.
import { charById } from './content';
import { weaponById } from './gear';
import { animFrame, drawSprite, spritesReady } from './sprites';
import type { SpriteKey } from './spritesheet';

const W = 960;
const H = 640;
const T = 48; // 장면 타일 크기(16px x3)
const WALL_H = T * 4; // 뒷벽 높이

interface Walker { key: SpriteKey; x: number; y: number; vx: number; t: number; scale: number }
interface Ember { x: number; y: number; vy: number; vx: number; life: number; max: number; size: number }

const FOUNTAINS = [552, 888];
const BANNERS: [number, SpriteKey][] = [[456, 'banner_red'], [648, 'banner_blue'], [792, 'banner_green']];
const PILLARS = [504, 936];
const MOBS: SpriteKey[] = ['imp', 'orc_warrior', 'chort', 'orc_shaman', 'pumpkin'];

export class MenuScene {
  private t = 0;
  private walkers: Walker[] = [];
  private embers: Ember[] = [];
  private bg: HTMLCanvasElement | null = null;
  charId = 'knight';

  constructor(private ctx: CanvasRenderingContext2D) {
    for (let i = 0; i < 5; i++) {
      const key = MOBS[i % MOBS.length];
      this.walkers.push({
        key,
        x: 460 + Math.random() * 460,
        y: 290 + Math.random() * 70,
        vx: (Math.random() < 0.5 ? -1 : 1) * (18 + Math.random() * 22),
        t: Math.random() * 10,
        scale: key === 'pumpkin' ? 2.4 : 2.8,
      });
    }
  }

  /** 정적인 벽과 바닥을 한 번만 그려 둔다. */
  private background(): HTMLCanvasElement | null {
    if (this.bg) return this.bg;
    if (!spritesReady()) return null;
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const c = cv.getContext('2d')!;
    c.fillStyle = '#120e12';
    c.fillRect(0, 0, W, H);
    // 바닥
    let seed = 11;
    const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    const floors: SpriteKey[] = ['floor_2', 'floor_3', 'floor_4'];
    for (let y = WALL_H; y < H; y += T) {
      for (let x = 0; x < W; x += T) {
        const r = rnd();
        drawSprite(c, r < 0.12 ? floors[Math.floor(r * 25) % 3] : 'floor_1', x + T / 2, y + T / 2, 3);
      }
    }
    c.fillStyle = 'rgba(12, 8, 12, 0.3)';
    c.fillRect(0, WALL_H, W, H - WALL_H);
    // 뒷벽: 맨 위는 벽 윗면, 아래는 벽돌
    for (let x = 0; x < W; x += T) {
      drawSprite(c, 'wall_top', x + T / 2, T / 2 - 8, 3);
      for (let y = T - 8; y < WALL_H; y += T) drawSprite(c, 'wall', x + T / 2, y + T / 2, 3);
    }
    for (const [x, key] of BANNERS) drawSprite(c, key, x, WALL_H - T * 1.6, 3);
    // 벽 아래 그림자
    const g = c.createLinearGradient(0, WALL_H, 0, WALL_H + 70);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(0, WALL_H, W, 70);
    this.bg = cv;
    return cv;
  }

  update(dt: number) {
    this.t += dt;
    for (const w of this.walkers) {
      w.t += dt;
      w.x += w.vx * dt;
      if (w.x < 450 || w.x > 930) {
        w.vx = -w.vx;
        w.x = Math.max(450, Math.min(930, w.x));
      }
    }
    // 분수 주변에서 불씨가 피어오른다.
    if (Math.random() < dt * 14) {
      const fx = FOUNTAINS[Math.floor(Math.random() * FOUNTAINS.length)];
      this.embers.push({
        x: fx + (Math.random() - 0.5) * 40, y: WALL_H - 10, vx: (Math.random() - 0.5) * 12,
        vy: -(20 + Math.random() * 40), life: 0, max: 2 + Math.random() * 2.5, size: Math.random() < 0.3 ? 3 : 2,
      });
    }
    if (Math.random() < dt * 6) {
      this.embers.push({
        x: 420 + Math.random() * 540, y: H + 4, vx: (Math.random() - 0.5) * 8,
        vy: -(10 + Math.random() * 20), life: 0, max: 5 + Math.random() * 5, size: 2,
      });
    }
    for (const e of this.embers) {
      e.life += dt;
      e.x += (e.vx + Math.sin(this.t * 2 + e.y * 0.05) * 6) * dt;
      e.y += e.vy * dt;
    }
    this.embers = this.embers.filter((e) => e.life < e.max);
  }

  render() {
    const c = this.ctx;
    const bg = this.background();
    c.imageSmoothingEnabled = false;
    if (bg) c.drawImage(bg, 0, 0);
    else {
      c.fillStyle = '#120e12';
      c.fillRect(0, 0, W, H);
      return;
    }

    // 용암 분수(애니메이션)와 기둥
    const f = Math.floor(this.t * 6) % 3;
    for (const x of FOUNTAINS) {
      drawSprite(c, 'fountain_top', x, WALL_H - T * 2.5 - 8, 3);
      drawSprite(c, 'fountain_mid', x, WALL_H - T * 1.5, 3, { frame: f });
      drawSprite(c, 'fountain_basin', x, WALL_H - T * 0.5, 3, { frame: f });
    }
    for (const x of PILLARS) drawSprite(c, 'pillar', x, WALL_H + 30, 3, { anchor: 'feet' });

    // 분수 불빛(깜빡임)
    c.globalCompositeOperation = 'lighter';
    for (const [i, x] of FOUNTAINS.entries()) {
      const flick = 0.85 + 0.15 * Math.sin(this.t * 9 + i * 2) * Math.sin(this.t * 3.7 + i);
      const r = 190 * flick;
      const g = c.createRadialGradient(x, WALL_H - 30, 0, x, WALL_H - 30, r);
      g.addColorStop(0, 'rgba(255, 140, 50, 0.32)');
      g.addColorStop(1, 'rgba(255, 90, 20, 0)');
      c.fillStyle = g;
      c.fillRect(x - r, WALL_H - 30 - r, r * 2, r * 2);
    }
    c.globalCompositeOperation = 'source-over';

    // 돌아다니는 몬스터
    const sorted = [...this.walkers].sort((a, b) => a.y - b.y);
    for (const w of sorted) {
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.beginPath();
      c.ellipse(w.x, w.y, 14, 4, 0, 0, Math.PI * 2);
      c.fill();
      drawSprite(c, w.key, w.x, w.y, w.scale, { anchor: 'feet', frame: animFrame(w.key, w.t, true), flip: w.vx < 0 });
    }

    // 선택한 캐릭터: 바닥의 빛 원 위에서 대기 동작
    const cx = 712;
    const cy = 400;
    const glow = c.createRadialGradient(cx, cy, 4, cx, cy, 120);
    glow.addColorStop(0, 'rgba(255, 214, 140, 0.35)');
    glow.addColorStop(1, 'rgba(255, 214, 140, 0)');
    c.fillStyle = glow;
    c.beginPath();
    c.ellipse(cx, cy, 120, 40, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = 'rgba(255, 214, 140, 0.45)';
    c.lineWidth = 2;
    c.beginPath();
    c.ellipse(cx, cy, 70 + Math.sin(this.t * 2) * 4, 20, 0, 0, Math.PI * 2);
    c.stroke();
    const ch = charById(this.charId);
    c.fillStyle = 'rgba(0,0,0,0.45)';
    c.beginPath();
    c.ellipse(cx, cy, 30, 8, 0, 0, Math.PI * 2);
    c.fill();
    drawSprite(c, ch.sprite, cx, cy, 6, { anchor: 'feet', frame: animFrame(ch.sprite, this.t, false, 6) });
    // 시작 무기가 옆에서 천천히 떠오른다
    const wb = weaponById(ch.startWeapon);
    const bob = Math.sin(this.t * 2.2) * 6;
    drawSprite(c, wb.sprite, cx + 92, cy - 90 + bob, 3, { rot: 0.35 });

    // 불씨
    c.globalCompositeOperation = 'lighter';
    for (const e of this.embers) {
      const k = e.life / e.max;
      c.globalAlpha = Math.min(1, (1 - k) * 1.4) * (k < 0.1 ? k * 10 : 1);
      c.fillStyle = e.size > 2 ? '#ffb15a' : '#ff8a3a';
      c.fillRect(Math.round(e.x), Math.round(e.y), e.size, e.size);
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';

    // 비네트
    const v = c.createRadialGradient(W * 0.68, H * 0.55, 140, W * 0.6, H * 0.5, 720);
    v.addColorStop(0, 'rgba(8, 5, 10, 0)');
    v.addColorStop(1, 'rgba(8, 5, 10, 0.8)');
    c.fillStyle = v;
    c.fillRect(0, 0, W, H);
  }
}
