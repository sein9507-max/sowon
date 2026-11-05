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
    } catch (e) { if (e.status !== 401) SW.toast(`급상승 불러오기 실패: ${e.message || e}`); }
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
    const stk = el('button', 'ghost-btn', '📼 대본 스택에 쌓기'); stk.type = 'button';   // 1.5.0: 받아쓰기·대본 정리까지 (script.js)
    stk.addEventListener('click', () => document.dispatchEvent(new CustomEvent('sowon:refAdd', { detail: { url: x.url, memo: x.caption ? String(x.caption).slice(0, 80) : '' } })));
    row.append(open, cp, go); c.append(row);
    return c;
  }

  function render() {
    const box = $('#trList'); if (!box) return;
    const hot = items.filter((x) => ageOf(x) <= 48 && !used[x.code]).length;
    const cnt = $('#trInstaCount'); if (cnt) cnt.textContent = hot ? String(hot) : '';   // 1.9.0: 급상승 세부 탭 배지는 주제(topic.js)가 쓰고, 인스타 수집 수는 접힘 제목에
    const det = $('#trInsta'); if (det && items.length && !det.dataset.touched) det.open = true;
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

  // ── 📋 떡상 주제 보고 (1.15.0, 사용자 11/5 "매일 자료 보고, 소원저장소 레퍼런스 급상승 탭 안에") ──
  // 맥북이 매일 아이디어뇌/급상승/떡상보고/<날짜>.md 에 쓴 판(재테크 주제 표·대본 3편, 뷰티 주제·키워드·편집 흐름)을 그대로 보여 준다. 최근 7일치 날짜 칩.
  const RDIR = () => `${DIR()}/떡상보고`;
  let reports = [], reportDay = '', reportText = '', reportLoading = false;
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\b(https?:\/\/[^\s)]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  function mdToNodes(md) {          // 작은 마크다운: #·##·### 제목, | 표 |, ``` 대본 칸(복사 단추), - 목록, 문단
    const out = document.createDocumentFragment(); const lines = md.split('\n'); let i = 0;
    const para = (buf) => { if (buf.length) { const p = el('p'); p.innerHTML = inline(buf.join(' ')); out.append(p); buf.length = 0; } };
    let buf = [];
    while (i < lines.length) {
      const ln = lines[i];
      if (/^```/.test(ln)) {
        para(buf); const code = []; i++;
        while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
        i++;
        const wrap = el('div', 'md-script'); const pre = el('pre', null, code.join('\n'));
        const b = el('button', 'ghost-btn md-copy', '📋 대본 복사'); b.type = 'button';
        b.addEventListener('click', async () => { try { await navigator.clipboard.writeText(code.join('\n')); SW.toast('대본을 복사했어요'); } catch { SW.toast('복사가 안 돼요 — 길게 눌러 복사하세요'); } });
        wrap.append(b, pre); out.append(wrap); continue;
      }
      const h = ln.match(/^(#{1,3})\s+(.*)/);
      if (h) { para(buf); const n = el(`h${h[1].length + 1}`); n.innerHTML = inline(h[2]); out.append(n); i++; continue; }
      if (/^\|/.test(ln)) {
        para(buf); const rows = [];
        while (i < lines.length && /^\|/.test(lines[i])) { if (!/^\|\s*-{2,}/.test(lines[i])) rows.push(lines[i].replace(/^\||\|$/g, '').split('|').map((c) => c.trim())); i++; }
        const wrap = el('div', 'md-table'); const t = el('table');
        rows.forEach((r, ri) => { const tr = el('tr'); r.forEach((c) => { const td = el(ri ? 'td' : 'th'); td.innerHTML = inline(c); tr.append(td); }); t.append(tr); });
        wrap.append(t); out.append(wrap); continue;
      }
      if (/^- /.test(ln)) {
        para(buf); const ul = el('ul');
        while (i < lines.length && /^- /.test(lines[i])) { const li = el('li'); li.innerHTML = inline(lines[i].slice(2)); ul.append(li); i++; }
        out.append(ul); continue;
      }
      if (!ln.trim()) { para(buf); i++; continue; }
      buf.push(ln); i++;
    }
    para(buf); return out;
  }
  async function loadReportList() {
    try {
      const files = await SW.gh(url(RDIR()));
      reports = (Array.isArray(files) ? files : []).map((f) => f.name).filter((n) => /^\d{4}-\d{2}-\d{2}\.md$/.test(n)).map((n) => n.slice(0, 10)).sort().reverse().slice(0, 7);
    } catch (e) { reports = []; if (e.status !== 404 && e.status !== 401) SW.toast(`떡상 보고 목록 실패: ${e.message || e}`); }
  }
  async function loadReport(day) {
    reportLoading = true; renderReport();
    try { const meta = await SW.gh(url(`${RDIR()}/${day}.md`)); reportText = SW.b64decode(meta.content || ''); reportDay = day; }
    catch (e) { reportText = ''; if (e.status !== 401) SW.toast(`떡상 보고 읽기 실패: ${e.message || e}`); }
    finally { reportLoading = false; renderReport(); }
  }
  function renderReport() {
    const box = $('#trReportBody'); if (!box) return;
    const nav = $('#trReportNav'); nav.textContent = '';
    reports.forEach((d) => { const b = el('button', 'chip' + (reportDay === d ? ' is-on' : ''), d.slice(5).replace('-', '/')); b.type = 'button'; b.addEventListener('click', () => loadReport(d)); nav.append(b); });
    const em = $('#trReportDate'); if (em) em.textContent = reportDay ? reportDay.slice(5).replace('-', '/') : '';
    box.replaceChildren();
    if (!SW.cfg().token) { box.append(el('p', 'hint', '설정 ①에서 저장소 열쇠를 넣으면 보여요.')); return; }
    if (reportLoading && !reportText) { box.append(el('p', 'hint', '불러오는 중…')); return; }
    if (!reports.length) { box.append(el('p', 'hint', '아직 보고가 없어요. 맥북이 매일 떡상 레이더 자료로 써요(아이디어뇌/급상승/떡상보고/<날짜>.md).')); return; }
    if (!reportText) { box.append(el('p', 'hint', '이 날짜 파일을 못 읽었어요.')); return; }
    box.append(mdToNodes(reportText));
  }
  async function loadReports(force) {
    if (!SW.cfg().token || !navigator.onLine) { renderReport(); return; }
    if (!force && reportDay) { renderReport(); return; }
    await loadReportList();
    if (reports.length) await loadReport(reports[0]); else renderReport();
  }

  document.addEventListener('sowon:tab', (e) => { if (e.detail === 'trend') { load(); loadReports(false); } });
  $('#trRefresh').addEventListener('click', () => { load(true); loadReports(true); });
  const det0 = $('#trInsta'); if (det0) det0.addEventListener('toggle', () => { det0.dataset.touched = '1'; });
  window.addEventListener('online', () => load(true));
  render();
  load(true);
  loadReports(true);
})();
