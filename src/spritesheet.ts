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
  // 무기: 시트에서 측정한 실제 그림 영역. 칼끝이 위, 손잡이가 아래.
  w_dagger: tile(293, 10, 6, 13),
  w_serrated: tile(307, 10, 10, 21),
  w_iron: tile(323, 10, 10, 21),
  w_knight: tile(339, 10, 10, 21),
  w_hammer_long: tile(291, 26, 10, 37),
  w_hammer: tile(307, 39, 10, 24),
  w_club: tile(323, 41, 10, 22),
  w_mace: tile(339, 39, 10, 24),
  w_katana: tile(293, 66, 6, 29),
  w_greatsword: tile(322, 65, 12, 30),
  w_axe: tile(341, 74, 9, 21),
  w_cleaver: tile(310, 108, 8, 19),
  w_longsword: tile(325, 97, 9, 30),
  w_golden: tile(291, 137, 10, 22),
  w_staff_red: tile(324, 129, 8, 30),
  w_staff_green: tile(340, 129, 8, 30),
  w_double_axe: tile(288, 167, 16, 24),
  w_spear: tile(309, 161, 6, 30),
  w_battle_axe: tile(324, 168, 12, 23),
  w_hatchet: tile(340, 161, 10, 14),
  w_bow: tile(305, 195, 14, 26),
  w_arrow: tile(324, 202, 7, 21),
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
  ladder: tile(48, 96),
  // 장식(메뉴 배경)
  wall_top: tile(16, 0),
  fountain_top: tile(64, 0),
  fountain_mid: { x: 64, y: 16, w: 16, h: 16, n: 3 },
  fountain_basin: { x: 64, y: 32, w: 16, h: 16, n: 3 },
  banner_red: tile(16, 32),
  banner_blue: tile(32, 32),
  banner_green: tile(16, 48),
  banner_yellow: tile(32, 48),
  pillar: tile(80, 80, 16, 40),
  skull: tile(292, 438, 8, 8),
  fountain_mid_blue: { x: 64, y: 48, w: 16, h: 16, n: 3 },
  fountain_basin_blue: { x: 64, y: 64, w: 16, h: 16, n: 3 },
} satisfies Record<string, Spr>;

export type SpriteKey = keyof typeof S;
