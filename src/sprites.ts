// 스프라이트 시트 로드와 그리기
import sheetUrl from './assets/dungeon-tileset-ii.png';
import { GEN_SIZE, genCanvas, isGenKey, type GenKey } from './icons';
import { S, type SpriteKey, type Spr } from './spritesheet';
import { RAGE_RAMP, recolor } from './rage';

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

// ---------- 보스 2페이즈 스프라이트 ----------
// 원본 프레임을 팔레트로 다시 칠하고, 프레임마다 머리 꼭대기를 찾아 픽셀 뿔을 직접 그려 넣은 새 시트를 만든다.

const RAGE_PAD = 9; // 뿔이 들어갈 위쪽 여백(px)
const rageCache = new Map<string, HTMLCanvasElement>();

function buildRage(key: SpriteKey, tier: number): HTMLCanvasElement {
  const s: Spr = S[key];
  const n = s.n ?? 1;
  const W = s.w * n;
  const H = s.h + RAGE_PAD;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const c = cv.getContext('2d')!;
  c.drawImage(sheet, s.x, s.y, W, s.h, 0, RAGE_PAD, W, s.h);
  const img = c.getImageData(0, 0, W, H);
  const d = img.data;
  recolor(d, tier, true);

  const ramp = RAGE_RAMP[tier];
  const rgb = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const BONE = rgb('#ece0c8');
  const BONE_D = rgb('#a89878');
  const TIP = rgb(ramp[4]);
  const OUT = [10, 4, 6];
  const at = (x: number, y: number) => (y * W + x) * 4;
  const opaque = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && d[at(x, y) + 3] > 0;
  const horn = new Set<number>(); // 뿔 픽셀(외곽선을 따로 두르기 위해 기록)
  const put = (x: number, y: number, col: number[]) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = at(x, y);
    d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
    horn.add(y * W + x);
  };

  for (let f = 0; f < n; f++) {
    const x0 = f * s.w;
    // 머리 꼭대기: 프레임 폭의 35% 이상 차는 첫 행(머리 위 새싹 같은 작은 장식은 건너뛴다)
    let top = -1;
    for (let y = 0; y < H && top < 0; y++) {
      let cnt = 0;
      for (let x = x0; x < x0 + s.w; x++) if (opaque(x, y)) cnt++;
      if (cnt >= s.w * 0.35) top = y;
    }
    if (top < 0) continue;
    let minX = x0 + s.w, maxX = x0;
    for (let y = top; y < Math.min(H, top + 4); y++) {
      for (let x = x0; x < x0 + s.w; x++) if (opaque(x, y)) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
    }
    const cx = (minX + maxX) / 2;
    const half = Math.max(3, (maxX - minX) / 2);
    // 머리 양쪽에서 바깥으로 휘어 올라가는 뿔(길이 8px, 밑동 2px 두께)
    for (const side of [-1, 1]) {
      const bx = Math.round(cx + side * half * 0.6);
      const by = top + 2;
      const L = 8;
      for (let i = 0; i < L; i++) {
        const y = by - i;
        const x = bx + side * Math.round((i * i) / 12);
        const col = i >= L - 2 ? TIP : i < 2 ? BONE_D : BONE;
        put(x, y, col);
        if (i < L - 3) put(x - side, y, i < 2 ? BONE_D : BONE); // 밑동은 두껍게
      }
    }
  }
  // 뿔 둘레에 도트 외곽선
  for (const k of horn) {
    const x = k % W, y = Math.floor(k / W);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || horn.has(ny * W + nx)) continue;
      const i = at(nx, ny);
      if (d[i + 3] === 0) { d[i] = OUT[0]; d[i + 1] = OUT[1]; d[i + 2] = OUT[2]; d[i + 3] = 255; }
    }
  }
  c.putImageData(img, 0, 0);
  return cv;
}

/** 보스 2페이즈 모습으로 그린다(발 기준). 시트가 아직 없으면 false. */
export function drawRage(c: CanvasRenderingContext2D, key: SpriteKey, tier: number, x: number, feetY: number, scale: number, o: DrawOpts = {}): boolean {
  if (!spritesReady()) return false;
  const id = `${key}:${tier}`;
  let cv = rageCache.get(id);
  if (!cv) {
    cv = buildRage(key, tier);
    rageCache.set(id, cv);
  }
  const s: Spr = S[key];
  const h = s.h + RAGE_PAD;
  c.save();
  c.translate(x, feetY);
  if (o.flip) c.scale(-1, 1);
  c.imageSmoothingEnabled = false;
  const src = o.flash && white ? white : cv;
  if (src === cv) c.drawImage(cv, (o.frame ?? 0) * s.w, 0, s.w, h, (-s.w * scale) / 2, -h * scale, s.w * scale, h * scale);
  else c.drawImage(src, s.x + (o.frame ?? 0) * s.w, s.y, s.w, s.h, (-s.w * scale) / 2, -s.h * scale, s.w * scale, s.h * scale);
  c.restore();
  return true;
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
