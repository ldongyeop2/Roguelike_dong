// KayKit Character Pack: Skeletons(CC0) 원본에서 보스용 GLB를 만든다.
// 쓰는 애니메이션만 남기고, 무기를 손 슬롯에 붙여 public/models/boss1~3.json으로 저장한다.
// 호스팅 환경이 .glb를 서빙하지 않아서, 버퍼와 텍스처를 data URI로 넣은 glTF JSON으로 저장한다.
//   git clone --depth 1 https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0 kaykit-skeletons
//   node scripts/pack-boss-models.mjs kaykit-skeletons
import { writeFileSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { mergeDocuments, prune, dedup, resample } from '@gltf-transform/functions';
const A = `${process.argv[2] ?? 'kaykit-skeletons'}/addons/kaykit_character_pack_skeletons`;
const OUT = 'public/models';
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
  await doc.transform(dedup(), resample(), prune());
  const { json, resources } = await io.writeJSON(doc);
  const mime = (uri) => (uri.endsWith('.png') ? 'image/png' : uri.endsWith('.jpg') ? 'image/jpeg' : 'application/octet-stream');
  const embed = (o) => { if (o.uri && resources[o.uri]) o.uri = `data:${mime(o.uri)};base64,${Buffer.from(resources[o.uri]).toString('base64')}`; };
  for (const b of json.buffers ?? []) embed(b);
  for (const im of json.images ?? []) embed(im);
  writeFileSync(`${OUT}/${out}.json`, JSON.stringify(json));
  console.log(out, root.listAnimations().map(a=>a.getName()).length, 'anims');
}
