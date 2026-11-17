import { speciesIcon } from './art';
import { ARMORS, PRICES, RECIPES, SPECIES, WEAPONS, expNeed, mixLv, statsOf } from './data';
import {
  G, MAX_ACTIVE, MAX_PETS, buy, doMix, healAll, log, mixInfo, releasePet, resetSave, sellStone, skillSong, skillStrike,
  stonePrice, togglePet, usePotion, useScroll, useStone,
} from './game';
import type { Renderer } from './render';

let root: HTMLElement;
let win = '';
let mixA = 0;
let mixB = 0;
let logIdx = 0;
let mapT = 0;
const cache: Record<string, string> = {};

const $ = (id: string) => document.getElementById(id)!;

function setHtml(id: string, html: string) {
  if (cache[id] === html) return;
  cache[id] = html;
  $(id).innerHTML = html;
}

export function openWin(name: string) {
  win = win === name ? '' : name;
  G.dirty = true;
}
export function closeWin() {
  win = '';
  G.dirty = true;
}
export const hasWin = () => win !== '';

export function initUI() {
  root = $('ui');
  root.innerHTML = `
    <div id="hud-tl">
      <div class="frame" id="pframe"></div>
      <div id="party"></div>
    </div>
    <div id="hud-tr" class="frame">
      <div id="zone-name"></div>
      <canvas id="minimap" width="336" height="176"></canvas>
    </div>
    <div id="target"></div>
    <div id="log"></div>
    <div id="bottom">
      <div id="hotbar" class="frame">
        <button class="slotbtn" data-act="s1" title="강타: 대상에게 강한 일격 (마나 8)"><span class="g">⚔</span><kbd>1</kbd><i class="cd" id="cd1"></i></button>
        <button class="slotbtn" data-act="s2" title="회복의 노래: 나와 동료의 체력 회복 (마나 14)"><span class="g">♪</span><kbd>2</kbd><i class="cd" id="cd2"></i></button>
        <button class="slotbtn red" data-act="hp" title="체력 물약"><span class="g">●</span><kbd>Q</kbd><em id="n-hp"></em></button>
        <button class="slotbtn blue" data-act="mp" title="마나 물약"><span class="g">●</span><kbd>E</kbd><em id="n-mp"></em></button>
      </div>
      <div id="menu" class="frame">
        <button data-act="win" data-arg="bag">가방<kbd>I</kbd></button>
        <button data-act="win" data-arg="pets">동료<kbd>P</kbd></button>
        <button data-act="win" data-arg="book">조합식<kbd>B</kbd></button>
        <button data-act="win" data-arg="help">도움말<kbd>H</kbd></button>
      </div>
    </div>
    <div id="win"></div>`;
  root.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    if (!el) return;
    act(el.dataset.act!, el.dataset.arg || '');
  });
  try {
    if (!localStorage.getItem('chimera-tales-help')) {
      win = 'help';
      localStorage.setItem('chimera-tales-help', '1');
    }
  } catch {
    win = 'help';
  }
}

function act(a: string, arg: string) {
  const n = Number(arg);
  switch (a) {
    case 'win': openWin(arg); break;
    case 'close': closeWin(); break;
    case 's1': skillStrike(); break;
    case 's2': skillSong(); break;
    case 'hp': usePotion('hp'); break;
    case 'mp': usePotion('mp'); break;
    case 'scroll': useScroll(); closeWin(); break;
    case 'stone': useStone(n); break;
    case 'sell': sellStone(n); break;
    case 'toggle': togglePet(n); break;
    case 'release':
      if (armed === a + arg) releasePet(n);
      else return arm(a + arg);
      break;
    case 'buy': buy(arg); break;
    case 'pick':
      if (mixA === n) mixA = 0;
      else if (mixB === n) mixB = 0;
      else if (!mixA) mixA = n;
      else mixB = n;
      break;
    case 'mix':
      if (doMix(mixA, mixB)) mixA = mixB = 0;
      break;
    case 'reset':
      if (armed === a) resetSave();
      else return arm(a);
      break;
  }
  armed = '';
  G.dirty = true;
}

/** 되돌릴 수 없는 동작은 같은 버튼을 한 번 더 눌러야 실행한다. */
let armed = '';
function arm(key: string) {
  armed = key;
  G.dirty = true;
}
const sure = (key: string, label: string) => (armed === key ? '한 번 더 눌러 확인' : label);

const bar = (cls: string, v: number, max: number, text = '') =>
  `<div class="bar ${cls}"><i style="width:${Math.max(0, Math.min(100, (v / max) * 100)).toFixed(1)}%"></i><span>${text}</span></div>`;

const icon = (sp: string) => `<img class="ico" src="${speciesIcon(sp)}" alt="">`;

function petCard(uid: number, extra: string, cls = '', click = '') {
  const pet = G.pets.find((p) => p.uid === uid)!;
  const sp = SPECIES[pet.sp];
  const st = statsOf(sp, pet.lv);
  return `<div class="card ${cls}" ${click}>
    ${icon(pet.sp)}
    <div class="info"><b>${sp.name}</b> <em>Lv.${pet.lv}</em> <small>${sp.tribe} · ${sp.tier}단계${pet.active ? ' · 출전' : ''}</small>
    <small>체력 ${st.hp} · 공격 ${st.atk} · 방어 ${st.def}</small></div>${extra}</div>`;
}

function renderWin(): string {
  const head = (title: string) => `<div class="title">${title}<button class="x" data-act="close">×</button></div>`;
  if (win === 'bag') {
    const stones = G.inv.stones
      .map((s, i) => `<div class="card">${icon(s.sp)}<div class="info"><b>${SPECIES[s.sp].name}의 혼석</b> <em>Lv.${s.lv}</em></div>
        <button data-act="stone" data-arg="${i}">동료로</button><button class="sub" data-act="sell" data-arg="${i}">판매 ${stonePrice(s)}G</button></div>`)
      .join('');
    return `${head('가방')}<div class="body">
      <p class="gold">소지금 ${G.gold} G</p>
      <p>무기: <b>${WEAPONS[G.weapon].name}</b> (공격 +${WEAPONS[G.weapon].atk}) · 방어구: <b>${ARMORS[G.armor].name}</b> (방어 +${ARMORS[G.armor].def})</p>
      <p>공격력 ${G.player.atk} · 방어력 ${G.player.def}</p>
      <div class="row"><span>체력 물약 x${G.inv.hp}</span><span>마나 물약 x${G.inv.mp}</span>
      <span>귀환 주문서 x${G.inv.scroll} <button data-act="scroll">사용</button></span></div>
      <h4>혼석 (${G.inv.stones.length})</h4>${stones || '<p class="dim">몬스터를 사냥하면 낮은 확률로 혼석을 얻습니다.</p>'}</div>`;
  }
  if (win === 'pets') {
    const cards = G.pets
      .map((p) => petCard(p.uid, `<button data-act="toggle" data-arg="${p.uid}">${p.active ? '대기' : '출전'}</button>
        <button class="sub" data-act="release" data-arg="${p.uid}">${sure('release' + p.uid, '방생')}</button>`, p.active ? 'on' : ''))
      .join('');
    return `${head(`동료 (${G.pets.length}/${MAX_PETS}, 출전 ${MAX_ACTIVE}마리까지)`)}<div class="body">${cards || '<p class="dim">동료가 없습니다.</p>'}</div>`;
  }
  if (win === 'book' || win === 'mix') {
    const book = RECIPES.map((r) => {
      const a = SPECIES[r.a];
      const b = SPECIES[r.b];
      const known = G.known.includes(r.out);
      return `<div class="recipe">${icon(r.a)}<span>${a.name}<small>Lv.${mixLv(a)}+</small></span> + ${icon(r.b)}<span>${b.name}<small>Lv.${mixLv(b)}+</small></span>
        → ${known ? icon(r.out) : '<span class="ico q">?</span>'}<span>${known ? SPECIES[r.out].name : '???'}</span></div>`;
    }).join('');
    if (win === 'book') return `${head('조합식')}<div class="body"><p class="dim">마을의 조합사에게 가면 동료 둘을 조합할 수 있습니다.</p>${book}</div>`;
    if (!G.pets.some((p) => p.uid === mixA)) mixA = 0;
    if (!G.pets.some((p) => p.uid === mixB)) mixB = 0;
    const a = G.pets.find((p) => p.uid === mixA);
    const b = G.pets.find((p) => p.uid === mixB);
    const info = mixInfo(a, b);
    const slot = (p: typeof a) => (p ? `${icon(p.sp)}<b>${SPECIES[p.sp].name}</b><em>Lv.${p.lv}</em>` : '<span class="ico q">+</span><b>선택</b>');
    const outKnown = info.out && G.known.includes(info.out.id);
    const result = info.out
      ? `${outKnown ? icon(info.out.id) : '<span class="ico q">?</span>'}<b>${outKnown ? info.out.name : '미지의 몬스터'}</b><em>Lv.${info.lv}</em>`
      : '<span class="ico q">?</span><b>결과</b>';
    const list = G.pets
      .map((p) => petCard(p.uid, '', p.uid === mixA || p.uid === mixB ? 'on pickable' : 'pickable', `data-act="pick" data-arg="${p.uid}"`))
      .join('');
    return `${head('조합사 루멘')}<div class="body">
      <div class="mixrow"><div class="slot">${slot(a)}</div><span>+</span><div class="slot">${slot(b)}</div><span>→</span><div class="slot out">${result}</div></div>
      <p class="${info.ok ? 'good' : 'dim'}">${info.ok ? `성공 확률 ${Math.round(info.chance * 100)}% · 비용 ${info.fee}G (실패해도 재료는 남습니다)` : info.reason}</p>
      <button class="big" data-act="mix" ${info.ok ? '' : 'disabled'}>조합하기</button>
      <h4>동료 선택</h4>${list}<h4>조합식</h4>${book}</div>`;
  }
  if (win === 'shop') {
    const item = (name: string, desc: string, price: number, arg: string) =>
      `<div class="card"><div class="info"><b>${name}</b><small>${desc}</small></div><button data-act="buy" data-arg="${arg}" ${G.gold < price ? 'disabled' : ''}>${price}G</button></div>`;
    const w = WEAPONS[G.weapon + 1];
    const ar = ARMORS[G.armor + 1];
    return `${head('상인 보리')}<div class="body"><p class="gold">소지금 ${G.gold} G</p>
      ${item('체력 물약', `체력을 회복합니다. (보유 ${G.inv.hp})`, PRICES.hp, 'hp')}
      ${item('마나 물약', `마나를 회복합니다. (보유 ${G.inv.mp})`, PRICES.mp, 'mp')}
      ${item('귀환 주문서', `마을로 즉시 돌아옵니다. (보유 ${G.inv.scroll})`, PRICES.scroll, 'scroll')}
      ${w ? item(w.name, `공격 +${w.atk} (현재 ${WEAPONS[G.weapon].name} +${WEAPONS[G.weapon].atk})`, w.price, 'weapon') : '<p class="dim">최고의 무기를 갖고 있습니다.</p>'}
      ${ar ? item(ar.name, `방어 +${ar.def} (현재 ${ARMORS[G.armor].name} +${ARMORS[G.armor].def})`, ar.price, 'armor') : '<p class="dim">최고의 방어구를 갖고 있습니다.</p>'}
      <p class="dim">혼석은 가방에서 판매할 수 있습니다.</p></div>`;
  }
  if (win === 'help') {
    return `${head('도움말')}<div class="body help">
      <p><b>이동</b> 땅을 클릭 (누르고 있으면 계속 이동)</p>
      <p><b>공격</b> 몬스터를 클릭하면 자동으로 공격합니다. <kbd>Tab</kbd> 가까운 몬스터 지정</p>
      <p><b>기술</b> <kbd>1</kbd> 강타 · <kbd>2</kbd> 회복의 노래 · <kbd>Q</kbd> 체력 물약 · <kbd>E</kbd> 마나 물약</p>
      <p><b>창</b> <kbd>I</kbd> 가방 · <kbd>P</kbd> 동료 · <kbd>B</kbd> 조합식 · <kbd>Esc</kbd> 닫기</p>
      <p><b>동료</b> 몬스터를 쓰러뜨리면 가끔 혼석이 나옵니다. 가방에서 혼석을 쓰면 그 몬스터가 동료가 되고, 3마리까지 함께 싸웁니다.</p>
      <p><b>조합</b> 마을의 조합사에게 가서 일정 레벨 이상의 동료 둘을 조합하면 더 강한 새 몬스터가 태어납니다.</p>
      <p><b>마을</b> 상인에게서 물약과 장비를 사고, 치료사에게서 무료로 회복할 수 있습니다. 미니맵의 파란 점이 다음 지역으로 가는 포탈입니다.</p>
      <button class="sub" data-act="reset">${sure('reset', '처음부터 다시 시작')}</button></div>`;
  }
  return '';
}

export function updateUI(r: Renderer, dt: number) {
  const p = G.player;
  if (G.uiRequest) {
    const role = G.uiRequest;
    G.uiRequest = '';
    if (role === 'heal') {
      healAll();
      log('치료사 미아: 모두 말끔히 나았어요!', 'good');
    } else {
      win = role;
      G.dirty = true;
    }
  }

  setHtml('pframe', `<div class="pname"><b>Lv.${G.lv}</b> 모험가 <span class="gold">${G.gold} G</span></div>
    ${bar('hp', p.hp, p.maxHp, `${Math.ceil(p.hp)} / ${p.maxHp}`)}
    ${bar('mp', G.mp, G.maxMp, `${Math.floor(G.mp)} / ${G.maxMp}`)}
    ${bar('xp', G.exp, expNeed(G.lv), `${Math.floor((G.exp / expNeed(G.lv)) * 100)}%`)}`);

  let party = '';
  for (const a of G.actors) {
    if (a.type !== 'pet' || !a.pet) continue;
    party += `<div class="frame pcard ${a.dead ? 'ko' : ''}">${icon(a.pet.sp)}<div><div class="pn">Lv.${a.lv} ${a.name}</div>
      ${bar('hp', a.hp, a.maxHp)}${bar('xp', a.pet.exp, expNeed(a.pet.lv))}</div></div>`;
  }
  setHtml('party', party);

  setHtml('zone-name', G.zone.def.name);
  mapT -= dt;
  if (mapT <= 0) {
    mapT = 0.2;
    r.drawMinimap($('minimap') as HTMLCanvasElement);
  }

  const t = p.target || G.hover;
  setHtml('target', t && t.type === 'mob' && !t.dead
    ? `<div class="frame"><div class="pn">Lv.${t.lv} ${t.name} <small>${t.sp!.tribe}</small></div>${bar('hp', t.hp, t.maxHp, `${Math.ceil(t.hp)} / ${t.maxHp}`)}</div>`
    : '');

  ($('cd1') as HTMLElement).style.height = `${(G.cds.s1 / 4) * 100}%`;
  ($('cd2') as HTMLElement).style.height = `${(G.cds.s2 / 12) * 100}%`;
  setHtml('n-hp', String(G.inv.hp));
  setHtml('n-mp', String(G.inv.mp));

  if (logIdx !== G.logs.length) {
    logIdx = G.logs.length;
    const el = $('log');
    el.innerHTML = G.logs.slice(-7).map((l) => `<div class="${l.c}">${l.m}</div>`).join('');
  }

  if (G.dirty) {
    G.dirty = false;
    const el = $('win');
    const scroll = el.firstElementChild?.querySelector('.body')?.scrollTop ?? 0;
    el.innerHTML = win ? `<div class="frame window">${renderWin()}</div>` : '';
    const body = el.firstElementChild?.querySelector('.body');
    if (body) body.scrollTop = scroll;
  }
}
