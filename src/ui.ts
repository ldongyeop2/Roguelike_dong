import {
  ALL_DEFS, CHARACTERS, ITEMS, SKILLS, unlockText, type AnyDef,
} from './content';
import { isUnlocked, progressOf, type RunResult, type Save } from './meta';
import type { Card } from './game';
import { paintGenIcons } from './icons';
import { iconHtml, type IconRef } from './sprites';
import { ARMORS, RARITY, SLOT_LABEL, WEAPONS, gearLines, gearTitle, type Gear, type Slot } from './gear';

const icon = (key: IconRef, px = 32) => `<span class="icon">${iconHtml(key, px)}</span>`;

const KIND_LABEL = { char: '캐릭터', item: '아이템', skill: '스킬', gear: '장비' } as const;

export interface MenuHandlers {
  onStart(charId: string): void;
  onReset(): void;
}

export class UI {
  constructor(private root: HTMLElement) {}

  private mount(html: string, cls = 'screen'): HTMLElement {
    this.root.innerHTML = `<div class="${cls}">${html}</div>`;
    const el = this.root.firstElementChild as HTMLElement;
    paintGenIcons(el);
    return el;
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
    return `<div class="card ${sel ? 'sel' : ''}" ${extra}><div class="name">${icon(d.sprite)}${d.name}</div><div>${d.desc}</div></div>`;
  }

  showMenu(save: Save, h: MenuHandlers, tab: 'play' | 'codex' = 'play', picked?: string) {
    const sel = picked && isUnlocked(save, picked) ? picked : isUnlocked(save, save.lastChar) ? save.lastChar : 'knight';
    const all = ALL_DEFS;
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
    // 브라우저 확인 대화상자를 쓸 수 없는 환경이 있어 두 번 눌러 확인하는 방식으로 처리한다.
    const reset = el.querySelector<HTMLButtonElement>('#reset');
    reset?.addEventListener('click', () => {
      if (reset.dataset.armed) return h.onReset();
      reset.dataset.armed = '1';
      reset.textContent = '한 번 더 누르면 모든 해금과 기록이 삭제됩니다';
    });
  }

  private playTab(save: Save, sel: string): string {
    const cards = CHARACTERS.map((c) => this.defCard(save, c, `data-char="${c.id}"`, c.id === sel)).join('');
    return `
      <h2>캐릭터 선택</h2>
      <div class="grid">${cards}</div>
      <div class="sub">WASD 이동 / 마우스 조준, 좌클릭 공격 / Space 또는 우클릭 스킬 / E 장비 줍기 / Esc 일시정지(장비 확인)</div>
      <div class="row"><button id="start" class="primary">런 시작</button><button id="reset" class="danger">저장 초기화</button></div>`;
  }

  private codexTab(save: Save): string {
    const sec = (title: string, defs: AnyDef[]) =>
      `<h2>${title}</h2><div class="grid">${defs.map((d) => this.defCard(save, d)).join('')}</div>`;
    return sec('캐릭터', CHARACTERS) + sec('스킬', SKILLS) + sec('아이템', ITEMS) +
      sec('장비: 무기', WEAPONS) + sec('장비: 방어구와 장신구', ARMORS);
  }

  showReward(cards: Card[], room: number, onPick: (c: Card) => void) {
    const el = this.mount(
      `<h1>ROOM ${room} 클리어</h1><div class="sub">보상을 하나 선택하세요</div>
       <div class="rewards">${cards.map((c, i) =>
         `<div class="card" data-i="${i}"><div class="name">${icon(c.sprite, 48)}${c.name}</div><div>${c.desc}</div></div>`).join('')}</div>`,
      'screen dim');
    el.querySelectorAll<HTMLElement>('[data-i]').forEach((b) =>
      b.addEventListener('click', () => onPick(cards[Number(b.dataset.i)])));
  }

  showPause(gear: { slot: Slot; gear: Gear | null }[], onResume: () => void, onQuit: () => void) {
    const cards = gear.map(({ slot, gear: g }) => g
      ? `<div class="card" style="border-color:${RARITY[g.rarity].color}"><div class="name">${icon(g.base.sprite)}<span style="color:${RARITY[g.rarity].color}">${gearTitle(g)}</span></div>
         <div class="sub">${gearLines(g).join('<br>')}</div></div>`
      : `<div class="card locked"><div class="name">${SLOT_LABEL[slot]}</div><div class="sub">비어 있음</div></div>`).join('');
    const el = this.mount(
      `<h1>일시정지</h1><h2>장착 장비</h2><div class="grid gear">${cards}</div>
       <div class="row"><button id="resume" class="primary">계속하기</button><button id="quit" class="danger">런 포기</button></div>`,
      'screen');
    el.querySelector('#resume')!.addEventListener('click', onResume);
    el.querySelector('#quit')!.addEventListener('click', onQuit);
  }

  showEnd(r: RunResult, newly: AnyDef[], save: Save, onMenu: () => void) {
    const list = newly.length
      ? `<h2 class="new">새로 해금됨</h2><div class="grid">${newly.map((d) =>
          `<div class="card sel"><div class="name">${icon(d.sprite)}${d.name}</div><div>${d.desc}</div></div>`).join('')}</div>`
      : `<div class="sub">이번 런에서 새로 해금된 항목은 없습니다.</div>`;
    const near = ALL_DEFS
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
