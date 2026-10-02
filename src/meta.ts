import { ALL_DEFS, type AnyDef, type StatKey, type Unlock } from './content';

const KEY = 'roguelike_dong_save_v1';

export interface Save {
  unlocked: string[];
  stats: Record<StatKey, number>;
  lastChar: string;
  discovered: string[]; // 발견한 아이템 시너지 id
}

export interface RunResult {
  won: boolean;
  char: string;
  room: number; // 도달한 방
  kills: number;
  bossKills: number;
  roomsCleared: number;
  itemsCollected: number;
  abandoned?: boolean; // 포기한 런은 사망으로 집계하지 않는다(해금 악용 방지)
}

const emptyStats = (): Record<StatKey, number> => ({
  totalKills: 0,
  deaths: 0,
  bestRoom: 0,
  bossKills: 0,
  wins: 0,
  totalRooms: 0,
  itemsCollected: 0,
});

export function defaultSave(): Save {
  return {
    unlocked: ALL_DEFS.filter((d) => !d.unlock).map((d) => d.id),
    stats: emptyStats(),
    lastChar: 'knight',
    discovered: [],
  };
}

export function loadSave(): Save {
  const base = defaultSave();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<Save>;
    const unlocked = new Set([...base.unlocked, ...(parsed.unlocked ?? [])]);
    const stats = { ...base.stats, ...(parsed.stats ?? {}) };
    // 콘텐츠가 바뀌어 조건을 이미 채운 항목이 생겼을 수 있으니 불러올 때도 해금을 판정한다.
    for (const d of ALL_DEFS) if (d.unlock && stats[d.unlock.stat] >= d.unlock.target) unlocked.add(d.id);
    return {
      unlocked: [...unlocked],
      stats,
      lastChar: parsed.lastChar ?? base.lastChar,
      discovered: parsed.discovered ?? [],
    };
  } catch {
    return base;
  }
}

export function persist(save: Save): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // 저장소를 쓸 수 없는 환경에서는 이번 세션에만 유지된다.
  }
}

export function resetSave(): Save {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 무시
  }
  return defaultSave();
}

export const isUnlocked = (save: Save, id: string) => save.unlocked.includes(id);

export function progressOf(save: Save, u: Unlock) {
  const cur = Math.min(save.stats[u.stat], u.target);
  return { cur, target: u.target, done: save.stats[u.stat] >= u.target };
}

/** 런 결과를 누적 통계에 반영하고, 새로 해금된 항목을 반환한다. */
export function applyRunResult(save: Save, r: RunResult): AnyDef[] {
  const s = save.stats;
  s.totalKills += r.kills;
  s.bossKills += r.bossKills;
  s.totalRooms += r.roomsCleared;
  s.itemsCollected += r.itemsCollected;
  s.bestRoom = Math.max(s.bestRoom, r.room);
  if (r.won) s.wins += 1;
  else if (!r.abandoned) s.deaths += 1;

  const newly: AnyDef[] = [];
  for (const d of ALL_DEFS) {
    if (!d.unlock || isUnlocked(save, d.id)) continue;
    if (s[d.unlock.stat] >= d.unlock.target) {
      save.unlocked.push(d.id);
      newly.push(d);
    }
  }
  save.lastChar = r.char;
  persist(save);
  return newly;
}

/** 처음 발동한 시너지를 기록한다. 새로 발견했으면 true. */
export function discover(save: Save, id: string): boolean {
  if (save.discovered.includes(id)) return false;
  save.discovered.push(id);
  persist(save);
  return true;
}
