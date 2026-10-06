/* 소원저장소 — 말하면 글자로 쌓이는 아이디어 음성 일기 + 릴스 대본 공방(대본 기능은 script.js)
 * 저장 위치: GitHub 비공개 저장소의 <dir>/<YYYY-MM>.json (GitHub Contents API)
 * 열쇠(토큰)는 이 기기의 localStorage 에만 둔다. 다른 곳으로 보내지 않는다. */
(() => {
  'use strict';

  const VERSION = '1.4.0';
  const DEFAULT_CFG = { owner: 'sein9507-max', repo: 'newlywed_tech', branch: 'main', dir: '아이디어뇌/스택', token: '' };
  const KINDS = ['블로그', '카드뉴스', '대본', '경험', '기타'];
  const FIRST_MONTH = '2026-09';
  const API = 'https://api.github.com';

  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const pad = (n) => String(n).padStart(2, '0');

  const store = {
    ok: true,
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { this.ok = false; return false; } },
    del(k) { try { localStorage.removeItem(k); } catch { /* 무시 */ } },
  };

  // ── 상태 ────────────────────────────────────────────────
  let cfg = { ...DEFAULT_CFG, ...store.get('mb.cfg', {}) };
  let queue = store.get('mb.queue', []);           // 아직 못 올린 작업
  let cache = store.get('mb.cache', {});           // { 'YYYY-MM': { entries, sha } }
  let loadedMonths = [monthOf(new Date())];
  let noMoreMonths = false;
  let flushing = false;
  let lastError = '';
  let kind = '';
  let editing = null;

  // ── 시간 ────────────────────────────────────────────────
  function isoLocal(d) {
    const off = -d.getTimezoneOffset(), s = off >= 0 ? '+' : '-', a = Math.abs(off);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${s}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
  }
  function monthOf(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; }
  function prevMonth(m) { const [y, mo] = m.split('-').map(Number); return mo === 1 ? `${y - 1}-12` : `${y}-${pad(mo - 1)}`; }
  function makeId(d) {
    const r = Math.random().toString(36).slice(2, 5).padEnd(3, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}-${r}`;
  }
  const DOW = ['일', '월', '화', '수', '목', '금', '토'];
  function dayLabel(at) {
    const [y, m, d] = at.slice(0, 10).split('-').map(Number);
    const dt = new Date(y, m - 1, d), today = new Date();
    const same = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    const yest = new Date(today); yest.setDate(today.getDate() - 1);
    const tail = same(dt, today) ? ' · 오늘' : same(dt, yest) ? ' · 어제' : '';
    return `${y !== today.getFullYear() ? y + '년 ' : ''}${m}월 ${d}일 (${DOW[dt.getDay()]})${tail}`;
  }

  // ── base64 (UTF-8 안전) ─────────────────────────────────
  function b64encode(str) {
    const bytes = new TextEncoder().encode(str); let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function b64decode(b64) {
    const bin = atob(String(b64).replace(/\s/g, '')); const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  // ── GitHub ──────────────────────────────────────────────
  class ApiError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

  async function gh(path, opts = {}) {
    let res;
    try {
      res = await fetch(API + path, {
        method: opts.method || 'GET', cache: 'no-store', referrerPolicy: 'no-referrer',
        headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${cfg.token}`, 'X-GitHub-Api-Version': '2022-11-28', ...(opts.body ? { 'Content-Type': 'application/json' } : {}) },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
      });
    } catch { throw new ApiError(0, '인터넷 연결을 확인해 주세요'); }
    if (res.ok) return res.status === 204 ? null : res.json();
    let detail = ''; try { detail = (await res.json()).message || ''; } catch { /* 무시 */ }
    throw new ApiError(res.status, explain(res.status, detail));
  }
  function explain(status, detail) {
    if (status === 401) return '열쇠가 틀렸거나 만료됐어요. 설정에서 새 열쇠를 넣어주세요';
    if (status === 403 && /rate limit/i.test(detail)) return '요청이 잠시 몰렸어요. 조금 뒤에 다시 올릴게요';
    if (status === 403) return '이 열쇠에 쓰기 권한이 없어요. 열쇠의 Contents 권한을 확인해 주세요';
    if (status === 404) return '이 열쇠로는 저장소가 안 보여요. 열쇠를 만들 때 저장소를 골랐는지 확인해 주세요';
    if (status === 409 || status === 422) return '다른 곳에서 먼저 바뀌었어요. 다시 맞춰서 올릴게요';
    return `GitHub 오류 ${status}${detail ? ' · ' + detail : ''}`;
  }
  const repoPath = () => `/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}`;
  const filePath = (month) => `${repoPath()}/contents/${cfg.dir.split('/').filter(Boolean).map(encodeURIComponent).join('/')}/${month}.json`;

  async function loadMonth(month) {
    let meta;
    try { meta = await gh(`${filePath(month)}?ref=${encodeURIComponent(cfg.branch)}&t=${Date.now()}`); }
    catch (e) { if (e.status === 404) return { entries: [], sha: null, missing: true }; throw e; }
    let raw = meta.content;
    if (!raw && meta.size > 0) raw = (await gh(`${repoPath()}/git/blobs/${meta.sha}`)).content;   // 1MB 넘는 파일
    let data = {}; try { data = JSON.parse(b64decode(raw || '') || '{}'); } catch { throw new ApiError(-1, `${month}.json 파일 형식이 깨져 있어요. 클로드에게 알려주세요`); }
    return { entries: Array.isArray(data.entries) ? data.entries : [], sha: meta.sha };
  }
  async function saveMonth(month, entries, sha, message) {
    const body = { version: 1, month, note: '소원저장소 앱이 쌓는 파일. 쓰는 법은 아이디어뇌/README.md', entries };
    const res = await gh(filePath(month), { method: 'PUT', body: { message, branch: cfg.branch, content: b64encode(JSON.stringify(body, null, 2) + '\n'), ...(sha ? { sha } : {}) } });
    return res.content.sha;
  }

  function applyOps(entries, ops) {
    const list = entries.map((e) => ({ ...e }));
    for (const op of ops) {
      if (op.op === 'add') { if (!list.some((e) => e.id === op.entry.id)) list.push(op.entry); }
      else if (op.op === 'edit') { const t = list.find((e) => e.id === op.id); if (t) Object.assign(t, op.patch); }
      else if (op.op === 'del') { const i = list.findIndex((e) => e.id === op.id); if (i >= 0) list.splice(i, 1); }
    }
    return list.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  }
  function commitMessage(ops) {
    const n = { add: 0, edit: 0, del: 0 }; ops.forEach((o) => n[o.op]++);
    const parts = []; if (n.add) parts.push(`+${n.add}`); if (n.edit) parts.push(`고침 ${n.edit}`); if (n.del) parts.push(`지움 ${n.del}`);
    const d = new Date();
    return `아이디어 ${parts.join(' · ')} (${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())})`;
  }

  function persistQueue() { if (!store.set('mb.queue', queue)) toast('이 브라우저는 임시 저장이 막혀 있어요. 창을 닫기 전에 올려주세요'); }
  function persistCache() {
    const keep = Object.keys(cache).sort().slice(-3); const slim = {}; keep.forEach((k) => { slim[k] = cache[k]; });
    store.set('mb.cache', slim);
  }

  async function flush() {
    if (flushing || !cfg.token || !queue.length) { renderStatus(); return; }
    if (!navigator.onLine) { renderStatus(); return; }
    flushing = true; renderStatus();
    try {
      const months = [...new Set(queue.map((o) => o.month))].sort();
      for (const month of months) {
        for (let attempt = 0; attempt < 3; attempt++) {
          const ops = queue.filter((o) => o.month === month);
          if (!ops.length) break;
          const file = await loadMonth(month);
          const entries = applyOps(file.entries, ops);
          try {
            const sha = await saveMonth(month, entries, file.sha, commitMessage(ops));
            queue = queue.filter((o) => !ops.includes(o)); persistQueue();
            cache[month] = { entries, sha }; persistCache();
            break;
          } catch (e) { if ((e.status === 409 || e.status === 422) && attempt < 2) continue; throw e; }
        }
      }
      lastError = '';
    } catch (e) { lastError = e.message || String(e); }
    finally { flushing = false; renderAll(); }
    if (queue.length && !lastError) flush();
  }

  async function refreshMonth(month) {
    if (!cfg.token || !navigator.onLine) return false;
    try { const f = await loadMonth(month); cache[month] = { entries: f.entries, sha: f.sha }; persistCache(); lastError = ''; renderAll(); return !f.missing; }
    catch (e) { lastError = e.message; renderStatus(); return false; }
  }

  // ── 화면: 공통 ──────────────────────────────────────────
  let toastTimer = 0;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('is-on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('is-on'), 2600); }

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isStandalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

  function renderStatus() {
    const p = $('#syncPill'); p.className = 'pill';
    if (!cfg.token) { p.textContent = '열쇠 필요'; p.classList.add('is-wait'); }
    else if (flushing) { p.textContent = '올리는 중…'; p.classList.add('is-wait'); }
    else if (!navigator.onLine) { p.textContent = `오프라인${queue.length ? ' · 대기 ' + queue.length : ''}`; p.classList.add('is-wait'); }
    else if (queue.length && lastError) { p.textContent = `대기 ${queue.length} · 다시 시도`; p.classList.add('is-err'); }
    else if (queue.length) { p.textContent = `대기 ${queue.length}`; p.classList.add('is-wait'); }
    else if (lastError) { p.textContent = '연결 확인 필요'; p.classList.add('is-err'); }
    else { p.textContent = '☁ 저장됨'; p.classList.add('is-ok'); }
    $('#queueInfo').textContent = `${queue.length}개`;
    $('#errInfo').textContent = lastError || '없음';
  }

  function renderBanner() {
    const b = $('#banner'); b.textContent = ''; b.hidden = true;
    if (isIOS && !isStandalone) {
      b.hidden = false; b.append('📌 Safari의 공유 버튼 → “홈 화면에 추가”를 누르면 하트 앱으로 쓸 수 있어요. 열쇠는 그 하트 앱 안에서 넣어주세요. ');
    } else if (!cfg.token) {
      b.hidden = false; b.append('💙 처음이시죠? 열쇠를 한 번 넣으면 말한 내용이 내 저장소에 쌓여요. ');
      const btn = el('button', '', '설정 열기'); btn.type = 'button'; btn.addEventListener('click', openSettings); b.append(btn);
    }
  }

  function renderChips(box, current, onPick) {
    box.textContent = '';
    KINDS.forEach((k) => {
      const c = el('button', 'chip' + (current === k ? ' is-on' : ''), k); c.type = 'button'; c.setAttribute('aria-pressed', String(current === k));
      c.addEventListener('click', () => onPick(current === k ? '' : k)); box.append(c);
    });
  }

  function visibleEntries() {
    const map = new Map();
    loadedMonths.forEach((m) => (cache[m]?.entries || []).forEach((e) => map.set(e.id, { ...e })));
    queue.forEach((op) => {
      if (op.op === 'add') map.set(op.entry.id, { ...op.entry, _wait: true });
      else if (op.op === 'edit') { const t = map.get(op.id); if (t) Object.assign(t, op.patch, { _wait: true }); }
      else if (op.op === 'del') map.delete(op.id);
    });
    return [...map.values()].sort((a, b) => (a.at < b.at ? 1 : -1));
  }

  function growNote() {       // 말이 길어지면 칸도 같이 자란다(화면의 42%까지)
    const n = $('#note'); n.style.height = 'auto'; n.style.height = Math.min(n.scrollHeight + 2, Math.round(window.innerHeight * 0.42)) + 'px';
  }
  function renderTalk() {
    growNote();
    renderChips($('#kinds'), kind, (k) => { kind = k; renderTalk(); });
    const n = $('#note').value.trim().length; $('#count').textContent = `${n}자`;
    const today = isoLocal(new Date()).slice(0, 10);
    const cnt = visibleEntries().filter((e) => e.at.slice(0, 10) === today).length;
    $('#todayLine').textContent = cnt ? `오늘 ${cnt}개 쌓았어요 ✦` : '오늘의 첫 생각을 말해보세요 ✦';
  }

  function renderList() {
    const box = $('#list'); box.textContent = '';
    const q = $('#search').value.trim().toLowerCase();
    const all = visibleEntries();
    const items = q ? all.filter((e) => (e.text + ' ' + (e.kind || '')).toLowerCase().includes(q)) : all;
    $('#stackCount').textContent = all.length ? `${all.length}` : '';
    if (!items.length) {
      const e = el('div', 'empty'); e.append(el('b', '', q ? '🔍' : '🫧'), q ? '찾는 말이 들어간 메모가 없어요' : (cfg.token ? '아직 쌓인 생각이 없어요. 말하기에서 첫 메모를 쌓아보세요' : '열쇠를 넣으면 쌓인 메모가 여기에 보여요'));
      box.append(e);
    }
    let lastDay = '';
    items.forEach((e) => {
      const day = e.at.slice(0, 10);
      if (day !== lastDay) { lastDay = day; box.append(el('div', 'tape', dayLabel(e.at))); }
      const card = el('button', 'note'); card.type = 'button';
      const head = el('div', 'note-head'); head.append(el('span', '', e.at.slice(11, 16)));
      if (e.kind) head.append(el('span', 'tag', e.kind));
      if (e._wait) head.append(el('span', 'tag wait', '⏳ 올리는 중'));
      (Array.isArray(e.used) ? e.used : []).forEach((u) => head.append(el('span', 'tag used', `✔ ${u.where || '사용함'}${u.date ? ' · ' + u.date.slice(5).replace('-', '/') : ''}`)));
      const text = el('p', 'note-text', e.text);
      const foot = el('div', 'note-foot'); const open = el('span', '', '펼치기'); const toScript = el('span', 'go', '✎ 대본으로'); const topic = el('span', 'go', '주제 3개'); const edit = el('span', '', '고치기'); foot.append(open, toScript, topic, edit);
      card.append(head, text, foot);
      card.addEventListener('click', (ev) => {
        if (ev.target === edit) { openEditor(e); return; }
        if (ev.target === toScript) { document.dispatchEvent(new CustomEvent('sowon:toScript', { detail: e })); return; }
        if (ev.target === topic) { document.dispatchEvent(new CustomEvent('sowon:topic', { detail: e })); return; }
        const on = card.classList.toggle('is-open'); open.textContent = on ? '접기' : '펼치기';
      });
      box.append(card);
    });
    $('#moreBtn').hidden = noMoreMonths || !cfg.token || !!q;
  }

  function renderAll() { renderStatus(); renderBanner(); renderTalk(); renderList(); document.dispatchEvent(new CustomEvent('sowon:entries')); }

  // ── 말하기(음성 인식) ───────────────────────────────────
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null, wantRec = false, baseText = '', sessions = 0, wakeLock = null, endGuard = 0;
  const join = (a, b) => (a && b ? a + (/\n$/.test(a) ? '' : ' ') + b : a || b);

  function setMicLabel(t) { $('#micLabel').textContent = t; }
  function micOff(reason) {
    $('#micWrap').classList.add('is-off');
    setMicLabel(reason || '아래 칸을 누르고, 키보드의 마이크(🎤)를 눌러 말해요');
    store.set('mb.micOff', true);
    $('#micRetry').hidden = !SR;
  }
  function micRetry() {
    store.del('mb.micOff'); $('#micWrap').classList.remove('is-off'); $('#micRetry').hidden = true; setRecUI(false);
  }
  function setRecUI(on) {
    const b = $('#micBtn'); b.classList.toggle('is-rec', on); b.setAttribute('aria-pressed', String(on));
    $('#note').readOnly = on;
    setMicLabel(on ? '듣고 있어요… 다시 누르면 멈춰요' : '하트를 누르고 말해요');
  }
  async function holdScreen(on) {
    try { if (on && navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen'); else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; } } catch { /* 무시 */ }
  }
  function spawnRec() {
    rec = new SR(); rec.lang = 'ko-KR'; rec.interimResults = true; rec.continuous = !isAndroid; rec.maxAlternatives = 1;
    const mySession = ++sessions;
    rec.onresult = (ev) => {
      let fin = '', tmp = '';
      for (let i = 0; i < ev.results.length; i++) { const r = ev.results[i]; if (r.isFinal) fin += r[0].transcript; else tmp += r[0].transcript; }
      const note = $('#note'); note.value = join(baseText, (fin + tmp).trim()); note.scrollTop = note.scrollHeight; renderTalk();
    };
    rec.onerror = (ev) => {
      if (['not-allowed', 'service-not-allowed', 'audio-capture'].includes(ev.error)) {
        const first = mySession === 1 && !baseTextChanged();
        wantRec = false;
        if (first) micOff('이 화면에서는 하트 마이크가 막혀 있어요. 아래 칸을 누르고 키보드의 마이크(🎤)로 말해주세요');
        else setTimeout(() => setMicLabel('멈췄어요. 이어서 말하려면 하트를 다시 눌러요'), 50);
      }
    };
    rec.onend = () => {
      clearTimeout(endGuard);
      baseText = $('#note').value.trim(); saveDraft();
      if (wantRec && sessions < 300) setTimeout(() => { if (wantRec) { try { spawnRec(); } catch { stopRec(); } } }, 250);
      else { wantRec = false; setRecUI(false); holdScreen(false); if ($('#micWrap').classList.contains('is-off')) micOff(); }
    };
    rec.start();
  }
  let textAtStart = '';
  const baseTextChanged = () => $('#note').value.trim() !== textAtStart;
  function startRec() {
    if (!SR) return;
    wantRec = true; sessions = 0; baseText = $('#note').value.trim(); textAtStart = baseText;
    setRecUI(true); holdScreen(true);
    try { spawnRec(); } catch { wantRec = false; setRecUI(false); micOff(); }
  }
  function stopRec() {
    wantRec = false;
    try { rec && rec.stop(); } catch { /* 무시 */ }
    clearTimeout(endGuard); endGuard = setTimeout(() => { setRecUI(false); holdScreen(false); }, 1500);
  }

  // ── 저장 ────────────────────────────────────────────────
  function saveDraft() { store.set('mb.draft', { text: $('#note').value, kind }); }
  function saveNote() {
    if (wantRec) stopRec();
    const text = $('#note').value.replace(/[ \t]+\n/g, '\n').trim();
    if (!text) { toast('먼저 말하거나 적어주세요'); return; }
    const now = new Date();
    const entry = { id: makeId(now), at: isoLocal(now), kind, text, used: [] };
    queue.push({ op: 'add', month: monthOf(now), entry }); persistQueue();
    $('#note').value = ''; kind = ''; baseText = ''; store.del('mb.draft');
    toast(cfg.token ? '쌓였어요 💙' : '이 휴대폰에 담아뒀어요. 열쇠를 넣으면 올라가요');
    renderAll(); flush();
  }

  function addNote(text, k) {     // 다른 탭(🔥급상승)이 스택에 메모를 넣을 때
    const now = new Date();
    const entry = { id: makeId(now), at: isoLocal(now), kind: k || '', text, used: [] };
    queue.push({ op: 'add', month: monthOf(now), entry }); persistQueue();
    renderAll(); flush();
    return entry;
  }

  // ── 고치기 ──────────────────────────────────────────────
  let edKind = '';
  function openEditor(entry) {
    editing = entry; edKind = entry.kind || '';
    $('#edMeta').textContent = `${dayLabel(entry.at)} ${entry.at.slice(11, 16)}`;
    $('#edText').value = entry.text;
    const draw = () => renderChips($('#edKinds'), edKind, (k) => { edKind = k; draw(); }); draw();
    $('#editor').showModal();
  }
  function queuedAdd(id) { return queue.find((o) => o.op === 'add' && o.entry.id === id); }
  function saveEdit() {
    const text = $('#edText').value.trim(); if (!text) { toast('내용이 비어 있어요'); return; }
    const pending = queuedAdd(editing.id);
    if (pending) { pending.entry.text = text; pending.entry.kind = edKind; }
    else queue.push({ op: 'edit', month: editing.at.slice(0, 7), id: editing.id, patch: { text, kind: edKind, edited: isoLocal(new Date()) } });
    persistQueue(); $('#editor').close(); toast('고쳤어요'); renderAll(); flush();
  }
  function deleteEdit() {
    if (!confirm('이 메모를 지울까요? 지우면 되돌릴 수 없어요.')) return;
    const pending = queuedAdd(editing.id);
    if (pending) queue = queue.filter((o) => o !== pending);
    else queue.push({ op: 'del', month: editing.at.slice(0, 7), id: editing.id });
    persistQueue(); $('#editor').close(); toast('지웠어요'); renderAll(); flush();
  }

  // ── 로고 ────────────────────────────────────────────────
  // '자동'은 3개월마다 크롬 하트(B) ↔ 픽셀 하트(C). 1~3월 B, 4~6월 C, 7~9월 B, 10~12월 C
  const LOGOS = { A: '젤리', B: '크롬', C: '픽셀', D: '리본' };
  const AUTO_PAIR = ['B', 'C'];
  const quarterLogo = (d = new Date()) => AUTO_PAIR[Math.floor(d.getMonth() / 3) % 2];
  const logoChoice = () => { const v = store.get('mb.logo', 'auto'); return LOGOS[v] ? v : 'auto'; };
  const currentLogo = () => (logoChoice() === 'auto' ? quarterLogo() : logoChoice());
  function applyLogo() {
    const k = currentLogo();
    $('#brandIcon').src = `icons/${k}/icon-192.png`; $('#favIcon').href = `icons/${k}/icon-192.png`;
    $('#touchIcon').href = `icons/${k}/apple-touch-icon.png`; $('#manifestLink').href = `manifest-${k}.webmanifest`;
  }
  function renderLogoPicker() {
    const grid = $('#logoGrid'); grid.textContent = ''; const choice = logoChoice();
    const add = (key, label, face) => {
      const b = el('button', 'logo-opt' + (choice === key ? ' is-on' : '')); b.type = 'button'; b.setAttribute('aria-pressed', String(choice === key));
      b.append(face, el('span', '', label));
      b.addEventListener('click', () => { store.set('mb.logo', key); applyLogo(); renderLogoPicker(); toast(key === 'auto' ? '3개월마다 자동으로 바꿀게요' : `${label} 하트로 바꿨어요`); });
      grid.append(b);
    };
    add('auto', '자동', el('span', 'auto', '↻'));
    Object.entries(LOGOS).forEach(([k, label]) => { const img = el('img'); img.src = `icons/${k}/icon-192.png`; img.alt = ''; img.width = 46; img.height = 46; add(k, label, img); });
    const now = new Date(), nextStart = new Date(now.getFullYear(), (Math.floor(now.getMonth() / 3) + 1) * 3, 1);
    $('#logoNow').textContent = choice === 'auto'
      ? `지금은 자동이에요. 3개월마다 크롬 하트 ↔ 픽셀 하트로 바뀌어요. (지금 ${LOGOS[quarterLogo()]} 하트 · ${nextStart.getMonth() + 1}월 1일부터 ${LOGOS[quarterLogo(nextStart)]} 하트)`
      : `지금은 ${LOGOS[choice]} 하트로 고정돼 있어요. ‘자동’을 누르면 3개월마다 크롬 ↔ 픽셀로 바뀌어요.`;
  }

  // ── 설정 ────────────────────────────────────────────────
  // 홀수 번째 조각은 GitHub 화면에 실제로 보이는 영어 이름(공식 문서로 확인한 것만 적는다)
  const TOKEN_STEPS = [
    ['GitHub에 로그인한 상태에서 아래 “열쇠 발급 페이지 열기”를 눌러요. 이름·설명·권한은 링크가 미리 채워줘요.'],
    ['', 'Expiration', ' 은 미리 366일로 들어가 있어요. 그대로 두거나 원하는 기간으로 바꿔요. (기간이 끝나면 새로 발급해서 다시 넣으면 돼요. 그동안 말한 메모는 휴대폰에 남아 있어요)'],
    ['', 'Repository access', ' 에서 ', 'Only select repositories', ' 를 고르고, ', 'Selected repositories', ' 목록에서 ', 'newlywed_tech', ' 하나만 선택해요.'],
    ['', 'Permissions', ' 에는 ', 'Contents', ' 가 이미 들어가 있어요. 그대로 두고 다른 권한은 추가하지 않아요.'],
    ['맨 아래 ', 'Generate token', ' 을 누르고, 나온 ', 'github_pat_…', ' 글자를 복사해서 위 칸에 붙여넣어요. (그 화면을 벗어나면 다시 볼 수 없어요)'],
  ];
  function renderTokenHelp() {
    const ol = $('#tokenSteps'); ol.textContent = '';
    TOKEN_STEPS.forEach((parts) => { const li = el('li'); parts.forEach((p, i) => li.append(i % 2 ? el('code', '', p) : p)); ol.append(li); });
    const q = new URLSearchParams({ name: 'sowon-phone', description: '소원저장소 앱이 아이디어뇌 폴더에 쓰는 열쇠', target_name: cfg.owner, expires_in: '366', contents: 'write' });
    $('#tokenLink').href = `https://github.com/settings/personal-access-tokens/new?${q}`;
  }
  function openSettings() {
    $('#repoLabel').textContent = `${cfg.owner}/${cfg.repo}`;
    $('#token').value = ''; $('#token').placeholder = cfg.token ? '열쇠가 들어 있어요 · 바꾸려면 새로 붙여넣기' : 'github_pat_… 붙여넣기';
    $('#cfgOwner').value = cfg.owner; $('#cfgRepo').value = cfg.repo; $('#cfgBranch').value = cfg.branch; $('#cfgDir').value = cfg.dir;
    $('#verInfo').textContent = VERSION; setMsg('', ''); renderLogoPicker();
    renderStatus(); $('#settings').showModal();
  }
  function setMsg(text, cls) { const m = $('#connectMsg'); m.textContent = text; m.className = 'msg' + (cls ? ' ' + cls : ''); }
  async function connect() {
    const t = $('#token').value.trim();
    const next = { ...cfg, owner: $('#cfgOwner').value.trim() || DEFAULT_CFG.owner, repo: $('#cfgRepo').value.trim() || DEFAULT_CFG.repo,
      branch: $('#cfgBranch').value.trim() || DEFAULT_CFG.branch, dir: ($('#cfgDir').value.trim() || DEFAULT_CFG.dir).replace(/^\/+|\/+$/g, '') };
    if (t) next.token = t;
    if (!next.token) { setMsg('열쇠를 먼저 붙여넣어 주세요', 'err'); return; }
    const before = cfg; cfg = next; setMsg('확인하는 중…', ''); $('#connectBtn').disabled = true;
    try {
      await gh(repoPath());                                                                   // 저장소가 보이는지
      await gh(`${repoPath()}/git/blobs`, { method: 'POST', body: { content: 'ping', encoding: 'utf-8' } }); // 쓰기 권한(커밋은 생기지 않음)
      store.set('mb.cfg', cfg); $('#token').value = ''; lastError = '';
      setMsg('연결됐어요 ✔ 이제 말하면 저장소에 쌓여요', 'ok');
      await refreshMonth(loadedMonths[0]); flush();
    } catch (e) { cfg = before; setMsg(e.message, 'err'); }
    finally { $('#connectBtn').disabled = false; renderAll(); }
  }
  function forgetToken() {
    if (!confirm('이 휴대폰에서 열쇠를 지울까요? 쌓아둔 메모는 저장소에 그대로 있어요.')) return;
    cfg.token = ''; store.set('mb.cfg', cfg); toast('열쇠를 지웠어요'); $('#settings').close(); renderAll();
  }
  async function checkUpdate() {
    if (!('serviceWorker' in navigator)) { location.reload(); return; }
    toast('새 버전을 확인하는 중…');
    try { const reg = await navigator.serviceWorker.getRegistration(); if (reg) await reg.update(); } catch { /* 무시 */ }
    setTimeout(() => location.reload(), 1200);
  }

  // ── 시작 ────────────────────────────────────────────────
  function switchTab(name) {
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('is-active', t.id === `tab-${name}`));
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === name));
    if (name === 'stack') { if (wantRec) stopRec(); renderList(); refreshMonth(loadedMonths[0]); }
    window.scrollTo(0, 0);
    document.dispatchEvent(new CustomEvent('sowon:tab', { detail: name }));
  }

  // 대본 쓰는 메모에 ✔ 표시 (script.js 가 부른다)
  function markUsed(id, where) {
    const e = visibleEntries().find((x) => x.id === id); if (!e) return;
    const used = (Array.isArray(e.used) ? e.used : []).filter((u) => u.where !== where).concat([{ where, date: isoLocal(new Date()).slice(0, 10) }]);
    const pending = queuedAdd(id);
    if (pending) pending.entry.used = used;
    else queue.push({ op: 'edit', month: e.at.slice(0, 7), id, patch: { used } });
    persistQueue(); renderAll(); flush();
  }

  // script.js(모듈)와 나누는 다리
  window.sowon = {
    entries: () => visibleEntries(), markUsed, addNote, toast, isoLocal, makeId, switchTab, openSettings,
    cfg: () => cfg, gh, repoPath, b64encode, b64decode,
  };

  function init() {
    const draft = store.get('mb.draft', null);
    if (draft && draft.text) { $('#note').value = draft.text; kind = draft.kind || ''; }
    if (!SR) micOff(); else if (store.get('mb.micOff', false) && isIOS && isStandalone) micOff();

    $('#micBtn').addEventListener('click', () => (wantRec ? stopRec() : startRec()));
    $('#micRetry').addEventListener('click', micRetry);
    $('#note').addEventListener('input', () => { renderTalk(); saveDraft(); });
    $('#saveBtn').addEventListener('click', saveNote);
    $('#search').addEventListener('input', renderList);
    $('#moreBtn').addEventListener('click', async () => {
      const next = prevMonth(loadedMonths[loadedMonths.length - 1]);
      if (next < FIRST_MONTH) { noMoreMonths = true; renderList(); toast('여기가 처음이에요'); return; }
      loadedMonths.push(next); $('#moreBtn').disabled = true; await refreshMonth(next); $('#moreBtn').disabled = false;
      if (prevMonth(next) < FIRST_MONTH) noMoreMonths = true; renderList();
    });
    document.querySelectorAll('.tab-btn').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));
    $('#openSettings').addEventListener('click', openSettings);
    $('#syncPill').addEventListener('click', () => { if (!cfg.token) openSettings(); else if (queue.length) { lastError = ''; flush(); } else refreshMonth(loadedMonths[0]).then(() => toast('최신 상태예요')); });
    document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
    document.querySelectorAll('dialog').forEach((d) => d.addEventListener('click', (ev) => { if (ev.target === d) d.close(); }));
    $('#connectBtn').addEventListener('click', connect);
    $('#forgetBtn').addEventListener('click', forgetToken);
    $('#flushBtn').addEventListener('click', () => { lastError = ''; flush(); toast(queue.length ? '올리는 중…' : '올릴 메모가 없어요'); });
    $('#updateBtn').addEventListener('click', checkUpdate);
    $('#edSave').addEventListener('click', saveEdit);
    $('#edDelete').addEventListener('click', deleteEdit);

    window.addEventListener('online', () => { renderStatus(); flush(); });
    window.addEventListener('offline', renderStatus);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (wantRec) stopRec(); saveDraft(); }
      else { flush(); refreshMonth(loadedMonths[0]); }
    });

    if (prevMonth(loadedMonths[0]) < FIRST_MONTH) noMoreMonths = true;
    applyLogo(); renderTokenHelp(); renderAll();
    refreshMonth(loadedMonths[0]).then(flush);
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
