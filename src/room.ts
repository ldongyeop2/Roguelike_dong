// 인게임 방 배경, 벽 장식 애니메이션, 조명.
// 1~5층/6~10층/11~15층마다 분위기(테마)가 바뀐다.
import { drawSprite, spritesReady } from './sprites';
import type { SpriteKey } from './spritesheet';

export interface Theme {
  name: string;
  banners: SpriteKey[];
  fountain: 'red' | 'blue';
  dark: number; // 조명 바깥 어둠 정도(0~1)
  tint: string; // 바닥 색조
  glow: [number, number, number]; // 분수 불빛 색
}

export const THEMES: Theme[] = [
  { name: '1층 · 지하 감옥', banners: ['banner_red', 'banner_yellow'], fountain: 'red', dark: 0.38, tint: 'rgba(40, 18, 10, 0.18)', glow: [255, 130, 50] },
  { name: '2층 · 잠긴 수로', banners: ['banner_blue', 'banner_green'], fountain: 'blue', dark: 0.46, tint: 'rgba(10, 30, 50, 0.25)', glow: [80, 170, 255] },
  { name: '3층 · 심연', banners: ['banner_green', 'banner_red'], fountain: 'red', dark: 0.56, tint: 'rgba(40, 10, 50, 0.3)', glow: [255, 70, 90] },
];

export const themeForRoom = (room: number) => THEMES[Math.min(THEMES.length - 1, Math.floor((room - 1) / 5))];

const T = 32;

/** 위쪽 벽에 놓이는 분수 위치. HUD 패널에 가리지 않는 구간(약 290~360, 600~790)에 둔다. */
export const FOUNTAIN_X = [328, 696];
const BANNER_X = [632, 760];

const cache = new Map<string, HTMLCanvasElement>();

/** 정적인 방 배경. 방마다 바닥 무늬와 해골 배치가 달라지도록 seed를 받는다. */
export function buildRoom(w: number, h: number, top: number, wall: number, theme: Theme, seed: number): HTMLCanvasElement | null {
  const key = `${theme.name}:${seed}`;
  const hit = cache.get(key);
  if (hit) return hit;
  if (!spritesReady()) return null;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const c = cv.getContext('2d')!;
  let s = seed * 7919 + 13;
  const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;

  c.fillStyle = '#0c090c';
  c.fillRect(0, 0, w, h);
  // 바닥
  const cracked: SpriteKey[] = ['floor_2', 'floor_3', 'floor_4'];
  for (let y = top - T; y < h; y += T) {
    for (let x = 0; x < w; x += T) {
      const r = rnd();
      drawSprite(c, r < 0.06 ? cracked[Math.floor(r * 50) % 3] : 'floor_1', x + T / 2, y + T / 2, 2);
    }
  }
  c.fillStyle = theme.tint;
  c.fillRect(0, top, w, h - top);
  // 바닥 소품(해골)
  for (let i = 0; i < 5; i++) {
    const x = wall + 40 + rnd() * (w - wall * 2 - 80);
    const y = top + 40 + rnd() * (h - top - wall - 80);
    drawSprite(c, 'skull', x, y, 2, { flip: rnd() < 0.5 });
  }
  // 벽 아래 그림자, 좌우/아래 가장자리 어둡게
  let g = c.createLinearGradient(0, top, 0, top + 60);
  g.addColorStop(0, 'rgba(0,0,0,0.6)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g;
  c.fillRect(0, top, w, 60);
  g = c.createLinearGradient(wall, 0, wall + 50, 0);
  g.addColorStop(0, 'rgba(0,0,0,0.45)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g;
  c.fillRect(wall, top, 50, h - top);
  g = c.createLinearGradient(w - wall, 0, w - wall - 50, 0);
  g.addColorStop(0, 'rgba(0,0,0,0.45)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g;
  c.fillRect(w - wall - 50, top, 50, h - top);

  // 위쪽 벽: 윗면 + 벽돌 두 줄
  for (let x = 0; x < w; x += T) {
    drawSprite(c, 'wall_top', x + T / 2, top - T * 2 - T / 2 + 4, 2);
    drawSprite(c, 'wall', x + T / 2, top - T * 1.5, 2);
    drawSprite(c, 'wall', x + T / 2, top - T / 2, 2);
  }
  BANNER_X.forEach((x, i) => drawSprite(c, theme.banners[i % theme.banners.length], x, top - T, 2));
  // 좌우/아래 벽(어둡게)
  c.save();
  c.beginPath();
  c.rect(0, top, wall, h - top);
  c.rect(w - wall, top, wall, h - top);
  c.rect(0, h - wall, w, wall);
  c.clip();
  for (let y = top; y < h; y += T) for (let x = 0; x < w; x += T) drawSprite(c, 'wall', x + T / 2, y + T / 2, 2);
  c.fillStyle = 'rgba(0,0,0,0.45)';
  c.fillRect(0, 0, w, h);
  c.restore();
  c.strokeStyle = 'rgba(0,0,0,0.7)';
  c.lineWidth = 2;
  c.strokeRect(wall - 1, top - 1, w - wall * 2 + 2, h - top - wall + 2);

  cache.set(key, cv);
  if (cache.size > 6) cache.delete(cache.keys().next().value!);
  return cv;
}

/** 위쪽 벽의 분수(애니메이션) */
export function drawWallAnim(c: CanvasRenderingContext2D, t: number, top: number, theme: Theme) {
  const f = Math.floor(t * 6) % 3;
  const mid: SpriteKey = theme.fountain === 'blue' ? 'fountain_mid_blue' : 'fountain_mid';
  const basin: SpriteKey = theme.fountain === 'blue' ? 'fountain_basin_blue' : 'fountain_basin';
  for (const x of FOUNTAIN_X) {
    drawSprite(c, 'fountain_top', x, top - T * 2.5 + 4, 2);
    drawSprite(c, mid, x, top - T * 1.5, 2, { frame: f });
    drawSprite(c, basin, x, top - T / 2, 2, { frame: f });
  }
}

export interface Light { x: number; y: number; r: number }

let lightCv: HTMLCanvasElement | null = null;

/**
 * 어둠을 깔고 광원 위치만 밝힌다. colored는 가산 혼합으로 색 빛을 더할 광원.
 */
export function drawLighting(
  c: CanvasRenderingContext2D, w: number, h: number, dark: number,
  lights: Light[], colored: (Light & { rgb: [number, number, number]; a: number })[],
) {
  if (!lightCv) {
    lightCv = document.createElement('canvas');
    lightCv.width = w;
    lightCv.height = h;
  }
  const l = lightCv.getContext('2d')!;
  l.globalCompositeOperation = 'source-over';
  l.clearRect(0, 0, w, h);
  l.fillStyle = `rgba(6, 3, 10, ${dark})`;
  l.fillRect(0, 0, w, h);
  l.globalCompositeOperation = 'destination-out';
  for (const s of lights) {
    const g = l.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.6)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    l.fillStyle = g;
    l.fillRect(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
  }
  c.drawImage(lightCv, 0, 0);
  c.save();
  c.globalCompositeOperation = 'lighter';
  for (const s of colored) {
    const [r, gg, b] = s.rgb;
    const g = c.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
    g.addColorStop(0, `rgba(${r},${gg},${b},${s.a})`);
    g.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    c.fillStyle = g;
    c.fillRect(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
  }
  c.restore();
}
