// 화면 조립 — 홈·모듈·토픽·로테이션 목록·용어집·소개. 모든 데이터 텍스트는 text.js 를 거친다.

import { html, richHTML, srcLabel } from './text.js';
import {
  visibleAt, hiddenHint, levelOf, CATEGORY_LABEL, DISCIPLINE_LABEL,
} from './data.js';

const enc = encodeURIComponent;
const CATEGORY_ORDER = ['attack', 'defense', 'transition', 'serve', 'basics'];

export const NOTICE = 'BWF Coaches\' Manual Level 1 (2nd ed.)을 바탕으로 한 비공식 한국어 학습 요약입니다. 원문 저작권은 BWF 에 있습니다.';
export const BWF_URL = 'https://corporate.bwfbadminton.com/';

const levelChips = (db, ids) => html`<span class="lvchips">${(ids ?? []).map((id) => html`<span class="lvchip lv-${id}">${levelOf(db, id).label}</span>`)}</span>`;
const discText = (d) => (d ?? []).map((x) => DISCIPLINE_LABEL[x] ?? x).join(' · ');
const hintHTML = (h, noun) => (h ? html`<p class="more">${h.level.label}에 ${noun} ${h.count}개 더</p>` : '');

function topicsOf(module) {
  return (module.sections ?? []).flatMap((s) => s.topics ?? []);
}

function scenarioCard(db, sc, lv) {
  return html`<li><a class="card sc-card cat-${sc.category}" href="#/r/${enc(sc.id)}?lv=${lv}">
    <span class="eyebrow">${CATEGORY_LABEL[sc.category] ?? sc.category} · ${discText(sc.discipline)}</span>
    <span class="card-title">${sc.title}</span>
    <span class="card-text">${richHTML(sc.summary)}</span>
  </a></li>`;
}

// ── 홈
export function homeView(db, lv) {
  const visible = db.scenarios.filter((s) => visibleAt(s, lv));
  const byCat = (cat) => visible.filter((s) => s.category === cat);
  const others = visible.filter((s) => !['attack', 'defense'].includes(s.category)).length;
  return html`
    <section class="hero">
      <h1>배드민턴 복식,<br>이 상황에선 어떻게?</h1>
      <p class="lede">BWF 코치 매뉴얼 Level 1 을 한국어로 정리했습니다. 레벨을 고르고, 공격·수비 로테이션을 <b>직접 선택하며</b> 따라가 보세요.</p>
    </section>
    <section class="levels" aria-labelledby="lv-h">
      <h2 id="lv-h">내 레벨</h2>
      <div class="level-cards">${db.levels.map((l) => html`
        <button type="button" class="level-card${l.id === lv ? ' on' : ''}" data-set-level="${l.id}" aria-pressed="${String(l.id === lv)}">
          <span class="card-title">${l.label}</span><span class="card-text">${richHTML(l.desc)}</span>
        </button>`)}</div>
    </section>
    <section class="feature" aria-labelledby="rot-h">
      <div class="section-head"><h2 id="rot-h">공격·수비 로테이션</h2>
        <a href="#/r?lv=${lv}">전체 ${visible.length}개 보기 →</a></div>
      <div class="two-col">
        ${['attack', 'defense'].map((cat) => html`<div class="col">
          <h3 class="cat-h cat-${cat}">${CATEGORY_LABEL[cat]}</h3>
          ${byCat(cat).length ? html`<ul class="cards">${byCat(cat).map((s) => scenarioCard(db, s, lv))}</ul>`
            : html`<p class="muted">이 레벨에는 ${CATEGORY_LABEL[cat]} 시나리오가 아직 없어요.</p>`}
          ${hintHTML(hiddenHint(db, db.scenarios.filter((s) => s.category === cat), lv), '시나리오')}
        </div>`)}
      </div>
      ${others ? html`<p class="muted small">서브·전환 등 다른 시나리오 ${others}개는 로테이션 목록에 있어요.</p>` : ''}
    </section>
    <section aria-labelledby="mod-h">
      <h2 id="mod-h">매뉴얼 목차</h2>
      <ol class="modules">${db.modules.map((m) => {
        const all = topicsOf(m);
        const shown = all.filter((t) => visibleAt(t, lv)).length;
        return html`<li><a class="card mod-card" href="#/m/${enc(m.id)}?lv=${lv}">
          <span class="mod-no">${m.no}</span>
          <span class="card-title">${m.title}</span>
          <span class="card-text">${richHTML(m.summary)}</span>
          <span class="meta">${all.length ? `토픽 ${shown}/${all.length}` : '요약'}</span>
        </a></li>`;
      })}</ol>
    </section>`;
}

// ── 모듈
export function moduleView(db, lv, moduleId) {
  const m = db.moduleById.get(moduleId);
  if (!m) return notFoundView('모듈', moduleId, lv);
  return html`
    <nav class="crumbs" aria-label="위치"><a href="#/?lv=${lv}">홈</a> › <span>${m.no}장</span></nav>
    <header class="page-head"><p class="eyebrow">${m.no}장</p><h1>${m.title}</h1>
      <p class="lede">${richHTML(m.summary)}</p><p class="src">출처: ${srcLabel(m.src)}</p></header>
    ${(m.sections ?? []).map((s) => {
      const topics = s.topics ?? [];
      const shown = topics.filter((t) => visibleAt(t, lv));
      return html`<section class="msection" aria-label="${s.title}">
        <h2>${s.title}</h2>
        ${s.summary ? html`<p class="sec-summary">${richHTML(s.summary)}</p>` : ''}
        ${shown.length ? html`<ul class="topic-list">${shown.map((t) => html`<li>
            <a href="#/t/${enc(t.id)}?lv=${lv}"><span>${t.title}</span>${levelChips(db, t.levels)}</a></li>`)}</ul>`
          : html`<p class="muted small">${topics.length ? '현재 레벨에 해당하는 토픽이 없어요.' : '이 절은 요약 수준으로만 정리되어 있어요.'}</p>`}
        ${hintHTML(hiddenHint(db, topics, lv), '토픽')}
        <p class="src">출처: ${srcLabel(s.src)}</p>
      </section>`;
    })}`;
}

// ── 토픽
export function topicView(db, lv, topicId) {
  const t = db.topicById.get(topicId);
  if (!t) return notFoundView('토픽', topicId, lv);
  const { module: m, section: s } = db.topicModule.get(topicId);
  const list = (title, items, cls) => (items?.length ? html`<section class="tblock ${cls}"><h2>${title}</h2>
      <ul>${items.map((x) => html`<li>${richHTML(x)}</li>`)}</ul></section>` : '');
  const terms = (t.terms ?? []).map((id) => db.termById.get(id)).filter(Boolean);
  const rots = (t.rotation_ids ?? []).map((id) => db.scenarioById.get(id)).filter(Boolean);
  return html`
    <nav class="crumbs" aria-label="위치"><a href="#/?lv=${lv}">홈</a> ›
      <a href="#/m/${enc(m.id)}?lv=${lv}">${m.no}장 ${m.title}</a> › <span>${s.title}</span></nav>
    <header class="page-head"><h1>${t.title}</h1>
      <p class="meta-line">${levelChips(db, t.levels)} ${t.discipline?.length ? html`<span class="muted small">${discText(t.discipline)}</span>` : ''}</p>
      ${visibleAt(t, lv) ? '' : html`<p class="notice">현재 레벨(${levelOf(db, lv).label})의 목록에는 보이지 않는 토픽입니다.</p>`}
    </header>
    <div class="topic-grid">
      ${list('무엇을 익히나', t.what, 'what')}
      ${list('어떻게 연습하나', t.how, 'how')}
      ${list('핵심 포인트', t.key_points, 'keys')}
    </div>
    ${rots.length ? html`<section class="tblock rots"><h2>로테이션으로 보기</h2><ul class="cards">${rots.map((sc) => scenarioCard(db, sc, lv))}</ul></section>` : ''}
    ${terms.length ? html`<section class="tblock"><h2>용어</h2><p class="term-chips">${terms.map((g) => html`
      <a class="chip" href="#/glossary/${enc(g.id)}?lv=${lv}">${g.ko}<span class="en">${g.en}</span></a>`)}</p></section>` : ''}
    <p class="src">출처: ${srcLabel(t.src)}</p>`;
}

// ── 로테이션 목록
export function rotationsView(db, lv) {
  const cats = [...new Set([...CATEGORY_ORDER, ...db.scenarios.map((s) => s.category)])];
  return html`
    <header class="page-head"><h1>로테이션</h1>
      <p class="lede">상황을 고르면 선택지가 나옵니다. 고른 이유를 먼저 확인하고, 선수들이 어떻게 움직이는지 보세요.</p></header>
    ${cats.map((cat) => {
      const all = db.scenarios.filter((s) => s.category === cat);
      if (!all.length) return '';
      const shown = all.filter((s) => visibleAt(s, lv));
      return html`<section class="rot-group" aria-label="${CATEGORY_LABEL[cat] ?? cat}">
        <h2 class="cat-h cat-${cat}">${CATEGORY_LABEL[cat] ?? cat}</h2>
        ${shown.length ? html`<ul class="cards grid">${shown.map((s) => scenarioCard(db, s, lv))}</ul>` : html`<p class="muted small">현재 레벨에는 없어요.</p>`}
        ${hintHTML(hiddenHint(db, all, lv), '시나리오')}
      </section>`;
    })}`;
}

// ── 용어집
export function glossaryView(db, lv, focusId) {
  const terms = [...db.terms].sort((a, b) => a.ko.localeCompare(b.ko, 'ko'));
  return html`
    <header class="page-head"><h1>용어집</h1>
      <label class="search"><span class="sr-only">용어 검색</span>
        <input type="search" id="gsearch" placeholder="한글·영어로 찾기 (예: 리프트, lift)" autocomplete="off"></label></header>
    <dl class="glossary">${terms.map((g) => html`
      <div class="term${g.id === focusId ? ' focus' : ''}" id="term-${g.id}" data-search="${[g.ko, g.en, ...(g.aka ?? [])].join(' ').toLowerCase()}">
        <dt>${g.ko} <span class="en">${g.en}</span>${g.aka?.length ? html` <span class="aka">${g.aka.join(', ')}</span>` : ''}</dt>
        <dd>${richHTML(g.desc)} <span class="src">${srcLabel(g.src)}</span></dd>
      </div>`)}</dl>
    <p class="muted small" id="gempty" hidden>일치하는 용어가 없어요.</p>`;
}

export function bindGlossary(root, focusId) {
  const input = root.querySelector('#gsearch');
  const empty = root.querySelector('#gempty');
  const items = [...root.querySelectorAll('.term')];
  input?.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    const hits = items.filter((it) => {
      const ok = !q || it.dataset.search.includes(q);
      it.hidden = !ok;
      return ok;
    });
    empty.hidden = hits.length > 0;
  });
  if (focusId) root.querySelector(`#term-${CSS.escape(focusId)}`)?.scrollIntoView({ block: 'center' });
}

// ── 소개
export function aboutView(db, lv) {
  return html`
    <header class="page-head"><h1>소개</h1></header>
    <section class="tblock notice-box"><h2>저작권 고지</h2>
      <p>${NOTICE}</p>
      <p>원문: ${db.source?.title ?? "BWF Coaches' Manual Level 1"} — <a href="${BWF_URL}" rel="noopener">BWF 공식 사이트</a>.
        이 사이트는 매뉴얼 PDF·그림을 싣지 않으며, 내용은 학습용으로 요약·재구성한 것입니다. 각 항목의 출처 쪽수로 원문을 확인하세요.</p></section>
    <section class="tblock"><h2>레벨</h2><dl class="lv-desc">${db.levels.map((l) => html`
      <dt>${l.label}</dt><dd>${richHTML(l.desc)}</dd>`)}</dl>
      <p class="muted small">레벨을 고르면 그 레벨에 해당하는 토픽·시나리오·선택지만 보입니다. 링크에 레벨이 함께 담겨 공유하면 같은 화면이 열립니다.</p></section>
    <section class="tblock"><h2>로테이션 보는 법</h2><ul>
      <li>우리 팀(노랑)은 아래, 상대(빨강)는 위입니다. 혼합복식 시나리오는 남·여로 표기합니다.</li>
      <li>선택지를 누르면 그 선택의 평가와 이유가 먼저 나오고, 「다음 상황 보기」로 선수들이 움직입니다.</li>
      <li>경로 기록에서 지나온 지점을 누르면 되돌아가 다른 선택과 비교할 수 있습니다. 진행·결과 화면에서는 ← → 키도 됩니다.</li>
    </ul></section>`;
}

export function notFoundView(kind, id, lv) {
  return html`<section class="empty"><h1>찾을 수 없어요</h1>
    <p>${kind} 「${id}」이(가) 데이터에 없습니다. 링크가 오래되었을 수 있어요.</p>
    <p><a class="btn" href="#/?lv=${lv}">홈으로</a></p></section>`;
}

export function errorView(message) {
  return html`<section class="empty" role="alert"><h1>데이터를 불러오지 못했어요</h1>
    <p>${message}</p><p class="muted small">네트워크 상태를 확인하고 다시 시도해 주세요.</p>
    <p><button type="button" class="btn primary" data-act="retry">다시 시도</button></p></section>`;
}
