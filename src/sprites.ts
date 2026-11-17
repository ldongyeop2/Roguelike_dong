// 구운 스프라이트 시트의 캐시. WebGL을 쓸 수 없으면 null을 돌려주고, 호출한 쪽은 벡터 그림으로 대체한다.
import { bakeSheet, bakeStill, type Sheet } from './bake';
import { SPECIES, type NpcDef } from './data';
import { human, monster, objectSpec, type HumanLook } from './models';

const sheets = new Map<string, Sheet | null>();
const PLAYER: HumanLook = { hair: '#c8502f', top: '#3f6fd0', bottom: '#4a4a5f', skin: '#ffe0c0', sword: true };

export function playerSheet(): Sheet | null {
  if (!sheets.has('player')) sheets.set('player', bakeSheet(() => human(PLAYER), 128, 1.5));
  return sheets.get('player')!;
}

export function npcSheet(n: NpcDef): Sheet | null {
  const key = 'npc:' + n.role;
  if (!sheets.has(key)) {
    const hat = n.role === 'mix' ? 'wizard' : n.role === 'heal' ? 'nurse' : 'pack';
    const look: HumanLook = { hair: n.hair, top: n.top, bottom: '#5a4a3f', skin: '#ffe0c0', sword: false, hat };
    sheets.set(key, bakeSheet(() => human(look), 128, 2, 8, true));
  }
  return sheets.get(key)!;
}

export function speciesSheet(id: string): Sheet | null {
  const key = 'sp:' + id;
  if (!sheets.has(key)) {
    const sp = SPECIES[id];
    const F = Math.ceil(108 * Math.max(1, sp.size));
    sheets.set(key, bakeSheet(() => monster(sp), F, Math.min(1.5, 1.8 / sp.size)));
  }
  return sheets.get(key)!;
}

export function objectSheet(type: string, v: number): Sheet | null {
  const key = `obj:${type}:${v}`;
  if (!sheets.has(key)) {
    const s = objectSpec(type, v);
    sheets.set(key, bakeStill(s.make, s.w, s.h, s.ax, s.ay, 2, s.shadow));
  }
  return sheets.get(key)!;
}

/** 지금 필요한 종만 남기고 나머지 몬스터 시트의 메모리를 돌려준다. */
export function retainSpecies(ids: Set<string>) {
  for (const [key, s] of sheets) {
    if (!key.startsWith('sp:') || ids.has(key.slice(3))) continue;
    if (s) s.c.width = 0;
    sheets.delete(key);
  }
}

const icons = new Map<string, string | null>();
/** UI용 몬스터 초상화. 3D로 구울 수 없으면 null. */
export function speciesIcon3d(id: string): string | null {
  if (!icons.has(id)) {
    const sp = SPECIES[id];
    const k = Math.min(1, 0.95 / sp.size);
    const s = bakeStill(() => {
      const m = monster(sp);
      m.root.scale.setScalar(k);
      return m;
    }, 64, 64, 32, 52, 2, 13, -0.3);
    icons.set(id, s ? s.c.toDataURL() : null);
    if (s) s.c.width = 0;
  }
  return icons.get(id)!;
}
