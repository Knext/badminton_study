// 자세 그림 렌더러 — 계약 §7 의 관절 좌표를 **그대로** 그린다(좌표계 240×300, 바닥 y=280;
// 머리 위로 올라간 라켓·셔틀이 잘리지 않게 viewBox 위쪽만 넓힌다 — poseTop).
// 기하(관절 위치·뼈 연결·라켓 손잡이 40% + 헤드 타원)는 참조 렌더러
// stroke-technique-illustration/scripts/pose_preview.py 와 같다. 스타일만 다르다.
// 좌우 반전(왼손잡이 보기)은 x → 240 − x 를 이 파일 안에서만 적용한다.

import { drawArrows, drawCallouts, racketHeadBox } from './pose-labels.js';

const NS = 'http://www.w3.org/2000/svg';
const W = 240;
const GROUND = 280;
const BONES = [
  ['neck', 'head'], ['neck', 'pelvis'], ['neck', 'sh_r'], ['neck', 'sh_l'],
  ['pelvis', 'hip_r'], ['pelvis', 'hip_l'], ['sh_r', 'el_r'], ['el_r', 'wr_r'],
  ['sh_l', 'el_l'], ['el_l', 'wr_l'], ['hip_r', 'kn_r'], ['kn_r', 'an_r'], ['an_r', 'toe_r'],
  ['hip_l', 'kn_l'], ['kn_l', 'an_l'], ['an_l', 'toe_l'],
];
const JOINTS = ['head', 'neck', 'sh_r', 'el_r', 'wr_r', 'sh_l', 'el_l', 'wr_l', 'pelvis',
  'hip_r', 'kn_r', 'an_r', 'toe_r', 'hip_l', 'kn_l', 'an_l', 'toe_l'];
const ARROW_KINDS = new Set(['move', 'swing', 'rotate', 'force']);
const CALLOUT_FONT = 11;
const PLAY_MS = 750;
const HOLD_MS = 650;

function el(tag, attrs, parent) {
  const node = document.createElementNS(NS, tag);
  Object.entries(attrs ?? {}).forEach(([k, v]) => node.setAttribute(k, String(v)));
  if (parent) parent.appendChild(node);
  return node;
}

const isPoint = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);

// 뼈가 어느 쪽 사지인가 — 끝점 이름의 _r/_l. 몸통·목은 가운데(라켓 쪽과 같은 진한 색).
function boneSide(a, b) {
  if (a.endsWith('_r') || b.endsWith('_r')) return 'r';
  if (a.endsWith('_l') || b.endsWith('_l')) return 'l';
  return 'c';
}

function flipPoint(p, flip) {
  return flip ? [W - p[0], p[1]] : p;
}

// 표시용 좌표 묶음 — 반전 여부만 반영한다. 원본 객체는 건드리지 않는다.
function project(pose, flip) {
  const f = (p) => (isPoint(p) ? flipPoint(p, flip) : null);
  return {
    hand: pose.hand === 'L' ? 'L' : 'R',
    joints: Object.fromEntries(JOINTS.map((k) => [k, f(pose.joints?.[k])])),
    racket: f(pose.racket),
    shuttle: f(pose.shuttle),
    arrows: (pose.arrows ?? []).map((a) => ({ ...a, from: f(a.from), to: f(a.to) })).filter((a) => a.from && a.to),
    callouts: pose.callouts ?? [],
  };
}

function drawRacket(g, wrist, tip) {
  const [wx, wy] = wrist;
  const [rx, ry] = tip;
  const mx = wx + (rx - wx) * 0.4;
  const my = wy + (ry - wy) * 0.4;
  el('line', { x1: wx, y1: wy, x2: mx, y2: my, class: 'pz-handle' }, g);
  const cx = (mx + rx) / 2;
  const cy = (my + ry) / 2;
  const ang = (Math.atan2(ry - my, rx - mx) * 180) / Math.PI;
  const rl = Math.hypot(rx - mx, ry - my) / 2;
  el('ellipse', { cx, cy, rx: rl, ry: rl * 0.62, transform: `rotate(${ang} ${cx} ${cy})`, class: 'pz-head-r' }, g);
}

function defs(svg) {
  const d = el('defs', {}, svg);
  ARROW_KINDS.forEach((kind) => {
    const m = el('marker', { id: `pz-ah-${kind}`, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto' }, d);
    el('path', { d: 'M0,0 L10,5 L0,10 z', class: `pz-${kind}-fill` }, m);
  });
}

// 한 자세를 g 에 그린다. extras=false 면 화살표·말풍선 생략(보간 중·썸네일).
function drawPose(g, pose, { flip = false, extras = true, top = 0 } = {}) {
  g.replaceChildren();
  const pr = project(pose, flip);
  const j = pr.joints;
  const racketSide = pr.hand === 'L' ? 'l' : 'r';
  el('line', { x1: 0, y1: GROUND, x2: W, y2: GROUND, class: 'pz-floor' }, g);
  if (pose.airborne) {
    // 점프 중: 발 아래 바닥에 그림자 + 「점프」 표시(발이 바닥에서 떨어진 것을 분명히).
    const feet = ['an_r', 'an_l', 'toe_r', 'toe_l'].map((k) => pr.joints[k]).filter(Boolean);
    const xs = feet.map((p) => p[0]);
    const cx = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : W / 2;
    el('ellipse', { cx, cy: GROUND, rx: 30, ry: 4, class: 'pz-shadow' }, g);
    el('text', { x: 6, y: GROUND - 6, class: 'pz-air' }, g).textContent = '점프 ↑';
  }
  const pts = { ...j, racket: pr.racket, shuttle: pr.shuttle };
  // 반대쪽 사지를 먼저(뒤에) 그린다.
  const order = [...BONES].sort((a, b) => (boneSide(...a) === racketSide ? 1 : 0) - (boneSide(...b) === racketSide ? 1 : 0));
  order.forEach(([a, b]) => {
    if (!j[a] || !j[b]) return;
    const side = boneSide(a, b);
    const cls = side === 'c' || side === racketSide ? 'pz-near' : 'pz-far';
    el('line', { x1: j[a][0], y1: j[a][1], x2: j[b][0], y2: j[b][1], class: `pz-bone ${cls}` }, g);
  });
  if (j.head) el('circle', { cx: j.head[0], cy: j.head[1], r: 13, class: 'pz-head' }, g);
  const wrist = j[pr.hand === 'L' ? 'wr_l' : 'wr_r'];
  if (wrist && pr.racket) drawRacket(g, wrist, pr.racket);
  if (pr.shuttle) el('circle', { cx: pr.shuttle[0], cy: pr.shuttle[1], r: 5, class: 'pz-shuttle' }, g);
  if (extras) {
    // 글씨가 피할 것: 라켓 헤드, 머리, 말풍선이 가리키는 점(점 자체는 데이터 좌표라 움직일 수 없다).
    const fixed = [
      racketHeadBox(wrist, pr.racket),
      j.head && { x: j.head[0] - 14, y: j.head[1] - 14, w: 28, h: 28 },
      ...pr.callouts.map((c) => pts[c.joint]).filter(Boolean).map((p) => ({ x: p[0] - 6, y: p[1] - 6, w: 12, h: 12 })),
    ].filter(Boolean);
    const labels = drawArrows(el, g, pr.arrows, { top, obstacles: fixed });
    drawCallouts(el, g, pr.callouts, pts, { top, obstacles: [...labels, ...fixed] });
  }
}

// 위쪽 여백: 머리 위 타구는 라켓(≥ -40)·셔틀·화살표(≥ -60)가 y<0 으로 올라간다(검사기 허용).
// 한 기술의 모든 단계에서 가장 높은 점을 보고 viewBox 위쪽을 넓힌다 — 단계마다 다르면 재생 중 그림이 출렁인다.
const MAX_HEADROOM = 90; // 셔틀(≥ −60) 위 말풍선까지
// 말풍선 글상자는 가리키는 점 위로 (글자 높이 + 간격)만큼 올라가므로 그 높이도 포함한다.
const CALLOUT_RISE = CALLOUT_FONT + 7 + 6;
function calloutPoint(pose, joint) {
  if (joint === 'racket') return pose.racket;
  if (joint === 'shuttle') return pose.shuttle;
  return pose.joints?.[joint];
}
export function poseTop(poses) {
  const ys = poses.flatMap((p) => [
    p?.racket?.[1], p?.shuttle?.[1],
    ...Object.values(p?.joints ?? {}).map((q) => q?.[1]),
    ...(p?.arrows ?? []).flatMap((a) => [a.from?.[1], a.to?.[1]]),
    ...(p?.callouts ?? []).map((c) => calloutPoint(p, c.joint)?.[1] - CALLOUT_RISE + 14),
  ]).filter(Number.isFinite);
  const minY = ys.length ? Math.min(...ys) : 0;
  return Math.max(-MAX_HEADROOM, Math.min(0, Math.floor(minY - 16)));
}

export function poseSVG(pose, { flip = false, extras = true, label = '', top = poseTop([pose]) } = {}) {
  const svg = el('svg', { viewBox: `0 ${top} ${W} ${300 - top}`, class: 'pose-svg', role: 'img', 'aria-label': label || '자세 그림' });
  defs(svg);
  const g = el('g', {}, svg);
  drawPose(g, pose, { flip, extras, top });
  return svg;
}

// 두 자세 사이 보간 — 관절·라켓·셔틀만(화살표·말풍선은 끝에서 다시 그린다).
function lerpPose(a, b, t) {
  const mix = (p, q) => (isPoint(p) && isPoint(q) ? [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t] : (t < 0.5 ? p : q));
  return {
    ...b,
    joints: Object.fromEntries(JOINTS.map((k) => [k, mix(a.joints?.[k], b.joints?.[k])])),
    racket: mix(a.racket, b.racket),
    shuttle: a.shuttle && b.shuttle ? mix(a.shuttle, b.shuttle) : (t < 0.5 ? a.shuttle : b.shuttle),
    airborne: t < 0.5 ? a.airborne : b.airborne,
  };
}

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// 큰 무대: show(i) 로 단계 i 를 그리고, play() 로 처음부터 끝까지 단계 사이를 보간 재생한다.
export function createPoseStage(host, phases, { onPhase } = {}) {
  const top = poseTop(phases.map((p) => p.pose));
  const svg = poseSVG(phases[0].pose, { label: phases[0].name, top });
  const g = svg.querySelector('g');
  host.replaceChildren(svg);
  const state = { index: 0, flip: false, token: 0 };

  function render(i) {
    state.index = i;
    drawPose(g, phases[i].pose, { flip: state.flip, top });
    svg.setAttribute('aria-label', `${i + 1}단계 ${phases[i].name} 자세`);
    onPhase?.(i);
  }

  function tween(a, b, my) {
    return new Promise((resolve) => {
      let t0 = null;
      const tick = (ts) => {
        if (my !== state.token) return resolve(false);
        t0 ??= ts;
        const t = Math.min(1, (ts - t0) / PLAY_MS);
        drawPose(g, lerpPose(a, b, ease(t)), { flip: state.flip, extras: false, top });
        if (t < 1) requestAnimationFrame(tick); else resolve(true);
      };
      requestAnimationFrame(tick);
    });
  }

  const wait = (ms, my) => new Promise((r) => setTimeout(() => r(my === state.token), ms));

  async function play() {
    const my = ++state.token;
    if (reducedMotion()) { render(phases.length - 1); return; }
    render(0);
    for (let i = 1; i < phases.length; i += 1) {
      if (!(await wait(HOLD_MS, my))) return;
      if (!(await tween(phases[i - 1].pose, phases[i].pose, my))) return;
      render(i);
    }
  }

  return Object.freeze({
    show(i) { state.token += 1; render(i); },
    play,
    stop() { state.token += 1; },
    setFlip(flip) { state.flip = flip; render(state.index); },
    get index() { return state.index; },
  });
}
