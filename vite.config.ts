import { defineConfig } from 'vite';

export default defineConfig({
  // 스프라이트 시트(약 5KB)를 번들에 data URI로 넣어 단일 HTML 빌드에서도 외부 파일 없이 동작하게 한다.
  // three.js를 포함하면 번들이 500KB를 넘으므로 경고 기준을 올린다.
  build: { assetsInlineLimit: 64 * 1024, chunkSizeWarningLimit: 1024 },
});
