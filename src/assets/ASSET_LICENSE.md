# 그래픽 에셋 출처

- 에셋: 16x16 DungeonTileset II v1.7
- 제작자: Robert (0x72), https://0x72.itch.io/dungeontileset-ii
- 라이선스: CC0 (퍼블릭 도메인). 제작자 페이지 문구: "You can use this tileset for whatever you like (CC-0)."
  상업적 사용, 수정, 재배포가 가능하며 출처 표기는 필수가 아닙니다.
- 파일: `dungeon-tileset-ii.png` (512x512, 원본 시트 그대로)

스프라이트 좌표는 `src/spritesheet.ts`에 정리되어 있습니다.

## 보스 3D 모델

- 에셋: KayKit Character Pack: Skeletons 1.0
- 제작자: Kay Lousberg, https://www.kaylousberg.com (배포: https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0)
- 라이선스: CC0 (퍼블릭 도메인). 원본 LICENSE.txt: "This content is free to use in personal, educational and commercial projects."
  출처 표기는 필수가 아닙니다.
- 파일: `src/assets/models/boss1.glb`(Skeleton_Warrior + 도끼, 방패), `boss2.glb`(Skeleton_Rogue + 칼날 2개), `boss3.glb`(Skeleton_Mage + 지팡이), 공용 텍스처 `skeleton_texture.png`.
  `scripts/pack-boss-models.mjs`로 원본에서 쓰는 애니메이션 12개만 남기고 무기를 손에 붙여 만들었습니다.
