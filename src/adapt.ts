// 적응형 진화: 플레이어가 싸우는 방식을 방마다 기록해, 보스를 잡을 때마다 일부 적이 그 방식에 맞서도록 진화한다.
// 기록은 런마다 새로 시작한다.

export type Trait = 'melee' | 'ranged' | 'kite' | 'still' | 'element' | 'skill';

export interface TraitInfo {
  /** 플레이어 성향 이름 */
  style: string;
  /** 적이 얻는 대응 이름 */
  counter: string;
  /** 대응 설명 */
  desc: string;
  color: string;
  /** 이 점수 이상이면 두드러진 성향으로 본다 */
  need: number;
}

export const TRAITS: Record<Trait, TraitInfo> = {
  melee: { style: '근접 위주', counter: '가시 피부', desc: '근접 공격으로 때리면 가시에 찔려 작은 피해를 받습니다. 원거리 공격에는 반응하지 않습니다.', color: '#e05a5a', need: 0.7 },
  ranged: { style: '원거리 위주', counter: '정면 방패', desc: '정면에서 날아온 투사체를 막습니다. 옆이나 뒤에서 맞히거나 근접으로 때리면 됩니다.', color: '#7fb3ff', need: 0.7 },
  kite: { style: '거리 유지형', counter: '예측 사격', desc: '이동 방향을 읽고 도착할 자리로 쏘거나 더 빨리 쫓아옵니다. 발사 직전에 방향을 꺾으면 피할 수 있습니다.', color: '#d58aff', need: 0.5 },
  still: { style: '제자리 난전형', counter: '장판 공격', desc: '서 있는 자리에 폭발 장판을 깝니다. 장판이 터지기 전에 자리를 옮기면 됩니다.', color: '#ffa040', need: 0.45 },
  element: { style: '원소 위주', counter: '원소 저항', desc: '화상과 독 피해가 크게 줄고 빙결이 빨리 풀립니다. 직접 피해는 그대로 들어갑니다.', color: '#7ee08a', need: 0.3 },
  skill: { style: '스킬 의존형', counter: '잠복 폭발', desc: '스킬을 쓰면 무적이 끝날 무렵 그 자리에 늦게 터지는 폭발을 남깁니다.', color: '#ffe14a', need: 0.6 },
};

export const TRAIT_ORDER: Trait[] = ['melee', 'ranged', 'kite', 'still', 'element', 'skill'];

/** 한 방에서 쌓는 전투 기록 */
export interface RoomLog {
  melee: number; // 근접으로 준 피해
  shot: number; // 투사체로 준 피해
  dot: number; // 화상, 독으로 준 피해
  distSum: number; // 가장 가까운 적과의 거리 누적(초 단위 가중)
  moveT: number; // 움직인 시간
  stillT: number; // 서 있던 시간
  combatT: number; // 전투 시간
  skills: number; // 스킬 사용 횟수
}

export const emptyLog = (): RoomLog => ({ melee: 0, shot: 0, dot: 0, distSum: 0, moveT: 0, stillT: 0, combatT: 0, skills: 0 });
export const emptyScores = (): Record<Trait, number> => ({ melee: 0, ranged: 0, kite: 0, still: 0, element: 0, skill: 0 });

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** 한 방의 기록을 성향 점수(0~1)로 바꾼다. 전투가 너무 짧았으면 null. */
export function scoreRoom(l: RoomLog): Record<Trait, number> | null {
  if (l.combatT < 3) return null;
  const direct = l.melee + l.shot;
  const all = direct + l.dot;
  const avgDist = l.distSum / l.combatT;
  const moveRatio = l.moveT / l.combatT;
  return {
    melee: direct > 0 ? l.melee / direct : 0,
    ranged: direct > 0 ? l.shot / direct : 0,
    // 멀리 떨어진 채 계속 움직이면 거리 유지형
    kite: clamp01((avgDist - 120) / 180) * moveRatio,
    still: l.stillT / l.combatT,
    element: all > 0 ? l.dot / all : 0,
    // 6초에 한 번꼴로 스킬을 쓰면 1
    skill: clamp01(l.skills / (l.combatT / 6)),
  };
}

/** 런 누적 점수에 이번 방 점수를 섞는다. 최근 방일수록 비중이 크다. */
export function blend(acc: Record<Trait, number>, room: Record<Trait, number>, first: boolean) {
  for (const t of TRAIT_ORDER) acc[t] = first ? room[t] : acc[t] * 0.5 + room[t] * 0.5;
}

/** 두드러진 성향을 강한 순서로 최대 n개 고른다. */
export function pickTraits(acc: Record<Trait, number>, n: number): Trait[] {
  return TRAIT_ORDER
    .map((t) => ({ t, k: acc[t] / TRAITS[t].need }))
    .filter((x) => x.k >= 1)
    .sort((a, b) => b.k - a.k)
    .slice(0, n)
    .map((x) => x.t);
}

/** 적응 단계(보스 처치 수)에 따른 적응 개체 비율과 고르는 성향 수 */
export const ADAPT_LEVEL = [
  { share: 0, traits: 0 },
  { share: 0.3, traits: 1 },
  { share: 0.4, traits: 2 },
];
