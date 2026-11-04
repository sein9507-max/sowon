/* 떡상 레이더 — 인스타 릴스·캐러셀(크롬 확장 2.0이 쌓은 일별 파일) + 유튜브 인기 쇼츠 KR(맥북 떡상_수집.py) + 지금 이슈 탑 20 + 스레드 키워드.
 * 서버 없음. GitHub newlywed_tech 저장소를 열쇠로 직접 읽고, 보드·대본 스택·기획표도 거기에 쓴다. 외부 요청은 api.github.com 하나. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const CFG = { owner: 'sein9507-max', repo: 'newlywed_tech', branch: 'main', dir: '아이디어뇌/급상승', stackDir: '아이디어뇌/스택', trendDir: '뉴스수집/트렌드', planDir: '영상기획' };
  const API = 'https://api.github.com';
  const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 무시 */ } } };
  const TOPICS = [
    ['뷰티', '뷰티,화장품,스킨케어,메이크업,올리브영,피부관리,선크림,쿠션,파운데이션,립스틱,틴트,세럼,토너,클렌징,다이소 화장품,skincare,skin care,makeup,make up,beauty,sunscreen,serum,lipstick,foundation,grwm,护肤,美妆,化妆,彩妆,面霜,精华,口红'],
    ['지원금·정책', '지원금,청년수당,청년도약,청년내일,희망적금,바우처,환급,정부 지원,국가 지원,복지,수당,신청하세요,신청 가능,신청방법,청년장학'],
    ['주식·코인', '주식,코인,비트코인,비트,ETF,배당,나스닥,코스피,코스닥,종목,환율,반도체,삼성전자,테슬라,엔비디아,증시,매수,매도,수익률,stock,stocks,crypto,bitcoin,invest,investing,dividend,股票,基金,炒股'],
    ['부동산·청약', '청약,집값,내집,내 집,전세,월세,아파트,부동산,분양,매물,주담대,재개발,신축,평수'],
    ['재테크·저축', '재테크,적금,예금,통장,저축,짠테크,파킹,금리,이자,연금,절세,세금,자산,체크카드,신용카드,돈 모으,돈모으,1억,목돈,가계부,소비,절약,money,saving,savings,budget,finance,personal finance,frugal,debt,理财,存钱,攒钱,省钱,储蓄'],
    ['부업·수익', '부업,월 100,월100,N잡,창업,스마트스토어,쿠팡,블로그 수익,유튜브 수익,인스타 수익,돈 버는,돈버는,수익화,자동화 수익'],
    ['자기계발·AI', '자기계발,습관,미라클,독서,루틴,갓생,시간관리,동기부여,AI 활용,챗GPT,ChatGPT,챗지피티,노션,클로드,생산성,공부법'],
    ['신혼·결혼', '신혼,부부,결혼,예비부부,남편,아내,혼수,신혼집,결혼식,웨딩'],
    ['직장·월급', '월급,연봉,직장인,퇴사,이직,회사,상사,사회초년생,출근,퇴근,성과급'],
  ];
  const OUT = '주제 밖';
  const BEAUTY = ['뷰티'], MONEY = ['지원금·정책', '주식·코인', '부동산·청약', '재테크·저축', '부업·수익', '직장·월급'];   // 11/3 사용자 "뷰티·재테크만"
  const groupOf = (t) => (BEAUTY.includes(t) ? 'beauty' : MONEY.includes(t) ? 'money' : 'etc');
  const YT_MIN_VIEWS = 50000;
  // 유튜브에서 아이디어에 안 쓰이는 것: 음악(10)·게임(20)·영화(1)·예고편·뮤비, 국내인데 한글 없음, 해외인데 라틴 글자 아님(11/3 사용자 "유튜브 레퍼런스 너무 별로")
  const YT_JUNK_CAT = new Set(['1', '10', '20']);
  const YT_JUNK_RE = /trailer|teaser|\bm\/?v\b|official (video|audio|mv)|lyric|예고편|티저|뮤직비디오|\bost\b|gameplay|fortnite|roblox|brawl stars|minecraft|롤드컵|\blck\b/i;
  function ytJunk(x) {
    if (x.platform !== 'yt') return false;
    if (YT_JUNK_CAT.has(String(x.category || ''))) return true;
    const t = `${x.title || ''} ${x.caption || ''}`;
    if (YT_JUNK_RE.test(x.title || '')) return true;
    if (x.region === '국내' && !/[가-힣]/.test(x.title || '')) return true;
    if (x.region === '해외' && /#(telugu|hindi|tamil|bhojpuri|urdu)/i.test(t)) return true;
    if (x.region === '해외' && /[ऀ-෿؀-ۿ฀-๿]/.test(t)) return true;   // 인도·아랍·태국 글자
    return false;
  }
  function topicOf(text) { const hay = String(text || '').toLowerCase(); for (const [t, ws] of TOPICS) { const w = ws.split(',').map((s) => s.trim().toLowerCase()).find((x) => x && (/^[\x00-\x7f]+$/.test(x) ? new RegExp(`(?<![a-z])${x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z])`).test(hay) : hay.includes(x))); if (w) return { topic: t, word: w }; } return { topic: '', word: '' }; }

  // ── 열쇠 ────────────────────────────────────────────────
  let token = '';
  const okTok = (t) => { t = String(t || '').replace(/\s/g, ''); return /^(gh[pousr]_|github_pat_)[A-Za-z0-9_]{20,}$/.test(t) ? t : ''; };
  function findToken() {
    if (location.hash.startsWith('#k=')) { let t = ''; try { t = atob(decodeURIComponent(location.hash.slice(3))); } catch { t = ''; } try { history.replaceState(null, '', location.pathname); } catch { /* 무시 */ } if (okTok(t)) { LS.set('radar.token', t); return t; } }
    const mine = okTok(LS.get('radar.token', '')); if (mine) return mine;
    const sowon = LS.get('mb.cfg', null); if (sowon && okTok(sowon.token)) return sowon.token;   // 소원저장소와 같은 origin → 같은 localStorage
    return '';
  }
  async function gh(path, opts = {}) {
    const res = await fetch(`${API}${path}`, {
      method: opts.method || 'GET', cache: 'no-store',
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', ...(opts.body ? { 'Content-Type': 'application/json' } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    if (!res.ok) { const e = new Error(res.status === 401 ? '열쇠가 틀렸거나 만료됐어요' : res.status === 404 ? '없음' : `GitHub ${res.status}`); e.status = res.status; throw e; }
    return res.json();
  }
  const enc = (p) => p.split('/').map(encodeURIComponent).join('/');
  const b64dec = (b64) => { const bin = atob(String(b64).replace(/\s/g, '')); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); return new TextDecoder().decode(bytes); };
  const b64enc = (str) => { const bytes = new TextEncoder().encode(str); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(bin); };
  const repo = () => `/repos/${encodeURIComponent(CFG.owner)}/${encodeURIComponent(CFG.repo)}`;
  async function readFile(path) {        // → { text, sha } 또는 null(없음)
    try {
      const meta = await gh(`${repo()}/contents/${enc(path)}?ref=${encodeURIComponent(CFG.branch)}&t=${Date.now()}`);
      let raw = meta.content || '';
      if (!raw && meta.size > 0) raw = (await gh(`${repo()}/git/blobs/${meta.sha}`)).content;
      return { text: b64dec(raw), sha: meta.sha };
    } catch (e) { if (e.status === 404) return null; throw e; }
  }
  async function readJson(path) { const f = await readFile(path); if (!f) return null; try { return { data: JSON.parse(f.text || '{}'), sha: f.sha }; } catch { return { data: {}, sha: f.sha, broken: true }; } }
  async function writeFile(path, text, sha, message) {
    return gh(`${repo()}/contents/${enc(path)}`, { method: 'PUT', body: { message, branch: CFG.branch, content: b64enc(text), ...(sha ? { sha } : {}) } });
  }
  async function updateJson(path, mutate, message) {   // 읽고 → 고치고 → 쓰기, 충돌이면 3번까지 다시
    for (let i = 0; i < 3; i++) {
      const cur = await readJson(path); const data = cur && !cur.broken ? cur.data : {};
      const next = mutate(data) || data;
      try { await writeFile(path, JSON.stringify(next, null, 1) + '\n', cur ? cur.sha : null, message); return next; }
      catch (e) { if (!(e.status === 409 || e.status === 422) || i === 2) throw e; }
    }
  }

  // ── 시간 ────────────────────────────────────────────────
  const pad = (n) => String(n).padStart(2, '0');
  const kstDay = (d) => new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10);
  const daysBack = (n) => Array.from({ length: n }, (_, i) => kstDay(new Date(Date.now() - i * 864e5)));
  const hoursAgo = (iso) => (Date.now() - new Date(iso).getTime()) / 36e5;
  const winH = (x) => hoursAgo(x.postedAt);   // 기간은 언제나 '올린 시각' 기준(11/3 사용자 "24시간 조건이 안 맞아")
  const ago = (iso) => { if (!iso) return '시간 모름'; const h = hoursAgo(iso); return h < 1 ? `${Math.max(1, Math.round(h * 60))}분 전` : h < 48 ? `${Math.round(h)}시간 전` : `${Math.round(h / 24)}일 전`; };
  const short = (n) => (n == null ? '-' : n >= 1e8 ? (n / 1e8).toFixed(1).replace(/\.0$/, '') + '억' : n >= 1e4 ? (n / 1e4).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, '') + '만' : n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, '') + '천' : String(Math.round(n)));
  function isoLocal(d) { const o = -d.getTimezoneOffset(), s = o >= 0 ? '+' : '-', a = Math.abs(o); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${s}${pad(Math.floor(a / 60))}:${pad(a % 60)}`; }
  const makeId = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}-${Math.random().toString(36).slice(2, 5)}`;

  // ── 상태 ────────────────────────────────────────────────
  let items = [], issues = { time: '', list: [] }, threads = null, board = { saved: {}, watch: {}, picks: {}, memos: {} }, boardSha = null;
  let loadedAt = 0, lastCollected = 0, loading = false;
  // 기본값: 3일 안 · 뷰티+재테크(그 밖은 탭) · 최소 조회수 1만 · 떡상점수 정렬. 10만↑은 칸에서 고른다
  const F = { src: LS.get('radar.src', 'all'), span: Number(LS.get('radar.span72', 72)), region: LS.get('radar.region', 'all'), sort: LS.get('radar.sort', 'score'), minViews: Number(LS.get('radar.minViews7', 10000)), minMult: Number(LS.get('radar.minMult', 0)), q: '', group: LS.get('radar.group', 'all'), topic: LS.get('radar.topic2', ''), onlyWatch: false, onlySaved: false };
  let current = null;

  // ── 불러오기 ────────────────────────────────────────────
  function normInsta(x) {
    const kind = x.kind === 'carousel' ? 'carousel' : x.kind === 'reel' ? 'reel' : x.kind === 'image' ? 'image' : (x.url || '').includes('/reel/') ? 'reel' : 'image';
    const t = x.topic ? { topic: x.topic, word: x.topicWord || '' } : topicOf(`${x.user} ${x.caption}`);
    return { windowAt: x.windowAt || null, id: `ig:${x.code}`, code: x.code, platform: 'insta', region: x.region || (/[가-힣]/.test(`${x.caption || ''}`) ? '국내' : '해외'), kind, url: x.url || `https://www.instagram.com/${kind === 'reel' ? 'reel' : 'p'}/${x.code}/`, user: x.user || '', caption: x.caption || '', views: x.views ?? null, likes: x.likes ?? null, comments: x.comments ?? null, shares: x.shares ?? null,
      postedAt: x.postedAt || x.capturedAt, capturedAt: x.capturedAt, seenAt: x.seenAt || x.capturedAt, thumb: x.thumb || '', carouselCount: x.carouselCount || null, audio: x.audio || '', duration: x.duration || null, followers: x.followers ?? null, video: x.video || '', medianViews: x.medianViews || null, medianN: x.medianN || null, topic: t.topic, topicWord: t.word, source: x.source || x.how || '', history: Array.isArray(x.history) ? x.history : [] };
  }
  function normYt(x) {
    const t = x.topic ? { topic: x.topic, word: x.topicWord || '' } : topicOf(`${x.title} ${x.caption}`);
    return { id: `yt:${x.id}`, code: x.id, platform: 'yt', region: x.region || (/US/.test(x.source || '') ? '해외' : '국내'), kind: x.kind === 'shorts' ? 'shorts' : 'video', url: x.url, user: x.user || '', caption: `${x.title || ''}\n${x.caption || ''}`.trim(), title: x.title || '', views: x.views ?? null, likes: x.likes ?? null, comments: x.comments ?? null, shares: null,
      postedAt: x.postedAt, capturedAt: x.capturedAt, seenAt: x.seenAt || x.capturedAt, thumb: x.thumb || '', carouselCount: null, audio: '', duration: x.duration || null, followers: null, topic: t.topic, topicWord: t.word, category: x.category || '', source: x.source || '유튜브 인기 KR', history: Array.isArray(x.history) ? x.history : [] };
  }
  function parseIssues(md) {       // 뉴스수집/트렌드/<날짜>.md 의 마지막 '⭐ 탑 20'
    const lines = md.split('\n'); let time = '', list = [], cur = null, curTime = '';
    for (const ln of lines) {
      const h = ln.match(/^## (\d{2}:\d{2}) 수집/); if (h) { curTime = h[1]; continue; }
      if (/^### ⭐ 탑 20/.test(ln)) { cur = []; time = curTime; continue; }
      if (cur && /^### /.test(ln)) { list = cur; cur = null; continue; }
      if (cur) { const m = ln.match(/^(\d+)\. (.+?)(?:\s*〔(.+?)〕)?\s*$/); if (m) cur.push({ n: Number(m[1]), text: m[2], src: m[3] || '' }); }
    }
    if (cur) list = cur;
    return { time, list };
  }
  async function loadAll(force) {
    if (loading) return;
    if (!token) { setStatus('열쇠가 없어요 — ⚙ 열쇠에서 넣어 주세요'); openSetup(); return; }
    if (!force && Date.now() - loadedAt < 60e3) { render(); return; }
    loading = true; setStatus('GitHub에서 읽는 중…');
    try {
      const igDays = daysBack(F.span >= 168 ? 8 : 4), ytDays = daysBack(3), thDays = daysBack(2);
      const extDays = daysBack(F.span >= 168 ? 8 : 3);
      const [igs, yts, ths, bd, trendToday, trendYday, igx, tts, xhs] = await Promise.all([
        Promise.all(igDays.map((d) => readJson(`${CFG.dir}/일별/${d}.json`).catch(() => null))),
        Promise.all(ytDays.map((d) => readJson(`${CFG.dir}/유튜브/${d}.json`).catch(() => null))),
        Promise.all(thDays.map((d) => readJson(`${CFG.dir}/스레드/${d}.json`).catch(() => null))),
        readJson(`${CFG.dir}/보드.json`).catch(() => null),
        readFile(`${CFG.trendDir}/${kstDay(new Date())}.md`).catch(() => null),
        readFile(`${CFG.trendDir}/${kstDay(new Date(Date.now() - 864e5))}.md`).catch(() => null),
        Promise.all(extDays.map((d) => readJson(`${CFG.dir}/인스타/${d}.json`).catch(() => null))),
        Promise.all(extDays.map((d) => readJson(`${CFG.dir}/틱톡/${d}.json`).catch(() => null))),
        Promise.all(extDays.map((d) => readJson(`${CFG.dir}/레드노트/${d}.json`).catch(() => null))),
      ]);
      const byId = new Map(); lastCollected = 0;
      igs.filter(Boolean).forEach((f) => (f.data.entries || []).forEach((x) => { const it = normInsta(x); byId.set(it.id, it); lastCollected = Math.max(lastCollected, new Date(it.seenAt || it.capturedAt).getTime() || 0); }));
      yts.filter(Boolean).forEach((f) => (f.data.entries || []).forEach((x) => { const it = normYt(x); if (!byId.has(it.id) || new Date(it.seenAt) > new Date(byId.get(it.id).seenAt)) byId.set(it.id, it); lastCollected = Math.max(lastCollected, new Date(it.seenAt || it.capturedAt).getTime() || 0); }));
      const addAll = (files, norm) => files.filter(Boolean).forEach((f) => (f.data.entries || []).forEach((x) => { const it = norm(x); const old = byId.get(it.id); if (!old || new Date(it.seenAt) > new Date(old.seenAt)) byId.set(it.id, { ...it, windowAt: it.windowAt && old && old.windowAt && old.windowAt > it.windowAt ? old.windowAt : it.windowAt }); lastCollected = Math.max(lastCollected, new Date(it.seenAt || it.capturedAt).getTime() || 0); }));
      addAll(igx, normInsta);
      addAll(tts, (x) => ({ ...normInsta(x), id: `tt:${x.code}`, platform: 'tt', kind: 'tiktok', url: x.url, windowAt: x.windowAt }));
      addAll(xhs, (x) => ({ ...normInsta(x), id: `xhs:${x.code}`, platform: 'xhs', kind: x.kind, url: x.url, title: x.title || '', windowAt: x.windowAt }));
      items = [...byId.values()].filter((x) => x.postedAt);
      threads = ths.find((f) => f && f.data && Array.isArray(f.data.keywords)) ? ths.find((f) => f && f.data && Array.isArray(f.data.keywords)).data : null;
      if (bd && !bd.broken) { board = { saved: {}, watch: {}, picks: {}, memos: {}, ...bd.data }; boardSha = bd.sha; } else { boardSha = bd ? bd.sha : null; }
      issues = trendToday ? parseIssues(trendToday.text) : trendYday ? parseIssues(trendYday.text) : { time: '', list: [] };
      if (trendToday && !issues.list.length && trendYday) issues = parseIssues(trendYday.text);
      loadedAt = Date.now();
      computeMedians();
    } catch (e) { toast(`불러오기 실패: ${e.message || e}`); if (e.status === 401) openSetup(); }
    finally { loading = false; render(); renderSide(); }
  }

  // ── 지표 ────────────────────────────────────────────────
  const medians = new Map();        // platform:user → { med, n }
  function computeMedians() {
    medians.clear();
    const g = new Map();
    items.forEach((x) => { if (x.views != null && x.user) { const k = `${x.platform}:${x.user}`; (g.get(k) || g.set(k, []).get(k)).push(x.views); } });
    g.forEach((arr, k) => { if (arr.length >= 3) { const s = [...arr].sort((a, b) => a - b); medians.set(k, { med: s[Math.floor(s.length / 2)], n: s.length }); } });
  }
  function metrics(x) {
    const h = Math.max(0.5, hoursAgo(x.postedAt));
    const views = x.views != null ? x.views : x.likes != null ? x.likes * 20 : null;   // 캐러셀 등 조회수 없음 → 좋아요×20 대용
    let vph = views != null ? views / h : null;
    let vphRecent = null;
    const hist = (x.history || []).filter((p) => p && p.at && p.views != null);
    if (hist.length >= 2) { const a = hist[hist.length - 2], b = hist[hist.length - 1]; const dh = (new Date(b.at) - new Date(a.at)) / 36e5; if (dh >= 0.4 && b.views >= a.views) vphRecent = (b.views - a.views) / dh; }
    const cpk = views ? (x.comments || 0) / views * 1000 : null;
    const likeRate = x.views ? (x.likes || 0) / x.views : null;
    const m = x.medianViews ? { med: x.medianViews, n: x.medianN || 0, acct: true } : medians.get(`${x.platform}:${x.user}`); const mult = m && x.views != null ? x.views / Math.max(1, m.med) : null;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    // 떡상점수(레퍼 사이트처럼 조회수·평소 대비 배수 위주, 11/3): 조회수 35 + 배수 30 + 시간당 20 + 1천뷰당 댓글 10 + 신선도 5
    const s1 = views != null ? clamp(Math.log10(Math.max(1, views) / 1000) / 4 * 35, 0, 35) : 0;          // 1만 9 · 10만 17 · 100만 26 · 1000만 35
    const s2 = mult != null ? clamp(Math.log2(mult + 1) / Math.log2(33) * 30, 0, 30) : 0;                // 1배 7 · 4배 14 · 15배 24 · 32배↑ 30
    const s3 = vph != null ? clamp(Math.log10(vph + 1) / Math.log10(50001) * 20, 0, 20) : 0;            // 5만/h 만점
    const s4 = cpk != null ? clamp(cpk / 20 * 10, 0, 10) : 0;                                            // 1천뷰당 댓글 20개 만점
    const s5 = h <= 24 ? 5 : h <= 48 ? 3 : 0;
    return { h, vph, vphRecent, cpk, likeRate, mult, med: m, score: Math.round(s1 + s2 + s3 + s4 + s5), viewsLike: x.views == null && x.likes != null };
  }

  // ── 거르기·정렬 ─────────────────────────────────────────
  function filtered() {
    const q = F.q.trim().toLowerCase();
    let list = items.filter((x) => {
      if (winH(x) > F.span) return false;
      if (F.src === 'reel' && x.kind !== 'reel') return false;
      if (F.src === 'carousel' && x.kind !== 'carousel' && x.kind !== 'image') return false;
      if ((F.src === 'reel' || F.src === 'carousel') && x.platform !== 'insta') return false;
      if (F.src === 'shorts' && x.platform !== 'yt') return false;
      if (F.src === 'tiktok' && x.platform !== 'tt') return false;
      if (F.src === 'xhs' && x.platform !== 'xhs') return false;
      if (F.src === 'all' && x.platform === 'yt' && x.kind === 'video') return false;
      if (x.platform === 'yt' && ((x.views || 0) < YT_MIN_VIEWS || ytJunk(x))) return false;   // 유튜브 쇼츠는 조회수 5만 이상만(사용자 기준 11/3)
      if (F.region !== 'all' && x.region !== F.region) return false;
      if (F.minViews && (x.views != null ? x.views : (x.likes || 0) * 200) < F.minViews) return false;   // 캐러셀·사진은 좋아요 500 ≈ 10만 급
      const g = groupOf(x.topic || '');
      if (F.group === 'all' ? g === 'etc' : g !== F.group) return false;   // 전체 = 뷰티+재테크(11/4 사용자 "내가 찾는 주제가 맞는지"), 그 밖은 탭
      if (F.group === 'money' && F.topic && x.topic !== F.topic) return false;
      if (F.onlyWatch && !board.watch[x.user]) return false;
      if (F.onlySaved && !board.saved[x.id]) return false;
      if (q && !`${x.user} ${x.caption}`.toLowerCase().includes(q)) return false;
      return true;
    }).map((x) => ({ x, m: metrics(x) })).filter((r) => !F.minMult || (r.m.mult || 0) >= F.minMult);
    const key = { score: (r) => r.m.score, views: (r) => r.x.views || 0, vph: (r) => r.m.vphRecent || r.m.vph || 0, mult: (r) => r.m.mult || 0, comments: (r) => r.x.comments || 0, likes: (r) => r.x.likes || 0, new: (r) => new Date(r.x.postedAt).getTime() }[F.sort] || ((r) => r.m.score);
    return list.sort((a, b) => key(b) - key(a));
  }

  // ── 그리기 ──────────────────────────────────────────────
  function setStatus(t) { $('#status').textContent = t; }
  function renderTopics() {
    const row = $('#topicRow'); row.replaceChildren();
    const within = items.filter((x) => winH(x) <= F.span && !(x.platform === 'yt' && ((x.views || 0) < YT_MIN_VIEWS || ytJunk(x))) && !(F.src === 'all' && x.platform === 'yt' && x.kind === 'video') && (F.region === 'all' || x.region === F.region));
    const cnt = (f) => within.filter(f).length;
    const mk = (label, on, n, fn) => { const b = el('button', on ? 'on' : ''); b.append(label, el('small', '', String(n))); b.addEventListener('click', fn); return b; };
    const setG = (g) => { F.group = g; F.topic = ''; LS.set('radar.group', g); LS.set('radar.topic2', ''); render(); };
    row.append(mk('전체', F.group === 'all', cnt((x) => groupOf(x.topic || '') !== 'etc'), () => setG('all')));
    row.append(mk('💄 뷰티', F.group === 'beauty', cnt((x) => groupOf(x.topic || '') === 'beauty'), () => setG('beauty')));
    row.append(mk('💰 재테크', F.group === 'money', cnt((x) => groupOf(x.topic || '') === 'money'), () => setG('money')));
    if (F.group === 'money') {
      const sep = el('span', 'muted', '│'); row.append(sep);
      MONEY.forEach((t) => row.append(mk(t, F.topic === t, cnt((x) => x.topic === t), () => { F.topic = F.topic === t ? '' : t; LS.set('radar.topic2', F.topic); render(); })));
    }
    row.append(mk('🗂 그 밖', F.group === 'etc', cnt((x) => groupOf(x.topic || '') === 'etc'), () => setG('etc')));
  }
  function platName(x) { return { insta: '인스타', yt: '유튜브', tt: '틱톡', xhs: '레드노트' }[x.platform] || x.platform; }
  function kindLabel(x) { if (x.platform === 'tt') return '🎵 틱톡'; if (x.platform === 'xhs') return x.kind === 'video' ? '📕 영상' : '📕 노트'; return x.kind === 'carousel' ? `🖼 캐러셀${x.carouselCount ? ` ${x.carouselCount}장` : ''}` : x.kind === 'reel' ? '🎬 릴스' : x.kind === 'shorts' ? '▶ 쇼츠' : x.kind === 'video' ? '▶ 영상' : '📷 사진'; }
  function card(x, m) {
    const c = el('article', 'card' + (board.picks[x.id] ? ' picked' : ''));
    const th = el('div', 'thumb');
    const ph = el('div', 'ph', (x.title || x.caption || '').slice(0, 60) || `@${x.user}`);
    if (x.thumb) {   // 인스타 계정 글 썸네일(fbcdn.net)은 다른 사이트에서 못 불러오게 막혀 있어서(CORP) 공개 이미지 중계 wsrv.nl 을 거친다. 실패하면 원래 주소 → 글자 카드
      const img = el('img'); img.alt = ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
      const direct = x.thumb, viaProxy = x.platform === 'yt' ? direct : `https://wsrv.nl/?url=${encodeURIComponent(direct)}&w=360&q=72&output=jpg`;
      img.src = viaProxy;
      img.addEventListener('error', () => { if (img.src !== direct && viaProxy !== direct) { img.src = direct; return; } img.remove(); th.prepend(ph); });
      th.append(img);
    } else th.append(ph);
    th.append(el('span', 'tl', `${x.region === '해외' ? '🌎' : '🇰🇷'} ${platName(x)} · ${kindLabel(x)}`));
    const tr = el('span', 'tr' + (m.mult != null && m.mult >= 5 ? ' hot' : ''), m.mult != null ? `${m.mult.toFixed(1)}x` : `${m.score}점`); tr.title = m.mult != null ? `평소(중앙값 ${short(m.med.med)}, ${m.med.n}개) 대비` : '떡상점수'; th.append(tr);
    th.append(el('span', 'bl', x.views != null ? short(x.views) : `♥ ${short(x.likes)}`));
    th.append(el('span', 'br', ago(x.postedAt)));
    const body = el('div', 'body');
    const u = el('div', 'user'); if (board.watch[x.user]) u.append(el('span', 'star', '★ ')); u.append(`@${x.user || '?'}`); body.append(u);
    body.append(el('div', 'src', `${x.source || ''}${x.topic ? ` · ${x.topic}` : ` · ${OUT}`}`));
    body.append(el('div', 'cap', (x.title || x.caption || '').replace(/\s+/g, ' ')));
    const met = el('div', 'met');
    met.append(el('span', '', `♥ ${short(x.likes)}`), el('span', '', `💬 ${short(x.comments)}`));
    if (m.vph != null) met.append(el('span', '', `${short(m.vphRecent || m.vph)}/h${m.viewsLike ? '*' : ''}`));
    met.append(el('span', 'score', `점수 ${m.score}`));
    body.append(met);
    c.append(th, body);
    c.addEventListener('click', () => openDetail(x));
    return c;
  }
  function render() {
    renderTopics();
    $('#srcSeg').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === F.src));
    $('#regSeg').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === F.region));
    $('#spanSeg').querySelectorAll('button').forEach((b) => b.classList.toggle('on', Number(b.dataset.v) === F.span));
    $('#sort').value = F.sort; $('#minViews').value = String(F.minViews); $('#minMult').value = String(F.minMult);
    const list = filtered();
    const grid = $('#grid'); grid.replaceChildren();
    if (!items.length) grid.append(el('p', 'empty', loading ? '읽는 중…' : token ? '아직 쌓인 게 없어요. 조사용 크롬에서 확장 2.0으로 인스타를 내리면 여기 쌓여요. 유튜브 쇼츠는 맥북 떡상_수집.py(API 키 필요).' : '열쇠를 넣으면 불러와요.'));
    else if (!list.length) grid.append(el('p', 'empty', '조건에 맞는 게 없어요. 기간·주제·최소 조회수를 풀어 보세요.'));
    else list.slice(0, 300).forEach(({ x, m }) => grid.append(card(x, m)));
    const ig = items.filter((x) => x.platform === 'insta' && winH(x) <= F.span).length, tt = items.filter((x) => x.platform === 'tt' && winH(x) <= F.span).length, xh = items.filter((x) => x.platform === 'xhs' && winH(x) <= F.span).length, yt = items.filter((x) => x.platform === 'yt' && (x.views || 0) >= YT_MIN_VIEWS && !ytJunk(x) && winH(x) <= F.span).length;
    $('#count').textContent = `${list.length}개 표시 · 기간 안 인스타 ${ig} · 유튜브 ${yt} · 틱톡 ${tt} · 레드노트 ${xh} · 캐러셀은 좋아요×200 기준 · * 는 점수에 좋아요×20`;
    setStatus(`마지막 수집 ${lastCollected ? ago(new Date(lastCollected).toISOString()) : '없음'} · 전체 ${items.length}개 · 읽은 시각 ${new Date(loadedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`);
    $('#pickCount').textContent = String(Object.keys(board.picks).length);
  }
  function renderSide() {
    const ol = $('#issueList'); ol.replaceChildren();
    $('#issueTime').textContent = issues.time ? `${issues.time} 수집` : '오늘 파일 없음';
    issues.list.forEach((it) => { const li = el('li'); li.append(it.text); if (it.src) li.append(el('span', 'econ', it.src.replace('·경제연결', ' ·'))); const b = el('button', '', '검색'); b.style.cssText = 'margin-left:6px;padding:0 8px;font-size:11px'; b.addEventListener('click', () => { $('#q').value = it.text.split(/[…\s]/)[0].replace(/[“”"]/g, '').slice(0, 6); F.q = $('#q').value; render(); }); li.append(b); ol.append(li); });
    if (!issues.list.length) ol.append(el('li', '', '뉴스수집/트렌드/<오늘>.md 가 아직 없어요(맥북 트렌드 수집 05~17시 정시).'));
    const tl = $('#thList'); tl.replaceChildren();
    if (threads && threads.keywords && threads.keywords.length) {
      $('#thTime').textContent = threads.updatedAt ? ago(threads.updatedAt) : '';
      threads.keywords.slice(0, 20).forEach((k) => { const li = el('li'); li.append(k.q, el('span', 'cnt', `${k.count24h}건`)); const top = (k.top && k.top[0]) || (k.recent && k.recent[0]); if (top && top.url) { const a = el('a', '', ' 대표 글'); a.href = top.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.title = top.text || ''; li.append(a); } tl.append(li); });
    } else { $('#thTime').textContent = ''; tl.append(el('li', '', threads && threads.error ? `스레드 API 오류: ${threads.error.slice(0, 80)}` : '아직 없어요. 스레드 앱 검수 뒤 토큰을 넣으면 맥북이 3시간마다 모아요(운영규칙 7절).')); }
    const bb = $('#boardBox'); bb.replaceChildren();
    const ws = Object.keys(board.watch); bb.append(el('div', '', `감시 계정 ${ws.length}개 · 저장 ${Object.keys(board.saved).length}개 · 기획표 담김 ${Object.keys(board.picks).length}개`));
    ws.forEach((u) => { const s = el('span', 'w', `★ @${u} ✕`); s.title = '감시 해제'; s.addEventListener('click', async () => { delete board.watch[u]; await saveBoard('감시 해제 @' + u); render(); renderSide(); }); bb.append(s); });
    if (Object.keys(board.picks).length) { const b = el('button', '', '기획표 비우기'); b.style.cssText = 'margin-top:6px;font-size:11px;padding:2px 8px'; b.addEventListener('click', async () => { board.picks = {}; await saveBoard('기획표 비움'); render(); renderSide(); }); bb.append(el('div'), b); }
  }

  // ── 상세 ────────────────────────────────────────────────
  function tile(label, val, sub) { const t = el('div', 'tile'); t.append(el('small', '', label), el('b', '', val)); if (sub) t.append(el('i', '', sub)); return t; }
  function openDetail(x) {
    current = x; const m = metrics(x);
    $('#embed').src = x.platform === 'yt' ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(x.code)}` : x.platform === 'tt' ? `https://www.tiktok.com/embed/v2/${encodeURIComponent(x.code)}` : x.platform === 'xhs' ? 'about:blank' : `https://www.instagram.com/${x.kind === 'reel' ? 'reel' : 'p'}/${encodeURIComponent(x.code)}/embed/captioned/`;
    $('#embedHint').textContent = x.platform === 'yt' ? '유튜브 공식 임베드' : x.platform === 'tt' ? '틱톡 공식 임베드' : x.platform === 'xhs' ? '레드노트는 퍼가기가 없어요 — 원본 열기로 보세요.' : '인스타 공식 임베드(퍼가기). 안 뜨면 그 계정이 퍼가기를 껐거나 비공개 — 원본 열기로.';
    $('#dPlat').textContent = `${platName(x)} ${kindLabel(x)}`;
    $('#dUser').textContent = `@${x.user || '?'}`;
    $('#dMeta').textContent = ` · ${ago(x.postedAt)} · 발견: ${x.source || '?'}${x.topic ? ` · ${x.topic}(${x.topicWord})` : ''}${x.audio ? ` · ♪ ${x.audio}` : ''}${x.duration ? ` · ${Math.round(x.duration)}초` : ''}${x.followers ? ` · 팔로워 ${short(x.followers)}` : ''}`;
    $('#dOpen').href = x.url;
    const tiles = $('#tiles'); tiles.replaceChildren();
    tiles.append(tile('조회수', x.views != null ? short(x.views) : '-', x.views == null ? '캐러셀·사진은 조회수가 안 와요' : ''),
      tile('평소 대비', m.mult != null ? `${m.mult.toFixed(1)}x` : '-', m.med ? `중앙값 ${short(m.med.med)} (${m.med.acct ? '최근 ' : ''}${m.med.n}개)` : '같은 계정 3개↑ 쌓이면 나와요'),
      tile('시간당 조회', m.vph != null ? short(m.vphRecent || m.vph) : '-', m.vphRecent ? `최근 구간 기준 · 평균 ${short(m.vph)}` : m.viewsLike ? '좋아요×20 기준' : '올린 뒤 평균'),
      tile('1천뷰당 댓글', m.cpk != null ? m.cpk.toFixed(1) : '-', ''),
      tile('좋아요', short(x.likes), ''), tile('댓글', short(x.comments), ''), tile('공유', x.shares != null ? short(x.shares) : '-', '인스타 응답에 있을 때만'),
      tile('반응률', m.likeRate != null ? `${(m.likeRate * 100).toFixed(1)}%` : '-', '좋아요÷조회'));
    const hist = (x.history || []).filter((p) => p && p.views != null);
    $('#dTrend').textContent = hist.length >= 2 ? `조회수 추이: ${hist.map((p) => `${new Date(p.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} ${short(p.views)}`).join(' → ')}` : '조회수 추이: 같은 게시물을 30분 뒤 다시 보면(재측정 2번↑) 여기 나와요.';
    $('#dCaption').textContent = x.caption || '(캡션 없음)';
    $('#dTags').textContent = (x.caption.match(/#[^\s#]+/g) || []).slice(0, 12).join(' ');
    $('#dMemo').value = board.memos[x.id] || '';
    $('#dSave').textContent = board.saved[x.id] ? '💾 저장됨 (누르면 해제)' : '💾 보드에 저장';
    $('#dPick').textContent = board.picks[x.id] ? '📄 기획표에 담김 (누르면 빼기)' : '📄 기획표에 담기';
    $('#dWatch').textContent = board.watch[x.user] ? '★ 감시 중 (누르면 해제)' : '☆ 이 계정 감시';
    $('#detail').showModal();
  }
  function closeDetail() { $('#detail').close(); $('#embed').src = 'about:blank'; }
  async function saveBoard(msg) {
    try { board = await updateJson(`${CFG.dir}/보드.json`, (d) => ({ ...d, saved: { ...(d.saved || {}), ...board.saved }, watch: { ...board.watch }, picks: { ...board.picks }, memos: { ...(d.memos || {}), ...board.memos }, updatedAt: isoLocal(new Date()) }), `레이더 보드: ${msg}`); if (board && !board.saved) board = { saved: {}, watch: {}, picks: {}, memos: {}, ...board }; }
    catch (e) { toast(`보드 저장 실패: ${e.message || e}`); }
  }
  async function pushToScriptStack(x) {   // 소원저장소 '대본 스택'(아이디어뇌/대본스택/스택.json)에 대기 항목으로 넣는다 → 맥북이 받아쓰기·정리·학습
    const now = new Date(); const m = metrics(x);
    try {
      let dup = false;
      await updateJson(`${CFG.stackDir.replace('스택', '대본스택')}/스택.json`, (d) => {
        const entries = Array.isArray(d.entries) ? d.entries : [];
        if (entries.some((e) => e.code === x.code || e.url === x.url)) { dup = true; return d; }
        entries.push({ id: makeId(now), at: isoLocal(now), url: x.url, code: x.code, memo: board.memos[x.id] || `레이더 저장 · ${x.platform === 'yt' ? '유튜브' : x.platform === 'tt' ? '틱톡' : '인스타'} @${x.user} · 조회 ${short(x.views)} · ${m.mult ? m.mult.toFixed(1) + '배 · ' : ''}점수 ${m.score}`,
          status: '대기', error: '', from: '레이더', video: x.video || '', caption: (x.caption || '').slice(0, 1500), user: x.user, views: x.views, likes: x.likes, comments: x.comments, postedAt: x.postedAt, topic: x.topic || '' });
        return { ...d, entries };
      }, `레이더 저장 → 대본 스택 @${x.user}`);
      toast(dup ? '보드에 저장 (대본 스택엔 이미 있어요)' : '보드에 저장 + 대본 스택에 넣었어요 → 맥북이 받아쓰기·대본 정리·문장틀 학습을 이어서 해요');
    } catch (e) { toast(`보드엔 저장, 대본 스택 넣기 실패: ${e.message || e}`); }
  }
  function refText(x, m) {
    const plat = x.platform === 'yt' ? '유튜브 쇼츠' : `인스타 ${kindLabel(x)}`;
    return [`📡 떡상 레이더 레퍼런스 — ${plat} @${x.user || '?'} (조회 ${short(x.views)} · 좋아요 ${short(x.likes)} · 댓글 ${short(x.comments)} · ${m.vph ? `${short(m.vphRecent || m.vph)}/h · ` : ''}${m.mult ? `평소 대비 ${m.mult.toFixed(1)}x · ` : ''}점수 ${m.score} · ${ago(x.postedAt)})`,
      x.caption ? `글: ${x.caption.slice(0, 500)}` : '', `링크: ${x.url}`, board.memos[x.id] ? `메모: ${board.memos[x.id]}` : '',
      '이 게시물이 왜 반응을 얻었는지(후킹·공감 포인트·구조)만 참고해서 내 주제(2030 재테크·신혼)로 다시 만든다. 문장·영상 클립은 베끼지 않는다.'].filter(Boolean).join('\n');
  }
  function promptText(x, m) {
    return `아래는 지난 ${Math.round(m.h)}시간 안에 반응이 큰 ${x.platform === 'yt' ? '유튜브 쇼츠' : `인스타 ${kindLabel(x)}`} 레퍼런스예요. 베끼지 말고 분석만 해 주세요.\n\n[레퍼런스]\n계정 @${x.user} · 조회 ${short(x.views)} · 좋아요 ${short(x.likes)} · 댓글 ${short(x.comments)} · 시간당 ${short(m.vphRecent || m.vph)} · 1천뷰당 댓글 ${m.cpk != null ? m.cpk.toFixed(1) : '-'} · 올린 지 ${ago(x.postedAt)}\n링크 ${x.url}\n캡션:\n${x.caption}\n\n[부탁]\n1. 훅(첫 3초·첫 줄)이 무엇이고 왜 멈추게 하는지 한 줄\n2. 구조(문제→전환→정보→CTA 등) 칸 나누기\n3. 소구점(어떤 불안·이득·궁금증을 건드리나) 하나로\n4. 댓글이 많다면 어떤 논쟁·질문이 붙었을지 추정\n5. 내 채널(2030 초보 재테크·신혼부부, 요체, 정답은 숨기고 범주로) 버전 아이디어 3개 — 제목(앞 15~22자 후킹)+첫 문장+화면 구성. 남의 클립·문장은 쓰지 않고 내 화면·내 해설로.\n6. 이 주제가 24시간 뒤에도 유효할지(시의성) 판단`;
  }
  function planMd() {
    const picks = Object.keys(board.picks).map((id) => items.find((x) => x.id === id)).filter(Boolean).map((x) => ({ x, m: metrics(x) })).sort((a, b) => b.m.score - a.m.score);
    const now = new Date(); const day = kstDay(now);
    const row = ({ x, m }, i) => `| ${i + 1} | ${x.platform === 'yt' ? '유튜브' : '인스타'} ${kindLabel(x)} | @${x.user} | ${short(x.views)} | ${short(m.vphRecent || m.vph)}/h | ${short(x.likes)} | ${short(x.comments)} | ${m.mult ? m.mult.toFixed(1) + 'x' : '-'} | ${m.score} | ${x.topic || OUT} | ${ago(x.postedAt)} | ${x.url} |`;
    const body = picks.map(({ x, m }, i) => `### ${i + 1}. @${x.user} — ${(x.title || x.caption || '').split('\n')[0].slice(0, 50)}\n- 링크: ${x.url}\n- 숫자: 조회 ${short(x.views)} · 좋아요 ${short(x.likes)} · 댓글 ${short(x.comments)} · ${short(m.vphRecent || m.vph)}/h · 1천뷰당 댓글 ${m.cpk != null ? m.cpk.toFixed(1) : '-'} · 점수 ${m.score}\n- 발견: ${x.source || '?'} · 주제: ${x.topic || OUT}${x.audio ? ` · ♪ ${x.audio}` : ''}\n- 캡션 첫 줄(훅 추정): ${(x.caption || '').split('\n')[0].slice(0, 120)}\n- 메모: ${board.memos[x.id] || '(없음)'}\n- 내 버전 아이디어: (클로드가 채움)\n`).join('\n');
    return `# 떡상 탑리스트 기획표 ${day} ${pad(now.getHours())}:${pad(now.getMinutes())}\n\n떡상 레이더에서 담은 ${picks.length}개. 규칙(신혼테크/떡상레이더_운영규칙_2026-11-03.md 5절): 남의 클립을 이어 붙이지 않는다. 한 편 = 내 해설이 주, 레퍼는 '이런 반응이 있었다'는 작은 캡처+출처(@계정) 한 컷, 순위마다 내 한 줄 판정. 숫자는 이 표의 것만 쓴다.\n\n| # | 종류 | 계정 | 조회 | 시간당 | 좋아요 | 댓글 | 배수 | 점수 | 주제 | 올린 지 | 링크 |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n${picks.map(row).join('\n')}\n\n## 편마다\n\n${body}\n## 영상으로 만들 때\n- 형식: 쇼츠 45~60초 '오늘 2030이 가장 많이 본 돈 얘기 TOP${Math.min(5, picks.length)}' — 순위는 쑤욱 훑고(쪽마다 한 문장, 1위만 이유) 마지막에 내 한 마디.\n- 화면: 내 얼굴 또는 내 카드, 레퍼는 흐림 처리한 작은 캡처 + @계정 글자. 워터마크 있는 영상·남의 클립 금지.\n- 캡션: 출처 계정 전부 @멘션, '정보 제공·투자 권유 아님'.\n- 캐러셀판: 표지 1장(제목만) + 순위 1장씩 + 마지막 내 판정 카드.\n`;
  }

  // ── 토스트·설정 ─────────────────────────────────────────
  let toastT = 0;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2800); }
  function openSetup() { $('#tokenIn').value = token; $('#setupMsg').textContent = ''; $('#setup').showModal(); }

  // ── 이벤트 ──────────────────────────────────────────────
  function bind() {
    $('#srcSeg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; F.src = b.dataset.v; LS.set('radar.src', F.src); render(); });
    $('#regSeg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; F.region = b.dataset.v; LS.set('radar.region', F.region); render(); });
    $('#spanSeg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; F.span = Number(b.dataset.v); LS.set('radar.span72', F.span); if (F.span >= 168) loadAll(true); else render(); });
    $('#sort').addEventListener('change', (e) => { F.sort = e.target.value; LS.set('radar.sort', F.sort); render(); });
    $('#minMult').addEventListener('change', (e) => { F.minMult = Number(e.target.value); LS.set('radar.minMult', F.minMult); render(); });
    $('#minViews').addEventListener('change', (e) => { F.minViews = Number(e.target.value); LS.set('radar.minViews7', F.minViews); render(); });
    let qt = 0; $('#q').addEventListener('input', (e) => { clearTimeout(qt); qt = setTimeout(() => { F.q = e.target.value; render(); }, 200); });
    $('#onlyWatch').addEventListener('change', (e) => { F.onlyWatch = e.target.checked; render(); });
    $('#onlySaved').addEventListener('change', (e) => { F.onlySaved = e.target.checked; render(); });
    $('#refresh').addEventListener('click', () => loadAll(true));
    $('#setupBtn').addEventListener('click', openSetup);
    $('#tokenSave').addEventListener('click', async (e) => {
      e.preventDefault(); const t = okTok($('#tokenIn').value);
      if (!t) { $('#setupMsg').textContent = '열쇠 모양이 아니에요 (ghp_… / github_pat_…)'; return; }
      token = t; LS.set('radar.token', t); $('#setupMsg').textContent = '저장했어요. 연결 확인 중…';   // 먼저 저장(확인이 실패해도 다시 묻지 않게)
      try { await gh(repo()); $('#setupMsg').textContent = '✔ 연결됐어요'; $('#setup').close(); loadAll(true); }
      catch (err) { $('#setupMsg').textContent = err.status === 404 ? '⚠ 열쇠는 저장했는데 newlywed_tech 저장소가 안 보여요. 열쇠 만들 때 repo 칸에 체크했는지 확인해 주세요' : err.status === 401 ? '⚠ 열쇠가 틀렸어요. ghp_로 시작하는 글자 전체를 다시 붙여넣어 주세요' : `⚠ ${err.message || err}`; }
    });
    $('#dClose').addEventListener('click', closeDetail);
    $('#detail').addEventListener('click', (e) => { if (e.target === $('#detail')) closeDetail(); });
    $('#detail').addEventListener('close', () => { $('#embed').src = 'about:blank'; });
    $('#dCopy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(current.url); toast('링크를 복사했어요'); } catch { window.prompt('복사하세요', current.url); } });
    $('#dMemo').addEventListener('change', async () => { if (!current) return; const v = $('#dMemo').value.trim(); if (v) board.memos[current.id] = v; else delete board.memos[current.id]; await saveBoard('메모'); toast('메모 저장'); });
    $('#dSave').addEventListener('click', async () => {
      if (!current) return; const x = current;
      if (board.saved[x.id]) { delete board.saved[x.id]; await saveBoard('저장 해제'); $('#dSave').textContent = '💾 보드에 저장'; render(); renderSide(); return; }
      board.saved[x.id] = isoLocal(new Date()); await saveBoard('저장'); $('#dSave').textContent = '💾 저장됨 (누르면 해제)'; render(); renderSide();
      if (x.platform === 'insta' || x.platform === 'yt' || x.platform === 'tt') await pushToScriptStack(x);   // 11/3 사용자: 저장 = 레퍼로 바로(받아쓰기→대본 정리→문장틀·소구점 학습)
    });
    $('#dPick').addEventListener('click', async () => { if (!current) return; if (board.picks[current.id]) delete board.picks[current.id]; else board.picks[current.id] = isoLocal(new Date()); await saveBoard('기획표'); $('#dPick').textContent = board.picks[current.id] ? '📄 기획표에 담김 (누르면 빼기)' : '📄 기획표에 담기'; render(); renderSide(); });
    $('#dWatch').addEventListener('click', async () => { if (!current || !current.user) return; if (board.watch[current.user]) delete board.watch[current.user]; else board.watch[current.user] = isoLocal(new Date()); await saveBoard('감시 계정'); $('#dWatch').textContent = board.watch[current.user] ? '★ 감시 중 (누르면 해제)' : '☆ 이 계정 감시'; render(); renderSide(); });
    $('#dPrompt').addEventListener('click', async () => { if (!current) return; const t = promptText(current, metrics(current)); try { await navigator.clipboard.writeText(t); toast('분석 프롬프트를 복사했어요 → 클로드에 붙여넣기'); } catch { window.prompt('복사하세요', t); } });
    $('#dScript').addEventListener('click', async () => {
      if (!current) return; const x = current, m = metrics(x); const now = new Date(); const month = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
      try {
        await updateJson(`${CFG.stackDir}/${month}.json`, (d) => { const entries = Array.isArray(d.entries) ? d.entries : []; entries.push({ id: makeId(now), at: isoLocal(now), kind: '대본', text: refText(x, m), used: [] }); return { ...d, entries }; }, `레이더 → 대본 레퍼런스 @${x.user}`);
        toast('소원저장소 대본 스택에 넣었어요(레퍼런스 메모)');
      } catch (e) { toast(`넣기 실패: ${e.message || e}`); }
    });
    $('#exportBtn').addEventListener('click', async () => {
      const n = Object.keys(board.picks).length; if (!n) { toast('상세에서 📄 기획표에 담기를 먼저 눌러요'); return; }
      const now = new Date(); const path = `${CFG.planDir}/${kstDay(now)}/떡상탑리스트_${pad(now.getHours())}${pad(now.getMinutes())}.md`;
      try { await writeFile(path, planMd(), null, `떡상 탑리스트 기획표 ${n}개`); toast(`내보냈어요: ${path}`); }
      catch (e) { toast(`내보내기 실패: ${e.message || e}`); }
    });
  }

  token = findToken();
  bind();
  loadAll(true);
  setInterval(() => { if (!document.hidden) loadAll(false); }, 5 * 60e3);
})();
