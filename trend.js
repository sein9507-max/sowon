/* 소원저장소 — 🔥급상승 탭 (인스타 레퍼런스 아이디어 뱅크)
 * 맥북 크롬 확장 '인스타 급상승 수집기'(신혼테크/도구/인스타급상승확장)가 사용자가 인스타를 내리는 동안
 * 어제오늘 올라온 댓글 많은 게시물을 <아이디어뇌>/급상승/YYYY-MM.json 에 쌓는다.
 * 여기서는 그 목록을 보여 주고, '대본에 붙이기'를 누르면 스택에 레퍼런스 메모로 넣어 대본 탭에 붙인다. */
(() => {
  'use strict';
  const SW = window.sowon;
  if (!SW) return;
  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 무시 */ } },
  };
  const DIR = () => SW.cfg().dir.split('/').filter(Boolean)[0] + '/급상승';   // 아이디어뇌/급상승
  const enc = (p) => p.split('/').map(encodeURIComponent).join('/');
  const url = (p) => `${SW.repoPath()}/contents/${enc(p)}?ref=${encodeURIComponent(SW.cfg().branch)}&t=${Date.now()}`;
  const pad = (n) => String(n).padStart(2, '0');
  const ym = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  const VIEWS = [['hot', '어제오늘'], ['week', '이번 주'], ['all', '전체'], ['used', '붙인 것']];

  let items = [], loading = false, loadedAt = 0;
  let view = LS.get('mb.trendView', 'hot');
  let used = LS.get('mb.trendUsed', {});        // code → 붙인 날짜

  async function readMonth(month) {
    try {
      const meta = await SW.gh(url(`${DIR()}/${month}.json`));
      const data = JSON.parse(SW.b64decode(meta.content || '') || '{}');
      return Array.isArray(data.entries) ? data.entries : [];
    } catch (e) { if (e.status === 404) return []; throw e; }
  }
  async function load(force) {
    if (loading || !SW.cfg().token || !navigator.onLine) { render(); return; }
    if (!force && Date.now() - loadedAt < 60000) { render(); return; }
    loading = true; render();
    try {
      const now = new Date(), prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const [a, b] = await Promise.all([readMonth(ym(now)), readMonth(ym(prev))]);
      const byCode = new Map();
      [...b, ...a].forEach((x) => byCode.set(x.code, x));
      items = [...byCode.values()];
      loadedAt = Date.now();
    } catch (e) { SW.toast(`급상승 불러오기 실패: ${e.message || e}`); }
    finally { loading = false; render(); }
  }

  const hours = (iso) => (Date.now() - new Date(iso).getTime()) / 36e5;
  const ageOf = (x) => hours(x.postedAt || x.capturedAt);
  function ago(iso) {
    if (!iso) return '시간 모름';
    const h = hours(iso);
    return h < 1 ? `${Math.max(1, Math.round(h * 60))}분 전` : h < 24 ? `${Math.round(h)}시간 전` : `${Math.round(h / 24)}일 전`;
  }
  function short(n) { return n == null ? '?' : n >= 10000 ? (n / 10000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, '') + '만' : n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + '천' : String(n); }

  function filtered() {
    let list = items;
    if (view === 'hot') list = list.filter((x) => ageOf(x) <= 48);
    else if (view === 'week') list = list.filter((x) => ageOf(x) <= 24 * 7);
    else if (view === 'used') list = list.filter((x) => used[x.code]);
    return [...list].sort((a, b) => (b.comments || 0) - (a.comments || 0));
  }

  function refText(x) {         // 스택에 들어갈 레퍼런스 메모
    return [`🔥 인스타 급상승 레퍼런스 — @${x.user || '?'} (댓글 ${short(x.comments)}${x.likes ? ` · 좋아요 ${short(x.likes)}` : ''} · ${ago(x.postedAt)})`,
      x.caption ? `글: ${x.caption}` : '', `링크: ${x.url}`,
      '이 게시물이 왜 댓글을 많이 받았는지(후킹·공감 포인트)만 참고해서 내 주제로 다시 만든다. 문장은 베끼지 않는다.'].filter(Boolean).join('\n');
  }
  function toScript(x) {
    const entry = SW.addNote(refText(x), '대본');
    used[x.code] = SW.isoLocal(new Date()).slice(0, 10); LS.set('mb.trendUsed', used);
    document.dispatchEvent(new CustomEvent('sowon:toScript', { detail: { ...entry, ref: true } }));
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); SW.toast('링크를 복사했어요'); }
    catch { window.prompt('길게 눌러 복사하세요', text); }
  }

  function card(x) {
    const c = el('article', 'tr-card' + (used[x.code] ? ' is-used' : ''));
    const head = el('div', 'tr-head');
    head.append(el('b', 'tr-n', `💬 ${short(x.comments)}`), el('span', 'tr-user', `@${x.user || '?'}`), el('span', 'tr-sub', `${ago(x.postedAt)}${x.topic ? ` · ${x.topic}` : ''}`));
    c.append(head);
    if (x.caption) c.append(el('p', 'tr-cap', x.caption));
    const row = el('div', 'tr-row');
    const open = el('a', 'ghost-btn', '인스타에서 보기'); open.href = x.url; open.target = '_blank'; open.rel = 'noopener noreferrer';
    const cp = el('button', 'ghost-btn', '링크 복사'); cp.type = 'button'; cp.addEventListener('click', () => copy(x.url));
    const go = el('button', 'aqua-btn small', used[x.code] ? '✔ 다시 붙이기' : '대본에 붙이기'); go.type = 'button'; go.addEventListener('click', () => toScript(x));
    row.append(open, cp, go); c.append(row);
    return c;
  }

  function render() {
    const box = $('#trList'); if (!box) return;
    const hot = items.filter((x) => ageOf(x) <= 48 && !used[x.code]).length;
    $('#trendCount').textContent = hot ? String(hot) : '';
    const fb = $('#trFilter'); fb.textContent = '';
    VIEWS.forEach(([k, label]) => {
      const b = el('button', 'chip' + (view === k ? ' is-on' : ''), label); b.type = 'button'; b.setAttribute('aria-pressed', String(view === k));
      b.addEventListener('click', () => { view = k; LS.set('mb.trendView', k); render(); }); fb.append(b);
    });
    box.replaceChildren();
    if (!SW.cfg().token) { box.append(el('p', 'hint', '설정 ①에서 저장소 열쇠를 넣으면 급상승 레퍼런스가 보여요.')); return; }
    if (loading && !items.length) { box.append(el('p', 'hint', '급상승 레퍼런스 불러오는 중…')); return; }
    const list = filtered();
    if (!list.length) {
      box.append(el('p', 'hint', view === 'hot' ? '어제오늘 쌓인 게 아직 없어요. 맥북 크롬에서 인스타 홈을 몇 번 내려 보세요.' : '여기엔 아직 없어요.'));
      return;
    }
    list.forEach((x) => box.append(card(x)));
  }

  document.addEventListener('sowon:tab', (e) => { if (e.detail === 'trend') load(); });
  $('#trRefresh').addEventListener('click', () => load(true));
  window.addEventListener('online', () => load(true));
  render();
  load(true);
})();
