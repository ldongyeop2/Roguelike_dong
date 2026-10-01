// dist/ 빌드 결과를 CSS/JS가 인라인된 호스팅용 페이지(dist/play.html)로 묶는다.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const read = (href) => readFileSync(join(dist, href.replace(/^\//, '')), 'utf8');

const js = html.match(/<script type="module" crossorigin src="([^"]+)"><\/script>/);
const css = html.match(/<link rel="stylesheet" crossorigin href="([^"]+)">/);
const body = html.match(/<body>([\s\S]*)<\/body>/);
if (!js || !css || !body) throw new Error('dist/index.html 형식이 예상과 다릅니다. npm run build를 먼저 실행하세요.');

// 인라인된 이미지는 페이지 옆에 별도 파일로 꺼내고 상대 경로로 참조한다.
// (일부 호스팅 환경이 큰 data URI가 들어간 페이지를 거부하기 때문)
let script = read(js[1]).replace(/<\/script/gi, '<\\/script');
let n = 0;
script = script.replace(/data:image\/png;base64,([A-Za-z0-9+/=]+)/g, (_, b64) => {
  const name = `sprite-${n++}.png`;
  writeFileSync(join(dist, name), Buffer.from(b64, 'base64'));
  return name;
});
const out = [
  '<title>Roguelike Dong</title>',
  `<style>${read(css[1])}</style>`,
  body[1].trim(),
  `<script type="module">${script}</script>`,
].join('\n');

writeFileSync(join(dist, 'play.html'), out);
console.log(`dist/play.html (${(out.length / 1024).toFixed(1)} KB), 이미지 ${n}개`);
