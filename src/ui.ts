import {
  ALL_DEFS, CHARACTERS, ITEMS, SKILLS, charById, itemById, nextJobs, skillById, unlockText, type AnyDef, type CharDef,
} from './content';
import { isUnlocked, progressOf, type RunResult, type Save } from './meta';
import type { Card } from './game';
import { paintGenIcons } from './icons';
import { iconHtml, type IconRef } from './sprites';
import { PAIRS, SETS, SET_NEED, SYN_NAME, TAG_INFO, type SetBonus, type Tag } from './synergy';
import { ARMORS, RARITY, SLOT_LABEL, WEAPONS, gearLines, gearTitle, weaponById, type Gear, type Slot } from './gear';

const icon = (key: IconRef, px = 32) => `<span class="icon">${iconHtml(key, px)}</span>`;

const tagChips = (tags: Tag[] | undefined) => (tags && tags.length
  ? `<div class="tags">${tags.map((t) => `<span class="tag-chip" style="color:${TAG_INFO[t].color};border-color:${TAG_INFO[t].color}">${TAG_INFO[t].name}</span>`).join('')}</div>`
  : '');

const KIND_LABEL = { char: '직업', item: '아이템', skill: '스킬', gear: '장비' } as const;

/** 아직 전직하지 않은 모험가는 무채색으로 보여 준다. */
const jobIcon = (c: CharDef, px = 32) => `<span class="icon"${c.tier === 0 ? ' style="filter:grayscale(1) contrast(1.35) brightness(0.9)"' : ''}>${iconHtml(c.sprite, px)}</span>`;

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
    const tags = d.kind === 'item' ? tagChips(d.tags) : d.kind === 'char' && d.tag ? tagChips([d.tag]) : '';
    const sub = d.kind === 'char' && d.parent ? `<div class="sub">${charById(d.parent).name}에서 전직</div>` : '';
    const pas = d.kind === 'char' && d.passive ? `<div class="sub">${d.passive}</div>` : '';
    return `<div class="card ${sel ? 'sel' : ''}" ${extra}><div class="name">${icon(d.sprite)}${d.name}</div>${sub}${tags}<div>${d.desc}</div>${pas}</div>`;
  }

  showMenu(save: Save, h: MenuHandlers, tab: 'play' | 'codex' = 'play') {
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
        <h3>전직 계보</h3>
        <div class="roster">${CHARACTERS.filter((c) => c.tier === 1).map((c) => this.jobRow(save, c)).join('')}</div>
        <div class="foot">
          <div class="keys"><kbd>WASD</kbd> 이동 <kbd>LMB</kbd> 공격 <kbd>SPACE</kbd> 스킬<br><kbd>E</kbd> 장비 <kbd>ESC</kbd> 일시정지</div>
          <button id="reset" class="small danger">기록 초기화</button>
        </div>
      </aside>`;
    const el = this.mount(side + (tab === 'play' ? this.heroCard() : this.codexTab(save)), 'screen menu');
    el.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) =>
      b.addEventListener('click', () => this.showMenu(save, h, b.dataset.tab as 'play' | 'codex')));
    el.querySelector('#start')?.addEventListener('click', () => h.onStart('adventurer'));
    // 브라우저 확인 대화상자를 쓸 수 없는 환경이 있어 두 번 눌러 확인하는 방식으로 처리한다.
    const reset = el.querySelector<HTMLButtonElement>('#reset');
    reset?.addEventListener('click', () => {
      if (reset.dataset.armed) return h.onReset();
      reset.dataset.armed = '1';
      reset.textContent = '한 번 더 누르면 삭제';
    });
  }

  /** 1차 직업 한 줄과 그 아래 상위 직업 두 갈래 */
  private jobRow(save: Save, c: CharDef): string {
    const branch = nextJobs(c).map((j) => isUnlocked(save, j.id)
      ? `<span class="branch" style="color:${j.color}">${j.name}</span>`
      : `<span class="branch locked" title="${unlockText(j.unlock!)}">??? <small>${unlockText(j.unlock!)}</small></span>`).join('');
    if (!isUnlocked(save, c.id)) {
      const pr = progressOf(save, c.unlock!);
      return `<div class="hero-row locked">${jobIcon(c)}<div><div class="nm">???</div>
        <div class="ds">${unlockText(c.unlock!)} (${pr.cur}/${pr.target})</div>
        <div class="bar"><i style="width:${(pr.cur / pr.target) * 100}%"></i></div></div></div>`;
    }
    const w = weaponById(c.startWeapon);
    return `<div class="hero-row">${jobIcon(c)}
      <div><div class="nm">${c.name} <span class="ds">${w.name} · ${skillById(c.skill).name}</span></div><div class="branches">${branch}</div></div></div>`;
  }

  private heroCard(): string {
    const c = charById('adventurer');
    const w = weaponById(c.startWeapon);
    return `
      <section class="hero-card">
        <div class="title"><b>${c.name}</b><span>READY</span></div>
        <p>${c.desc}</p>
        <div class="chips">
          <span class="chip">체력 <b>${c.hp}</b></span>
          <span class="chip">이동 <b>${c.speed}</b></span>
          <span class="chip">무기 <b>${w.name}</b></span>
          <span class="chip">스킬 <b>없음</b></span>
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
      <p class="sub">죽음과 기록이 쌓일수록 새 직업, 스킬, 아이템, 장비가 던전에 등장합니다.</p>
      ${sec('1차 직업', CHARACTERS.filter((c) => c.tier === 1)) + sec('상위 직업', CHARACTERS.filter((c) => c.tier === 2))}
      ${sec('스킬', SKILLS) + sec('아이템', ITEMS)}
      ${this.synergySection(save)}
      ${sec('장비: 무기', WEAPONS) + sec('장비: 방어구와 장신구', ARMORS)}
    </section>`;
  }

  private synergySection(save: Save): string {
    const setCard = (st: SetBonus) => `<div class="card"><div class="name" style="color:${TAG_INFO[st.tag].color}">${st.name}</div>
      <div class="sub">${TAG_INFO[st.tag].name} 태그 아이템 ${SET_NEED}종</div><div>${st.desc}</div></div>`;
    const found = PAIRS.filter((p) => save.discovered.includes(p.id)).length;
    const pairCard = PAIRS.map((p) => save.discovered.includes(p.id)
      ? `<div class="card sel"><div class="name">${p.name}</div><div class="sub">${p.items.map((id) => itemById(id).name).join(' + ')}</div><div>${p.desc}</div></div>`
      : `<div class="card locked"><div class="name">???</div><div class="sub">아이템 2개를 함께 가지면 발견됩니다</div></div>`).join('');
    return `<h2>세트 효과 <span class="sub">같은 태그 아이템을 서로 다른 종류로 ${SET_NEED}개</span></h2>
      <div class="grid">${SETS.map(setCard).join('')}</div>
      <h2>조합 시너지 <span class="sub">발견 ${found}/${PAIRS.length}</span></h2><div class="grid">${pairCard}</div>`;
  }

  showReward(cards: Card[], room: number, onPick: (c: Card) => void) {
    const el = this.mount(
      `<h1>ROOM ${room} 클리어</h1><div class="sub">보상을 하나 선택하세요</div>
       <div class="rewards">${cards.map((c, i) =>
         `<div class="card ${c.hint ? 'combo' : ''}" data-i="${i}">${c.hint ? `<div class="combo-badge">발동: ${c.hint}</div>` : ''}
          <div class="name">${icon(c.sprite, 48)}${c.name}</div>${tagChips(c.tags)}<div>${c.desc}</div></div>`).join('')}</div>`,
      'screen dim');
    el.querySelectorAll<HTMLElement>('[data-i]').forEach((b) =>
      b.addEventListener('click', () => onPick(cards[Number(b.dataset.i)])));
  }

  /** 전직 선택. 잠긴 직업은 해금 조건만 보여 주고 고를 수 없다. */
  showJob(save: Save, tier: number, ids: string[], onPick: (id: string) => void) {
    const card = (j: CharDef) => {
      if (!isUnlocked(save, j.id)) {
        const pr = progressOf(save, j.unlock!);
        return `<div class="card locked"><div class="name">${jobIcon(j, 48)}???</div>
          <div class="sub">해금: ${unlockText(j.unlock!)} (${pr.cur}/${pr.target})</div>
          <div class="bar"><i style="width:${(pr.cur / pr.target) * 100}%"></i></div></div>`;
      }
      const chips = j.tier === 1
        ? `<div class="chips"><span class="chip">체력 <b>${j.hp}</b></span><span class="chip">이동 <b>${j.speed}</b></span>
           <span class="chip">무기 <b>${weaponById(j.startWeapon).name}</b></span><span class="chip">스킬 <b>${skillById(j.skill).name}</b></span></div>`
        : `${tagChips(j.tag ? [j.tag] : [])}<div class="sub">${j.passive ?? ''}</div>${j.hp ? `<div class="sub">최대 체력 +${j.hp}</div>` : ''}`;
      return `<div class="card job" data-id="${j.id}" style="--c:${j.color}"><div class="name" style="color:${j.color}">${jobIcon(j, 48)}${j.name}</div>
        <div>${j.desc}</div>${chips}</div>`;
    };
    const jobs = ids.map(charById);
    const el = this.mount(
      `<h1>${tier === 1 ? '전직의 제단' : '상위 전직'}</h1>
       <div class="sub">${tier === 1 ? '나아갈 길을 고르세요. 무기와 스킬이 직업에 맞게 바뀝니다(쓰던 무기는 발밑에 남습니다).' : '직업의 길을 더 깊이 걸어갑니다. 상위 직업의 태그는 세트 효과에 1개로 셉니다.'}</div>
       <div class="rewards">${jobs.map(card).join('')}</div>`,
      'screen dim');
    el.querySelectorAll<HTMLElement>('[data-id]').forEach((b) =>
      b.addEventListener('click', () => onPick(b.dataset.id!)));
  }

  showPause(
    gear: { slot: Slot; gear: Gear | null }[],
    syn: { active: string[]; sets: (SetBonus & { count: number })[] },
    onResume: () => void, onQuit: () => void,
  ) {
    const cards = gear.map(({ slot, gear: g }) => g
      ? `<div class="card" style="border-color:${RARITY[g.rarity].color}"><div class="name">${icon(g.base.sprite)}<span style="color:${RARITY[g.rarity].color}">${gearTitle(g)}</span></div>
         <div class="sub">${gearLines(g).join('<br>')}</div></div>`
      : `<div class="card locked"><div class="name">${SLOT_LABEL[slot]}</div><div class="sub">비어 있음</div></div>`).join('');
    const el = this.mount(
      `<h1>일시정지</h1><h2>장착 장비</h2><div class="grid gear">${cards}</div>
       <h2>시너지</h2>
       <div class="sets">${syn.sets.map((st) => `<span class="set-chip ${st.count >= SET_NEED ? 'on' : ''}" style="--c:${TAG_INFO[st.tag].color}">
         ${TAG_INFO[st.tag].name} ${Math.min(st.count, SET_NEED)}/${SET_NEED} · ${st.name}</span>`).join('')}</div>
       <div class="sub">${syn.active.filter((id) => !id.startsWith('set:')).map((id) => SYN_NAME.get(id)).join(', ') || '발동 중인 조합 시너지가 없습니다.'}</div>
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
