// 0x72 DungeonTileset II v1.7 시트(512x512)의 스프라이트 좌표.
// 좌표는 시트의 불투명 픽셀 영역을 직접 측정해 정한 값이다.
// n: 가로로 이어진 프레임 수(0~3 대기, 4~7 이동, 8 피격). 생략하면 정지 이미지.

export interface Spr {
  x: number;
  y: number;
  w: number;
  h: number;
  n?: number;
}

const char = (y: number): Spr => ({ x: 128, y, w: 16, h: 28, n: 9 });
const mob = (y: number, h = 16): Spr => ({ x: 368, y, w: 16, h, n: 8 });
const big = (y: number): Spr => ({ x: 16, y, w: 32, h: 36, n: 8 });
const tile = (x: number, y: number, w = 16, h = 16): Spr => ({ x, y, w, h });

export const S = {
  // 캐릭터
  knight_m: char(100),
  elf_m: char(36),
  wizard_m: char(164),
  lizard_m: char(228),
  dwarf_m: char(292),
  // 일반 적
  orc_warrior: mob(184),
  orc_shaman: mob(208),
  imp: mob(64),
  chort: mob(272, 24),
  pumpkin: mob(320, 24),
  // 보스
  big_zombie: big(332),
  ogre: big(380),
  big_demon: big(428),
  // 무기
  w_knight: tile(336, 8, 16, 24),
  w_rapier: tile(320, 8, 16, 24),
  w_serrated: tile(304, 8, 16, 24),
  w_dagger: tile(288, 8),
  w_hammer: tile(288, 24, 16, 40),
  w_mace: tile(320, 64, 16, 32),
  w_cleaver: tile(304, 104, 16, 24),
  w_golden: tile(288, 136, 16, 24),
  w_staff_red: tile(320, 128, 16, 32),
  w_staff_green: tile(336, 128, 16, 32),
  w_hatchet: tile(336, 160),
  w_axe: tile(288, 166, 16, 26),
  w_bow: tile(295, 194, 9, 28),
  w_arrow: tile(320, 200, 16, 24),
  // 소모품, 기타
  bomb: tile(288, 320),
  potion_red: tile(288, 336),
  potion_blue: tile(304, 336),
  potion_green: tile(320, 336),
  potion_yellow: tile(336, 336),
  flask_red: tile(288, 352),
  flask_blue: tile(304, 352),
  flask_green: tile(320, 352),
  flask_yellow: tile(336, 352),
  heart: tile(288, 368),
  heart_half: tile(304, 368),
  coin: tile(288, 384, 8, 8),
  chest: tile(304, 400),
  // 타일
  wall: tile(32, 16),
  floor_1: tile(16, 64),
  floor_2: tile(32, 64),
  floor_3: tile(48, 64),
  floor_4: tile(16, 80),
} satisfies Record<string, Spr>;

export type SpriteKey = keyof typeof S;
