import {
  ITEMS, SKILLS, baseMods, charById, itemById, skillById,
  type CharDef, type Mods,
} from './content';
import {
  GEAR_BASES, RARITY, SLOTS, gearLines, gearTitle, makeGear, rollRarity, weaponById,
  type Gear, type GearStats, type Slot, type StatKey, type WeaponBase, type WeaponKind,
} from './gear';
import type { Input } from './input';
import { SETS, SYN_NAME, TAG_INFO, activeSynergies, tagCounts, type Tag } from './synergy';
import type { RunResult } from './meta';
import { FOUNTAIN_X, buildRoom, drawLighting, drawWallAnim, themeForRoom, type Light } from './room';
import { animFrame, drawIcon, drawSprite, type IconRef } from './sprites';
import { S, type SpriteKey } from './spritesheet';
import { boss3d, type BossPose } from './boss3d';
import { angDiff, clamp, dist, rand, shuffle } from './util';

export const W = 960;
export const H = 640;
const WALL = 28;
/** 위쪽 벽은 장식을 위해 더 두껍다. 바닥(플레이 영역)은 y >= TOP. */
export const TOP = 84;
const FINAL_ROOM = 15;
const BOSS_EVERY = 5;
/** 보상 카드를 고르는 방: 각 층의 3번째 방과 보스 방(3, 5, 8, 10, 13) */
const isRewardRoom = (n: number) => n % BOSS_EVERY === 0 || n % BOSS_EVERY === 3;
/** 일반 방 클리어 시 장비가 나올 확률 (보스 방은 보장) */
const CLEAR_DROP_CHANCE = 0.3;

type EnemyKind = 'grunt' | 'archer' | 'charger' | 'swarm' | 'brute' | 'boss';

const ENEMY_SPRITE: Record<Exclude<EnemyKind, 'boss'>, SpriteKey> = {
  grunt: 'orc_warrior', archer: 'orc_shaman', swarm: 'imp', charger: 'chort', brute: 'pumpkin',
};
const BOSS_SPRITE: SpriteKey[] = ['big_zombie', 'big_zombie', 'ogre', 'big_demon'];
const BOSS_NAME = ['', '파수꾼', '군주', '심연의 왕'];

/** 처치 시 장비 드랍 확률 */
const DROP_CHANCE: Record<EnemyKind, number> = {
  grunt: 0.04, archer: 0.04, swarm: 0.015, charger: 0.06, brute: 0.15, boss: 1,
};
/** 무기 종류별 휘두르기 애니메이션 길이(초) */
const SWING_TIME: Record<WeaponKind, number> = {
  slash: 0.16, thrust: 0.14, smash: 0.24, bow: 0.18, staff: 0.2,
};
const EXIT = { x: W / 2, y: TOP + 18 }; // 방 클리어 후 나타나는 출구(사다리)
const CHEST = { x: W / 2 + 190, y: TOP + 170 }; // 보물 방 상자 위치(사다리 가는 길을 막지 않게 오른쪽)
const CHEST_OPEN_T = 0.45; // 상자 여는 연출 길이(초)

interface Drop { x: number; y: number; gear: Gear; t: number }

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number; size: number; color: string;
  grav: number; glow: boolean;
}

const ZERO_STATS = (): Required<GearStats> => ({
  dmgPct: 0, rate: 0, speed: 0, maxHp: 0, armor: 0, crit: 0, lifesteal: 0, regen: 0, skillCd: 0,
});
const easeOut = (t: number) => 1 - (1 - t) ** 3;

interface EnemyStat { hp: number; r: number; speed: number; dmg: number; color: string; cost: number; minRoom: number }

const ENEMY: Record<Exclude<EnemyKind, 'boss'>, EnemyStat> = {
  grunt: { hp: 22, r: 12, speed: 75, dmg: 10, color: '#e0605a', cost: 1, minRoom: 1 },
  archer: { hp: 16, r: 11, speed: 60, dmg: 8, color: '#d9a441', cost: 1.5, minRoom: 2 },
  swarm: { hp: 7, r: 8, speed: 115, dmg: 6, color: '#e89a7a', cost: 0.5, minRoom: 2 },
  charger: { hp: 38, r: 14, speed: 70, dmg: 16, color: '#b45ad9', cost: 2, minRoom: 3 },
  brute: { hp: 95, r: 21, speed: 48, dmg: 20, color: '#8a5a3a', cost: 4, minRoom: 6 },
};

interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number; y: number;
  kx: number; ky: number; // 넉백 속도
  r: number;
  hp: number; maxHp: number;
  speed: number;
  dmg: number;
  color: string;
  spawnT: number;
  cd: number;
  state: number; // 0 추적 / 1 준비 / 2 돌진 / 3 휴식 (돌진형, 보스 공용)
  st: number; // 상태 타이머
  dx: number; dy: number; // 돌진 방향
  burnT: number; burnDps: number;
  poisonT: number; poisonStacks: number;
  frostT: number;
  orbitCd: number;
  flash: number;
  tier: number; // 보스 단계
  pattern: number;
  spiralT: number;
  act: number; // 보스가 공격할 때마다 늘어나는 번호(3D 공격 동작 재생용)
  actKind: 'attack' | 'summon';
  dead: boolean;
}

interface Proj {
  x: number; y: number; vx: number; vy: number;
  r: number; dmg: number; life: number;
  friendly: boolean;
  pierce: number; bounce: number;
  hit: Set<number>;
  color: string;
  sprite?: SpriteKey;
  proc?: boolean; // 다른 효과로 생긴 투사체(연쇄 발동 방지)
  boom?: boolean; // 맞으면 작게 폭발
  glow?: string; // 원소 색 빛
}

interface Turret { x: number; y: number; t: number; cd: number }

interface Fx {
  kind: 'ring' | 'arc' | 'text';
  x: number; y: number; t: number; life: number;
  r?: number; a?: number; arc?: number; text?: string; color: string;
  big?: boolean;
}

export interface Card {
  kind: 'item' | 'skill' | 'heal';
  tags?: Tag[];
  hint?: string; // 이 카드를 고르면 발동하는 시너지
  id: string;
  name: string;
  desc: string;
  sprite: IconRef;
}

export interface GameEvents {
  onReward(cards: Card[], room: number): void;
  onEnd(result: RunResult): void;
  onPause(paused: boolean): void;
  onSynergy(id: string): void;
}

type Phase = 'playing' | 'cleared' | 'exiting' | 'reward' | 'ended';

/** 출구 연출 시간(초): 점프 → 구멍으로 하강 → 암전 */
const HOP_T = 0.38;
const SINK_T = 0.45;
const EXIT_T = 1.05;
const ENTER_T = 0.5; // 새 방에 떨어져 내려오는 시간

export class Game {
  private ctx: CanvasRenderingContext2D;
  private char: CharDef;
  private m: Mods = baseMods();
  private unlocked: Set<string>;

  private p = {
    x: W / 2, y: H / 2, r: 13, hp: 0, maxHp: 0,
    aim: 0, atkCd: 0, skillCd: 0, skillId: '',
    invuln: 0, dashT: 0, dashX: 0, dashY: 0,
    shieldT: 0, rageT: 0, slowT: 0, orbitA: 0, hpAcc: 0, moving: false,
    swingT: 0, swingDur: 1, swingAim: 0, swingDir: 1,
  };

  private equip: Record<Slot, Gear | null> = { weapon: null, helmet: null, armor: null, boots: null, accessory: null };
  private gs = ZERO_STATS(); // 장착 장비 능력치 합계
  private drops: Drop[] = [];
  private near: Drop | null = null; // 플레이어 가까이 있는 드랍
  /** 보물 방 상자. openT >= 0 이면 열리는 중이거나 열린 상태 */
  private chest: { x: number; y: number; openT: number; looted: boolean } | null = null;
  private nearChest = false;
  private pickedUids = new Set<number>();
  private parts: Particle[] = [];
  private shake = 0;
  private hurtFlash = 0; // 피격 시 화면 붉은 번쩍임
  private exitT = 0; // 출구 연출 경과 시간
  private exitFrom = { x: 0, y: 0 };
  private hop = 0; // 점프 높이(px)
  private sink = 0; // 구멍으로 내려간 깊이(px)
  private fade = 0; // 화면 암전(0~1)
  private enterT = 0; // 새 방 입장 낙하 남은 시간
  private syn = new Set<string>(); // 발동 중인 시너지
  private attackCount = 0;
  private guardT = 10; // 철벽 세트 보호막 주기
  private accelT = 0; // 가속 회로 지속 시간
  private bolts: { pts: { x: number; y: number }[]; t: number; life: number }[] = [];

  private enemies: Enemy[] = [];
  private projs: Proj[] = [];
  private turrets: Turret[] = [];
  private fx: Fx[] = [];
  private waves: EnemyKind[][] = [];
  private nextId = 1;

  room = 0;
  private phase: Phase = 'playing';
  private bannerT = 0;
  paused = false;
  private time = 0; // 애니메이션용 누적 시간
  private itemCounts = new Map<string, number>();

  private kills = 0;
  private bossKills = 0;
  private roomsCleared = 0;
  private itemsCollected = 0;

  constructor(
    canvas: HTMLCanvasElement,
    private input: Input,
    charId: string,
    unlockedIds: string[],
    private ev: GameEvents,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.char = charById(charId);
    this.unlocked = new Set(unlockedIds);
    this.p.skillId = this.char.skill;
    this.equip.weapon = makeGear(weaponById(this.char.startWeapon), 0, 1);
    this.recalc();
    boss3d().reset();
    this.startRoom(1);
  }

  // ---------- 흐름 ----------

  private startRoom(n: number) {
    this.room = n;
    this.phase = 'playing';
    this.enemies = [];
    this.projs = [];
    this.turrets = [];
    this.drops = [];
    this.near = null;
    this.chest = isRewardRoom(n) ? { x: CHEST.x, y: CHEST.y, openT: -1, looted: false } : null;
    this.nearChest = false;
    this.p.x = W / 2;
    this.p.y = H / 2;
    this.bannerT = 1.6;
    this.enterT = ENTER_T;
    this.hop = 0;
    this.sink = 0;
    this.waves = this.buildWaves(n);
    this.spawnWave();
  }

  private buildWaves(n: number): EnemyKind[][] {
    if (n % BOSS_EVERY === 0) return [['boss']];
    const total = 5 + n * 1.6;
    const waveCount = n < 3 ? 1 : 2;
    const pool = (Object.keys(ENEMY) as (keyof typeof ENEMY)[]).filter((k) => ENEMY[k].minRoom <= n);
    const waves: EnemyKind[][] = [];
    for (let w = 0; w < waveCount; w++) {
      let budget = total / waveCount;
      const wave: EnemyKind[] = [];
      while (budget > 0) {
        const k = pool[Math.floor(Math.random() * pool.length)];
        if (k === 'swarm') {
          for (let i = 0; i < 4; i++) wave.push('swarm');
          budget -= ENEMY.swarm.cost * 4;
        } else {
          wave.push(k);
          budget -= ENEMY[k].cost;
        }
      }
      waves.push(wave);
    }
    return waves;
  }

  private spawnWave() {
    const wave = this.waves.shift();
    if (!wave) return;
    const hpMul = 1 + 0.12 * (this.room - 1);
    for (const kind of wave) {
      let x = 0;
      let y = 0;
      for (let tries = 0; tries < 20; tries++) {
        x = rand(WALL + 30, W - WALL - 30);
        y = rand(TOP + 30, H - WALL - 30);
        if (dist(x, y, this.p.x, this.p.y) > 220) break;
      }
      this.enemies.push(this.makeEnemy(kind, x, y, hpMul));
    }
  }

  private makeEnemy(kind: EnemyKind, x: number, y: number, hpMul: number): Enemy {
    const base = {
      id: this.nextId++, x, y, kx: 0, ky: 0, spawnT: 0.9, cd: rand(0.6, 1.6), state: 0, st: 0,
      dx: 0, dy: 0, burnT: 0, burnDps: 0, poisonT: 0, poisonStacks: 0, frostT: 0, orbitCd: 0, flash: 0, tier: 0, pattern: 0, spiralT: 0, act: 0, actKind: 'attack' as const, dead: false,
    };
    if (kind === 'boss') {
      const tier = Math.floor(this.room / BOSS_EVERY);
      const hp = [0, 600, 1400, 2600][tier];
      return {
        ...base, kind, r: 34 + tier * 4, hp, maxHp: hp, speed: 38 + tier * 6,
        dmg: 18 + tier * 4, color: ['', '#c0392b', '#8e44ad', '#2c3e50'][tier],
        tier, spawnT: 1.4, cd: 2,
      };
    }
    const s = ENEMY[kind];
    const hp = Math.round(s.hp * hpMul);
    return { ...base, kind, r: s.r, hp, maxHp: hp, speed: s.speed, dmg: s.dmg + Math.floor(this.room / 3), color: s.color };
  }

  private roomCleared() {
    this.phase = 'cleared';
    this.roomsCleared++;
    this.heal(this.p.maxHp * 0.12);
    this.projs = this.projs.filter((q) => q.friendly);
    // 보스 방은 장비를 보장하고, 일반 방은 가끔만 상자에서 장비가 나온다.
    const boss = this.room % BOSS_EVERY === 0;
    if (boss || Math.random() < CLEAR_DROP_CHANCE) this.spawnDrop(W / 2, H / 2 + 40, boss ? 2 : 0);
    this.fx.push({ kind: 'text', x: W / 2, y: H / 2 - 40, t: 0, life: 1.8, text: 'ROOM CLEAR', color: '#ffd27a', big: true });
  }

  abandon(): RunResult {
    this.phase = 'ended';
    return { ...this.result(false), abandoned: true };
  }

  private result(won: boolean): RunResult {
    return {
      won, char: this.char.id, room: this.room, kills: this.kills, bossKills: this.bossKills,
      roomsCleared: this.roomsCleared, itemsCollected: this.itemsCollected,
    };
  }

  private finish(won: boolean) {
    this.phase = 'ended';
    this.ev.onEnd(this.result(won));
  }

  // ---------- 보상 ----------

  private rollCards(): Card[] {
    const n = Math.min(5, this.m.choices);
    const cards: Card[] = [];
    if (this.p.hp / this.p.maxHp < 0.6) {
      cards.push({ kind: 'heal', id: 'heal', sprite: 'heart', name: '응급 치료', desc: '최대 체력의 40%를 회복합니다.' });
    }
    const items = shuffle(ITEMS.filter((i) => this.unlocked.has(i.id)));
    const skills = shuffle(SKILLS.filter((s) => this.unlocked.has(s.id) && s.id !== this.p.skillId));
    while (cards.length < n && (items.length || skills.length)) {
      const wantSkill = skills.length > 0 && (items.length === 0 || Math.random() < 0.25);
      if (wantSkill) {
        const s = skills.pop()!;
        cards.push({ kind: 'skill', id: s.id, sprite: s.sprite, name: `[스킬] ${s.name}`, desc: `${s.desc} (쿨타임 ${s.cd}초, 현재 스킬 교체)` });
      } else {
        const i = items.pop()!;
        const next = activeSynergies([...this.itemCounts.keys(), i.id], (id) => itemById(id).tags);
        const gained = [...next].filter((x) => !this.syn.has(x)).map((x) => SYN_NAME.get(x));
        cards.push({
          kind: 'item', id: i.id, sprite: i.sprite, name: i.name, desc: i.desc, tags: i.tags,
          hint: gained.length ? gained.join(', ') : undefined,
        });
      }
    }
    return cards;
  }

  pickReward(card: Card) {
    if (this.phase !== 'reward') return;
    if (card.kind === 'heal') {
      this.heal(this.p.maxHp * 0.4);
    } else if (card.kind === 'skill') {
      this.p.skillId = card.id;
      this.p.skillCd = 0;
      this.itemsCollected++;
    } else {
      itemById(card.id).apply(this.m);
      this.recalc();
      this.itemCounts.set(card.id, (this.itemCounts.get(card.id) ?? 0) + 1);
      this.refreshSynergies();
      this.itemsCollected++;
    }
    // 상자 보상을 고른 뒤에는 방에 남아 장비를 정리하고 사다리로 간다.
    this.phase = 'cleared';
  }

  // ---------- 갱신 ----------

  update(dtRaw: number) {
    if (this.input.takePause() && this.phase !== 'ended' && this.phase !== 'reward' && this.phase !== 'exiting') {
      this.paused = !this.paused;
      this.ev.onPause(this.paused);
    }
    if (this.paused || this.phase === 'ended') {
      this.input.takeSkill();
      return;
    }
    const dt = Math.min(dtRaw, 1 / 30);
    this.time += dt;

    this.updateFx(dt);
    if (this.phase === 'reward') return;
    if (this.phase === 'exiting') {
      this.updateExit(dt);
      return;
    }
    if (this.fade > 0) this.fade = Math.max(0, this.fade - dt * 2.2);
    this.bannerT = Math.max(0, this.bannerT - dt);
    if (this.enterT > 0) {
      this.enterT -= dt;
      if (this.enterT <= 0) {
        // 착지: 먼지와 약한 흔들림
        this.burst(this.p.x, this.p.y + this.p.r, 14, '#9a8a78', 140, { size: 4, life: 0.45, glow: false, grav: -30 });
        this.shake = Math.max(this.shake, 4);
      }
    }

    if (this.phase === 'cleared') {
      this.updatePlayer(dt);
      this.updateProjs(dt, dt);
      this.updateChest(dt);
      if (this.phase !== 'cleared') return;
      this.updateDrops(dt);
      // 출구(사다리)에 올라서면 다음 단계로. 열지 않은 상자가 있으면 사다리를 막는다.
      const chestWaiting = this.chest && !this.chest.looted;
      if (!chestWaiting && dist(this.p.x, this.p.y, EXIT.x, EXIT.y) < 24) {
        this.phase = 'exiting';
        this.exitT = 0;
        this.exitFrom = { x: this.p.x, y: this.p.y };
        this.p.swingT = 0;
        this.near = null;
      }
      return;
    }

    const slow = this.p.slowT > 0 ? 0.4 : 1;
    this.updatePlayer(dt);
    this.updateTurrets(dt);
    this.updateEnemies(dt, dt * slow);
    this.updateProjs(dt, dt * slow);
    this.updateOrbit(dt);
    this.updateChest(dt);
    this.updateDrops(dt);
    this.enemies = this.enemies.filter((e) => !e.dead);

    if (this.phase === 'playing' && this.enemies.length === 0) {
      if (this.waves.length > 0) this.spawnWave();
      else this.roomCleared();
    }
  }

  /** 출구 연출: 구멍 위로 살짝 뛰어올라 들어간 뒤 화면이 어두워진다. */
  private updateExit(dt: number) {
    const p = this.p;
    const before = this.exitT;
    this.exitT += dt;
    const t = this.exitT;
    // 발이 구멍 가장자리에 닿도록 착지 지점을 잡는다.
    const tx = EXIT.x;
    const ty = EXIT.y - p.r + 2;
    if (t < HOP_T) {
      const k = t / HOP_T;
      p.x = this.exitFrom.x + (tx - this.exitFrom.x) * k;
      p.y = this.exitFrom.y + (ty - this.exitFrom.y) * k;
      this.hop = Math.sin(k * Math.PI) * 30;
      p.moving = true;
    } else {
      p.x = tx;
      p.y = ty;
      this.hop = 0;
      p.moving = false;
      if (before < HOP_T) {
        this.burst(tx, EXIT.y, 10, '#9a8a78', 110, { size: 3, life: 0.4, glow: false, grav: -20 });
      }
      const k = Math.min(1, (t - HOP_T) / SINK_T);
      this.sink = k * k * 70;
    }
    this.fade = Math.max(0, Math.min(1, (t - 0.7) / (EXIT_T - 0.7)));
    if (t >= EXIT_T) {
      this.fade = 1;
      if (this.room >= FINAL_ROOM) {
        this.finish(true);
      } else {
        this.startRoom(this.room + 1);
      }
    }
  }

  private heal(v: number) {
    this.p.hp = Math.min(this.p.maxHp, this.p.hp + v);
  }

  /** 장비 능력치 합계를 다시 계산하고 최대 체력을 반영한다. 최대 체력이 늘면 그만큼 회복. */
  private has(id: string) {
    return this.syn.has(id);
  }

  /** 보유 아이템으로 시너지를 다시 계산하고, 새로 발동한 것을 알린다. */
  private refreshSynergies() {
    const next = activeSynergies(this.itemCounts.keys(), (id) => itemById(id).tags);
    for (const id of next) {
      if (this.syn.has(id)) continue;
      const isSet = id.startsWith('set:');
      this.fx.push({
        kind: 'text', x: W / 2, y: H / 2 + 10, t: 0, life: 2.4, big: true,
        text: `${isSet ? '세트' : '시너지'}: ${SYN_NAME.get(id)}`, color: isSet ? '#8fd0ff' : '#ffb35c',
      });
      this.ev.onSynergy(id);
    }
    this.syn = next;
  }

  /** 일시정지 화면용: 발동 중인 시너지와 태그별 진행도 */
  synergyInfo() {
    const counts = tagCounts(this.itemCounts.keys(), (id) => itemById(id).tags);
    return {
      active: [...this.syn],
      sets: SETS.map((st) => ({ ...st, count: counts.get(st.tag) ?? 0 })),
    };
  }

  /** 원소 효과 색(투사체/궤적 표시용) */
  private elementColor(): string | undefined {
    if (this.m.chain > 0) return '#ffe14a';
    if (this.m.frost > 0) return '#9fe6ff';
    if (this.m.poison > 0) return '#8ae06a';
    if (this.m.burn > 0) return '#ff9a4a';
    return undefined;
  }

  /** 주변 적에게 번개가 튄다. */
  private chainLightning(from: Enemy, dmg: number, jumps: number) {
    const hit = new Set([from.id]);
    const pts = [{ x: from.x, y: from.y }];
    let cur = from;
    for (let j = 0; j < jumps; j++) {
      let best: Enemy | null = null;
      let bd = 170;
      for (const e of this.enemies) {
        if (e.dead || e.spawnT > 0 || hit.has(e.id)) continue;
        const d = dist(e.x, e.y, cur.x, cur.y);
        if (d < bd) { bd = d; best = e; }
      }
      if (!best) break;
      hit.add(best.id);
      pts.push({ x: best.x, y: best.y });
      this.hurtEnemy(best, dmg, true, true);
      cur = best;
    }
    if (pts.length > 1) this.bolts.push({ pts, t: 0, life: 0.2 });
  }

  /** 파편(근접/원거리 공통): 다른 효과를 다시 일으키지 않는 작은 투사체 */
  private shards(x: number, y: number, n: number, dmg: number, boom: boolean) {
    const off = rand(0, Math.PI * 2);
    for (let i = 0; i < n; i++) {
      const a = off + (i * Math.PI * 2) / n;
      this.projs.push({
        x, y, vx: Math.cos(a) * 420, vy: Math.sin(a) * 420, r: 4, dmg, life: 0.55, friendly: true,
        pierce: 0, bounce: 0, hit: new Set(), color: '#e8d8ff', sprite: 'w_dagger', proc: true, boom,
      });
    }
  }

  private recalc() {
    const z = ZERO_STATS();
    for (const slot of SLOTS) {
      const g = this.equip[slot];
      if (!g) continue;
      for (const [k, v] of Object.entries(g.stats) as [StatKey, number][]) z[k] += v;
    }
    this.gs = z;
    const p = this.p;
    const prev = p.maxHp;
    p.maxHp = Math.max(10, Math.round(this.char.hp + this.m.maxHp + z.maxHp));
    if (p.maxHp > prev) p.hp += p.maxHp - prev;
    p.hp = Math.min(p.hp, p.maxHp);
  }

  private get weapon(): Gear & { base: WeaponBase } {
    return this.equip.weapon as Gear & { base: WeaponBase };
  }

  private skillCdMul(): number {
    return this.m.skillCd * Math.max(0.4, 1 - this.gs.skillCd);
  }

  /** 일시정지 화면용 장비 목록 */
  equipment(): { slot: Slot; gear: Gear | null }[] {
    return SLOTS.map((slot) => ({ slot, gear: this.equip[slot] }));
  }

  // ---------- 장비 드랍 ----------

  private spawnDrop(x: number, y: number, minRarity: number) {
    const slot = SLOTS[Math.floor(Math.random() * SLOTS.length)];
    const pool = GEAR_BASES.filter((b) => b.slot === slot && this.unlocked.has(b.id));
    if (pool.length === 0) return;
    const base = pool[Math.floor(Math.random() * pool.length)];
    const gear = makeGear(base, rollRarity(this.room, minRarity), this.room);
    this.drops.push({
      x: clamp(x + rand(-12, 12), WALL + 20, W - WALL - 20),
      y: clamp(y + rand(-12, 12), TOP + 20, H - WALL - 20),
      gear, t: rand(0, 3),
    });
  }

  /** 상자는 막힌 물체다. 방을 클리어하면 열 수 있고, 다 열리면 보상 카드를 띄운다. */
  private updateChest(dt: number) {
    const ch = this.chest;
    this.nearChest = false;
    if (!ch) return;
    const p = this.p;
    // 상자를 통과하지 못하게 밀어낸다.
    const dx = p.x - ch.x;
    const dy = p.y - ch.y;
    const d = Math.hypot(dx, dy);
    const minD = p.r + 18;
    if (d < minD && d > 0.01) {
      p.x = ch.x + (dx / d) * minD;
      p.y = ch.y + (dy / d) * minD;
    }
    if (ch.openT >= 0) {
      const before = ch.openT;
      ch.openT += dt;
      if (before < CHEST_OPEN_T && ch.openT >= CHEST_OPEN_T) {
        ch.looted = true;
        this.burst(ch.x, ch.y - 10, 26, '#ffd27a', 220, { size: 4, life: 0.7, grav: 120 });
        this.phase = 'reward';
        this.ev.onReward(this.rollCards(), this.room);
      }
      return;
    }
    if (this.phase !== 'cleared') return;
    this.nearChest = d < minD + 26;
    if (this.nearChest && this.input.takeInteract()) {
      ch.openT = 0;
      this.shake = Math.max(this.shake, 3);
    }
  }

  private updateDrops(dt: number) {
    const p = this.p;
    let best: Drop | null = null;
    let bd = 34;
    for (const d of this.drops) {
      d.t += dt;
      const dd = dist(d.x, d.y, p.x, p.y);
      if (dd < bd) { bd = dd; best = d; }
    }
    // 빈 슬롯이면 자동으로 장착
    if (best && !this.equip[best.gear.base.slot]) {
      this.equipDrop(best);
      best = null;
    }
    this.near = best;
    if (this.input.takeInteract() && this.near) this.equipDrop(this.near);
  }

  private equipDrop(d: Drop) {
    const slot = d.gear.base.slot;
    const old = this.equip[slot];
    this.equip[slot] = d.gear;
    this.drops = this.drops.filter((o) => o !== d);
    if (old) this.drops.push({ x: d.x, y: d.y, gear: old, t: 0 });
    if (!this.pickedUids.has(d.gear.uid)) {
      this.pickedUids.add(d.gear.uid);
      this.itemsCollected++;
    }
    this.recalc();
    this.near = null;
    this.fx.push({
      kind: 'text', x: this.p.x, y: this.p.y - 40, t: 0, life: 1.0,
      text: `장착: ${d.gear.base.name}`, color: RARITY[d.gear.rarity].color,
    });
  }

  private dmgMul(): number {
    let v = this.m.dmg * (1 + this.gs.dmgPct);
    if (this.has('set:blood') && this.p.hp / this.p.maxHp < 0.4) v *= 1.3;
    if (this.p.rageT > 0) v *= 1.5;
    if (this.char.id === 'berserker') v *= 1 + (1 - this.p.hp / this.p.maxHp);
    return v;
  }

  private updatePlayer(dt: number) {
    const p = this.p;
    p.aim = Math.atan2(this.input.my - p.y, this.input.mx - p.x);
    p.invuln = Math.max(0, p.invuln - dt);
    p.shieldT = Math.max(0, p.shieldT - dt);
    p.rageT = Math.max(0, p.rageT - dt);
    p.slowT = Math.max(0, p.slowT - dt);
    p.skillCd = Math.max(0, p.skillCd - dt);
    p.atkCd = Math.max(0, p.atkCd - dt);
    p.swingT = Math.max(0, p.swingT - dt);
    const regen = this.m.regen + this.gs.regen;
    if (regen > 0) this.heal(regen * dt);

    if (p.dashT > 0) {
      p.dashT -= dt;
      p.x += p.dashX * 700 * dt;
      this.burst(p.x, p.y + p.r, 1, '#8a7a6a', 30, { size: 3, life: 0.35, glow: false, grav: -20 });
      p.y += p.dashY * 700 * dt;
    } else if (this.enterT > 0) {
      p.moving = false;
    } else {
      const a = this.input.axis();
      p.moving = a.x !== 0 || a.y !== 0;
      const sp = this.char.speed * this.m.speed * Math.max(0.5, 1 + this.gs.speed) * (this.has('set:swift') ? 1.15 : 1);
      p.x += a.x * sp * dt;
      p.y += a.y * sp * dt;
    }
    p.x = clamp(p.x, WALL + p.r, W - WALL - p.r);
    p.y = clamp(p.y, TOP + p.r, H - WALL - p.r);

    if (this.input.takeSkill() && p.skillCd <= 0) this.useSkill();

    let rate = this.m.rate * (1 + this.gs.rate) * (p.rageT > 0 ? 1.5 : 1);
    if (this.has('set:swift') && p.moving) rate *= 1.2;
    if (this.accelT > 0) rate *= 1.5;
    this.accelT = Math.max(0, this.accelT - dt);
    // 철벽 세트: 10초마다 보호막
    if (this.has('set:guard') && this.phase === 'playing') {
      this.guardT -= dt;
      if (this.guardT <= 0) {
        this.guardT = 10;
        if (p.shieldT <= 0) p.shieldT = 9999;
      }
    }
    if (this.input.down && p.atkCd <= 0 && this.enterT <= 0) {
      p.atkCd = this.weapon.base.cd / rate;
      this.attack(p.atkCd);
    }
  }

  private useSkill() {
    const p = this.p;
    const def = skillById(p.skillId);
    p.skillCd = def.cd * this.skillCdMul();
    if (this.has('overclock')) this.accelT = 2.5;
    switch (def.id) {
      case 'dash': {
        const a = this.input.axis();
        const useMove = a.x !== 0 || a.y !== 0;
        p.dashX = useMove ? a.x : Math.cos(p.aim);
        p.dashY = useMove ? a.y : Math.sin(p.aim);
        p.dashT = 0.18;
        p.invuln = Math.max(p.invuln, 0.3);
        break;
      }
      case 'nova': {
        const R = 170;
        for (const e of this.enemies) {
          if (e.spawnT > 0 || e.dead) continue;
          const d = dist(e.x, e.y, p.x, p.y);
          if (d < R + e.r) {
            this.hurtEnemy(e, 45, true);
            const a = Math.atan2(e.y - p.y, e.x - p.x);
            e.kx += Math.cos(a) * 420;
            e.ky += Math.sin(a) * 420;
          }
        }
        this.projs = this.projs.filter((q) => q.friendly || dist(q.x, q.y, p.x, p.y) > R);
        this.fx.push({ kind: 'ring', x: p.x, y: p.y, t: 0, life: 0.35, r: R, color: '#b8a6ff' });
        break;
      }
      case 'barrier':
        p.shieldT = 5;
        break;
      case 'slow':
        p.slowT = 4;
        break;
      case 'turret':
        this.turrets.push({ x: p.x, y: p.y, t: 8, cd: 0 });
        break;
      case 'rage':
        p.rageT = 5;
        break;
    }
  }

  /** 장착한 무기로 공격한다. 무기 종류마다 판정과 휘두르는 모션이 다르다. */
  private attack(interval: number) {
    const p = this.p;
    const w = this.weapon;
    const b = w.base;
    const m = this.m;
    const dmg = w.dmg * this.dmgMul();
    p.swingDur = Math.min(SWING_TIME[b.wkind], interval * 0.9);
    p.swingT = p.swingDur;
    p.swingAim = p.aim;
    p.swingDir = -p.swingDir; // 베기는 좌우를 번갈아 휘두른다
    this.attackCount++;
    if (this.has('set:blade') && this.attackCount % 4 === 0) this.shards(p.x, p.y, 8, w.dmg * 0.5 * this.dmgMul(), this.has('chain_blast'));

    if (b.wkind === 'bow' || b.wkind === 'staff') {
      const bow = b.wkind === 'bow';
      const count = 1 + Math.floor(m.extra) + (this.has('tracking') ? 1 : 0);
      const sharp = this.has('set:shot');
      const elem = this.elementColor();
      const step = bow ? 0.12 : 0.18;
      const speed = (bow ? 560 : 380) * (sharp ? 1.3 : 1);
      for (let i = 0; i < count; i++) {
        const a = p.aim + (i - (count - 1) / 2) * step;
        this.projs.push({
          x: p.x + Math.cos(a) * 18, y: p.y - 6 + Math.sin(a) * 18,
          vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
          r: bow ? 4 : 9, dmg, life: bow ? 1.2 : 1.6, friendly: true,
          pierce: m.pierce + (bow ? 0 : 2) + (sharp ? 1 : 0), bounce: m.bounce, hit: new Set(),
          color: elem ?? (b.id === 'staff_green' ? '#7ee08a' : '#b49cff'), glow: elem,
          sprite: bow ? 'w_arrow' : undefined,
        });
      }
      return;
    }

    const range = (b.range + m.extra * 16) * (this.has('set:shot') ? 1.2 : 1);
    const ax = Math.cos(p.aim);
    const ay = Math.sin(p.aim);
    for (const e of this.enemies) {
      if (e.spawnT > 0 || e.dead) continue;
      if (dist(e.x, e.y, p.x, p.y) > range + e.r) continue;
      if (angDiff(Math.atan2(e.y - p.y, e.x - p.x), p.aim) > b.arc / 2 + 0.15) continue;
      this.hurtEnemy(e, dmg, true);
      e.kx += ax * b.knock;
      e.ky += ay * b.knock;
    }
    if (b.wkind !== 'thrust') {
      // 베기와 내려치기는 범위 안의 적 투사체를 쳐낸다.
      this.projs = this.projs.filter((q) => {
        if (q.friendly) return true;
        const d = dist(q.x, q.y, p.x, p.y);
        return !(d < range && angDiff(Math.atan2(q.y - p.y, q.x - p.x), p.aim) < b.arc / 2);
      });
    }
    if (b.wkind === 'smash') {
      this.shake = Math.max(this.shake, 3);
      this.burst(p.x + ax * range * 0.7, p.y + ay * range * 0.7, 8, '#bfae94', 120, { size: 3, life: 0.4, glow: false });
      this.fx.push({ kind: 'ring', x: p.x + ax * range * 0.7, y: p.y + ay * range * 0.7, t: 0, life: 0.25, r: 34, color: '#e8d8b0' });
    }
  }

  private updateTurrets(dt: number) {
    for (const t of this.turrets) {
      t.t -= dt;
      t.cd -= dt;
      if (t.cd > 0) continue;
      let best: Enemy | null = null;
      let bd = 320;
      for (const e of this.enemies) {
        if (e.spawnT > 0 || e.dead) continue;
        const d = dist(e.x, e.y, t.x, t.y);
        if (d < bd) { bd = d; best = e; }
      }
      if (!best) continue;
      t.cd = 0.4;
      const a = Math.atan2(best.y - t.y, best.x - t.x);
      this.projs.push({
        x: t.x, y: t.y, vx: Math.cos(a) * 560, vy: Math.sin(a) * 560, r: 4, dmg: 10 * this.m.dmg,
        life: 1, friendly: true, pierce: 0, bounce: 0, hit: new Set(), color: '#ffd966',
      });
    }
    this.turrets = this.turrets.filter((t) => t.t > 0);
  }

  private updateOrbit(dt: number) {
    const n = this.m.orbit;
    if (n <= 0) return;
    const wheel = this.has('fire_wheel');
    const R = wheel ? 72 : 58;
    this.p.orbitA += dt * (wheel ? 4.6 : 3.2);
    for (let i = 0; i < n; i++) {
      const a = this.p.orbitA + (i * Math.PI * 2) / n;
      const bx = this.p.x + Math.cos(a) * R;
      const by = this.p.y + Math.sin(a) * R;
      for (const e of this.enemies) {
        if (e.spawnT > 0 || e.dead || e.orbitCd > 0) continue;
        if (dist(bx, by, e.x, e.y) < e.r + 9) {
          e.orbitCd = 0.4;
          this.hurtEnemy(e, 7 * this.dmgMul() * (wheel ? 1.5 : 1), true);
        }
      }
    }
  }

  // ---------- 적 ----------

  private updateEnemies(dtReal: number, dtE: number) {
    const p = this.p;
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.flash = Math.max(0, e.flash - dtReal);
      e.orbitCd = Math.max(0, e.orbitCd - dtReal);
      if (e.spawnT > 0) { e.spawnT -= dtReal; continue; }

      // 지속 피해: 독연 시너지면 화상과 독이 함께 걸린 적은 2배
      const both = this.has('toxic_fire') && e.burnT > 0 && e.poisonT > 0 ? 2 : 1;
      if (e.burnT > 0) {
        e.burnT -= dtReal;
        e.hp -= e.burnDps * both * dtReal;
        if (Math.random() < dtReal * 8) this.burst(e.x + rand(-e.r, e.r), e.y, 1, '#ff8a3a', 30, { grav: -80, size: 3, life: 0.5 });
      }
      if (e.poisonT > 0) {
        e.poisonT -= dtReal;
        e.hp -= 2 * this.m.poison * e.poisonStacks * both * dtReal;
        if (e.poisonT <= 0) e.poisonStacks = 0;
        if (Math.random() < dtReal * 6) this.burst(e.x + rand(-e.r, e.r), e.y, 1, '#8ae06a', 20, { grav: -50, size: 3, life: 0.6, glow: false });
      }
      if (e.hp <= 0) { this.killEnemy(e); continue; }
      e.frostT = Math.max(0, e.frostT - dtReal);
      const dt = e.frostT > 0 ? dtE * 0.6 : dtE;
      e.x += e.kx * dtReal;
      e.y += e.ky * dtReal;
      const decay = Math.exp(-9 * dtReal);
      e.kx *= decay;
      e.ky *= decay;

      const toP = Math.atan2(p.y - e.y, p.x - e.x);
      const d = dist(e.x, e.y, p.x, p.y);
      e.cd -= dt;

      switch (e.kind) {
        case 'grunt': case 'swarm': case 'brute':
          e.x += Math.cos(toP) * e.speed * dt;
          e.y += Math.sin(toP) * e.speed * dt;
          break;
        case 'archer':
          if (d > 280) { e.x += Math.cos(toP) * e.speed * dt; e.y += Math.sin(toP) * e.speed * dt; }
          else if (d < 200) { e.x -= Math.cos(toP) * e.speed * dt; e.y -= Math.sin(toP) * e.speed * dt; }
          if (e.cd <= 0) { e.cd = 1.9; this.enemyShot(e.x, e.y, toP, 210, e.dmg); }
          break;
        case 'charger':
          this.updateCharger(e, dt, toP);
          break;
        case 'boss':
          this.updateBoss(e, dt, toP);
          break;
      }
      if (e.dead) continue;

      // 간단한 겹침 해소
      for (const o of this.enemies) {
        if (o === e || o.dead || o.spawnT > 0) continue;
        const dd = dist(e.x, e.y, o.x, o.y);
        const min = e.r + o.r;
        if (dd > 0 && dd < min) {
          const push = ((min - dd) / 2) * 0.5;
          e.x += ((e.x - o.x) / dd) * push;
          e.y += ((e.y - o.y) / dd) * push;
        }
      }
      e.x = clamp(e.x, WALL + e.r, W - WALL - e.r);
      e.y = clamp(e.y, TOP + e.r, H - WALL - e.r);

      if (d < e.r + p.r) this.hurtPlayer(e.dmg, e);
    }
  }

  private updateCharger(e: Enemy, dt: number, toP: number) {
    if (e.state === 0) {
      e.x += Math.cos(toP) * e.speed * dt;
      e.y += Math.sin(toP) * e.speed * dt;
      if (e.cd <= 0) { e.state = 1; e.st = 0.7; e.dx = Math.cos(toP); e.dy = Math.sin(toP); }
    } else if (e.state === 1) {
      e.st -= dt;
      if (e.st <= 0) { e.state = 2; e.st = 0.55; }
    } else if (e.state === 2) {
      e.st -= dt;
      e.x += e.dx * 380 * dt;
      e.y += e.dy * 380 * dt;
      if (e.st <= 0) { e.state = 3; e.st = 0.6; }
    } else {
      e.st -= dt;
      if (e.st <= 0) { e.state = 0; e.cd = rand(1.2, 2.2); }
    }
  }

  private updateBoss(e: Enemy, dt: number, toP: number) {
    const bdmg = 10 + this.room * 0.4 + e.tier * 2;
    if (e.state === 0) {
      e.x += Math.cos(toP) * e.speed * dt;
      e.y += Math.sin(toP) * e.speed * dt;
      if (e.spiralT > 0) {
        e.spiralT -= dt;
        e.st -= dt;
        if (e.st <= 0) {
          e.st = 0.1;
          const a = e.pattern * 0.5;
          e.pattern++;
          for (let k = 0; k < 2; k++) this.enemyShot(e.x, e.y, a + k * Math.PI, 190, bdmg);
        }
      }
      if (e.cd <= 0 && e.spiralT <= 0) {
        e.cd = 2.2 - e.tier * 0.25;
        const choice = Math.floor(Math.random() * (e.tier >= 3 ? 4 : e.tier >= 2 ? 3 : 2));
        if (choice !== 2 || e.tier < 2) {
          e.act++;
          e.actKind = choice === 2 ? 'summon' : 'attack';
        }
        if (choice === 0) {
          const n = 10 + e.tier * 4;
          const off = rand(0, Math.PI);
          for (let i = 0; i < n; i++) this.enemyShot(e.x, e.y, off + (i * Math.PI * 2) / n, 170, bdmg);
        } else if (choice === 1) {
          const n = 3 + e.tier * 2;
          for (let i = 0; i < n; i++) this.enemyShot(e.x, e.y, toP + (i - (n - 1) / 2) * 0.16, 260, bdmg);
        } else if (choice === 2) {
          if (e.tier >= 2) { e.state = 1; e.st = 0.8; e.dx = Math.cos(toP); e.dy = Math.sin(toP); }
          else this.summon(e, 'grunt', 3);
        } else {
          e.spiralT = 2.2;
          e.st = 0;
        }
      }
    } else if (e.state === 1) {
      e.st -= dt;
      if (e.st <= 0) { e.state = 2; e.st = 0.7; }
    } else if (e.state === 2) {
      e.st -= dt;
      e.x += e.dx * 420 * dt;
      e.y += e.dy * 420 * dt;
      if (e.st <= 0) { e.state = 0; }
    }
  }

  private summon(e: Enemy, kind: EnemyKind, n: number) {
    const hpMul = 1 + 0.12 * (this.room - 1);
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      this.enemies.push(this.makeEnemy(kind, clamp(e.x + Math.cos(a) * 80, WALL + 20, W - WALL - 20),
        clamp(e.y + Math.sin(a) * 80, TOP + 20, H - WALL - 20), hpMul));
    }
  }

  private enemyShot(x: number, y: number, a: number, speed: number, dmg: number) {
    this.projs.push({
      x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: 6, dmg, life: 6,
      friendly: false, pierce: 0, bounce: 0, hit: new Set(), color: '#ff7a7a',
    });
  }

  private updateProjs(dtReal: number, dtEnemy: number) {
    const p = this.p;
    const turn = this.m.homing > 0 ? (this.has('tracking') ? 8 : 3) * Math.min(3, this.m.homing) : 0;
    for (const q of this.projs) {
      const dt = q.friendly ? dtReal : dtEnemy;
      if (q.friendly && turn > 0 && !q.proc) {
        // 유도: 가까운 적 쪽으로 진행 방향을 조금씩 튼다.
        let best: Enemy | null = null;
        let bd = 260;
        for (const e of this.enemies) {
          if (e.dead || e.spawnT > 0 || q.hit.has(e.id)) continue;
          const d = dist(q.x, q.y, e.x, e.y);
          if (d < bd) { bd = d; best = e; }
        }
        if (best) {
          const sp = Math.hypot(q.vx, q.vy);
          const cur = Math.atan2(q.vy, q.vx);
          const want = Math.atan2(best.y - q.y, best.x - q.x);
          let diff = want - cur;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const a = cur + clamp(diff, -turn * dt, turn * dt);
          q.vx = Math.cos(a) * sp;
          q.vy = Math.sin(a) * sp;
        }
      }
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.life -= dt;
      const minX = WALL;
      const maxX = W - WALL;
      const minY = TOP - 10;
      const maxY = H - WALL;
      if (q.x < minX || q.x > maxX || q.y < minY || q.y > maxY) {
        if (q.friendly && q.bounce > 0) {
          q.bounce--;
          if (this.has('ricochet')) { q.pierce++; q.dmg *= 1.2; }
          if (q.x < minX || q.x > maxX) { q.vx = -q.vx; q.x = clamp(q.x, minX, maxX); }
          if (q.y < minY || q.y > maxY) { q.vy = -q.vy; q.y = clamp(q.y, minY, maxY); }
          q.hit.clear();
        } else {
          q.life = 0;
        }
      }
      if (q.life <= 0) continue;

      if (q.friendly) {
        for (const e of this.enemies) {
          if (e.dead || e.spawnT > 0 || q.hit.has(e.id)) continue;
          if (dist(q.x, q.y, e.x, e.y) < q.r + e.r) {
            q.hit.add(e.id);
            this.hurtEnemy(e, q.dmg, true, q.proc);
            if (q.boom) this.blast(q.x, q.y, 40, 10 * this.m.dmg);
            if (q.pierce <= 0) { q.life = 0; break; }
            q.pierce--;
          }
        }
      } else if (dist(q.x, q.y, p.x, p.y) < q.r + p.r) {
        q.life = 0;
        this.hurtPlayer(q.dmg, null);
      }
    }
    this.projs = this.projs.filter((q) => q.life > 0);
  }

  // ---------- 피해 ----------

  /**
   * 적에게 피해를 준다. proc=true는 다른 효과(번개, 폭발, 파편)에서 온 피해로,
   * 상태이상과 흡혈은 적용되지만 번개처럼 연쇄를 다시 일으키지는 않는다.
   */
  private hurtEnemy(e: Enemy, base: number, fromPlayer: boolean, proc = false) {
    if (e.dead) return;
    let d = base;
    let crit = false;
    if (fromPlayer && Math.random() < this.m.crit + this.gs.crit) { d *= this.has('execute') ? 3 : 2; crit = true; }
    e.hp -= d;
    e.flash = 0.1;
    if (fromPlayer) {
      const a = Math.atan2(e.y - this.p.y, e.x - this.p.x);
      this.burst(e.x, e.y, crit ? 8 : 4, crit ? '#ffd24a' : '#fff1c8', crit ? 260 : 180, { dir: a, spread: 0.9, size: 2, life: 0.25 });
    }
    this.fx.push({
      kind: 'text', x: e.x + rand(-8, 8), y: e.y - e.r, t: 0, life: 0.5,
      text: String(Math.round(d)), color: crit ? '#ffd24a' : '#ffffff',
    });
    if (fromPlayer) {
      const ls = this.m.lifesteal + this.gs.lifesteal + (this.has('set:blood') ? 0.05 : 0);
      if (ls > 0) this.heal(d * ls);
      if (this.m.burn > 0) { e.burnT = 3; e.burnDps = 3 * this.m.burn; }
      if (this.m.poison > 0) { e.poisonStacks = Math.min(5, e.poisonStacks + 1); e.poisonT = 3; }
      if (this.m.frost > 0) e.frostT = Math.max(e.frostT, 1 + 0.5 * this.m.frost);
      if (!proc && this.m.chain > 0) {
        const sc = this.has('superconduct') && e.frostT > 0;
        const chance = sc ? 1 : Math.min(0.5, 0.15 * this.m.chain);
        if (Math.random() < chance) this.chainLightning(e, base * 0.6, 2 + (sc ? 1 : 0));
      }
    }
    if (e.hp <= 0) this.killEnemy(e, proc);
  }

  /** 범위 폭발(효과 피해) */
  private blast(x: number, y: number, R: number, dmg: number) {
    this.fx.push({ kind: 'ring', x, y, t: 0, life: 0.25, r: R, color: '#ffb35c' });
    this.burst(x, y, 6, '#ffb35c', 140, { size: 3, life: 0.3 });
    for (const o of this.enemies) {
      if (o.dead || o.spawnT > 0) continue;
      if (dist(o.x, o.y, x, y) < R + o.r) this.hurtEnemy(o, dmg, true, true);
    }
  }

  private killEnemy(e: Enemy, proc = false) {
    if (e.dead) return;
    e.dead = true;
    this.kills++;
    this.fx.push({ kind: 'ring', x: e.x, y: e.y, t: 0, life: 0.25, r: e.r + 10, color: e.color });
    this.burst(e.x, e.y, 10 + Math.floor(e.r / 2), e.color, 160, { size: 3, life: 0.5, grav: 120 });
    this.burst(e.x, e.y, 6, 'rgba(120,110,120,0.7)', 40, { size: 5, life: 0.7, grav: -40, glow: false });
    if (e.kind === 'brute') this.shake = Math.max(this.shake, 4);
    if (Math.random() < DROP_CHANCE[e.kind]) this.spawnDrop(e.x, e.y, e.kind === 'boss' ? 2 : 0);
    if (this.m.explode > 0) {
      const fb = this.has('fire_blast');
      this.blast(e.x, e.y, 60 + this.m.explode * 10 + (fb ? 30 : 0), 12 * this.m.explode * this.m.dmg * (fb ? 1.5 : 1));
      if (fb) {
        for (const o of this.enemies) {
          if (!o.dead && dist(o.x, o.y, e.x, e.y) < 100 + o.r) { o.burnT = 3; o.burnDps = Math.max(o.burnDps, 3 * Math.max(1, this.m.burn)); }
        }
      }
    }
    if (!proc && this.m.split > 0) this.shards(e.x, e.y, 3 * this.m.split, this.weapon.dmg * 0.4 * this.dmgMul(), this.has('chain_blast'));
    if (this.has('set:blood')) this.heal(2);
    if (this.has('set:element') && (e.burnT > 0 || e.poisonT > 0)) {
      // 원소술사: 상태이상이 주변으로 옮겨 붙는다.
      for (const o of this.enemies) {
        if (o.dead || o === e || dist(o.x, o.y, e.x, e.y) > 110 + o.r) continue;
        if (e.burnT > 0) { o.burnT = Math.max(o.burnT, 2.5); o.burnDps = Math.max(o.burnDps, e.burnDps); }
        if (e.poisonT > 0) { o.poisonT = Math.max(o.poisonT, 2.5); o.poisonStacks = Math.max(o.poisonStacks, e.poisonStacks); }
      }
      this.fx.push({ kind: 'ring', x: e.x, y: e.y, t: 0, life: 0.35, r: 110, color: '#9ae07a' });
    }
    if (e.kind === 'boss') {
      boss3d().die(this.bossPose(e));
      this.shake = 14;
      this.burst(e.x, e.y, 60, '#ffb35c', 320, { size: 4, life: 0.9, grav: 80 });
      this.bossKills++;
      this.projs = this.projs.filter((q) => q.friendly);
      for (const o of this.enemies) if (!o.dead) o.dead = true; // 소환수 정리
    }
  }

  private hurtPlayer(dmg: number, src: Enemy | null) {
    const p = this.p;
    if (p.invuln > 0 || this.phase !== 'playing') return;
    if (p.shieldT > 0) {
      p.shieldT = 0;
      p.invuln = 0.6;
      this.fx.push({ kind: 'ring', x: p.x, y: p.y, t: 0, life: 0.3, r: 34, color: '#7fd1ff' });
      return;
    }
    // 방어: 방어 수치 a에 대해 a / (a + 15) 비율만큼 피해 감소
    const armor = this.gs.armor;
    const taken = Math.max(1, dmg * (1 - armor / (armor + 15)));
    p.hp -= taken;
    p.invuln = 0.7;
    this.shake = Math.max(this.shake, 7);
    this.hurtFlash = 1;
    this.burst(p.x, p.y - 8, 10, '#ff4a4a', 180, { size: 3, life: 0.4, grav: 200 });
    this.fx.push({ kind: 'text', x: p.x, y: p.y - 20, t: 0, life: 0.6, text: `-${Math.round(taken)}`, color: '#ff6b6b' });
    if (this.m.thorns > 0) {
      const R = 90;
      for (const e of this.enemies) {
        if (e.dead || e.spawnT > 0) continue;
        if (dist(e.x, e.y, p.x, p.y) < R + e.r) {
          const td = 20 * this.m.thorns * this.m.dmg;
          this.hurtEnemy(e, td, true, true);
          if (this.has('blood_thorns')) this.heal(td * 0.5);
        }
      }
      this.fx.push({ kind: 'ring', x: p.x, y: p.y, t: 0, life: 0.25, r: R, color: '#e06666' });
    }
    if (src) {
      const a = Math.atan2(p.y - src.y, p.x - src.x);
      p.x += Math.cos(a) * 18;
      p.y += Math.sin(a) * 18;
    }
    if (p.hp <= 0) {
      p.hp = 0;
      this.finish(false);
    }
  }

  private updateFx(dt: number) {
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter((f) => f.t < f.life).slice(-200);
    for (const b of this.bolts) b.t += dt;
    this.bolts = this.bolts.filter((b) => b.t < b.life);
    for (const q of this.parts) {
      q.life += dt;
      q.vy += q.grav * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vx *= Math.exp(-3 * dt);
      q.vy *= Math.exp(-3 * dt);
    }
    this.parts = this.parts.filter((q) => q.life < q.max).slice(-400);
    this.shake *= Math.exp(-10 * dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.5);
    // 희귀 이상 장비는 반짝인다.
    for (const d of this.drops) {
      if (d.gear.rarity >= 2 && Math.random() < dt * 4) {
        this.burst(d.x + rand(-10, 10), d.y + rand(-12, 6), 1, RARITY[d.gear.rarity].color, 20, { grav: -30, size: 2, life: 0.8 });
      }
    }
  }

  /** 입자 n개를 뿌린다. */
  private burst(
    x: number, y: number, n: number, color: string, speed: number,
    o: { grav?: number; size?: number; life?: number; dir?: number; spread?: number; glow?: boolean } = {},
  ) {
    for (let i = 0; i < n; i++) {
      const a = o.dir !== undefined ? o.dir + rand(-(o.spread ?? 0.6), o.spread ?? 0.6) : rand(0, Math.PI * 2);
      const v = speed * rand(0.4, 1);
      this.parts.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: (o.life ?? 0.45) * rand(0.7, 1.2),
        size: o.size ?? 3, color, grav: o.grav ?? 0, glow: o.glow ?? true,
      });
    }
  }

  // ---------- 렌더 ----------

  render() {
    const c = this.ctx;
    const theme = themeForRoom(this.room);
    c.clearRect(0, 0, W, H);
    c.save();
    if (this.shake > 0.3) c.translate(rand(-1, 1) * this.shake, rand(-1, 1) * this.shake);
    const bg = buildRoom(W, H, TOP, WALL, theme, this.room);
    if (bg) {
      c.drawImage(bg, 0, 0);
      drawWallAnim(c, this.time, TOP, theme);
    } else {
      c.fillStyle = '#14151c';
      c.fillRect(0, 0, W, H);
    }

    if (this.phase === 'cleared' || this.phase === 'exiting' || this.phase === 'reward') {
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 4);
      c.fillStyle = `rgba(255, 230, 140, ${0.12 + 0.12 * pulse})`;
      c.beginPath();
      c.ellipse(EXIT.x, EXIT.y + 4, 34, 22, 0, 0, Math.PI * 2);
      c.fill();
      drawSprite(c, 'ladder', EXIT.x, EXIT.y, 3);
    }

    if (this.chest) this.renderChest(c, this.chest);

    for (const d of this.drops) {
      const bob = Math.sin(d.t * 3) * 3;
      const col = RARITY[d.gear.rarity].color;
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.beginPath();
      c.ellipse(d.x, d.y + 12, 10, 3, 0, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 0.35;
      c.fillStyle = col;
      c.beginPath();
      c.arc(d.x, d.y + bob, 15, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 1;
      drawIcon(c, d.gear.base.sprite, d.x, d.y + bob, 24);
    }

    for (const t of this.turrets) {
      drawSprite(c, 'w_bow', t.x, t.y, 1.6);
      c.fillStyle = 'rgba(255, 217, 102, 0.8)';
      c.fillRect(t.x - 14, t.y + 26, 28 * (t.t / 8), 3);
    }

    for (const e of this.enemies) {
      if (e.spawnT > 0) {
        // 소환 마법진: 점선 원이 돌며 좁혀진다
        const k = Math.max(0, e.spawnT);
        c.save();
        c.translate(e.x, e.y + e.r * 0.6);
        c.scale(1, 0.45);
        c.rotate(this.time * 3);
        c.strokeStyle = `rgba(255, 70, 70, ${0.9 - k * 0.4})`;
        c.lineWidth = 3;
        c.setLineDash([8, 6]);
        c.beginPath();
        c.arc(0, 0, e.r + 10 + k * 18, 0, Math.PI * 2);
        c.stroke();
        c.setLineDash([]);
        c.fillStyle = 'rgba(255, 40, 40, 0.18)';
        c.beginPath();
        c.arc(0, 0, e.r + 6, 0, Math.PI * 2);
        c.fill();
        c.restore();
        // 3D 보스는 마법진 위로 땅에서 기어 나온다.
        if (e.kind === 'boss') boss3d().draw(c, this.bossPose(e), this.time);
        continue;
      }
      const key = e.kind === 'boss' ? BOSS_SPRITE[e.tier] : ENEMY_SPRITE[e.kind];
      const scale = e.kind === 'boss' ? (e.r * 3.2) / S[key].w : clamp((e.r * 3.2) / S[key].w, 2, 3.2);
      const feet = e.y + e.r;
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.beginPath();
      c.ellipse(e.x, feet, e.r * 0.9, e.r * 0.3, 0, 0, Math.PI * 2);
      c.fill();
      const aura = e.frostT > 0 ? 'rgba(140, 210, 255, 0.4)' : e.burnT > 0 ? 'rgba(255, 140, 50, 0.35)' : e.poisonT > 0 ? 'rgba(130, 220, 100, 0.3)' : '';
      if (aura) {
        c.fillStyle = aura;
        c.beginPath();
        c.arc(e.x, e.y, e.r + 4, 0, Math.PI * 2);
        c.fill();
      }
      const drawn3d = e.kind === 'boss' && boss3d().draw(c, this.bossPose(e), this.time);
      if (!drawn3d) {
        drawSprite(c, key, e.x, feet, scale, {
          anchor: 'feet',
          frame: animFrame(key, this.time + e.id * 0.37, e.state !== 1),
          flip: this.p.x < e.x,
          flash: e.flash > 0 || e.state === 1,
        });
      }
      if (e.kind !== 'boss' && e.hp < e.maxHp) {
        const top = feet - S[key].h * scale - 6;
        c.fillStyle = '#000a';
        c.fillRect(e.x - e.r, top, e.r * 2, 3);
        c.fillStyle = '#7bd88f';
        c.fillRect(e.x - e.r, top, (e.r * 2 * Math.max(0, e.hp)) / e.maxHp, 3);
      }
    }

    boss3d().drawCorpse(c, this.time);

    for (const q of this.projs) {
      if (q.glow) {
        c.fillStyle = q.glow + '55';
        c.beginPath();
        c.arc(q.x, q.y, 9, 0, Math.PI * 2);
        c.fill();
      }
      if (q.sprite !== undefined) {
        // 무기 스프라이트는 위쪽을 향하므로 진행 방향에 맞춰 90도 보정한다.
        drawSprite(c, q.sprite, q.x, q.y, 1.6, { rot: Math.atan2(q.vy, q.vx) + Math.PI / 2 });
        continue;
      }
      if (q.friendly && q.r >= 8) {
        c.fillStyle = 'rgba(180, 160, 255, 0.35)';
        c.beginPath();
        c.arc(q.x, q.y, q.r * 1.8, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = q.color;
      c.beginPath();
      c.arc(q.x, q.y, q.r, 0, Math.PI * 2);
      c.fill();
    }

    const p = this.p;
    for (let i = 0; i < this.m.orbit; i++) {
      const a = p.orbitA + (i * Math.PI * 2) / this.m.orbit;
      const R = this.has('fire_wheel') ? 72 : 58;
      if (this.has('fire_wheel')) {
        c.fillStyle = 'rgba(255, 140, 40, 0.35)';
        c.beginPath();
        c.arc(p.x + Math.cos(a) * R, p.y + Math.sin(a) * R, 14, 0, Math.PI * 2);
        c.fill();
      }
      drawSprite(c, 'w_knight', p.x + Math.cos(a) * R, p.y + Math.sin(a) * R, 1.2, { rot: a + Math.PI });
    }
    c.globalAlpha = p.invuln > 0 && Math.floor(p.invuln * 20) % 2 === 0 ? 0.4 : 1;
    const facingLeft = Math.cos(p.aim) < 0;
    // 공중에 뜬 높이: 출구 점프, 또는 새 방에 떨어져 내려오는 중
    const drop = this.enterT > 0 ? (this.enterT / ENTER_T) ** 2 * 140 : 0;
    const air = this.hop + drop;
    const shadowK = 1 - Math.min(0.6, air / 120);
    if (this.sink <= 0) {
      c.fillStyle = `rgba(0,0,0,${0.3 * shadowK})`;
      c.beginPath();
      c.ellipse(p.x, p.y + p.r, 11 * shadowK, 4 * shadowK, 0, 0, Math.PI * 2);
      c.fill();
    }
    if (this.sink > 0) {
      // 구멍 가장자리 아래로 내려간 부분은 보이지 않게 자른다.
      c.save();
      c.beginPath();
      c.rect(0, 0, W, EXIT.y + 3);
      c.clip();
    }
    drawSprite(c, this.char.sprite, p.x, p.y + p.r - air + this.sink, 2.5, {
      anchor: 'feet',
      frame: animFrame(this.char.sprite, this.time, p.moving || p.dashT > 0, 10),
      flip: facingLeft,
    });
    if (this.sink > 0) c.restore();
    if (this.phase !== 'exiting' && this.enterT <= 0) this.renderWeapon(c);
    c.globalAlpha = 1;
    if (p.rageT > 0) {
      c.strokeStyle = 'rgba(255, 80, 60, 0.7)';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(p.x, p.y, p.r + 10, 0, Math.PI * 2);
      c.stroke();
    }
    if (p.shieldT > 0) {
      c.strokeStyle = '#7fd1ff';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(p.x, p.y, p.r + 7, 0, Math.PI * 2);
      c.stroke();
    }

    for (const f of this.fx) {
      if (f.kind === 'text') continue;
      const k = f.t / f.life;
      c.globalAlpha = 1 - k;
      if (f.kind === 'ring') {
        c.strokeStyle = f.color;
        c.lineWidth = 3;
        c.beginPath();
        c.arc(f.x, f.y, (f.r ?? 20) * (0.4 + 0.6 * k), 0, Math.PI * 2);
        c.stroke();
      }
      c.globalAlpha = 1;
    }

    this.renderLighting(c, theme.dark, theme.glow);

    // 연쇄 번개
    c.globalCompositeOperation = 'lighter';
    for (const b of this.bolts) {
      c.globalAlpha = 1 - b.t / b.life;
      for (const [w, col] of [[6, 'rgba(255, 220, 80, 0.35)'], [2, '#fff8c0']] as [number, string][]) {
        c.strokeStyle = col;
        c.lineWidth = w;
        c.beginPath();
        c.moveTo(b.pts[0].x, b.pts[0].y);
        for (let i = 1; i < b.pts.length; i++) {
          const a = b.pts[i - 1];
          const z = b.pts[i];
          // 꺾인 번개 모양
          for (let k = 1; k <= 4; k++) {
            const tt = k / 4;
            const jx = k < 4 ? rand(-10, 10) : 0;
            const jy = k < 4 ? rand(-10, 10) : 0;
            c.lineTo(a.x + (z.x - a.x) * tt + jx, a.y + (z.y - a.y) * tt + jy);
          }
        }
        c.stroke();
      }
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';

    // 입자(빛나는 입자는 가산 혼합)
    for (const q of this.parts) {
      const k = q.life / q.max;
      c.globalAlpha = 1 - k;
      c.globalCompositeOperation = q.glow ? 'lighter' : 'source-over';
      c.fillStyle = q.color;
      const sz = q.size * (q.glow ? 1 : 1 + k);
      c.fillRect(q.x - sz / 2, q.y - sz / 2, sz, sz);
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';

    // 피해 숫자: 위로 튀었다가 사라진다
    c.textAlign = 'center';
    c.strokeStyle = 'rgba(0,0,0,0.85)';
    for (const f of this.fx) {
      if (f.kind !== 'text') continue;
      const k = f.t / f.life;
      const lift = f.big ? 0 : Math.sin(Math.min(1, k * 2) * Math.PI / 2) * 18;
      c.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      // 숫자는 픽셀 글꼴, 한글 문구는 한글 글꼴
      const numeric = /^[-+\d]+$/.test(f.text ?? '');
      const latin = /^[A-Z0-9 ]+$/.test(f.text ?? '');
      c.font = f.big ? (latin ? '30px "Press Start 2P", monospace' : this.font(34)) : numeric ? '10px "Press Start 2P", monospace' : this.font(17);
      c.lineWidth = f.big ? 7 : 3;
      c.strokeText(f.text ?? '', f.x, f.y - lift);
      c.fillStyle = f.color;
      c.fillText(f.text ?? '', f.x, f.y - lift);
    }
    c.globalAlpha = 1;
    c.restore();

    // 체력이 낮거나 맞았을 때 화면 가장자리가 붉게
    const low = this.p.hp / this.p.maxHp < 0.3 ? 0.35 + 0.15 * Math.sin(this.time * 6) : 0;
    const red = Math.max(low, this.hurtFlash * 0.45);
    if (red > 0.01) {
      const v = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85);
      v.addColorStop(0, 'rgba(200, 0, 0, 0)');
      v.addColorStop(1, `rgba(200, 0, 0, ${red})`);
      c.fillStyle = v;
      c.fillRect(0, 0, W, H);
    }

    this.renderHud();

    if (this.fade > 0) {
      c.fillStyle = `rgba(0, 0, 0, ${this.fade})`;
      c.fillRect(0, 0, W, H);
    }
  }

  private renderLighting(c: CanvasRenderingContext2D, dark: number, glow: [number, number, number]) {
    const p = this.p;
    const lights: Light[] = [{ x: p.x, y: p.y - 10, r: 250 + Math.sin(this.time * 3) * 6 }];
    const colored: (Light & { rgb: [number, number, number]; a: number })[] = [];
    for (const [i, x] of FOUNTAIN_X.entries()) {
      const flick = 0.9 + 0.1 * Math.sin(this.time * 9 + i * 2);
      lights.push({ x, y: TOP + 10, r: 170 * flick });
      colored.push({ x, y: TOP - 10, r: 150 * flick, rgb: glow, a: 0.28 });
    }
    for (const q of this.projs) {
      if (q.friendly && q.r >= 8) {
        lights.push({ x: q.x, y: q.y, r: 70 });
        colored.push({ x: q.x, y: q.y, r: 50, rgb: q.color === '#7ee08a' ? [120, 230, 140] : [170, 140, 255], a: 0.3 });
      } else if (!q.friendly) {
        colored.push({ x: q.x, y: q.y, r: 18, rgb: [255, 80, 80], a: 0.35 });
      }
    }
    for (const d of this.drops) {
      lights.push({ x: d.x, y: d.y, r: 50 });
      if (d.gear.rarity >= 1) {
        const hex = RARITY[d.gear.rarity].color;
        const rgb: [number, number, number] = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
        colored.push({ x: d.x, y: d.y, r: 40, rgb, a: 0.3 });
      }
    }
    if (this.chest) {
      lights.push({ x: this.chest.x, y: this.chest.y, r: 90 });
      if (!this.chest.looted) colored.push({ x: this.chest.x, y: this.chest.y, r: 70, rgb: [255, 200, 90], a: 0.25 });
    }
    if (this.phase === 'cleared' || this.phase === 'exiting' || this.phase === 'reward') {
      lights.push({ x: EXIT.x, y: EXIT.y, r: 140 });
      colored.push({ x: EXIT.x, y: EXIT.y, r: 90, rgb: [255, 220, 130], a: 0.3 });
    }
    for (const e of this.enemies) {
      if (e.kind === 'boss' && !e.dead) colored.push({ x: e.x, y: e.y, r: 120, rgb: [255, 60, 60], a: 0.12 });
    }
    drawLighting(c, W, H, dark, lights, colored);
  }

  /** 장착 무기를 휘두르는 모습.  /** 장착 무기를 휘두르는 모습. 손잡이를 축으로 회전시킨다. */
  private renderWeapon(c: CanvasRenderingContext2D) {
    const p = this.p;
    const b = this.weapon.base;
    const swinging = p.swingT > 0;
    const t = swinging ? 1 - p.swingT / p.swingDur : 1;
    const hx = p.x;
    const hy = p.y - 8;
    let ang = p.aim;
    let reach = 10;

    if (b.wkind === 'slash' || b.wkind === 'smash' || b.wkind === 'staff') {
      const arc = b.wkind === 'staff' ? 1.2 : Math.max(b.arc, 1.4);
      const k = b.wkind === 'smash' ? t * t : easeOut(t);
      const base = swinging ? p.swingAim : p.aim;
      ang = base + p.swingDir * (-arc / 2 + arc * k);
      if (!swinging) ang = p.aim + p.swingDir * 0.5; // 대기 자세: 조준 방향 옆으로 든다
      if (swinging && b.wkind !== 'staff') {
        // 휘두른 궤적
        const r = (b.range + this.m.extra * 16) * 0.8;
        const a0 = p.swingAim - p.swingDir * arc / 2;
        const ec = this.elementColor();
        c.globalAlpha = 0.35 * (1 - t * 0.5) * (ec ? 1.6 : 1);
        c.strokeStyle = ec ?? '#ffffff';
        c.lineWidth = b.wkind === 'smash' ? 14 : 9;
        c.beginPath();
        c.arc(hx, hy, r, Math.min(a0, ang), Math.max(a0, ang));
        c.stroke();
        c.globalAlpha = 1;
      }
    } else if (b.wkind === 'thrust') {
      reach += swinging ? Math.sin(t * Math.PI) * 26 : 0;
    } else {
      reach = 18 + (swinging ? -Math.sin(t * Math.PI) * 5 : 0);
    }

    const px = hx + Math.cos(ang) * reach;
    const py = hy + Math.sin(ang) * reach;
    if (b.wkind === 'bow') {
      drawSprite(c, b.sprite, px, py, 1.7, { rot: ang });
    } else {
      drawSprite(c, b.sprite, px, py, 1.6, { anchor: 'feet', rot: ang + Math.PI / 2 });
    }
  }

  private font(size: number, bold = false) {
    return `${bold ? 'bold ' : ''}${size}px "Do Hyeon","Noto Sans KR","Malgun Gothic",sans-serif`;
  }

  /** 가까운 드랍 장비의 정보와 현재 장착 장비 비교 */
  private renderChest(c: CanvasRenderingContext2D, ch: { x: number; y: number; openT: number; looted: boolean }) {
    const ready = this.phase === 'cleared' && ch.openT < 0;
    c.fillStyle = 'rgba(0,0,0,0.4)';
    c.beginPath();
    c.ellipse(ch.x, ch.y + 22, 26, 7, 0, 0, Math.PI * 2);
    c.fill();
    if (ready) {
      // 열 수 있게 되면 금빛으로 맥동한다.
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 5);
      c.fillStyle = `rgba(255, 210, 122, ${0.18 + 0.2 * pulse})`;
      c.beginPath();
      c.arc(ch.x, ch.y, 34 + pulse * 4, 0, Math.PI * 2);
      c.fill();
    }
    const lift = ready ? Math.abs(Math.sin(this.time * 5)) * -2 : 0;
    if (ch.openT < 0) {
      drawSprite(c, 'chest', ch.x, ch.y + lift, 3);
      if (this.phase === 'playing') {
        // 잠김 표시: 자물쇠
        const lx = ch.x + 18;
        const ly = ch.y + 10;
        c.strokeStyle = '#000';
        c.lineWidth = 6;
        c.beginPath();
        c.arc(lx, ly - 2, 6, Math.PI, 0);
        c.stroke();
        c.strokeStyle = '#c8c0b0';
        c.lineWidth = 3;
        c.stroke();
        c.fillStyle = '#000';
        c.fillRect(lx - 10, ly - 3, 20, 16);
        c.fillStyle = '#9a9288';
        c.fillRect(lx - 8, ly - 1, 16, 12);
        c.fillStyle = '#2a2024';
        c.fillRect(lx - 1, ly + 2, 2, 6);
      }
    } else {
      const f = Math.min(2, Math.floor((ch.openT / CHEST_OPEN_T) * 3));
      drawSprite(c, 'chest_full', ch.x, ch.y, 3, { frame: f });
    }
    if (this.nearChest && ready) {
      c.textAlign = 'center';
      c.font = this.font(15);
      c.lineWidth = 4;
      c.strokeStyle = 'rgba(0,0,0,0.85)';
      c.strokeText('E 상자 열기', ch.x, ch.y - 34);
      c.fillStyle = '#ffe9a0';
      c.fillText('E 상자 열기', ch.x, ch.y - 34);
    }
  }

  private bossPose(e: Enemy): BossPose {
    const dash = e.state === 2;
    return {
      x: e.x, y: e.y + e.r, r: e.r, tier: e.tier, spawnT: e.spawnT, state: e.state, spiralT: e.spiralT, flash: e.flash,
      faceX: dash ? e.dx : this.p.x - e.x, faceY: dash ? e.dy : this.p.y - e.y,
      act: e.act, actKind: e.actKind,
    };
  }

  private renderTooltip(c: CanvasRenderingContext2D) {
    const d = this.near;
    if (!d) return;
    const g = d.gear;
    const cur = this.equip[g.base.slot];
    const rows: { text: string; color: string; size: number; bold?: boolean }[] = [
      { text: gearTitle(g), color: RARITY[g.rarity].color, size: 14, bold: true },
      ...gearLines(g).map((t) => ({ text: t, color: '#e8eaf6', size: 12 })),
    ];
    if (cur) {
      rows.push({ text: `현재: ${gearTitle(cur)}`, color: '#8d93b0', size: 12, bold: true });
      rows.push(...gearLines(cur).map((t) => ({ text: t, color: '#8d93b0', size: 11 })));
    }
    rows.push({ text: '[E] 장착 (현재 장비는 바닥에 놓임)', color: '#ffd54f', size: 12, bold: true });
    c.textAlign = 'left';
    let w = 0;
    for (const r of rows) {
      c.font = this.font(r.size, r.bold);
      w = Math.max(w, c.measureText(r.text).width);
    }
    const lh = 17;
    const bw = w + 20;
    const bh = rows.length * lh + 12;
    const bx = clamp(d.x - bw / 2, WALL + 4, W - WALL - bw - 4);
    // 위쪽 공간이 부족하면 장비 아래쪽에 표시한다.
    const above = d.y - 30 - bh;
    const by = clamp(above >= WALL + 4 ? above : d.y + 26, WALL + 4, H - WALL - bh - 4);
    c.fillStyle = 'rgba(12, 13, 20, 0.92)';
    c.fillRect(bx, by, bw, bh);
    c.strokeStyle = RARITY[g.rarity].color;
    c.lineWidth = 1.5;
    c.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
    rows.forEach((r, i) => {
      c.font = this.font(r.size, r.bold);
      c.fillStyle = r.color;
      c.fillText(r.text, bx + 10, by + 20 + i * lh);
    });
  }

  /** HUD용 패널 바탕 */
  private panel(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    c.fillStyle = 'rgba(16, 11, 14, 0.82)';
    c.fillRect(x, y, w, h);
    c.strokeStyle = '#4a3830';
    c.lineWidth = 2;
    c.strokeRect(x + 1, y + 1, w - 2, h - 2);
    c.fillStyle = 'rgba(255, 220, 180, 0.07)';
    c.fillRect(x + 2, y + 2, w - 4, 2);
  }

  /** 테두리와 광택이 있는 게이지 */
  private gauge(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, k: number, from: string, to: string) {
    c.fillStyle = '#0a0608';
    c.fillRect(x, y, w, h);
    const g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, from);
    g.addColorStop(1, to);
    c.fillStyle = g;
    c.fillRect(x + 2, y + 2, Math.max(0, (w - 4) * k), h - 4);
    c.fillStyle = 'rgba(255,255,255,0.25)';
    c.fillRect(x + 2, y + 2, Math.max(0, (w - 4) * k), 2);
    c.strokeStyle = '#000';
    c.lineWidth = 1;
    c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  /** 오른쪽 아래 장비 슬롯 */
  private renderGearHud(c: CanvasRenderingContext2D) {
    const size = 38;
    const gap = 5;
    const w = SLOTS.length * (size + gap) - gap + 12;
    const x0 = W - 16 - w;
    const y0 = H - 16 - size - 12;
    this.panel(c, x0, y0, w, size + 12);
    SLOTS.forEach((slot, i) => {
      const x = x0 + 6 + i * (size + gap);
      const y = y0 + 6;
      const g = this.equip[slot];
      c.fillStyle = g ? 'rgba(40, 28, 30, 0.9)' : 'rgba(0,0,0,0.4)';
      c.fillRect(x, y, size, size);
      c.strokeStyle = g ? RARITY[g.rarity].color : 'rgba(255,255,255,0.12)';
      c.lineWidth = 2;
      c.strokeRect(x + 1, y + 1, size - 2, size - 2);
      if (g) {
        drawIcon(c, g.base.sprite, x + size / 2, y + size / 2, 26);
      } else {
        c.fillStyle = 'rgba(255,255,255,0.28)';
        c.font = this.font(11);
        c.textAlign = 'center';
        c.fillText(['무기', '투구', '갑옷', '신발', '장신구'][i], x + size / 2, y + size / 2 + 4);
      }
    });
  }

  private renderHud() {
    const c = this.ctx;
    const p = this.p;
    const theme = themeForRoom(this.room);

    // 왼쪽 위: 초상화, 체력, 스킬
    this.panel(c, 12, 10, 272, 66);
    c.fillStyle = '#0a0608';
    c.fillRect(20, 18, 50, 50);
    c.strokeStyle = '#7a5d48';
    c.lineWidth = 2;
    c.strokeRect(21, 19, 48, 48);
    c.save();
    c.beginPath();
    c.rect(22, 20, 46, 46);
    c.clip();
    drawSprite(c, this.char.sprite, 45, 74, 2.4, { anchor: 'feet', frame: animFrame(this.char.sprite, this.time, false, 5) });
    c.restore();

    const hpK = Math.max(0, p.hp / p.maxHp);
    this.gauge(c, 78, 20, 198, 18, hpK, hpK < 0.3 ? '#ff7a6a' : '#f05a4a', hpK < 0.3 ? '#a01818' : '#8c1c1c');
    c.font = '8px "Press Start 2P", monospace';
    c.textAlign = 'left';
    c.fillStyle = '#fff4e6';
    c.fillText(`HP ${Math.ceil(p.hp)}/${p.maxHp}`, 86, 33);

    const sk = skillById(p.skillId);
    const full = sk.cd * this.skillCdMul();
    const sx = 78;
    const sy = 42;
    c.fillStyle = '#0a0608';
    c.fillRect(sx, sy, 28, 28);
    drawIcon(c, sk.sprite, sx + 14, sy + 14, 22);
    if (p.skillCd > 0) {
      c.fillStyle = 'rgba(0,0,0,0.65)';
      c.beginPath();
      c.moveTo(sx + 14, sy + 14);
      c.arc(sx + 14, sy + 14, 20, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (p.skillCd / full));
      c.closePath();
      c.save();
      c.clip();
      c.fillRect(sx, sy, 28, 28);
      c.restore();
    }
    c.strokeStyle = p.skillCd > 0 ? '#4a3830' : '#ffd27a';
    c.lineWidth = 2;
    c.strokeRect(sx + 1, sy + 1, 26, 26);
    c.font = this.font(15);
    c.fillStyle = p.skillCd > 0 ? '#a8967f' : '#ffe9c8';
    c.fillText(sk.name, sx + 36, sy + 13);
    c.font = '7px "Press Start 2P", monospace';
    c.fillStyle = '#6f6152';
    c.fillText(p.skillCd > 0 ? `${p.skillCd.toFixed(1)}s` : 'SPACE', sx + 36, sy + 25);

    // 위 가운데: 층 이름과 방 진행도
    const pw = 15 * 14 + 24;
    const px0 = W / 2 - pw / 2;
    this.panel(c, px0, 10, pw, 44);
    c.textAlign = 'center';
    c.font = this.font(15);
    c.fillStyle = '#f0a14a';
    c.fillText(theme.name, W / 2, 28);
    for (let i = 1; i <= FINAL_ROOM; i++) {
      const x = px0 + 12 + (i - 1) * 14 + (Math.floor((i - 1) / 5)) * 0;
      const y = 36;
      const boss = i % BOSS_EVERY === 0;
      const done = i < this.room || (i === this.room && this.phase !== 'playing');
      const cur = i === this.room;
      c.fillStyle = done ? '#ffd27a' : cur ? `rgba(240, 161, 74, ${0.55 + 0.45 * Math.sin(this.time * 5)})` : '#2a2024';
      if (boss) {
        c.beginPath();
        c.moveTo(x + 5, y - 1);
        c.lineTo(x + 11, y + 5);
        c.lineTo(x + 5, y + 11);
        c.lineTo(x - 1, y + 5);
        c.closePath();
        c.fill();
        c.strokeStyle = '#c0392b';
        c.lineWidth = 1.5;
        c.stroke();
      } else {
        c.fillRect(x, y, 10, 10);
        c.strokeStyle = isRewardRoom(i) ? '#e8b84a' : '#000';
        c.lineWidth = 1;
        c.strokeRect(x + 0.5, y + 0.5, 9, 9);
        if (isRewardRoom(i)) {
          // 보상 방 표시: 가운데 작은 보석
          c.fillStyle = done ? '#7a4a12' : '#e8b84a';
          c.fillRect(x + 3, y + 3, 4, 4);
        }
      }
    }

    // 오른쪽 위: 방 번호와 처치 수
    this.panel(c, W - 16 - 150, 10, 150, 44);
    c.textAlign = 'right';
    c.font = '10px "Press Start 2P", monospace';
    c.fillStyle = '#ffd27a';
    c.fillText(`ROOM ${this.room}/${FINAL_ROOM}`, W - 28, 30);
    drawSprite(c, 'skull', W - 150, 42, 1.6);
    c.font = this.font(15);
    c.fillStyle = '#d8c8b0';
    c.fillText(`처치 ${this.kills}`, W - 28, 47);

    // 왼쪽 아래: 획득 아이템 아이콘
    if (this.itemCounts.size > 0) {
      const n = this.itemCounts.size;
      const iw = n * 34 + 8;
      this.panel(c, 16, H - 16 - 46, iw, 46);
      let x = 24;
      for (const [id, cnt] of this.itemCounts) {
        drawIcon(c, itemById(id).sprite, x + 15, H - 16 - 23, 24);
        if (cnt > 1) {
          c.font = '8px "Press Start 2P", monospace';
          c.textAlign = 'right';
          c.lineWidth = 3;
          c.strokeStyle = '#000';
          c.strokeText(`${cnt}`, x + 32, H - 16 - 8);
          c.fillStyle = '#ffd27a';
          c.fillText(`${cnt}`, x + 32, H - 16 - 8);
        }
        x += 34;
      }
    }

    // 발동 중인 시너지 (아이템 칸 위)
    if (this.syn.size > 0) {
      c.font = this.font(14);
      c.textAlign = 'left';
      let x = 16;
      const y = H - 16 - 46 - 26;
      for (const id of this.syn) {
        const name = SYN_NAME.get(id) ?? id;
        const isSet = id.startsWith('set:');
        const tw = c.measureText(name).width + 16;
        c.fillStyle = 'rgba(16, 11, 14, 0.85)';
        c.fillRect(x, y, tw, 20);
        c.strokeStyle = isSet ? TAG_INFO[id.slice(4) as Tag].color : '#ffb35c';
        c.lineWidth = 1.5;
        c.strokeRect(x + 0.5, y + 0.5, tw - 1, 19);
        c.fillStyle = isSet ? TAG_INFO[id.slice(4) as Tag].color : '#ffcf8a';
        c.fillText(name, x + 8, y + 15);
        x += tw + 6;
      }
    }

    // 보스 체력
    const boss = this.enemies.find((e) => e.kind === 'boss' && !e.dead && e.spawnT <= 0);
    if (boss) {
      const bw = 440;
      const bx = W / 2 - bw / 2;
      const by = TOP + 14;
      this.panel(c, bx - 8, by - 6, bw + 16, 40);
      c.textAlign = 'center';
      c.font = this.font(16);
      c.fillStyle = '#ff9a7a';
      c.fillText(BOSS_NAME[boss.tier], W / 2, by + 10);
      this.gauge(c, bx, by + 16, bw, 12, Math.max(0, boss.hp / boss.maxHp), '#e04a3a', '#701010');
    }

    this.renderGearHud(c);
    if (this.phase === 'cleared') {
      c.textAlign = 'center';
      c.font = this.font(17);
      c.lineWidth = 4;
      c.strokeStyle = 'rgba(0,0,0,0.8)';
      const msg = this.room >= FINAL_ROOM
        ? '사다리에 올라 던전을 탈출하세요'
        : this.chest && !this.chest.looted
          ? '보물 상자의 잠금이 풀렸습니다! 상자 앞에서 E를 누르세요'
          : '장비를 정리하고 위쪽 사다리로 이동하세요';
      c.strokeText(msg, W / 2, EXIT.y + 50);
      c.fillStyle = '#ffe9a0';
      c.fillText(msg, W / 2, EXIT.y + 50);
    }
    this.renderTooltip(c);

    if (this.bannerT > 0) {
      // 방 입장 배너: 가운데 띠 + 픽셀 글자
      const a = Math.min(1, this.bannerT);
      const isBoss = this.room % BOSS_EVERY === 0;
      c.globalAlpha = a;
      const g = c.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.5, isBoss ? 'rgba(90, 10, 10, 0.75)' : 'rgba(10, 6, 8, 0.7)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(0, 150, W, 86);
      c.textAlign = 'center';
      c.font = '26px "Press Start 2P", monospace';
      c.lineWidth = 6;
      c.strokeStyle = '#000';
      const title = isBoss ? `BOSS ROOM ${this.room}` : `ROOM ${this.room}`;
      c.strokeText(title, W / 2, 196);
      c.fillStyle = isBoss ? '#ff7a5a' : '#ffd27a';
      c.fillText(title, W / 2, 196);
      c.font = this.font(18);
      c.fillStyle = '#d8c8b0';
      c.fillText(isBoss ? BOSS_NAME[Math.floor(this.room / BOSS_EVERY)] + '이(가) 깨어났다' : theme.name, W / 2, 224);
      c.globalAlpha = 1;
    }
  }
}
