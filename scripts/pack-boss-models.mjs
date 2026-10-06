// KayKit Character Pack: Skeletons(CC0) 원본에서 보스용 GLB를 만든다.
// 쓰는 애니메이션만 남기고, 무기를 손 슬롯에 붙여 src/assets/models/boss1~3.glb로 저장한다.
// 호스팅 환경이 네트워크 요청(fetch)을 막을 수 있어서 모델은 게임 코드에 직접 넣고(?inline),
// 텍스처는 빼서 skeleton_texture.png 하나로 따로 둔다(이미지 태그로 불러온다).
//   git clone --depth 1 https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0 kaykit-skeletons
//   node scripts/pack-boss-models.mjs kaykit-skeletons
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { mergeDocuments, prune, dedup, resample } from '@gltf-transform/functions';
const A = `${process.argv[2] ?? 'kaykit-skeletons'}/addons/kaykit_character_pack_skeletons`;
const OUT = 'src/assets/models';
mkdirSync(OUT, { recursive: true });
copyFileSync(`${A}/Characters/gltf/skeleton_texture.png`, `${OUT}/skeleton_texture.png`);
const KEEP = new Set(['Idle_Combat','Walking_A','Running_A','1H_Melee_Attack_Chop','Dualwield_Melee_Attack_Slice','Spellcast_Shoot','Spellcasting','Spellcast_Summon','Taunt','Hit_A','Death_C_Skeletons','Spawn_Ground_Skeletons']);
const BOSSES = [
  ['boss1', 'Skeleton_Warrior', [['Skeleton_Axe', 'handslot.r'], ['Skeleton_Shield_Large_A', 'handslot.l']]],
  ['boss2', 'Skeleton_Rogue', [['Skeleton_Blade', 'handslot.r'], ['Skeleton_Blade', 'handslot.l']]],
  ['boss3', 'Skeleton_Mage', [['Skeleton_Staff', 'handslot.r']]],
];
const io = new NodeIO();
for (const [out, ch, weapons] of BOSSES) {
  const doc = await io.read(`${A}/Characters/gltf/${ch}.glb`);
  const root = doc.getRoot();
  for (const a of root.listAnimations()) if (!KEEP.has(a.getName())) { for (const s of a.listSamplers()) { s.dispose(); } for (const c of a.listChannels()) c.dispose(); a.dispose(); }
  const scene = root.listScenes()[0];
  for (const [w, slot] of weapons) {
    const src = await io.read(`${A}/Assets/gltf/${w}.gltf`);
    const srcScene = src.getRoot().listScenes()[0];
    const map = mergeDocuments(doc, src);
    const newScene = map.get(srcScene);
    const hand = root.listNodes().find((n) => n.getName() === slot);
    for (const n of newScene.listChildren()) { newScene.removeChild(n); hand.addChild(n); }
    newScene.dispose();
  }
  const buf = root.listBuffers()[0];
  for (const acc of root.listAccessors()) acc.setBuffer(buf);
  for (const b of root.listBuffers()) if (b !== buf) b.dispose();
  root.setDefaultScene(scene);
  // 텍스처는 게임에서 따로 입힌다.
  for (const m of root.listMaterials()) m.setBaseColorTexture(null);
  for (const t of root.listTextures()) t.dispose();
  await doc.transform(dedup(), resample(), prune({ keepAttributes: true }));
  writeFileSync(`${OUT}/${out}.glb`, await io.writeBinary(doc));
  console.log(out, root.listAnimations().map(a=>a.getName()).length, 'anims');
}
