import {
  ARMORS, PRICES, SPECIES, WEAPONS, ZONES, expNeed, findRecipe, mixChance, mixFee, mixLv, mobExp, statsOf, stoneChance,
  type NpcDef, type SpawnDef, type Species,
} from './data';
import { clamp, dist, rand, randInt, type Pt } from './util';
import { blocked, findPath, freeSpot, getZone, type Zone } from './world';

export interface PetData {
  uid: number;
  sp: string;
  lv: number;
  exp: number;
  hp: number;
  active: boolean;
}
export interface Stone {
  sp: string;
  lv: number;
}

export interface Actor {
  id: number;
  type: 'player' | 'pet' | 'mob' | 'npc';
  name: string;
  x: number;
  y: number;
  path: Pt[];
  spd: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  range: number;
  atkInt: number;
  atkCd: number;
  target: Actor | null;
  face: 1 | -1;
  /** 바라보는 방향 0..7 (타일 좌표 기준 45도 단위, 0이 +x) */
  dir: number;
  back: boolean;
  moving: boolean;
  anim: number;
  atkAnim: number;
  flash: number;
  dead: boolean;
  deadT: number;
  lv: number;
  repath: number;
  think: number;
  sp?: Species;
  homeX: number;
  homeY: number;
  returning: boolean;
  spawn?: SpawnDef;
  pet?: PetData;
  npc?: NpcDef;
}

export interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  t: number;
  big: boolean;
}
export interface Fx {
  type: 'proj' | 'ring' | 'spark';
  x: number;
  y: number;
  tx: number;
  ty: number;
  t: number;
  dur: number;
  color: string;
}

export const MAX_ACTIVE = 3;
export const MAX_PETS = 10;
const SAVE_KEY = 'chimera-tales-save-v1';

export const G = {
  zone: null as unknown as Zone,
  player: null as unknown as Actor,
  actors: [] as Actor[],
  floats: [] as FloatText[],
  fx: [] as Fx[],
  logs: [] as { m: string; c: string }[],
  respawns: [] as { t: number; spawn: SpawnDef }[],
  pets: [] as PetData[],
  inv: { hp: 5, mp: 3, scroll: 1, stones: [] as Stone[] },
  known: [] as string[],
  gold: 100,
  lv: 1,
  exp: 0,
  mp: 30,
  maxMp: 30,
  weapon: 0,
  armor: 0,
  cds: { s1: 0, s2: 0, pot: 0 },
  time: 0,
  combatT: 99,
  saveT: 0,
  nextUid: 1,
  dirty: true,
  uiRequest: '',
  hover: null as Actor | null,
  /** 플레이어가 지나온 자리 (0.25타일 간격). 동료가 이 길을 따라온다. */
  trail: [] as Pt[],
};

let nextId = 1;

export function log(m: string, c = '') {
  G.logs.push({ m, c });
  if (G.logs.length > 200) G.logs.splice(0, 100);
}

function makeActor(type: Actor['type'], name: string, x: number, y: number): Actor {
  return {
    id: nextId++, type, name, x, y, path: [], spd: 3, hp: 1, maxHp: 1, atk: 1, def: 0, range: 1.3, atkInt: 1.3, atkCd: 0,
    target: null, face: 1, dir: 1, back: false, moving: false, anim: Math.random() * 10, atkAnim: 0, flash: 0, dead: false, deadT: 0,
    lv: 1, repath: 0, think: rand(0, 3), homeX: x, homeY: y, returning: false,
  };
}

export function recalcPlayer() {
  const p = G.player;
  p.lv = G.lv;
  p.maxHp = 90 + 22 * (G.lv - 1);
  p.atk = Math.round(9 + 2.6 * (G.lv - 1)) + WEAPONS[G.weapon].atk;
  p.def = Math.round(2 + 1.0 * (G.lv - 1)) + ARMORS[G.armor].def;
  G.maxMp = 30 + 6 * (G.lv - 1);
  p.hp = Math.min(p.hp, p.maxHp);
  G.mp = Math.min(G.mp, G.maxMp);
}

function applyPetStats(a: Actor) {
  const pet = a.pet!;
  const sp = SPECIES[pet.sp];
  const st = statsOf(sp, pet.lv);
  a.sp = sp;
  a.name = sp.name;
  a.lv = pet.lv;
  a.maxHp = st.hp;
  a.atk = st.atk;
  a.def = st.def;
  a.range = sp.range;
  a.spd = 4.6;
}

export function petMaxHp(p: PetData) {
  return statsOf(SPECIES[p.sp], p.lv).hp;
}

export function addPet(sp: string, lv: number): PetData | null {
  if (G.pets.length >= MAX_PETS) return null;
  const pet: PetData = { uid: G.nextUid++, sp, lv, exp: 0, hp: 0, active: false };
  pet.hp = petMaxHp(pet);
  pet.active = G.pets.filter((p) => p.active).length < MAX_ACTIVE;
  G.pets.push(pet);
  syncPets();
  return pet;
}

/** 출전 중인 동료 목록에 맞춰 필드의 동료 액터를 맞춘다. */
export function syncPets() {
  const p = G.player;
  for (const a of G.actors) if (a.type === 'pet' && a.pet) a.pet.hp = a.dead ? 0 : a.hp;
  G.actors = G.actors.filter((a) => a.type !== 'pet' || (a.pet!.active && G.pets.includes(a.pet!)));
  for (const pet of G.pets) {
    if (!pet.active || G.actors.some((a) => a.pet === pet)) continue;
    const a = makeActor('pet', '', p.x, p.y);
    a.pet = pet;
    applyPetStats(a);
    a.hp = clamp(pet.hp, 0, a.maxHp);
    if (a.hp <= 0) {
      a.dead = true;
      a.think = 8;
    }
    const spot = nearFree(p.x, p.y);
    a.x = spot.x;
    a.y = spot.y;
    G.actors.push(a);
  }
  G.dirty = true;
}

function nearFree(x: number, y: number): Pt {
  for (let i = 0; i < 20; i++) {
    const px = x + rand(-1.5, 1.5);
    const py = y + rand(-1.5, 1.5);
    if (!blocked(G.zone, px, py)) return { x: px, y: py };
  }
  return { x, y };
}

function spawnMob(spawn: SpawnDef) {
  const z = G.zone;
  const sp = SPECIES[spawn.sp];
  let pos: Pt | null;
  if (spawn.at) pos = { x: spawn.at[0] + 0.5, y: spawn.at[1] + 0.5 };
  else {
    const avoid: Pt[] = [G.player, ...z.def.portals.map((q) => ({ x: q.x + 0.5, y: q.y + 0.5 }))];
    pos = freeSpot(z, 3 + spawn.band[0] * (z.w - 6), 3 + spawn.band[1] * (z.w - 6), avoid, 7);
  }
  if (!pos) return;
  const lv = randInt(spawn.lv[0], spawn.lv[1]);
  const st = statsOf(sp, lv);
  const a = makeActor('mob', sp.name, pos.x, pos.y);
  a.sp = sp;
  a.lv = lv;
  a.maxHp = a.hp = st.hp;
  a.atk = st.atk;
  a.def = st.def;
  a.spd = sp.spd;
  a.range = sp.range;
  a.atkInt = sp.boss ? 1.5 : 1.4;
  a.spawn = spawn;
  a.face = Math.random() < 0.5 ? 1 : -1;
  a.dir = randInt(0, 7);
  G.actors.push(a);
}

export function enterZone(id: string, x: number, y: number, quiet = false) {
  const p = G.player;
  syncPetHp();
  G.zone = getZone(id);
  G.actors = [p];
  G.respawns = [];
  G.fx = [];
  G.floats = [];
  G.hover = null;
  G.trail = [];
  p.x = x;
  p.y = y;
  p.path = [];
  p.target = null;
  for (const n of G.zone.def.npcs) {
    const a = makeActor('npc', n.name, n.x + 0.5, n.y + 0.5);
    a.npc = n;
    G.actors.push(a);
  }
  for (const s of G.zone.def.spawns) for (let i = 0; i < s.n; i++) spawnMob(s);
  syncPets();
  if (!quiet) log(`[${G.zone.def.name}]에 들어섰습니다.`, 'sys');
  save();
}

function syncPetHp() {
  for (const a of G.actors) if (a.type === 'pet' && a.pet) a.pet.hp = a.dead ? 0 : a.hp;
}

// ---------- 저장 ----------

export function save() {
  if (!G.zone) return;
  syncPetHp();
  const data = {
    lv: G.lv, exp: G.exp, hp: G.player.hp, mp: G.mp, gold: G.gold, weapon: G.weapon, armor: G.armor,
    zone: G.zone.def.id, x: G.player.x, y: G.player.y, pets: G.pets, inv: G.inv, known: G.known, nextUid: G.nextUid,
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // 저장소를 쓸 수 없는 환경에서는 저장 없이 진행한다.
  }
}

export function resetSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // 무시
  }
  location.reload();
}

export function initGame() {
  G.player = makeActor('player', '모험가', 15.5, 18.5);
  G.player.spd = 4.3;
  G.player.atkInt = 0.85;
  let data: any = null;
  try {
    data = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
  } catch {
    data = null;
  }
  if (data && ZONES[data.zone]) {
    G.lv = data.lv;
    G.exp = data.exp;
    G.gold = data.gold;
    G.weapon = data.weapon;
    G.armor = data.armor;
    G.pets = (data.pets as PetData[]).filter((p) => SPECIES[p.sp]);
    G.inv = data.inv;
    G.inv.stones = G.inv.stones.filter((s) => SPECIES[s.sp]);
    G.known = data.known;
    G.nextUid = data.nextUid;
    G.player.hp = data.hp;
    G.mp = data.mp;
    recalcPlayer();
    G.player.hp = clamp(data.hp, 1, G.player.maxHp);
    enterZone(data.zone, data.x, data.y, true);
    log('이어서 모험을 시작합니다.', 'sys');
  } else {
    G.player.hp = 9999;
    G.mp = 9999;
    recalcPlayer();
    G.zone = getZone('town');
    addPet('dewling', 1);
    enterZone('town', 15.5, 18.5, true);
    log('키메라 테일즈에 오신 것을 환영합니다.', 'sys');
    log('미니맵의 파란 점(포탈)으로 나가 몬스터를 사냥하면 혼석을 얻을 수 있습니다.', 'sys');
    log('혼석으로 동료를 얻고, 조합사에게서 두 동료를 조합해 보세요.', 'sys');
  }
}

// ---------- 이동과 전투 ----------

function setFacing(a: Actor, dx: number, dy: number) {
  const sx = dx - dy;
  const sy = dx + dy;
  if (Math.abs(sx) > 0.02) a.face = sx > 0 ? 1 : -1;
  a.back = sy < -0.02;
  a.dir = (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8;
}

function stepPath(a: Actor, dt: number, mul = 1) {
  if (!a.path.length) {
    a.moving = false;
    return;
  }
  let step = a.spd * mul * dt;
  a.moving = true;
  while (step > 0 && a.path.length) {
    const q = a.path[0];
    const dx = q.x - a.x;
    const dy = q.y - a.y;
    const d = Math.hypot(dx, dy);
    if (d > 0.001) setFacing(a, dx, dy);
    if (d <= step) {
      a.x = q.x;
      a.y = q.y;
      a.path.shift();
      step -= d;
    } else {
      a.x += (dx / d) * step;
      a.y += (dy / d) * step;
      step = 0;
    }
  }
}

function reach(a: Actor, t: Actor) {
  return a.range + (t.sp && t.sp.size > 1.5 ? 0.5 : 0);
}

function chase(a: Actor, t: Actor, dt: number, mul = 1) {
  const d = dist(a, t);
  if (d <= reach(a, t)) {
    a.path = [];
    a.moving = false;
    setFacing(a, t.x - a.x, t.y - a.y);
    a.back = false;
    if (a.atkCd <= 0) attack(a, t, 1);
    return;
  }
  a.repath -= dt;
  if (a.repath <= 0 || !a.path.length) {
    a.repath = 0.35;
    a.path = findPath(G.zone, a.x, a.y, t.x, t.y) || [];
  }
  stepPath(a, dt, mul);
}

function attack(a: Actor, t: Actor, mul: number) {
  a.atkCd = a.atkInt;
  a.atkAnim = 0.28;
  const crit = Math.random() < 0.08;
  let dmg = a.atk * rand(0.9, 1.1) * mul - t.def * 0.6;
  if (crit) dmg *= 1.6;
  dmg = Math.max(1, Math.round(dmg));
  if (a.range > 2) {
    G.fx.push({ type: 'proj', x: a.x, y: a.y, tx: t.x, ty: t.y, t: 0, dur: 0.18, color: a.sp ? a.sp.col : '#fff' });
  }
  hurt(t, dmg, a, crit || mul > 1);
}

function hurt(t: Actor, dmg: number, src: Actor, big: boolean) {
  if (t.dead) return;
  t.hp -= dmg;
  t.flash = 0.14;
  const color = t.type === 'mob' ? (big ? '#ffd23c' : '#ffffff') : '#ff5a4a';
  G.floats.push({ x: t.x, y: t.y, text: String(dmg), color, t: 0, big });
  G.fx.push({ type: 'spark', x: t.x, y: t.y, tx: 0, ty: 0, t: 0, dur: 0.2, color: '#fff' });
  if (t.type !== 'mob' || src.type !== 'mob') G.combatT = 0;
  if (t.type === 'mob') {
    if (!t.target || (src.type === 'player' && Math.random() < 0.3)) t.target = src;
    t.returning = false;
  }
  if (t.hp <= 0) kill(t);
}

function kill(t: Actor) {
  t.hp = 0;
  t.dead = true;
  t.deadT = 0;
  t.path = [];
  t.target = null;
  for (const a of G.actors) if (a.target === t) a.target = null;
  if (t.type === 'mob') {
    const sp = t.sp!;
    const xp = mobExp(sp, t.lv);
    const gold = Math.round((4 + t.lv * 3 + rand(0, t.lv * 2)) * (1 + 0.3 * (sp.tier - 1)) * (sp.boss ? 15 : 1));
    G.gold += gold;
    gainExp(xp);
    G.floats.push({ x: t.x, y: t.y - 0.3, text: `+${gold}G`, color: '#ffe27a', t: -0.25, big: false });
    if (Math.random() < stoneChance(sp)) {
      G.inv.stones.push({ sp: sp.id, lv: t.lv });
      log(`${sp.name}의 혼석을 얻었습니다! (혼석 가방 K)`, 'good');
      G.fx.push({ type: 'ring', x: t.x, y: t.y, tx: 0, ty: 0, t: 0, dur: 0.6, color: '#b98aff' });
    }
    const r = Math.random();
    if (r < 0.1) {
      G.inv.hp++;
      log('체력 물약을 주웠습니다.');
    } else if (r < 0.15) {
      G.inv.mp++;
      log('마나 물약을 주웠습니다.');
    }
    if (sp.boss) log(`${sp.name}을(를) 쓰러뜨렸습니다!`, 'good');
    G.respawns.push({ t: sp.boss ? 120 : rand(10, 18), spawn: t.spawn! });
    G.dirty = true;
  } else if (t.type === 'pet') {
    t.think = 20;
    log(`${t.name}이(가) 쓰러졌습니다. 잠시 후 깨어납니다.`, 'bad');
    G.dirty = true;
  } else if (t.type === 'player') {
    const lost = Math.floor(G.gold * 0.05);
    G.gold -= lost;
    log(`쓰러졌습니다. 마을로 돌아갑니다. (${lost}G 분실)`, 'bad');
    t.dead = false;
    healAll();
    enterZone('town', 15.5, 18.5);
  }
}

function gainExp(xp: number) {
  const p = G.player;
  G.exp += xp;
  while (G.exp >= expNeed(G.lv)) {
    G.exp -= expNeed(G.lv);
    G.lv++;
    recalcPlayer();
    p.hp = p.maxHp;
    G.mp = G.maxMp;
    log(`레벨 업! Lv.${G.lv}이 되었습니다.`, 'good');
    G.fx.push({ type: 'ring', x: p.x, y: p.y, tx: 0, ty: 0, t: 0, dur: 0.8, color: '#ffe27a' });
  }
  for (const a of G.actors) {
    if (a.type !== 'pet' || a.dead || !a.pet) continue;
    const pet = a.pet;
    pet.exp += xp;
    while (pet.exp >= expNeed(pet.lv)) {
      pet.exp -= expNeed(pet.lv);
      pet.lv++;
      applyPetStats(a);
      a.hp = a.maxHp;
      log(`${a.name}이(가) Lv.${pet.lv}이 되었습니다.`, 'good');
      G.fx.push({ type: 'ring', x: a.x, y: a.y, tx: 0, ty: 0, t: 0, dur: 0.8, color: '#8affb0' });
    }
  }
}

export function healAll() {
  const p = G.player;
  p.hp = p.maxHp;
  G.mp = G.maxMp;
  for (const a of G.actors) {
    if (a.type === 'pet') {
      a.dead = false;
      a.hp = a.maxHp;
    }
  }
  for (const pet of G.pets) pet.hp = petMaxHp(pet);
  G.dirty = true;
}

// ---------- 플레이어 명령 ----------

export function moveTo(x: number, y: number) {
  const p = G.player;
  p.target = null;
  const path = findPath(G.zone, p.x, p.y, x, y);
  if (path) p.path = path;
}

export function setTarget(a: Actor) {
  const p = G.player;
  if (a.type === 'pet' || a === p) return;
  p.target = a;
  p.repath = 0;
  if (a.type === 'npc') p.path = findPath(G.zone, p.x, p.y, a.x, a.y) || [];
}

export function nearestMob(range: number): Actor | null {
  let best: Actor | null = null;
  let bd = range;
  for (const a of G.actors) {
    if (a.type !== 'mob' || a.dead) continue;
    const d = dist(a, G.player);
    if (d < bd) {
      bd = d;
      best = a;
    }
  }
  return best;
}

export function skillStrike() {
  const p = G.player;
  if (G.cds.s1 > 0) return;
  if (G.mp < 8) return log('마나가 부족합니다.', 'bad');
  const t = p.target && p.target.type === 'mob' ? p.target : nearestMob(6);
  if (!t) return log('대상이 없습니다.', 'bad');
  p.target = t;
  if (dist(p, t) > reach(p, t) + 0.6) return;
  G.mp -= 8;
  G.cds.s1 = 4;
  setFacing(p, t.x - p.x, t.y - p.y);
  attack(p, t, 2.2);
  G.fx.push({ type: 'ring', x: t.x, y: t.y, tx: 0, ty: 0, t: 0, dur: 0.3, color: '#ffb03c' });
}

export function skillSong() {
  const p = G.player;
  if (G.cds.s2 > 0) return;
  if (G.mp < 14) return log('마나가 부족합니다.', 'bad');
  G.mp -= 14;
  G.cds.s2 = 12;
  for (const a of G.actors) {
    if ((a.type !== 'pet' && a !== p) || a.dead) continue;
    const amt = Math.round(a.maxHp * 0.35);
    a.hp = Math.min(a.maxHp, a.hp + amt);
    G.floats.push({ x: a.x, y: a.y, text: `+${amt}`, color: '#7dff9a', t: 0, big: false });
    G.fx.push({ type: 'ring', x: a.x, y: a.y, tx: 0, ty: 0, t: 0, dur: 0.5, color: '#7dff9a' });
  }
}

export function usePotion(kind: 'hp' | 'mp') {
  const p = G.player;
  if (G.cds.pot > 0 || G.inv[kind] <= 0) return;
  if (kind === 'hp') {
    if (p.hp >= p.maxHp) return;
    const amt = Math.round(Math.max(60, p.maxHp * 0.45));
    p.hp = Math.min(p.maxHp, p.hp + amt);
    G.floats.push({ x: p.x, y: p.y, text: `+${amt}`, color: '#7dff9a', t: 0, big: false });
  } else {
    if (G.mp >= G.maxMp) return;
    G.mp = Math.min(G.maxMp, G.mp + Math.round(Math.max(30, G.maxMp * 0.5)));
  }
  G.inv[kind]--;
  G.cds.pot = 1;
  G.dirty = true;
}

export function useScroll() {
  if (G.inv.scroll <= 0 || G.zone.def.id === 'town') return;
  G.inv.scroll--;
  log('귀환 주문서를 사용했습니다.', 'sys');
  enterZone('town', 15.5, 18.5);
}

export function useStone(i: number) {
  const s = G.inv.stones[i];
  if (!s) return;
  if (G.pets.length >= MAX_PETS) return log(`동료는 ${MAX_PETS}마리까지 데리고 있을 수 있습니다.`, 'bad');
  G.inv.stones.splice(i, 1);
  const pet = addPet(s.sp, s.lv)!;
  log(`${SPECIES[s.sp].name} (Lv.${s.lv})이(가) 동료가 되었습니다!${pet.active ? '' : ' (대기 중)'}`, 'good');
}

export function sellStone(i: number) {
  const s = G.inv.stones[i];
  if (!s) return;
  G.inv.stones.splice(i, 1);
  G.gold += stonePrice(s);
  G.dirty = true;
}
export const stonePrice = (s: Stone) => 10 + s.lv * 4 * SPECIES[s.sp].tier;

export function togglePet(uid: number) {
  const pet = G.pets.find((p) => p.uid === uid);
  if (!pet) return;
  if (!pet.active && G.pets.filter((p) => p.active).length >= MAX_ACTIVE) {
    return log(`출전은 ${MAX_ACTIVE}마리까지 가능합니다.`, 'bad');
  }
  syncPetHp();
  pet.active = !pet.active;
  syncPets();
}

export function releasePet(uid: number) {
  const i = G.pets.findIndex((p) => p.uid === uid);
  if (i < 0) return;
  log(`${SPECIES[G.pets[i].sp].name}을(를) 놓아주었습니다.`);
  G.pets.splice(i, 1);
  syncPets();
}

export function buy(what: string) {
  const pay = (price: number) => {
    if (G.gold < price) {
      log('골드가 부족합니다.', 'bad');
      return false;
    }
    G.gold -= price;
    return true;
  };
  if (what === 'hp' || what === 'mp' || what === 'scroll') {
    if (pay(PRICES[what])) G.inv[what]++;
  } else if (what === 'weapon' && G.weapon < WEAPONS.length - 1) {
    if (pay(WEAPONS[G.weapon + 1].price)) {
      G.weapon++;
      log(`${WEAPONS[G.weapon].name}을(를) 장착했습니다.`, 'good');
    }
  } else if (what === 'armor' && G.armor < ARMORS.length - 1) {
    if (pay(ARMORS[G.armor + 1].price)) {
      G.armor++;
      log(`${ARMORS[G.armor].name}을(를) 장착했습니다.`, 'good');
    }
  }
  recalcPlayer();
  G.dirty = true;
}

export interface MixInfo {
  out: Species | null;
  ok: boolean;
  reason: string;
  fee: number;
  chance: number;
  lv: number;
}

export function mixInfo(a: PetData | undefined, b: PetData | undefined): MixInfo {
  const none: MixInfo = { out: null, ok: false, reason: '재료 동료 둘을 선택하세요.', fee: 0, chance: 0, lv: 0 };
  if (!a || !b || a === b) return none;
  const r = findRecipe(a.sp, b.sp);
  if (!r) return { ...none, reason: '이 둘은 조합할 수 없습니다.' };
  const out = SPECIES[r.out];
  const info: MixInfo = {
    out, ok: true, reason: '', fee: mixFee(out), chance: mixChance(out),
    lv: Math.max(1, Math.floor(((a.lv + b.lv) / 2) * 0.6)),
  };
  for (const p of [a, b]) {
    const sp = SPECIES[p.sp];
    if (p.lv < mixLv(sp)) return { ...info, ok: false, reason: `${sp.name}은(는) Lv.${mixLv(sp)} 이상이어야 합니다.` };
  }
  if (G.gold < info.fee) return { ...info, ok: false, reason: '골드가 부족합니다.' };
  return info;
}

export function doMix(ua: number, ub: number): boolean {
  const a = G.pets.find((p) => p.uid === ua);
  const b = G.pets.find((p) => p.uid === ub);
  const info = mixInfo(a, b);
  if (!info.ok || !info.out || !a || !b) return false;
  G.gold -= info.fee;
  if (Math.random() > info.chance) {
    log('조합에 실패했습니다. 재료는 무사하지만 비용은 사라졌습니다.', 'bad');
    G.dirty = true;
    return false;
  }
  G.pets = G.pets.filter((p) => p !== a && p !== b);
  syncPets();
  addPet(info.out.id, info.lv);
  if (!G.known.includes(info.out.id)) G.known.push(info.out.id);
  log(`조합 성공! ${info.out.name} (Lv.${info.lv})이(가) 태어났습니다!`, 'good');
  const p = G.player;
  G.fx.push({ type: 'ring', x: p.x, y: p.y, tx: 0, ty: 0, t: 0, dur: 1, color: '#b98aff' });
  save();
  return true;
}

// ---------- 매 프레임 갱신 ----------

const TRAIL_GAP = 4;
const SLOTS: Pt[] = [{ x: -1.3, y: 0.6 }, { x: 0.6, y: -1.3 }, { x: -1.5, y: -1.5 }];

function updatePet(a: Actor, dt: number, slot: number) {
  const p = G.player;
  if (a.dead) {
    a.think -= dt;
    if (a.think <= 0) {
      a.dead = false;
      a.hp = Math.round(a.maxHp * 0.5);
      const s = nearFree(p.x, p.y);
      a.x = s.x;
      a.y = s.y;
      log(`${a.name}이(가) 깨어났습니다.`, 'sys');
      G.dirty = true;
    }
    return;
  }
  const dp = dist(a, p);
  if (dp > 13) {
    const s = nearFree(p.x, p.y);
    a.x = s.x;
    a.y = s.y;
    a.path = [];
    a.target = null;
  }
  if (p.target && p.target.type === 'mob' && !p.target.dead) a.target = p.target;
  if (a.target && (a.target.dead || dist(a.target, p) > 12)) a.target = null;
  if (!a.target) {
    for (const m of G.actors) {
      if (m.type === 'mob' && !m.dead && m.target && m.target.type !== 'mob' && dist(m, a) < 9) {
        a.target = m;
        break;
      }
    }
  }
  if (a.target) {
    chase(a, a.target, dt);
    return;
  }
  // 플레이어가 지나온 길 위에서 순번만큼 뒤처진 자리를 목표로 삼는다.
  const k = G.trail.length - 1 - (slot + 1) * TRAIL_GAP;
  const o = SLOTS[slot % SLOTS.length];
  const q = k >= 0 ? G.trail[k] : { x: p.x + o.x, y: p.y + o.y };
  const d = Math.hypot(q.x - a.x, q.y - a.y);
  a.repath -= dt;
  if (d > 0.3 && a.repath <= 0) {
    a.repath = 0.15;
    a.path = findPath(G.zone, a.x, a.y, q.x, q.y) || [];
  }
  stepPath(a, dt, d > 3 ? 1.35 : 1);
}

function updateMob(a: Actor, dt: number) {
  const p = G.player;
  const home = { x: a.homeX, y: a.homeY };
  let t = a.target;
  if (t && (t.dead || !G.actors.includes(t))) t = a.target = null;
  if (t && (dist(a, home) > 13 || dist(a, t) > 12)) {
    t = a.target = null;
    a.returning = true;
    a.path = findPath(G.zone, a.x, a.y, home.x, home.y) || [];
  }
  if (a.returning) {
    a.hp = Math.min(a.maxHp, a.hp + a.maxHp * 0.3 * dt);
    stepPath(a, dt);
    if (!a.path.length) a.returning = false;
    return;
  }
  if (!t && a.sp!.aggro && dist(a, p) < 4.5) t = a.target = p;
  if (t) {
    chase(a, t, dt);
    return;
  }
  a.think -= dt;
  if (a.think <= 0) {
    a.think = rand(2.5, 7);
    a.path = findPath(G.zone, a.x, a.y, home.x + rand(-3, 3), home.y + rand(-3, 3)) || [];
    if (a.path.length > 6) a.path = [];
  }
  stepPath(a, dt, 0.45);
}

function separate() {
  const list = G.actors;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a.dead || a.type === 'npc') continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      if (b.dead || b.type === 'npc') continue;
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d >= 0.55) continue;
      if (d < 0.001) {
        dx = Math.random() - 0.5;
        dy = Math.random() - 0.5;
      } else {
        dx /= d;
        dy /= d;
      }
      const push = (0.55 - d) * 0.5;
      const wa = a.type === 'player' ? 0 : b.type === 'player' ? 1 : 0.5;
      const ax = a.x - dx * push * wa * 2;
      const ay = a.y - dy * push * wa * 2;
      const bx = b.x + dx * push * (1 - wa) * 2;
      const by = b.y + dy * push * (1 - wa) * 2;
      if (!blocked(G.zone, ax, ay)) {
        a.x = ax;
        a.y = ay;
      }
      if (!blocked(G.zone, bx, by)) {
        b.x = bx;
        b.y = by;
      }
    }
  }
}

export function update(dt: number) {
  const p = G.player;
  G.time += dt;
  G.combatT += dt;
  G.cds.s1 = Math.max(0, G.cds.s1 - dt);
  G.cds.s2 = Math.max(0, G.cds.s2 - dt);
  G.cds.pot = Math.max(0, G.cds.pot - dt);

  let slot = 0;
  for (const a of [...G.actors]) {
    a.anim += dt;
    a.atkCd = Math.max(0, a.atkCd - dt);
    a.atkAnim = Math.max(0, a.atkAnim - dt);
    a.flash = Math.max(0, a.flash - dt);
    if (G.player !== p || !G.actors.includes(a)) break; // 사망 등으로 지역이 바뀐 경우
    if (a.type === 'player') {
      const t = a.target;
      if (t && t.dead) a.target = null;
      if (a.target && a.target.type === 'npc') {
        if (dist(a, a.target) <= 1.9) {
          G.uiRequest = a.target.npc!.role;
          setFacing(a, a.target.x - a.x, a.target.y - a.y);
          a.target = null;
          a.path = [];
          a.moving = false;
        } else stepPath(a, dt);
      } else if (a.target) chase(a, a.target, dt);
      else stepPath(a, dt);
    } else if (a.type === 'pet') updatePet(a, dt, slot++);
    else if (a.type === 'mob') {
      if (a.dead) a.deadT += dt;
      else updateMob(a, dt);
    }
  }
  const last = G.trail[G.trail.length - 1];
  if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= 0.25) {
    G.trail.push({ x: p.x, y: p.y });
    if (G.trail.length > 60) G.trail.shift();
  }
  separate();
  G.actors = G.actors.filter((a) => !(a.type === 'mob' && a.dead && a.deadT > 0.7));

  for (const r of G.respawns) r.t -= dt;
  const ready = G.respawns.filter((r) => r.t <= 0);
  if (ready.length) {
    G.respawns = G.respawns.filter((r) => r.t > 0);
    for (const r of ready) spawnMob(r.spawn);
  }

  for (const q of G.zone.def.portals) {
    if (Math.hypot(p.x - (q.x + 0.5), p.y - (q.y + 0.5)) < 0.9) {
      enterZone(q.to, q.tx + 0.5, q.ty + 0.5);
      break;
    }
  }

  // 회복: 마나는 항상, 체력은 전투가 끝난 뒤
  G.mp = Math.min(G.maxMp, G.mp + G.maxMp * 0.012 * dt);
  if (G.combatT > 5) {
    const rate = G.zone.def.safe ? 0.08 : 0.03;
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * rate * dt);
    for (const a of G.actors) if (a.type === 'pet' && !a.dead) a.hp = Math.min(a.maxHp, a.hp + a.maxHp * rate * dt);
  }

  for (const f of G.floats) f.t += dt;
  G.floats = G.floats.filter((f) => f.t < 0.9);
  for (const f of G.fx) f.t += dt;
  G.fx = G.fx.filter((f) => f.t < f.dur);

  G.saveT += dt;
  if (G.saveT > 10) {
    G.saveT = 0;
    save();
  }
}
