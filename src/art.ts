import { SPECIES, type Feature, type Species } from './data';
import { speciesIcon3d } from './sprites';
import { shade } from './util';

type C = CanvasRenderingContext2D;
const OUT = '#2a1f2d';

function ell(c: C, x: number, y: number, rx: number, ry: number, fill: string | CanvasGradient, stroke: string | null = OUT, lw = 1.6, rot = 0) {
  c.beginPath();
  c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.lineWidth = lw;
    c.strokeStyle = stroke;
    c.stroke();
  }
}

function poly(c: C, pts: number[], fill: string | CanvasGradient, stroke: string | null = OUT, lw = 1.6) {
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.lineJoin = 'round';
    c.lineWidth = lw;
    c.strokeStyle = stroke;
    c.stroke();
  }
}

function rrect(c: C, x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient, stroke: string | null = OUT) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.lineWidth = 1.6;
    c.strokeStyle = stroke;
    c.stroke();
  }
}

function line(c: C, pts: number[], color: string, lw: number) {
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.strokeStyle = color;
  c.lineWidth = lw;
  c.stroke();
}

/** 왼쪽 위에서 빛을 받는 입체감 그라디언트 */
function rg(c: C, x: number, y: number, r: number, col: string): CanvasGradient {
  const g = c.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.1, x, y, r * 1.2);
  g.addColorStop(0, shade(col, 0.4));
  g.addColorStop(0.55, col);
  g.addColorStop(1, shade(col, -0.3));
  return g;
}

function eye(c: C, x: number, y: number, r = 2.6) {
  ell(c, x, y, r, r * 1.25, '#fff', OUT, 1);
  ell(c, x + r * 0.3, y + 0.3, r * 0.55, r * 0.8, '#1b1420', null);
}

export function drawShadow(c: C, r: number) {
  c.beginPath();
  c.ellipse(0, 0, r, r * 0.45, 0, 0, Math.PI * 2);
  c.fillStyle = 'rgba(20,20,40,0.28)';
  c.fill();
}

export interface DrawOpts {
  moving: boolean;
  atk: number;
  back?: boolean;
}

interface Anchors {
  hx: number;
  hy: number;
  bx: number;
  by: number;
}

/** 몬스터를 오른쪽을 보는 모습으로 그린다. 발밑이 원점이다. */
export function drawMonster(c: C, sp: Species, t: number, o: DrawOpts) {
  const { col, col2 } = sp;
  c.save();
  c.scale(sp.size, sp.size);
  let A: Anchors;
  switch (sp.kind) {
    case 'blob': {
      const sq = Math.sin(t * 5) * (o.moving ? 0.13 : 0.05);
      const rx = 15 * (1 + sq);
      const ry = 13 * (1 - sq);
      ell(c, 0, -ry, rx, ry, rg(c, 0, -ry, 15, col));
      ell(c, -6, -ry - 5, 4, 2.4, 'rgba(255,255,255,0.6)', null, 0, -0.5);
      eye(c, 2, -ry - 1);
      eye(c, 9, -ry - 1);
      line(c, [4, -ry + 5, 6, -ry + 6.5, 8, -ry + 5], OUT, 1.2);
      A = { hx: 0, hy: -ry * 2 + 1, bx: 0, by: -ry * 2 + 2 };
      break;
    }
    case 'beast': {
      const sw = o.moving ? Math.sin(t * 14) * 5 : 0;
      const bob = o.moving ? -Math.abs(Math.sin(t * 14)) * 2 : Math.sin(t * 3) * 0.6;
      ell(c, -9 - sw, -4, 3.2, 5, shade(col2, -0.15));
      ell(c, 11 + sw, -4, 3.2, 5, shade(col2, -0.15));
      ell(c, -17, -18 + bob, 6.5, 3.6, col2, OUT, 1.6, -0.6);
      ell(c, 0, -14 + bob, 16, 10, rg(c, 0, -14 + bob, 16, col));
      ell(c, 1, -10 + bob, 10, 4.5, shade(col, 0.45), null);
      ell(c, -5 + sw, -4, 3.4, 5.2, col2);
      ell(c, 7 - sw, -4, 3.4, 5.2, col2);
      poly(c, [7, -28 + bob, 9, -38 + bob, 14, -30 + bob], col2);
      poly(c, [14, -30 + bob, 18, -38 + bob, 20, -27 + bob], col2);
      ell(c, 13, -22 + bob, 9.5, 8.5, rg(c, 13, -22 + bob, 10, col));
      ell(c, 20, -19 + bob, 4.2, 3.2, shade(col, 0.5), OUT, 1.2);
      ell(c, 23, -20 + bob, 1.4, 1.1, OUT, null);
      eye(c, 15, -24 + bob);
      A = { hx: 13, hy: -31 + bob, bx: -1, by: -24 + bob };
      break;
    }
    case 'bird': {
      const fl = Math.sin(t * (o.moving ? 18 : 9));
      const hv = -10 + Math.sin(t * 4) * 2;
      poly(c, [-8, -20 + hv, -20, -16 + hv, -18, -24 + hv], col2);
      ell(c, 0, -20 + hv, 10, 11, rg(c, 0, -20 + hv, 11, col));
      ell(c, 3, -16 + hv, 6, 6, shade(col, 0.5), null);
      ell(c, 6, -31 + hv, 7.5, 7, rg(c, 6, -31 + hv, 8, col));
      poly(c, [2, -37 + hv, 0, -44 + hv, 7, -38 + hv], col2);
      poly(c, [12, -33 + hv, 20, -30 + hv, 12, -27 + hv], '#f59a2f');
      eye(c, 8, -32 + hv);
      c.save();
      c.translate(-1, -23 + hv);
      c.rotate(-0.3 + fl * 0.8);
      ell(c, -8, 0, 10.5, 4.6, col2);
      c.restore();
      A = { hx: 5, hy: -38 + hv, bx: -1, by: -30 + hv };
      break;
    }
    case 'bug': {
      for (let i = -1; i <= 1; i++) {
        const k = o.moving ? Math.sin(t * 16 + i * 2) * 3 : 0;
        line(c, [i * 8, -6, i * 9 + k, 0], OUT, 2.2);
      }
      ell(c, 15, -9, 6.5, 6, rg(c, 15, -9, 7, col2));
      line(c, [17, -14, 20, -20, 24, -21], OUT, 1.4);
      line(c, [18, -13, 23, -16, 27, -15], OUT, 1.4);
      eye(c, 17, -10, 2.2);
      ell(c, 0, -11, 16, 10.5, rg(c, 0, -11, 16, col));
      c.beginPath();
      c.moveTo(-15, -12);
      c.quadraticCurveTo(0, -17, 15, -11);
      c.strokeStyle = shade(col, -0.45);
      c.lineWidth = 1.3;
      c.stroke();
      ell(c, -5, -15, 3, 2.2, col2, null);
      ell(c, 5, -16, 2.4, 1.9, col2, null);
      ell(c, -1, -8, 2.6, 2, col2, null);
      A = { hx: 14, hy: -15, bx: -1, by: -21 };
      break;
    }
    case 'plant': {
      const sway = Math.sin(t * 3) * 0.12;
      ell(c, -6, -2, 4.5, 2.6, col2);
      ell(c, 6, -2, 4.5, 2.6, col2);
      ell(c, -13, -12, 8, 4, col2, OUT, 1.6, 0.5 + sway);
      ell(c, 13, -12, 8, 4, col2, OUT, 1.6, -0.5 + sway);
      line(c, [0, -22, sway * 20, -31], OUT, 4.4);
      line(c, [0, -22, sway * 20, -31], col2, 2.4);
      ell(c, 0, -12, 11.5, 12, rg(c, 0, -12, 12, col));
      eye(c, 1, -13);
      eye(c, 8, -13);
      line(c, [3, -7, 5, -5.5, 7, -7], OUT, 1.2);
      const hx = sway * 20;
      ell(c, hx - 5, -33, 6, 3, col2, OUT, 1.4, 0.6);
      ell(c, hx + 5, -33, 6, 3, col2, OUT, 1.4, -0.6);
      A = { hx, hy: -33, bx: 0, by: -24 };
      break;
    }
    case 'golem': {
      const st = o.moving ? Math.sin(t * 9) * 3 : 0;
      rrect(c, -11, -11 + Math.min(0, st), 9, 11, 3, col2);
      rrect(c, 2, -11 + Math.min(0, -st), 9, 11, 3, col2);
      ell(c, -16, -23 + st * 0.5, 6, 9, rg(c, -16, -23, 8, col2));
      rrect(c, -13, -36, 26, 26, 7, rg(c, 0, -24, 18, col));
      line(c, [-6, -30, -2, -24, -7, -18], shade(col, -0.4), 1.2);
      line(c, [6, -16, 9, -22], shade(col, -0.4), 1.2);
      ell(c, 16, -23 - st * 0.5, 6, 9, rg(c, 16, -23, 8, col2));
      rrect(c, -8, -47, 17, 13, 4, rg(c, 0, -41, 10, col));
      rrect(c, -4, -43, 11, 4.5, 2, OUT, null);
      ell(c, 0, -40.8, 1.5, 1.5, '#fff3a0', null);
      ell(c, 4.5, -40.8, 1.5, 1.5, '#fff3a0', null);
      A = { hx: 0, hy: -47, bx: 0, by: -36 };
      break;
    }
    default: {
      const fl = Math.sin(t * 10) * 3;
      const hv = Math.sin(t * 5) * 1.2 - 3;
      line(c, [-6, -9 + hv, -15, -13 + hv, -18, -23 + hv], OUT, 4);
      line(c, [-6, -9 + hv, -15, -13 + hv, -18, -23 + hv], col2, 2.2);
      poly(c, [-18, -29 + hv, -21, -22 + hv, -15, -22 + hv], col2);
      poly(c, [-5, -24 + hv, -21, -35 + hv + fl, -17, -24 + hv, -23, -18 + hv + fl * 0.5, -7, -15 + hv], col2);
      ell(c, -4, -3 + hv, 3, 4, col2);
      ell(c, 4, -3 + hv, 3, 4, col2);
      ell(c, 0, -13 + hv, 8.5, 10, rg(c, 0, -13 + hv, 10, col));
      ell(c, 8, -14 + hv, 3, 5, col, OUT, 1.4, -0.6);
      poly(c, [-6, -34 + hv, -9, -43 + hv, -1, -36 + hv], '#f3e6c8');
      poly(c, [5, -36 + hv, 10, -43 + hv, 10, -33 + hv], '#f3e6c8');
      ell(c, 1, -27 + hv, 11, 9.5, rg(c, 1, -27 + hv, 11, col));
      eye(c, 2, -28 + hv);
      eye(c, 9, -28 + hv);
      line(c, [1, -22 + hv, 3.5, -20 + hv, 6, -22 + hv, 8.5, -20 + hv], OUT, 1.2);
      A = { hx: 1, hy: -37 + hv, bx: 0, by: -23 + hv };
    }
  }
  for (const f of sp.feats) drawFeature(c, f, A, t, col2);
  c.restore();
}

function drawFeature(c: C, f: Feature, A: Anchors, t: number, col2: string) {
  const { hx, hy, bx, by } = A;
  switch (f) {
    case 'leaf':
      ell(c, hx - 5, hy - 3, 6, 3, '#6fc24f', OUT, 1.3, 0.7);
      ell(c, hx + 5, hy - 3, 6, 3, '#8fda5f', OUT, 1.3, -0.7);
      break;
    case 'flower':
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + t * 0.6;
        ell(c, hx + Math.cos(a) * 4.5, hy - 5 + Math.sin(a) * 4.5, 3.2, 3.2, '#ff9ac0', OUT, 1);
      }
      ell(c, hx, hy - 5, 2.6, 2.6, '#ffe05a', OUT, 1);
      break;
    case 'horn':
      poly(c, [hx + 1, hy + 2, hx + 8, hy - 11, hx + 8, hy + 3], '#f3e6c8');
      break;
    case 'flame': {
      const k = 1 + Math.sin(t * 13) * 0.15;
      poly(c, [hx - 5, hy, hx - 3, hy - 9 * k, hx, hy - 5, hx + 2, hy - 15 * k, hx + 6, hy], '#ff7a2f', '#a02f1a', 1.3);
      poly(c, [hx - 2, hy, hx, hy - 7 * k, hx + 3, hy], '#ffe05a', null);
      break;
    }
    case 'ice':
      poly(c, [hx - 7, hy + 1, hx - 5, hy - 9, hx - 2, hy + 1], '#d8f4ff', '#4f8ac0', 1.2);
      poly(c, [hx - 2, hy + 1, hx + 1, hy - 13, hx + 4, hy + 1], '#bfe9ff', '#4f8ac0', 1.2);
      break;
    case 'spikes':
      for (let i = -1; i <= 1; i++) poly(c, [bx + i * 7 - 3, by + 3, bx + i * 7 - 1, by - 6, bx + i * 7 + 3, by + 3], shade(col2, -0.2), OUT, 1.2);
      break;
    case 'crown':
      poly(c, [hx - 7, hy + 1, hx - 8, hy - 8, hx - 4, hy - 4, hx, hy - 10, hx + 4, hy - 4, hx + 8, hy - 8, hx + 7, hy + 1], '#ffd23c', '#8a5a14', 1.3);
      ell(c, hx, hy - 3, 1.6, 1.6, '#e8425a', null);
      break;
    case 'moss':
      ell(c, bx - 6, by + 5, 6, 3, '#6fae4f', null, 0, -0.3);
      ell(c, bx + 5, by + 8, 4.5, 2.4, '#8ac85f', null, 0, 0.2);
      break;
    case 'wings': {
      const fl = Math.sin(t * 8) * 0.35;
      c.save();
      c.translate(bx - 3, by + 6);
      c.rotate(-0.7 + fl);
      ell(c, -9, 0, 12, 5, '#fafaff', OUT, 1.3);
      ell(c, -8, 3, 8, 3, '#dfe6ff', null);
      c.restore();
      break;
    }
  }
}

export interface HumanLook {
  hair: string;
  top: string;
  bottom: string;
  skin: string;
  sword: boolean;
}

/** 사람 캐릭터. 오른쪽을 보는 모습이며 발밑이 원점이다. */
export function drawHuman(c: C, look: HumanLook, t: number, o: DrawOpts) {
  const sw = o.moving ? Math.sin(t * 11) : 0;
  const bob = o.moving ? -Math.abs(Math.cos(t * 11)) * 1.5 : Math.sin(t * 2.5) * 0.5;
  const back = !!o.back;
  rrect(c, -6 + sw * 3, -10, 5.5, 10, 2.5, look.bottom);
  rrect(c, 1 - sw * 3, -10, 5.5, 10, 2.5, look.bottom);
  ell(c, -3 + sw * 3, -0.5, 3.6, 2, '#5a3a2a', OUT, 1.2);
  ell(c, 4 - sw * 3, -0.5, 3.6, 2, '#5a3a2a', OUT, 1.2);
  ell(c, -8, -17 + bob - sw * 2, 3, 4.6, look.top, OUT, 1.4);
  poly(c, [-7, -25 + bob, 7, -25 + bob, 9, -9 + bob, -9, -9 + bob], rg(c, 0, -17 + bob, 12, look.top));
  line(c, [-8.5, -11.5 + bob, 8.5, -11.5 + bob], shade(look.top, -0.45), 2);
  // 무기를 든 팔
  c.save();
  c.translate(8, -20 + bob);
  const swing = o.atk > 0 ? Math.sin(o.atk * Math.PI) * 1.9 - 0.9 : sw * 0.35;
  c.rotate(swing);
  if (look.sword && !back) {
    poly(c, [1, 5, 3, -15, 5, -17, 6, -15, 5, 5], '#e8eef5', '#4a5568', 1.2);
    rrect(c, -1, 4, 9, 2.4, 1, '#c89a3c', OUT);
  }
  ell(c, 1.5, 4, 3, 4.6, look.top, OUT, 1.4);
  ell(c, 2, 8, 2.4, 2.4, look.skin, OUT, 1.2);
  c.restore();
  // 머리
  const hy = -34 + bob;
  ell(c, 0, hy, 10.5, 10, look.skin);
  if (back) {
    ell(c, 0, hy - 0.5, 11, 10.5, rg(c, 0, hy, 11, look.hair));
  } else {
    c.beginPath();
    c.ellipse(0, hy - 1, 11, 10.5, 0, Math.PI * 0.95, Math.PI * 2.12);
    c.quadraticCurveTo(6, hy - 4, 3, hy - 5);
    c.quadraticCurveTo(-2, hy - 1, -10.5, hy + 1);
    c.closePath();
    c.fillStyle = rg(c, 0, hy - 3, 11, look.hair);
    c.fill();
    c.lineWidth = 1.5;
    c.strokeStyle = OUT;
    c.stroke();
    ell(c, 2.5, hy + 2, 1.5, 2.2, '#1b1420', null);
    ell(c, 7.5, hy + 2, 1.4, 2.1, '#1b1420', null);
    ell(c, 3, hy + 1.3, 0.6, 0.7, '#fff', null);
    ell(c, 8, hy + 1.3, 0.6, 0.7, '#fff', null);
    ell(c, 0, hy + 5, 2, 1.1, 'rgba(240,120,120,0.45)', null);
  }
}

// ---------- 배경 오브젝트 스프라이트 ----------

export interface Sprite {
  c: HTMLCanvasElement;
  w: number;
  h: number;
  ax: number;
  ay: number;
}

function makeSprite(w: number, h: number, ax: number, ay: number, draw: (c: C) => void): Sprite {
  const cv = document.createElement('canvas');
  cv.width = w * 2;
  cv.height = h * 2;
  const c = cv.getContext('2d')!;
  c.scale(2, 2);
  c.translate(ax, ay);
  draw(c);
  return { c: cv, w, h, ax, ay };
}

function foliage(c: C, blobs: number[][], col: string) {
  for (const [x, y, r] of blobs) ell(c, x, y, r + 1.6, r + 1.6, shade(col, -0.55), null);
  for (const [x, y, r] of blobs) ell(c, x, y, r, r, rg(c, x, y, r, col), null);
  for (const [x, y, r] of blobs) ell(c, x - r * 0.3, y - r * 0.35, r * 0.35, r * 0.22, 'rgba(255,255,255,0.18)', null, 0, -0.5);
}

function trunk(c: C, w: number, h: number, col: string) {
  const g = c.createLinearGradient(-w, 0, w, 0);
  g.addColorStop(0, shade(col, 0.2));
  g.addColorStop(1, shade(col, -0.35));
  poly(c, [-w, 0, -w * 0.7, -h, w * 0.7, -h, w, 0], g);
}

function buildSprite(type: string, v: number): Sprite {
  switch (type) {
    case 'tree': {
      const col = ['#4fa83c', '#5fb84a', '#3f9a48'][v];
      return makeSprite(84, 112, 42, 102, (c) => {
        drawShadow(c, 24);
        trunk(c, 5, 34, '#8a5a34');
        foliage(c, [[0, -62, 25], [-15, -48, 17], [15, -48, 17], [0, -80, 16]], col);
      });
    }
    case 'pine':
    case 'snowpine': {
      const snow = type === 'snowpine';
      const col = snow ? '#4a8a7a' : ['#2f7a4a', '#3a8a4f', '#2a6f52'][v];
      return makeSprite(72, 120, 36, 110, (c) => {
        drawShadow(c, 20);
        trunk(c, 4, 20, '#6f4a2f');
        for (let i = 0; i < 3; i++) {
          const y = -16 - i * 24;
          const w = 26 - i * 6;
          const g = c.createLinearGradient(-w, 0, w, 0);
          g.addColorStop(0, shade(col, 0.25));
          g.addColorStop(1, shade(col, -0.3));
          poly(c, [-w, y, 0, y - 40, w, y], g, shade(col, -0.6));
          if (snow) poly(c, [-w * 0.55, y - 17, 0, y - 40, w * 0.55, y - 17, w * 0.25, y - 21, 0, y - 16, -w * 0.25, y - 21], '#f4f9ff', null);
        }
      });
    }
    case 'deadtree':
      return makeSprite(70, 90, 35, 82, (c) => {
        drawShadow(c, 14);
        trunk(c, 5, 44, '#7a5f4a');
        line(c, [0, -40, -16, -62, -22, -60], OUT, 5);
        line(c, [0, -40, -16, -62, -22, -60], '#7a5f4a', 3);
        line(c, [0, -34, 15, -56, 13, -70], OUT, 5);
        line(c, [0, -34, 15, -56, 13, -70], '#6a5040', 3);
        line(c, [0, -44, 2, -72], OUT, 4.5);
        line(c, [0, -44, 2, -72], '#7a5f4a', 2.5);
      });
    case 'cactus':
      return makeSprite(60, 80, 30, 72, (c) => {
        drawShadow(c, 13);
        const col = '#5fa85a';
        rrect(c, -18, -40, 9, 18, 4.5, rg(c, -14, -32, 10, col));
        rrect(c, -18, -27, 16, 8, 4, col);
        rrect(c, 9, -50, 9, 20, 4.5, rg(c, 13, -40, 10, col));
        rrect(c, 2, -36, 16, 8, 4, col);
        rrect(c, -7, -62, 14, 62, 7, rg(c, 0, -34, 22, col));
        if (v === 1) ell(c, 0, -63, 4, 3.4, '#ff8ab0', OUT, 1.2);
      });
    case 'rock':
    case 'snowrock': {
      const col = type === 'snowrock' ? '#9fb0c8' : ['#9a9aa6', '#a89a8a', '#8f95a0'][v];
      return makeSprite(64, 54, 32, 44, (c) => {
        drawShadow(c, 22);
        poly(c, [-20, -2, -16, -22, -2, -32, 14, -26, 21, -6, 12, 3, -10, 4], rg(c, 0, -14, 24, col));
        poly(c, [-16, -22, -2, -32, 14, -26, 3, -17], type === 'snowrock' ? '#f4f9ff' : shade(col, 0.35), null);
        line(c, [3, -17, 5, 2], shade(col, -0.35), 1.2);
      });
    }
    case 'bush':
      return makeSprite(60, 50, 30, 42, (c) => {
        drawShadow(c, 18);
        foliage(c, [[-9, -11, 11], [9, -11, 11], [0, -19, 12]], '#5fb04a');
        if (v !== 0) for (const [x, y] of [[-8, -14], [6, -20], [10, -9], [-1, -8]]) ell(c, x, y, 2, 2, v === 1 ? '#e8425a' : '#ffe05a', OUT, 0.8);
      });
    case 'crystal':
      return makeSprite(60, 70, 30, 62, (c) => {
        drawShadow(c, 16);
        const g = c.createLinearGradient(-14, -50, 14, 0);
        g.addColorStop(0, '#f0fbff');
        g.addColorStop(1, '#6fb8e8');
        poly(c, [-14, 0, -18, -22, -11, -34, -5, -20, -4, 0], g, '#3f6fa8');
        poly(c, [4, 0, 6, -24, 13, -32, 18, -18, 14, 0], g, '#3f6fa8');
        poly(c, [-7, 2, -9, -34, 0, -52, 8, -32, 7, 2], g, '#3f6fa8');
        line(c, [0, -52, 0, 0], 'rgba(255,255,255,0.7)', 1);
      });
    case 'fountain':
      return makeSprite(100, 96, 50, 72, (c) => {
        ell(c, 0, 0, 40, 20, '#8f95a6');
        ell(c, 0, -6, 40, 20, rg(c, 0, -6, 40, '#c8ccd8'));
        ell(c, 0, -7, 32, 15, '#5fb8e8', '#3f7fa8', 1.4);
        ell(c, -8, -10, 12, 4, 'rgba(255,255,255,0.4)', null);
        rrect(c, -5, -34, 10, 28, 3, rg(c, 0, -20, 12, '#c8ccd8'));
        ell(c, 0, -36, 13, 6, rg(c, 0, -36, 13, '#d8dce8'));
        ell(c, 0, -37, 9, 3.6, '#7fd0f5', '#3f7fa8', 1.2);
        line(c, [0, -37, 0, -52], 'rgba(200,240,255,0.9)', 2.5);
        line(c, [0, -50, -7, -44, -9, -34], 'rgba(200,240,255,0.7)', 1.6);
        line(c, [0, -50, 7, -44, 9, -34], 'rgba(200,240,255,0.7)', 1.6);
      });
    default: {
      // house: 3x3 타일. 앞쪽 꼭짓점이 (0, 48)이고 원점은 바닥 중심이다.
      const roof = ['#d8523f', '#3f7fd0', '#4fa85a'][v];
      const wall = '#f3e6c8';
      const H = 54;
      return makeSprite(232, 232, 116, 146, (c) => {
        const L = [-96, 0];
        const F = [0, 48];
        const R = [96, 0];
        poly(c, [L[0], L[1], F[0], F[1], F[0], F[1] - H, L[0], L[1] - H], shade(wall, -0.18));
        poly(c, [F[0], F[1], R[0], R[1], R[0], R[1] - H, F[0], F[1] - H], wall);
        // 나무 기둥
        line(c, [F[0], F[1], F[0], F[1] - H], '#7a5234', 4);
        line(c, [L[0] + 2, L[1], L[0] + 2, L[1] - H], '#7a5234', 4);
        line(c, [R[0] - 2, R[1], R[0] - 2, R[1] - H], '#7a5234', 4);
        // 문 (오른쪽 벽)
        poly(c, [38, 29, 58, 19, 58, -15, 38, -5], '#8a5a34');
        ell(c, 53, 4, 1.6, 1.6, '#ffd23c', null);
        // 창문 (왼쪽 벽)
        poly(c, [-62, -4, -40, 7, -40, -17, -62, -28], '#8fd0f0', '#7a5234', 2.2);
        line(c, [-51, 1.5, -51, -22.5], '#7a5234', 1.6);
        // 지붕
        const ov = 12;
        const ax = 0;
        const ay = -H - 62;
        const rl = [L[0] - ov, L[1] - H + 2];
        const rf = [F[0], F[1] - H + ov / 2 + 2];
        const rr = [R[0] + ov, R[1] - H + 2];
        poly(c, [rl[0], rl[1], rf[0], rf[1], ax, ay], shade(roof, -0.22));
        poly(c, [rf[0], rf[1], rr[0], rr[1], ax, ay], roof);
        for (let i = 1; i < 4; i++) {
          const k = i / 4;
          line(c, [rf[0] + (ax - rf[0]) * k, rf[1] + (ay - rf[1]) * k, rr[0] + (ax - rr[0]) * k, rr[1] + (ay - rr[1]) * k], shade(roof, -0.3), 1.2);
          line(c, [rf[0] + (ax - rf[0]) * k, rf[1] + (ay - rf[1]) * k, rl[0] + (ax - rl[0]) * k, rl[1] + (ay - rl[1]) * k], shade(roof, -0.45), 1.2);
        }
        ell(c, ax, ay, 3.5, 3.5, '#ffd23c');
      });
    }
  }
}

const sprites = new Map<string, Sprite>();
export function getSprite(type: string, v: number): Sprite {
  const key = type + v;
  let s = sprites.get(key);
  if (!s) {
    s = buildSprite(type, v);
    sprites.set(key, s);
  }
  return s;
}

const icons = new Map<string, string>();
/** UI용 몬스터 아이콘 (data URL) */
export function speciesIcon(id: string): string {
  let url = icons.get(id) || speciesIcon3d(id) || undefined;
  if (!url) {
    const sp = SPECIES[id];
    const cv = document.createElement('canvas');
    cv.width = cv.height = 112;
    const c = cv.getContext('2d')!;
    c.scale(2, 2);
    const k = Math.min(1, 0.95 / sp.size);
    c.translate(26, 50);
    c.scale(k, k);
    drawShadow(c, 15 * sp.size);
    drawMonster(c, sp, 0.4, { moving: false, atk: 0 });
    url = cv.toDataURL();
    icons.set(id, url);
  }
  return url;
}
