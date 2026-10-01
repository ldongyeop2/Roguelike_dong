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
});

interface Base {
  id: string;
  name: string;
  desc: string;
  unlock?: Unlock;
}

export type Weapon = 'melee' | 'bolt' | 'pierce' | 'spread';

export interface CharDef extends Base {
  kind: 'char';
  hp: number;
  speed: number;
  weapon: Weapon;
  dmg: number;
  cd: number;
  skill: string;
  color: string;
}

export interface ItemDef extends Base {
  kind: 'item';
  apply(m: Mods): void;
}

export interface SkillDef extends Base {
  kind: 'skill';
  cd: number;
}

export type AnyDef = CharDef | ItemDef | SkillDef;

export const CHARACTERS: CharDef[] = [
  {
    kind: 'char', id: 'knight', name: '기사', color: '#6fa8dc',
    desc: '부채꼴로 검을 휘둘러 적과 투사체를 베어냅니다. 튼튼합니다.',
    hp: 120, speed: 190, weapon: 'melee', dmg: 24, cd: 0.5, skill: 'barrier',
  },
  {
    kind: 'char', id: 'ranger', name: '레인저', color: '#93c47d',
    desc: '빠르게 화살을 쏩니다. 거리를 유지하며 싸우는 기본형.',
    hp: 85, speed: 210, weapon: 'bolt', dmg: 11, cd: 0.3, skill: 'dash',
    unlock: { stat: 'bestRoom', target: 3 },
  },
  {
    kind: 'char', id: 'rogue', name: '도적', color: '#c27ba0',
    desc: '단검 3발을 부채꼴로 던집니다. 사거리가 짧지만 가까우면 강력합니다.',
    hp: 80, speed: 240, weapon: 'spread', dmg: 8, cd: 0.5, skill: 'dash',
    unlock: { stat: 'deaths', target: 4 },
  },
  {
    kind: 'char', id: 'mage', name: '마법사', color: '#8e7cc3',
    desc: '느리지만 적을 꿰뚫는 큰 마력구를 발사합니다.',
    hp: 70, speed: 190, weapon: 'pierce', dmg: 30, cd: 0.85, skill: 'nova',
    unlock: { stat: 'totalKills', target: 150 },
  },
  {
    kind: 'char', id: 'berserker', name: '광전사', color: '#e06666',
    desc: '체력이 낮을수록 피해가 최대 2배까지 증가합니다. 빠른 근접 공격.',
    hp: 110, speed: 200, weapon: 'melee', dmg: 20, cd: 0.38, skill: 'rage',
    unlock: { stat: 'bossKills', target: 1 },
  },
];

export const SKILLS: SkillDef[] = [
  { kind: 'skill', id: 'dash', name: '대시', cd: 3.2, desc: '짧게 돌진하며 무적이 됩니다.' },
  {
    kind: 'skill', id: 'nova', name: '충격파', cd: 9, desc: '주변 적에게 피해를 주고 밀어내며 투사체를 지웁니다.',
    unlock: { stat: 'deaths', target: 1 },
  },
  {
    kind: 'skill', id: 'barrier', name: '방벽', cd: 12, desc: '다음 피해 1회를 완전히 막습니다.',
    unlock: { stat: 'bestRoom', target: 4 },
  },
  {
    kind: 'skill', id: 'turret', name: '포탑 설치', cd: 14, desc: '8초간 가까운 적을 자동 공격하는 포탑을 설치합니다.',
    unlock: { stat: 'totalRooms', target: 20 },
  },
  {
    kind: 'skill', id: 'slow', name: '시간 왜곡', cd: 14, desc: '4초간 적과 적 투사체가 느려집니다.',
    unlock: { stat: 'totalKills', target: 250 },
  },
  {
    kind: 'skill', id: 'rage', name: '분노', cd: 15, desc: '5초간 피해와 공격 속도가 1.5배가 됩니다.',
    unlock: { stat: 'bestRoom', target: 10 },
  },
];

export const ITEMS: ItemDef[] = [
  // 시작부터 사용 가능
  { kind: 'item', id: 'sharp', name: '날카로운 날', desc: '피해 +20%', apply: (m) => { m.dmg *= 1.2; } },
  { kind: 'item', id: 'boots', name: '신속의 장화', desc: '이동 속도 +15%', apply: (m) => { m.speed *= 1.15; } },
  { kind: 'item', id: 'heart', name: '강화 심장', desc: '최대 체력 +25 (같은 양 회복)', apply: (m) => { m.maxHp += 25; } },
  { kind: 'item', id: 'quick', name: '빠른 손', desc: '공격 속도 +20%', apply: (m) => { m.rate *= 1.2; } },
  { kind: 'item', id: 'pierce', name: '철갑탄', desc: '관통 +1 (근접은 범위 증가)', apply: (m) => { m.pierce += 1; m.extra += 0.5; } },
  { kind: 'item', id: 'double', name: '쌍발', desc: '투사체 +1 (근접은 범위 증가)', apply: (m) => { m.extra += 1; } },
  // 해금 필요
  {
    kind: 'item', id: 'vampire', name: '흡혈 송곳니', desc: '가한 피해의 4%를 체력으로 회복',
    apply: (m) => { m.lifesteal += 0.04; }, unlock: { stat: 'totalKills', target: 80 },
  },
  {
    kind: 'item', id: 'ember', name: '화염 부적', desc: '공격 시 적에게 화상(3초)',
    apply: (m) => { m.burn += 1; }, unlock: { stat: 'bestRoom', target: 5 },
  },
  {
    kind: 'item', id: 'bounce', name: '도탄', desc: '투사체가 벽에서 1회 튕김',
    apply: (m) => { m.bounce += 1; }, unlock: { stat: 'totalKills', target: 300 },
  },
  {
    kind: 'item', id: 'blades', name: '회전 칼날', desc: '몸 주위를 도는 칼날 +1',
    apply: (m) => { m.orbit += 1; }, unlock: { stat: 'bossKills', target: 1 },
  },
  {
    kind: 'item', id: 'thorns', name: '가시 갑옷', desc: '피격 시 주변 적에게 반격 피해',
    apply: (m) => { m.thorns += 1; }, unlock: { stat: 'deaths', target: 3 },
  },
  {
    kind: 'item', id: 'bomb', name: '폭발 구슬', desc: '적 처치 시 작은 폭발',
    apply: (m) => { m.explode += 1; }, unlock: { stat: 'bossKills', target: 2 },
  },
  {
    kind: 'item', id: 'lens', name: '치명 렌즈', desc: '치명타 확률 +12% (피해 2배)',
    apply: (m) => { m.crit += 0.12; }, unlock: { stat: 'itemsCollected', target: 25 },
  },
  {
    kind: 'item', id: 'moss', name: '재생의 이끼', desc: '초당 체력 0.6 회복',
    apply: (m) => { m.regen += 0.6; }, unlock: { stat: 'deaths', target: 6 },
  },
  {
    kind: 'item', id: 'glass', name: '유리 대포', desc: '피해 +60%, 최대 체력 -30',
    apply: (m) => { m.dmg *= 1.6; m.maxHp -= 30; }, unlock: { stat: 'bestRoom', target: 8 },
  },
  {
    kind: 'item', id: 'hourglass', name: '모래시계', desc: '스킬 쿨타임 -25%',
    apply: (m) => { m.skillCd *= 0.75; }, unlock: { stat: 'totalKills', target: 600 },
  },
  {
    kind: 'item', id: 'coin', name: '행운의 동전', desc: '보상 선택지 +1 (최대 5)',
    apply: (m) => { m.choices += 1; }, unlock: { stat: 'totalRooms', target: 30 },
  },
];

export const ALL_DEFS: AnyDef[] = [...CHARACTERS, ...ITEMS, ...SKILLS];

export const defById = (id: string): AnyDef | undefined => ALL_DEFS.find((d) => d.id === id);
export const itemById = (id: string) => ITEMS.find((d) => d.id === id)!;
export const skillById = (id: string) => SKILLS.find((d) => d.id === id)!;
export const charById = (id: string) => CHARACTERS.find((d) => d.id === id)!;
