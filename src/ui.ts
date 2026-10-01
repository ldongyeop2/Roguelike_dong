import {
  CHARACTERS, ITEMS, SKILLS, unlockText, type AnyDef,
} from './content';
import { isUnlocked, progressOf, type RunResult, type Save } from './meta';
import type { Card } from './game';

const KIND_LABEL = { char: '캐릭터', item: '아이템', skill: '스킬' } as const;

export interface MenuHandlers {
  onStart(charId: string): void;
  onReset(): void;
}

export class UI {
  constructor(private root: HTMLElement) {}

  private mount(html: string, cls = 'screen'): HTMLElement {
    this.root.innerHTML = `<div class="${cls}">${html}</div>`;
    return this.root.firstElementChild as HTMLElement;
  }

  hide() {
    this.root.innerHTML = '';
  }

  private lockInfo(save: Save, d: AnyDef): string {
    if (!d.unlock) return '';
    const pr = progressOf(save, d.unlock);
    return `<div class="sub">해금: ${unlockText(d.unlock)} (${pr.cur}/${pr.target})</div>
      <div class="bar"><i style="width:${(pr.cur / pr.target) * 100}%"></i></div>`;
  }

  private defCard(save: Save, d: AnyDef, extra = '', sel = false): string {
    const open = isUnlocked(save, d.id);
    if (!open) {
      return `<div class="card locked"><div class="name">??? <span class="sub">${KIND_LABEL[d.kind]}</span></div>${this.lockInfo(save, d)}</div>`;
    }
    return `<div class="card ${sel ? 'sel' : ''}" ${extra}><div class="name">${d.name}</div><div>${d.desc}</div></div>`;
  }

  showMenu(save: Save, h: MenuHandlers, tab: 'play' | 'codex' = 'play', picked?: string) {
    const sel = picked && isUnlocked(save, picked) ? picked : isUnlocked(save, save.lastChar) ? save.lastChar : 'knight';
    const all = [...CHARACTERS, ...ITEMS, ...SKILLS];
    const got = all.filter((d) => isUnlocked(save, d.id)).length;
    const s = save.stats;
    const el = this.mount(`
      <h1>Roguelike Dong</h1>
      <div class="sub">죽을수록 강해지는 것이 아니라, 선택지가 늘어납니다. 해금 ${got}/${all.length} | 도전 ${s.deaths + s.wins}회 | 최고 ROOM ${s.bestRoom} | 클리어 ${s.wins}회</div>
      <div class="tabs">
        <button data-tab="play" class="${tab === 'play' ? 'active' : ''}">출정</button>
        <button data-tab="codex" class="${tab === 'codex' ? 'active' : ''}">해금 도감</button>
      </div>
      ${tab === 'play' ? this.playTab(save, sel) : this.codexTab(save)}
    `);
    el.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) =>
      b.addEventListener('click', () => this.showMenu(save, h, b.dataset.tab as 'play' | 'codex', sel)));
    el.querySelectorAll<HTMLElement>('[data-char]').forEach((b) =>
      b.addEventListener('click', () => this.showMenu(save, h, 'play', b.dataset.char)));
    el.querySelector('#start')?.addEventListener('click', () => h.onStart(sel));
    el.querySelector('#reset')?.addEventListener('click', () => {
      if (confirm('저장된 해금 정보와 기록이 모두 삭제됩니다. 계속할까요?')) h.onReset();
    });
  }

  private playTab(save: Save, sel: string): string {
    const cards = CHARACTERS.map((c) => this.defCard(save, c, `data-char="${c.id}"`, c.id === sel)).join('');
    return `
      <h2>캐릭터 선택</h2>
      <div class="grid">${cards}</div>
      <div class="sub">WASD 이동 / 마우스 조준, 좌클릭 공격 / Space 또는 우클릭 스킬 / Esc 일시정지</div>
      <div class="row"><button id="start" class="primary">런 시작</button><button id="reset" class="danger">저장 초기화</button></div>`;
  }

  private codexTab(save: Save): string {
    const sec = (title: string, defs: AnyDef[]) =>
      `<h2>${title}</h2><div class="grid">${defs.map((d) => this.defCard(save, d)).join('')}</div>`;
    return sec('캐릭터', CHARACTERS) + sec('스킬', SKILLS) + sec('아이템', ITEMS);
  }

  showReward(cards: Card[], room: number, onPick: (c: Card) => void) {
    const el = this.mount(
      `<h1>ROOM ${room} 클리어</h1><div class="sub">보상을 하나 선택하세요</div>
       <div class="rewards">${cards.map((c, i) =>
         `<div class="card" data-i="${i}"><div class="name">${c.name}</div><div>${c.desc}</div></div>`).join('')}</div>`,
      'screen dim');
    el.querySelectorAll<HTMLElement>('[data-i]').forEach((b) =>
      b.addEventListener('click', () => onPick(cards[Number(b.dataset.i)])));
  }

  showPause(onResume: () => void, onQuit: () => void) {
    const el = this.mount(
      `<h1>일시정지</h1><div class="row"><button id="resume" class="primary">계속하기</button><button id="quit" class="danger">런 포기</button></div>`,
      'screen dim');
    el.querySelector('#resume')!.addEventListener('click', onResume);
    el.querySelector('#quit')!.addEventListener('click', onQuit);
  }

  showEnd(r: RunResult, newly: AnyDef[], save: Save, onMenu: () => void) {
    const list = newly.length
      ? `<h2 class="new">새로 해금됨</h2><div class="grid">${newly.map((d) =>
          `<div class="card sel"><div class="name">${d.name}</div><div>${d.desc}</div></div>`).join('')}</div>`
      : `<div class="sub">이번 런에서 새로 해금된 항목은 없습니다.</div>`;
    const near = [...CHARACTERS, ...ITEMS, ...SKILLS]
      .filter((d) => d.unlock && !isUnlocked(save, d.id))
      .map((d) => ({ d, p: progressOf(save, d.unlock!) }))
      .sort((a, b) => b.p.cur / b.p.target - a.p.cur / a.p.target)
      .slice(0, 3);
    const hint = near.length
      ? `<h2>다음 해금까지</h2><div class="grid">${near.map(({ d, p }) =>
          `<div class="card locked"><div class="name">??? <span class="sub">${KIND_LABEL[d.kind]}</span></div><div class="sub">${unlockText(d.unlock!)} (${p.cur}/${p.target})</div>
           <div class="bar"><i style="width:${(p.cur / p.target) * 100}%"></i></div></div>`).join('')}</div>`
      : '';
    const el = this.mount(
      `<h1>${r.won ? '던전 클리어!' : '쓰러졌습니다'}</h1>
       <div class="sub">ROOM ${r.room} 도달 | 처치 ${r.kills} | 보스 처치 ${r.bossKills} | 획득 ${r.itemsCollected}</div>
       ${list}${hint}
       <div class="row"><button id="menu" class="primary">메뉴로</button></div>`);
    el.querySelector('#menu')!.addEventListener('click', onMenu);
  }
}
