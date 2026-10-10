// 로테이션 분기 플레이어 — 상황 → 선택 → (quality·why 먼저) → 다음 상황.
// 상태: trail(지나온 노드와 고른 선택), pending(고른 뒤 아직 진행 전인 선택), tried(노드별 시도한 선택).
// URL(#/r/<scenario>/<node>)이 현재 노드를 정하고, 라우터가 goto() 를 부른다.

import { createCourt, shotLegendHTML } from './court.js';
import { html, raw, richHTML, plain, srcLabel } from './text.js';
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
    const curCrumb = pathList.querySelector('[aria-current]');
    curCrumb?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }

  // ── 렌더: 상황 설명 + 선택지
  function renderInfo() {
    const step = current();
    const node = nodeOf(step.nodeId);
    const explain = explainFor(db, node.explain, state.lv);
    const kindBadge = { decision: '선택', step: '진행', outcome: '결과' }[node.kind] ?? node.kind;
    info.innerHTML = html`
      <p class="eyebrow">${state.trail.length}번째 상황 · ${kindBadge}</p>
      <h2 tabindex="-1">${node.title}</h2>
      ${explain ? html`<p class="explain">${richHTML(explain)}</p>` : ''}
      ${node.kind === 'decision' ? decisionHTML(node) : ''}
      ${node.kind === 'step' ? html`<div class="actions">
          <a class="btn primary" href="${nodeHref(scenarioId, node.next, state.lv)}" data-act="advance-step">다음 →</a></div>` : ''}
      ${node.kind === 'outcome' ? outcomeHTML(node) : ''}
      <p class="src">출처: ${srcLabel(node.src) || srcLabel(scenario.src) || '—'}</p>`;
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
      <div class="choices" role="group" aria-label="선택지">
        ${shown.map((c) => html`<button type="button" class="choice${tried.has(c.id) ? ' tried' : ''}"
            data-choice="${c.id}" aria-pressed="${String(pending?.id === c.id)}">
            <span class="c-label">${c.label}</span>
            ${tried.has(c.id) && pending?.id !== c.id ? html`<span class="qchip q-${c.quality}">${QUALITY_LABEL[c.quality] ?? c.quality}</span>` : ''}
          </button>`)}
      </div>
      ${hint ? html`<p class="more">${hint.level.label}에서는 선택지가 ${hint.count}개 더 있어요.</p>` : ''}
      ${pending ? html`<div class="verdict q-${pending.quality}">
          <p class="qbadge">${QUALITY_LABEL[pending.quality] ?? pending.quality}</p>
          <p class="why">${richHTML(pending.why)}</p>
          <a class="btn primary" href="${nodeHref(scenarioId, pending.next, state.lv)}" data-act="advance">다음 상황 보기 →</a>
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
    if (top < 0) stage.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
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
    info.querySelector('.verdict .btn')?.focus({ preventScroll: true });
  }

  function onClick(ev) {
    const btn = ev.target.closest('[data-choice]');
    if (btn) { choose(btn.dataset.choice); return; }
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
      document.removeEventListener('keydown', onKey);
      host.removeEventListener('click', onClick);
    },
  });
}
