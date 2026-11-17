import { defineConfig } from 'vite';

export default defineConfig({
  // three.js를 포함하면 번들이 500KB를 넘으므로 경고 기준을 올린다.
  build: { chunkSizeWarningLimit: 2048 },
});
