// 연습방법 탭 — #/p 목록, #/p/<skillId> 상세(자세 그림 스트립 + 드릴 + 배치도).
// 데이터: data/practice.json(계약 §6·§7). 그림 요소는 html 문자열에 자리만 두고 bind* 에서 DOM 으로 채운다.

import { html, richHTML, srcLabel, revealInRow } from './text.js';
import { visibleAt, hiddenHint, levelOf, CATEGORY_LABEL as SC_CATEGORY } from './data.js';
import { poseSVG, poseTop, createPoseStage } from './pose.js';
import { diagramSVG, diagramRoles } from './diagram.js';

const enc = encodeURIComponent;
// 사용자가 이름을 든 핵심 기술(서브·리시브·헤어핀·드라이브·클리어·스매시)이 속한 카테고리를 앞에.
const CATEGORY_ORDER = ['serve', 'receive', 'net', 'mid', 'rear', 'movement', 'grip'];
const HAND_LABEL = Object.freeze({ forehand: '포핸드', backhand: '백핸드', none: '' });
const FLIP_KEY = 'bg.lefty';

const store = {
  get(k) { try { return window.localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { window.localStorage.setItem(k, v); } catch { /* 무시 */ } },
};

const levelChips = (db, ids) => html`<span class="lvchips">${(ids ?? []).map((id) => html`<span class="lvchip lv-${id}">${levelOf(db, id).label}</span>`)}</span>`;
// 카드 대표 그림: 보통 3번째(포워드 스윙), 단계가 적으면 마지막.
const keyPhase = (skill) => Math.max(0, Math.min(2, (skill.phases?.length ?? 1) - 1));

function orderedCategories(pr) {
  const known = pr.categories.map((c) => c.id);
  const ids = [...CATEGORY_ORDER.filter((id) => known.includes(id)), ...known.filter((id) => !CATEGORY_ORDER.includes(id))];
  return ids.map((id) => pr.categories.find((c) => c.id === id));
}

function skillCard(skill, lv) {
  return html`<li><a class="card skill-card" href="#/p/${enc(skill.id)}?lv=${lv}">
    <span class="pose-thumb" data-skill="${skill.id}" data-phase="${keyPhase(skill)}"></span>
    <span class="skill-body">
      <span class="eyebrow">${[HAND_LABEL[skill.hand], skill.phases?.length ? `${skill.phases.length}단계` : ''].filter(Boolean).join(' · ')}</span>
      <span class="card-title">${skill.title}</span>
      <span class="card-text">${richHTML(skill.summary)}</span>
    </span></a></li>`;
}

export function practiceUnavailable(lv) {
  return html`<section class="empty"><h1>연습방법</h1>
    <p>연습방법 데이터를 준비 중이에요. 잠시 후 다시 확인해 주세요.</p>
    <p><a class="btn" href="#/?lv=${lv}">홈으로</a></p></section>`;
}

// ── 목록
export function practiceListView(db, lv) {
  const pr = db.practice;
  if (!pr) return practiceUnavailable(lv);
  return html`
    <header class="page-head"><h1>연습방법</h1>
      <p class="lede">기술마다 <b>어떤 자세로</b>(단계별 그림) <b>어떻게 연습하나</b>(쉬운 드릴부터, 코트 배치도)를 정리했습니다.</p></header>
    ${orderedCategories(pr).map((cat) => {
      const all = pr.skills.filter((s) => s.category === cat.id);
      if (!all.length) return '';
      const shown = all.filter((s) => visibleAt(s, lv));
      const hint = hiddenHint(db, all, lv);
      return html`<section class="rot-group" aria-label="${cat.label}">
        <h2 class="cat-h">${cat.label}</h2>
        ${shown.length ? html`<ul class="cards grid skill-grid">${shown.map((s) => skillCard(s, lv))}</ul>` : html`<p class="muted small">현재 레벨에는 없어요.</p>`}
        ${hint ? html`<p class="more">${hint.level.label}에 기술 ${hint.count}개 더</p>` : ''}
      </section>`;
    })}`;
}

// 홈 진입점 — 핵심 카테고리에서 보이는 기술 몇 개.
export function practiceTeaser(db, lv, limit = 6) {
  const pr = db.practice;
  if (!pr) return '';
  const picks = orderedCategories(pr)
    .flatMap((c) => pr.skills.filter((s) => s.category === c.id && visibleAt(s, lv)).slice(0, 1))
    .slice(0, limit);
  if (!picks.length) return '';
  return html`<section aria-labelledby="pr-h">
    <div class="section-head"><h2 id="pr-h">연습방법</h2><a href="#/p?lv=${lv}">기술 ${pr.skills.filter((s) => visibleAt(s, lv)).length}개 전체 →</a></div>
    <p class="muted small">서브·리시브·헤어핀·드라이브·클리어·스매시 — 자세 그림과 드릴로.</p>
    <ul class="cards grid skill-grid">${picks.map((s) => skillCard(s, lv))}</ul>
  </section>`;
}

function drillHTML(db, skill, d, i) {
  const phase = d.pose_ref ? skill.phases.find((p) => p.id === d.pose_ref) : null;
  return html`<li class="drill" id="drill-${d.id}">
    <div class="drill-head"><span class="drill-no">${i + 1}</span>
      <h3>${d.title}</h3>${levelChips(db, d.levels)}</div>
    <div class="drill-grid">
      <div class="drill-text">
        ${d.setup ? html`<p><b>준비</b> ${richHTML(d.setup)}</p>` : ''}
        ${d.steps?.length ? html`<ol class="steps">${d.steps.map((s) => html`<li>${richHTML(s)}</li>`)}</ol>` : ''}
        ${d.success?.length ? html`<p class="ok-line"><b>성공 기준</b></p><ul class="success">${d.success.map((s) => html`<li>${richHTML(s)}</li>`)}</ul>` : ''}
        ${d.reps ? html`<p class="reps"><b>횟수</b> ${d.reps}</p>` : ''}
        ${phase ? html`<button type="button" class="pose-ref" data-goto-phase="${phase.id}">
            <span class="pose-thumb small" data-skill="${skill.id}" data-phase="${skill.phases.indexOf(phase)}"></span>
            <span>자세: ${phase.name}</span></button>` : ''}
      </div>
      ${d.diagram ? html`<figure class="drill-diagram"><div class="dg-host" data-drill="${d.id}"></div>
          <figcaption>${diagramRoles(d.diagram).map((r) => html`<span class="dg-role"><i style="background:${r.fill}"></i>${r.label} ${r.ids.join('·')}</span>`)}
            <span class="muted">숫자 = 순서</span></figcaption></figure>` : ''}
    </div></li>`;
}

// ── 상세
export function practiceDetailView(db, lv, skillId) {
  const pr = db.practice;
  if (!pr) return practiceUnavailable(lv);
  const skill = pr.skillById.get(skillId);
  if (!skill) return null;
  const cat = pr.categories.find((c) => c.id === skill.category);
  const drills = skill.drills ?? [];
  const shownDrills = drills.filter((d) => visibleAt(d, lv));
  const hint = hiddenHint(db, drills, lv);
  const grip = skill.grip ? pr.skillById.get(skill.grip) : null;
  const topics = (skill.related?.topic_ids ?? []).map((id) => db.topicById.get(id)).filter(Boolean);
  const scens = (skill.related?.scenario_ids ?? []).map((id) => db.scenarioById.get(id)).filter(Boolean);
  return html`<div class="pd">
    <nav class="crumbs" aria-label="위치"><a href="#/p?lv=${lv}">연습방법</a> › <span>${cat?.label ?? skill.category}</span></nav>
    <header class="page-head"><p class="eyebrow">${cat?.label ?? ''}${HAND_LABEL[skill.hand] ? ` · ${HAND_LABEL[skill.hand]}` : ''}</p>
      <h1>${skill.title}</h1>
      <p class="meta-line">${levelChips(db, skill.levels)}</p>
      ${visibleAt(skill, lv) ? '' : html`<p class="notice">현재 레벨(${levelOf(db, lv).label}) 목록에는 보이지 않는 기술입니다.</p>`}</header>
    <p class="lede pd-summary">${richHTML(skill.summary)}</p>
    <div class="ww">
      ${skill.where ? html`<div class="tblock"><h2>어디로</h2><p>${richHTML(skill.where)}</p></div>` : ''}
      ${skill.why ? html`<div class="tblock"><h2>언제·왜</h2><p>${richHTML(skill.why)}</p></div>` : ''}
      ${grip ? html`<div class="tblock"><h2>그립</h2><p><a href="#/p/${enc(grip.id)}?lv=${lv}">${grip.title} →</a></p></div>` : ''}
    </div>
    <section class="pose-sec" aria-labelledby="pose-h">
      <div class="section-head"><h2 id="pose-h">자세 — ${skill.phases.length}단계</h2>
        <span class="pose-tools">
          <span class="stepper"><button type="button" class="cbtn" data-act="pose-prev" aria-label="이전 단계">◀</button>
            <span class="step-of" data-step-of>1/${skill.phases.length}</span>
            <button type="button" class="cbtn" data-act="pose-next" aria-label="다음 단계">▶</button></span>
          <button type="button" class="cbtn" data-act="pose-play">재생</button>
          <label class="lefty"><input type="checkbox" data-act="pose-flip"> 왼손잡이</label></span></div>
      <div class="pose-layout">
        <div class="pose-stage" aria-live="polite"></div>
        <div class="pose-side">
          <ol class="phase-strip${skill.phases.length > 4 ? ' many' : ''}" style="--n:${skill.phases.length}">${skill.phases.map((p, i) => html`<li><button type="button" class="phase-btn" data-phase-index="${i}" aria-pressed="${String(i === 0)}">
              <span class="pose-thumb" data-skill="${skill.id}" data-phase="${i}"></span><span class="phase-name"><span class="pn-no">${i + 1}. </span>${p.name}</span></button></li>`)}</ol>
          <div class="cues" data-cues></div>
        </div>
      </div>
    </section>
    <section class="drills-sec" aria-labelledby="dr-h"><h2 id="dr-h">연습 드릴 <span class="muted small">쉬운 것부터</span></h2>
      ${shownDrills.length ? html`<ol class="drills">${shownDrills.map((d, i) => drillHTML(db, skill, d, i))}</ol>` : html`<p class="muted">현재 레벨에 맞는 드릴이 없어요.</p>`}
      ${hint ? html`<p class="more">${hint.level.label}에 드릴 ${hint.count}개 더</p>` : ''}
    </section>
    ${skill.tips?.length || skill.errors?.length ? html`<div class="topic-grid tips-grid">
      ${skill.tips?.length ? html`<section class="tblock keys-ok"><h2>요령</h2><ul>${skill.tips.map((t) => html`<li>${richHTML(t)}</li>`)}</ul></section>` : ''}
      ${skill.errors?.length ? html`<section class="tblock keys"><h2>흔한 실수와 고치기</h2><dl class="errors">${skill.errors.map((e) => html`
        <dt>${richHTML(e.fault)}</dt><dd>→ ${richHTML(e.fix)}</dd>`)}</dl></section>` : ''}
    </div>` : ''}
    ${topics.length || scens.length ? html`<section class="tblock"><h2>관련</h2><p class="term-chips">
      ${topics.map((t) => html`<a class="chip" href="#/t/${enc(t.id)}?lv=${lv}">${t.title}</a>`)}
      ${scens.map((s) => html`<a class="chip" href="#/r/${enc(s.id)}?lv=${lv}">${SC_CATEGORY[s.category] ?? ''} 로테이션 · ${s.title}</a>`)}</p></section>` : ''}
    <p class="src">출처: ${srcLabel(skill.src)}</p></div>`;
}

function hydrateThumbs(root, db, flip = false) {
  root.querySelectorAll('.pose-thumb[data-skill]').forEach((slot) => {
    const skill = db.practice?.skillById.get(slot.dataset.skill);
    const phase = skill?.phases?.[Number(slot.dataset.phase)] ?? skill?.phases?.[0];
    if (phase?.pose) slot.replaceChildren(poseSVG(phase.pose, { flip, extras: false, top: poseTop(skill.phases.map((p) => p.pose)), label: `${skill.title} ${phase.name}` }));
  });
}

export function bindPracticeList(root, db) {
  hydrateThumbs(root, db);
}

// 상세 화면 결선. 반환값의 destroy 는 라우트를 떠날 때 부른다(재생 중지).
export function bindPracticeDetail(root, db, skillId) {
  const skill = db.practice?.skillById.get(skillId);
  if (!skill) return null;
  hydrateThumbs(root, db);
  root.querySelectorAll('.dg-host[data-drill]').forEach((host) => {
    const drill = skill.drills.find((d) => d.id === host.dataset.drill);
    if (drill?.diagram) host.replaceChildren(diagramSVG(drill.diagram, { label: `${drill.title} 배치도` }));
  });
  const cues = root.querySelector('[data-cues]');
  const stepOf = root.querySelector('[data-step-of]');
  const last = skill.phases.length - 1;
  const go = (delta) => stage.show(Math.max(0, Math.min(last, stage.index + delta)));
  const btns = [...root.querySelectorAll('[data-phase-index]')];
  const stage = createPoseStage(root.querySelector('.pose-stage'), skill.phases, {
    onPhase(i) {
      btns.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
      stepOf.textContent = `${i + 1}/${skill.phases.length}`;
      revealInRow(btns[i]?.closest('.phase-strip'), btns[i]);
      const p = skill.phases[i];
      cues.innerHTML = html`<h3>${i + 1}. ${p.name}</h3><ul>${(p.cues ?? []).map((c) => html`<li>${richHTML(c)}</li>`)}</ul>`;
    },
  });
  stage.show(0);
  const flipBox = root.querySelector('[data-act="pose-flip"]');
  const lefty = store.get(FLIP_KEY) === '1';
  if (lefty) { flipBox.checked = true; stage.setFlip(true); hydrateThumbs(root, db, true); }
  const onClick = (ev) => {
    const pb = ev.target.closest('[data-phase-index]');
    if (pb) { stage.show(Number(pb.dataset.phaseIndex)); return; }
    if (ev.target.closest('[data-act="pose-play"]')) { stage.play(); return; }
    if (ev.target.closest('[data-act="pose-prev"]')) { go(-1); return; }
    if (ev.target.closest('[data-act="pose-next"]')) { go(1); return; }
    const ref = ev.target.closest('[data-goto-phase]');
    if (ref) {
      stage.show(skill.phases.findIndex((p) => p.id === ref.dataset.gotoPhase));
      root.querySelector('.pose-sec').scrollIntoView({ block: 'start' });
    }
  };
  const onFlip = () => {
    store.set(FLIP_KEY, flipBox.checked ? '1' : '0');
    stage.setFlip(flipBox.checked);
    hydrateThumbs(root, db, flipBox.checked);
  };
  // 큰 그림을 좌우로 밀어 단계 넘기기
  const stageEl = root.querySelector('.pose-stage');
  let touch = null;
  const onTouchStart = (e) => { touch = [e.touches[0].clientX, e.touches[0].clientY]; };
  const onTouchEnd = (e) => {
    if (!touch) return;
    const dx = e.changedTouches[0].clientX - touch[0];
    const dy = e.changedTouches[0].clientY - touch[1];
    touch = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) go(dx < 0 ? 1 : -1);
  };
  stageEl.addEventListener('touchstart', onTouchStart, { passive: true });
  stageEl.addEventListener('touchend', onTouchEnd, { passive: true });
  root.addEventListener('click', onClick);
  flipBox.addEventListener('change', onFlip);
  return { destroy() { stage.stop(); root.removeEventListener('click', onClick); } };
}
