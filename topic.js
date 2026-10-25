/* 소원저장소 — 주제 (레퍼런스 > 급상승 탭 안)  1.7.0 (2026-10-18) → 1.8.0 (10/20) → 1.9.0 (10/21)
 * 사용자: "대본 탭 옆에 컨텐츠 주제선정 탭 — 유튜브/클립 내 데이터 반응을 한번에 보는 페이지부터,
 *          롱폼 TOP10~20 / 인스타 숏폼 10~20 / 블로그 10~20을 보기 좋게 나열, 내가 만들었으면 체크".
 * 10/20: "내 유튜브 성과 1-20순위 나열은 불필요. 내 영상 성과는 네가 확인해서 개선점을 리스트업, 추천 주제 3~5개, 대략적인 롱폼/인스타 대본."
 * 10/21: "밑에 메뉴가 너무 많아졌으니 급상승 안에 주제 탭을 통째로 옮겨. 주제 맨 위에는 유튜브 구독자랑 현재 총조회수 합산 둘 다, 내 반응 탭을 따로 나누지 마."
 *   → 한 화면: 내 채널 숫자(채널별 구독자·총 조회수 + 합산) → 추천 주제 3~5(롱폼·인스타 초안) → 뜨는 주제 TOP 20 → 개선점 → 접힌 내 영상 숫자. (인스타 급상승 수집은 trend.js, 같은 화면 맨 아래)
 * 10/26 1.11.0: "유튜브 추천주제 오늘의주제 10개 리스트. 촬영결정/패스 버튼 누르고 촬영결정 시안은 촬영대기 탭으로" → 추천 10개, 카드마다 🎬 촬영결정/패스(촬영.json), 세 번째 작은 탭 '촬영대기'(#tab-wait).
 * 자료는 맥북 도구/주제선정_갱신.py 가 <아이디어뇌>/주제선정/ 에 올린다:
 *   채널.json(채널별 구독자·총 조회수, 6시간마다 API 로 바로) · 반응.json(내 유튜브 공개 성과 추이; summary.channels 는 예비) · 주제.json(TOP 20 × 3) · 블로그트렌드.json(크롬 확장 어드바이저 수집) · 체크.json(여기서 쓴다)
 *   추천.json(개선점 리스트 + 오늘의 주제 10개 + 롱폼/인스타 대본 초안, 하루 1번 맥북 Claude) · 촬영.json(여기서 쓴다: 촬영결정·패스·촬영완료 + 주제 복사본) */
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

  let react = null, topics = null, trend = null, rec = null, chan = null, checks = {}, checksSha = null, shoot = {}, shootSha = null, loading = false, loadedAt = 0;
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
  // 1.11.0 촬영.json — 오늘의 주제에서 고른 것(촬영결정·패스·촬영완료). 체크.json 과 같은 방식(PUT, sha 충돌 3번 재시도)
  async function writeShoot(mutate, message) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const f = await readJSON(`${DIR()}/촬영.json`);
      const entries = (f.data && typeof f.data.entries === 'object' && f.data.entries) || {};
      mutate(entries);
      const body = { version: 1, note: '소원저장소 급상승 오늘의 주제에서 🎬 촬영결정/패스/촬영완료. id는 추천.json 의 id, 값은 그날 주제의 복사본 + status·at. 맥북 주제선정_갱신.py 가 제목을 읽어 같은 주제를 다시 추천하지 않는다', entries };
      try {
        const res = await SW.gh(`${SW.repoPath()}/contents/${enc(`${DIR()}/촬영.json`)}`, { method: 'PUT', body: { message, branch: SW.cfg().branch, content: SW.b64encode(JSON.stringify(body, null, 2) + '\n'), ...(f.sha ? { sha: f.sha } : {}) } });
        shoot = entries; shootSha = res.content.sha; return;
      } catch (e) { if ((e.status === 409 || e.status === 422) && attempt < 2) continue; throw e; }
    }
  }
  async function load(force) {
    if (loading || !SW.cfg().token || !navigator.onLine) { renderAll(); return; }
    if (!force && Date.now() - loadedAt < 60000) { renderAll(); return; }
    loading = true; renderAll();
    try {
      const [r, t, b, c, q, h, s] = await Promise.all([readJSON(`${DIR()}/반응.json`), readJSON(`${DIR()}/주제.json`), readJSON(`${DIR()}/블로그트렌드.json`), readJSON(`${DIR()}/체크.json`), readJSON(`${DIR()}/추천.json`), readJSON(`${DIR()}/채널.json`), readJSON(`${DIR()}/촬영.json`)]);
      react = r.data && r.data.videos ? r.data : null;
      chan = h.data && Array.isArray(h.data.channels) ? h.data : null;
      rec = q.data && (Array.isArray(q.data.topics) || Array.isArray(q.data.improvements)) ? q.data : null;
      topics = t.data && t.data.lists ? t.data : null;
      trend = b.data && b.data.rows ? b.data : null;
      checks = (c.data && c.data.entries) || {}; checksSha = c.sha;
      shoot = (s.data && s.data.entries) || {}; shootSha = s.sha;
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
  // 1.9.2 (사용자 10/21 "총조회수가 아니라 최근 30일 조회수 — 스튜디오 인사이트 첫 페이지"): views30. 30일치가 아직 없으면 'N일' 로 정직하게
  const vLabel = (c) => c.views30 == null ? '최근 30일 조회수' : `최근 ${c.viewsDays && c.viewsDays < 30 ? c.viewsDays : 30}일 조회수`;
  function chCard(name, subs, c, cls, note) {
    const box = el('div', 'ch-card' + (cls ? ' ' + cls : ''));
    box.append(el('small', 'ch-name', name));
    const row = el('div', 'ch-nums');
    row.append(stat('구독자', subs == null ? '-' : n(subs)), stat(vLabel(c), c.views30 == null ? '-' : n(c.views30)));
    const c0 = box;
    c0.append(row);
    if (note) c0.append(el('small', 'ch-note', note));
    return c0;
  }
  function renderChannel() {
    const box = $('#chStrip'); if (!box) return;
    box.replaceChildren();
    if (noKey()) return;
    const s = (react && react.summary) || null;
    const src = chan && chan.channels ? chan.channels : (s && Array.isArray(s.channels) ? s.channels : []);
    const chs = src.filter((c) => c && (c.subscribers != null || c.totalViews != null));
    if (!chs.length && !s) { box.append(el('p', 'hint small', loading ? '내 채널 숫자 불러오는 중…' : '내 채널 숫자는 맥북이 켜져 있으면 20분 안에 올라와요.')); return; }
    chs.forEach((c) => box.append(chCard(`📺 ${c.name || c.handle || c.id}`, c.subscribers, c, '',
      [c.viewsSrc, c.viewsRange].filter(Boolean).join(' · ') || (c.at ? `${String(c.at).slice(5, 16).replace('T', ' ')} 기준` : ''))));
    if (chs.length >= 2) {
      const sum = (k) => chs.reduce((a, c) => a + (Number(c[k]) || 0), 0);
      const have = chs.filter((c) => c.views30 != null);
      const days = Math.min(...have.map((c) => c.viewsDays || 30));
      box.append(chCard('Σ 유튜브 합산', sum('subscribers'), { views30: have.length ? sum('views30') : null, viewsDays: have.length ? days : null }, 'sum',
        `채널 ${chs.length}개${have.length < chs.length ? ` · 조회수는 ${have.length}개 채널만` : ''}`));
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

  // ── ② 오늘의 주제 10 (남들이 터뜨린 것에서) + 롱폼/인스타 초안 → 🎬 촬영결정 / 패스 ─────────
  // 1.11.0 (사용자 10/26 "유튜브 추천주제 오늘의주제 10개 리스트, 촬영결정/패스 버튼 누르고 촬영결정 시안은 촬영대기 탭으로"):
  //   추천.json 은 하루 10개(맥북 주제선정_갱신.py REC_COUNT). 카드의 '🎬 촬영결정'/'패스'는 촬영.json(entries[id] = 그날 주제 복사본 + status·at)에 남고,
  //   촬영결정은 #tab-wait(촬영대기)로 옮겨 가 거기서 '대본 탭에 넣기'·'촬영완료'·'되돌리기'. 패스는 목록 아래 접힘에서 되돌리기.
  //   추천이 다음 날 10개로 바뀌어도 촬영대기는 복사본이라 그대로 남는다. 맥북은 촬영.json 제목을 읽어 같은 주제를 다시 추천하지 않는다.
  function draftText(lines) { return (lines || []).map((l) => String(l)).join('\n'); }
  function toScriptRec(item) {
    const t = $('#mTopic'); if (t) { t.value = item.title; t.dispatchEvent(new Event('input', { bubbles: true })); }
    const r = $('#mRough'); if (r && Array.isArray(item.insta) && item.insta.length) { r.value = draftText(item.insta); r.dispatchEvent(new Event('input', { bubbles: true })); }
    const c = $('#mCta'); if (c && item.keyword) { c.value = item.keyword; c.dispatchEvent(new Event('input', { bubbles: true })); }
    SW.switchTab('make'); SW.toast('대본 탭에 주제와 인스타 초안을 넣었어요');
  }
  const today = () => SW.isoLocal(new Date()).slice(0, 10);
  const snapshot = (item) => ({ title: item.title, why: item.why || '', source: item.source || '', tags: item.tags || [], keyword: item.keyword || '',
    longform: item.longform || [], insta: item.insta || [], corpusCheck: item.corpusCheck || null, topicsDate: (rec && rec.topicsDate) || item.topicsDate || null });
  async function setShoot(id, make, message, toastMsg) {
    try {
      await writeShoot((e) => { const v = make(e[id]); if (v) e[id] = v; else delete e[id]; }, message);
      if (toastMsg) SW.toast(toastMsg);
    } catch (e) { SW.toast(`저장 실패: ${e.message || e}`); }
    renderAll();   // 목록·촬영대기·배지 같이 갱신
  }
  const decide = (item, status) => setShoot(item.id, () => ({ ...snapshot(item), status, at: today() }), `주제 ${status}: ${item.title.slice(0, 40)}`, status === '촬영결정' ? '촬영대기에 넣었어요 🎬' : '패스했어요');
  const unshoot = (id, title) => setShoot(id, () => null, `주제 되돌리기: ${String(title || '').slice(0, 40)}`, '오늘의 주제로 되돌렸어요');
  const finishShoot = (e) => setShoot(e.id, (cur) => ({ ...(cur || e), status: '촬영완료', doneAt: today() }), `주제 촬영완료: ${String(e.title || '').slice(0, 40)}`, '촬영완료 ✔');
  const reopenShoot = (e) => setShoot(e.id, (cur) => { const v = { ...(cur || e), status: '촬영결정' }; delete v.doneAt; delete v.id; return v; }, `주제 다시 대기: ${String(e.title || '').slice(0, 40)}`, '촬영대기로 돌렸어요');

  function tagsRow(item, extra) {
    const tags = el('div', 'tp-tags');
    (item.tags || []).forEach((t) => tags.append(el('span', 'tp-tag', t)));
    if (item.keyword) tags.append(el('span', 'tp-tag kw', `댓글 '${item.keyword}'`));
    if (item.source) tags.append(el('span', 'tp-src', item.source));
    (extra || []).forEach((n) => tags.append(n));
    return tags;
  }
  function draftsInto(body, item) {
    [['longform', '🎬 롱폼 초안'], ['insta', '📱 인스타 초안']].forEach(([k, label]) => {
      const lines = Array.isArray(item[k]) ? item[k] : []; if (!lines.length) return;
      const cc = k === 'insta' && item.corpusCheck;   // 1.8.1 통합 코퍼스 --검사 결과(맥북 주제선정_갱신.py)
      const d = el('details', 'rec-draft'); d.append(el('summary', null, `${label} ${lines.length}문장${cc ? (cc.pass ? ' · 표절검사 통과' : ` · ⚠️ 레퍼런스와 비슷한 줄 ${cc.over}`) : ''}`));
      const ol = el('ol', 'rec-lines'); lines.forEach((l) => ol.append(el('li', null, String(l)))); d.append(ol);
      const cp = el('button', 'text-btn', '복사'); cp.type = 'button';
      cp.addEventListener('click', async () => { try { await navigator.clipboard.writeText(draftText(lines)); SW.toast('복사했어요'); } catch { SW.toast('길게 눌러 복사해 주세요'); } });
      d.append(cp); body.append(d);
    });
  }
  function actBtn(label, cls, act, fn) { const b = el('button', 'ghost-btn ' + cls, label); b.type = 'button'; b.dataset.act = act; b.addEventListener('click', fn); return b; }
  function recCard(item, rank) {
    const c = el('article', 'rec-card');
    const lab = el('div', 'tp-check'); lab.append(el('b', 'tp-rank', `${rank}`));
    const body = el('div', 'tp-body');
    body.append(el('p', 'tp-title', item.title));
    if (item.why) body.append(el('p', 'tp-why', `근거 · ${item.why}`));
    body.append(tagsRow(item));
    draftsInto(body, item);
    const row = el('div', 'tp-row');
    const memo = el('button', 'ghost-btn', '✍️ 글감으로 메모'); memo.type = 'button';
    memo.addEventListener('click', () => { SW.addNote(`🔥 추천 주제: ${item.title}${item.why ? ` (근거 ${item.why})` : ''}`, '블로그'); SW.toast('메모에 쌓았어요'); });
    const go = el('button', 'ghost-btn', '✎ 대본 탭에 넣기'); go.type = 'button';
    go.addEventListener('click', () => toScriptRec(item));
    row.append(memo, go); body.append(row);
    const act = el('div', 'rec-act');
    act.append(actBtn('🎬 촬영결정', 'go', 'shoot', () => decide(item, '촬영결정')), actBtn('패스', 'pass', 'pass', () => decide(item, '패스')));
    body.append(act);
    c.append(lab, body);
    return c;
  }
  function renderRec() {
    const box = $('#recList'); if (!box) return;
    const up = $('#rcUpdated');
    if (up) up.textContent = rec ? `추천 ${rec.topicsDate || (rec.updatedAt || '').slice(0, 10)}${rec.noteDate ? ` · 개선점 ${rec.noteDate} 검토 기준` : ''}${rec.model ? ` · ${rec.model.replace('claude-', '')}` : ''}` : '';
    box.replaceChildren();
    if (noKey()) { box.append(el('p', 'hint', '설정 ①에서 저장소 열쇠를 넣으면 오늘의 주제·뜨는 주제·개선점이 보여요.')); return; }
    if (loading && !rec && !react) { box.append(el('p', 'hint', '불러오는 중…')); return; }
    if (!rec) { box.append(el('p', 'hint', '아직 추천 자료가 없어요. 맥북이 켜져 있으면 아침 6시 이후 첫 동기화 때 10개 올려요.')); return; }
    if (rec.error) box.append(el('p', 'hint small rc-err', `⚠️ ${rec.error}`));
    const tops = Array.isArray(rec.topics) ? rec.topics : [];
    const open = tops.filter((t) => !shoot[t.id] && !checks[t.id]);
    const decided = tops.filter((t) => shoot[t.id] && shoot[t.id].status !== '패스');
    const passed = tops.filter((t) => shoot[t.id] && shoot[t.id].status === '패스');
    const sec = el('section', 'rc-rec');
    sec.append(el('h3', 'rc-h', `🔥 오늘의 주제 ${tops.length} · 남들이 터뜨린 것에서`));
    if (tops.length) {
      const sub = el('div', 'rc-sub');
      sub.append(el('p', 'hint small', `남은 ${open.length} · 촬영결정 ${decided.length} · 패스 ${passed.length}`));
      const w = el('button', 'text-btn', '🎬 촬영대기 보기'); w.type = 'button'; w.addEventListener('click', () => SW.switchTab('wait')); sub.append(w);
      sec.append(sub);
    }
    if (!tops.length) sec.append(el('p', 'hint small', '오늘 주제가 아직 없어요. 맥북이 아침 6시 이후 10개 올려요.'));
    else if (!open.length) sec.append(el('p', 'hint small', '오늘 주제는 다 골랐어요. 내일 아침 6시 이후 새로 10개가 와요.'));
    open.forEach((item) => sec.append(recCard(item, tops.indexOf(item) + 1)));
    if (passed.length) {
      const d = el('details', 'rc-passed'); d.append(el('summary', null, `패스한 주제 ${passed.length}`));
      passed.forEach((item) => {
        const r = el('div', 'rc-pass-item'); r.append(el('span', null, item.title));
        const u = el('button', 'text-btn', '↩ 되돌리기'); u.type = 'button'; u.dataset.act = 'unpass'; u.addEventListener('click', () => unshoot(item.id, item.title)); r.append(u); d.append(r);
      });
      sec.append(d);
    }
    box.append(sec);
  }

  // ── ②-b 촬영대기 탭 (#tab-wait): 촬영.json 의 촬영결정 → 카드, 촬영완료는 접힘 ─────────
  function waitCard(e) {
    const done = e.status === '촬영완료';
    const c = el('article', 'wt-card' + (done ? ' is-done' : ''));
    const lab = el('div', 'tp-check'); lab.append(el('b', 'tp-rank', done ? '✔' : '🎬'));
    const body = el('div', 'tp-body');
    body.append(el('p', 'tp-title', e.title));
    if (e.why) body.append(el('p', 'tp-why', `근거 · ${e.why}`));
    const extra = [el('span', 'wt-status', done ? `촬영완료 ${e.doneAt || ''}` : `촬영결정 ${e.at || ''}`)];
    if (e.topicsDate) extra.push(el('span', 'tp-src', `추천 ${e.topicsDate}`));
    body.append(tagsRow(e, extra));
    draftsInto(body, e);
    const row = el('div', 'tp-row');
    const go = el('button', 'ghost-btn', '✎ 대본 탭에 넣기'); go.type = 'button'; go.addEventListener('click', () => toScriptRec(e)); row.append(go);
    body.append(row);
    const act = el('div', 'rec-act');
    if (done) act.append(actBtn('↩ 다시 대기로', 'pass', 'undone', () => reopenShoot(e)));
    else act.append(actBtn('✅ 촬영완료', 'go', 'done', () => finishShoot(e)), actBtn('↩ 되돌리기', 'pass', 'unshoot', () => unshoot(e.id, e.title)));
    body.append(act);
    c.append(lab, body);
    return c;
  }
  function renderWait() {
    const box = $('#waitList'); if (!box) return;
    const up = $('#wtUpdated'), dl = $('#waitDoneList'), dc = $('#waitDoneCount');
    box.replaceChildren(); if (dl) dl.replaceChildren();
    if (noKey()) { box.append(el('p', 'hint', '설정 ①에서 저장소 열쇠를 넣으면 촬영대기가 보여요.')); if (up) up.textContent = ''; return; }
    const all = Object.entries(shoot).map(([id, e]) => ({ ...e, id })).filter((e) => e && e.title);
    const waiting = all.filter((e) => e.status === '촬영결정').sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
    const done = all.filter((e) => e.status === '촬영완료').sort((a, b) => String(b.doneAt || '').localeCompare(String(a.doneAt || '')));
    if (up) up.textContent = `촬영대기 ${waiting.length} · 촬영완료 ${done.length}`;
    if (!waiting.length) box.append(el('p', 'hint', loading && !all.length ? '불러오는 중…' : '아직 없어요. 급상승 탭 오늘의 주제에서 🎬 촬영결정을 누르면 여기 모여요.'));
    waiting.forEach((e) => box.append(waitCard(e)));
    if (dl) done.forEach((e) => dl.append(waitCard(e)));
    if (dc) dc.textContent = done.length ? String(done.length) : '';
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
    renderChannel(); renderRec(); renderTopics(); renderImp(); renderWait();
    // 배지 = 아직 안 고른(촬영결정·패스·만들었음 아닌) 오늘의 주제 + 안 만든 TOP5 (세부 탭 '급상승'), 촬영대기 수(세부 탭 '촬영대기'), 큰 탭 '레퍼런스' = 둘의 합
    const recUndone = rec && Array.isArray(rec.topics) ? rec.topics.filter((x) => !checks[x.id] && !shoot[x.id]).length : 0;
    const topUndone = topics && topics.lists ? LISTS.reduce((a, [k]) => a + (Array.isArray(topics.lists[k]) ? topics.lists[k].filter((x) => !checks[x.id] && x.rank <= 5).length : 0), 0) : 0;
    const undone = recUndone + topUndone;
    const waiting = Object.values(shoot).filter((e) => e && e.status === '촬영결정').length;
    const badge = $('#trendCount'); if (badge) badge.textContent = undone ? String(undone) : '';
    const wb = $('#waitCount'); if (wb) wb.textContent = waiting ? String(waiting) : '';
    const nb = $('#refNavCount'); if (nb) nb.textContent = (undone + waiting) ? String(undone + waiting) : '';
  }

  document.addEventListener('sowon:tab', (e) => { if (e.detail === 'trend' || e.detail === 'wait') load(); });
  const rb = $('#tpRefresh'); if (rb) rb.addEventListener('click', () => load(true));
  const wr = $('#wtRefresh'); if (wr) wr.addEventListener('click', () => load(true));
  window.addEventListener('online', () => load(true));
  renderAll();
  load(true);
})();
