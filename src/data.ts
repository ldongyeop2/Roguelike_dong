export type Kind = 'blob' | 'beast' | 'bird' | 'bug' | 'plant' | 'golem' | 'imp';
export type Feature = 'leaf' | 'flower' | 'horn' | 'flame' | 'ice' | 'spikes' | 'crown' | 'moss' | 'wings';

export interface Species {
  id: string;
  name: string;
  tribe: string;
  kind: Kind;
  tier: number;
  size: number;
  col: string;
  col2: string;
  feats: Feature[];
  hp: number;
  atk: number;
  def: number;
  spd: number;
  range: number;
  aggro?: boolean;
  boss?: boolean;
}

export const SPECIES: Record<string, Species> = {};

function S(
  id: string, name: string, tribe: string, kind: Kind, tier: number, size: number,
  col: string, col2: string, feats: Feature[],
  hp: number, atk: number, def: number, spd: number, range = 1.3, extra: Partial<Species> = {},
) {
  SPECIES[id] = { id, name, tribe, kind, tier, size, col, col2, feats, hp, atk, def, spd, range, ...extra };
}

// 야생 1단계
S('dewling', '이슬방울', '식물', 'blob', 1, 0.9, '#7fd6e8', '#3f9ec0', [], 38, 6, 2, 2.2);
S('pipkit', '솜토끼', '야수', 'beast', 1, 0.85, '#f3e3d0', '#d9a98a', [], 34, 7, 1.5, 2.8);
S('flitwing', '팔랑새', '날개', 'bird', 1, 0.9, '#ffd45e', '#f08a3c', [], 30, 8, 1.5, 3.0, 3.5);
S('thornbud', '가시싹', '식물', 'plant', 1, 1.0, '#8fd16a', '#4f9a3c', ['spikes'], 46, 8, 3, 2.0, 3.2);
S('clackbug', '딱정이', '곤충', 'bug', 1, 0.95, '#d9574a', '#5a3340', [], 50, 8, 5, 2.4);
// 야생 2단계
S('mosswolf', '이끼늑대', '야수', 'beast', 2, 1.15, '#8a9a8c', '#566a5c', ['moss'], 62, 11, 3.5, 3.2, 1.3, { aggro: true });
S('pebblin', '자갈돌이', '광물', 'golem', 2, 0.95, '#b9a78c', '#86745e', [], 80, 10, 7, 2.0);
S('emberimp', '불씨도깨비', '암흑', 'imp', 2, 1.0, '#e8643c', '#8a2f2a', ['flame'], 58, 13, 3, 2.8, 3.6, { aggro: true });
S('dunehawk', '모래매', '날개', 'bird', 2, 1.15, '#d9b077', '#8a6238', [], 56, 12, 3, 3.2);
// 야생 3단계
S('frostpaw', '서리곰', '야수', 'beast', 3, 1.45, '#dfeaf5', '#9fb6d0', ['ice'], 100, 15, 6, 2.8, 1.4, { aggro: true });
S('icegolem', '얼음거인', '광물', 'golem', 3, 1.3, '#a8dcf0', '#5fa3cc', ['ice'], 125, 14, 9, 2.0, 1.4);
S('gloomshade', '밤그림자', '암흑', 'imp', 3, 1.2, '#6a5a9a', '#34284f', ['horn'], 85, 18, 4.5, 3.0, 3.6, { aggro: true });
// 보스
S('blizzlord', '눈보라 군주', '광물', 'golem', 5, 2.1, '#8fb8e8', '#3f5fa0', ['crown', 'ice'], 600, 24, 10, 2.2, 1.9, { aggro: true, boss: true });
// 조합 전용 2단계
S('bloomhare', '꽃토끼', '야수', 'beast', 2, 0.95, '#ffd0de', '#e88aa8', ['flower'], 66, 11, 4, 3.0);
S('cloudfinch', '구름솜새', '날개', 'bird', 2, 1.0, '#f4f6ff', '#a9b8e8', ['wings'], 58, 13, 3, 3.2, 3.5);
S('vinebeetle', '덩굴장수', '곤충', 'bug', 2, 1.15, '#5fae5a', '#2f5a3a', ['horn', 'leaf'], 84, 11, 7, 2.4);
// 조합 전용 3단계
S('thornwolf', '가시늑대', '야수', 'beast', 3, 1.3, '#5f8a5a', '#2f4f38', ['spikes', 'leaf'], 98, 17, 6, 3.2);
S('stonewing', '바위날개', '날개', 'bird', 3, 1.35, '#a9a39a', '#5f5a55', ['horn'], 104, 16, 8, 3.0, 3.5);
S('cinderhound', '잿불사냥개', '암흑', 'beast', 3, 1.3, '#4a3a3f', '#c8502f', ['flame', 'horn'], 92, 19, 5, 3.3);
S('bloomguard', '꽃수호자', '식물', 'plant', 3, 1.45, '#f09ac0', '#4f9a55', ['flower', 'leaf'], 120, 14, 9, 2.2, 3.2);
// 조합 전용 4단계
S('stormgriff', '폭풍그리프', '날개', 'beast', 4, 1.55, '#e8e2c8', '#7a8ac8', ['wings', 'horn'], 135, 23, 8, 3.4);
S('glacierking', '빙하왕', '광물', 'golem', 4, 1.6, '#c8ecff', '#4f8ad0', ['crown', 'ice'], 170, 20, 12, 2.3, 1.5);
S('nightflame', '밤불꽃', '암흑', 'imp', 4, 1.45, '#3a2f5f', '#b03ad0', ['flame', 'wings'], 120, 27, 7, 3.1, 3.8);
S('worldsprout', '세계수의 아이', '식물', 'plant', 4, 1.6, '#aee88a', '#3f8a4a', ['flower', 'moss', 'crown'], 160, 21, 11, 2.3, 3.4);
// 조합 전용 5단계
S('chimera', '오색 키메라', '환수', 'beast', 5, 1.85, '#f0c85a', '#c84a8a', ['wings', 'flame', 'horn', 'crown'], 190, 31, 11, 3.5, 1.5);
S('elderlord', '태고의 군주', '환수', 'golem', 5, 1.9, '#8ad0a0', '#3a6a8a', ['crown', 'moss', 'ice', 'spikes'], 230, 28, 15, 2.5, 1.6);

export interface Recipe {
  a: string;
  b: string;
  out: string;
}

export const RECIPES: Recipe[] = [
  { a: 'dewling', b: 'pipkit', out: 'bloomhare' },
  { a: 'pipkit', b: 'flitwing', out: 'cloudfinch' },
  { a: 'thornbud', b: 'clackbug', out: 'vinebeetle' },
  { a: 'mosswolf', b: 'thornbud', out: 'thornwolf' },
  { a: 'pebblin', b: 'dunehawk', out: 'stonewing' },
  { a: 'emberimp', b: 'mosswolf', out: 'cinderhound' },
  { a: 'bloomhare', b: 'vinebeetle', out: 'bloomguard' },
  { a: 'stonewing', b: 'cloudfinch', out: 'stormgriff' },
  { a: 'frostpaw', b: 'icegolem', out: 'glacierking' },
  { a: 'gloomshade', b: 'cinderhound', out: 'nightflame' },
  { a: 'bloomguard', b: 'thornwolf', out: 'worldsprout' },
  { a: 'stormgriff', b: 'nightflame', out: 'chimera' },
  { a: 'glacierking', b: 'worldsprout', out: 'elderlord' },
];

export function findRecipe(a: string, b: string): Recipe | undefined {
  return RECIPES.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a));
}

/** 조합 재료가 되기 위한 최소 레벨 */
export const mixLv = (sp: Species) => [0, 5, 10, 16, 24, 99][sp.tier];
export const mixChance = (out: Species) => [0, 1, 0.85, 0.75, 0.65, 0.5][out.tier];
export const mixFee = (out: Species) => [0, 0, 100, 300, 900, 2500][out.tier];

export function statsOf(sp: Species, lv: number) {
  const g = 1 + 0.11 * (lv - 1);
  return { hp: Math.round(sp.hp * g), atk: Math.round(sp.atk * g), def: Math.round(sp.def * g) };
}

export const expNeed = (lv: number) => Math.round(25 * Math.pow(lv, 1.7));
export const mobExp = (sp: Species, lv: number) => Math.round((5 + lv * 3) * (1 + 0.25 * (sp.tier - 1)) * (sp.boss ? 8 : 1));
export const stoneChance = (sp: Species) => (sp.boss ? 0 : [0, 0.2, 0.13, 0.09][sp.tier] ?? 0);

export const WEAPONS = [
  { name: '나무 검', atk: 0, price: 0 },
  { name: '청동 검', atk: 6, price: 150 },
  { name: '강철 검', atk: 14, price: 600 },
  { name: '은빛 검', atk: 26, price: 1800 },
  { name: '용맹의 검', atk: 42, price: 5000 },
];
export const ARMORS = [
  { name: '여행자의 옷', def: 0, price: 0 },
  { name: '가죽 갑옷', def: 4, price: 120 },
  { name: '사슬 갑옷', def: 9, price: 500 },
  { name: '기사 갑옷', def: 16, price: 1500 },
  { name: '수호의 갑옷', def: 26, price: 4200 },
];
export const PRICES = { hp: 15, mp: 20, scroll: 40 };

export type Theme = 'town' | 'meadow' | 'forest' | 'waste' | 'snow';

export interface SpawnDef {
  sp: string;
  lv: [number, number];
  n: number;
  /** 가로 방향 출현 구간 (0..1) */
  band: [number, number];
  at?: [number, number];
}
export interface PortalDef {
  x: number;
  y: number;
  to: string;
  tx: number;
  ty: number;
}
export interface NpcDef {
  name: string;
  role: 'mix' | 'shop' | 'heal';
  x: number;
  y: number;
  top: string;
  hair: string;
}
export interface ZoneDef {
  id: string;
  name: string;
  theme: Theme;
  w: number;
  h: number;
  seed: number;
  safe?: boolean;
  spawns: SpawnDef[];
  portals: PortalDef[];
  npcs: NpcDef[];
}

export const ZONES: Record<string, ZoneDef> = {
  town: {
    id: 'town', name: '새싹 마을', theme: 'town', w: 30, h: 30, seed: 11, safe: true, spawns: [],
    portals: [{ x: 27, y: 15, to: 'meadow', tx: 5, ty: 24 }],
    npcs: [
      { name: '조합사 루멘', role: 'mix', x: 12, y: 11, top: '#7a4ac8', hair: '#e8e2f5' },
      { name: '상인 보리', role: 'shop', x: 18, y: 11, top: '#c8862f', hair: '#5a3a22' },
      { name: '치료사 미아', role: 'heal', x: 11, y: 18, top: '#f2f2f2', hair: '#e86a8a' },
    ],
  },
  meadow: {
    id: 'meadow', name: '풀잎 들판', theme: 'meadow', w: 48, h: 48, seed: 23,
    spawns: [
      { sp: 'dewling', lv: [1, 3], n: 12, band: [0.08, 0.5] },
      { sp: 'pipkit', lv: [2, 4], n: 11, band: [0.3, 0.8] },
      { sp: 'flitwing', lv: [3, 5], n: 10, band: [0.55, 0.95] },
    ],
    portals: [
      { x: 3, y: 24, to: 'town', tx: 25, ty: 15 },
      { x: 44, y: 24, to: 'forest', tx: 5, ty: 26 },
    ],
    npcs: [],
  },
  forest: {
    id: 'forest', name: '속삭이는 숲', theme: 'forest', w: 52, h: 52, seed: 37,
    spawns: [
      { sp: 'thornbud', lv: [5, 7], n: 12, band: [0.08, 0.5] },
      { sp: 'clackbug', lv: [6, 9], n: 12, band: [0.3, 0.8] },
      { sp: 'mosswolf', lv: [8, 10], n: 10, band: [0.55, 0.95] },
    ],
    portals: [
      { x: 3, y: 26, to: 'meadow', tx: 42, ty: 24 },
      { x: 48, y: 26, to: 'waste', tx: 5, ty: 26 },
    ],
    npcs: [],
  },
  waste: {
    id: 'waste', name: '붉은 황야', theme: 'waste', w: 52, h: 52, seed: 51,
    spawns: [
      { sp: 'pebblin', lv: [10, 13], n: 12, band: [0.08, 0.5] },
      { sp: 'emberimp', lv: [12, 15], n: 11, band: [0.3, 0.8] },
      { sp: 'dunehawk', lv: [13, 16], n: 11, band: [0.55, 0.95] },
    ],
    portals: [
      { x: 3, y: 26, to: 'forest', tx: 46, ty: 26 },
      { x: 48, y: 26, to: 'snow', tx: 5, ty: 26 },
    ],
    npcs: [],
  },
  snow: {
    id: 'snow', name: '서리 고원', theme: 'snow', w: 52, h: 52, seed: 67,
    spawns: [
      { sp: 'frostpaw', lv: [16, 20], n: 12, band: [0.08, 0.5] },
      { sp: 'icegolem', lv: [18, 22], n: 11, band: [0.3, 0.75] },
      { sp: 'gloomshade', lv: [20, 24], n: 10, band: [0.5, 0.85] },
      { sp: 'blizzlord', lv: [26, 26], n: 1, band: [0.8, 0.9], at: [45, 26] },
    ],
    portals: [{ x: 3, y: 26, to: 'waste', tx: 46, ty: 26 }],
    npcs: [],
  },
};
