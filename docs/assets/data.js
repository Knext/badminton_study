// 데이터 로드 + ID 인덱스 + 레벨 조회 헬퍼. 계약: badminton-guide-build/references/data-contract.md
// 사이트는 docs/data/*.json 만 읽는다. 생성은 curator·designer 소유.

const FILES = ['levels', 'guide', 'rotations', 'glossary'];
// 연습방법 탭 데이터 — 없거나 깨져도 다른 화면은 살린다(연습방법 화면만 안내 문구).
const OPTIONAL = ['practice'];

// 개발 스위치: ?data=fixtures 이면 저장소의 _workspace/fixtures/ 를 읽는다
// (저장소 루트에서 서버를 띄울 때만 의미가 있다). 배포본에는 _workspace 가 없으므로
// 켜도 로드 실패 메시지가 날 뿐 다른 효과는 없다. 그 외 값은 무시한다.
function dataBase() {
  const flag = new URLSearchParams(window.location.search).get('data');
  return flag === 'fixtures' ? '../_workspace/fixtures/' : 'data/';
}

async function fetchJSON(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${url} 을(를) 불러오지 못했습니다 (HTTP ${res.status})`);
  try {
    return await res.json();
  } catch (err) {
    throw new Error(`${url} 의 JSON 형식이 올바르지 않습니다: ${err.message}`);
  }
}

export async function loadAll() {
  const base = dataBase();
  const entries = await Promise.all(FILES.map(async (f) => [f, await fetchJSON(`${base}${f}.json`)]));
  const optional = await Promise.all(OPTIONAL.map(async (f) => {
    try {
      return [f, await fetchJSON(`${base}${f}.json`)];
    } catch (err) {
      console.warn(`[data] ${f}.json 없음 — 해당 화면은 준비 중으로 표시합니다.`, err.message);
      return [f, null];
    }
  }));
  return buildIndex(Object.fromEntries([...entries, ...optional]));
}

function buildIndex(raw) {
  const levels = raw.levels?.levels ?? [];
  const modules = [...(raw.guide?.modules ?? [])].sort((a, b) => (a.no ?? 0) - (b.no ?? 0));
  const topics = new Map();
  const topicModule = new Map();
  modules.forEach((m) => (m.sections ?? []).forEach((s) => (s.topics ?? []).forEach((t) => {
    topics.set(t.id, t);
    topicModule.set(t.id, { module: m, section: s });
  })));
  const terms = raw.glossary?.terms ?? [];
  const scenarios = raw.rotations?.scenarios ?? [];
  return Object.freeze({
    source: raw.guide?.source ?? null,
    levels,
    levelIds: levels.map((l) => l.id),
    modules,
    moduleById: new Map(modules.map((m) => [m.id, m])),
    topicById: topics,
    topicModule,
    terms,
    termById: new Map(terms.map((t) => [t.id, t])),
    scenarios,
    scenarioById: new Map(scenarios.map((s) => [s.id, s])),
    nodes: raw.rotations?.nodes ?? {},
    players: raw.rotations?.players ?? {},
    practice: raw.practice ? indexPractice(raw.practice) : null,
  });
}

function indexPractice(p) {
  const skills = p.skills ?? [];
  return Object.freeze({
    categories: p.categories ?? [],
    skills,
    skillById: new Map(skills.map((s) => [s.id, s])),
  });
}

// levels 가 생략된 항목(choice 등)은 전 레벨에 보인다(계약 §4-2).
export function visibleAt(item, lv) {
  return !Array.isArray(item?.levels) || item.levels.length === 0 || item.levels.includes(lv);
}

// 레벨 L 에서 숨겨진 항목 중 가장 가까운 상위 레벨과 그 수 → 「중급에 3개 더」.
export function hiddenHint(db, items, lv) {
  const hidden = items.filter((it) => !visibleAt(it, lv));
  if (hidden.length === 0) return null;
  const order = db.levelIds;
  const cur = order.indexOf(lv);
  const ranked = [...order.slice(cur + 1), ...order.slice(0, cur).reverse()];
  const target = ranked.find((id) => hidden.some((it) => it.levels.includes(id)));
  if (!target) return null;
  return { level: levelOf(db, target), count: hidden.filter((it) => it.levels.includes(target)).length };
}

export function levelOf(db, id) {
  return db.levels.find((l) => l.id === id) ?? { id, label: id };
}

// explain 대체 순서: 현재 레벨 → 더 낮은 레벨(가까운 순) → 더 높은 레벨(가까운 순).
export function explainFor(db, explain, lv) {
  if (!explain || typeof explain !== 'object') return '';
  const order = db.levelIds;
  const cur = Math.max(0, order.indexOf(lv));
  const chain = [order[cur], ...order.slice(0, cur).reverse(), ...order.slice(cur + 1)];
  const hit = chain.find((id) => typeof explain[id] === 'string' && explain[id].trim());
  return hit ? explain[hit] : '';
}

// 혼합복식 시나리오인지 — discipline 에 XD 가 있으면 성별(players.gender "M"/"F") 라벨을 쓴다.
export function isMixed(scenario) {
  const d = scenario?.discipline;
  return Array.isArray(d) && d.includes('XD');
}

export const CATEGORY_LABEL = Object.freeze({
  attack: '공격', defense: '수비', serve: '서브·리시브', transition: '전환', basics: '기본',
});
export const RESULT_LABEL = Object.freeze({
  attack_gained: '공격권 획득', defense_held: '수비 성공', point_won: '득점', point_lost: '실점', neutral: '중립',
});
export const QUALITY_LABEL = Object.freeze({ good: '좋은 선택', ok: '무난한 선택', risky: '위험한 선택' });
export const DISCIPLINE_LABEL = Object.freeze({
  MS: '남자단식', WS: '여자단식', MD: '남자복식', WD: '여자복식', XD: '혼합복식',
});
