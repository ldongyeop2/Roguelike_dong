import { ZONES, type ZoneDef } from './data';
import { hash2, mulberry32, noise2, type Pt } from './util';

export const TW = 64;
export const TH = 32;

export const Tile = { Grass: 0, Grass2: 1, Dirt: 2, Sand: 3, Water: 4, Stone: 5, Snow: 6, Ice: 7, Path: 8 } as const;

export interface Obj {
  type: string;
  x: number;
  y: number;
  v: number;
}

export interface Zone {
  def: ZoneDef;
  w: number;
  h: number;
  tiles: Uint8Array;
  block: Uint8Array;
  objs: Obj[];
}

const cache = new Map<string, Zone>();

export function getZone(id: string): Zone {
  let z = cache.get(id);
  if (!z) {
    z = buildZone(ZONES[id]);
    cache.set(id, z);
  }
  return z;
}

function buildZone(def: ZoneDef): Zone {
  const { w, h, seed, theme } = def;
  const rng = mulberry32(seed);
  const tiles = new Uint8Array(w * h);
  const block = new Uint8Array(w * h);
  const reserved = new Uint8Array(w * h);
  const objs: Obj[] = [];
  const I = (x: number, y: number) => y * w + x;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = noise2(x / 7, y / 7, seed);
      let t: number = Tile.Grass;
      if (theme === 'meadow') t = n < 0.22 ? Tile.Water : n > 0.62 ? Tile.Grass2 : Tile.Grass;
      else if (theme === 'forest') t = n < 0.2 ? Tile.Water : n > 0.72 ? Tile.Grass : Tile.Grass2;
      else if (theme === 'waste') t = n < 0.2 ? Tile.Stone : n > 0.6 ? Tile.Dirt : Tile.Sand;
      else if (theme === 'snow') t = n < 0.22 ? Tile.Ice : n > 0.78 ? Tile.Stone : Tile.Snow;
      else t = n > 0.6 ? Tile.Grass2 : Tile.Grass;
      tiles[I(x, y)] = t;
      if (t === Tile.Water) block[I(x, y)] = 1;
    }
  }

  const pathTile = theme === 'snow' ? Tile.Stone : theme === 'waste' ? Tile.Dirt : Tile.Path;
  const clear = (x: number, y: number, r: number, tile: number | null) => {
    for (let oy = -r; oy <= r; oy++) {
      for (let ox = -r; ox <= r; ox++) {
        const px = x + ox;
        const py = y + oy;
        if (!inside(px, py)) continue;
        const i = I(px, py);
        reserved[i] = 1;
        block[i] = 0;
        if (tile !== null) tiles[i] = tile;
        else if (tiles[i] === Tile.Water) tiles[i] = Tile.Grass;
      }
    }
  };
  const carve = (x0: number, y0: number, x1: number, y1: number) => {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const wob = Math.sin(t * Math.PI) * Math.sin(t * 9 + seed) * 1.6;
      const horizontal = Math.abs(x1 - x0) >= Math.abs(y1 - y0);
      const x = Math.round(x0 + (x1 - x0) * t + (horizontal ? 0 : wob));
      const y = Math.round(y0 + (y1 - y0) * t + (horizontal ? wob : 0));
      clear(x, y, 1, pathTile);
    }
  };

  const cx = w >> 1;
  const cy = h >> 1;
  for (const p of def.portals) {
    carve(p.x, p.y, cx, cy);
    clear(p.x, p.y, 2, pathTile);
  }
  for (const s of def.spawns) {
    if (s.at) {
      carve(cx, cy, s.at[0], s.at[1]);
      clear(s.at[0], s.at[1], 3, null);
    }
  }

  if (theme === 'town') {
    carve(15, 15, 12, 12);
    carve(15, 15, 18, 12);
    carve(15, 15, 12, 18);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (Math.hypot(x - 15, y - 15) < 5.6) {
          tiles[I(x, y)] = Tile.Stone;
          reserved[I(x, y)] = 1;
        }
      }
    }
    const houses: [number, number][] = [[7, 6], [19, 5], [5, 19], [19, 20]];
    houses.forEach(([hx, hy], k) => {
      for (let oy = -1; oy <= 3; oy++) {
        for (let ox = -1; ox <= 3; ox++) {
          reserved[I(hx + ox, hy + oy)] = 1;
          if (ox >= 0 && ox < 3 && oy >= 0 && oy < 3) block[I(hx + ox, hy + oy)] = 1;
        }
      }
      objs.push({ type: 'house', x: hx + 1.5, y: hy + 1.5, v: k % 3 });
    });
    block[I(15, 15)] = 1;
    objs.push({ type: 'fountain', x: 15.5, y: 15.5, v: 0 });
    for (const n of def.npcs) {
      clear(n.x, n.y, 1, null);
      block[I(n.x, n.y)] = 1;
    }
  }

  const density = { town: 0.035, meadow: 0.05, forest: 0.13, waste: 0.05, snow: 0.07 }[theme];
  const pick = (r: number): string => {
    if (theme === 'forest') return r < 0.45 ? 'tree' : r < 0.85 ? 'pine' : r < 0.95 ? 'bush' : 'rock';
    if (theme === 'waste') return r < 0.35 ? 'deadtree' : r < 0.65 ? 'cactus' : 'rock';
    if (theme === 'snow') return r < 0.6 ? 'snowpine' : r < 0.85 ? 'snowrock' : 'crystal';
    return r < 0.65 ? 'tree' : r < 0.88 ? 'bush' : 'rock';
  };
  const borderType = { town: 'tree', meadow: 'tree', forest: 'pine', waste: 'rock', snow: 'snowpine' }[theme];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = I(x, y);
      const border = x < 2 || y < 2 || x >= w - 2 || y >= h - 2;
      if (border) {
        block[i] = 1;
        if (tiles[i] === Tile.Water) tiles[i] = Tile.Grass;
        objs.push({ type: borderType, x: x + 0.5, y: y + 0.5, v: Math.floor(rng() * 3) });
        continue;
      }
      if (reserved[i] || block[i]) continue;
      const clump = noise2(x / 3.5, y / 3.5, seed + 9) > 0.55 ? 2.1 : 0.55;
      if (rng() < density * clump) {
        block[i] = 1;
        objs.push({ type: pick(rng()), x: x + 0.3 + rng() * 0.4, y: y + 0.3 + rng() * 0.4, v: Math.floor(rng() * 3) });
      }
    }
  }

  return { def, w, h, tiles, block, objs };
}

export function blocked(z: Zone, x: number, y: number): boolean {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (tx < 0 || ty < 0 || tx >= z.w || ty >= z.h) return true;
  return z.block[ty * z.w + tx] === 1;
}

/** 두 지점 사이를 직선으로 걸을 수 있는지 */
export function walkable(z: Zone, ax: number, ay: number, bx: number, by: number): boolean {
  const d = Math.hypot(bx - ax, by - ay);
  const n = Math.max(1, Math.ceil(d / 0.2));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    if (blocked(z, ax + (bx - ax) * t, ay + (by - ay) * t)) return false;
  }
  return true;
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

export function findPath(z: Zone, sx: number, sy: number, tx: number, ty: number): Pt[] | null {
  const w = z.w;
  let gx = Math.floor(tx);
  let gy = Math.floor(ty);
  let goal: Pt = { x: tx, y: ty };
  if (blocked(z, gx, gy)) {
    let best = Infinity;
    let found = false;
    for (let oy = -5; oy <= 5; oy++) {
      for (let ox = -5; ox <= 5; ox++) {
        const px = Math.floor(tx) + ox;
        const py = Math.floor(ty) + oy;
        if (blocked(z, px, py)) continue;
        const d = Math.hypot(px + 0.5 - tx, py + 0.5 - ty);
        if (d < best) {
          best = d;
          gx = px;
          gy = py;
          found = true;
        }
      }
    }
    if (!found) return null;
    goal = { x: gx + 0.5, y: gy + 0.5 };
  }
  const s0x = Math.floor(sx);
  const s0y = Math.floor(sy);
  if ((s0x === gx && s0y === gy) || walkable(z, sx, sy, goal.x, goal.y)) return [goal];

  const N = w * z.h;
  const g = new Float32Array(N).fill(Infinity);
  const f = new Float32Array(N);
  const from = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const open: number[] = [];
  const start = s0y * w + s0x;
  const end = gy * w + gx;
  g[start] = 0;
  f[start] = Math.hypot(gx - s0x, gy - s0y);
  open.push(start);
  let iter = 0;
  let ok = false;
  while (open.length && iter++ < 5000) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[bi]]) bi = i;
    const cur = open[bi];
    open[bi] = open[open.length - 1];
    open.pop();
    if (cur === end) {
      ok = true;
      break;
    }
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cxp = cur % w;
    const cyp = (cur - cxp) / w;
    for (const [dx, dy] of DIRS) {
      const nx = cxp + dx;
      const ny = cyp + dy;
      if (blocked(z, nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && (blocked(z, cxp + dx, cyp) || blocked(z, cxp, cyp + dy))) continue;
      const ni = ny * w + nx;
      if (closed[ni]) continue;
      const ng = g[cur] + (dx !== 0 && dy !== 0 ? 1.4142 : 1);
      if (ng < g[ni]) {
        g[ni] = ng;
        f[ni] = ng + Math.hypot(gx - nx, gy - ny);
        from[ni] = cur;
        open.push(ni);
      }
    }
  }
  if (!ok) return null;
  const pts: Pt[] = [];
  for (let c = end; c !== start && c !== -1; c = from[c]) pts.push({ x: (c % w) + 0.5, y: Math.floor(c / w) + 0.5 });
  pts.reverse();
  pts[pts.length - 1] = goal;
  // 직선으로 갈 수 있는 구간은 중간 지점을 건너뛴다.
  const out: Pt[] = [];
  let cur: Pt = { x: sx, y: sy };
  let i = 0;
  while (i < pts.length) {
    let j = pts.length - 1;
    while (j > i && !walkable(z, cur.x, cur.y, pts[j].x, pts[j].y)) j--;
    out.push(pts[j]);
    cur = pts[j];
    i = j + 1;
  }
  return out;
}

/** 주변이 트인 빈 타일을 찾는다. */
export function freeSpot(z: Zone, x0: number, x1: number, avoid: Pt[], minDist: number): Pt | null {
  for (let tries = 0; tries < 300; tries++) {
    const x = Math.floor(x0 + Math.random() * (x1 - x0));
    const y = Math.floor(3 + Math.random() * (z.h - 6));
    if (blocked(z, x, y)) continue;
    let open = 0;
    for (const [dx, dy] of DIRS) if (!blocked(z, x + dx, y + dy)) open++;
    if (open < 6) continue;
    const p = { x: x + 0.5, y: y + 0.5 };
    if (avoid.some((a) => Math.hypot(a.x - p.x, a.y - p.y) < minDist)) continue;
    return p;
  }
  return null;
}

export const tileHash = (x: number, y: number, seed: number) => hash2(x, y, seed);
