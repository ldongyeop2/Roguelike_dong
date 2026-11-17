// 캐릭터, 몬스터, 배경 오브젝트의 3D 모델. 모든 모델은 +X를 바라보고 Y가 위쪽이다.
import * as THREE from 'three';
import type { ModelDef } from './bake';
import type { Feature, Species } from './data';
import { shade } from './util';

type V3 = [number, number, number];
type Anim = (anim: number, t: number) => void;
interface MatOpts {
  flat?: boolean;
  shiny?: number;
  glow?: number;
  map?: THREE.Texture;
}

const TAU = Math.PI * 2;
const DARK = '#1b1420';

const mats = new Map<string, THREE.MeshPhongMaterial>();
function mat(color: string, o: MatOpts = {}): THREE.MeshPhongMaterial {
  if (o.map) {
    return new THREE.MeshPhongMaterial({ color: '#ffffff', map: o.map, flatShading: !!o.flat, shininess: 10, specular: '#111111' });
  }
  const key = `${color}|${o.flat ? 1 : 0}|${o.shiny ?? 25}|${o.glow ?? 0}`;
  let m = mats.get(key);
  if (!m) {
    m = new THREE.MeshPhongMaterial({
      color, flatShading: !!o.flat, shininess: o.shiny ?? 25, specular: (o.shiny ?? 25) > 50 ? '#666666' : '#222222',
      emissive: o.glow ? color : '#000000', emissiveIntensity: o.glow ?? 0,
    });
    mats.set(key, m);
  }
  return m;
}

function put<T extends THREE.Object3D>(o: T, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): T {
  o.position.set(x, y, z);
  o.rotation.set(rx, ry, rz);
  return o;
}
function pivot(x: number, y: number, z: number, ...kids: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (kids.length) g.add(...kids);
  return g;
}
function ball(r: number, color: string, sx = 1, sy = 1, sz = 1, o?: MatOpts): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 22, 16), mat(color, o));
  m.scale.set(sx, sy, sz);
  return m;
}
const cap = (r: number, len: number, color: string, o?: MatOpts) => new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 12), mat(color, o));
const cone = (r: number, h: number, color: string, seg = 12, o?: MatOpts) => new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat(color, o));
const box = (w: number, h: number, d: number, color: string, o?: MatOpts) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, o));
const cyl = (rt: number, rb: number, h: number, color: string, seg = 14, o?: MatOpts) =>
  new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color, o));

/** 표면이 울퉁불퉁한 구 (나뭇잎 덩어리 등) */
function lumpy(r: number, amt: number, seed: number, color: string, o?: MatOpts): THREE.Mesh {
  const g = new THREE.SphereGeometry(r, 20, 14);
  const p = g.attributes.position;
  const f = 2.9 / r;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const n = Math.sin(x * f + seed) * Math.sin(y * f * 1.1 + seed * 1.7) + Math.sin(z * f * 0.9 + seed * 0.6) * 0.6;
    const k = 1 + amt * n;
    p.setXYZ(i, x * k, y * k, z * k);
  }
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat(color, o));
}

/** 각진 바위 */
function crag(r: number, seed: number, color: string): THREE.Mesh {
  const g = new THREE.IcosahedronGeometry(r, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const h = Math.sin(x * 37.1 + y * 17.3 + z * 29.7 + seed * 5.3) * 43758.5453;
    const k = 0.82 + (h - Math.floor(h)) * 0.36;
    p.setXYZ(i, x * k, y * k, z * k);
  }
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat(color, { flat: true }));
}

function eyes(parent: THREE.Object3D, x: number, y: number, z: number, r = 0.04) {
  for (const s of [-1, 1]) {
    parent.add(put(ball(r, DARK, 0.55, 1.25, 0.9, { shiny: 90 }), x, y, z * s));
    parent.add(put(ball(r * 0.3, '#ffffff'), x + r * 0.45, y + r * 0.45, z * s - r * 0.2));
  }
}
function bigEyes(parent: THREE.Object3D, x: number, y: number, z: number, r = 0.07) {
  for (const s of [-1, 1]) {
    parent.add(put(ball(r, '#ffffff', 0.7, 1.1, 1, { shiny: 90 }), x, y, z * s));
    parent.add(put(ball(r * 0.55, DARK, 0.6, 1.1, 1, { shiny: 90 }), x + r * 0.45, y, z * s));
  }
}

const lunge = (t: number) => Math.sin(Math.PI * (t + 1 / 6));

// ---------- 사람 ----------

export interface HumanLook {
  hair: string;
  top: string;
  bottom: string;
  skin: string;
  sword: boolean;
  hat?: 'wizard' | 'nurse' | 'pack';
}

export function human(L: HumanLook): ModelDef {
  const root = new THREE.Group();
  const g = new THREE.Group();
  g.scale.setScalar(1.25);
  root.add(g);
  const boot = '#5a3a2a';
  const mkLeg = (z: number) =>
    pivot(0, 0.36, z, put(cap(0.065, 0.15, L.bottom), 0, -0.14, 0), put(ball(0.08, boot, 1.35, 0.75, 1), 0.03, -0.3, 0));
  const legL = mkLeg(-0.085);
  const legR = mkLeg(0.085);
  const body = new THREE.Group();
  body.add(put(cyl(0.125, 0.2, 0.3, L.top), 0, 0.46, 0));
  body.add(put(ball(0.155, L.top, 0.95, 1, 1.08), 0, 0.6, 0));
  body.add(put(cyl(0.178, 0.19, 0.05, shade(L.top, -0.5)), 0, 0.42, 0));
  body.add(put(ball(0.03, '#ffd23c', 1, 1, 1, { shiny: 100 }), 0.18, 0.42, 0));
  const mkArm = (z: number) =>
    pivot(0, 0.65, z, put(cap(0.05, 0.13, L.top), 0, -0.11, 0), put(ball(0.057, L.skin), 0, -0.24, 0));
  const armL = mkArm(-0.2);
  const armR = mkArm(0.2);
  if (L.sword) {
    const sw = pivot(0, -0.24, 0,
      put(box(0.03, 0.5, 0.085, '#e4ebf5', { shiny: 120 }), 0, 0.33, 0),
      put(box(0.05, 0.045, 0.22, '#c89a3c', { shiny: 80 }), 0, 0.07, 0),
      put(cyl(0.022, 0.022, 0.1, '#5a3a2a'), 0, 0, 0));
    sw.rotation.z = -1.25;
    armR.add(sw);
  }
  const head = pivot(0, 0.78, 0);
  head.add(put(ball(0.25, L.skin), 0, 0.2, 0));
  head.add(put(ball(0.268, L.hair, 1, 1, 1.02), -0.045, 0.24, 0));
  head.add(put(ball(0.11, L.hair, 0.9, 0.55, 1.5), 0.17, 0.37, 0));
  head.add(put(cone(0.09, 0.2, L.hair), -0.2, 0.42, 0, 0, 0, 0.9));
  eyes(head, 0.232, 0.185, 0.092, 0.04);
  if (L.hat === 'wizard') {
    head.add(put(cyl(0.36, 0.36, 0.03, L.top), -0.02, 0.4, 0));
    head.add(put(cone(0.2, 0.46, L.top), -0.04, 0.63, 0, 0, 0, 0.18));
    head.add(put(ball(0.045, '#ffd23c', 1, 1, 1, { glow: 0.5 }), -0.1, 0.87, 0));
  } else if (L.hat === 'nurse') {
    head.add(put(box(0.16, 0.1, 0.26, '#ffffff'), 0.06, 0.47, 0));
    head.add(put(box(0.02, 0.06, 0.025, '#e8425a'), 0.145, 0.47, 0));
    head.add(put(box(0.02, 0.025, 0.07, '#e8425a'), 0.145, 0.47, 0));
  } else if (L.hat === 'pack') {
    body.add(put(box(0.16, 0.26, 0.28, '#8a5a34'), -0.2, 0.58, 0));
    body.add(put(cyl(0.07, 0.07, 0.3, '#d8c8a0'), -0.2, 0.75, 0, Math.PI / 2));
  }
  body.add(armL, armR, head);
  g.add(legL, legR, body);

  const pose: Anim = (anim, t) => {
    const s = Math.sin(TAU * t);
    body.position.set(0, 0, 0);
    body.rotation.z = 0;
    legL.rotation.z = legR.rotation.z = 0;
    armL.rotation.z = 0.08;
    armR.rotation.z = L.sword ? 0.3 : 0.08;
    head.rotation.z = 0;
    if (anim === 0) {
      body.position.y = s * 0.007;
      armL.rotation.z += s * 0.05;
      armR.rotation.z -= s * 0.05;
    } else if (anim === 1) {
      legL.rotation.z = s * 0.75;
      legR.rotation.z = -s * 0.75;
      armL.rotation.z = -s * 0.6;
      armR.rotation.z = (L.sword ? 0.3 : 0) + s * 0.45;
      body.position.y = Math.abs(Math.cos(TAU * t)) * 0.022;
      body.rotation.z = -0.06;
    } else {
      const k = Math.round(t * 3);
      armR.rotation.z = [2.7, 1.5, 0.5][k];
      body.rotation.z = [0.1, -0.18, -0.1][k];
      body.position.x = [-0.02, 0.06, 0.03][k];
      legL.rotation.z = -0.3;
      legR.rotation.z = 0.35;
      armL.rotation.z = -0.4;
    }
  };
  return { root, pose };
}

// ---------- 몬스터 ----------

interface Rig {
  g: THREE.Group;
  pose: Anim;
  head: THREE.Object3D;
  ht: V3;
  back: THREE.Object3D;
  bt: V3;
}

function blob(col: string): Rig {
  const g = new THREE.Group();
  const rig = new THREE.Group();
  g.add(rig);
  rig.add(put(ball(0.3, col, 1, 0.86, 1, { shiny: 110 }), 0, 0.258, 0));
  rig.add(put(ball(0.07, '#ffffff', 1.4, 0.7, 1, { glow: 0.3 }), 0.02, 0.44, -0.14));
  bigEyes(rig, 0.25, 0.3, 0.1, 0.075);
  rig.add(put(ball(0.03, DARK, 0.5, 0.5, 1.6), 0.285, 0.2, 0));
  const pose: Anim = (anim, t) => {
    rig.position.set(0, 0, 0);
    rig.scale.set(1, 1, 1);
    if (anim === 0) {
      const q = Math.sin(TAU * t) * 0.05;
      rig.scale.set(1 + q, 1 - q, 1 + q);
    } else if (anim === 1) {
      const hop = Math.sin(Math.PI * t);
      rig.position.y = hop * 0.2;
      const q = (hop - 0.4) * 0.22;
      rig.scale.set(1 - q * 0.5, 1 + q, 1 - q * 0.5);
    } else {
      const k = lunge(t);
      rig.position.x = k * 0.22;
      rig.scale.set(1 + k * 0.2, 1 - k * 0.12, 1);
    }
  };
  return { g, pose, head: rig, ht: [0, 0.5, 0], back: rig, bt: [-0.06, 0.49, 0] };
}

function beast(col: string, col2: string): Rig {
  const g = new THREE.Group();
  const rig = new THREE.Group();
  g.add(rig);
  const light = shade(col, 0.45);
  rig.add(put(ball(0.3, col, 1.15, 0.76, 0.8), 0, 0.38, 0));
  rig.add(put(ball(0.22, light, 1.15, 0.6, 0.78), 0.02, 0.3, 0));
  const legs = [[0.2, 0.13], [-0.2, -0.13], [0.2, -0.13], [-0.2, 0.13]].map(([x, z]) =>
    pivot(x, 0.3, z, put(cap(0.058, 0.13, col2), 0, -0.13, 0), put(ball(0.07, shade(col2, -0.25), 1.25, 0.65, 1), 0.02, -0.255, 0)));
  rig.add(...legs);
  const tail = pivot(-0.32, 0.46, 0, put(ball(0.1, col2, 1.7, 0.8, 0.8), -0.13, 0.06, 0, 0, 0, -0.5));
  rig.add(tail);
  const head = pivot(0.3, 0.5, 0);
  head.add(put(ball(0.21, col), 0.06, 0.08, 0));
  head.add(put(ball(0.1, light, 1.15, 0.8, 1), 0.24, 0.02, 0));
  head.add(put(ball(0.035, DARK, 1, 1, 1, { shiny: 100 }), 0.345, 0.05, 0));
  head.add(put(cone(0.075, 0.22, col2), 0.02, 0.3, 0.115, 0.3, 0, 0.1));
  head.add(put(cone(0.075, 0.22, col2), 0.02, 0.3, -0.115, -0.3, 0, 0.1));
  eyes(head, 0.225, 0.13, 0.1, 0.038);
  rig.add(head);
  const pose: Anim = (anim, t) => {
    const s = Math.sin(TAU * t);
    rig.position.set(0, 0, 0);
    rig.rotation.z = 0;
    head.rotation.z = 0;
    tail.rotation.y = s * 0.35;
    for (const l of legs) l.rotation.z = 0;
    if (anim === 0) {
      rig.position.y = s * 0.006;
      head.rotation.z = s * 0.04;
    } else if (anim === 1) {
      legs[0].rotation.z = legs[1].rotation.z = s * 0.65;
      legs[2].rotation.z = legs[3].rotation.z = -s * 0.65;
      rig.position.y = Math.abs(Math.cos(TAU * t)) * 0.025;
    } else {
      const k = lunge(t);
      rig.position.x = k * 0.24;
      rig.position.y = k * 0.05;
      head.rotation.z = -k * 0.35;
      legs[0].rotation.z = legs[2].rotation.z = k * 0.6;
      legs[1].rotation.z = legs[3].rotation.z = -k * 0.5;
    }
  };
  return { g, pose, head, ht: [0.06, 0.3, 0], back: rig, bt: [-0.05, 0.6, 0] };
}

function bird(col: string, col2: string): Rig {
  const g = new THREE.Group();
  const rig = new THREE.Group();
  g.add(rig);
  rig.add(put(ball(0.2, col, 1.05, 1.1, 0.95), 0, 0.62, 0));
  rig.add(put(ball(0.15, shade(col, 0.5), 1, 1.1, 0.95), 0.06, 0.57, 0));
  rig.add(put(ball(0.1, col2, 1.7, 0.25, 0.95), -0.25, 0.56, 0, 0, 0, 0.35));
  for (const s of [-1, 1]) rig.add(put(cone(0.025, 0.1, '#f59a2f', 6), 0.02, 0.37, 0.06 * s, 0, 0, Math.PI));
  const wings = [-1, 1].map((s) => pivot(-0.02, 0.69, 0.16 * s, put(ball(0.2, col2, 0.78, 0.13, 1.15), -0.05, 0, 0.2 * s)));
  rig.add(...wings);
  const head = pivot(0.1, 0.82, 0);
  head.add(put(ball(0.155, col), 0.04, 0.05, 0));
  head.add(put(cone(0.055, 0.17, '#f59a2f'), 0.24, 0.035, 0, 0, 0, -Math.PI / 2));
  head.add(put(cone(0.04, 0.15, col2), -0.03, 0.22, 0, 0, 0, 0.5));
  eyes(head, 0.155, 0.09, 0.085, 0.035);
  rig.add(head);
  const pose: Anim = (anim, t) => {
    rig.position.set(0, 0, 0);
    head.rotation.z = 0;
    let f = 0.1 + Math.sin(TAU * t) * 0.55;
    if (anim === 0) rig.position.y = Math.sin(TAU * t) * 0.02;
    else if (anim === 1) {
      f = Math.sin(TAU * 2 * t) * 0.85;
      rig.position.y = Math.sin(TAU * t) * 0.03;
    } else {
      const k = lunge(t);
      rig.position.x = k * 0.26;
      rig.position.y = -k * 0.08;
      head.rotation.z = -k * 0.4;
      f = 0.9 - k * 1.2;
    }
    wings[0].rotation.x = f;
    wings[1].rotation.x = -f;
  };
  return { g, pose, head, ht: [0.04, 0.2, 0], back: rig, bt: [-0.05, 0.84, 0] };
}

function bug(col: string, col2: string): Rig {
  const g = new THREE.Group();
  const rig = new THREE.Group();
  g.add(rig);
  const dark = shade(col2, -0.3);
  rig.add(put(ball(0.27, dark, 1.1, 0.42, 0.86), 0, 0.15, 0));
  rig.add(put(ball(0.3, col, 1.15, 0.68, 0.92, { shiny: 110 }), 0, 0.25, 0));
  rig.add(put(box(0.62, 0.02, 0.015, shade(col, -0.45)), 0, 0.452, 0));
  for (const [x, y, z] of [[-0.12, 0.41, 0.1], [0.1, 0.42, -0.09], [0.02, 0.38, 0.17], [-0.2, 0.36, -0.13], [0.2, 0.37, 0.1]]) {
    rig.add(put(ball(0.05, col2, 1, 0.45, 1), x, y, z));
  }
  const legs: THREE.Group[] = [];
  for (const x of [-0.16, 0, 0.16]) {
    for (const s of [-1, 1]) legs.push(pivot(x, 0.17, 0.2 * s, put(cap(0.024, 0.16, DARK), 0, -0.07, 0.07 * s, 0.75 * s)));
  }
  rig.add(...legs);
  const head = pivot(0.32, 0.2, 0);
  head.add(put(ball(0.13, col2), 0.05, 0, 0));
  eyes(head, 0.14, 0.04, 0.07, 0.032);
  for (const s of [-1, 1]) {
    head.add(put(cyl(0.011, 0.011, 0.2, DARK, 6), 0.13, 0.17, 0.05 * s, 0.25 * s, 0, -0.55));
    head.add(put(ball(0.025, DARK), 0.185, 0.255, 0.075 * s));
  }
  rig.add(head);
  const pose: Anim = (anim, t) => {
    rig.position.set(0, 0, 0);
    rig.rotation.z = 0;
    legs.forEach((l, i) => (l.rotation.y = anim === 1 ? Math.sin(TAU * t + i * 2.1) * 0.55 : 0));
    if (anim === 0) rig.position.y = Math.sin(TAU * t) * 0.006;
    else if (anim === 1) rig.rotation.z = Math.sin(TAU * 2 * t) * 0.03;
    else {
      const k = lunge(t);
      rig.position.x = k * 0.24;
      rig.rotation.z = -k * 0.12;
    }
  };
  return { g, pose, head, ht: [0.05, 0.13, 0], back: rig, bt: [-0.02, 0.45, 0] };
}

function plant(col: string, col2: string): Rig {
  const g = new THREE.Group();
  const rig = new THREE.Group();
  g.add(rig);
  for (const [x, z] of [[0.12, 0.12], [-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12]]) rig.add(put(ball(0.1, col2, 1.1, 0.5, 1.1), x, 0.045, z));
  rig.add(put(ball(0.25, col, 1, 1.05, 1), 0, 0.29, 0));
  bigEyes(rig, 0.2, 0.33, 0.095, 0.06);
  rig.add(put(ball(0.028, DARK, 0.5, 0.5, 1.5), 0.243, 0.24, 0));
  for (const s of [-1, 1]) rig.add(put(ball(0.16, col2, 0.55, 0.14, 1.15), 0, 0.28, 0.33 * s, -0.55 * s));
  const stem = pivot(0, 0.52, 0, put(cyl(0.028, 0.04, 0.26, col2, 8), 0, 0.12, 0));
  const top = pivot(0, 0.25, 0);
  top.add(put(ball(0.13, col2, 1.25, 0.16, 0.65), 0.11, 0.03, 0, 0, 0, 0.5));
  top.add(put(ball(0.13, col2, 1.25, 0.16, 0.65), -0.11, 0.03, 0, 0, 0, -0.5));
  stem.add(top);
  rig.add(stem);
  const pose: Anim = (anim, t) => {
    const s = Math.sin(TAU * t);
    rig.position.set(0, 0, 0);
    rig.scale.set(1, 1, 1);
    rig.rotation.z = 0;
    stem.rotation.z = s * 0.15;
    if (anim === 0) rig.rotation.z = s * 0.04;
    else if (anim === 1) {
      const hop = Math.sin(Math.PI * t);
      rig.position.y = hop * 0.14;
      rig.scale.y = 1 + (hop - 0.4) * 0.12;
    } else {
      const k = lunge(t);
      rig.position.x = k * 0.12;
      rig.rotation.z = -k * 0.2;
      stem.rotation.z = -k * 1.1;
    }
  };
  return { g, pose, head: top, ht: [0, 0.05, 0], back: rig, bt: [-0.1, 0.5, 0] };
}

function golem(col: string, col2: string): Rig {
  const g = new THREE.Group();
  const rig = new THREE.Group();
  g.add(rig);
  const F = { flat: true };
  const torso = new THREE.Group();
  torso.add(put(box(0.42, 0.4, 0.4, col, F), 0, 0.6, 0));
  torso.add(put(box(0.34, 0.2, 0.3, shade(col, 0.3), F), 0.07, 0.64, 0));
  torso.add(put(box(0.3, 0.14, 0.3, col2, F), 0, 0.36, 0));
  const legs = [-1, 1].map((s) => pivot(0, 0.32, 0.115 * s, put(box(0.15, 0.26, 0.16, col2, F), 0, -0.14, 0), put(box(0.21, 0.08, 0.19, shade(col2, -0.25), F), 0.02, -0.28, 0)));
  const arms = [-1, 1].map((s) => pivot(0, 0.74, 0.31 * s,
    put(crag(0.13, 3 + s, col2), 0, 0, 0), put(box(0.13, 0.28, 0.14, col2, F), 0, -0.2, 0), put(crag(0.12, 7 + s, col), 0, -0.4, 0)));
  const head = pivot(0, 0.8, 0);
  head.add(put(box(0.27, 0.21, 0.27, col, F), 0.01, 0.105, 0));
  head.add(put(box(0.03, 0.075, 0.21, DARK), 0.14, 0.11, 0));
  for (const s of [-1, 1]) head.add(put(box(0.02, 0.04, 0.05, '#fff3a0', { glow: 1 }), 0.155, 0.11, 0.055 * s));
  torso.add(...arms, head);
  rig.add(...legs, torso);
  const pose: Anim = (anim, t) => {
    const s = Math.sin(TAU * t);
    rig.position.set(0, 0, 0);
    torso.rotation.z = 0;
    torso.position.y = 0;
    legs[0].rotation.z = legs[1].rotation.z = 0;
    arms[0].rotation.z = arms[1].rotation.z = 0.1;
    if (anim === 0) torso.position.y = s * 0.008;
    else if (anim === 1) {
      legs[0].rotation.z = s * 0.55;
      legs[1].rotation.z = -s * 0.55;
      arms[0].rotation.z = -s * 0.45;
      arms[1].rotation.z = s * 0.45;
      torso.position.y = Math.abs(Math.cos(TAU * t)) * 0.02;
    } else {
      const k = Math.round(t * 3);
      arms[0].rotation.z = arms[1].rotation.z = [2.7, 1.4, 0.5][k];
      torso.rotation.z = [0.12, -0.22, -0.12][k];
      rig.position.x = [0, 0.1, 0.05][k];
    }
  };
  return { g, pose, head, ht: [0.01, 0.21, 0], back: torso, bt: [-0.14, 0.8, 0] };
}

function imp(col: string, col2: string): Rig {
  const g = new THREE.Group();
  const rig = new THREE.Group();
  g.add(rig);
  for (const s of [-1, 1]) rig.add(put(cap(0.04, 0.08, col2), 0, 0.16, 0.065 * s));
  rig.add(put(ball(0.16, col, 0.95, 1.15, 0.9), 0, 0.37, 0));
  rig.add(put(cyl(0.018, 0.026, 0.28, col2, 6), -0.2, 0.3, 0, 0, 0, 1.05));
  rig.add(put(cone(0.055, 0.11, col2, 6), -0.34, 0.4, 0, 0, 0, 0.6));
  const arms = [-1, 1].map((s) => pivot(0, 0.45, 0.16 * s, put(cap(0.034, 0.11, col), 0, -0.085, 0), put(ball(0.04, col2), 0, -0.17, 0)));
  const wings = [-1, 1].map((s) => pivot(-0.1, 0.47, 0.07 * s, put(ball(0.18, col2, 0.95, 0.8, 0.07), -0.07, 0.1, 0.17 * s, 0, -0.5 * s, 0)));
  const head = pivot(0, 0.52, 0);
  head.add(put(ball(0.21, col, 1, 0.92, 1), 0.02, 0.16, 0));
  for (const s of [-1, 1]) head.add(put(cone(0.045, 0.17, '#f3e6c8', 8), 0.02, 0.36, 0.125 * s, 0.4 * s));
  bigEyes(head, 0.19, 0.18, 0.09, 0.055);
  head.add(put(ball(0.035, DARK, 0.4, 0.5, 2.2), 0.215, 0.07, 0));
  rig.add(...arms, ...wings, head);
  const pose: Anim = (anim, t) => {
    const s = Math.sin(TAU * t);
    rig.position.set(0, 0.07 + s * 0.02, 0);
    rig.rotation.z = 0;
    arms[0].rotation.z = arms[1].rotation.z = 0.2;
    let f = 0.2 + Math.sin(TAU * (anim === 1 ? 2 : 1) * t) * 0.45;
    if (anim === 1) rig.rotation.z = -0.12;
    else if (anim === 2) {
      const k = Math.round(t * 3);
      arms[1].rotation.z = [2.6, 1.4, 0.6][k];
      rig.position.x = [0, 0.1, 0.05][k];
      rig.rotation.z = [0.1, -0.2, -0.1][k];
      f = 0.6;
    }
    wings[0].rotation.y = f;
    wings[1].rotation.y = -f;
  };
  return { g, pose, head, ht: [0.02, 0.35, 0], back: rig, bt: [-0.1, 0.56, 0] };
}

function addFeature(f: Feature, r: Rig, col2: string): Anim | null {
  const [hx, hy, hz] = r.ht;
  const [bx, by, bz] = r.bt;
  switch (f) {
    case 'leaf':
      for (const s of [-1, 1]) r.head.add(put(ball(0.1, s < 0 ? '#6fc24f' : '#8fda5f', 1.3, 0.16, 0.6), hx, hy + 0.05, hz + 0.08 * s, 0, Math.PI / 2, 0.55 * s));
      return null;
    case 'flower':
      r.head.add(put(ball(0.05, '#ffe05a'), hx, hy + 0.07, hz));
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        r.head.add(put(ball(0.06, '#ff9ac0', 1, 0.5, 1), hx + Math.cos(a) * 0.085, hy + 0.05, hz + Math.sin(a) * 0.085));
      }
      return null;
    case 'horn':
      r.head.add(put(cone(0.05, 0.26, '#f3e6c8', 8), hx + 0.12, hy + 0.04, hz, 0, 0, -0.6));
      return null;
    case 'flame': {
      const fl = pivot(hx - 0.02, hy, hz,
        put(cone(0.1, 0.28, '#ff7a2f', 8, { glow: 0.9 }), 0, 0.14, 0),
        put(cone(0.06, 0.18, '#ffe05a', 8, { glow: 1 }), 0.02, 0.1, 0),
        put(cone(0.05, 0.16, '#ff7a2f', 8, { glow: 0.9 }), -0.07, 0.08, 0.03, 0, 0, 0.4));
      r.head.add(fl);
      return (_a, t) => fl.scale.set(1, 1 + Math.sin(TAU * 2 * t) * 0.18, 1);
    }
    case 'ice': {
      const o = { flat: true, shiny: 120, glow: 0.25 };
      r.head.add(put(cone(0.06, 0.22, '#c8ecff', 5, o), hx - 0.06, hy + 0.08, hz + 0.07, 0.3, 0, 0.3));
      r.head.add(put(cone(0.07, 0.3, '#dff5ff', 5, o), hx + 0.01, hy + 0.11, hz - 0.03, -0.1, 0, -0.1));
      r.head.add(put(cone(0.05, 0.18, '#c8ecff', 5, o), hx - 0.1, hy + 0.05, hz - 0.1, -0.4, 0, 0.5));
      return null;
    }
    case 'spikes':
      for (let i = -1; i <= 1; i++) r.back.add(put(cone(0.05, 0.18, shade(col2, -0.25), 6), bx + i * 0.15, by + 0.03, bz, 0, 0, 0.25));
      return null;
    case 'crown': {
      const gold = { shiny: 120 };
      r.head.add(put(cyl(0.125, 0.11, 0.07, '#ffd23c', 12, gold), hx, hy + 0.035, hz));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        r.head.add(put(cone(0.03, 0.09, '#ffd23c', 6, gold), hx + Math.cos(a) * 0.105, hy + 0.11, hz + Math.sin(a) * 0.105));
      }
      r.head.add(put(ball(0.03, '#e8425a', 1, 1, 1, { shiny: 120, glow: 0.3 }), hx + 0.125, hy + 0.04, hz));
      return null;
    }
    case 'moss':
      r.back.add(put(ball(0.12, '#6fae4f', 1.2, 0.4, 1), bx - 0.08, by - 0.02, bz + 0.07));
      r.back.add(put(ball(0.09, '#8ac85f', 1.2, 0.4, 1), bx + 0.1, by - 0.04, bz - 0.08));
      return null;
    case 'wings': {
      const w = [-1, 1].map((s) => pivot(bx - 0.02, by - 0.1, bz + 0.13 * s,
        put(ball(0.25, '#fafaff', 0.8, 0.1, 1.15), -0.07, 0.04, 0.24 * s), put(ball(0.17, '#dfe6ff', 0.8, 0.1, 1.1), -0.14, 0.02, 0.2 * s)));
      r.back.add(...w);
      return (_a, t) => {
        const fl = -0.35 + Math.sin(TAU * t) * 0.4;
        w[0].rotation.x = -fl;
        w[1].rotation.x = fl;
      };
    }
  }
}

export function monster(sp: Species): ModelDef {
  const { col, col2 } = sp;
  const r =
    sp.kind === 'blob' ? blob(col)
    : sp.kind === 'beast' ? beast(col, col2)
    : sp.kind === 'bird' ? bird(col, col2)
    : sp.kind === 'bug' ? bug(col, col2)
    : sp.kind === 'plant' ? plant(col, col2)
    : sp.kind === 'golem' ? golem(col, col2)
    : imp(col, col2);
  const extra: Anim[] = [];
  for (const f of sp.feats) {
    const a = addFeature(f, r, col2);
    if (a) extra.push(a);
  }
  r.g.scale.setScalar(1.25 * sp.size);
  const root = new THREE.Group();
  root.add(r.g);
  return {
    root,
    pose: (anim, t) => {
      r.pose(anim, t);
      for (const a of extra) a(anim, t);
    },
  };
}

// ---------- 배경 오브젝트 ----------

function stripes(color: string): THREE.Texture {
  const cv = document.createElement('canvas');
  cv.width = 8;
  cv.height = 32;
  const c = cv.getContext('2d')!;
  const gr = c.createLinearGradient(0, 0, 0, 32);
  gr.addColorStop(0, shade(color, -0.28));
  gr.addColorStop(0.2, color);
  gr.addColorStop(1, shade(color, 0.12));
  c.fillStyle = gr;
  c.fillRect(0, 0, 8, 32);
  const tx = new THREE.CanvasTexture(cv);
  tx.colorSpace = THREE.SRGBColorSpace;
  tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
  tx.repeat.set(1, 7);
  return tx;
}

export interface ObjSpec {
  make: () => ModelDef;
  w: number;
  h: number;
  ax: number;
  ay: number;
  shadow: number;
}

export function objectSpec(type: string, v: number): ObjSpec {
  const root = new THREE.Group();
  const add = (...o: THREE.Object3D[]) => root.add(...o);
  const done = (w: number, h: number, ax: number, ay: number, shadow: number): ObjSpec => ({ make: () => ({ root }), w, h, ax, ay, shadow });
  switch (type) {
    case 'tree': {
      const col = ['#4fa83c', '#62b84a', '#3f9a4c'][v];
      const s = v * 2.3 + 1;
      add(put(cyl(0.07, 0.13, 0.95, '#8a5a34', 10), 0, 0.47, 0));
      add(put(lumpy(0.55, 0.11, s, col), 0, 1.5, 0));
      add(put(lumpy(0.38, 0.12, s + 1, shade(col, -0.08)), -0.33, 1.18, 0.22));
      add(put(lumpy(0.38, 0.12, s + 2, shade(col, -0.12)), 0.32, 1.12, -0.18));
      add(put(lumpy(0.35, 0.12, s + 3, col), 0.14, 1.2, 0.38));
      add(put(lumpy(0.35, 0.12, s + 4, shade(col, 0.1)), 0, 1.92, 0));
      return done(104, 136, 52, 116, 26);
    }
    case 'pine':
    case 'snowpine': {
      const snow = type === 'snowpine';
      const col = snow ? '#3f7a6a' : ['#2f7a4a', '#3a8a4f', '#2a6f52'][v];
      add(put(cyl(0.06, 0.1, 0.5, '#6f4a2f', 8), 0, 0.25, 0));
      for (const [r, h, y] of [[0.58, 0.85, 0.8], [0.45, 0.72, 1.25], [0.31, 0.62, 1.68]]) {
        add(put(cone(r, h, col, 11), 0, y, 0));
        if (snow) add(put(cone(r * 0.68, h * 0.64, '#f4f9ff', 11), 0, y + h * 0.18 + 0.012, 0));
      }
      return done(96, 136, 48, 116, 24);
    }
    case 'deadtree': {
      const c = '#7a5f4a';
      add(put(cyl(0.05, 0.12, 1.0, c, 8), 0, 0.5, 0));
      add(put(cyl(0.02, 0.045, 0.55, c, 6), 0.2, 1.05, 0, 0, 0, -0.8));
      add(put(cyl(0.02, 0.045, 0.5, c, 6), -0.14, 0.9, 0.12, 0.35, 0, 0.9));
      add(put(cyl(0.02, 0.04, 0.5, c, 6), 0, 1.2, -0.08, -0.35, 0, 0.1));
      add(put(cyl(0.012, 0.025, 0.3, c, 6), 0.36, 1.32, 0, 0, 0, -0.2));
      return done(84, 104, 42, 88, 14);
    }
    case 'cactus': {
      const c = '#5fa85a';
      add(put(cap(0.13, 0.7, c), 0, 0.5, 0));
      add(put(cap(0.07, 0.14, c), 0.2, 0.52, 0, 0, 0, Math.PI / 2));
      add(put(cap(0.07, 0.22, c), 0.31, 0.68, 0));
      add(put(cap(0.07, 0.14, c), 0, 0.38, -0.2, Math.PI / 2));
      add(put(cap(0.07, 0.18, c), 0, 0.52, -0.31));
      if (v === 1) add(put(ball(0.07, '#ff8ab0', 1, 0.7, 1), 0, 1.0, 0));
      return done(72, 84, 36, 68, 14);
    }
    case 'rock':
    case 'snowrock': {
      const snow = type === 'snowrock';
      const col = snow ? '#9fb0c8' : ['#9a9aa6', '#a89a8a', '#8f95a0'][v];
      const big = put(crag(0.36, v + 1, col), 0, 0.2, 0);
      big.scale.set(1.2, 0.8, 1);
      const small = put(crag(0.17, v + 4, shade(col, -0.1)), 0.34, 0.1, 0.22);
      add(big, small);
      if (snow) {
        const capSnow = put(lumpy(0.3, 0.1, v + 2, '#f4f9ff'), -0.02, 0.4, 0);
        capSnow.scale.set(1.1, 0.35, 0.9);
        add(capSnow);
      }
      return done(84, 60, 42, 44, 24);
    }
    case 'bush': {
      const c = '#5fb04a';
      add(put(lumpy(0.23, 0.12, v + 1, shade(c, -0.08)), -0.16, 0.2, 0.05));
      add(put(lumpy(0.23, 0.12, v + 2, c), 0.16, 0.2, -0.05));
      add(put(lumpy(0.25, 0.12, v + 3, shade(c, 0.08)), 0, 0.34, 0));
      if (v !== 0) {
        const bc = v === 1 ? '#e8425a' : '#ffe05a';
        for (const [x, y, z] of [[0.2, 0.3, 0.12], [0.05, 0.5, 0.18], [-0.1, 0.3, 0.26], [0.3, 0.2, -0.02], [-0.25, 0.28, 0.2], [0.14, 0.14, 0.2]]) {
          add(put(ball(0.04, bc, 1, 1, 1, { shiny: 90 }), x, y, z));
        }
      }
      return done(72, 56, 36, 42, 18);
    }
    case 'crystal': {
      const o = { flat: true, shiny: 130, glow: 0.3 };
      add(put(cone(0.15, 0.95, '#bfe6ff', 6, o), 0, 0.47, 0));
      add(put(cone(0.1, 0.58, '#a8dcff', 6, o), -0.2, 0.28, 0.1, 0, 0, 0.3));
      add(put(cone(0.09, 0.5, '#d0f0ff', 6, o), 0.18, 0.24, -0.06, 0, 0, -0.32));
      add(put(cone(0.07, 0.36, '#bfe6ff', 6, o), 0.06, 0.17, 0.2, 0.4, 0, -0.1));
      return done(72, 80, 36, 64, 16);
    }
    case 'fountain': {
      const st = '#c8ccd8';
      add(put(cyl(0.74, 0.8, 0.26, st, 28), 0, 0.13, 0));
      add(put(cyl(0.63, 0.63, 0.02, '#5fb8e8', 28, { shiny: 130 }), 0, 0.265, 0));
      add(put(cyl(0.09, 0.13, 0.62, st, 12), 0, 0.5, 0));
      add(put(cyl(0.32, 0.12, 0.13, st, 20), 0, 0.86, 0));
      add(put(cyl(0.27, 0.27, 0.02, '#7fd0f5', 20, { shiny: 130 }), 0, 0.93, 0));
      add(put(cone(0.05, 0.34, '#e0f6ff', 8, { glow: 0.6 }), 0, 1.1, 0));
      return done(112, 104, 56, 76, 0);
    }
    default: {
      const roof = ['#d8523f', '#3f7fd0', '#4fa85a'][v];
      const wood = '#7a5234';
      const F = { flat: true };
      add(put(box(2.72, 0.16, 2.72, '#9a9aa6', F), 0, 0.08, 0));
      add(put(box(2.6, 1.25, 2.6, '#f3e6c8', F), 0, 0.7, 0));
      for (const [x, z] of [[1.3, 1.3], [1.3, -1.3], [-1.3, 1.3]]) add(put(box(0.13, 1.3, 0.13, wood, F), x, 0.7, z));
      add(put(box(0.1, 0.1, 2.7, wood, F), 1.3, 1.3, 0), put(box(2.7, 0.1, 0.1, wood, F), 0, 1.3, 1.3));
      add(put(box(0.1, 0.1, 2.7, wood, F), 1.3, 0.2, 0), put(box(2.7, 0.1, 0.1, wood, F), 0, 0.2, 1.3));
      // 문과 창문 (+X 면), 창문 (+Z 면)
      add(put(box(0.06, 0.9, 0.6, '#8a5a34', F), 1.31, 0.6, 0.5), put(box(0.08, 1.0, 0.08, wood, F), 1.31, 0.65, 0.84), put(box(0.08, 1.0, 0.08, wood, F), 1.31, 0.65, 0.16));
      add(put(box(0.08, 0.08, 0.76, wood, F), 1.31, 1.12, 0.5), put(ball(0.035, '#ffd23c', 1, 1, 1, { shiny: 120 }), 1.36, 0.6, 0.7));
      add(put(box(0.05, 0.45, 0.5, '#8fd0f0', { shiny: 130 }), 1.31, 0.82, -0.6), put(box(0.07, 0.07, 0.62, wood, F), 1.31, 0.57, -0.6));
      add(put(box(0.07, 0.45, 0.05, wood, F), 1.32, 0.82, -0.6));
      add(put(box(0.7, 0.5, 0.05, '#8fd0f0', { shiny: 130 }), -0.2, 0.8, 1.31), put(box(0.82, 0.07, 0.07, wood, F), -0.2, 0.53, 1.31));
      add(put(box(0.05, 0.5, 0.07, wood, F), -0.2, 0.8, 1.32), put(box(0.7, 0.05, 0.07, wood, F), -0.2, 0.8, 1.32));
      add(put(new THREE.Mesh(new THREE.ConeGeometry(2.3, 1.3, 4), mat('', { map: stripes(roof), flat: true })), 0, 1.98, 0, 0, Math.PI / 4, 0));
      add(put(box(0.28, 0.6, 0.28, '#b08a78', F), -0.55, 1.95, 0.6), put(box(0.34, 0.08, 0.34, '#8a6a5a', F), -0.55, 2.27, 0.6));
      add(put(ball(0.07, '#ffd23c', 1, 1, 1, { shiny: 120 }), 0, 2.66, 0));
      return done(236, 196, 118, 142, 0);
    }
  }
}
