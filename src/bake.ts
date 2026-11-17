// 3D 모델을 쿼터뷰 카메라로 찍어 2D 스프라이트 시트로 굽는다.
import * as THREE from 'three';

/** 타일 한 칸(월드 1단위)이 화면에서 차지하는 카메라 평면 픽셀 수. 타일 폭 64px 기준. */
const PPU = 32 * Math.SQRT2;

export interface ModelDef {
  root: THREE.Object3D;
  /** anim: 0 대기, 1 걷기, 2 공격. t: 0..1 */
  pose?: (anim: number, t: number) => void;
}

export interface Sheet {
  c: HTMLCanvasElement;
  /** 프레임의 논리 크기와 발밑 기준점 */
  fw: number;
  fh: number;
  ax: number;
  ay: number;
  /** 논리 픽셀당 실제 픽셀 수 */
  ratio: number;
  dirs: number;
}

/** 애니메이션별 프레임 수와 시트에서의 시작 열 */
export const ANIM = [
  { start: 0, n: 3 },
  { start: 3, n: 6 },
  { start: 9, n: 3 },
];
const COLS = 12;

let renderer: THREE.WebGLRenderer | null | undefined;
let scene: THREE.Scene;
let camera: THREE.OrthographicCamera;

function init(): boolean {
  if (renderer !== undefined) return renderer !== null;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setClearColor(0x000000, 0);
    scene = new THREE.Scene();
    const e = Math.PI / 6;
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    camera.position.set(Math.cos(e) * Math.SQRT1_2 * 30, Math.sin(e) * 30, Math.cos(e) * Math.SQRT1_2 * 30);
    camera.lookAt(0, 0, 0);
    // 화면 왼쪽 위에서 비추는 주광, 오른쪽의 약한 보조광, 하늘/땅 환경광
    const key = new THREE.DirectionalLight(0xfff4e0, 2.5);
    key.position.set(-0.25, 1.3, 0.75);
    const fill = new THREE.DirectionalLight(0xa8c0ff, 0.7);
    fill.position.set(1, 0.3, -0.4);
    scene.add(key, fill, new THREE.HemisphereLight(0xffffff, 0x4a4a6a, 1.5));
  } catch {
    renderer = null;
  }
  return renderer !== null;
}

function shoot(ctx: CanvasRenderingContext2D, dx: number, dy: number, w: number, h: number) {
  renderer!.render(scene, camera);
  ctx.drawImage(renderer!.domElement, dx, dy, w, h);
}

function frame(fw: number, fh: number, ax: number, ay: number, ratio: number) {
  renderer!.setSize(Math.round(fw * ratio), Math.round(fh * ratio), false);
  camera.left = -ax / PPU;
  camera.right = (fw - ax) / PPU;
  camera.top = ay / PPU;
  camera.bottom = -(fh - ay) / PPU;
  camera.updateProjectionMatrix();
}

/** 실루엣 둘레에 어두운 외곽선을 두른다. */
function outline(cv: HTMLCanvasElement, px: number) {
  const tmp = document.createElement('canvas');
  tmp.width = cv.width;
  tmp.height = cv.height;
  const t = tmp.getContext('2d')!;
  for (let i = 0; i < 8; i++) t.drawImage(cv, Math.cos(i * 0.785) * px, Math.sin(i * 0.785) * px);
  t.globalCompositeOperation = 'source-in';
  t.fillStyle = 'rgba(34,24,40,0.8)';
  t.fillRect(0, 0, tmp.width, tmp.height);
  t.globalCompositeOperation = 'source-over';
  t.drawImage(cv, 0, 0);
  const c = cv.getContext('2d')!;
  c.clearRect(0, 0, cv.width, cv.height);
  c.drawImage(tmp, 0, 0);
  tmp.width = 0;
}

function dispose(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
  });
}

/** 8방향 x (대기, 걷기, 공격) 프레임 시트. still이면 대기 1프레임만 dirs 방향으로 굽는다. */
export function bakeSheet(make: () => ModelDef, F: number, ratio: number, dirs = 8, still = false): Sheet | null {
  if (!init()) return null;
  const model = make();
  const fp = Math.round(F * ratio);
  const cols = still ? 1 : COLS;
  const cv = document.createElement('canvas');
  cv.width = fp * cols;
  cv.height = fp * dirs;
  const ctx = cv.getContext('2d')!;
  const ax = F / 2;
  const ay = Math.round(F * 0.8);
  frame(F, F, ax, ay, ratio);
  scene.add(model.root);
  for (let d = 0; d < dirs; d++) {
    model.root.rotation.y = -(d * Math.PI) / 4;
    if (still) {
      model.pose?.(0, 0);
      shoot(ctx, 0, d * fp, fp, fp);
      continue;
    }
    for (let a = 0; a < 3; a++) {
      for (let i = 0; i < ANIM[a].n; i++) {
        model.pose?.(a, i / ANIM[a].n);
        shoot(ctx, (ANIM[a].start + i) * fp, d * fp, fp, fp);
      }
    }
  }
  scene.remove(model.root);
  dispose(model.root);
  outline(cv, Math.max(1, ratio * 0.9));
  return { c: cv, fw: F, fh: F, ax, ay, ratio, dirs };
}

/** 배경 오브젝트용 한 장짜리 스프라이트. shadow > 0이면 바닥 그림자를 깐다. */
export function bakeStill(make: () => ModelDef, w: number, h: number, ax: number, ay: number, ratio: number, shadow = 0, yaw = 0): Sheet | null {
  if (!init()) return null;
  const model = make();
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * ratio);
  cv.height = Math.round(h * ratio);
  const ctx = cv.getContext('2d')!;
  frame(w, h, ax, ay, ratio);
  model.root.rotation.y = yaw;
  model.pose?.(0, 0);
  scene.add(model.root);
  shoot(ctx, 0, 0, cv.width, cv.height);
  scene.remove(model.root);
  dispose(model.root);
  outline(cv, Math.max(1, ratio * 0.8));
  if (shadow > 0) {
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = 'rgba(20,20,40,0.3)';
    ctx.beginPath();
    ctx.ellipse((ax + shadow * 0.25) * ratio, ay * ratio, shadow * ratio, shadow * 0.5 * ratio, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  return { c: cv, fw: w, fh: h, ax, ay, ratio, dirs: 1 };
}
