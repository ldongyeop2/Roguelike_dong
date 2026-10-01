import {
  ALL_DEFS, CHARACTERS, ITEMS, SKILLS, charById, skillById, unlockText, type AnyDef,
} from './content';
import { isUnlocked, progressOf, type RunResult, type Save } from './meta';
import type { Card } from './game';
import { paintGenIcons } from './icons';
import { iconHtml, type IconRef } from './sprites';
import { ARMORS, RARITY, SLOT_LABEL, WEAPONS, WKIND_LABEL, gearLines, gearTitle, weaponById, type Gear, type Slot } from './gear';

const icon = (key: IconRef, px = 32) => `<span class="icon">${iconHtml(key, px)}</span>`;

const KIND_LABEL = { char: '캐릭터', item: '아이템', skill: '스킬', gear: '장비' } as const;

export interface MenuHandlers {
  onStart(charId: string): void;
  onReset(): void;
  onSelect(charId: string): void;
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
    h.onSelect(sel);
    const got = ALL_DEFS.filter((d) => isUnlocked(save, d.id)).length;
    const s = save.stats;
    const side = `
      <aside class="side">
        <header>
          <div class="logo">ROGUELIKE <span>DONG</span></div>
          <p class="tag">죽을수록 강해지는 대신, 선택지가 늘어나는 던전</p>
        </header>
        <div class="stats">
          <div class="stat"><b>${s.deaths + s.wins}</b><small>도전</small></div>
          <div class="stat"><b>${s.bestRoom}</b><small>최고 방</small></div>
          <div class="stat"><b>${s.wins}</b><small>클리어</small></div>
          <div class="stat"><b>${got}/${ALL_DEFS.length}</b><small>해금</small></div>
        </div>
        <div class="tabs">
          <button data-tab="play" class="${tab === 'play' ? 'active' : ''}">출정</button>
          <button data-tab="codex" class="${tab === 'codex' ? 'active' : ''}">해금 도감</button>
        </div>
        <h3>캐릭터</h3>
        <div class="roster">${CHARACTERS.map((c) => this.heroRow(save, c.id, c.id === sel)).join('')}</div>
        <div class="foot">
          <div class="keys"><kbd>WASD</kbd> 이동 <kbd>LMB</kbd> 공격 <kbd>SPACE</kbd> 스킬<br><kbd>E</kbd> 장비 <kbd>ESC</kbd> 일시정지</div>
          <button id="reset" class="small danger">기록 초기화</button>
        </div>
      </aside>`;
    const el = this.mount(side + (tab === 'play' ? this.heroCard(sel) : this.codexTab(save)), 'screen menu');
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
      reset.textContent = '한 번 더 누르면 삭제';
    });
  }

  private heroRow(save: Save, id: string, sel: boolean): string {
    const c = charById(id);
    if (!isUnlocked(save, id)) {
      const pr = progressOf(save, c.unlock!);
      return `<div class="hero-row locked">${icon(c.sprite)}<div><div class="nm">???</div>
        <div class="ds">${unlockText(c.unlock!)} (${pr.cur}/${pr.target})</div>
        <div class="bar"><i style="width:${(pr.cur / pr.target) * 100}%"></i></div></div></div>`;
    }
    const w = weaponById(c.startWeapon);
    return `<button class="hero-row ${sel ? 'sel' : ''}" data-char="${id}">${icon(c.sprite)}
      <div><div class="nm">${c.name}</div><div class="ds">${w.name} · ${skillById(c.skill).name}</div></div></button>`;
  }

  private heroCard(id: string): string {
    const c = charById(id);
    const w = weaponById(c.startWeapon);
    const sk = skillById(c.skill);
    return `
      <section class="hero-card">
        <div class="title"><b>${c.name}</b><span>READY</span></div>
        <p>${c.desc}</p>
        <div class="chips">
          <span class="chip">체력 <b>${c.hp}</b></span>
          <span class="chip">이동 <b>${c.speed}</b></span>
          <span class="chip">무기 <b>${w.name}</b> (${WKIND_LABEL[w.wkind]})</span>
          <span class="chip">스킬 <b>${sk.name}</b></span>
        </div>
        <button id="start" class="primary">던전으로 출정</button>
      </section>`;
  }

  private codexTab(save: Save): string {
    const sec = (title: string, defs: AnyDef[]) => {
      const n = defs.filter((d) => isUnlocked(save, d.id)).length;
      return `<h2>${title} <span class="sub">${n}/${defs.length}</span></h2><div class="grid">${defs.map((d) => this.defCard(save, d)).join('')}</div>`;
    };
    return `<section class="codex">
      <div class="top"><h1>해금 도감</h1><button data-tab="play">닫기</button></div>
      <p class="sub">죽음과 기록이 쌓일수록 새 캐릭터, 스킬, 아이템, 장비가 던전에 등장합니다.</p>
      ${sec('캐릭터', CHARACTERS) + sec('스킬', SKILLS) + sec('아이템', ITEMS) + sec('장비: 무기', WEAPONS) + sec('장비: 방어구와 장신구', ARMORS)}
    </section>`;
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
       <div class="row"><button id="menu" class="primary">다시 출정 준비</button></div>`,
      `screen result ${r.won ? 'won' : 'dead'}`);
    el.querySelector('#menu')!.addEventListener('click', onMenu);
  }
}
