// 로테이션 분기 플레이어 — 상황 → 선택 → (quality·why 먼저) → 다음 상황.
// 상태: trail(지나온 노드와 고른 선택), pending(고른 뒤 아직 진행 전인 선택), tried(노드별 시도한 선택).
// URL(#/r/<scenario>/<node>)이 현재 노드를 정하고, 라우터가 goto() 를 부른다.

import { createCourt, shotLegendHTML } from './court.js';
import { html, raw, richHTML, plain, srcLabel, revealInRow } from './text.js';
import {
  visibleAt, hiddenHint, explainFor, isMixed, levelOf,
  CATEGORY_LABEL, RESULT_LABEL, QUALITY_LABEL, DISCIPLINE_LABEL,
} from './data.js';

const GENDER = Object.freeze({ M: '남', F: '여' }); // 계약: players.gender 는 "M" | "F"

function playerLabels(db, scenario) {
  if (!isMixed(scenario)) return {};
  return Object.fromEntries(Object.entries(db.players).map(([id, p]) => [id, GENDER[p?.gender] ?? id]));
}

const nodeHref = (sid, nid, lv) => `#/r/${encodeURIComponent(sid)}/${encodeURIComponent(nid)}?lv=${lv}`;
const scenarioHref = (sid, lv) => `#/r/${encodeURIComponent(sid)}?lv=${lv}`;

export function createPlayer(host, db, scenarioId, { lv, navigate }) {
  const scenario = db.scenarioById.get(scenarioId);
  const subs = playerLabels(db, scenario);
  const state = { lv, trail: [], pending: null, tried: new Map() };

  host.innerHTML = html`
    <section class="pv" aria-labelledby="pv-title">
      <header class="pv-head">
        <a class="back" href="#/r?lv=${lv}">← 로테이션 목록</a>
        <p class="eyebrow">${CATEGORY_LABEL[scenario.category] ?? scenario.category}
          · ${(scenario.discipline ?? []).map((d) => DISCIPLINE_LABEL[d] ?? d).join(' · ')}</p>
        <h1 id="pv-title">${scenario.title}</h1>
        <p class="lede">${richHTML(scenario.summary)}</p>
        <div class="pv-notice" hidden></div>
      </header>
      <nav class="pv-path" aria-label="지나온 경로"><h2>경로 기록</h2><ol></ol>
        <p class="hint">지나온 지점을 누르면 그 상황으로 돌아가 다른 선택을 해 볼 수 있어요.</p></nav>
      <div class="pv-stage">
        <div class="court-host"></div>
        <div class="stage-tools">
          <button type="button" class="cbtn small" data-act="replay">셔틀 다시 보기</button>
          ${isMixed(scenario) ? html`<span class="mix-note">혼합복식 — 원 아래 남·여 표기</span>` : ''}
        </div>
        <div class="shot-legend">${raw(shotLegendHTML())}</div>
      </div>
      <div class="pv-info" aria-live="polite"></div>
    </section>`;

  const $ = (sel) => host.querySelector(sel);
  const court = createCourt($('.court-host'));
  const info = $('.pv-info');
  const pathList = $('.pv-path ol');
  const notice = $('.pv-notice');

  // 하단 시트 높이를 --sheet-h 로 알려 본문이 시트 뒤에 숨지 않게 한다(좁은 화면 CSS 가 사용).
  const sheetObserver = typeof ResizeObserver === 'function'
    ? new ResizeObserver(([entry]) => host.style.setProperty('--sheet-h', `${Math.ceil(entry.borderBoxSize?.[0]?.blockSize ?? entry.target.offsetHeight)}px`))
    : null;
  function watchSheet() {
    sheetObserver?.disconnect();
    const sheet = info.querySelector('.pv-sheet');
    if (!sheet) return;
    sheetObserver?.observe(sheet);
    fitSheet(sheet);
    // 시트 안에 아직 안 보인 내용이 있으면 표시(페이드 + 「더 보기」)
    const mark = () => sheet.classList.toggle('has-more', sheet.scrollTop + sheet.clientHeight < sheet.scrollHeight - 4);
    sheet.addEventListener('scroll', mark, { passive: true });
    requestAnimationFrame(mark);
  }
  // 좁은 화면: 시트가 코트를 덮지 않게 최대 높이 = 화면 − 탭바 − (맨 위로 스크롤했을 때의 코트 아래끝).
  // 넘치는 내용(판정·이유 등)은 시트 안에서 스크롤한다.
  const narrow = window.matchMedia('(max-width: 719.98px)');
  const SHEET_MIN = 150;
  function fitSheet(sheet = info.querySelector('.pv-sheet')) {
    if (!sheet) return;
    if (!narrow.matches) { sheet.style.removeProperty('max-height'); return; }
    const courtEl = host.querySelector('svg.court');
    const tabbar = document.querySelector('.tabbar');
    if (!courtEl) return;
    const courtBottomDoc = courtEl.getBoundingClientRect().bottom + window.scrollY;
    const tabTop = tabbar ? tabbar.getBoundingClientRect().top : window.innerHeight;
    const room = Math.floor(tabTop - courtBottomDoc - 6);
    sheet.style.maxHeight = `${Math.max(SHEET_MIN, room)}px`;
  }
  const onResize = () => fitSheet();
  window.addEventListener('resize', onResize);

  const current = () => state.trail[state.trail.length - 1];
  const nodeOf = (id) => db.nodes[id];

  // ── 렌더: 경로 기록
  function renderPath() {
    pathList.innerHTML = html`${state.trail.map((step, i) => {
      const n = nodeOf(step.nodeId);
      const isCur = i === state.trail.length - 1;
      const choice = n?.choices?.find((c) => c.id === step.choiceId);
      return html`<li>
        ${isCur
          ? html`<span class="crumb" aria-current="step">${i + 1}. ${plain(n?.title ?? step.nodeId)}</span>`
          : html`<a class="crumb" href="${nodeHref(scenarioId, step.nodeId, state.lv)}">${i + 1}. ${plain(n?.title ?? step.nodeId)}</a>`}
        ${choice ? html`<span class="picked q-${choice.quality}">→ ${choice.label}</span>` : ''}
      </li>`;
    })}`;
    revealInRow(pathList, pathList.querySelector('li:last-child'));
  }

  // ── 렌더: 상황 설명 + 선택지
  function renderInfo() {
    const step = current();
    const node = nodeOf(step.nodeId);
    const explain = explainFor(db, node.explain, state.lv);
    const kindBadge = { decision: '선택', step: '진행', outcome: '결과' }[node.kind] ?? node.kind;
    // .pv-sheet: 좁은 화면에서는 하단 고정 시트(상황 제목 + 선택지·진행·결과), 넓은 화면에서는 본문 흐름 그대로.
    info.innerHTML = html`
      <p class="eyebrow">${state.trail.length}번째 상황 · ${kindBadge}</p>
      <h2 tabindex="-1">${node.title}</h2>
      ${explain ? html`<p class="explain">${richHTML(explain)}</p>` : ''}
      <div class="pv-sheet">
        <p class="sheet-title" aria-hidden="true"><span>${state.trail.length} · ${kindBadge}</span> ${plain(node.title)}</p>
        ${node.kind === 'decision' ? decisionHTML(node) : ''}
        ${node.kind === 'step' ? html`<div class="actions">
            <a class="btn primary" href="${nodeHref(scenarioId, node.next, state.lv)}" data-act="advance-step">다음 →</a></div>` : ''}
        ${node.kind === 'outcome' ? outcomeHTML(node) : ''}
      </div>
      <p class="src">출처: ${srcLabel(node.src) || srcLabel(scenario.src) || '—'}</p>`;
    watchSheet();
    court.setLabel(`${plain(node.title)}. ${plain(explain)}`);
  }

  function decisionHTML(node) {
    const all = node.choices ?? [];
    const shown = all.filter((c) => visibleAt(c, state.lv));
    const tried = state.tried.get(node.id) ?? new Set();
    const hint = hiddenHint(db, all, state.lv);
    const pending = state.pending && shown.find((c) => c.id === state.pending);
    return html`
      <h3 class="ask">어떻게 할까요?</h3>
      <div class="choices${pending ? ' decided' : ''}" role="group" aria-label="선택지">
        ${shown.map((c) => html`<button type="button" class="choice${tried.has(c.id) ? ' tried' : ''}"
            data-choice="${c.id}" aria-pressed="${String(pending?.id === c.id)}">
            <span class="c-label">${c.label}</span>
            ${tried.has(c.id) && pending?.id !== c.id ? html`<span class="qchip q-${c.quality}">${QUALITY_LABEL[c.quality] ?? c.quality}</span>` : ''}
          </button>`)}
      </div>
      ${hint ? html`<p class="more">${hint.level.label}에서는 선택지가 ${hint.count}개 더 있어요.</p>` : ''}
      ${pending ? html`<div class="verdict q-${pending.quality}">
          <p class="qbadge">${QUALITY_LABEL[pending.quality] ?? pending.quality}<span class="v-choice"> · ${pending.label}</span></p>
          <p class="why">${richHTML(pending.why)}</p>
          <div class="verdict-actions">
            <a class="btn primary" href="${nodeHref(scenarioId, pending.next, state.lv)}" data-act="advance">다음 상황 보기 →</a>
            <button type="button" class="btn repick" data-act="repick">다시 고르기</button>
            <span class="more-hint" aria-hidden="true">↓ 밀어서 더 보기</span></div>
        </div>` : html`<p class="muted small">선택하면 먼저 그 선택이 왜 좋은지·위험한지 보여 주고, 그다음 선수들이 움직여요.</p>`}`;
  }

  function outcomeHTML(node) {
    // continue 가 자기 시나리오면 「처음부터」와 같은 동작이므로 버튼을 내지 않는다.
    const cont = node.continue && node.continue !== scenarioId ? db.scenarioById.get(node.continue) : null;
    const contVisible = cont && visibleAt(cont, state.lv);
    const branched = state.trail.some((s) => (nodeOf(s.nodeId)?.choices?.length ?? 0) > 1);
    return html`
      <div class="result r-${node.result}">
        <p class="rbadge">${RESULT_LABEL[node.result] ?? node.result}</p>
        <p>${richHTML(node.summary)}</p>
      </div>
      <div class="actions">
        <a class="btn" href="${nodeHref(scenarioId, scenario.start, state.lv)}">처음부터</a>
        ${cont ? (contVisible
          ? html`<a class="btn primary" href="${scenarioHref(cont.id, state.lv)}">이어서: ${cont.title} →</a>`
          : html`<span class="muted small">이어지는 「${cont.title}」은 ${cont.levels.map((l) => levelOf(db, l).label).join('·')} 레벨에서 볼 수 있어요.</span>`) : ''}
      </div>
      ${branched ? html`<p class="muted small">「다른 선택이었다면?」 — 경로 기록에서 선택했던 지점을 눌러 비교해 보세요.</p>` : ''}`;
  }

  function renderNotice() {
    if (visibleAt(scenario, state.lv)) { notice.hidden = true; return; }
    const names = (scenario.levels ?? []).map((l) => levelOf(db, l).label).join('·');
    notice.hidden = false;
    notice.innerHTML = html`이 시나리오는 <b>${names}</b> 레벨용입니다. 현재 레벨(${levelOf(db, state.lv).label})에서는 목록에 보이지 않아요.`;
  }

  function render(fresh) {
    renderNotice();
    renderPath();
    renderInfo();
    const node = nodeOf(current().nodeId);
    const highlight = (node.shuttle ?? []).map((s) => s.by).filter(Boolean);
    court.show(node, { subs, highlight, fresh });
  }

  // ── 상태 전이
  function goto(nodeId) {
    const target = nodeOf(nodeId) ? nodeId : scenario.start;
    if (nodeOf(target)?.scenario && nodeOf(target).scenario !== scenarioId) {
      console.warn(`[player] ${target} 는 ${scenarioId} 의 노드가 아닙니다.`);
    }
    const idx = state.trail.findIndex((s) => s.nodeId === target);
    const cur = current();
    const curNode = cur && nodeOf(cur.nodeId);
    const fresh = state.trail.length === 0;
    if (idx >= 0) {
      // 되돌아가기: 그 지점 이후를 잘라 내고 다시 고를 수 있게 한다.
      state.trail = state.trail.slice(0, idx + 1).map((s, i) => (i === idx ? { nodeId: s.nodeId, choiceId: null } : s));
    } else if (cur && state.pending && curNode?.choices?.find((c) => c.id === state.pending)?.next === target) {
      state.trail = [...state.trail.slice(0, -1), { nodeId: cur.nodeId, choiceId: state.pending }, { nodeId: target, choiceId: null }];
    } else if (cur && curNode?.kind === 'step' && curNode.next === target) {
      state.trail = [...state.trail, { nodeId: target, choiceId: null }];
    } else {
      state.trail = [{ nodeId: target, choiceId: null }];
    }
    state.pending = null;
    render(fresh);
    if (!fresh) focusInfo();
  }

  function focusInfo() {
    const stage = $('.pv-stage');
    const top = stage.getBoundingClientRect().top;
    if (top < 60) stage.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    info.querySelector('h2')?.focus({ preventScroll: true });
  }

  function choose(choiceId) {
    const node = nodeOf(current().nodeId);
    if (!node?.choices?.some((c) => c.id === choiceId)) return;
    state.pending = choiceId;
    const tried = new Set(state.tried.get(node.id) ?? []);
    tried.add(choiceId);
    state.tried = new Map(state.tried).set(node.id, tried);
    renderInfo();
    const sheet = info.querySelector('.pv-sheet');
    if (sheet) sheet.scrollTop = 0; // 고른 선택지 → 판정·이유 순서로 위에서부터 보이게
    info.querySelector('.verdict .btn')?.focus({ preventScroll: true });
  }

  function onClick(ev) {
    const btn = ev.target.closest('[data-choice]');
    if (btn) { choose(btn.dataset.choice); return; }
    if (ev.target.closest('[data-act="repick"]')) { state.pending = null; renderInfo(); return; }
    if (ev.target.closest('[data-act="replay"]')) court.replay();
  }

  function onKey(ev) {
    if (ev.defaultPrevented || ev.altKey || ev.metaKey || ev.ctrlKey) return;
    if (ev.target.closest?.('input,textarea,select')) return;
    const node = nodeOf(current()?.nodeId);
    if (!node || node.kind === 'decision') return;
    if (ev.key === 'ArrowRight' && node.kind === 'step') navigate(nodeHref(scenarioId, node.next, state.lv));
    if (ev.key === 'ArrowLeft' && state.trail.length > 1) {
      navigate(nodeHref(scenarioId, state.trail[state.trail.length - 2].nodeId, state.lv));
    }
  }

  host.addEventListener('click', onClick);
  document.addEventListener('keydown', onKey);

  return Object.freeze({
    scenarioId,
    goto,
    setLevel(next) {
      if (next === state.lv) return; // 같은 레벨 재진입 — 고른 선택(pending)을 지우면 진행이 경로에 안 남는다
      state.lv = next;
      state.pending = null;
      host.querySelector('.back')?.setAttribute('href', `#/r?lv=${next}`);
      renderNotice();
      renderPath();
      renderInfo();
    },
    destroy() {
      sheetObserver?.disconnect();
      window.removeEventListener('resize', onResize);
      host.style.removeProperty('--sheet-h');
      document.removeEventListener('keydown', onKey);
      host.removeEventListener('click', onClick);
    },
  });
}
