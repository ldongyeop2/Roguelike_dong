// 스프라이트 시트 로드와 그리기
import sheetUrl from './assets/dungeon-tileset-ii.png';
import { GEN_SIZE, genCanvas, isGenKey, type GenKey } from './icons';
import { S, type SpriteKey, type Spr } from './spritesheet';

/** 시트 스프라이트 또는 코드로 그린 아이콘 */
export type IconRef = SpriteKey | GenKey;

const SHEET = 512;
const sheet = new Image();
let white: HTMLCanvasElement | null = null; // 피격 깜빡임용 흰색 실루엣
let gray: HTMLCanvasElement | null = null; // 아직 전직하지 않은 모험가용 무채색 시트

sheet.onload = () => {
  const cv = document.createElement('canvas');
  cv.width = sheet.width;
  cv.height = sheet.height;
  const c = cv.getContext('2d')!;
  c.drawImage(sheet, 0, 0);
  c.globalCompositeOperation = 'source-in';
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, cv.width, cv.height);
  white = cv;
  const gv = document.createElement('canvas');
  gv.width = sheet.width;
  gv.height = sheet.height;
  const g = gv.getContext('2d')!;
  g.drawImage(sheet, 0, 0);
  const img = g.getImageData(0, 0, gv.width, gv.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    // 명암 대비를 키워 밝은 머리색과 피부가 하얗게 뭉개지지 않게 한다.
    const lum = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
    const l = Math.max(0, Math.min(255, (lum - 128) * 1.35 + 112));
    d[i] = l;
    d[i + 1] = l;
    d[i + 2] = Math.min(255, l * 1.06);
  }
  g.putImageData(img, 0, 0);
  gray = gv;
};
sheet.src = sheetUrl;

export const spritesReady = () => sheet.complete && sheet.naturalWidth > 0;

export interface DrawOpts {
  frame?: number;
  flip?: boolean;
  rot?: number;
  flash?: boolean;
  gray?: boolean;
  /** 기준점: center(기본) 또는 feet(아래 가운데) */
  anchor?: 'center' | 'feet';
}

/** 애니메이션 프레임 번호. moving이면 이동(4~7), 아니면 대기(0~3). */
export function animFrame(key: SpriteKey, t: number, moving: boolean, fps = 8): number {
  const n = (S[key] as Spr).n ?? 1;
  if (n < 4) return 0;
  const f = Math.floor(t * fps) % 4;
  return moving && n >= 8 ? 4 + f : f;
}

/** 시트의 스프라이트를 scale 배로 (x, y)에 그린다. */
export function drawSprite(c: CanvasRenderingContext2D, key: SpriteKey, x: number, y: number, scale: number, o: DrawOpts = {}) {
  const s: Spr = S[key];
  const src = o.flash && white ? white : o.gray && gray ? gray : sheet;
  const w = s.w * scale;
  const h = s.h * scale;
  c.save();
  c.translate(x, y);
  if (o.rot) c.rotate(o.rot);
  if (o.flip) c.scale(-1, 1);
  c.imageSmoothingEnabled = false;
  const oy = o.anchor === 'feet' ? -h : -h / 2;
  c.drawImage(src, s.x + (o.frame ?? 0) * s.w, s.y, s.w, s.h, -w / 2, oy, w, h);
  c.restore();
}

/** 아이콘을 size 크기 상자 안에 맞춰 그린다. */
export function drawIcon(c: CanvasRenderingContext2D, ref: IconRef, x: number, y: number, size: number) {
  if (isGenKey(ref)) {
    c.imageSmoothingEnabled = false;
    c.drawImage(genCanvas(ref), x - size / 2, y - size / 2, size, size);
    return;
  }
  const s: Spr = S[ref];
  drawSprite(c, ref, x, y, size / Math.max(s.w, s.h));
}

/**
 * DOM에 아이콘을 px 크기 상자에 맞춰 표시하는 HTML.
 * 코드로 그린 아이콘은 canvas로 내보내고, 붙인 뒤 paintGenIcons로 칠한다.
 */
export function iconHtml(ref: IconRef, px: number): string {
  if (isGenKey(ref)) {
    const k = Math.floor(px / GEN_SIZE);
    return `<canvas data-gen="${ref}" width="${GEN_SIZE}" height="${GEN_SIZE}" ` +
      `style="width:${GEN_SIZE * k}px;height:${GEN_SIZE * k}px;image-rendering:pixelated"></canvas>`;
  }
  const s: Spr = S[ref];
  const k = Math.floor(px / Math.max(s.w, s.h)) || px / Math.max(s.w, s.h);
  return `<i style="width:${s.w * k}px;height:${s.h * k}px;flex:none;background-image:url(${sheetUrl});` +
    `background-size:${SHEET * k}px ${SHEET * k}px;background-position:-${s.x * k}px -${s.y * k}px;` +
    'background-repeat:no-repeat;image-rendering:pixelated"></i>';
}

/** 바닥과 벽을 미리 그려둔 배경 캔버스. 시트가 로드되기 전에는 null. */
let bgCache: HTMLCanvasElement | null = null;
export function background(w: number, h: number, wall: number): HTMLCanvasElement | null {
  if (bgCache) return bgCache;
  if (!spritesReady()) return null;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const c = cv.getContext('2d')!;
  const T = 32;
  c.fillStyle = '#1b1820';
  c.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += T) for (let x = 0; x < w; x += T) drawSprite(c, 'wall', x + T / 2, y + T / 2, 2);
  c.save();
  c.beginPath();
  c.rect(wall, wall, w - wall * 2, h - wall * 2);
  c.clip();
  // 바닥 타일: 대부분 기본 바닥, 일부 금 간 바닥. 고정 시드로 매번 같은 배치.
  let seed = 7;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const cracked: SpriteKey[] = ['floor_2', 'floor_3', 'floor_4'];
  for (let y = wall; y < h - wall; y += T) {
    for (let x = wall; x < w - wall; x += T) {
      const r = rnd();
      drawSprite(c, r < 0.18 ? cracked[Math.floor(r * 100) % 3] : 'floor_1', x + T / 2, y + T / 2, 2);
    }
  }
  c.restore();
  c.strokeStyle = 'rgba(0,0,0,0.6)';
  c.lineWidth = 3;
  c.strokeRect(wall, wall, w - wall * 2, h - wall * 2);
  bgCache = cv;
  return cv;
}
