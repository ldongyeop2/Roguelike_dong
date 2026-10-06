// 보스만 3D 모델로 그린다. 게임 로직은 2D 그대로 두고, 보이지 않는 WebGL 캔버스에
// 보스를 낮은 해상도로 렌더링한 뒤 2D 화면의 보스 위치에 픽셀 느낌으로 확대해 붙인다.
// 모델: KayKit Character Pack Skeletons (Kay Lousberg, CC0). public/models/boss*.json (glTF)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RAGE_EYE, RAGE_RAMP, recolor } from './rage';

/** 보스 동작. 게임이 넘겨 주는 상태를 보고 애니메이션을 고른다. */
export interface BossPose {
  x: number;
  y: number; // 발 위치(화면 좌표)
  r: number;
  tier: number;
  spawnT: number;
  state: number; // 0 추적 / 1 준비 / 2 돌진
  spiralT: number;
  flash: number;
  faceX: number; // 바라볼 방향(화면 좌표 벡터)
  faceY: number;
  act: number; // 공격할 때마다 1씩 늘어나는 번호
  actKind: 'attack' | 'summon';
  phase2: boolean; // 체력 50% 이하: 뿔이 돋고 몸이 붉게 타오른다
  roar: boolean; // 2페이즈로 넘어가며 포효하는 중
}

interface Model {
  root: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  clips: Map<string, THREE.AnimationAction>;
  mats: THREE.MeshStandardMaterial[];
  loop: string; // 지금 반복 중인 동작
  oneShot: THREE.AnimationAction | null;
  lastAct: number;
  yaw: number;
  head: THREE.Object3D | null; // 뿔이 따라갈 머리 뼈
  horns: THREE.Group; // 2페이즈 뿔
  hornUp: number; // 머리 뼈에서 뿔까지 높이
  rageMap: THREE.Texture | null; // 2페이즈 텍스처(원본 텍스처를 팔레트로 다시 칠한 것)
}

const RES = 112; // 3D 렌더 해상도(px). 화면에서는 2.5~3배로 확대된다.
const VIEW = 1.7; // 렌더 캔버스가 담는 월드 크기(모델 키 = 1)
const PITCH = (28 * Math.PI) / 180; // 내려다보는 각도
const ATTACK: Record<number, string> = { 1: '1H_Melee_Attack_Chop', 2: 'Dualwield_Melee_Attack_Slice', 3: 'Spellcast_Shoot' };
// 단계별 분위기 색: 눈빛과 몸의 은은한 발광
const TINT: Record<number, { eye: number; body: number; bodyI: number }> = {
  1: { eye: 0xff5a3a, body: 0x000000, bodyI: 0 },
  2: { eye: 0xc070ff, body: 0x2a0a40, bodyI: 0.35 },
  3: { eye: 0xff2050, body: 0x3a0010, bodyI: 0.5 },
};
const PHASE2_SCALE = 1.15;
/** 뿔 모양(모델 키 = 1): 머리 뼈 기준 높이, 좌우 간격, 길이. 투구, 두건, 모자 밖으로 나오게 단계별로 맞춘다. */
const HORN: Record<number, { up: number; spread: number; len: number }> = {
  1: { up: 0.25, spread: 0.06, len: 0.3 },
  2: { up: 0.24, spread: 0.11, len: 0.32 },
  3: { up: 0.22, spread: 0.11, len: 0.34 },
};

class Boss3D {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera: THREE.OrthographicCamera;
  private models = new Map<number, Model>();
  private feetFrac = 0; // 발이 렌더 캔버스 아래에서 몇 % 위에 찍히는지
  private lastTime = -1;
  private corpse: { pose: BossPose; t: number } | null = null;
  // WebGL 결과를 2D 캔버스로 옮길 때 쓰는 버퍼. drawImage로 WebGL 캔버스를 바로 복사하면
  // 일부 환경에서 이전 프레임과 섞여 반투명하게 찍혀서, 픽셀을 직접 읽어 옮긴다.
  private pixels = new Uint8Array(RES * RES * 4);
  private img = new ImageData(RES, RES);
  private pix: HTMLCanvasElement = document.createElement('canvas');

  constructor() {
    const h = VIEW / 2;
    this.camera = new THREE.OrthographicCamera(-h, h, h, -h, 0.1, 50);
    const target = new THREE.Vector3(0, 0.55, 0);
    this.camera.position.set(0, target.y + Math.sin(PITCH) * 10, Math.cos(PITCH) * 10);
    this.camera.lookAt(target);
    this.camera.updateMatrixWorld();
    const feet = new THREE.Vector3(0, 0, 0).project(this.camera);
    this.feetFrac = (feet.y + 1) / 2;

    this.scene.add(new THREE.HemisphereLight(0xfff0dd, 0x302028, 1.6));
    const key = new THREE.DirectionalLight(0xffd6a0, 2.2); // 횃불 쪽 따뜻한 빛
    key.position.set(-2, 4, 3);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x8090ff, 0.8);
    rim.position.set(2, 2, -3);
    this.scene.add(rim);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = RES;
      canvas.height = RES;
      this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, preserveDrawingBuffer: true });
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(RES, RES, false);
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.pix.width = RES;
      this.pix.height = RES;
    } catch {
      this.renderer = null; // WebGL을 못 쓰면 2D 보스로 그린다.
      return;
    }
    const loader = new GLTFLoader();
    for (const tier of [1, 2, 3]) {
      loader.load(`models/boss${tier}.json`, (g) => this.addModel(tier, g), undefined, () => {});
    }
  }

  private addModel(tier: number, g: { scene: THREE.Object3D; animations: THREE.AnimationClip[] }) {
    const root = g.scene;
    // 키를 1로 맞추고 발을 원점에 둔다.
    const box = new THREE.Box3().setFromObject(root);
    const s = 1 / (box.max.y - box.min.y);
    root.scale.setScalar(s);
    root.position.y = -box.min.y * s;
    const holder = new THREE.Group();
    holder.add(root);
    holder.visible = false;
    this.scene.add(holder);

    const tint = TINT[tier];
    const mats: THREE.MeshStandardMaterial[] = [];
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.frustumCulled = false; // 스킨 메시는 경계 상자가 실제 자세와 달라 잘릴 수 있다.
      const m = (mesh.material as THREE.MeshStandardMaterial).clone();
      const glow = m.name === 'Glow';
      m.emissive = new THREE.Color(glow ? tint.eye : tint.body);
      m.emissiveIntensity = glow ? 2.5 : tint.bodyI;
      m.userData.baseE = m.emissive.clone();
      m.userData.baseI = m.emissiveIntensity;
      m.userData.baseMap = m.map;
      mesh.material = m;
      mats.push(m);
    });

    const mixer = new THREE.AnimationMixer(root);
    const clips = new Map<string, THREE.AnimationAction>();
    for (const clip of g.animations) clips.set(clip.name, mixer.clipAction(clip));

    // 2페이즈 뿔: 머리 위에서 바깥쪽으로 휘어 솟은 원뿔 두 개. 머리 뼈 위치를 매 프레임 따라간다.
    const head = root.getObjectByName('head') ?? null;
    const horns = new THREE.Group();
    const hs = HORN[tier];
    // 뿔 밑동은 짙은 단계 색, 끝은 밝게 빛나게 해서 붉게 물든 몸과 구분되게 한다.
    // 2D 도트 뿔과 같은 색: 뼈빛 밑동, 팔레트 가장 밝은 색의 끝
    const hornMat = new THREE.MeshStandardMaterial({ color: 0xece0c8, roughness: 0.7 });
    const tipMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(RAGE_RAMP[tier][4]), emissive: new THREE.Color(RAGE_RAMP[tier][3]), emissiveIntensity: 0.6 });
    for (const side of [-1, 1]) {
      const cone = new THREE.Group();
      const baseH = hs.len * 0.75;
      const base = new THREE.Mesh(new THREE.ConeGeometry(0.085, baseH, 6), hornMat);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.085 * 0.35, hs.len * 0.3, 6), tipMat);
      base.position.y = baseH / 2;
      tip.position.y = baseH + hs.len * 0.1;
      base.frustumCulled = false;
      tip.frustumCulled = false;
      cone.add(base, tip);
      cone.position.set(side * hs.spread, 0, 0.02);
      cone.rotation.z = -side * 0.55;
      cone.rotation.x = -0.25;
      horns.add(cone);
    }
    horns.visible = false;
    holder.add(horns);
    const hornUp = hs.up;
    const baseMap = mats.find((x) => x.map)?.map ?? null;
    const rageMap = baseMap ? this.makeRageMap(baseMap, tier) : null;
    this.models.set(tier, { root: holder, mixer, clips, mats, loop: '', oneShot: null, lastAct: 0, yaw: 0, head, horns, hornUp, rageMap });
  }

  /** 원본 텍스처를 2D 도트와 같은 팔레트로 다시 칠한 2페이즈 텍스처 */
  private makeRageMap(src: THREE.Texture, tier: number): THREE.Texture | null {
    const im = src.image as CanvasImageSource & { width: number; height: number };
    if (!im || !im.width) return null;
    const cv = document.createElement('canvas');
    cv.width = im.width;
    cv.height = im.height;
    const c = cv.getContext('2d')!;
    c.drawImage(im, 0, 0);
    const img = c.getImageData(0, 0, cv.width, cv.height);
    recolor(img.data, tier, false);
    c.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(cv);
    t.flipY = src.flipY;
    t.colorSpace = src.colorSpace;
    t.magFilter = src.magFilter;
    t.minFilter = src.minFilter;
    t.wrapS = src.wrapS;
    t.wrapT = src.wrapT;
    t.needsUpdate = true;
    return t;
  }

  /** 모델이 준비됐는지. 아니면 게임이 2D 그림으로 대신 그린다. */
  ready(tier: number) {
    return !!this.renderer && this.models.has(tier);
  }

  private play(m: Model, name: string, fade = 0.18) {
    if (m.loop === name) return;
    const next = m.clips.get(name);
    if (!next) return;
    const prev = m.clips.get(m.loop);
    next.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(fade).play();
    if (prev) prev.fadeOut(fade);
    m.loop = name;
  }

  private once(m: Model, name: string, dur?: number) {
    const a = m.clips.get(name);
    if (!a) return;
    if (m.oneShot && m.oneShot !== a) m.oneShot.fadeOut(0.1);
    a.reset().setLoop(THREE.LoopOnce, 1).fadeIn(0.08).play();
    a.clampWhenFinished = true;
    a.timeScale = dur ? a.getClip().duration / dur : 1.4;
    a.setEffectiveWeight(1);
    m.oneShot = a;
  }

  /** 보스 한 마리를 그린다. 그렸으면 true. */
  draw(c: CanvasRenderingContext2D, p: BossPose, time: number): boolean {
    const m = this.models.get(p.tier);
    if (!this.renderer || !m) return false;
    const dt = this.lastTime < 0 ? 0 : Math.max(0, Math.min(0.1, time - this.lastTime));
    this.lastTime = time;

    // 동작 고르기
    if (p.spawnT > 0) {
      if (m.loop !== 'spawn') {
        for (const a of m.clips.values()) a.stop();
        m.oneShot = null;
        m.loop = 'spawn';
        const a = m.clips.get('Spawn_Ground_Skeletons');
        if (a) {
          a.reset().setLoop(THREE.LoopOnce, 1).play();
          a.clampWhenFinished = true;
          a.timeScale = a.getClip().duration / Math.max(0.4, p.spawnT);
        }
      }
    } else {
      if (m.loop === 'spawn') m.clips.get('Spawn_Ground_Skeletons')?.fadeOut(0.2);
      if (p.act !== m.lastAct) {
        m.lastAct = p.act;
        this.once(m, p.actKind === 'summon' ? 'Spellcast_Summon' : ATTACK[p.tier] ?? ATTACK[1], 0.55);
      }
      const loop = p.roar || p.state === 1 ? 'Taunt' : p.state === 2 ? 'Running_A' : p.spiralT > 0 ? 'Spellcasting' : 'Walking_A';
      this.play(m, loop);
      m.clips.get(loop)!.timeScale = loop === 'Walking_A' ? (p.phase2 ? 1.4 : 1.1) : 1;
      if (m.oneShot && !m.oneShot.isRunning()) {
        m.oneShot.fadeOut(0.15);
        m.oneShot = null;
      }
    }

    // 플레이어 쪽으로 천천히 몸을 돌린다. 화면 아래(+y)가 카메라 쪽(+z)이다.
    if (p.faceX !== 0 || p.faceY !== 0) {
      const want = Math.atan2(p.faceX, p.faceY);
      let d = want - m.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      m.yaw += d * Math.min(1, dt * (p.state === 2 ? 14 : 6));
    }
    m.root.rotation.y = m.yaw;
    m.mixer.update(dt);
    this.renderModel(c, m, p, 1);
    return true;
  }

  private renderModel(c: CanvasRenderingContext2D, m: Model, p: BossPose, alpha: number) {
    const flash = p.flash > 0 || p.state === 1;
    const now = performance.now();
    for (const mat of m.mats) {
      const glow = mat.name === 'Glow';
      if (flash || (p.roar && Math.sin(now / 45) > 0.3)) {
        mat.emissive.setRGB(1, 1, 1);
        mat.emissiveIntensity = p.state === 1 ? 0.35 + 0.25 * Math.sin(now / 50) : 0.8;
      } else if (p.phase2) {
        // 2페이즈: 몸에 빛을 씌우지 않고 텍스처 자체를 바꾼다. 눈만 빛난다.
        mat.emissive.set(glow ? RAGE_EYE[p.tier] : 0x000000);
        mat.emissiveIntensity = glow ? 3 : 0;
      } else {
        mat.emissive.copy(mat.userData.baseE);
        mat.emissiveIntensity = mat.userData.baseI;
      }
    }
    for (const mat of m.mats) {
      if (mat.name === 'Glow' || !mat.userData.baseMap) continue;
      const want = p.phase2 && m.rageMap ? m.rageMap : mat.userData.baseMap;
      if (mat.map !== want) mat.map = want;
    }
    // 뿔은 머리 뼈 위치를 따라간다(몸 방향은 holder가 돌려 준다).
    m.horns.visible = p.phase2;
    if (p.phase2 && m.head) {
      m.root.updateMatrixWorld(true);
      const v = new THREE.Vector3();
      m.head.getWorldPosition(v);
      m.root.worldToLocal(v);
      m.horns.position.set(v.x, v.y + m.hornUp, v.z);
    }
    for (const o of this.models.values()) o.root.visible = o === m;
    const r = this.renderer!;
    r.render(this.scene, this.camera);
    m.root.visible = false;
    const gl = r.getContext();
    gl.readPixels(0, 0, RES, RES, gl.RGBA, gl.UNSIGNED_BYTE, this.pixels);
    // WebGL은 아래쪽 행부터 읽히므로 뒤집어 담는다.
    const row = RES * 4;
    for (let y = 0; y < RES; y++) this.img.data.set(this.pixels.subarray((RES - 1 - y) * row, (RES - y) * row), y * row);
    this.pix.getContext('2d')!.putImageData(this.img, 0, 0);

    const unit = p.r * 4.8 * (p.phase2 ? PHASE2_SCALE : 1); // 모델 키(1)를 화면 px로
    const size = VIEW * unit;
    const dx = p.x - size / 2;
    const dy = p.y - size * (1 - this.feetFrac);
    c.save();
    c.imageSmoothingEnabled = false;
    c.globalAlpha = alpha;
    c.drawImage(this.pix, dx, dy, size, size);
    c.restore();
  }

  /** 보스가 쓰러지면 그 자리에서 죽는 동작을 이어서 보여 준다. */
  die(p: BossPose) {
    const m = this.models.get(p.tier);
    if (!this.renderer || !m) return;
    for (const a of m.clips.values()) a.fadeOut(0.1);
    m.oneShot = null;
    m.loop = 'death';
    const a = m.clips.get('Death_C_Skeletons');
    if (a) {
      a.reset().setLoop(THREE.LoopOnce, 1).fadeIn(0.05).play();
      a.clampWhenFinished = true;
      a.timeScale = 1;
    }
    this.corpse = { pose: { ...p, flash: 0, state: 0 }, t: 0 };
  }

  drawCorpse(c: CanvasRenderingContext2D, time: number) {
    const cp = this.corpse;
    if (!cp) return;
    const m = this.models.get(cp.pose.tier);
    if (!this.renderer || !m) return;
    const dt = this.lastTime < 0 ? 0 : Math.max(0, Math.min(0.1, time - this.lastTime));
    this.lastTime = time;
    cp.t += dt;
    m.mixer.update(dt);
    const alpha = cp.t < 2.2 ? 1 : Math.max(0, 1 - (cp.t - 2.2) / 0.8);
    if (alpha <= 0) {
      this.corpse = null;
      m.loop = '';
      return;
    }
    this.renderModel(c, m, cp.pose, alpha);
  }

  reset() {
    this.corpse = null;
    this.lastTime = -1;
    for (const m of this.models.values()) {
      for (const a of m.clips.values()) a.stop();
      m.loop = '';
      m.oneShot = null;
    }
  }
}

let shared: Boss3D | null = null;
/** 모델은 한 번만 불러와 여러 판에서 같이 쓴다. */
export function boss3d(): Boss3D {
  if (!shared) shared = new Boss3D();
  return shared;
}
