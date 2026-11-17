import { drawHuman, drawMonster, drawShadow, getSprite, type HumanLook } from './art';
import { G, type Actor } from './game';
import { hash2, mulberry32, shade } from './util';
import { Tile, type Zone } from './world';

const HW = 32;
const HH = 16;

const TILE_COL = ['#72b34c', '#5c9d40', '#b08a58', '#e2cb8c', '#4aa3d8', '#a9abb8', '#eef3f8', '#bfe3f2', '#cfb27c'];
/** 경계에서 어느 지형이 위로 덮이는지 (클수록 위) */
const PRIO = [6, 7, 3, 2, 0, 1, 5, 4, 3];
const BG = { town: '#2f5a2c', meadow: '#2f5a2c', forest: '#22442a', waste: '#6a5236', snow: '#8fa3b8' };

const PLAYER_LOOK: HumanLook = { hair: '#c8502f', top: '#3f6fd0', bottom: '#4a4a5f', skin: '#ffe0c0', sword: true };

function buildGround(z: Zone): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = (z.w + z.h) * HW;
  cv.height = (z.w + z.h) * HH + 8;
  const c = cv.getContext('2d')!;
  const ox = z.h * HW;
  const seed = z.def.seed;
  const rng = mulberry32(seed * 7 + 1);
  const tileAt = (x: number, y: number) => (x < 0 || y < 0 || x >= z.w || y >= z.h ? -1 : z.tiles[y * z.w + x]);
  for (let y = 0; y < z.h; y++) {
    for (let x = 0; x < z.w; x++) {
      const t = z.tiles[y * z.w + x];
      const px = (x - y) * HW + ox;
      const py = (x + y) * HH;
      const col = shade(TILE_COL[t], (hash2(x, y, seed) - 0.5) * 0.09);
      c.beginPath();
      c.moveTo(px, py - 0.6);
      c.lineTo(px + HW + 0.8, py + HH);
      c.lineTo(px, py + HH * 2 + 0.6);
      c.lineTo(px - HW - 0.8, py + HH);
      c.closePath();
      c.fillStyle = col;
      c.fill();
      const pt = () => {
        const u = rng();
        const v = rng();
        return [px + (u - v) * (HW - 5), py + (u + v) * (HH - 2) + 2];
      };
      if (t === Tile.Grass || t === Tile.Grass2) {
        for (let i = 0; i < 5; i++) {
          const [qx, qy] = pt();
          c.strokeStyle = shade(TILE_COL[t], i % 2 ? 0.2 : -0.2);
          c.lineWidth = 1.2;
          c.beginPath();
          c.moveTo(qx, qy);
          c.lineTo(qx + (i % 2 ? 1.5 : -1.5), qy - 3.5);
          c.stroke();
        }
        if (hash2(x, y, seed + 3) < 0.07) {
          const [qx, qy] = pt();
          const fc = ['#ffffff', '#ffe05a', '#ff9ac0'][Math.floor(rng() * 3)];
          for (const [dx, dy] of [[0, 0], [5, 2], [-4, 3]]) {
            c.fillStyle = fc;
            c.beginPath();
            c.arc(qx + dx, qy + dy, 1.7, 0, 7);
            c.fill();
            c.fillStyle = '#f0a020';
            c.fillRect(qx + dx - 0.5, qy + dy - 0.5, 1, 1);
          }
        }
      } else if (t === Tile.Water) {
        c.strokeStyle = 'rgba(255,255,255,0.35)';
        c.lineWidth = 1.2;
        for (let i = 0; i < 2; i++) {
          const [qx, qy] = pt();
          c.beginPath();
          c.moveTo(qx - 5, qy);
          c.quadraticCurveTo(qx, qy - 2.5, qx + 5, qy);
          c.stroke();
        }
        // 물가의 둑
        c.fillStyle = 'rgba(40,60,50,0.45)';
        if (tileAt(x - 1, y) !== Tile.Water) {
          c.beginPath();
          c.moveTo(px, py);
          c.lineTo(px - HW, py + HH);
          c.lineTo(px - HW, py + HH + 5);
          c.lineTo(px, py + 5);
          c.fill();
        }
        if (tileAt(x, y - 1) !== Tile.Water) {
          c.beginPath();
          c.moveTo(px, py);
          c.lineTo(px + HW, py + HH);
          c.lineTo(px + HW, py + HH + 5);
          c.lineTo(px, py + 5);
          c.fill();
        }
      } else {
        const dots = t === Tile.Snow || t === Tile.Ice ? 3 : 5;
        for (let i = 0; i < dots; i++) {
          const [qx, qy] = pt();
          c.fillStyle = shade(TILE_COL[t], t === Tile.Snow ? -0.1 : i % 2 ? 0.22 : -0.2);
          c.beginPath();
          c.ellipse(qx, qy, 1.6 + rng() * 1.6, 1 + rng() * 0.8, 0, 0, 7);
          c.fill();
        }
        if (t === Tile.Stone && z.def.theme === 'town') {
          c.strokeStyle = 'rgba(60,60,80,0.25)';
          c.lineWidth = 1;
          c.beginPath();
          c.moveTo(px, py);
          c.lineTo(px + HW, py + HH);
          c.lineTo(px, py + HH * 2);
          c.lineTo(px - HW, py + HH);
          c.closePath();
          c.stroke();
        }
      }
    }
  }
  // 지형 경계: 우선순위가 높은 지형이 이웃 타일 안쪽으로 불규칙하게 번져 들어간다.
  const NB = [[-1, 0], [0, -1], [1, 0], [0, 1]];
  for (let y = 0; y < z.h; y++) {
    for (let x = 0; x < z.w; x++) {
      const t = z.tiles[y * z.w + x];
      if (t === Tile.Water) continue;
      const px = (x - y) * HW + ox;
      const py = (x + y) * HH;
      const V = [[px, py], [px + HW, py + HH], [px, py + HH * 2], [px - HW, py + HH]];
      const E = [[3, 0], [0, 1], [1, 2], [2, 3]];
      for (let k = 0; k < 4; k++) {
        const nt = tileAt(x + NB[k][0], y + NB[k][1]);
        if (nt < 0 || nt === t || nt === Tile.Water || PRIO[nt] <= PRIO[t]) continue;
        const [a, b] = [V[E[k][0]], V[E[k][1]]];
        c.fillStyle = TILE_COL[nt];
        for (let i = 0; i < 7; i++) {
          const u = (i + rng() * 0.8) / 7;
          const r = 4 + rng() * 6;
          const ex = a[0] + (b[0] - a[0]) * u;
          const ey = a[1] + (b[1] - a[1]) * u;
          // 타일 중심 쪽으로 살짝 들여서 그린다.
          const cxp = px - ex;
          const cyp = py + HH - ey;
          const m = Math.hypot(cxp, cyp) || 1;
          c.beginPath();
          c.ellipse(ex + (cxp / m) * r * 0.3, ey + (cyp / m) * r * 0.15, r, r * 0.55, 0, 0, 7);
          c.fill();
        }
      }
    }
  }
  return cv;
}

export class Renderer {
  ctx: CanvasRenderingContext2D;
  grounds = new Map<string, HTMLCanvasElement>();
  scale = 1;
  camX = 0;
  camY = 0;
  W = 0;
  H = 0;

  constructor(public canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    this.W = this.canvas.width = Math.floor(innerWidth * dpr);
    this.H = this.canvas.height = Math.floor(innerHeight * dpr);
    const zoom = innerHeight < 620 || innerWidth < 700 ? 1.1 : 1.4;
    this.scale = dpr * zoom;
  }

  ground(z: Zone): HTMLCanvasElement {
    let g = this.grounds.get(z.def.id);
    if (!g) {
      g = buildGround(z);
      this.grounds.set(z.def.id, g);
    }
    return g;
  }

  /** 화면 CSS 좌표를 타일 좌표로 */
  toWorld(cssX: number, cssY: number) {
    const dpr = this.W / innerWidth;
    const px = (cssX * dpr - this.W / 2) / this.scale + this.camX;
    const py = (cssY * dpr - this.H / 2) / this.scale + this.camY;
    return { x: (px / HW + py / HH) / 2, y: (py / HH - px / HW) / 2 };
  }

  pick(cssX: number, cssY: number): Actor | null {
    const dpr = this.W / innerWidth;
    const px = (cssX * dpr - this.W / 2) / this.scale + this.camX;
    const py = (cssY * dpr - this.H / 2) / this.scale + this.camY;
    let best: Actor | null = null;
    let bd = -Infinity;
    for (const a of G.actors) {
      if (a.dead || a.type === 'player' || a.type === 'pet') continue;
      const s = a.sp ? a.sp.size : 1;
      const sx = (a.x - a.y) * HW;
      const sy = (a.x + a.y) * HH;
      if (Math.abs(px - sx) < 20 * s + 4 && py > sy - 52 * s - 6 && py < sy + 10) {
        const d = a.x + a.y;
        if (d > bd) {
          bd = d;
          best = a;
        }
      }
    }
    return best;
  }

  draw() {
    const c = this.ctx;
    const z = G.zone;
    const p = G.player;
    const s = this.scale;
    this.camX = (p.x - p.y) * HW;
    this.camY = (p.x + p.y) * HH - 24;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = BG[z.def.theme];
    c.fillRect(0, 0, this.W, this.H);
    c.setTransform(s, 0, 0, s, Math.round(this.W / 2 - this.camX * s), Math.round(this.H / 2 - this.camY * s));
    c.drawImage(this.ground(z), -z.h * HW, 0);

    const vw = this.W / s / 2 + 130;
    const vh = this.H / s / 2 + 150;
    const t = G.time;

    // 포탈
    for (const q of z.def.portals) {
      const sx = (q.x + 0.5 - (q.y + 0.5)) * HW;
      const sy = (q.x + 0.5 + q.y + 0.5) * HH;
      for (let i = 0; i < 3; i++) {
        const k = (t * 0.6 + i / 3) % 1;
        c.beginPath();
        c.ellipse(sx, sy - k * 34, 26 * (1 - k * 0.45), 13 * (1 - k * 0.45), 0, 0, 7);
        c.strokeStyle = `rgba(150,220,255,${0.9 * (1 - k)})`;
        c.lineWidth = 3;
        c.stroke();
      }
      c.beginPath();
      c.ellipse(sx, sy, 26, 13, 0, 0, 7);
      c.fillStyle = 'rgba(120,200,255,0.35)';
      c.fill();
    }

    // 깊이 정렬
    type D = { d: number; a?: Actor; o?: { type: string; x: number; y: number; v: number } };
    const list: D[] = [];
    for (const o of z.objs) {
      const sx = (o.x - o.y) * HW - this.camX;
      const sy = (o.x + o.y) * HH - this.camY;
      if (Math.abs(sx) > vw || Math.abs(sy) > vh) continue;
      list.push({ d: o.x + o.y, o });
    }
    for (const a of G.actors) {
      if (a.type === 'pet' && a.dead) continue;
      list.push({ d: a.x + a.y, a });
    }
    list.sort((u, v) => u.d - v.d);

    for (const it of list) {
      if (it.o) {
        const o = it.o;
        const sp = getSprite(o.type, o.v);
        c.drawImage(sp.c, (o.x - o.y) * HW - sp.ax, (o.x + o.y) * HH - sp.ay, sp.w, sp.h);
      } else this.drawActor(it.a!);
    }

    // 이펙트
    for (const f of G.fx) {
      const k = f.t / f.dur;
      if (f.type === 'proj') {
        const x = f.x + (f.tx - f.x) * k;
        const y = f.y + (f.ty - f.y) * k;
        c.beginPath();
        c.arc((x - y) * HW, (x + y) * HH - 20, 4.5, 0, 7);
        c.fillStyle = f.color;
        c.fill();
        c.strokeStyle = '#fff';
        c.lineWidth = 1.5;
        c.stroke();
      } else if (f.type === 'ring') {
        c.beginPath();
        c.ellipse((f.x - f.y) * HW, (f.x + f.y) * HH - k * 26, 10 + k * 26, 5 + k * 13, 0, 0, 7);
        c.strokeStyle = f.color;
        c.globalAlpha = 1 - k;
        c.lineWidth = 3;
        c.stroke();
        c.globalAlpha = 1;
      } else {
        const sx = (f.x - f.y) * HW;
        const sy = (f.x + f.y) * HH - 20;
        c.strokeStyle = `rgba(255,255,255,${1 - k})`;
        c.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          const a = i * 1.57 + 0.6;
          c.beginPath();
          c.moveTo(sx + Math.cos(a) * 4, sy + Math.sin(a) * 4);
          c.lineTo(sx + Math.cos(a) * (8 + k * 9), sy + Math.sin(a) * (8 + k * 9));
          c.stroke();
        }
      }
    }

    // 떠오르는 숫자
    c.textAlign = 'center';
    for (const f of G.floats) {
      if (f.t < 0) continue;
      const sx = (f.x - f.y) * HW;
      const sy = (f.x + f.y) * HH - 46 - f.t * 34;
      c.globalAlpha = f.t > 0.6 ? 1 - (f.t - 0.6) / 0.3 : 1;
      c.font = `bold ${f.big ? 17 : 13}px sans-serif`;
      c.lineWidth = 3;
      c.strokeStyle = '#1b1420';
      c.strokeText(f.text, sx, sy);
      c.fillStyle = f.color;
      c.fillText(f.text, sx, sy);
    }
    c.globalAlpha = 1;
  }

  drawActor(a: Actor) {
    const c = this.ctx;
    const sx = (a.x - a.y) * HW;
    const sy = (a.x + a.y) * HH;
    const size = a.sp ? a.sp.size : 1;
    const p = G.player;
    c.save();
    c.translate(sx, sy);
    if (a.dead) c.globalAlpha = Math.max(0, 1 - a.deadT / 0.7);

    // 선택/대상 표시
    if (a === p.target || a === G.hover) {
      c.beginPath();
      c.ellipse(0, 0, 20 * size, 10 * size, 0, 0, 7);
      c.strokeStyle = a.type === 'npc' ? '#ffe27a' : a === p.target ? '#ff5a4a' : 'rgba(255,255,255,0.8)';
      c.lineWidth = 2.2;
      c.stroke();
    }
    drawShadow(c, 13 * size);

    c.save();
    // 공격 시 대상 쪽으로 살짝 튀어나간다.
    if (a.atkAnim > 0) {
      const k = Math.sin((1 - a.atkAnim / 0.28) * Math.PI) * 7;
      c.translate(a.face * k, -k * 0.2);
    }
    c.scale(a.face, 1);
    if (a.flash > 0) c.filter = 'brightness(2.4)';
    const opts = { moving: a.moving, atk: a.atkAnim > 0 ? 1 - a.atkAnim / 0.28 : 0, back: a.back };
    if (a.type === 'player') drawHuman(c, PLAYER_LOOK, a.anim, opts);
    else if (a.type === 'npc') drawHuman(c, { hair: a.npc!.hair, top: a.npc!.top, bottom: '#5a4a3f', skin: '#ffe0c0', sword: false }, a.anim, { moving: false, atk: 0 });
    else drawMonster(c, a.sp!, a.anim, opts);
    c.restore();

    // 이름과 체력
    const top = -(a.sp ? (a.sp.kind === 'golem' || a.sp.kind === 'imp' ? 54 : a.sp.kind === 'bird' ? 58 : 44) * size : 52);
    c.textAlign = 'center';
    c.font = 'bold 11px sans-serif';
    c.lineWidth = 3;
    c.strokeStyle = 'rgba(20,16,30,0.85)';
    let label = a.name;
    let color = '#fff';
    if (a.type === 'mob') {
      label = `Lv.${a.lv} ${a.name}`;
      color = a.sp!.boss ? '#ff8a5a' : a.sp!.aggro ? '#ffb0a0' : '#ffffff';
    } else if (a.type === 'pet') {
      label = `Lv.${a.lv} ${a.name}`;
      color = '#9affb0';
    } else if (a.type === 'npc') color = '#ffe27a';
    if (!a.dead) {
      c.strokeText(label, 0, top);
      c.fillStyle = color;
      c.fillText(label, 0, top);
      const showBar = a.type === 'pet' || (a.type === 'mob' && (a.hp < a.maxHp || a === p.target || a === G.hover));
      if (showBar) {
        const w = a.sp && a.sp.boss ? 70 : 36;
        c.fillStyle = 'rgba(20,16,30,0.85)';
        c.fillRect(-w / 2 - 1, top + 3, w + 2, 6);
        c.fillStyle = a.type === 'pet' ? '#5fe07a' : '#ff5a4a';
        c.fillRect(-w / 2, top + 4, (w * Math.max(0, a.hp)) / a.maxHp, 4);
      }
    }
    c.restore();
  }

  drawMinimap(cv: HTMLCanvasElement) {
    const z = G.zone;
    const c = cv.getContext('2d')!;
    const g = this.ground(z);
    const k = cv.width / g.width;
    c.clearRect(0, 0, cv.width, cv.height);
    c.drawImage(g, 0, 0, cv.width, g.height * k);
    const dot = (x: number, y: number, col: string, r: number) => {
      c.fillStyle = col;
      c.beginPath();
      c.arc(((x - y) * HW + z.h * HW) * k, (x + y) * HH * k, r, 0, 7);
      c.fill();
    };
    for (const q of z.def.portals) dot(q.x + 0.5, q.y + 0.5, '#7fe0ff', 6);
    for (const a of G.actors) {
      if (a.dead) continue;
      if (a.type === 'mob') dot(a.x, a.y, a.sp!.boss ? '#ff8a00' : '#ff4a3a', a.sp!.boss ? 6 : 3);
      else if (a.type === 'npc') dot(a.x, a.y, '#ffe27a', 5);
      else if (a.type === 'pet') dot(a.x, a.y, '#7dff9a', 3.5);
    }
    dot(G.player.x, G.player.y, '#ffffff', 5.5);
  }
}
