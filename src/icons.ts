// 시트에 없는 방어구/장신구 아이콘을 12x12 픽셀아트로 직접 그린다.
// 문자: '.' 투명, o 외곽선, a 기본색, b 밝은 색, c 어두운 색, d 포인트 색

const SHAPES = {
  helm: [
    '....oooo....', '..ooaabaoo..', '.oaaabbaaao.', '.oaabaaaaao.',
    'oaaaaaaaaaao', 'oaoooooooaao', 'oaaaaaaaaaao', 'oacaaaaaacao',
    '.occaaaacco.', '.occo..occo.', '..oo....oo..', '............',
  ],
  cap: [
    '............', '.....oo.....', '....oado....', '...oaaaao...',
    '..oaabaaao..', '..oabaaaao..', '.oaaaaaaaao.', 'oddddddddddo',
    'oddddddddddo', '.oooooooooo.', '............', '............',
  ],
  armor: [
    '..oo....oo..', '.oaao..oaao.', 'oaabaooabaao', 'oaaabaaaaaao',
    'oaabaaaaaaco', '.oabaaaaaco.', '.oaaaaaaaco.', '.oaaddddaco.',
    '.oaaaaaaaco.', '.occaaaacco.', '..oooooooo..', '............',
  ],
  robe: [
    '....oooo....', '...oaaaao...', '..oaabaaao..', '.oaaabaaaao.',
    '.oaabaaaaao.', '.oaaaddaaao.', '.oaaaddaaao.', 'oaaaaddaaaao',
    'oaabaddaaaco', 'oaaaaddaaaco', 'occccddcccco', '.oooooooooo.',
  ],
  boots: [
    '............', '..oooo......', '..oabo......', '..oabo......',
    '..oaao......', '..oaao......', '..oaaoooo...', '..oabaaaaoo.',
    '.oaabaaaaaao', '.oddddddddo.', '.oooooooooo.', '............',
  ],
  ring: [
    '............', '.....oo.....', '....oddo....', '...odbddo...',
    '....oddo....', '...oaooao...', '..oao..oao..', '..oa....ao..',
    '..oa....ao..', '..oao..oao..', '...oaaaao...', '....oooo....',
  ],
  amulet: [
    '.oo......oo.', '.oao....oao.', '..oao..oao..', '...oaooao...',
    '....oaao....', '....oddo....', '...odbddo...', '..odbddddo..',
    '..oddddddo..', '...odddco...', '....oddo....', '.....oo.....',
  ],
} as const;

type Palette = Record<'o' | 'a' | 'b' | 'c' | 'd', string>;

const PAL: Record<string, Palette> = {
  leather: { o: '#2b1a12', a: '#8a5a33', b: '#b07a4a', c: '#5e3a20', d: '#c9a25a' },
  iron: { o: '#1d1f26', a: '#8d96a6', b: '#c9d1dc', c: '#5b6372', d: '#3a3f4a' },
  gold: { o: '#3a2408', a: '#d9a53a', b: '#ffe08a', c: '#a0701c', d: '#c0392b' },
  cloth: { o: '#1a1630', a: '#4a5aa8', b: '#7a8ae0', c: '#323d78', d: '#e0c050' },
  wind: { o: '#10302a', a: '#3fb5a0', b: '#9ff0de', c: '#24786a', d: '#e8f8ff' },
  silver: { o: '#1d1f26', a: '#b8c0cc', b: '#ffffff', c: '#7d8696', d: '#5ad1ff' },
  ruby: { o: '#3a2408', a: '#d9a53a', b: '#ffd0d0', c: '#a0701c', d: '#e0303a' },
  emerald: { o: '#1d1f26', a: '#b8c0cc', b: '#d8ffe0', c: '#7d8696', d: '#3ac46a' },
  goldring: { o: '#3a2408', a: '#d9a53a', b: '#fff6c0', c: '#a0701c', d: '#ffe08a' },
  blood: { o: '#200a10', a: '#7a2a3a', b: '#ff99aa', c: '#4a1520', d: '#ff3355' },
};

export const GEN = {
  g_cap_leather: ['cap', 'leather'],
  g_cap_cloth: ['cap', 'cloth'],
  g_helm_iron: ['helm', 'iron'],
  g_helm_gold: ['helm', 'gold'],
  g_armor_leather: ['armor', 'leather'],
  g_armor_iron: ['armor', 'iron'],
  g_armor_gold: ['armor', 'gold'],
  g_robe_cloth: ['robe', 'cloth'],
  g_boots_leather: ['boots', 'leather'],
  g_boots_iron: ['boots', 'iron'],
  g_boots_wind: ['boots', 'wind'],
  g_ring_silver: ['ring', 'silver'],
  g_ring_emerald: ['ring', 'emerald'],
  g_ring_gold: ['ring', 'goldring'],
  g_amulet_ruby: ['amulet', 'ruby'],
  g_amulet_blood: ['amulet', 'blood'],
} satisfies Record<string, [keyof typeof SHAPES, keyof typeof PAL]>;

export type GenKey = keyof typeof GEN;
export const GEN_SIZE = 12;

export const isGenKey = (k: string): k is GenKey => k in GEN;

const cache = new Map<GenKey, HTMLCanvasElement>();
const urlCache = new Map<GenKey, string>();

/** 아이콘 하나를 12x12 캔버스로 만든다(캐시). */
export function genCanvas(key: GenKey): HTMLCanvasElement {
  const hit = cache.get(key);
  if (hit) return hit;
  const [shape, pal] = GEN[key];
  const rows = SHAPES[shape];
  const p = PAL[pal];
  const cv = document.createElement('canvas');
  cv.width = GEN_SIZE;
  cv.height = GEN_SIZE;
  const c = cv.getContext('2d')!;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x] as keyof Palette | '.';
      if (ch === '.') continue;
      c.fillStyle = p[ch];
      c.fillRect(x, y, 1, 1);
    }
  });
  cache.set(key, cv);
  return cv;
}

export function genUrl(key: GenKey): string {
  let u = urlCache.get(key);
  if (!u) {
    u = genCanvas(key).toDataURL();
    urlCache.set(key, u);
  }
  return u;
}
