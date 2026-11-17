// dist/ 빌드 결과를 CSS와 JS를 모두 인라인한 단일 페이지(dist/play.html)로 묶는다.
// 호스팅 환경이 문서 골격을 씌워 주므로 <html>, <head>, <body> 태그는 넣지 않는다.
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
  '<title>키메라 테일즈</title>',
  `<style>${read(css[1])}</style>`,
  body[1].replace(/<script[\s\S]*?<\/script>/g, '').trim(),
  `<script type="module">${script}</script>`,
].join('\n');

writeFileSync(join(dist, 'play.html'), out);
console.log(`dist/play.html (${(out.length / 1024).toFixed(1)} KB)`);
