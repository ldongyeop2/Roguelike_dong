// 보스 2페이즈 디자인: 원본 픽셀을 단계별 색 팔레트로 바꾼다(명암은 그대로 유지).
// 2D 스프라이트와 3D 모델 텍스처가 같은 규칙을 쓴다.

/** 어두운 색 → 밝은 색 5단계 팔레트 */
export const RAGE_RAMP: Record<number, string[]> = {
  1: ['#1a0806', '#5a160c', '#a03414', '#e0701c', '#ffd050'], // 파수꾼: 잿불
  2: ['#0e0620', '#341058', '#6424a8', '#ae5ae8', '#f4c4ff'], // 군주: 공허
  3: ['#0a0204', '#40081a', '#86102a', '#d82a48', '#ffe4ea'], // 심연의 왕: 핏빛
};
/** 눈처럼 원래 밝고 진한 부분은 이 색으로 빛나게 바꾼다. */
export const RAGE_EYE: Record<number, string> = { 1: '#fff6a0', 2: '#ffe0ff', 3: '#ffffff' };

const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/**
 * 픽셀 배열을 팔레트로 바꾼다. 아주 어두운 외곽선은 남기고, 나머지는 밝기에 따라 팔레트 5단계 사이를 보간한다.
 * keepOutline이 true면 밝기 40 미만은 원래 색을 유지한다(도트 외곽선 보존).
 */
export function recolor(d: Uint8ClampedArray, tier: number, keepOutline: boolean) {
  const ramp = RAGE_RAMP[tier].map(hex);
  const eye = hex(RAGE_EYE[tier]);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const lum = r * 0.3 + g * 0.59 + b * 0.11;
    if (keepOutline && lum < 40) continue;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const sat = mx === 0 ? 0 : (mx - mn) / mx;
    if (lum > 150 && sat > 0.45) {
      d[i] = eye[0]; d[i + 1] = eye[1]; d[i + 2] = eye[2];
      continue;
    }
    const t = Math.min(0.999, lum / 255) * (ramp.length - 1);
    const k = Math.floor(t);
    const f = t - k;
    const a = ramp[k], c = ramp[k + 1];
    d[i] = a[0] + (c[0] - a[0]) * f;
    d[i + 1] = a[1] + (c[1] - a[1]) * f;
    d[i + 2] = a[2] + (c[2] - a[2]) * f;
  }
}

export const rampHex = (tier: number, i: number) => RAGE_RAMP[tier][i];
