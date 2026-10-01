// Kenney "Tiny Dungeon" (CC0) 스프라이트 시트. 16x16 타일 12열 x 11행.
import sheetUrl from './assets/tiny-dungeon.png';

const TILE = 16;
const COLS = 12;
const ROWS = 11;

const sheet = new Image();
let white: HTMLCanvasElement | null = null; // 피격 깜빡임용 흰색 실루엣

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
};
sheet.src = sheetUrl;

export const spritesReady = () => sheet.complete && sheet.naturalWidth > 0;

export interface DrawOpts {
  flip?: boolean;
  rot?: number;
  flash?: boolean;
}

/** 스프라이트 idx를 (x, y) 중심에 size 크기로 그린다. */
export function drawSprite(c: CanvasRenderingContext2D, idx: number, x: number, y: number, size: number, o: DrawOpts = {}) {
  const src = o.flash && white ? white : sheet;
  const sx = (idx % COLS) * TILE;
  const sy = Math.floor(idx / COLS) * TILE;
  c.save();
  c.translate(x, y);
  if (o.rot) c.rotate(o.rot);
  if (o.flip) c.scale(-1, 1);
  c.imageSmoothingEnabled = false;
  c.drawImage(src, sx, sy, TILE, TILE, -size / 2, -size / 2, size, size);
  c.restore();
}

/** DOM 요소에 스프라이트를 배경으로 표시하기 위한 인라인 스타일 */
export function spriteStyle(idx: number, px: number): string {
  const col = idx % COLS;
  const row = Math.floor(idx / COLS);
  return `width:${px}px;height:${px}px;flex:none;background-image:url(${sheetUrl});` +
    `background-size:${COLS * px}px ${ROWS * px}px;background-position:-${col * px}px -${row * px}px;` +
    'background-repeat:no-repeat;image-rendering:pixelated';
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
  c.fillStyle = '#2a2c38';
  c.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += T) for (let x = 0; x < w; x += T) drawSprite(c, 40, x + T / 2, y + T / 2, T);
  c.save();
  c.beginPath();
  c.rect(wall, wall, w - wall * 2, h - wall * 2);
  c.clip();
  // 바닥 타일: 대부분 기본 모래, 일부 자갈 무늬. 고정 시드로 매번 같은 배치.
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let y = wall; y < h - wall; y += T) {
    for (let x = wall; x < w - wall; x += T) drawSprite(c, rnd() < 0.15 ? 49 : 48, x + T / 2, y + T / 2, T);
  }
  c.fillStyle = 'rgba(20, 16, 24, 0.5)'; // 캐릭터가 묻히지 않도록 바닥을 약간 어둡게
  c.fillRect(wall, wall, w - wall * 2, h - wall * 2);
  c.restore();
  c.strokeStyle = 'rgba(0,0,0,0.6)';
  c.lineWidth = 3;
  c.strokeRect(wall, wall, w - wall * 2, h - wall * 2);
  bgCache = cv;
  return cv;
}
