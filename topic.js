/* 소원저장소 — 주제 (레퍼런스 > 급상승 탭 안)  1.7.0 (2026-10-18) → 1.8.0 (10/20) → 1.9.0 (10/21)
 * 사용자: "대본 탭 옆에 컨텐츠 주제선정 탭 — 유튜브/클립 내 데이터 반응을 한번에 보는 페이지부터,
 *          롱폼 TOP10~20 / 인스타 숏폼 10~20 / 블로그 10~20을 보기 좋게 나열, 내가 만들었으면 체크".
 * 10/20: "내 유튜브 성과 1-20순위 나열은 불필요. 내 영상 성과는 네가 확인해서 개선점을 리스트업, 추천 주제 3~5개, 대략적인 롱폼/인스타 대본."
 * 10/21: "밑에 메뉴가 너무 많아졌으니 급상승 안에 주제 탭을 통째로 옮겨. 주제 맨 위에는 유튜브 구독자랑 현재 총조회수 합산 둘 다, 내 반응 탭을 따로 나누지 마."
 *   → 한 화면: 내 채널 숫자(채널별 구독자·총 조회수 + 합산) → 추천 주제 3~5(롱폼·인스타 초안) → 뜨는 주제 TOP 20 → 개선점 → 접힌 내 영상 숫자. (인스타 급상승 수집은 trend.js, 같은 화면 맨 아래)
 * 자료는 맥북 도구/주제선정_갱신.py 가 <아이디어뇌>/주제선정/ 에 올린다:
 *   채널.json(채널별 구독자·총 조회수, 6시간마다 API 로 바로) · 반응.json(내 유튜브 공개 성과 추이; summary.channels 는 예비) · 주제.json(TOP 20 × 3) · 블로그트렌드.json(크롬 확장 어드바이저 수집) · 체크.json(여기서 쓴다)
 *   추천.json(개선점 리스트 + 추천 주제 3~5개 + 롱폼/인스타 대본 초안, 하루 1번 맥북 Claude) */
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

  let react = null, topics = null, trend = null, rec = null, chan = null, checks = {}, checksSha = null, loading = false, loadedAt = 0;
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
      const [r, t, b, c, q, h] = await Promise.all([readJSON(`${DIR()}/반응.json`), readJSON(`${DIR()}/주제.json`), readJSON(`${DIR()}/블로그트렌드.json`), readJSON(`${DIR()}/체크.json`), readJSON(`${DIR()}/추천.json`), readJSON(`${DIR()}/채널.json`)]);
      react = r.data && r.data.videos ? r.data : null;
      chan = h.data && Array.isArray(h.data.channels) ? h.data : null;
      rec = q.data && (Array.isArray(q.data.topics) || Array.isArray(q.data.improvements)) ? q.data : null;
      topics = t.data && t.data.lists ? t.data : null;
      trend = b.data && b.data.rows ? b.data : null;
      checks = (c.data && c.data.entries) || {}; checksSha = c.sha;
      loadedAt = Date.now();
    } catch (e) { if (e.status !== 401) SW.toast(`주제 자료 불러오기 실패: ${e.message || e}`); }   // 401 은 app.js 가 맨 위 띠로 알린다 — 마지막으로 본 자료는 그대로
    finally { loading = false; renderAll(); }
  }

  const n = (x) => x == null ? '-' : x >= 10000 ? (x / 10000).toFixed(x >= 100000 ? 0 : 1).replace(/\.0$/, '') + '만' : x.toLocaleString('ko-KR');
  const sign = (x) => x == null ? '' : x > 0 ? `+${n(x)}` : x < 0 ? `−${n(-x)}` : '0';
  const kindLabel = (k) => k === 'short' ? '쇼츠' : '롱폼';
  const yt = (id) => `https://youtu.be/${id}`;
  const noKey = () => !SW.cfg().token;

  // ── ① 내 채널 숫자 (맨 위) ────────────────────────────
  function stat(label, value, cls) { const s = el('div', 'rc-stat' + (cls ? ' ' + cls : '')); s.append(el('small', null, label), el('b', null, value)); return s; }
  function chCard(name, subs, views, cls, note) {
    const c = el('div', 'ch-card' + (cls ? ' ' + cls : ''));
    c.append(el('small', 'ch-name', name));
    const row = el('div', 'ch-nums');
    row.append(stat('구독자', subs == null ? '-' : n(subs)), stat('총 조회수', views == null ? '-' : n(views)));
    c.append(row);
    if (note) c.append(el('small', 'ch-note', note));
    return c;
  }
  function renderChannel() {
    const box = $('#chStrip'); if (!box) return;
    box.replaceChildren();
    if (noKey()) return;
    const s = (react && react.summary) || null;
    const src = chan && chan.channels ? chan.channels : (s && Array.isArray(s.channels) ? s.channels : []);
    const chs = src.filter((c) => c && (c.subscribers != null || c.totalViews != null));
    if (!chs.length && !s) { box.append(el('p', 'hint small', loading ? '내 채널 숫자 불러오는 중…' : '내 채널 숫자는 맥북이 켜져 있으면 20분 안에 올라와요.')); return; }
    chs.forEach((c) => box.append(chCard(`📺 ${c.name || c.handle || c.id}`, c.subscribers, c.totalViews, '', c.at ? `${String(c.at).slice(5, 16).replace('T', ' ')} 기준` : '')));
    if (chs.length >= 2) {
      const sum = (k) => chs.reduce((a, c) => a + (Number(c[k]) || 0), 0);
      box.append(chCard('Σ 유튜브 합산', sum('subscribers'), sum('totalViews'), 'sum', `채널 ${chs.length}개`));
    }
    if (s && s.recent7) {
      const c = el('div', 'ch-card' + (chs.length >= 2 ? '' : ' sum'));
      c.append(el('small', 'ch-name', '최근 7일 올린 영상 평균'));
      const row = el('div', 'ch-nums');
      row.append(stat('쇼츠', n(s.recent7.shorts)), stat('롱폼', n(s.recent7.long)));
      c.append(row, el('small', 'ch-note', `${s.today || ''} ${(s.at || '').slice(11, 16)} 기준`));
      box.append(c);
    }
  }

  // ── ② 추천 주제 3~5 (남들이 터뜨린 것에서) + 롱폼/인스타 초안 ─────────
  function draftText(lines) { return (lines || []).map((l) => String(l)).join('\n'); }
  function toScriptRec(item) {
    const t = $('#mTopic'); if (t) { t.value = item.title; t.dispatchEvent(new Event('input', { bubbles: true })); }
    const r = $('#mRough'); if (r && Array.isArray(item.insta) && item.insta.length) { r.value = draftText(item.insta); r.dispatchEvent(new Event('input', { bubbles: true })); }
    const c = $('#mCta'); if (c && item.keyword) { c.value = item.keyword; c.dispatchEvent(new Event('input', { bubbles: true })); }
    SW.switchTab('make'); SW.toast('대본 탭에 주제와 인스타 초안을 넣었어요');
  }
  function recCard(item, rank) {
    const done = !!checks[item.id];
    const c = el('article', 'rec-card' + (done ? ' is-done' : ''));
    const lab = el('label', 'tp-check');
    const cb = el('input'); cb.type = 'checkbox'; cb.checked = done; cb.setAttribute('aria-label', '만들었음');
    cb.addEventListener('change', () => toggle(item, cb.checked));
    lab.append(cb, el('b', 'tp-rank', `${rank}`));
    const body = el('div', 'tp-body');
    body.append(el('p', 'tp-title', item.title));
    if (item.why) body.append(el('p', 'tp-why', `근거 · ${item.why}`));
    const tags = el('div', 'tp-tags');
    (item.tags || []).forEach((t) => tags.append(el('span', 'tp-tag', t)));
    if (item.keyword) tags.append(el('span', 'tp-tag kw', `댓글 '${item.keyword}'`));
    if (item.source) tags.append(el('span', 'tp-src', item.source));
    if (done && checks[item.id].at) tags.append(el('span', 'tp-src', `✔ ${checks[item.id].at}`));
    body.append(tags);
    [['longform', '🎬 롱폼 초안'], ['insta', '📱 인스타 초안']].forEach(([k, label]) => {
      const lines = Array.isArray(item[k]) ? item[k] : []; if (!lines.length) return;
      const cc = k === 'insta' && item.corpusCheck;   // 1.8.1 통합 코퍼스 --검사 결과(맥북 주제선정_갱신.py)
      const d = el('details', 'rec-draft'); d.append(el('summary', null, `${label} ${lines.length}문장${cc ? (cc.pass ? ' · 표절검사 통과' : ` · ⚠️ 레퍼런스와 비슷한 줄 ${cc.over}`) : ''}`));
      const ol = el('ol', 'rec-lines'); lines.forEach((l) => ol.append(el('li', null, String(l)))); d.append(ol);
      const cp = el('button', 'text-btn', '복사'); cp.type = 'button';
      cp.addEventListener('click', async () => { try { await navigator.clipboard.writeText(draftText(lines)); SW.toast('복사했어요'); } catch { SW.toast('길게 눌러 복사해 주세요'); } });
      d.append(cp); body.append(d);
    });
    const row = el('div', 'tp-row');
    const memo = el('button', 'ghost-btn', '✍️ 글감으로 메모'); memo.type = 'button';
    memo.addEventListener('click', () => { SW.addNote(`🔥 추천 주제: ${item.title}${item.why ? ` (근거 ${item.why})` : ''}`, '블로그'); SW.toast('메모에 쌓았어요'); });
    const go = el('button', 'ghost-btn', '✎ 대본 탭에 넣기'); go.type = 'button';
    go.addEventListener('click', () => toScriptRec(item));
    row.append(memo, go); body.append(row);
    c.append(lab, body);
    return c;
  }
  function renderRec() {
    const box = $('#recList'); if (!box) return;
    const up = $('#rcUpdated');
    if (up) up.textContent = rec ? `추천 ${rec.topicsDate || (rec.updatedAt || '').slice(0, 10)}${rec.noteDate ? ` · 개선점 ${rec.noteDate} 검토 기준` : ''}${rec.model ? ` · ${rec.model.replace('claude-', '')}` : ''}` : '';
    box.replaceChildren();
    if (noKey()) { box.append(el('p', 'hint', '설정 ①에서 저장소 열쇠를 넣으면 추천 주제·뜨는 주제·개선점이 보여요.')); return; }
    if (loading && !rec && !react) { box.append(el('p', 'hint', '불러오는 중…')); return; }
    if (!rec) { box.append(el('p', 'hint', '아직 추천 자료가 없어요. 맥북이 켜져 있으면 아침 6시 이후 첫 동기화 때 올려요.')); return; }
    if (rec.error) box.append(el('p', 'hint small rc-err', `⚠️ ${rec.error}`));
    const tops = Array.isArray(rec.topics) ? rec.topics : [];
    const sec = el('section', 'rc-rec');
    sec.append(el('h3', 'rc-h', `🔥 오늘 추천 주제 ${tops.length} · 남들이 터뜨린 것에서`));
    if (!tops.length) sec.append(el('p', 'hint small', '오늘 추천이 아직 없어요.'));
    tops.forEach((item, i) => sec.append(recCard(item, i + 1)));
    box.append(sec);
  }

  // ── ③ 뜨는 주제 TOP 20 × 3 ─────────────────────────────
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
    renderAll();   // 배지(안 만든 추천·TOP5 수)도 같이 갱신
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
    if (noKey()) return;
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

  // ── ④ 개선점 (내 영상 반응에서) + 접힌 내 영상 숫자 ─────────
  function spark(hist) {
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
  function sortedVideos() {
    let list = (react && react.videos) ? react.videos.filter((v) => !v.stale) : [];
    if (rcKind !== 'all') list = list.filter((v) => (rcKind === 'short') === (v.kind === 'short'));
    const key = rcSort === 'd1' ? (v) => v.d1 || 0 : rcSort === 'like' ? (v) => (v.views >= 300 ? v.likeRate || 0 : -1) : rcSort === 'new' ? (v) => v.published || '' : (v) => v.views || 0;
    return [...list].sort((a, b) => (key(b) > key(a) ? 1 : key(b) < key(a) ? -1 : 0));
  }
  function renderImp() {
    const box = $('#impList'); if (!box) return;
    box.replaceChildren();
    if (noKey() || (loading && !rec && !react)) return;
    const imps = rec && Array.isArray(rec.improvements) ? rec.improvements : [];
    const impBox = el('section', 'rc-imp');
    impBox.append(el('h3', 'rc-h', `✅ 개선점 ${imps.length} · 내 영상 반응에서`));
    if (!imps.length) impBox.append(el('p', 'hint small', rec ? '아직 체크리스트가 없어요.' : '맥북이 내 영상 반응을 보고 개선점을 적어 올려요(아침 6시 이후).'));
    imps.forEach((it) => {
      const row = el('div', 'rc-imp-item' + (it.status === '지금 지킬 것' ? ' is-keep' : ''));
      const head = el('div', 'tp-tags');
      head.append(el('span', 'tp-tag kw', it.id || ''), el('span', 'tp-tag', it.target || ''));
      if (it.status && it.status !== '지금 지킬 것') head.append(el('span', 'tp-tag new', it.status));
      row.append(head, el('p', 'rc-imp-text', it.text || ''));
      if (it.basis) row.append(el('p', 'rc-imp-basis', `근거 · ${it.basis}`));
      impBox.append(row);
    });
    if (rec && Array.isArray(rec.notes) && rec.notes.length) {
      const d = el('details', 'rc-notes'); d.append(el('summary', null, `내일 기획에 바로 쓸 것 ${rec.notes.length} (개선노트 ${rec.noteDate || ''})`));
      rec.notes.forEach((x) => d.append(el('p', 'hint small', `· ${x}`)));
      impBox.append(d);
    }
    box.append(impBox);
    // 내 영상 숫자는 접어 둔다 (사용자 10/20: 순위 나열은 불필요)
    if (react && Array.isArray(react.videos)) {
      const d = el('details', 'rc-videos'); d.append(el('summary', null, `내 영상 숫자 ${react.videos.filter((v) => !v.stale).length}개 (접힘)`));
      const fb = el('div', 'chips'); fb.id = 'rcFilter';
      [['all', '전체'], ['short', '쇼츠'], ['long', '롱폼']].forEach(([k, label]) => {
        const b = el('button', 'chip' + (rcKind === k ? ' is-on' : ''), label); b.type = 'button'; b.addEventListener('click', () => { rcKind = k; LS.set('mb.rcKind', k); renderImp(); $('#impList .rc-videos').open = true; }); fb.append(b);
      });
      const sb = el('div', 'chips rc-sort'); sb.id = 'rcSort';
      [['views', '조회수'], ['d1', '어제 대비'], ['like', '좋아요율'], ['new', '최신']].forEach(([k, label]) => {
        const b = el('button', 'chip' + (rcSort === k ? ' is-on' : ''), label); b.type = 'button'; b.addEventListener('click', () => { rcSort = k; LS.set('mb.rcSort', k); renderImp(); $('#impList .rc-videos').open = true; }); sb.append(b);
      });
      d.append(fb, sb);
      const ig = react.instagram;
      if (ig && Array.isArray(ig.manual) && ig.manual.length) {
        const g = el('details', 'rc-ig'); g.append(el('summary', null, `인스타 릴스 기록 ${ig.manual.length}개 (수기)`));
        ig.manual.forEach((m) => g.append(el('p', 'hint small', `${m.title} — ${n(m.views)}${m.note ? ` · ${m.note}` : ''}`)));
        g.append(el('p', 'hint small', ig.note || '')); d.append(g);
      }
      const list = sortedVideos();
      if (!list.length) d.append(el('p', 'hint', '여기엔 아직 없어요.'));
      list.slice(0, 20).forEach((v, k) => d.append(rcRow(v, k + 1)));
      box.append(d);
    }
  }

  function renderAll() {
    renderChannel(); renderRec(); renderTopics(); renderImp();
    // 배지 = 아직 안 만든 추천 주제 + 안 만든 TOP5 (세부 탭 '급상승'과 큰 탭 '레퍼런스'에 같이)
    const recUndone = rec && Array.isArray(rec.topics) ? rec.topics.filter((x) => !checks[x.id]).length : 0;
    const topUndone = topics && topics.lists ? LISTS.reduce((a, [k]) => a + (Array.isArray(topics.lists[k]) ? topics.lists[k].filter((x) => !checks[x.id] && x.rank <= 5).length : 0), 0) : 0;
    const undone = recUndone + topUndone;
    const badge = $('#trendCount'); if (badge) badge.textContent = undone ? String(undone) : '';
    const nb = $('#refNavCount'); if (nb) nb.textContent = undone ? String(undone) : '';
  }

  document.addEventListener('sowon:tab', (e) => { if (e.detail === 'trend') load(); });
  const rb = $('#tpRefresh'); if (rb) rb.addEventListener('click', () => load(true));
  window.addEventListener('online', () => load(true));
  renderAll();
  load(true);
})();
