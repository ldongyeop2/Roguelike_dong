import {
  ALL_DEFS, CHARACTERS, ITEMS, SKILLS, charById, itemById, nextJobs, skillById, unlockText, type AnyDef, type CharDef,
} from './content';
import { isUnlocked, progressOf, type RunResult, type Save } from './meta';
import type { Card } from './game';
import { paintGenIcons } from './icons';
import { iconHtml, type IconRef } from './sprites';
import { PAIRS, SETS, SET_NEED, SYN_NAME, TAG_INFO, type SetBonus, type Tag } from './synergy';
import { ARMORS, RARITY, SLOT_LABEL, START_ODDS, WEAPONS, gearLines, gearTitle, weaponById, type Gear, type Slot, type WeaponBase } from './gear';

const icon = (key: IconRef, px = 32) => `<span class="icon">${iconHtml(key, px)}</span>`;

const tagChips = (tags: Tag[] | undefined) => (tags && tags.length
  ? `<div class="tags">${tags.map((t) => `<span class="tag-chip" style="color:${TAG_INFO[t].color};border-color:${TAG_INFO[t].color}">${TAG_INFO[t].name}</span>`).join('')}</div>`
  : '');

/** 제약과 보상 아이템의 대가 줄 */
const costLine = (cost?: string) => (cost ? `<div class="cost">대가: ${cost}</div>` : '');

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
    const cost = d.kind === 'item' ? costLine(d.cost) : '';
    return `<div class="card ${sel ? 'sel' : ''}" ${extra}><div class="name">${icon(d.sprite)}${d.name}</div>${sub}${tags}<div>${d.desc}</div>${cost}${pas}</div>`;
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

  /** 1차 직업 한 줄과 그 아래 각성 갈래(2차 → 3차) */
  private jobRow(save: Save, c: CharDef): string {
    const name = (j: CharDef) => isUnlocked(save, j.id)
      ? `<span class="branch" style="color:${j.color}">${j.name}</span>`
      : `<span class="branch locked" title="${unlockText(j.unlock!)}">??? <small>${unlockText(j.unlock!)}</small></span>`;
    const branch = nextJobs(c).map((j2) => {
      const t3 = nextJobs(j2);
      return name(j2) + (t3.length ? ` <small>→</small> ${t3.map(name).join(' / ')}` : '');
    }).join('');
    if (!isUnlocked(save, c.id)) {
      const pr = progressOf(save, c.unlock!);
      return `<div class="hero-row locked">${jobIcon(c)}<div><div class="nm">???</div>
        <div class="ds">${unlockText(c.unlock!)} (${pr.cur}/${pr.target})</div>
        <div class="bar"><i style="width:${(pr.cur / pr.target) * 100}%"></i></div></div></div>`;
    }
    const w = weaponById(c.startWeapon);
    return `<div class="hero-row">${jobIcon(c)}
      <div><div class="nm">${c.name} <span class="ds">${w.name} · ${skillById(c.skill).name}</span></div>${branch ? `<div class="branches">${branch}</div>` : ''}</div></div>`;
  }

  private heroCard(): string {
    const c = charById('adventurer');
    return `
      <section class="hero-card">
        <div class="title"><b>${c.name}</b><span>READY</span></div>
        <p>${c.desc}</p>
        <div class="chips">
          <span class="chip">체력 <b>${c.hp}</b></span>
          <span class="chip">이동 <b>${c.speed}</b></span>
          <span class="chip">무기 <b>출정 시 뽑기</b></span>
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
      ${([1, 2, 3] as const).map((t) => {
        const jobs = CHARACTERS.filter((c) => c.tier === t);
        return jobs.length ? sec(t === 1 ? '1차 전직' : `${t}차 각성`, jobs) : '';
      }).join('')}
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
          <div class="name">${icon(c.sprite, 48)}${c.name}</div>${tagChips(c.tags)}<div>${c.desc}</div>${costLine(c.cost)}</div>`).join('')}</div>`,
      'screen dim');
    el.querySelectorAll<HTMLElement>('[data-i]').forEach((b) =>
      b.addEventListener('click', () => onPick(cards[Number(b.dataset.i)])));
  }

  /**
   * 시작 무기 뽑기: 무기 릴이 돌다가 결과에서 멈추고, 등급에 맞는 연출과 함께 결과를 보여 준다.
   * 화면을 누르거나 건너뛰기를 누르면 바로 멈춘다.
   */
  showGacha(pool: WeaponBase[], result: Gear, onDone: () => void) {
    const N = 44; // 릴에 놓을 칸 수
    const WIN = 38; // 결과가 놓이는 칸
    const pick = () => pool[Math.floor(Math.random() * pool.length)];
    // 미끼 칸은 등급 색만 무작위로 칠해 기대감을 준다.
    const fakeRarity = () => { const r = Math.random(); return r < 0.55 ? 0 : r < 0.82 ? 1 : r < 0.96 ? 2 : 3; };
    const slots = Array.from({ length: N }, (_, i) => (i === WIN ? { b: result.base, r: result.rarity } : { b: pick(), r: fakeRarity() }));
    const odds = START_ODDS.map((p, i) => `<span style="color:${RARITY[i].color}">${RARITY[i].name} ${Math.round(p * 100)}%</span>`).join(' · ');
    const el = this.mount(`
      <div class="gacha">
        <h1>첫 무기 뽑기</h1>
        <div class="sub">모험가가 들고 갈 무기를 뽑습니다. ${odds}</div>
        <div class="reel"><div class="strip">${slots.map((s, i) =>
          `<div class="slot" data-i="${i}" style="--c:${RARITY[s.r].color}">${icon(s.b.sprite, 48)}<small>${s.b.name}</small></div>`).join('')}</div>
          <div class="marker"></div></div>
        <div class="reveal" hidden></div>
        <div class="row"><button id="skip" class="small">건너뛰기</button></div>
      </div>`, 'screen dim gacha-screen');
    const reel = el.querySelector<HTMLElement>('.reel')!;
    const strip = el.querySelector<HTMLElement>('.strip')!;
    const slotEls = [...strip.children] as HTMLElement[];
    const step = slotEls[1].offsetLeft - slotEls[0].offsetLeft;
    const w = slotEls[0].offsetWidth;
    // 결과 칸 안에서 멈추는 위치를 조금씩 흔들어 매번 다르게 보이게 한다.
    const target = -(WIN * step + w / 2 - reel.clientWidth / 2 + (Math.random() - 0.5) * w * 0.6);
    let done = false;
    let raf = 0;
    let hot = -1;
    const tick = () => {
      // 표시선 아래 칸을 밝혀 돌아가는 느낌을 준다.
      const x = new DOMMatrix(getComputedStyle(strip).transform).m41;
      const i = Math.round((reel.clientWidth / 2 - x - w / 2) / step);
      if (i !== hot) {
        slotEls[hot]?.classList.remove('hot');
        slotEls[i]?.classList.add('hot');
        hot = i;
      }
      if (!done) raf = requestAnimationFrame(tick);
    };
    const finish = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      strip.style.transition = 'none';
      strip.style.transform = `translateX(${target}px)`;
      slotEls.forEach((s) => s.classList.remove('hot'));
      slotEls[WIN].classList.add('won');
      const rar = RARITY[result.rarity];
      el.querySelector('.gacha')!.classList.add(`r${result.rarity}`);
      el.style.setProperty('--c', rar.color);
      const rv = el.querySelector<HTMLElement>('.reveal')!;
      rv.hidden = false;
      rv.innerHTML = `
        ${result.rarity >= 2 ? '<div class="rays"></div>' : ''}
        <div class="rname">${rar.name}${result.rarity === 3 ? '!!' : result.rarity === 2 ? '!' : ''}</div>
        <div class="name">${icon(result.base.sprite, 48)}<span>${result.base.name}</span></div>
        <div class="sub">${gearLines(result).join(' · ')}</div>
        <button id="go" class="primary">이 무기로 출정</button>`;
      paintGenIcons(rv);
      el.querySelector('#skip')?.remove();
      el.querySelector('#go')!.addEventListener('click', onDone);
    };
    requestAnimationFrame(() => requestAnimationFrame(() => {
      strip.style.transition = 'transform 4.2s cubic-bezier(0.08, 0.7, 0.12, 1)';
      strip.style.transform = `translateX(${target}px)`;
      raf = requestAnimationFrame(tick);
    }));
    strip.addEventListener('transitionend', finish);
    el.querySelector('#skip')!.addEventListener('click', finish);
    reel.addEventListener('click', finish);
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
      `<h1>${tier === 1 ? '1차 전직' : `${tier}차 각성`}</h1>
       <div class="sub">${tier === 1 ? '나아갈 길을 고르세요. 무기와 스킬이 직업에 맞게 바뀝니다(쓰던 무기는 발밑에 남습니다).' : '직업의 길을 더 깊이 걸어갑니다. 각성 직업의 태그는 세트 효과에 1개로 셉니다.'}</div>
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
