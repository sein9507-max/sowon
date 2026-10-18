/* 소원저장소 — 주제 탭 (내 반응 · 뜨는 주제)  1.7.0 (2026-10-18)
 * 사용자: "대본 탭 옆에 컨텐츠 주제선정 탭 — 유튜브/클립 내 데이터 반응을 한번에 보는 페이지부터,
 *          롱폼 TOP10~20 / 인스타 숏폼 10~20 / 블로그 10~20을 보기 좋게 나열, 내가 만들었으면 체크".
 * 자료는 맥북 도구/주제선정_갱신.py 가 <아이디어뇌>/주제선정/ 에 올린다:
 *   반응.json(내 유튜브 공개 성과 추이) · 주제.json(TOP 20 × 3) · 블로그트렌드.json(크롬 확장 어드바이저 수집) · 체크.json(여기서 쓴다) */
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
  const DIR = () => SW.cfg().dir.split('/').filter(Boolean)[0] + '/주제선정';   // 아이디어뇌/주제선정
  const enc = (p) => p.split('/').map(encodeURIComponent).join('/');
  const url = (p) => `${SW.repoPath()}/contents/${enc(p)}?ref=${encodeURIComponent(SW.cfg().branch)}&t=${Date.now()}`;

  let react = null, topics = null, trend = null, checks = {}, checksSha = null, loading = false, loadedAt = 0;
  let rcKind = LS.get('mb.rcKind', 'all'), rcSort = LS.get('mb.rcSort', 'views');
  let tpList = LS.get('mb.tpList', 'longform'), tpHideDone = LS.get('mb.tpHideDone', false);
  const LISTS = [['longform', '🎬 유튜브 롱폼'], ['shorts', '📱 인스타 숏폼'], ['blog', '✍️ 블로그']];

  async function readJSON(path) {
    try {
      const meta = await SW.gh(url(path));
      return { data: JSON.parse(SW.b64decode(meta.content || '') || '{}'), sha: meta.sha };
    } catch (e) { if (e.status === 404) return { data: {}, sha: null }; throw e; }
  }
  async function writeChecks(mutate, message) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const f = await readJSON(`${DIR()}/체크.json`);
      const entries = (f.data && typeof f.data.entries === 'object' && f.data.entries) || {};
      mutate(entries);
      const body = { version: 1, note: '소원저장소 주제 탭에서 만들었음 체크. id는 주제.json의 id', entries };
      try {
        const res = await SW.gh(`${SW.repoPath()}/contents/${enc(`${DIR()}/체크.json`)}`, { method: 'PUT', body: { message, branch: SW.cfg().branch, content: SW.b64encode(JSON.stringify(body, null, 2) + '\n'), ...(f.sha ? { sha: f.sha } : {}) } });
        checks = entries; checksSha = res.content.sha; return;
      } catch (e) { if ((e.status === 409 || e.status === 422) && attempt < 2) continue; throw e; }
    }
  }
  async function load(force) {
    if (loading || !SW.cfg().token || !navigator.onLine) { renderAll(); return; }
    if (!force && Date.now() - loadedAt < 60000) { renderAll(); return; }
    loading = true; renderAll();
    try {
      const [r, t, b, c] = await Promise.all([readJSON(`${DIR()}/반응.json`), readJSON(`${DIR()}/주제.json`), readJSON(`${DIR()}/블로그트렌드.json`), readJSON(`${DIR()}/체크.json`)]);
      react = r.data && r.data.videos ? r.data : null;
      topics = t.data && t.data.lists ? t.data : null;
      trend = b.data && b.data.rows ? b.data : null;
      checks = (c.data && c.data.entries) || {}; checksSha = c.sha;
      loadedAt = Date.now();
    } catch (e) { SW.toast(`주제 자료 불러오기 실패: ${e.message || e}`); }
    finally { loading = false; renderAll(); }
  }

  const n = (x) => x == null ? '-' : x >= 10000 ? (x / 10000).toFixed(x >= 100000 ? 0 : 1).replace(/\.0$/, '') + '만' : x.toLocaleString('ko-KR');
  const sign = (x) => x == null ? '' : x > 0 ? `+${n(x)}` : x < 0 ? `−${n(-x)}` : '0';
  const kindLabel = (k) => k === 'short' ? '쇼츠' : '롱폼';
  const yt = (id) => `https://youtu.be/${id}`;

  // ── 내 반응 ──────────────────────────────────────────
  function spark(hist) {
    // 조회수 추이 작은 막대 (최근 14일). 값이 같으면 평평하게.
    const box = el('div', 'rc-spark');
    const vals = hist.map((h) => h[1]); const lo = Math.min(...vals), hi = Math.max(...vals);
    hist.forEach((h) => { const b = el('i'); b.style.height = `${hi === lo ? 40 : 10 + Math.round((h[1] - lo) / (hi - lo) * 90)}%`; b.title = `${h[0]} ${n(h[1])}`; box.append(b); });
    return box;
  }
  function rcRow(v, rank) {
    const c = el('article', 'rc-card' + (v.stale ? ' is-stale' : ''));
    const head = el('div', 'rc-head');
    head.append(el('b', 'rc-rank', `${rank}`), el('span', 'rc-kind ' + (v.kind === 'short' ? 'k-short' : 'k-long'), kindLabel(v.kind)), el('span', 'rc-date', `${v.published || ''}${v.seconds ? ` · ${v.seconds}초` : ''}`));
    c.append(head);
    const t = el('a', 'rc-title', v.title); t.href = yt(v.id); t.target = '_blank'; t.rel = 'noopener noreferrer'; c.append(t);
    const nums = el('div', 'rc-nums');
    nums.append(stat('조회', n(v.views)), stat('어제 대비', sign(v.d1), v.d1 > 0 ? 'up' : ''), stat('7일', sign(v.d7)), stat('좋아요', `${n(v.likes)}${v.likeRate != null ? ` (${v.likeRate}‰)` : ''}`));
    c.append(nums);
    if (Array.isArray(v.history) && v.history.length >= 2) c.append(spark(v.history));
    if (v.stale) c.append(el('p', 'hint small', `오늘 목록에 안 보여요 (마지막 ${v.stale})`));
    return c;
  }
  function stat(label, value, cls) { const s = el('div', 'rc-stat' + (cls ? ' ' + cls : '')); s.append(el('small', null, label), el('b', null, value)); return s; }
  function sortedVideos() {
    let list = (react && react.videos) ? react.videos.filter((v) => !v.stale) : [];
    if (rcKind !== 'all') list = list.filter((v) => (rcKind === 'short') === (v.kind === 'short'));
    const key = rcSort === 'd1' ? (v) => v.d1 || 0 : rcSort === 'like' ? (v) => (v.views >= 300 ? v.likeRate || 0 : -1) : rcSort === 'new' ? (v) => v.published || '' : (v) => v.views || 0;
    return [...list].sort((a, b) => (key(b) > key(a) ? 1 : key(b) < key(a) ? -1 : 0));
  }
  function renderReact() {
    const box = $('#rcList'); if (!box) return;
    const fb = $('#rcFilter'); fb.textContent = '';
    [['all', '전체'], ['short', '쇼츠'], ['long', '롱폼']].forEach(([k, label]) => {
      const b = el('button', 'chip' + (rcKind === k ? ' is-on' : ''), label); b.type = 'button'; b.addEventListener('click', () => { rcKind = k; LS.set('mb.rcKind', k); renderReact(); }); fb.append(b);
    });
    const sb = $('#rcSort'); sb.textContent = '';
    [['views', '조회수'], ['d1', '어제 대비'], ['like', '좋아요율'], ['new', '최신']].forEach(([k, label]) => {
      const b = el('button', 'chip' + (rcSort === k ? ' is-on' : ''), label); b.type = 'button'; b.addEventListener('click', () => { rcSort = k; LS.set('mb.rcSort', k); renderReact(); }); sb.append(b);
    });
    box.replaceChildren();
    if (!SW.cfg().token) { box.append(el('p', 'hint', '설정 ①에서 저장소 열쇠를 넣으면 내 채널 반응이 보여요.')); return; }
    if (loading && !react) { box.append(el('p', 'hint', '불러오는 중…')); return; }
    if (!react) { box.append(el('p', 'hint', '아직 자료가 없어요. 맥북이 켜져 있으면 20분 안에 유튜브 성과를 정리해 올려요.')); return; }
    const s = react.summary || {};
    const sum = el('div', 'rc-sum');
    sum.append(stat('최근 7일 쇼츠 평균', n(s.recent7 && s.recent7.shorts)), stat('최근 7일 롱폼 평균', n(s.recent7 && s.recent7.long)), stat('기준', `${s.today || ''} ${(s.at || '').slice(11, 16)}`));
    box.append(sum);
    const ig = react.instagram;
    if (ig && Array.isArray(ig.manual) && ig.manual.length) {
      const d = el('details', 'rc-ig'); d.append(el('summary', null, `인스타 릴스 기록 ${ig.manual.length}개 (수기)`));
      ig.manual.forEach((m) => { const p = el('p', 'hint small', `${m.title} — ${n(m.views)}${m.note ? ` · ${m.note}` : ''}`); d.append(p); });
      d.append(el('p', 'hint small', ig.note || '')); box.append(d);
    }
    const list = sortedVideos();
    if (!list.length) { box.append(el('p', 'hint', '여기엔 아직 없어요.')); return; }
    list.slice(0, 60).forEach((v, i) => box.append(rcRow(v, i + 1)));
  }

  // ── 뜨는 주제 ──────────────────────────────────────────
  function toScript(item) {
    const t = $('#mTopic'); if (t) { t.value = item.title; t.dispatchEvent(new Event('input', { bubbles: true })); }
    SW.switchTab('make'); SW.toast('대본 탭에 주제를 넣었어요');
  }
  async function toggle(item, on) {
    try {
      await writeChecks((e) => { if (on) e[item.id] = { done: true, at: SW.isoLocal(new Date()).slice(0, 10), title: item.title }; else delete e[item.id]; },
        `주제 ${on ? '만들었음' : '체크 해제'}: ${item.title.slice(0, 40)}`);
      SW.toast(on ? '만들었음 ✔' : '체크를 풀었어요');
    } catch (e) { SW.toast(`저장 실패: ${e.message || e}`); }
    renderAll();   // 배지(안 만든 TOP5 수)도 같이 갱신
  }
  function tpCard(item, listKey) {
    const done = !!checks[item.id];
    const c = el('article', 'tp-card' + (done ? ' is-done' : ''));
    const lab = el('label', 'tp-check');
    const cb = el('input'); cb.type = 'checkbox'; cb.checked = done; cb.setAttribute('aria-label', '만들었음');
    cb.addEventListener('change', () => toggle(item, cb.checked));
    lab.append(cb, el('b', 'tp-rank', `${item.rank}`));
    const body = el('div', 'tp-body');
    body.append(el('p', 'tp-title', item.title));
    if (item.why) body.append(el('p', 'tp-why', `근거 · ${item.why}`));
    const tags = el('div', 'tp-tags');
    (item.tags || []).forEach((t) => tags.append(el('span', 'tp-tag', t)));
    (item.keywords || []).forEach((t) => tags.append(el('span', 'tp-tag kw', `#${t}`)));
    if (item.source) tags.append(el('span', 'tp-src', item.source));
    if (done && checks[item.id].at) tags.append(el('span', 'tp-src', `✔ ${checks[item.id].at}`));
    body.append(tags);
    const row = el('div', 'tp-row');
    const go = el('button', 'ghost-btn', listKey === 'blog' ? '✎ 글감으로 메모' : '✎ 대본 탭에 넣기'); go.type = 'button';
    go.addEventListener('click', () => { if (listKey === 'blog') { SW.addNote(`✍️ 블로그 글감: ${item.title}${(item.keywords || []).length ? ` (키워드 ${item.keywords.join('·')})` : ''}`, '블로그'); SW.toast('메모에 쌓았어요'); } else toScript(item); });
    row.append(go); body.append(row);
    c.append(lab, body);
    return c;
  }
  function renderTopics() {
    const box = $('#tpList'); if (!box) return;
    const fb = $('#tpFilter'); fb.textContent = '';
    LISTS.forEach(([k, label]) => {
      const cnt = topics && topics.lists && Array.isArray(topics.lists[k]) ? topics.lists[k].filter((x) => !checks[x.id]).length : 0;
      const b = el('button', 'chip' + (tpList === k ? ' is-on' : ''), cnt ? `${label} ${cnt}` : label); b.type = 'button';
      b.addEventListener('click', () => { tpList = k; LS.set('mb.tpList', k); renderTopics(); }); fb.append(b);
    });
    const hd = el('button', 'chip' + (tpHideDone ? ' is-on' : ''), '만든 것 숨기기'); hd.type = 'button';
    hd.addEventListener('click', () => { tpHideDone = !tpHideDone; LS.set('mb.tpHideDone', tpHideDone); renderTopics(); }); fb.append(hd);
    box.replaceChildren();
    if (!SW.cfg().token) { box.append(el('p', 'hint', '설정 ①에서 저장소 열쇠를 넣으면 뜨는 주제가 보여요.')); return; }
    if (loading && !topics) { box.append(el('p', 'hint', '불러오는 중…')); return; }
    if (!topics) { box.append(el('p', 'hint', '아직 주제 목록이 없어요.')); return; }
    if (topics.updatedAt) box.append(el('p', 'hint small', `목록 기준 ${topics.updatedAt}${topics.note ? ` · ${topics.note}` : ''}`));
    if (tpList === 'blog') {
      const tb = el('div', 'tp-trend');
      if (trend && trend.rows && trend.rows.length) {
        tb.append(el('b', null, `크리에이터 어드바이저 키워드 ${trend.rows.length}개 (${(trend.updatedAt || '').slice(0, 16)})`));
        const wrap = el('div', 'tp-tags');
        trend.rows.slice(0, 60).forEach((r) => wrap.append(el('span', 'tp-tag kw', `${r.rank ? r.rank + '. ' : ''}${r.keyword}${r.count ? ` ${n(Number(r.count) || r.count)}` : ''}`)));
        tb.append(wrap);
      } else {
        tb.append(el('p', 'hint small', (trend && trend.hint) || '크롬 확장에서 어드바이저 트렌드를 수집하면 검색 유입·홈판 키워드가 여기 같이 보여요.'));
      }
      box.append(tb);
    }
    let list = Array.isArray(topics.lists[tpList]) ? topics.lists[tpList] : [];
    if (tpHideDone) list = list.filter((x) => !checks[x.id]);
    if (!list.length) { box.append(el('p', 'hint', tpHideDone ? '남은 주제가 없어요. 다 만들었어요!' : '여기엔 아직 없어요.')); return; }
    list.forEach((item) => box.append(tpCard(item, tpList)));
  }

  function renderAll() {
    renderReact(); renderTopics();
    const undone = topics && topics.lists ? LISTS.reduce((a, [k]) => a + (Array.isArray(topics.lists[k]) ? topics.lists[k].filter((x) => !checks[x.id] && x.rank <= 5).length : 0), 0) : 0;
    const badge = $('#topicCount'); if (badge) badge.textContent = undone ? String(undone) : '';
    const nb = $('#topicNavCount'); if (nb) nb.textContent = undone ? String(undone) : '';
  }

  document.addEventListener('sowon:tab', (e) => { if (e.detail === 'react' || e.detail === 'topics') load(); });
  $('#rcRefresh').addEventListener('click', () => load(true));
  $('#tpRefresh').addEventListener('click', () => load(true));
  window.addEventListener('online', () => load(true));
  renderAll();
  load(true);
})();
