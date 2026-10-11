// 드릴 코트 배치도(계약 §6-1). court.js 의 코트 바탕·샷 스타일을 재사용한다.
// 좌표는 로테이션과 같은 절대 좌표(cm, 610×1340, 네트 y=670) — 변환하지 않는다.

import { el, drawBase, shotStyle, curvePath } from './court.js';

const PAD = 40;
const ROLE = Object.freeze({
  player: { fill: 'var(--a)', ink: 'var(--a-ink)', label: '연습자' },
  partner: { fill: '#F7E08A', ink: 'var(--a-ink)', label: '파트너' },
  feeder: { fill: 'var(--b)', ink: 'var(--b-ink)', label: '피더' },
});
const isPoint = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);

function viewBoxOf(view) {
  const [x, y, w, h] = Array.isArray(view) && view.length === 4 ? view : [0, 0, 610, 1340];
  return [x - PAD, y - PAD, w + PAD * 2, h + PAD * 2];
}

function badge(g, [x, y], n) {
  el('circle', { cx: x, cy: y, r: 17, class: 'dg-badge' }, g);
  el('text', { x, y, class: 'dg-badge-t' }, g).textContent = String(n);
}

// 순서 번호 배치: 사람 원 밖으로, 번호끼리 겹치지 않게 밀어낸다(그리는 것은 사람 다음 — 맨 위).
const BADGE_R = 21; // practice.css .diagram .dg-badge 와 맞춘다
const PERSON_R = 30;
function spreadBadges(badges, people) {
  const out = badges.map((b) => ({ ...b, pos: [...b.pos] }));
  const push = (b, [cx, cy], minD) => {
    const dx = b.pos[0] - cx;
    const dy = b.pos[1] - cy;
    const d = Math.hypot(dx, dy);
    if (d >= minD) return false;
    const [ux, uy] = d > 0.5 ? [dx / d, dy / d] : [-1, 0];
    b.pos = [cx + ux * minD, cy + uy * minD];
    return true;
  };
  for (let pass = 0; pass < 12; pass += 1) {
    let moved = false;
    out.forEach((b, i) => {
      people.forEach((p) => { moved = push(b, p, PERSON_R + BADGE_R + 3) || moved; });
      out.slice(0, i).forEach((o) => { moved = push(b, o.pos, BADGE_R * 2 + 14) || moved; });
    });
    if (!moved) break;
  }
  return out;
}

function drawFlights(g, flights, badges) {
  flights.filter((f) => isPoint(f.from) && isPoint(f.to)).forEach((f) => {
    const st = shotStyle(f.shot);
    const d = curvePath(f.from, f.to, st.bend);
    el('path', {
      d, stroke: st.stroke, 'stroke-width': st.width, 'stroke-dasharray': st.dash,
      'stroke-linecap': 'round', fill: 'none', 'marker-end': `url(#${st.marker})`,
    }, g);
    if (Number.isFinite(f.order)) {
      const [x1, y1] = f.from;
      const [x2, y2] = f.to;
      badges.push({ pos: [(x1 + x2) / 2 - (y2 - y1) * st.bend * 0.5, (y1 + y2) / 2 + (x2 - x1) * st.bend * 0.5], n: f.order });
    }
  });
}

function drawMoves(g, moves, badges) {
  moves.filter((m) => isPoint(m.from) && isPoint(m.to)).forEach((m) => {
    el('line', { x1: m.from[0], y1: m.from[1], x2: m.to[0], y2: m.to[1], class: 'move', 'stroke-dasharray': '8 8', 'marker-end': 'url(#arrM)' }, g);
    el('circle', { cx: m.from[0], cy: m.from[1], r: 26, class: 'ghost' }, g);
    if (Number.isFinite(m.order)) badges.push({ pos: [m.from[0] - 34, m.from[1]], n: m.order });
  });
}

export function diagramSVG(diagram, { label = '' } = {}) {
  const vb = viewBoxOf(diagram.view);
  const svg = el('svg', { viewBox: vb.join(' '), class: 'court diagram', role: 'img', 'aria-label': label || '드릴 배치도' });
  drawBase(svg);
  const g = el('g', {}, svg);
  (diagram.targets ?? []).forEach((t) => {
    if (!Array.isArray(t.rect) || t.rect.length !== 4) return;
    const [x, y, w, h] = t.rect;
    const z = el('g', { class: 'zone zone-A' }, g);
    el('rect', { x, y, width: w, height: h, rx: 8 }, z);
    if (t.label) el('text', { x: x + w / 2, y: y + h / 2 + 8 }, z).textContent = t.label;
  });
  const badges = [];
  drawMoves(g, diagram.moves ?? [], badges);
  drawFlights(g, diagram.flights ?? [], badges);
  (diagram.people ?? []).filter((p) => isPoint(p.pos)).forEach((p) => {
    const role = ROLE[p.role] ?? ROLE.partner;
    if (!ROLE[p.role]) console.warn(`[diagram] 알 수 없는 role "${p.role}"`);
    const pg = el('g', { class: 'player', transform: `translate(${p.pos[0]} ${p.pos[1]})` }, g);
    el('circle', { class: 'body', r: 30, fill: role.fill }, pg);
    el('text', { fill: role.ink }, pg).textContent = p.id;
  });
  (diagram.notes ?? []).filter((n) => isPoint(n.at)).forEach((n) => {
    el('text', { x: n.at[0], y: n.at[1], class: 'dg-note' }, g).textContent = n.text ?? '';
  });
  const peoplePos = (diagram.people ?? []).map((p) => p.pos).filter(isPoint);
  spreadBadges(badges, peoplePos).forEach((b) => badge(g, b.pos, b.n));
  return svg;
}

// 배치도 아래 범례(사람 역할) — 실제로 등장한 역할만.
export function diagramRoles(diagram) {
  const seen = [...new Set((diagram.people ?? []).map((p) => p.role))];
  return seen.map((r) => ({ role: r, ...(ROLE[r] ?? ROLE.partner), ids: diagram.people.filter((p) => p.role === r).map((p) => p.id) }));
}
