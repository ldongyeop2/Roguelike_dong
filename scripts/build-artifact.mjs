// dist/ 빌드 결과를 외부 파일 없이 열 수 있는 단일 HTML(dist/play.html)로 묶는다.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const read = (href) => readFileSync(join(dist, href.replace(/^\//, '')), 'utf8');

const js = html.match(/<script type="module" crossorigin src="([^"]+)"><\/script>/);
const css = html.match(/<link rel="stylesheet" crossorigin href="([^"]+)">/);
const body = html.match(/<body>([\s\S]*)<\/body>/);
if (!js || !css || !body) throw new Error('dist/index.html 형식이 예상과 다릅니다. npm run build를 먼저 실행하세요.');

const script = read(js[1]).replace(/<\/script/gi, '<\\/script');
const out = [
  '<title>Roguelike Dong</title>',
  `<style>${read(css[1])}</style>`,
  body[1].trim(),
  `<script type="module">${script}</script>`,
].join('\n');

writeFileSync(join(dist, 'play.html'), out);
console.log(`dist/play.html (${(out.length / 1024).toFixed(1)} KB)`);
