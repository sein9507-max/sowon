/* 소원저장소 — 💬 채팅 탭 (1.13.0, 2026-11-03)
 * 사용자: "맥북을 쓸 수 없을 때나 누워 있을 때도 휴대폰으로 명령어를 넣어서 너를 제어하고 싶어. 모바일 클로드는 경로가 복잡해.
 *          소원저장소에 탭 하나 추가해서 채팅창. 이 채팅창과 정확히 연동. 채팅창 여러 개. 루틴화 시킨 작업도 그 페이지에서 확인."
 * 메시지는 <아이디어뇌>/채팅/c_<id>.json 의 messages 에 쌓인다. 맥북 데몬(도구/소원_맥북채팅.py, 블로그_동기화.sh 가 살려 둠)이
 * 5초마다 보고 claude -p --resume <그 채팅의 세션> 으로 답을 붙인다. 'c_main' 은 맥북 터미널 세션에 그대로 이어진다.
 * 루틴 상태는 맥북이 같은 폴더 _루틴.json 에 적고(launchd·오늘 영상·로그 끝 줄·세션 예약), 세부 탭 '루틴'이 보여 준다. */
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
  const DIR = () => SW.cfg().dir.split('/').filter(Boolean)[0] + '/채팅';   // 아이디어뇌/채팅
  const enc = (p) => p.split('/').map(encodeURIComponent).join('/');
  const fileUrl = (p) => `${SW.repoPath()}/contents/${enc(p)}`;
  const q = () => `?ref=${encodeURIComponent(SW.cfg().branch)}&t=${Date.now()}`;
  const MAIN = { id: 'c_main', title: '맥북 터미널 (지금 이 대화)' };
  const ROUTINE_FILE = '_루틴.json';
  const POLL_FAST = () => LS.get('mb.chatPoll', 5000);          // 답 기다리는 중
  const POLL_SLOW = () => LS.get('mb.chatPollSlow', 20000);     // 채팅 탭 보고 있을 때
  const POLL_BG = 60000;                                         // 다른 탭(배지용)
  const pathOf = (id) => `${DIR()}/${id}.json`;

  let files = {};                                   // 파일 이름 → sha (폴더 목록)
  let chats = {};                                   // id → 채팅 파일 내용
  let cur = LS.get('mb.chatCur', MAIN.id);
  let seen = LS.get('mb.chatSeen', {});             // id → 마지막으로 본 답 시각
  let routine = null;
  let timer = null, loading = false, tabOn = '', sending = false;

  // ── 저장소 ──────────────────────────────────────────────
  async function readFile(p) {
    const meta = await SW.gh(fileUrl(p) + q());
    let raw = meta.content; if (!raw && meta.size > 0) raw = (await SW.gh(`${SW.repoPath()}/git/blobs/${meta.sha}`)).content;
    let data = {}; try { data = JSON.parse(SW.b64decode(raw || '') || '{}'); } catch { data = {}; }
    return { sha: meta.sha, data };
  }
  async function writeFile(p, data, sha, message) {
    const r = await SW.gh(fileUrl(p), { method: 'PUT', body: { message, branch: SW.cfg().branch, content: SW.b64encode(JSON.stringify(data, null, 2) + '\n'), ...(sha ? { sha } : {}) } });
    return r && r.content ? r.content.sha : null;
  }
  async function listDir() {
    try { const ls = await SW.gh(fileUrl(DIR()) + q()); return Array.isArray(ls) ? ls : []; }
    catch (e) { if (e.status === 404) return []; throw e; }
  }
  async function modify(id, fn, message) {   // 다시 읽고 → 바꾸고 → 쓰기. 맥북과 겹치면(409/422) 4번까지
    const p = pathOf(id); let lastErr = null;
    for (let i = 0; i < 4; i++) {
      let sha = null, data = null;
      try { const r = await readFile(p); sha = r.sha; data = r.data; }
      catch (e) { if (e.status !== 404) throw e; }
      const out = fn(data);
      if (!out) return data;
      try { const ns = await writeFile(p, out, sha, message); files[`${id}.json`] = ns; chats[id] = out; return out; }
      catch (e) { lastErr = e; if (!(e.status === 409 || e.status === 422)) throw e; await new Promise((ok) => setTimeout(ok, 800 * (i + 1))); }
    }
    throw lastErr || new Error('저장이 계속 겹쳐요');
  }
  async function load(force) {
    if (loading || !SW.cfg().token || !navigator.onLine) { render(); return; }
    loading = true;
    try {
      const ls = await listDir(); const names = {};
      for (const f of ls) {
        if (f.type && f.type !== 'file') continue;
        if (!(/^c_.+\.json$/.test(f.name) || f.name === ROUTINE_FILE)) continue;
        names[f.name] = f.sha;
        if (files[f.name] !== f.sha || force) {
          const { data } = await readFile(f.path || `${DIR()}/${f.name}`);
          files[f.name] = f.sha;
          if (f.name === ROUTINE_FILE) routine = data; else chats[data.id || f.name.slice(0, -5)] = data;
        }
      }
      Object.keys(files).forEach((n) => { if (!names[n]) { delete files[n]; if (n !== ROUTINE_FILE) delete chats[n.slice(0, -5)]; } });
      if (!chats[MAIN.id]) chats[MAIN.id] = { version: 1, id: MAIN.id, title: MAIN.title, main: true, messages: [], _local: true };   // 맥북이 아직 안 만들었으면 자리만
    } catch (e) { if (e.status !== 401) SW.toast(`채팅 불러오기 실패: ${e.message || e}`); }
    finally { loading = false; render(); }
  }

  // ── 보내기·그만·새 채팅 ──────────────────────────────────
  const newMsgId = () => 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  async function send() {
    const ta = $('#chatInput'); const text = ta.value.trim(); if (!text || sending) return;
    if (!SW.cfg().token) { SW.toast('설정 ①에 저장소 열쇠가 있어야 맥북에 보낼 수 있어요'); SW.openSettings(); return; }
    if (!navigator.onLine) { SW.toast('인터넷이 연결돼야 보낼 수 있어요'); return; }
    const m = { id: newMsgId(), role: 'user', text, at: SW.isoLocal(new Date()), status: '대기' };
    const id = cur;
    sending = true; $('#chatSend').disabled = true;
    const c = chats[id] || { version: 1, id, title: '새 채팅', messages: [] };
    c.messages = (c.messages || []).concat([m]); chats[id] = c; ta.value = ''; render();   // 먼저 그려 두고
    try {
      await modify(id, (d) => {
        const base = d && d.id ? d : { version: 1, id, title: id === MAIN.id ? MAIN.title : '새 채팅', main: id === MAIN.id, createdAt: m.at, messages: [],
          note: '소원저장소 앱 채팅. 맥북 도구/소원_맥북채팅.py 가 claude 로 답을 붙인다' };
        base.messages = (base.messages || []).concat([m]);
        if (!base.title || base.title === '새 채팅') base.title = text.replace(/\s+/g, ' ').slice(0, 24);
        base.updatedAt = m.at;
        return base;
      }, `소원저장소 채팅: ${id} 메시지`);
    } catch (e) {
      c.messages = c.messages.filter((x) => x.id !== m.id); ta.value = text;
      SW.toast(`보내지 못했어요: ${e.message || e}`);
    } finally { sending = false; $('#chatSend').disabled = false; render(); schedule(true); }
  }
  async function stop() {
    const c = chats[cur]; if (!c) return;
    const pend = (c.messages || []).filter((m) => m.role === 'user' && ['대기', '처리중', '한도대기'].includes(m.status));
    if (!pend.length) return;
    try {
      await modify(cur, (d) => { if (!d) return null; let hit = false; (d.messages || []).forEach((m) => { if (pend.some((p) => p.id === m.id) && ['대기', '처리중', '한도대기'].includes(m.status)) { m.status = '취소'; hit = true; } }); return hit ? d : null; }, `소원저장소 채팅: ${cur} 취소`);
      SW.toast('그만두라고 보냈어요');
    } catch (e) { SW.toast(`취소 실패: ${e.message || e}`); }
    render();
  }
  function newChat() {
    const id = 'c_' + SW.makeId(new Date());
    chats[id] = { version: 1, id, title: '새 채팅', messages: [], _local: true };   // 첫 메시지를 보낼 때 파일이 생긴다
    cur = id; LS.set('mb.chatCur', cur); render(); $('#chatInput').focus();
  }
  async function renameChat() {
    const c = chats[cur]; if (!c || c.main) return;
    const t = prompt('채팅 이름', c.title || ''); if (t == null || !t.trim()) return;
    c.title = t.trim(); render();
    if (c._local) return;
    try { await modify(cur, (d) => { if (!d) return null; d.title = t.trim(); return d; }, `소원저장소 채팅: ${cur} 이름`); } catch (e) { SW.toast(`이름 저장 실패: ${e.message || e}`); }
  }
  async function deleteChat() {
    const c = chats[cur]; if (!c || c.main) return;
    if (!confirm(`'${c.title || cur}' 채팅을 지울까요? (맥북의 대화 기억은 남아요)`)) return;
    const id = cur; const sha = files[`${id}.json`];
    try {
      if (sha) await SW.gh(fileUrl(pathOf(id)), { method: 'DELETE', body: { message: `소원저장소 채팅: ${id} 지움`, branch: SW.cfg().branch, sha } });
      delete chats[id]; delete files[`${id}.json`]; delete seen[id]; LS.set('mb.chatSeen', seen);
      cur = MAIN.id; LS.set('mb.chatCur', cur); render(); SW.toast('지웠어요');
    } catch (e) { SW.toast(`지우기 실패: ${e.message || e}`); }
  }

  // ── 그리기 ──────────────────────────────────────────────
  const fmtSec = (s) => (s < 60 ? `${s}초` : `${Math.floor(s / 60)}분 ${String(s % 60).padStart(2, '0')}초`);
  const tsOf = (iso) => { const t = new Date(iso); return Number.isNaN(t.getTime()) ? Date.now() : t.getTime(); };
  const hhmm = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : `${String(d.getMonth() + 1)}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  function statusOf(m) {
    const sec = Math.max(0, Math.round((Date.now() - tsOf(m.at)) / 1000));
    const run = m.startedAt ? Math.max(0, Math.round((Date.now() - tsOf(m.startedAt)) / 1000)) : sec;
    if (m.status === '대기') return [sec > 150 ? `맥북이 아직 안 받았어요 ${fmtSec(sec)} · 맥북이 켜져 있나요?` : `맥북이 받기를 기다리는 중 ${fmtSec(sec)}`, 'wait'];
    if (m.status === '처리중') return [`맥북 Claude가 일하는 중 ${fmtSec(run)}`, 'run'];
    if (m.status === '한도대기') return [`Claude 사용량 한도 · ${m.retryAt ? m.retryAt + '에' : '잠시 뒤'} 맥북이 다시 해요`, 'wait'];
    if (m.status === '실패') return [`실패: ${m.error || '맥북에서 실패했어요'}`, 'fail'];
    if (m.status === '취소') return ['그만둠', 'off'];
    return ['', ''];
  }
  function linkify(text, box) {
    const parts = String(text || '').split(/(https?:\/\/[^\s<>"']+)/g);
    parts.forEach((p, i) => {
      if (i % 2) { const a = el('a', '', p); a.href = p; a.target = '_blank'; a.rel = 'noopener noreferrer'; box.append(a); }
      else if (p) box.append(document.createTextNode(p));
    });
  }
  const lastReplyAt = (c) => { const ms = (c && c.messages) || []; for (let i = ms.length - 1; i >= 0; i--) if (ms[i].role === 'assistant') return ms[i].at || ''; return ''; };
  const hasPending = (c) => ((c && c.messages) || []).some((m) => m.role === 'user' && ['대기', '처리중', '한도대기'].includes(m.status));
  function sortedChats() {
    return Object.values(chats).sort((a, b) => (b.main ? 1 : 0) - (a.main ? 1 : 0) || String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
  }
  function badge() {
    let n = 0;
    Object.values(chats).forEach((c) => { const at = lastReplyAt(c); if (at && at > (seen[c.id] || '')) n++; });
    const b = $('#chatNavCount'); if (b) b.textContent = n ? String(n) : '';
    return n;
  }
  function render() {
    if (tabOn === 'chat' && chats[cur]) { const at = lastReplyAt(chats[cur]); if (at && at !== seen[cur]) { seen[cur] = at; LS.set('mb.chatSeen', seen); } }
    badge();
    if (!$('#tab-chat')) return;
    if (!chats[cur]) cur = MAIN.id;
    const c = chats[cur] || { id: MAIN.id, title: MAIN.title, main: true, messages: [] };
    const pick = $('#chatPick'); pick.replaceChildren();
    sortedChats().forEach((x) => {
      const on = x.id === cur; const unread = lastReplyAt(x) > (seen[x.id] || '');
      const b = el('button', 'chip' + (on ? ' is-on' : ''), (x.main ? '🖥 ' : '') + (x.title || '새 채팅').slice(0, 16) + (unread && !on ? ' ●' : '')); b.type = 'button';
      b.setAttribute('aria-pressed', String(on)); b.dataset.id = x.id;
      b.addEventListener('click', () => { cur = x.id; LS.set('mb.chatCur', cur); render(); });
      pick.append(b);
    });
    const nb = el('button', 'chip', '+ 새 채팅'); nb.type = 'button'; nb.id = 'chatNew'; nb.addEventListener('click', newChat); pick.append(nb);
    $('#chatTitle').textContent = c.title || '새 채팅';
    $('#chatRename').hidden = !!c.main; $('#chatDel').hidden = !!c.main;
    const hint = $('#chatHint');
    hint.textContent = !SW.cfg().token ? '설정 ①에서 저장소 열쇠를 넣으면 맥북 Claude와 대화할 수 있어요.'
      : c.main ? '맥북 터미널에서 돌던 그 대화에 그대로 이어져요. 맥북이 꺼져 있으면 켜질 때 답해요.'
        : c.sessionId ? '이 채팅만의 대화예요(맥북 Claude 세션 ' + String(c.sessionId).slice(0, 8) + ').' : '첫 메시지를 보내면 맥북에 새 대화가 생겨요.';
    $('#chatStop').hidden = !hasPending(c);
    const box = $('#chatMsgs'); box.replaceChildren();
    const ms = [...((c.messages) || [])].reverse().slice(0, 80);   // 최신이 위(입력칸이 위에 있어서)
    if (!ms.length) { box.append(el('p', 'hint', c.main ? '여기 적으면 맥북의 Claude Code 세션이 받아요. 예: "오늘 시황 영상 어디까지 됐어?"' : '첫 메시지를 적어 보내면 새 대화가 시작돼요.')); return; }
    ms.forEach((m) => {
      const d = el('div', `ch-msg ${m.role === 'user' ? 'user' : 'assistant'}`); d.dataset.id = m.id || '';
      const t = el('div', 'ch-text'); linkify(m.text, t); d.append(t);
      const meta = el('div', 'ch-meta', `${m.role === 'user' ? '나' : '맥북 Claude'} · ${hhmm(m.at)}${m.took && m.role === 'assistant' ? ` · ${fmtSec(m.took)} 걸림` : ''}`);
      d.append(meta);
      if (m.role === 'user') { const [txt, cls] = statusOf(m); if (txt) d.append(el('span', `ch-st ${cls}`, txt)); }
      box.append(d);
    });
  }

  // ── 루틴 탭 ─────────────────────────────────────────────
  const ago = (iso) => { if (!iso) return ''; const s = Math.round((Date.now() - tsOf(iso)) / 1000); return s < 60 ? `${s}초 전` : s < 3600 ? `${Math.floor(s / 60)}분 전` : s < 86400 ? `${Math.floor(s / 3600)}시간 전` : `${Math.floor(s / 86400)}일 전`; };
  function row(parent, dotCls, title, sub) {
    const r = el('div', 'rt-row'); r.append(el('i', `rt-dot ${dotCls}`));
    const b = el('div', 'rt-txt'); b.append(el('b', '', title)); if (sub) b.append(el('div', 'rt-sub', sub)); r.append(b); parent.append(r);
  }
  function renderRoutine() {
    const body = $('#rtBody'); if (!body) return; body.replaceChildren();
    const up = $('#rtUpdated');
    if (!SW.cfg().token) { up.textContent = ''; body.append(el('p', 'hint', '설정 ①에서 저장소 열쇠를 넣으면 맥북 루틴 상태가 보여요.')); return; }
    if (!routine) { up.textContent = ''; body.append(el('p', 'hint', loading ? '불러오는 중…' : '맥북이 아직 루틴 상태를 안 적었어요. 맥북이 켜지고 1~2분 뒤에 생겨요.')); return; }
    const stale = (Date.now() - tsOf(routine.at)) > 20 * 60 * 1000;
    up.textContent = `맥북이 ${ago(routine.at)}에 적음${stale ? ' · 20분 넘게 조용함 — 맥북이 꺼졌거나 잠든 것 같아요' : ''}${routine.idleSec != null ? ` · 맥북 손 안 댄 지 ${fmtSec(routine.idleSec)}` : ''}`;
    const vids = routine.videos || [];
    const g1 = el('section', 'rt-group'); g1.append(el('h3', '', `🎬 오늘·어제 영상 (${vids.length})`));
    if (!vids.length) g1.append(el('p', 'hint small', '기획된 편이 없어요.'));
    vids.forEach((v) => {
      const dot = v.upload.startsWith('공개') ? 'ok' : (v.qa === '실패' || v.upload.startsWith('업로드 실패')) ? 'bad' : v.stage === '완성' ? 'ok' : 'off';
      const parts = [v.day.slice(5), v.stage, v.qa ? `검사 ${v.qa}` : '', v.upload, v.clip ? '클립 ✓' : '', v.comment ? '첫 댓글 ✓' : ''].filter(Boolean);
      row(g1, dot, v.job, parts.join(' · ') + (v.qaWhy ? `\n${v.qaWhy}` : ''));
    });
    body.append(g1);
    const g2 = el('section', 'rt-group'); g2.append(el('h3', '', '🖥 지금 돌고 있는 것'));
    (routine.procs || []).forEach((p) => row(g2, p.on ? 'ok' : 'off', p.name, p.on ? `돌아가는 중 (${p.since})` : '꺼짐'));
    body.append(g2);
    if ((routine.crons || []).length) {
      const g3 = el('section', 'rt-group'); g3.append(el('h3', '', '⏰ 터미널 세션 예약'));
      routine.crons.forEach((c) => row(g3, 'ok', c.when || '', c.what || ''));
      body.append(g3);
    }
    const g4 = el('section', 'rt-group'); g4.append(el('h3', '', '🔁 맥북 루틴 (launchd)'));
    (routine.launchd || []).forEach((j) => {
      const dot = !j.loaded ? 'off' : j.pid ? 'ok' : (j.lastExit && j.lastExit !== '0') ? 'bad' : 'ok';
      const sub = [j.when, !j.loaded ? '안 켜짐' : j.pid ? '돌아가는 중' : (j.lastExit && j.lastExit !== '0') ? `마지막 종료 코드 ${j.lastExit}` : '', j.log ? `${ago(j.logAt)} · ${j.log}` : ''].filter(Boolean).join(' · ');
      row(g4, dot, j.name, sub);
    });
    body.append(g4);
    const g5 = el('section', 'rt-group'); g5.append(el('h3', '', '📜 로그 끝 줄'));
    (routine.logs || []).forEach((l) => row(g5, 'ok', `${l.name} · ${ago(l.at)}`, l.line));
    body.append(g5);
  }

  // ── 폴링 ────────────────────────────────────────────────
  function schedule(now) {
    clearTimeout(timer);
    const ms = now ? 300 : !tabOn ? POLL_BG : hasPending(chats[cur]) ? POLL_FAST() : POLL_SLOW();
    timer = setTimeout(poll, ms);
  }
  async function poll() {
    if (document.visibilityState === 'visible' && SW.cfg().token && navigator.onLine) { await load(); if (tabOn === 'routine') renderRoutine(); }
    schedule();
  }

  document.addEventListener('sowon:tab', (e) => {
    tabOn = (e.detail === 'chat' || e.detail === 'routine') ? e.detail : '';
    if (tabOn) { render(); load().then(() => { if (tabOn === 'routine') renderRoutine(); }); schedule(); }
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') schedule(true); });
  window.addEventListener('online', () => schedule(true));
  $('#chatSend').addEventListener('click', send);
  $('#chatInput').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } });
  $('#chatStop').addEventListener('click', stop);
  $('#chatRename').addEventListener('click', renameChat);
  $('#chatDel').addEventListener('click', deleteChat);
  $('#rtRefresh').addEventListener('click', () => load(true).then(renderRoutine));
  setInterval(() => { if (tabOn === 'chat' && hasPending(chats[cur])) render(); }, 1000);   // 기다리는 초 표시
  render();
  if (SW.cfg().token) load().then(() => schedule()); else schedule();
})();
