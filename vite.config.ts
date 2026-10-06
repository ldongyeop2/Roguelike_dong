import { defineConfig } from 'vite';

export default defineConfig({
  // 스프라이트 시트(약 5KB)를 번들에 data URI로 넣어 단일 HTML 빌드에서도 외부 파일 없이 동작하게 한다.
  // three.js를 포함하면 번들이 500KB를 넘으므로 경고 기준을 올린다.
  // 보스 3D 모델(.glb)을 자산으로 다뤄 ?inline으로 코드에 넣는다(호스팅 환경의 fetch 제한 회피).
  assetsInclude: ['**/*.glb'],
  build: { assetsInlineLimit: 64 * 1024, chunkSizeWarningLimit: 4096 },
});
