// 자세 그림의 글씨 배치 — 화살표 라벨과 말풍선(callout).
// 가리키는 점(관절·화살표)은 데이터 좌표 그대로 두고, 글상자만 서로·라켓 헤드와 겹치지 않는 자리로 옮긴다.

const W = 240;
const BOTTOM = 298;
const ARROW_FONT = 10; // practice.css .pz-alabel 과 맞춘다
const CALLOUT_FONT = 11; // practice.css .pz-ctext 와 맞춘다
const LABEL_GAP = 9;
const ARROW_KINDS = new Set(['move', 'swing', 'rotate', 'force']);

// 글자 폭 근사: 한글·전각은 1.05em, 그 밖(라틴·숫자·기호)은 0.6em. 굵은 글씨 기준으로 약간 넉넉히.
const textWidth = (text, size) => [...String(text)].reduce((w, ch) => w + size * (ch.codePointAt(0) > 0x1100 ? 1.05 : 0.6), 2);
const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const overlapArea = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
  * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
// 겹치지 않는 첫 후보, 없으면 겹치는 면적이 가장 작은 후보.
function pickBox(cands, obstacles) {
  const free = cands.find((b) => !obstacles.some((o) => overlaps(b, o)));
  if (free) return free;
  const cost = (b) => obstacles.reduce((sum, o) => sum + overlapArea(b, o), 0);
  return cands.reduce((best, b) => (cost(b) < cost(best) ? b : best), cands[0]);
}
const clampBox = (b, top) => ({
  ...b,
  x: Math.max(2, Math.min(W - 2 - b.w, b.x)),
  y: Math.max(top + 2, Math.min(BOTTOM - b.h, b.y)),
});

// 화살표 선 옆(수직 방향)에 붙일 글상자. side = +1 / -1 (법선 방향), gap = 선에서 떨어진 거리,
// along = 선 위 기준점(0 시작 ~ 1 끝).
function arrowLabelBox(a, w, h, side, top, gap = LABEL_GAP, along = 0.5) {
  const dx = a.to[0] - a.from[0];
  const dy = a.to[1] - a.from[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * side;
  const ny = (dx / len) * side;
  const mx = a.from[0] + dx * along + nx * gap;
  const my = a.from[1] + dy * along + ny * gap;
  const box = Math.abs(nx) >= Math.abs(ny)
    ? { x: nx > 0 ? mx : mx - w, y: my - h / 2, w, h }
    : { x: mx - w / 2, y: ny < 0 ? my - h : my, w, h };
  return clampBox(box, top);
}

// 화살표 라벨을 먼저 놓는다(위쪽 법선 우선, 겹치면 반대쪽). 놓은 상자 목록을 돌려준다.
export function drawArrows(el, g, arrows, { top = 0, obstacles = [] } = {}) {
  const placed = [];
  arrows.forEach((a) => {
    const kind = ARROW_KINDS.has(a.kind) ? a.kind : 'move';
    el('line', {
      x1: a.from[0], y1: a.from[1], x2: a.to[0], y2: a.to[1],
      class: `pz-arrow pz-${kind}`, 'marker-end': `url(#pz-ah-${kind})`,
    }, g);
    if (!a.label) return;
    const label = String(a.label);
    const w = textWidth(label, ARROW_FONT);
    const h = ARROW_FONT + 4;
    const dx = a.to[0] - a.from[0];
    const upFirst = dx >= 0 ? -1 : 1; // 법선 (-dy, dx)·side 의 y 성분이 음수(위)가 되는 쪽부터
    // 후보: 위쪽 법선 → 반대쪽, 가까이 → 멀리, 중점 → 시작점 쪽
    const tries = [0.5, 0.2, 0.8].flatMap((along) => [LABEL_GAP, LABEL_GAP + 12, LABEL_GAP + 24]
      .flatMap((gap) => [upFirst, -upFirst].map((side) => arrowLabelBox(a, w, h, side, top, gap, along))));
    const box = pickBox(tries, [...placed, ...obstacles]);
    placed.push(box);
    const t = el('text', { x: box.x + 1, y: box.y + h / 2 + 0.5, class: `pz-alabel pz-${kind}-t` }, g);
    t.textContent = label;
  });
  return placed;
}

// 말풍선 후보 자리: 점의 오른쪽/왼쪽 × 위아래로 한 칸씩 멀어지며.
function calloutCandidates(p, w, h, top) {
  const preferLeft = p[0] + 10 + w > W - 2;
  const xs = preferLeft ? [p[0] - 10 - w, p[0] + 10] : [p[0] + 10, p[0] - 10 - w];
  const dys = [-(h + 6), 6];
  for (let k = 1; k <= 4; k += 1) dys.push(-(h + 6) - k * (h + 3), 6 + k * (h + 3));
  return xs.flatMap((x) => dys.map((dy) => clampBox({ x, y: p[1] + dy, w, h }, top)));
}

// 말풍선: 화살표 라벨·라켓 헤드·다른 말풍선을 피해 놓는다.
export function drawCallouts(el, g, callouts, pts, { top = 0, obstacles = [] } = {}) {
  const boxes = [];
  callouts.forEach((c) => {
    const p = pts[c.joint];
    if (!p) { console.warn(`[pose] callout 관절 "${c.joint}" 이 없습니다.`); return; }
    const text = String(c.text ?? '');
    const w = Math.min(W - 4, textWidth(text, CALLOUT_FONT) + 8);
    const h = CALLOUT_FONT + 7;
    const cands = calloutCandidates(p, w, h, top);
    const box = pickBox(cands, [...boxes, ...obstacles]);
    boxes.push(box);
    el('line', { x1: p[0], y1: p[1], x2: Math.max(box.x, Math.min(box.x + w, p[0])), y2: box.y + h / 2, class: 'pz-leader' }, g);
    el('circle', { cx: p[0], cy: p[1], r: 4, class: 'pz-dot' }, g);
    el('rect', { x: box.x, y: box.y, width: w, height: h, rx: 4, class: 'pz-box' }, g);
    const t = el('text', { x: box.x + 5, y: box.y + h / 2 + 0.5, class: 'pz-ctext' }, g);
    t.textContent = text;
  });
  return boxes;
}

// 라켓 헤드 타원의 외접 사각형(회전 무시한 보수적 근사).
export function racketHeadBox(wrist, tip) {
  if (!wrist || !tip) return null;
  const mx = wrist[0] + (tip[0] - wrist[0]) * 0.4;
  const my = wrist[1] + (tip[1] - wrist[1]) * 0.4;
  const cx = (mx + tip[0]) / 2;
  const cy = (my + tip[1]) / 2;
  const r = Math.hypot(tip[0] - mx, tip[1] - my) / 2 + 2;
  return { x: cx - r, y: cy - r, w: r * 2, h: r * 2 };
}
