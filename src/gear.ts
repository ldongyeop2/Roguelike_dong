// 장비 정의: 무기, 투구, 갑옷, 신발, 장신구.
// 장비 베이스는 해금 조건(unlock)을 가질 수 있고, 해금된 베이스만 드랍된다.
import type { Unlock } from './content';
import type { IconRef } from './sprites';

export type Slot = 'weapon' | 'helmet' | 'armor' | 'boots' | 'accessory';
export const SLOTS: Slot[] = ['weapon', 'helmet', 'armor', 'boots', 'accessory'];
export const SLOT_LABEL: Record<Slot, string> = {
  weapon: '무기', helmet: '투구', armor: '갑옷', boots: '신발', accessory: '장신구',
};

/**
 * slash: 부채꼴로 베기 / thrust: 앞으로 찌르기(좁고 김) / smash: 크게 내려치기(넓고 느림, 강한 넉백)
 * bow: 화살 발사 / staff: 마력구 발사(관통)
 * fist: 주먹(건틀릿). 찌르기와 같은 좁은 범위, 매우 빠름 / whip: 채찍. 찌르기보다 길고 넓음, 느림
 */
export type WeaponKind = 'slash' | 'thrust' | 'smash' | 'bow' | 'staff' | 'fist' | 'whip';

export interface GearStats {
  dmgPct?: number;
  rate?: number;
  speed?: number;
  maxHp?: number;
  armor?: number;
  crit?: number;
  lifesteal?: number;
  regen?: number;
  skillCd?: number; // 쿨타임 감소 비율
}
export type StatKey = keyof GearStats;

export const GEAR_STAT_LABEL: Record<StatKey, string> = {
  dmgPct: '피해', rate: '공격 속도', speed: '이동 속도', maxHp: '최대 체력', armor: '방어',
  crit: '치명타', lifesteal: '흡혈', regen: '초당 회복', skillCd: '스킬 쿨타임 감소',
};
const PCT_STATS = new Set<StatKey>(['dmgPct', 'rate', 'speed', 'crit', 'lifesteal', 'skillCd']);

export function fmtStat(k: StatKey, v: number): string {
  const sign = v >= 0 ? '+' : '-';
  const a = Math.abs(v);
  if (PCT_STATS.has(k)) return `${GEAR_STAT_LABEL[k]} ${sign}${Math.round(a * 100)}%`;
  if (k === 'regen') return `${GEAR_STAT_LABEL[k]} ${sign}${a.toFixed(1)}`;
  return `${GEAR_STAT_LABEL[k]} ${sign}${Math.round(a)}`;
}

interface GearBaseCommon {
  kind: 'gear';
  id: string;
  name: string;
  desc: string;
  sprite: IconRef;
  stats: GearStats; // 기본 능력치(무기는 고유 옵션)
  unlock?: Unlock;
}

export interface WeaponBase extends GearBaseCommon {
  slot: 'weapon';
  sprite: IconRef;
  wkind: WeaponKind;
  dmg: number;
  cd: number;
  range: number; // 근접 사거리(px)
  arc: number; // 근접 범위(라디안)
  knock: number;
}

export interface ArmorBase extends GearBaseCommon {
  slot: Exclude<Slot, 'weapon'>;
}

export type GearBase = WeaponBase | ArmorBase;

const wpn = (
  id: string, name: string, sprite: IconRef, wkind: WeaponKind,
  dmg: number, cd: number, range: number, arc: number, knock: number,
  extra: Partial<Pick<WeaponBase, 'stats' | 'unlock' | 'desc'>> = {},
): WeaponBase => ({
  kind: 'gear', slot: 'weapon', id, name, sprite, wkind, dmg, cd, range, arc, knock,
  stats: extra.stats ?? {}, unlock: extra.unlock,
  desc: extra.desc ?? `${WKIND_LABEL[wkind]} | 피해 ${dmg} | 공격 간격 ${cd}초`,
});

export const WKIND_LABEL: Record<WeaponKind, string> = {
  slash: '베기', thrust: '찌르기', smash: '내려치기', bow: '활', staff: '지팡이', fist: '주먹', whip: '채찍',
};

const arm = (
  slot: ArmorBase['slot'], id: string, name: string, sprite: IconRef, stats: GearStats, unlock?: Unlock,
): ArmorBase => ({
  kind: 'gear', slot, id, name, sprite, stats, unlock,
  desc: `${SLOT_LABEL[slot]} | ${Object.entries(stats).map(([k, v]) => fmtStat(k as StatKey, v)).join(', ')}`,
});

export const WEAPONS: WeaponBase[] = [
  wpn('iron_sword', '철검', 'w_iron', 'slash', 20, 0.42, 78, 1.9, 220),
  wpn('knight_sword', '한손검', 'w_knight', 'slash', 24, 0.48, 82, 1.9, 240),
  wpn('saw_sword', '톱날검', 'w_serrated', 'slash', 21, 0.44, 80, 1.8, 200, { stats: { crit: 0.05 } }),
  wpn('dagger', '단검', 'w_dagger', 'slash', 12, 0.22, 60, 1.4, 120),
  wpn('hatchet', '손도끼', 'w_hatchet', 'slash', 17, 0.32, 66, 1.6, 200),
  wpn('cleaver', '도살칼', 'w_cleaver', 'slash', 23, 0.46, 70, 1.7, 220, { stats: { lifesteal: 0.01 } }),
  wpn('rapier', '레이피어', 'w_iron', 'thrust', 17, 0.28, 100, 0.55, 150),
  // 건틀릿: 레이피어와 같은 범위(100px, 좁은 각)에 공격 간격 0.16초
  wpn('gauntlet', '건틀릿', 'g_gauntlet', 'fist', 9, 0.16, 100, 0.55, 90),
  // 채찍: 찌르기보다 길고(170px) 넓은 각, 공격 간격 0.8초
  wpn('whip', '채찍', 'g_whip', 'whip', 30, 0.8, 170, 0.8, 160),
  wpn('spear', '창', 'w_spear', 'thrust', 22, 0.42, 120, 0.5, 260, { unlock: { stat: 'bestRoom', target: 4 } }),
  wpn('katana', '카타나', 'w_katana', 'slash', 20, 0.3, 92, 1.6, 160, { unlock: { stat: 'totalKills', target: 200 } }),
  wpn('mace', '철퇴', 'w_mace', 'smash', 28, 0.62, 78, 2.0, 380),
  wpn('club', '가시 곤봉', 'w_club', 'smash', 25, 0.56, 74, 2.0, 340),
  wpn('hammer', '망치', 'w_hammer', 'smash', 31, 0.68, 78, 2.2, 420),
  wpn('battle_axe', '전투 도끼', 'w_battle_axe', 'smash', 30, 0.6, 84, 2.2, 300),
  wpn('double_axe', '양날 도끼', 'w_double_axe', 'smash', 34, 0.7, 88, 2.6, 320),
  wpn('long_hammer', '대형 망치', 'w_hammer_long', 'smash', 48, 1.0, 100, 2.6, 520,
    { unlock: { stat: 'bossKills', target: 1 } }),
  wpn('greatsword', '대검', 'w_greatsword', 'slash', 40, 0.85, 104, 2.4, 360, { unlock: { stat: 'bestRoom', target: 6 } }),
  wpn('longsword', '장검', 'w_longsword', 'slash', 27, 0.5, 98, 1.8, 240, { unlock: { stat: 'totalRooms', target: 25 } }),
  wpn('golden_sword', '황금 검', 'w_golden', 'slash', 30, 0.42, 88, 1.9, 260,
    { stats: { crit: 0.08 }, unlock: { stat: 'bossKills', target: 2 } }),
  wpn('bow', '장궁', 'w_bow', 'bow', 12, 0.32, 0, 0, 80),
  wpn('staff_red', '화염 지팡이', 'w_staff_red', 'staff', 28, 0.8, 0, 0, 120),
  wpn('staff_green', '자연 지팡이', 'w_staff_green', 'staff', 21, 0.62, 0, 0, 100,
    { stats: { regen: 0.5 }, unlock: { stat: 'deaths', target: 5 } }),
];

export const ARMORS: ArmorBase[] = [
  arm('helmet', 'leather_cap', '가죽 모자', 'g_cap_leather', { armor: 1, maxHp: 5 }),
  arm('helmet', 'iron_helm', '철 투구', 'g_helm_iron', { armor: 2 }),
  arm('helmet', 'wizard_hat', '마법사 모자', 'g_cap_cloth', { skillCd: 0.12 }, { stat: 'totalKills', target: 120 }),
  arm('helmet', 'gold_helm', '황금 투구', 'g_helm_gold', { armor: 2, maxHp: 10 }, { stat: 'bossKills', target: 1 }),
  arm('armor', 'leather_armor', '가죽 갑옷', 'g_armor_leather', { armor: 2, maxHp: 10 }),
  arm('armor', 'chainmail', '사슬 갑옷', 'g_armor_iron', { armor: 3 }),
  arm('armor', 'robe', '마법사 로브', 'g_robe_cloth', { maxHp: 5, skillCd: 0.15 }),
  arm('armor', 'plate', '판금 갑옷', 'g_armor_gold', { armor: 5, speed: -0.06 }, { stat: 'bestRoom', target: 7 }),
  arm('boots', 'leather_boots', '가죽 신발', 'g_boots_leather', { speed: 0.06 }),
  arm('boots', 'iron_boots', '철 장화', 'g_boots_iron', { armor: 1, speed: 0.03 }),
  arm('boots', 'wind_boots', '바람의 장화', 'g_boots_wind', { speed: 0.12 }, { stat: 'totalRooms', target: 15 }),
  arm('accessory', 'silver_ring', '은반지', 'g_ring_silver', { crit: 0.06 }),
  arm('accessory', 'ruby_amulet', '루비 목걸이', 'g_amulet_ruby', { dmgPct: 0.1 }),
  arm('accessory', 'emerald_ring', '에메랄드 반지', 'g_ring_emerald', { regen: 0.5 }),
  arm('accessory', 'swift_ring', '질풍의 반지', 'g_ring_gold', { rate: 0.1 }, { stat: 'totalKills', target: 250 }),
  arm('accessory', 'blood_amulet', '피의 부적', 'g_amulet_blood', { lifesteal: 0.03 }, { stat: 'deaths', target: 5 }),
];

export const GEAR_BASES: GearBase[] = [...WEAPONS, ...ARMORS];
export const weaponById = (id: string) => WEAPONS.find((w) => w.id === id)!;

// ---------- 등급과 무작위 옵션 ----------

export interface Rarity { name: string; color: string; mul: number; affixes: number }
export const RARITY: Rarity[] = [
  { name: '일반', color: '#d6d6d6', mul: 1, affixes: 0 },
  { name: '고급', color: '#5aa9ff', mul: 1.2, affixes: 1 },
  { name: '희귀', color: '#c77dff', mul: 1.45, affixes: 2 },
  { name: '전설', color: '#ffa63d', mul: 1.75, affixes: 3 },
];

const AFFIX: Record<StatKey, [number, number]> = {
  dmgPct: [0.05, 0.1], rate: [0.04, 0.08], speed: [0.03, 0.07], maxHp: [6, 14], armor: [1, 2],
  crit: [0.03, 0.06], lifesteal: [0.01, 0.02], regen: [0.2, 0.4], skillCd: [0.05, 0.1],
};

export interface Gear {
  uid: number;
  base: GearBase;
  rarity: number;
  dmg: number; // 무기만 사용
  stats: GearStats; // 기본 능력치 + 무작위 옵션 합계
}

let uidSeq = 1;

const add = (st: GearStats, k: StatKey, v: number) => { st[k] = (st[k] ?? 0) + v; };

/** 방 번호에 따라 등급을 굴린다. minRarity로 하한을 줄 수 있다(보스). */
export function rollRarity(room: number, minRarity = 0): number {
  const r = Math.random();
  let v = 0;
  if (r < 0.01 + room * 0.004) v = 3;
  else if (r < 0.06 + room * 0.012) v = 2;
  else if (r < 0.3 + room * 0.02) v = 1;
  return Math.max(v, minRarity);
}

export function makeGear(base: GearBase, rarity: number, room: number): Gear {
  const rar = RARITY[rarity];
  const scale = 1 + (room - 1) * 0.04;
  const stats: GearStats = {};
  for (const [k, v] of Object.entries(base.stats) as [StatKey, number][]) {
    // 불리한 능력치(음수)는 등급에 따라 커지지 않는다.
    add(stats, k, v > 0 ? v * rar.mul : v);
  }
  const keys = Object.keys(AFFIX) as StatKey[];
  for (let i = 0; i < rar.affixes; i++) {
    const k = keys[Math.floor(Math.random() * keys.length)];
    const [lo, hi] = AFFIX[k];
    let v = (lo + Math.random() * (hi - lo)) * scale;
    if (k === 'maxHp' || k === 'armor') v = Math.round(v);
    add(stats, k, v);
  }
  const dmg = base.slot === 'weapon' ? Math.round(base.dmg * rar.mul * scale) : 0;
  return { uid: uidSeq++, base, rarity, dmg, stats };
}

export function gearTitle(g: Gear): string {
  return `[${RARITY[g.rarity].name}] ${g.base.name}`;
}

/** 장비 설명 줄 목록 */
export function gearLines(g: Gear): string[] {
  const lines: string[] = [];
  if (g.base.slot === 'weapon') {
    lines.push(`${WKIND_LABEL[g.base.wkind]} | 피해 ${g.dmg} | 간격 ${g.base.cd}초`);
  } else {
    lines.push(SLOT_LABEL[g.base.slot]);
  }
  for (const [k, v] of Object.entries(g.stats) as [StatKey, number][]) {
    if (Math.abs(v) > 1e-6) lines.push(fmtStat(k, v));
  }
  return lines;
}
