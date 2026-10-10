// SVG 코트·선수·셔틀·구역 렌더 + 보간 애니메이션.
// 좌표는 계약 §4-1 의 절대 좌표(cm, 610×1340, 네트 y=670)를 그대로 쓴다 — 미러링하지 않는다.
// 좌표 변환이 필요해지면 이 파일에만 둔다.

const NS = 'http://www.w3.org/2000/svg';
const PLAYER_IDS = ['A1', 'A2', 'B1', 'B2'];
const MOVE_MS = 600;
const VIEWBOX = '-70 -60 750 1460';

const SOFT = { stroke: '#B9E6FF', width: 4, dash: '2 10', bend: 0.08, marker: 'arrC', ms: 650 };
const HARD = { stroke: '#FFFFFF', width: 4, dash: 'none', bend: 0.02, marker: 'arrW', ms: 450 };
const HIGH = { stroke: '#FFFFFF', width: 4.5, dash: '14 11', bend: 0.16, marker: 'arrW', ms: 900 };
const SHOT_STYLE = Object.freeze({
  smash: { ...HARD, width: 6.5, ms: 380 },
  kill: { ...HARD, width: 5.5, ms: 360 },
  drive: HARD,
  push: HARD,
  drop: SOFT,
  net: { ...SOFT, ms: 500 },
  block: SOFT,
  serve_low: SOFT,
  lift: HIGH,
  clear: HIGH,
  serve_flick: HIGH,
});
const FALLBACK_STYLE = { stroke: '#DDDDDD', width: 3, dash: '6 6', bend: 0.05, marker: 'arrW', ms: 600 };
const warned = new Set();

function shotStyle(kind) {
  const st = SHOT_STYLE[kind];
  if (st) return st;
  if (!warned.has(kind)) {
    warned.add(kind);
    console.warn(`[court] 알 수 없는 shot 종류 "${kind}" — 기본 스타일로 그립니다.`);
  }
  return FALLBACK_STYLE;
}

function el(tag, attrs, parent) {
  const node = document.createElementNS(NS, tag);
  Object.entries(attrs ?? {}).forEach(([k, v]) => node.setAttribute(k, String(v)));
  if (parent) parent.appendChild(node);
  return node;
}

function curvePath(from, to, bend) {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const mx = (x1 + x2) / 2 - dy * bend;
  const my = (y1 + y2) / 2 + dx * bend;
  return `M${x1},${y1} Q${mx},${my} ${x2},${y2}`;
}

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// 표시 전용: 두 선수 원이 겹치면(데이터상 의도된 겹침 포함) 라벨이 읽히도록 서로 반대 방향으로 벌린다.
// 저장 좌표는 바꾸지 않는다 — 화면 배치에만 적용한다.
const MIN_GAP = 80;
function spreadForLabels(pos) {
  const out = Object.fromEntries(Object.entries(pos).map(([k, p]) => [k, [...p]]));
  PLAYER_IDS.forEach((a, i) => PLAYER_IDS.slice(i + 1).forEach((b) => {
    const [ax, ay] = out[a];
    const [bx, by] = out[b];
    const d = Math.hypot(bx - ax, by - ay);
    if (d >= MIN_GAP) return;
    const [ux, uy] = d > 0.5 ? [(bx - ax) / d, (by - ay) / d] : [1, 0];
    const push = (MIN_GAP - d) / 2;
    out[a] = [ax - ux * push, ay - uy * push];
    out[b] = [bx + ux * push, by + uy * push];
  }));
  return out;
}

const isPoint = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);

function drawBase(svg) {
  const defs = el('defs', {}, svg);
  [['arrW', '#fff', 5], ['arrC', '#B9E6FF', 5], ['arrM', 'rgba(255,255,255,.6)', 4]].forEach(([id, fill, size]) => {
    const m = el('marker', { id, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: size, markerHeight: size, orient: 'auto' }, defs);
    el('path', { d: 'M0,0 L10,5 L0,10 z', fill }, m);
  });
  el('rect', { x: -70, y: -60, width: 750, height: 1460, rx: 18, fill: 'var(--mat-deep)' }, svg);
  el('rect', { x: 0, y: 0, width: 610, height: 1340, fill: 'var(--mat)' }, svg);
  const lines = el('g', { stroke: 'var(--line)', 'stroke-width': 4, fill: 'none' }, svg);
  el('rect', { x: 0, y: 0, width: 610, height: 1340 }, lines);
  [[46, 0, 46, 1340], [564, 0, 564, 1340], [0, 76, 610, 76], [0, 1264, 610, 1264],
    [0, 472, 610, 472], [0, 868, 610, 868], [305, 0, 305, 472], [305, 868, 305, 1340]]
    .forEach(([x1, y1, x2, y2]) => el('line', { x1, y1, x2, y2 }, lines));
  el('line', { x1: -22, y1: 670, x2: 632, y2: 670, stroke: '#fff', 'stroke-width': 8 }, svg);
  el('circle', { cx: -22, cy: 670, r: 9, fill: '#fff' }, svg);
  el('circle', { cx: 632, cy: 670, r: 9, fill: '#fff' }, svg);
  el('text', { class: 'sidelabel', x: 305, y: -22 }, svg).textContent = '상대 코트';
  el('text', { class: 'sidelabel', x: 305, y: 1385 }, svg).textContent = '우리 코트';
}

export function createCourt(host) {
  const svg = el('svg', { viewBox: VIEWBOX, role: 'img', class: 'court', 'aria-label': '배드민턴 코트' });
  drawBase(svg);
  const layers = Object.fromEntries(['zones', 'ghosts', 'shots', 'players'].map((k) => [k, el('g', { class: k }, svg)]));
  const shuttle = el('circle', { class: 'shuttle', r: 11, fill: '#fff', stroke: '#222', 'stroke-width': 2, opacity: 0 }, svg);
  host.replaceChildren(svg);

  const players = Object.fromEntries(PLAYER_IDS.map((id) => {
    const team = id[0];
    const g = el('g', { class: `player team-${team}` }, layers.players);
    const body = el('g', { class: 'pbody' }, g);
    el('circle', { class: 'ring', r: 40 }, body);
    el('circle', { class: 'body', r: 31, fill: team === 'A' ? 'var(--a)' : 'var(--b)' }, body);
    const label = el('text', { fill: team === 'A' ? 'var(--a-ink)' : 'var(--b-ink)' }, body);
    label.textContent = id;
    // 혼복 성별 표기 — 원 안 ID 는 유지하고(설명문이 ID 로 지칭한다) 원 아래에 작게 붙인다.
    const sub = el('text', { class: 'sub', y: 50 }, body);
    return [id, { g, sub }];
  }));

  let current = null; // 화면에 놓인 좌표 { A1: [x,y], ... }
  let lastNode = null;
  let token = 0;

  function place(pos) {
    PLAYER_IDS.forEach((id) => {
      const p = pos[id];
      if (p) players[id].g.setAttribute('transform', `translate(${p[0]} ${p[1]})`);
    });
  }

  function drawZones(zones) {
    layers.zones.replaceChildren();
    (zones ?? []).forEach((z) => {
      if (!Array.isArray(z.rect) || z.rect.length !== 4) return;
      const [x, y, w, h] = z.rect;
      const g = el('g', { class: `zone${z.team ? ` zone-${z.team}` : ''}` }, layers.zones);
      el('rect', { x, y, width: w, height: h, rx: 10 }, g);
      if (z.label) el('text', { x: x + w / 2, y: y + 32 }, g).textContent = z.label;
    });
  }

  function drawGhosts(from, to) {
    layers.ghosts.replaceChildren();
    if (!from) return;
    PLAYER_IDS.forEach((id) => {
      const p = from[id];
      const q = to[id];
      if (!p || !q) return;
      const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (d < 40) return;
      el('circle', { class: 'ghost', cx: p[0], cy: p[1], r: 31 }, layers.ghosts);
      const ux = (q[0] - p[0]) / d;
      const uy = (q[1] - p[1]) / d;
      el('line', {
        class: 'move', x1: p[0] + ux * 34, y1: p[1] + uy * 34, x2: q[0] - ux * 44, y2: q[1] - uy * 44,
        'stroke-dasharray': '4 6', 'marker-end': 'url(#arrM)',
      }, layers.ghosts);
    });
  }

  function buildShots(shots) {
    layers.shots.replaceChildren();
    return (shots ?? []).filter((s) => isPoint(s.from) && isPoint(s.to)).map((s) => {
      const st = shotStyle(s.shot);
      const path = el('path', {
        class: `shot shot-${s.shot}`, d: curvePath(s.from, s.to, st.bend), stroke: st.stroke,
        'stroke-width': st.width, 'stroke-dasharray': st.dash, 'stroke-linecap': 'round',
        'marker-end': `url(#${st.marker})`, fill: 'none', opacity: 0,
      }, layers.shots);
      return { path, ms: st.ms };
    });
  }

  function animate(ms, onFrame, my) {
    return new Promise((resolve) => {
      let t0 = null;
      const tick = (ts) => {
        if (my !== token) return resolve(false);
        t0 ??= ts;
        const t = Math.min(1, (ts - t0) / ms);
        onFrame(ease(t), t);
        if (t < 1) requestAnimationFrame(tick); else resolve(true);
      };
      requestAnimationFrame(tick);
    });
  }

  async function playShots(list, my) {
    for (const { path, ms } of list) {
      const len = path.getTotalLength();
      shuttle.setAttribute('opacity', 1);
      const ok = await animate(ms, (e, t) => {
        const pt = path.getPointAtLength(len * e);
        shuttle.setAttribute('cx', pt.x);
        shuttle.setAttribute('cy', pt.y);
        path.setAttribute('opacity', Math.min(1, t * 1.6));
      }, my);
      if (!ok) return;
    }
    if (my === token) shuttle.setAttribute('opacity', 0);
  }

  function resolvePos(pos) {
    const resolved = Object.fromEntries(PLAYER_IDS.map((id) => {
      if (isPoint(pos?.[id])) return [id, pos[id]];
      console.warn(`[court] ${id} 좌표가 없습니다 — 이전 위치를 유지합니다.`);
      return [id, current?.[id] ?? [305, id[0] === 'A' ? 1000 : 340]];
    }));
    return spreadForLabels(resolved);
  }

  // node: 계약의 노드. subs: 원 아래 보조 표기 { A1: '남', ... }. fresh=true 면 보간 없이 바로 놓는다.
  async function show(node, { subs = {}, highlight = [], fresh = false } = {}) {
    const my = ++token;
    lastNode = node;
    const target = resolvePos(node.pos);
    PLAYER_IDS.forEach((id) => {
      players[id].sub.textContent = subs[id] ?? '';
      players[id].g.classList.toggle('hl', highlight.includes(id));
    });
    drawZones(node.zones);
    const from = fresh ? null : current;
    drawGhosts(from, target);
    const shots = buildShots(node.shuttle);
    shuttle.setAttribute('opacity', 0);
    if (reducedMotion()) {
      place(target);
      current = target;
      shots.forEach(({ path }) => path.setAttribute('opacity', 1));
      return;
    }
    if (!from) {
      place(target);
      current = target;
      await playShots(shots, my);
      return;
    }
    const start = from;
    const ok = await animate(MOVE_MS, (e) => {
      const mid = Object.fromEntries(PLAYER_IDS.map((id) => [id, [
        start[id][0] + (target[id][0] - start[id][0]) * e,
        start[id][1] + (target[id][1] - start[id][1]) * e,
      ]]));
      place(mid);
      current = mid;
    }, my);
    if (!ok) return;
    current = target;
    await playShots(shots, my);
  }

  function replay() {
    if (!lastNode || reducedMotion()) return;
    const my = ++token;
    playShots(buildShots(lastNode.shuttle), my);
  }

  function setLabel(text) {
    svg.setAttribute('aria-label', text);
  }

  return Object.freeze({ show, replay, setLabel });
}

export function shotLegendHTML() {
  return `
    <span><svg width="34" height="10" aria-hidden="true"><line x1="2" y1="5" x2="32" y2="5" stroke="currentColor" stroke-width="4"/></svg>스매시·드라이브·푸시·킬</span>
    <span><svg width="34" height="10" aria-hidden="true"><line x1="2" y1="5" x2="32" y2="5" stroke="#3A8FC0" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="1 7"/></svg>드롭·네트·블록·로우 서브</span>
    <span><svg width="34" height="10" aria-hidden="true"><path d="M2,8 Q17,-2 32,8" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="6 5"/></svg>리프트·클리어·플릭</span>
    <span><svg width="34" height="10" aria-hidden="true"><line x1="2" y1="5" x2="32" y2="5" stroke="#999" stroke-width="2" stroke-dasharray="3 4"/></svg>이전 위치→이동</span>`;
}
