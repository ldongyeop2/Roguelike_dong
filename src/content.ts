import { GEAR_BASES, type GearBase } from './gear';
import type { IconRef } from './sprites';
import type { Tag } from './synergy';
import type { SpriteKey } from './spritesheet';

// 게임 콘텐츠 정의. 해금 조건(unlock)이 없는 항목은 처음부터 사용 가능하다.
// 영구 스탯 강화는 존재하지 않으며, 죽음으로 얻는 것은 "선택지의 확장(해금)"뿐이다.

export type StatKey =
  | 'totalKills'
  | 'deaths'
  | 'bestRoom'
  | 'bossKills'
  | 'wins'
  | 'totalRooms'
  | 'itemsCollected';

export interface Unlock {
  stat: StatKey;
  target: number;
}

export const STAT_LABEL: Record<StatKey, string> = {
  totalKills: '누적 처치',
  deaths: '누적 사망',
  bestRoom: '최고 도달 방',
  bossKills: '보스 처치',
  wins: '최종 클리어',
  totalRooms: '누적 방 클리어',
  itemsCollected: '누적 아이템 획득',
};

export const unlockText = (u: Unlock) => `${STAT_LABEL[u.stat]} ${u.target} 달성`;

/** 런 중 적용되는 수정치 모음 */
export interface Mods {
  dmg: number; // 피해 배율
  rate: number; // 공격 속도 배율
  speed: number; // 이동 속도 배율
  maxHp: number; // 최대 체력 가산
  pierce: number; // 관통 가산
  extra: number; // 추가 투사체(근접은 범위 증가)
  lifesteal: number; // 가한 피해 대비 흡혈 비율
  burn: number; // 화상 중첩
  bounce: number; // 벽 튕김 횟수
  orbit: number; // 회전 칼날 수
  thorns: number; // 피격 시 주변 반격
  explode: number; // 처치 시 폭발
  crit: number; // 치명타 확률
  regen: number; // 초당 체력 재생
  skillCd: number; // 스킬 쿨타임 배율
  choices: number; // 보상 선택지 수
  poison: number; // 독 중첩
  chain: number; // 연쇄 번개
  homing: number; // 투사체 유도
  split: number; // 처치 시 파편
  frost: number; // 냉기(둔화)
}

export const baseMods = (): Mods => ({
  dmg: 1,
  rate: 1,
  speed: 1,
  maxHp: 0,
  pierce: 0,
  extra: 0,
  lifesteal: 0,
  burn: 0,
  bounce: 0,
  orbit: 0,
  thorns: 0,
  explode: 0,
  crit: 0,
  regen: 0,
  skillCd: 1,
  choices: 3,
  poison: 0,
  chain: 0,
  homing: 0,
  split: 0,
  frost: 0,
});

interface Base {
  id: string;
  sprite: IconRef;
  name: string;
  desc: string;
  unlock?: Unlock;
}


/**
 * 직업. 모든 런은 아무 특성 없는 모험가(tier 0)로 시작해 전직으로 특성을 키운다.
 * tier 1(기본 직업)은 체력, 이동 속도, 무기, 스킬을 정하고, tier 2(상위 직업)는 고유 패시브와 태그를 더한다.
 */
export interface CharDef extends Base {
  kind: 'char';
  tier: 0 | 1 | 2;
  sprite: SpriteKey;
  color: string;
  hp: number; // tier 0/1: 기본 체력, tier 2: 추가 체력
  speed: number; // tier 2에서는 0(그대로)
  startWeapon: string; // 전직할 때 받는 무기 id (gear.ts). 빈 문자열이면 무기를 바꾸지 않는다.
  skill: string; // 빈 문자열이면 스킬을 바꾸지 않는다(모험가는 스킬 없음).
  parent?: string; // tier 2의 기본 직업
  tag?: Tag; // 상위 직업이 세트 효과에 1개로 세는 태그
  passive?: string; // 상위 직업 고유 패시브 설명
  apply?(m: Mods): void; // 상위 직업이 바꾸는 수정치
}

export interface ItemDef extends Base {
  kind: 'item';
  tags: Tag[];
  apply(m: Mods): void;
}

export interface SkillDef extends Base {
  kind: 'skill';
  cd: number;
}

export type AnyDef = CharDef | ItemDef | SkillDef | GearBase;

export const CHARACTERS: CharDef[] = [
  {
    kind: 'char', tier: 0, id: 'adventurer', sprite: 'elf_m', name: '모험가', color: '#a8a8a8',
    desc: '아무 특성 없는 견습 모험가. 철검 하나만 들고 시작하며 스킬이 없습니다. 2번 방에서 첫 전직, 5번 방 보스를 쓰러뜨리면 상위 전직을 합니다.',
    hp: 100, speed: 200, startWeapon: 'iron_sword', skill: '',
  },
  // ---------- 1차 전직 ----------
  {
    kind: 'char', tier: 1, id: 'knight', sprite: 'knight_m', name: '기사', color: '#6fa8dc',
    desc: '기사의 검과 방벽 스킬. 체력이 높아 정면에서 버팁니다.',
    hp: 130, speed: 190, startWeapon: 'knight_sword', skill: 'barrier',
  },
  {
    kind: 'char', tier: 1, id: 'ranger', sprite: 'elf_m', name: '레인저', color: '#93c47d',
    desc: '장궁과 대시. 거리를 유지하며 화살로 싸웁니다.',
    hp: 95, speed: 215, startWeapon: 'bow', skill: 'dash',
  },
  {
    kind: 'char', tier: 1, id: 'rogue', sprite: 'lizard_m', name: '도적', color: '#c27ba0',
    desc: '단검과 대시. 가장 빠르고, 짧고 빠른 베기로 싸웁니다.',
    hp: 90, speed: 245, startWeapon: 'dagger', skill: 'dash',
    unlock: { stat: 'deaths', target: 2 },
  },
  {
    kind: 'char', tier: 1, id: 'mage', sprite: 'wizard_m', name: '마법사', color: '#8e7cc3',
    desc: '화염 지팡이와 충격파. 적을 꿰뚫는 마력구를 발사합니다.',
    hp: 80, speed: 195, startWeapon: 'staff_red', skill: 'nova',
    unlock: { stat: 'totalKills', target: 100 },
  },
  {
    kind: 'char', tier: 1, id: 'berserker', sprite: 'dwarf_m', name: '광전사', color: '#e06666',
    desc: '양날 도끼와 분노. 체력이 낮을수록 피해가 최대 2배까지 증가합니다.',
    hp: 120, speed: 205, startWeapon: 'double_axe', skill: 'rage',
    unlock: { stat: 'bossKills', target: 1 },
  },
  // ---------- 2차 전직 ----------
  {
    kind: 'char', tier: 2, id: 'paladin', parent: 'knight', sprite: 'knight_m', name: '성기사', color: '#ffe08a', tag: 'guard',
    desc: '방벽이 피해를 막으면 성스러운 폭발이 일어납니다.', hp: 20, speed: 0, startWeapon: '', skill: '',
    passive: '방벽으로 막을 때 주변 폭발과 체력 6 회복, 처치할 때마다 체력 1 회복',
  },
  {
    kind: 'char', tier: 2, id: 'swordmaster', parent: 'knight', sprite: 'knight_m', name: '검성', color: '#9fe6ff', tag: 'blade',
    desc: '근접 공격이 넓어지고, 휘두를 때마다 검기가 날아갑니다.', hp: 0, speed: 0, startWeapon: '', skill: '',
    passive: '근접 범위 +25%, 근접 공격마다 적을 꿰뚫는 검기 발사',
    unlock: { stat: 'bossKills', target: 2 },
  },
  {
    kind: 'char', tier: 2, id: 'sniper', parent: 'ranger', sprite: 'elf_m', name: '저격수', color: '#d9ead3', tag: 'shot',
    desc: '멈춰 서서 조준하면 화살이 훨씬 강해집니다.', hp: 0, speed: 0, startWeapon: '', skill: '',
    passive: '0.4초 이상 멈춰 있으면 투사체 피해 +60%, 관통 +2',
  },
  {
    kind: 'char', tier: 2, id: 'trapper', parent: 'ranger', sprite: 'elf_m', name: '덫사냥꾼', color: '#ffd966', tag: 'swift',
    desc: '스킬이 포탑 설치로 바뀌고, 포탑을 2개까지 오래 유지합니다.', hp: 0, speed: 0, startWeapon: '', skill: 'turret',
    passive: '스킬이 포탑 설치로 바뀜. 포탑 2개 유지, 지속 12초, 스킬 쿨타임 -25%',
    apply: (m) => { m.skillCd *= 0.75; },
    unlock: { stat: 'totalRooms', target: 40 },
  },
  {
    kind: 'char', tier: 2, id: 'assassin', parent: 'rogue', sprite: 'lizard_m', name: '암살자', color: '#ff7ab0', tag: 'blade',
    desc: '대시 직후 첫 공격이 반드시 치명타가 됩니다.', hp: 0, speed: 0, startWeapon: '', skill: '',
    passive: '치명타 확률 +15%, 대시 후 1.5초 안의 첫 공격은 확정 치명타(피해 2.5배)',
    apply: (m) => { m.crit += 0.15; },
  },
  {
    kind: 'char', tier: 2, id: 'venomancer', parent: 'rogue', sprite: 'lizard_m', name: '독술사', color: '#8ae06a', tag: 'element',
    desc: '모든 공격에 강한 독이 묻고, 중독된 적이 죽으면 독이 퍼집니다.', hp: 0, speed: 0, startWeapon: '', skill: '',
    passive: '독 +2, 중독된 적 처치 시 주변에 독 폭발',
    apply: (m) => { m.poison += 2; },
    unlock: { stat: 'itemsCollected', target: 60 },
  },
  {
    kind: 'char', tier: 2, id: 'elementalist', parent: 'mage', sprite: 'wizard_m', name: '원소술사', color: '#ff9a4a', tag: 'element',
    desc: '화염, 냉기, 번개를 한꺼번에 다룹니다.', hp: 0, speed: 0, startWeapon: '', skill: '',
    passive: '화상 +1, 냉기 +1, 연쇄 번개 +1',
    apply: (m) => { m.burn += 1; m.frost += 1; m.chain += 1; },
  },
  {
    kind: 'char', tier: 2, id: 'chronomancer', parent: 'mage', sprite: 'wizard_m', name: '시간술사', color: '#9fc5f8', tag: 'swift',
    desc: '스킬이 시간 왜곡으로 바뀌고, 느려진 적을 강하게 공격합니다.', hp: 0, speed: 0, startWeapon: '', skill: 'slow',
    passive: '스킬이 시간 왜곡으로 바뀜. 스킬 쿨타임 -40%, 시간 왜곡 중이거나 얼어 있는 적에게 피해 +40%',
    apply: (m) => { m.skillCd *= 0.6; },
    unlock: { stat: 'deaths', target: 8 },
  },
  {
    kind: 'char', tier: 2, id: 'bloodlord', parent: 'berserker', sprite: 'dwarf_m', name: '피의 군주', color: '#cc0000', tag: 'blood',
    desc: '적의 피로 싸웁니다. 흡혈과 공격 속도가 크게 오릅니다.', hp: 0, speed: 0, startWeapon: '', skill: '',
    passive: '흡혈 +8%, 공격 속도 +15%, 처치할 때마다 체력 2 회복',
    apply: (m) => { m.lifesteal += 0.08; m.rate *= 1.15; },
  },
  {
    kind: 'char', tier: 2, id: 'undying', parent: 'berserker', sprite: 'dwarf_m', name: '불굴', color: '#b7b7b7', tag: 'guard',
    desc: '죽음을 한 번 거부합니다. 분노 중에는 피해를 덜 받습니다.', hp: 30, speed: 0, startWeapon: '', skill: '',
    passive: '런마다 한 번 치명상을 체력 1로 버티고 2초 무적, 분노 중 받는 피해 -40%',
    unlock: { stat: 'deaths', target: 12 },
  },
];

/** 해당 직업에서 고를 수 있는 다음 전직 */
export const nextJobs = (cur: CharDef): CharDef[] =>
  cur.tier === 0 ? CHARACTERS.filter((c) => c.tier === 1) : CHARACTERS.filter((c) => c.tier === 2 && c.parent === cur.id);

export const SKILLS: SkillDef[] = [
  { kind: 'skill', id: 'dash', sprite: 'potion_yellow', name: '대시', cd: 3.2, desc: '짧게 돌진하며 무적이 됩니다.' },
  {
    kind: 'skill', id: 'nova', sprite: 'w_staff_green', name: '충격파', cd: 9, desc: '주변 적에게 피해를 주고 밀어내며 투사체를 지웁니다.',
    unlock: { stat: 'deaths', target: 1 },
  },
  {
    kind: 'skill', id: 'barrier', sprite: 'w_hammer', name: '방벽', cd: 12, desc: '다음 피해 1회를 완전히 막습니다.',
    unlock: { stat: 'bestRoom', target: 4 },
  },
  {
    kind: 'skill', id: 'turret', sprite: 'w_bow', name: '포탑 설치', cd: 14, desc: '8초간 가까운 적을 자동 공격하는 포탑을 설치합니다.',
    unlock: { stat: 'totalRooms', target: 20 },
  },
  {
    kind: 'skill', id: 'slow', sprite: 'flask_blue', name: '시간 왜곡', cd: 14, desc: '4초간 적과 적 투사체가 느려집니다.',
    unlock: { stat: 'totalKills', target: 250 },
  },
  {
    kind: 'skill', id: 'rage', sprite: 'flask_red', name: '분노', cd: 15, desc: '5초간 피해와 공격 속도가 1.5배가 됩니다.',
    unlock: { stat: 'bestRoom', target: 10 },
  },
];

export const ITEMS: ItemDef[] = [
  // 시작부터 사용 가능
  { kind: 'item', id: 'sharp', tags: ['blade'], sprite: 'w_serrated', name: '날카로운 날', desc: '피해 +20%', apply: (m) => { m.dmg *= 1.2; } },
  { kind: 'item', id: 'boots', tags: ['swift'], sprite: 'potion_blue', name: '신속의 장화', desc: '이동 속도 +15%', apply: (m) => { m.speed *= 1.15; } },
  { kind: 'item', id: 'heart', tags: ['guard'], sprite: 'heart', name: '강화 심장', desc: '최대 체력 +25 (같은 양 회복)', apply: (m) => { m.maxHp += 25; } },
  { kind: 'item', id: 'quick', tags: ['swift'], sprite: 'w_katana', name: '빠른 손', desc: '공격 속도 +20%', apply: (m) => { m.rate *= 1.2; } },
  { kind: 'item', id: 'pierce', tags: ['shot', 'blade'], sprite: 'w_arrow', name: '철갑탄', desc: '관통 +1 (근접은 범위 증가)', apply: (m) => { m.pierce += 1; m.extra += 0.5; } },
  { kind: 'item', id: 'double', tags: ['shot'], sprite: 'w_dagger', name: '쌍발', desc: '투사체 +1 (근접은 범위 증가)', apply: (m) => { m.extra += 1; } },
  {
    kind: 'item', id: 'poison', tags: ['element', 'blood'], sprite: 'g_stinger', name: '독침',
    desc: '공격이 독을 겁니다(최대 5중첩, 3초)', apply: (m) => { m.poison += 1; },
  },
  {
    kind: 'item', id: 'homing', tags: ['shot'], sprite: 'g_feather', name: '유도 깃털',
    desc: '투사체가 가까운 적을 향해 휘어집니다 (근접은 범위 증가)', apply: (m) => { m.homing += 1; m.extra += 0.5; },
  },
  // 해금 필요
  {
    kind: 'item', id: 'frost', tags: ['element'], sprite: 'g_gem_frost', name: '서리 결정',
    desc: '공격이 적을 얼려 1.5초간 40% 느리게 합니다', apply: (m) => { m.frost += 1; }, unlock: { stat: 'deaths', target: 2 },
  },
  {
    kind: 'item', id: 'chain', tags: ['element'], sprite: 'g_bolt', name: '번개 병',
    desc: '공격 시 15% 확률로 번개가 주변 적 2명에게 튑니다', apply: (m) => { m.chain += 1; }, unlock: { stat: 'totalKills', target: 100 },
  },
  {
    kind: 'item', id: 'split', tags: ['blade'], sprite: 'g_orb_split', name: '분열 구슬',
    desc: '적을 처치하면 파편 3개가 사방으로 튑니다', apply: (m) => { m.split += 1; }, unlock: { stat: 'bestRoom', target: 4 },
  },
  {
    kind: 'item', id: 'vampire', tags: ['blood'], sprite: 'potion_red', name: '흡혈 송곳니', desc: '가한 피해의 4%를 체력으로 회복',
    apply: (m) => { m.lifesteal += 0.04; }, unlock: { stat: 'totalKills', target: 80 },
  },
  {
    kind: 'item', id: 'ember', tags: ['element'], sprite: 'w_golden', name: '화염 부적', desc: '공격 시 적에게 화상(3초)',
    apply: (m) => { m.burn += 1; }, unlock: { stat: 'bestRoom', target: 5 },
  },
  {
    kind: 'item', id: 'bounce', tags: ['shot'], sprite: 'w_cleaver', name: '도탄', desc: '투사체가 벽에서 1회 튕김',
    apply: (m) => { m.bounce += 1; }, unlock: { stat: 'totalKills', target: 300 },
  },
  {
    kind: 'item', id: 'blades', tags: ['blade'], sprite: 'w_hatchet', name: '회전 칼날', desc: '몸 주위를 도는 칼날 +1',
    apply: (m) => { m.orbit += 1; }, unlock: { stat: 'bossKills', target: 1 },
  },
  {
    kind: 'item', id: 'thorns', tags: ['guard', 'blood'], sprite: 'w_mace', name: '가시 갑옷', desc: '피격 시 주변 적에게 반격 피해',
    apply: (m) => { m.thorns += 1; }, unlock: { stat: 'deaths', target: 3 },
  },
  {
    kind: 'item', id: 'bomb', tags: ['element'], sprite: 'bomb', name: '폭발 구슬', desc: '적 처치 시 작은 폭발',
    apply: (m) => { m.explode += 1; }, unlock: { stat: 'bossKills', target: 2 },
  },
  {
    kind: 'item', id: 'lens', tags: ['shot'], sprite: 'flask_yellow', name: '치명 렌즈', desc: '치명타 확률 +12% (피해 2배)',
    apply: (m) => { m.crit += 0.12; }, unlock: { stat: 'itemsCollected', target: 25 },
  },
  {
    kind: 'item', id: 'moss', tags: ['guard'], sprite: 'potion_green', name: '재생의 이끼', desc: '초당 체력 0.6 회복',
    apply: (m) => { m.regen += 0.6; }, unlock: { stat: 'deaths', target: 6 },
  },
  {
    kind: 'item', id: 'glass', tags: ['blood'], sprite: 'heart_half', name: '유리 대포', desc: '피해 +60%, 최대 체력 -30',
    apply: (m) => { m.dmg *= 1.6; m.maxHp -= 30; }, unlock: { stat: 'bestRoom', target: 8 },
  },
  {
    kind: 'item', id: 'hourglass', tags: ['swift'], sprite: 'coin', name: '모래시계', desc: '스킬 쿨타임 -25%',
    apply: (m) => { m.skillCd *= 0.75; }, unlock: { stat: 'totalKills', target: 600 },
  },
  {
    kind: 'item', id: 'coin', tags: [], sprite: 'chest', name: '행운의 동전', desc: '보상 선택지 +1 (최대 5)',
    apply: (m) => { m.choices += 1; }, unlock: { stat: 'totalRooms', target: 30 },
  },
];

export const ALL_DEFS: AnyDef[] = [...CHARACTERS, ...ITEMS, ...SKILLS, ...GEAR_BASES];

export const defById = (id: string): AnyDef | undefined => ALL_DEFS.find((d) => d.id === id);
export const itemById = (id: string) => ITEMS.find((d) => d.id === id)!;
export const skillById = (id: string) => SKILLS.find((d) => d.id === id)!;
export const charById = (id: string) => CHARACTERS.find((d) => d.id === id)!;
