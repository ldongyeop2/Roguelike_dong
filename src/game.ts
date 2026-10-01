import {
  ITEMS, SKILLS, baseMods, charById, itemById, skillById,
  type CharDef, type Mods,
} from './content';
import type { Input } from './input';
import type { RunResult } from './meta';
import { background, drawSprite } from './sprites';
import { angDiff, clamp, dist, rand, shuffle } from './util';

export const W = 960;
export const H = 640;
const WALL = 28;
const FINAL_ROOM = 15;
const BOSS_EVERY = 5;

type EnemyKind = 'grunt' | 'archer' | 'charger' | 'swarm' | 'brute' | 'boss';

const ENEMY_SPRITE: Record<Exclude<EnemyKind, 'boss'>, number> = {
  grunt: 110, archer: 121, swarm: 120, charger: 123, brute: 109,
};
const BOSS_SPRITE = [0, 124, 122, 97];
const BOSS_NAME = ['', '파수꾼', '군주', '심연의 왕'];

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
  orbitCd: number;
  flash: number;
  tier: number; // 보스 단계
  pattern: number;
  spiralT: number;
  dead: boolean;
}

interface Proj {
  x: number; y: number; vx: number; vy: number;
  r: number; dmg: number; life: number;
  friendly: boolean;
  pierce: number; bounce: number;
  hit: Set<number>;
  color: string;
  sprite?: number;
}

interface Turret { x: number; y: number; t: number; cd: number }

interface Fx {
  kind: 'ring' | 'arc' | 'text';
  x: number; y: number; t: number; life: number;
  r?: number; a?: number; arc?: number; text?: string; color: string;
}

export interface Card {
  kind: 'item' | 'skill' | 'heal';
  id: string;
  name: string;
  desc: string;
  sprite: number;
}

export interface GameEvents {
  onReward(cards: Card[], room: number): void;
  onEnd(result: RunResult): void;
  onPause(paused: boolean): void;
}

type Phase = 'playing' | 'cleared' | 'reward' | 'ended';

export class Game {
  private ctx: CanvasRenderingContext2D;
  private char: CharDef;
  private m: Mods = baseMods();
  private unlocked: Set<string>;

  private p = {
    x: W / 2, y: H / 2, r: 13, hp: 0, maxHp: 0,
    aim: 0, atkCd: 0, skillCd: 0, skillId: '',
    invuln: 0, dashT: 0, dashX: 0, dashY: 0,
    shieldT: 0, rageT: 0, slowT: 0, orbitA: 0, hpAcc: 0,
  };

  private enemies: Enemy[] = [];
  private projs: Proj[] = [];
  private turrets: Turret[] = [];
  private fx: Fx[] = [];
  private waves: EnemyKind[][] = [];
  private nextId = 1;

  room = 0;
  private phase: Phase = 'playing';
  private clearT = 0;
  private bannerT = 0;
  paused = false;
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
    this.p.maxHp = this.char.hp;
    this.p.hp = this.char.hp;
    this.p.skillId = this.char.skill;
    this.startRoom(1);
  }

  // ---------- 흐름 ----------

  private startRoom(n: number) {
    this.room = n;
    this.phase = 'playing';
    this.enemies = [];
    this.projs = [];
    this.turrets = [];
    this.p.x = W / 2;
    this.p.y = H / 2;
    this.bannerT = 1.6;
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
        y = rand(WALL + 30, H - WALL - 30);
        if (dist(x, y, this.p.x, this.p.y) > 220) break;
      }
      this.enemies.push(this.makeEnemy(kind, x, y, hpMul));
    }
  }

  private makeEnemy(kind: EnemyKind, x: number, y: number, hpMul: number): Enemy {
    const base = {
      id: this.nextId++, x, y, kx: 0, ky: 0, spawnT: 0.9, cd: rand(0.6, 1.6), state: 0, st: 0,
      dx: 0, dy: 0, burnT: 0, burnDps: 0, orbitCd: 0, flash: 0, tier: 0, pattern: 0, spiralT: 0, dead: false,
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
    this.clearT = 1.0;
    this.roomsCleared++;
    this.heal(this.p.maxHp * 0.08);
    this.projs = this.projs.filter((q) => q.friendly);
    this.fx.push({ kind: 'text', x: W / 2, y: H / 2 - 40, t: 0, life: 1.2, text: 'CLEAR', color: '#fff' });
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
      cards.push({ kind: 'heal', id: 'heal', sprite: 115, name: '응급 치료', desc: '최대 체력의 40%를 회복합니다.' });
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
        cards.push({ kind: 'item', id: i.id, sprite: i.sprite, name: i.name, desc: i.desc });
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
      const def = itemById(card.id);
      const before = this.m.maxHp;
      def.apply(this.m);
      const diff = this.m.maxHp - before;
      this.p.maxHp = this.char.hp + this.m.maxHp;
      if (diff > 0) this.p.hp += diff;
      this.p.hp = Math.min(this.p.hp, this.p.maxHp);
      this.itemCounts.set(card.id, (this.itemCounts.get(card.id) ?? 0) + 1);
      this.itemsCollected++;
    }
    this.startRoom(this.room + 1);
  }

  // ---------- 갱신 ----------

  update(dtRaw: number) {
    if (this.input.takePause() && this.phase !== 'ended' && this.phase !== 'reward') {
      this.paused = !this.paused;
      this.ev.onPause(this.paused);
    }
    if (this.paused || this.phase === 'ended') {
      this.input.takeSkill();
      return;
    }
    const dt = Math.min(dtRaw, 1 / 30);

    this.updateFx(dt);
    if (this.phase === 'reward') return;

    if (this.phase === 'cleared') {
      this.clearT -= dt;
      this.updatePlayer(dt);
      if (this.clearT <= 0) {
        if (this.room >= FINAL_ROOM) {
          this.finish(true);
        } else {
          this.phase = 'reward';
          this.ev.onReward(this.rollCards(), this.room);
        }
      }
      return;
    }

    this.bannerT = Math.max(0, this.bannerT - dt);
    const slow = this.p.slowT > 0 ? 0.4 : 1;
    this.updatePlayer(dt);
    this.updateTurrets(dt);
    this.updateEnemies(dt, dt * slow);
    this.updateProjs(dt, dt * slow);
    this.updateOrbit(dt);
    this.enemies = this.enemies.filter((e) => !e.dead);

    if (this.phase === 'playing' && this.enemies.length === 0) {
      if (this.waves.length > 0) this.spawnWave();
      else this.roomCleared();
    }
  }

  private heal(v: number) {
    this.p.hp = Math.min(this.p.maxHp, this.p.hp + v);
  }

  private dmgMul(): number {
    let v = this.m.dmg;
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
    if (this.m.regen > 0) this.heal(this.m.regen * dt);

    if (p.dashT > 0) {
      p.dashT -= dt;
      p.x += p.dashX * 700 * dt;
      p.y += p.dashY * 700 * dt;
    } else {
      const a = this.input.axis();
      const sp = this.char.speed * this.m.speed;
      p.x += a.x * sp * dt;
      p.y += a.y * sp * dt;
    }
    p.x = clamp(p.x, WALL + p.r, W - WALL - p.r);
    p.y = clamp(p.y, WALL + p.r, H - WALL - p.r);

    if (this.input.takeSkill() && p.skillCd <= 0) this.useSkill();

    const rate = this.m.rate * (p.rageT > 0 ? 1.5 : 1);
    if (this.input.down && p.atkCd <= 0 && this.phase === 'playing') {
      p.atkCd = this.char.cd / rate;
      this.fireWeapon();
    }
  }

  private useSkill() {
    const p = this.p;
    const def = skillById(p.skillId);
    p.skillCd = def.cd * this.m.skillCd;
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

  private fireWeapon() {
    const p = this.p;
    const c = this.char;
    const m = this.m;
    const dmg = c.dmg * this.dmgMul();
    const ax = Math.cos(p.aim);
    const ay = Math.sin(p.aim);

    if (c.weapon === 'melee') {
      const range = 82 + m.extra * 16;
      const arc = 1.9;
      for (const e of this.enemies) {
        if (e.spawnT > 0 || e.dead) continue;
        const d = dist(e.x, e.y, p.x, p.y);
        if (d > range + e.r) continue;
        if (angDiff(Math.atan2(e.y - p.y, e.x - p.x), p.aim) > arc / 2) continue;
        this.hurtEnemy(e, dmg, true);
        e.kx += ax * 260;
        e.ky += ay * 260;
      }
      this.projs = this.projs.filter((q) => {
        if (q.friendly) return true;
        const d = dist(q.x, q.y, p.x, p.y);
        return !(d < range && angDiff(Math.atan2(q.y - p.y, q.x - p.x), p.aim) < arc / 2);
      });
      this.fx.push({ kind: 'arc', x: p.x, y: p.y, t: 0, life: 0.14, r: range, a: p.aim, arc, color: c.color });
      return;
    }

    const extra = Math.floor(m.extra);
    let count = 1 + extra;
    let step = 0.12;
    let speed = 520;
    let r = 4;
    let life = 1.2;
    let pierce = m.pierce;
    let color = c.color;
    if (c.weapon === 'pierce') {
      speed = 380; r = 9; life = 1.6; pierce += 2; step = 0.18;
    } else if (c.weapon === 'spread') {
      count = 3 + extra; speed = 480; life = 0.4; step = 0.17; color = '#f0c0e0';
    }
    for (let i = 0; i < count; i++) {
      const a = p.aim + (i - (count - 1) / 2) * step;
      this.projs.push({
        x: p.x + Math.cos(a) * 16, y: p.y + Math.sin(a) * 16,
        vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        r, dmg, life, friendly: true, pierce, bounce: m.bounce, hit: new Set(), color,
        sprite: c.weapon === 'pierce' ? undefined : c.weaponSprite,
      });
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
    this.p.orbitA += dt * 3.2;
    for (let i = 0; i < n; i++) {
      const a = this.p.orbitA + (i * Math.PI * 2) / n;
      const bx = this.p.x + Math.cos(a) * 58;
      const by = this.p.y + Math.sin(a) * 58;
      for (const e of this.enemies) {
        if (e.spawnT > 0 || e.dead || e.orbitCd > 0) continue;
        if (dist(bx, by, e.x, e.y) < e.r + 9) {
          e.orbitCd = 0.4;
          this.hurtEnemy(e, 7 * this.dmgMul(), true);
        }
      }
    }
  }

  // ---------- 적 ----------

  private updateEnemies(dtReal: number, dt: number) {
    const p = this.p;
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.flash = Math.max(0, e.flash - dtReal);
      e.orbitCd = Math.max(0, e.orbitCd - dtReal);
      if (e.spawnT > 0) { e.spawnT -= dtReal; continue; }

      if (e.burnT > 0) {
        e.burnT -= dtReal;
        e.hp -= e.burnDps * dtReal;
        if (e.hp <= 0) { this.killEnemy(e); continue; }
      }
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
      e.y = clamp(e.y, WALL + e.r, H - WALL - e.r);

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
        clamp(e.y + Math.sin(a) * 80, WALL + 20, H - WALL - 20), hpMul));
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
    for (const q of this.projs) {
      const dt = q.friendly ? dtReal : dtEnemy;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.life -= dt;
      const minX = WALL;
      const maxX = W - WALL;
      const minY = WALL;
      const maxY = H - WALL;
      if (q.x < minX || q.x > maxX || q.y < minY || q.y > maxY) {
        if (q.friendly && q.bounce > 0) {
          q.bounce--;
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
            this.hurtEnemy(e, q.dmg, true);
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

  private hurtEnemy(e: Enemy, base: number, fromPlayer: boolean) {
    if (e.dead) return;
    let d = base;
    let crit = false;
    if (fromPlayer && Math.random() < this.m.crit) { d *= 2; crit = true; }
    e.hp -= d;
    e.flash = 0.1;
    this.fx.push({
      kind: 'text', x: e.x + rand(-8, 8), y: e.y - e.r, t: 0, life: 0.5,
      text: String(Math.round(d)), color: crit ? '#ffd24a' : '#ffffff',
    });
    if (fromPlayer) {
      if (this.m.lifesteal > 0) this.heal(d * this.m.lifesteal);
      if (this.m.burn > 0) { e.burnT = 3; e.burnDps = 3 * this.m.burn; }
    }
    if (e.hp <= 0) this.killEnemy(e);
  }

  private killEnemy(e: Enemy) {
    if (e.dead) return;
    e.dead = true;
    this.kills++;
    this.fx.push({ kind: 'ring', x: e.x, y: e.y, t: 0, life: 0.25, r: e.r + 10, color: e.color });
    if (this.m.explode > 0) {
      const R = 60 + this.m.explode * 10;
      this.fx.push({ kind: 'ring', x: e.x, y: e.y, t: 0, life: 0.25, r: R, color: '#ffb35c' });
      for (const o of this.enemies) {
        if (o.dead || o.spawnT > 0) continue;
        if (dist(o.x, o.y, e.x, e.y) < R + o.r) this.hurtEnemy(o, 12 * this.m.explode * this.m.dmg, true);
      }
    }
    if (e.kind === 'boss') {
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
    p.hp -= dmg;
    p.invuln = 0.7;
    this.fx.push({ kind: 'text', x: p.x, y: p.y - 20, t: 0, life: 0.6, text: `-${Math.round(dmg)}`, color: '#ff6b6b' });
    if (this.m.thorns > 0) {
      const R = 90;
      for (const e of this.enemies) {
        if (e.dead || e.spawnT > 0) continue;
        if (dist(e.x, e.y, p.x, p.y) < R + e.r) this.hurtEnemy(e, 20 * this.m.thorns * this.m.dmg, true);
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
  }

  // ---------- 렌더 ----------

  render() {
    const c = this.ctx;
    c.clearRect(0, 0, W, H);
    const bg = background(W, H, WALL);
    if (bg) {
      c.drawImage(bg, 0, 0);
    } else {
      c.fillStyle = '#14151c';
      c.fillRect(0, 0, W, H);
    }

    for (const t of this.turrets) {
      drawSprite(c, 64, t.x, t.y, 30);
      c.fillStyle = 'rgba(255, 217, 102, 0.8)';
      c.fillRect(t.x - 14, t.y + 17, 28 * (t.t / 8), 3);
    }

    for (const e of this.enemies) {
      if (e.spawnT > 0) {
        c.strokeStyle = 'rgba(255,90,90,0.8)';
        c.lineWidth = 2;
        c.beginPath();
        c.arc(e.x, e.y, e.r + (e.spawnT % 0.3) * 20, 0, Math.PI * 2);
        c.stroke();
        continue;
      }
      const size = Math.max(24, e.r * 2.6);
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.beginPath();
      c.ellipse(e.x, e.y + size * 0.42, size * 0.32, size * 0.1, 0, 0, Math.PI * 2);
      c.fill();
      if (e.burnT > 0) {
        c.fillStyle = 'rgba(255, 140, 50, 0.35)';
        c.beginPath();
        c.arc(e.x, e.y, e.r + 4, 0, Math.PI * 2);
        c.fill();
      }
      const idx = e.kind === 'boss' ? BOSS_SPRITE[e.tier] : ENEMY_SPRITE[e.kind];
      drawSprite(c, idx, e.x, e.y, size, { flip: this.p.x < e.x, flash: e.flash > 0 || e.state === 1 });
      if (e.kind !== 'boss' && e.hp < e.maxHp) {
        c.fillStyle = '#000a';
        c.fillRect(e.x - e.r, e.y - size / 2 - 6, e.r * 2, 3);
        c.fillStyle = '#7bd88f';
        c.fillRect(e.x - e.r, e.y - size / 2 - 6, (e.r * 2 * Math.max(0, e.hp)) / e.maxHp, 3);
      }
    }

    for (const q of this.projs) {
      if (q.sprite !== undefined) {
        // 무기 스프라이트는 위쪽을 향하므로 진행 방향에 맞춰 90도 보정한다.
        drawSprite(c, q.sprite, q.x, q.y, 22, { rot: Math.atan2(q.vy, q.vx) + Math.PI / 2 });
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
      drawSprite(c, 107, p.x + Math.cos(a) * 58, p.y + Math.sin(a) * 58, 24, { rot: a + Math.PI });
    }
    c.globalAlpha = p.invuln > 0 && Math.floor(p.invuln * 20) % 2 === 0 ? 0.4 : 1;
    const facingLeft = Math.cos(p.aim) < 0;
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.beginPath();
    c.ellipse(p.x, p.y + 14, 11, 4, 0, 0, Math.PI * 2);
    c.fill();
    drawSprite(c, this.char.sprite, p.x, p.y, 34, { flip: facingLeft });
    if (this.char.weapon !== 'spread' && this.char.weapon !== 'bolt') {
      drawSprite(c, this.char.weaponSprite, p.x + Math.cos(p.aim) * 18, p.y + Math.sin(p.aim) * 18, 22,
        { rot: p.aim + Math.PI / 2 });
    }
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
      const k = f.t / f.life;
      c.globalAlpha = 1 - k;
      if (f.kind === 'ring') {
        c.strokeStyle = f.color;
        c.lineWidth = 3;
        c.beginPath();
        c.arc(f.x, f.y, (f.r ?? 20) * (0.4 + 0.6 * k), 0, Math.PI * 2);
        c.stroke();
      } else if (f.kind === 'arc') {
        c.fillStyle = f.color;
        c.beginPath();
        c.moveTo(f.x, f.y);
        c.arc(f.x, f.y, f.r ?? 60, (f.a ?? 0) - (f.arc ?? 1) / 2, (f.a ?? 0) + (f.arc ?? 1) / 2);
        c.closePath();
        c.fill();
      } else {
        c.fillStyle = f.color;
        c.font = 'bold 14px sans-serif';
        c.textAlign = 'center';
        c.fillText(f.text ?? '', f.x, f.y - k * 16);
      }
      c.globalAlpha = 1;
    }

    this.renderHud();
  }

  private renderHud() {
    const c = this.ctx;
    const p = this.p;
    c.textAlign = 'left';
    c.font = 'bold 14px "Malgun Gothic","Apple SD Gothic Neo","Noto Sans CJK KR",sans-serif';

    c.fillStyle = '#000a';
    c.fillRect(40, 36, 200, 14);
    c.fillStyle = '#e05555';
    c.fillRect(40, 36, 200 * (p.hp / p.maxHp), 14);
    c.fillStyle = '#fff';
    c.fillText(`HP ${Math.ceil(p.hp)}/${p.maxHp}`, 46, 48);

    const sk = skillById(p.skillId);
    const full = sk.cd * this.m.skillCd;
    c.fillStyle = '#000a';
    c.fillRect(40, 56, 200, 12);
    c.fillStyle = p.skillCd > 0 ? '#5a6a9a' : '#7fd1ff';
    c.fillRect(40, 56, 200 * (p.skillCd > 0 ? 1 - p.skillCd / full : 1), 12);
    c.fillStyle = '#fff';
    c.font = '12px "Malgun Gothic","Apple SD Gothic Neo","Noto Sans CJK KR",sans-serif';
    c.fillText(`[Space/우클릭] ${sk.name}`, 46, 66);

    c.textAlign = 'right';
    c.font = 'bold 16px "Malgun Gothic","Apple SD Gothic Neo","Noto Sans CJK KR",sans-serif';
    c.fillStyle = '#fff';
    c.fillText(`ROOM ${this.room}/${FINAL_ROOM}   처치 ${this.kills}`, W - 40, 50);

    c.textAlign = 'left';
    c.font = '12px "Malgun Gothic","Apple SD Gothic Neo","Noto Sans CJK KR",sans-serif';
    c.fillStyle = '#cfd3e6';
    let y = H - 40;
    for (const [id, n] of this.itemCounts) {
      c.fillText(`${itemById(id).name}${n > 1 ? ` x${n}` : ''}`, 40, y);
      y -= 14;
    }

    const boss = this.enemies.find((e) => e.kind === 'boss' && !e.dead);
    if (boss) {
      c.fillStyle = '#000a';
      c.fillRect(W / 2 - 200, 40, 400, 12);
      c.fillStyle = '#c0392b';
      c.fillRect(W / 2 - 200, 40, 400 * Math.max(0, boss.hp / boss.maxHp), 12);
      c.textAlign = 'center';
      c.fillStyle = '#fff';
      c.fillText(BOSS_NAME[boss.tier], W / 2, 36);
    }

    if (this.bannerT > 0) {
      c.globalAlpha = Math.min(1, this.bannerT);
      c.textAlign = 'center';
      c.fillStyle = '#fff';
      c.font = 'bold 36px "Malgun Gothic","Apple SD Gothic Neo","Noto Sans CJK KR",sans-serif';
      c.fillText(this.room % BOSS_EVERY === 0 ? `BOSS  -  ROOM ${this.room}` : `ROOM ${this.room}`, W / 2, 120);
      c.globalAlpha = 1;
    }
  }
}
