// 아이템 조합 규칙.
// 1) 세트: 같은 태그의 아이템을 서로 다른 종류로 3개 모으면 발동(아이작의 변신과 비슷).
// 2) 조합: 특정 아이템 두 개를 함께 가지면 발동하는 이름 있는 시너지.

export type Tag = 'blade' | 'shot' | 'element' | 'blood' | 'guard' | 'swift';

export const TAG_INFO: Record<Tag, { name: string; color: string }> = {
  blade: { name: '칼날', color: '#d8dde6' },
  shot: { name: '사격', color: '#8fd0ff' },
  element: { name: '원소', color: '#ffb35c' },
  blood: { name: '피', color: '#ff6a6a' },
  guard: { name: '수호', color: '#9ad08a' },
  swift: { name: '신속', color: '#f0e070' },
};

export const SET_NEED = 3;

export interface SetBonus { id: string; tag: Tag; name: string; desc: string }
export const SETS: SetBonus[] = [
  { id: 'set:blade', tag: 'blade', name: '칼날 폭풍', desc: '공격 4번마다 주위로 칼날 파편 8개를 흩뿌립니다.' },
  { id: 'set:shot', tag: 'shot', name: '명사수', desc: '투사체 관통 +1, 탄속 +30%. 근접 무기는 사거리 +20%.' },
  { id: 'set:element', tag: 'element', name: '원소술사', desc: '화상이나 독에 걸린 적이 죽으면 그 상태이상이 주변 적에게 옮겨 붙습니다.' },
  { id: 'set:blood', tag: 'blood', name: '흡혈귀', desc: '흡혈 +5%, 처치 시 체력 2 회복, 체력 40% 미만일 때 피해 +30%.' },
  { id: 'set:guard', tag: 'guard', name: '철벽', desc: '10초마다 피해 1회를 막는 보호막이 생깁니다.' },
  { id: 'set:swift', tag: 'swift', name: '질풍', desc: '이동 속도 +15%, 움직이는 동안 공격 속도 +20%.' },
];

export interface PairSynergy { id: string; name: string; desc: string; items: [string, string] }
export const PAIRS: PairSynergy[] = [
  { id: 'fire_blast', name: '화염 폭발', items: ['ember', 'bomb'], desc: '처치 폭발 범위 +30, 피해 1.5배. 폭발에 휩쓸린 적에게 불이 붙습니다.' },
  { id: 'toxic_fire', name: '독연', items: ['poison', 'ember'], desc: '화상과 독에 동시에 걸린 적은 두 지속 피해를 2배로 받습니다.' },
  { id: 'superconduct', name: '초전도', items: ['frost', 'chain'], desc: '얼어붙은 적을 때리면 번개가 반드시 튀고, 한 번 더 이어집니다.' },
  { id: 'fire_wheel', name: '불꽃 바퀴', items: ['blades', 'ember'], desc: '회전 칼날이 더 크고 빠르게 돌며 피해가 1.5배가 됩니다.' },
  { id: 'blood_thorns', name: '피의 가시', items: ['thorns', 'vampire'], desc: '가시 반격으로 준 피해의 50%를 체력으로 회복합니다.' },
  { id: 'tracking', name: '추적 탄막', items: ['double', 'homing'], desc: '투사체 +1, 유도 성능이 크게 오릅니다.' },
  { id: 'ricochet', name: '튕기는 관통', items: ['bounce', 'pierce'], desc: '벽에 튕길 때마다 관통 +1, 피해 +20%.' },
  { id: 'chain_blast', name: '연쇄 폭발', items: ['split', 'bomb'], desc: '분열 파편이 적에게 닿으면 작게 폭발합니다.' },
  { id: 'execute', name: '처형', items: ['lens', 'glass'], desc: '치명타 피해가 2배에서 3배로 늘어납니다.' },
  { id: 'overclock', name: '가속 회로', items: ['hourglass', 'boots'], desc: '스킬을 쓰면 2.5초 동안 공격 속도 +50%.' },
];

export const SYN_NAME = new Map<string, string>([
  ...SETS.map((s) => [s.id, s.name] as [string, string]),
  ...PAIRS.map((p) => [p.id, p.name] as [string, string]),
]);

/** 가진 아이템(id 목록)과 각 아이템의 태그로 발동 중인 시너지 id 집합을 구한다. */
export function activeSynergies(items: Iterable<string>, tagsOf: (id: string) => Tag[]): Set<string> {
  const have = new Set(items);
  const out = new Set<string>();
  for (const [tag, n] of tagCounts(have, tagsOf)) if (n >= SET_NEED) out.add(`set:${tag}`);
  for (const p of PAIRS) if (have.has(p.items[0]) && have.has(p.items[1])) out.add(p.id);
  return out;
}

/** 태그별로 서로 다른 아이템 수 */
export function tagCounts(items: Iterable<string>, tagsOf: (id: string) => Tag[]): Map<Tag, number> {
  const m = new Map<Tag, number>();
  for (const id of new Set(items)) for (const t of tagsOf(id)) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}
