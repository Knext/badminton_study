// 라우터·레벨 상태·화면 조립.
// 라우트: #/  #/m/<id>  #/t/<id>  #/r  #/r/<scenario>[/<node>]  #/glossary[/<termId>]  #/about
// 레벨은 해시 쿼리 ?lv= 에 둔다(공유 링크가 같은 레벨로 열리게). localStorage 는 마지막 레벨 기억용 편의 기능.

import { loadAll } from './data.js';
import { createPlayer } from './player.js';
import {
  homeView, moduleView, topicView, rotationsView, glossaryView, bindGlossary,
  aboutView, notFoundView, errorView,
} from './views.js';

const LV_KEY = 'bg.level';
const THEME_KEY = 'bg.theme';
const view = document.getElementById('view');
const levelBar = document.getElementById('level-bar');
let db = null;
let player = null;

const store = {
  get(key) { try { return window.localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { window.localStorage.setItem(key, value); } catch { /* 사생활 보호 모드 등 — 무시 */ } },
};

function parseHash() {
  const rawHash = window.location.hash.replace(/^#/, '') || '/';
  const [pathPart, query = ''] = rawHash.split('?');
  const parts = pathPart.split('/').filter(Boolean).map((p) => {
    try { return decodeURIComponent(p); } catch { return p; }
  });
  return { parts, params: new URLSearchParams(query) };
}

function currentLevel(params) {
  const ids = db?.levelIds ?? [];
  const fromUrl = params.get('lv');
  if (ids.includes(fromUrl)) return fromUrl;
  const saved = store.get(LV_KEY);
  return ids.includes(saved) ? saved : ids[0];
}

function hrefWithLevel(lv) {
  const { parts, params } = parseHash();
  const next = new URLSearchParams(params);
  next.set('lv', lv);
  return `#/${parts.map(encodeURIComponent).join('/')}?${next.toString()}`;
}

function navigate(href, { replace = false } = {}) {
  if (replace) window.history.replaceState(null, '', href);
  else window.history.pushState(null, '', href);
  route();
}

function setLevel(lv) {
  store.set(LV_KEY, lv);
  navigate(hrefWithLevel(lv), { replace: true });
}

function renderLevelBar(lv) {
  levelBar.replaceChildren(...db.levels.map((l) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'seg';
    b.dataset.setLevel = l.id;
    b.textContent = l.label;
    b.setAttribute('aria-pressed', String(l.id === lv));
    return b;
  }));
}

function markNav(section) {
  document.querySelectorAll('a[data-base]').forEach((a) => {
    if (a.closest('.site-nav')) {
      if (a.dataset.nav === section) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    }
    a.href = `${a.dataset.base}?lv=${currentLevel(parseHash().params)}`;
  });
}

function dropPlayer() {
  player?.destroy();
  player = null;
}

function showPage(content, title, after) {
  dropPlayer();
  view.innerHTML = content;
  document.title = title ? `${title} · 배드민턴 복식 가이드` : '배드민턴 복식 가이드';
  after?.(view);
  window.scrollTo(0, 0);
}

function routePlayer(parts, lv) {
  const [, sid, nid] = parts;
  const sc = db.scenarioById.get(sid);
  if (!sc) return showPage(notFoundView('시나리오', sid, lv), '찾을 수 없음');
  if (!player || player.scenarioId !== sid) {
    dropPlayer();
    view.replaceChildren();
    window.scrollTo(0, 0);
    player = createPlayer(view, db, sid, { lv, navigate });
    document.title = `${sc.title} · 배드민턴 복식 가이드`;
  } else {
    player.setLevel(lv);
  }
  player.goto(nid ?? sc.start);
}

function route() {
  if (!db) return;
  const { parts, params } = parseHash();
  const lv = currentLevel(params);
  renderLevelBar(lv);
  const [head, id] = parts;
  const section = { r: 'r', m: 'home', t: 'home', glossary: 'glossary', about: 'about' }[head] ?? 'home';
  markNav(section);
  switch (head) {
    case undefined: return showPage(homeView(db, lv), '');
    case 'm': return showPage(moduleView(db, lv, id), db.moduleById.get(id)?.title);
    case 't': return showPage(topicView(db, lv, id), db.topicById.get(id)?.title);
    case 'r': return id ? routePlayer(parts, lv) : showPage(rotationsView(db, lv), '로테이션');
    case 'glossary': return showPage(glossaryView(db, lv, id), '용어집', (root) => bindGlossary(root, id));
    case 'about': return showPage(aboutView(db, lv), '소개');
    default: return showPage(notFoundView('화면', parts.join('/'), lv), '찾을 수 없음');
  }
}

function applyTheme(theme) {
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
  const btn = document.getElementById('theme-toggle');
  const dark = theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches);
  btn.setAttribute('aria-label', dark ? '밝은 화면으로' : '어두운 화면으로');
  btn.textContent = dark ? '☀' : '☾';
}

function bindGlobal() {
  document.addEventListener('click', (ev) => {
    const lvBtn = ev.target.closest('[data-set-level]');
    if (lvBtn) { setLevel(lvBtn.dataset.setLevel); return; }
    if (ev.target.closest('[data-act="retry"]')) { boot(); return; }
    const link = ev.target.closest('a[href^="#"]');
    if (link && !ev.metaKey && !ev.ctrlKey && !ev.shiftKey && ev.button === 0) {
      ev.preventDefault();
      if (link.getAttribute('href') !== window.location.hash) navigate(link.getAttribute('href'));
    }
  });
  // 뒤로가기·주소창 해시 수정 모두 popstate 를 낸다(hashchange 까지 들으면 두 번 그린다).
  window.addEventListener('popstate', route);
  document.getElementById('theme-toggle').addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme;
    const dark = cur === 'dark' || (!cur && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const next = dark ? 'light' : 'dark';
    store.set(THEME_KEY, next);
    applyTheme(next);
  });
}

async function boot() {
  view.innerHTML = '<p class="loading" role="status">불러오는 중…</p>';
  try {
    db = await loadAll();
    route();
  } catch (err) {
    console.error('데이터 로드 실패:', err);
    db = null;
    dropPlayer();
    view.innerHTML = errorView(err.message);
  }
}

applyTheme(store.get(THEME_KEY));
bindGlobal();
boot();
