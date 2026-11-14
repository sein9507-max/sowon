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
  const BEAUTY = ['뷰티'], MONEY = ['지원금·정책', '주식·코인', '부동산·청약', '재테크·저축', '부업·수익', '직장·월급', '자기계발·AI'];   // 11/3 사용자 "뷰티·재테크만"
  const groupOf = (t) => (BEAUTY.includes(t) ? 'beauty' : MONEY.includes(t) ? 'money' : 'etc');
  // 11/4 사용자 규칙: 재테크는 국내 글만, 뷰티는 해외 글만. 그 밖은 '그 밖' 탭
  const fitGroup = (x) => { const g = groupOf(x.topic || ''); return (g === 'money' && x.region === '국내') || (g === 'beauty' && x.region === '해외') ? g : 'etc'; };
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

  // ── 1.14 품질(11/14 사용자 "떡상레이더 퀄리티도 더 높이고 싶고"): 전부 이미 모은 글자로만 판정한다. 수집 동작은 그대로 ──
  // 광고·홍보: 유료 광고 표시, 업체 매물·상담 글, 기관·방송 계정. 기본은 숨기고 '광고·홍보도 보기'로 연다
  const AD_RE = /(^\s*|#|\[|\()(유료\s?광고|광고|협찬|ad)(?=[\]\s)·:,.!]|$)|유료\s?광고|제작\s?지원|제품을?\s?제공\s?받|원고료|#sponsored|\bsponsored\b|paid partnership|#gifted|#partner\b|\bpartner\.|discount code|use (my )?code|shop now|공동구매|공구\s?(오픈|진행|마감)|할인\s?코드|체험단/i;
  const BIZ_RE = /문의는?\s?(DM|디엠|📞|전화)|소재지\s?:|분양\s?(문의|상담|홍보관)|모델하우스|상담\s?(문의|예약)|매물\s?(문의|다수)|다수 보유/i;
  const GOV_USER_RE = /city$|^gov[._]|[._]gov$/i, GOV_CAP_RE = /주무관|[가-힣]{2,4}(시|군)청[\s,.]|행정안전부|행안부/;
  const NEWS_USER_RE = /(^|[._])news([._]|$)|news_official|^(mbc|kbs|sbs|jtbc|ytn)/i;
  const BRAND_USER_RE = /(^|[._])official($|[._])|cosmetics|_global$/i, FIN_BRAND_RE = /(^|[._])etf([._]|$)/i;
  function noiseOf(x) {
    const cap = x.caption || '', u = x.user || '';
    if (AD_RE.test(cap)) return { type: 'ad', label: '광고' };
    if (BIZ_RE.test(cap)) return { type: 'biz', label: '업체 홍보' };
    if (GOV_USER_RE.test(u) || GOV_CAP_RE.test(cap)) return { type: 'gov', label: '기관 홍보' };
    if (NEWS_USER_RE.test(u)) return { type: 'news', label: '방송·뉴스' };
    if ((BRAND_USER_RE.test(u) && x.region === '해외') || FIN_BRAND_RE.test(u) || /자산운용/.test(cap)) return { type: 'brand', label: '브랜드 계정' };
    return null;
  }
  // 말로만 풀 수 있는 주제(11/14 주제 기준): 국내 재테크 묶음 + 정보·방법 낱말이 있고, 브이로그·현장·제품 시연이 아닌 글
  const TALK_NO_RE = /브이로그|vlog|워홀|언박싱|하울|맛집|여행|임장\s?(후기|다녀)|사무실을? 옮|촬영|ootd|출근룩|내돈내산|grwm/i;
  const TALK_YES_RE = /방법|가지|정리|비교|차이|이유|신청|조건|혜택|금리|이자|통장|적금|지원금|장학금|환급|절세|세금|연말정산|ETF|주식|투자|대출|청약|전세|월세|연봉|월급|저축|모으|습관|꿀팁|TOP|BEST|하는 법|알려|챙기|놓치|마감|\?/i;
  const talkOf = (x) => fitGroup(x) === 'money' && !noiseOf(x) && !TALK_NO_RE.test(x.caption || '') && TALK_YES_RE.test(x.caption || '');
  // 후킹 첫 문장: 대본 스택에 받아쓰기가 있으면 그 첫 문장, 없으면 캡션 첫 문장(해시태그·"(저장/공유)"·"81 likes, 2 comments -" 같은 자동 글은 뺀다). 없으면 빈칸
  let stackByCode = new Map(), stackAt = 0;
  const firstSentence = (t, n = 64) => { const one = String(t || '').split(/\n|(?<=[.?!…])\s+|(?<=[요죠다]\s?[!?]{1,3})\s/).map((v) => v.trim()).find((v) => v.replace(/[^가-힣a-zA-Z0-9]/g, '').length >= 4) || ''; return one.length > n ? one.slice(0, n - 1) + '…' : one; };
  function hookOf(x) {
    const st = stackByCode.get(x.code);
    if (st && st.transcript) return { text: firstSentence(st.transcript), from: '받아쓰기' };
    let c = String(x.title || x.caption || '');
    if (/^\s*[\d,.]+[KkMm만천]?\s*likes?,/i.test(c) || /^웹 검색결과/.test(c)) return { text: '', from: '' };
    c = c.replace(/^\s*[(\[（][^)\]）]{0,24}[)\]）]\s*/, '').replace(/^(#\S+\s*)+/, '').replace(/^[^가-힣a-zA-Z0-9"'“‘]+/, '');
    const t = firstSentence(c);
    return t && !/^#/.test(t) ? { text: t, from: '캡션' } : { text: '', from: '' };
  }
  // 구조 요약: 캡션에서 읽히는 장치만 규칙으로(대본 스택에 정리본이 있으면 그 구조·후킹 유형을 앞에)
  function structOf(x) {
    const st = stackByCode.get(x.code), cap = x.caption || '', hk = hookOf(x).text, out = [];
    if (st && st.structure) out.push(st.structure); if (st && st.hookType) out.push(`후킹: ${st.hookType}`);
    const n = cap.match(/(\d{1,2})\s*(가지|개|곳|선|위|단계)\b|(?:BEST|TOP|베스트)\s*(\d{1,2})/i);
    if (/(2030|20대|30대|청년|직장인|사회초년생|신혼|자취|1인\s?가구|초보)(이라면|이면|들|은|는|라면|분들)?/.test(hk)) out.push('대상 지목');
    if (/[?？]|까요|나요|일까|아세요|있나요/.test(hk)) out.push('질문 후킹');
    if (/모르면|놓치|손해|하지\s?마|절대|주의|안\s?하면|날리|위험|사기/.test(hk + ' ' + cap.slice(0, 120))) out.push('손실·경고');
    if (n) out.push(`나열 ${n[1] || n[3]}${n[2] || '위'}`);
    if (/\bvs\b|비교|차이/i.test(cap)) out.push('비교');
    if (/\d[\d,.]*\s?(만\s?원|억|%|배)/.test(cap.slice(0, 200))) out.push('숫자 베네핏');
    if (/마감|까지만|오늘까지|이번\s?달|말까지|서두르/.test(cap)) out.push('마감 FOMO');
    if (/댓글.{0,14}(남기|달|적|주시)|DM으로|디엠으로|comment .{1,12} (to|for)/i.test(cap)) out.push('댓글 CTA→자료');
    else if (/저장|공유|팔로우/.test(cap)) out.push('저장·팔로우 CTA');
    return [...new Set(out)].slice(0, 5);
  }
  const dupKey = (x) => { const k = String(x.caption || '').toLowerCase().replace(/[^가-힣a-z0-9]/g, '').slice(0, 60); return k.length >= 25 ? k : ''; };

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
  let items = [], issues = { time: '', list: [] }, threads = null, topicQ = null, collect = null, board = { saved: {}, watch: {}, picks: {}, memos: {} }, boardSha = null;
  let loadedAt = 0, lastCollected = 0, loading = false;
  // 기본값: 3일 안 · 뷰티+재테크(그 밖은 탭) · 최소 조회수 1만 · 떡상점수 정렬. 10만↑은 칸에서 고른다
  const F = { src: LS.get('radar.src', 'all'), span: Number(LS.get('radar.span72', 72)), region: LS.get('radar.region', 'all'), sort: LS.get('radar.sort', 'score'), minViews: Number(LS.get('radar.minViews7', 10000)), minMult: Number(LS.get('radar.minMult', 0)), q: '', group: LS.get('radar.group', 'all'), topic: LS.get('radar.topic2', ''), onlyWatch: false, onlySaved: false, onlyTalk: !!LS.get('radar.onlyTalk', false), onlyHot: !!LS.get('radar.onlyHot', false), showAds: !!LS.get('radar.showAds', false) };
  let hiddenNoise = 0, mergedDup = 0;
  let current = null;

  // ── 불러오기 ────────────────────────────────────────────
  function normInsta(x) {
    const kind = x.kind === 'carousel' ? 'carousel' : x.kind === 'reel' ? 'reel' : x.kind === 'image' ? 'image' : (x.url || '').includes('/reel/') ? 'reel' : 'image';
    const t = x.topicBy === 'ai' ? { topic: x.topic || '', word: x.topicWord || '' } : x.topic ? { topic: x.topic, word: x.topicWord || '' } : topicOf(`${x.user} ${x.caption}`);   // 클로드 판정('' = 주제 밖)은 단어 규칙으로 덮지 않는다
    return { windowAt: x.windowAt || null, id: `ig:${x.code}`, code: x.code, platform: 'insta', region: x.region || (/[가-힣]/.test(`${x.caption || ''}`) ? '국내' : '해외'), kind, url: x.url || `https://www.instagram.com/${kind === 'reel' ? 'reel' : 'p'}/${x.code}/`, user: x.user || '', caption: x.caption || '', views: x.views ?? null, likes: x.likes ?? null, comments: x.comments ?? null, shares: x.shares ?? null,
      postedAt: x.postedAt || x.capturedAt, capturedAt: x.capturedAt, seenAt: x.seenAt || x.capturedAt, thumb: x.thumb || '', carouselCount: x.carouselCount || null, audio: x.audio || '', duration: x.duration || null, followers: x.followers ?? null, video: x.video || '', medianViews: x.medianViews || null, medianN: x.medianN || null, pinned: !!x.pinned, postedApprox: !!x.postedApprox, topic: t.topic, topicWord: t.word, source: x.source || x.how || '', history: Array.isArray(x.history) ? x.history : [] };
  }
  function normYt(x) {
    const t = x.topicBy === 'ai' ? { topic: x.topic || '', word: x.topicWord || '' } : x.topic ? { topic: x.topic, word: x.topicWord || '' } : topicOf(`${x.title} ${x.caption}`);
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
      const [igs, yts, ths, bd, tq, cs, trendToday, trendYday, igx, tts, xhs] = await Promise.all([
        Promise.all(igDays.map((d) => readJson(`${CFG.dir}/일별/${d}.json`).catch(() => null))),
        Promise.all(ytDays.map((d) => readJson(`${CFG.dir}/유튜브/${d}.json`).catch(() => null))),
        Promise.all(thDays.map((d) => readJson(`${CFG.dir}/스레드/${d}.json`).catch(() => null))),
        readJson(`${CFG.dir}/보드.json`).catch(() => null),
        readJson(`${CFG.dir}/주제검색어.json`).catch(() => null),
        readJson(`${CFG.dir}/수집상태.json`).catch(() => null),
        readFile(`${CFG.trendDir}/${kstDay(new Date())}.md`).catch(() => null),
        readFile(`${CFG.trendDir}/${kstDay(new Date(Date.now() - 864e5))}.md`).catch(() => null),
        Promise.all(extDays.map((d) => readJson(`${CFG.dir}/인스타/${d}.json`).catch(() => null))),
        Promise.all(extDays.map((d) => readJson(`${CFG.dir}/틱톡/${d}.json`).catch(() => null))),
        Promise.all(extDays.map((d) => readJson(`${CFG.dir}/레드노트/${d}.json`).catch(() => null))),
      ]);
      const byId = new Map(); lastCollected = 0;
      igs.filter(Boolean).forEach((f) => (f.data.entries || []).forEach((x) => { const it = normInsta(x); byId.set(it.id, it); lastCollected = Math.max(lastCollected, new Date(it.seenAt || it.capturedAt).getTime() || 0); }));
      yts.filter(Boolean).forEach((f) => (f.data.entries || []).forEach((x) => { const it = normYt(x); if (!byId.has(it.id) || new Date(it.seenAt) > new Date(byId.get(it.id).seenAt)) byId.set(it.id, it); lastCollected = Math.max(lastCollected, new Date(it.seenAt || it.capturedAt).getTime() || 0); }));
      // 같은 글이 여러 날 파일에 있으면 최신 기록을 쓰되, 최신 기록에 빠진 숫자(조회수·중앙값·팔로워)는 옛 기록에서 채운다(11/5 Apify 가 조회수를 안 주기 시작해 73만 글이 좋아요만 남던 것)
      const fillNum = (a, b) => ({ ...a, views: a.views ?? b.views, likes: a.likes ?? b.likes, comments: a.comments ?? b.comments, shares: a.shares ?? b.shares, medianViews: a.medianViews || b.medianViews, medianN: a.medianN || b.medianN, followers: a.followers ?? b.followers, thumb: a.thumb || b.thumb, video: a.video || b.video, history: (a.history || []).length >= (b.history || []).length ? a.history : b.history });
      const addAll = (files, norm) => files.filter(Boolean).forEach((f) => (f.data.entries || []).forEach((x) => { const it = norm(x); const old = byId.get(it.id); const newer = !old || new Date(it.seenAt) > new Date(old.seenAt); const m = !old ? it : newer ? fillNum(it, old) : fillNum(old, it); byId.set(it.id, { ...m, windowAt: it.windowAt && old && old.windowAt && old.windowAt > it.windowAt ? old.windowAt : (m.windowAt || it.windowAt) }); lastCollected = Math.max(lastCollected, new Date(it.seenAt || it.capturedAt).getTime() || 0); }));
      addAll(igx, normInsta);
      addAll(tts, (x) => ({ ...normInsta(x), id: `tt:${x.code}`, platform: 'tt', kind: 'tiktok', url: x.url, windowAt: x.windowAt }));
      addAll(xhs, (x) => ({ ...normInsta(x), id: `xhs:${x.code}`, platform: 'xhs', kind: x.kind, url: x.url, title: x.title || '', windowAt: x.windowAt }));
      items = [...byId.values()].filter((x) => x.postedAt);
      threads = ths.find((f) => f && f.data && Array.isArray(f.data.keywords)) ? ths.find((f) => f && f.data && Array.isArray(f.data.keywords)).data : null;
      topicQ = tq && !tq.broken ? tq.data : null;
      collect = cs && !cs.broken ? cs.data : null;
      if (bd && !bd.broken) { board = { saved: {}, watch: {}, picks: {}, memos: {}, ...bd.data }; boardSha = bd.sha; } else { boardSha = bd ? bd.sha : null; }
      issues = trendToday ? parseIssues(trendToday.text) : trendYday ? parseIssues(trendYday.text) : { time: '', list: [] };
      if (trendToday && !issues.list.length && trendYday) issues = parseIssues(trendYday.text);
      loadedAt = Date.now();
      computeMedians();
      if (Date.now() - stackAt > 30 * 60e3) loadStack();
    } catch (e) { toast(`불러오기 실패: ${e.message || e}`); if (e.status === 401) openSetup(); }
    finally { loading = false; render(); renderSide(); }
  }

  async function loadStack() {   // 대본 스택에 받아쓰기·정리본이 있는 레퍼(카드의 🎣 첫 문장·구조, 대본 뽑기 재료)
    stackAt = Date.now();
    try {
      const f = await readJson(`${CFG.stackDir.replace('스택', '대본스택')}/스택.json`); if (!f || f.broken) return;
      const mp = new Map();
      (f.data.entries || []).forEach((e) => { let c = e.code || ''; if (!c) { const m = String(e.url || '').match(/\/(?:reel|reels|p|shorts)\/([\w-]+)|[?&]v=([\w-]+)|\/video\/(\d+)/); c = m ? (m[1] || m[2] || m[3]) : ''; } if (c && (e.transcript || '').trim()) mp.set(c, { transcript: e.transcript, structure: (e.script && e.script.structure) || '', hookType: (e.script && e.script.hookType) || '' }); });
      stackByCode = mp; render();
    } catch { /* 스택이 없어도 레이더는 돈다 */ }
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
    const fmult = x.followers && x.views != null ? x.views / Math.max(1, x.followers) : null;   // 팔로워 대비 조회 배수(1.14)
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    // 떡상점수 1.14: '그 계정 평소보다, 팔로워 수보다 얼마나 더 퍼졌나'와 '얼마나 빨리'가 먼저고 절대 조회수는 뒤로(큰 계정의 평범한 글이 위로 오던 것).
    // 평소 대비 배수 30 + 팔로워 대비 배수 20 + 시간당 속도 20 + 조회수 15 + 1천뷰당 댓글 10 + 신선도 5
    let sM = mult != null ? clamp(Math.log2(mult + 1) / Math.log2(33) * 30, 0, 30) : null;               // 1배 6 · 3배 12 · 7배 18 · 15배 24 · 32배↑ 30
    let sF = fmult != null ? clamp(Math.log10(fmult / 0.1) / Math.log10(100) * 20, 0, 20) : null;         // 팔로워의 0.1배 0 · 1배 10 · 3배 15 · 10배↑ 20
    if (sM == null && sF != null) sM = sF / 20 * 30; if (sF == null && sM != null) sF = sM / 30 * 20;      // 한쪽만 있으면 같은 비율로 메운다
    const sp = vphRecent != null ? Math.max(vphRecent, vph || 0) : vph;                                   // 재측정이 있으면 최근 구간 속도
    const sV = sp != null ? clamp(Math.log10(sp + 1) / Math.log10(30001) * 20, 0, 20) : 0;               // 300/h 11 · 3천/h 16 · 3만/h 만점
    const sA = views != null ? clamp(Math.log10(Math.max(1, views) / 1000) / 4 * 15, 0, 15) : 0;          // 1만 4 · 10만 8 · 100만 11 · 1000만 15
    const sC = cpk != null ? clamp(cpk / 20 * 10, 0, 10) : 0;                                            // 1천뷰당 댓글 20개 만점
    const sN = h <= 24 ? 5 : h <= 48 ? 3 : 0;
    const hot = x.views != null && x.views >= 10000 && ((mult != null && mult >= 3) || (fmult != null && fmult >= 2));   // 🔥 떡상 = 평소의 3배↑ 또는 팔로워의 2배↑
    const fast = h <= 48 && sp != null && sp >= 3000;                                                    // ⚡ 올린 지 이틀 안에 시간당 3천↑
    return { h, vph, vphRecent, cpk, likeRate, mult, fmult, med: m, hot, fast, score: Math.round((sM || 0) + (sF || 0) + sV + sA + sC + sN), parts: { 배수: sM, 팔로워: sF, 속도: sV, 조회: sA, 댓글: sC, 신선: sN }, viewsLike: x.views == null && x.likes != null };
  }

  // ── 거르기·정렬 ─────────────────────────────────────────
  // 주제 줄 숫자와 격자가 같은 조건을 쓰도록(11/5 사용자 "전체 17인데 0개 표시"): 주제·세부 주제·최소 배수만 빼고 전부 여기서 거른다
  function passBase(x, withNoise) {
    const q = F.q.trim().toLowerCase();
    if (!withNoise && !F.showAds && !F.onlySaved && noiseOf(x)) return false;   // 광고·홍보는 기본으로 숨긴다(주제 줄 숫자도 같이). 저장한 것만 볼 땐 그대로
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
    if (F.onlyWatch && !board.watch[x.user]) return false;
    if (F.onlySaved && !board.saved[x.id]) return false;
    if (q && !`${x.user} ${x.caption}`.toLowerCase().includes(q)) return false;
    if (F.onlyTalk && !talkOf(x)) return false;
    return true;
  }
  const viewsOrProxy = (x) => (x.views != null ? x.views : (x.likes || 0) * 200);   // 조회수 없는 캐러셀·사진·릴스는 좋아요×200(좋아요 50 ≈ 1만 급)
  const passViews = (x) => !F.minViews || viewsOrProxy(x) >= F.minViews;
  function filtered() {
    mergedDup = 0;
    const inTab = (x) => { const g = fitGroup(x); if (F.group === 'all' ? g === 'etc' : g !== F.group) return false; return !(F.group === 'money' && F.topic && x.topic !== F.topic); };   // 전체 = 국내 재테크 + 해외 뷰티, 그 밖은 탭
    hiddenNoise = F.showAds || F.onlySaved ? 0 : items.filter((x) => noiseOf(x) && passBase(x, true) && passViews(x) && inTab(x)).length;
    let list = items.filter((x) => passBase(x) && passViews(x) && inTab(x)).map((x) => ({ x, m: metrics(x) })).filter((r) => (!F.minMult || (r.m.mult || 0) >= F.minMult) && (!F.onlyHot || r.m.hot));
    const key = { score: (r) => r.m.score, views: (r) => r.x.views || 0, vph: (r) => r.m.vphRecent || r.m.vph || 0, mult: (r) => r.m.mult || 0, fmult: (r) => r.m.fmult || 0, comments: (r) => r.x.comments || 0, likes: (r) => r.x.likes || 0, new: (r) => new Date(r.x.postedAt).getTime() }[F.sort] || ((r) => r.m.score);
    list.sort((a, b) => key(b) - key(a));
    // 같은 글(재업로드·같은 캡션 복사)은 맨 위 것 하나로 묶는다
    const seen = new Map(), out = [];
    list.forEach((r) => { const k = dupKey(r.x); const rep = k && seen.get(k); if (rep) { (rep.dups || (rep.dups = [])).push(r); mergedDup++; return; } if (k) seen.set(k, r); r.dups = null; out.push(r); });
    return out;
  }

  // ── 그리기 ──────────────────────────────────────────────
  function setStatus(t) { $('#status').textContent = t; }
  function renderTopics() {
    const row = $('#topicRow'); row.replaceChildren();
    const within = items.filter((x) => passBase(x) && passViews(x));
    const cnt = (f) => within.filter(f).length;
    const mk = (label, on, n, fn) => { const b = el('button', on ? 'on' : ''); b.append(label, el('small', '', String(n))); b.addEventListener('click', fn); return b; };
    const setG = (g) => { F.group = g; F.topic = ''; LS.set('radar.group', g); LS.set('radar.topic2', ''); render(); };
    row.append(mk('전체', F.group === 'all', cnt((x) => fitGroup(x) !== 'etc'), () => setG('all')));
    row.append(mk('💄 뷰티(해외)', F.group === 'beauty', cnt((x) => fitGroup(x) === 'beauty'), () => setG('beauty')));
    row.append(mk('💰 재테크(국내)', F.group === 'money', cnt((x) => fitGroup(x) === 'money'), () => setG('money')));
    if (F.group === 'money') {
      const sep = el('span', 'muted', '│'); row.append(sep);
      MONEY.forEach((t) => row.append(mk(t, F.topic === t, cnt((x) => x.topic === t && x.region === '국내'), () => { F.topic = F.topic === t ? '' : t; LS.set('radar.topic2', F.topic); render(); })));
    }
    row.append(mk('🗂 그 밖', F.group === 'etc', cnt((x) => fitGroup(x) === 'etc'), () => setG('etc')));
  }
  function platName(x) { return { insta: '인스타', yt: '유튜브', tt: '틱톡', xhs: '레드노트' }[x.platform] || x.platform; }
  function kindLabel(x) { if (x.platform === 'tt') return '🎵 틱톡'; if (x.platform === 'xhs') return x.kind === 'video' ? '📕 영상' : '📕 노트'; return x.kind === 'carousel' ? `🖼 캐러셀${x.carouselCount ? ` ${x.carouselCount}장` : ''}` : x.kind === 'reel' ? '🎬 릴스' : x.kind === 'shorts' ? '▶ 쇼츠' : x.kind === 'video' ? '▶ 영상' : '📷 사진'; }
  function card(x, m, dups) {
    const c = el('article', 'card' + (board.picks[x.id] ? ' picked' : '') + (sel.has(x.id) ? ' selected' : ''));
    const th = el('div', 'thumb');
    const ph = el('div', 'ph', (x.title || x.caption || '').slice(0, 60) || `@${x.user}`);
    if (x.thumb) {   // 인스타 계정 글 썸네일(fbcdn.net)은 다른 사이트에서 못 불러오게 막혀 있어서(CORP) 공개 이미지 중계 wsrv.nl 을 거친다. 실패하면 원래 주소 → 글자 카드
      const img = el('img'); img.alt = ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
      const direct = x.thumb, viaProxy = x.platform === 'yt' ? direct : `https://wsrv.nl/?url=${encodeURIComponent(direct)}&w=360&q=72&output=jpg`;
      img.src = viaProxy;
      img.addEventListener('error', () => { if (img.src !== direct && viaProxy !== direct) { img.src = direct; return; } img.remove(); th.prepend(ph); });
      th.append(img);
    } else th.append(ph);
    const sb = el('button', 'selbox' + (sel.has(x.id) ? ' on' : ''), sel.has(x.id) ? '✓' : ''); sb.type = 'button'; sb.title = '대본 뽑기에 쓸 레퍼로 고르기'; sb.setAttribute('aria-label', '레퍼 선택'); sb.setAttribute('aria-pressed', String(sel.has(x.id)));
    sb.addEventListener('click', (e) => { e.stopPropagation(); toggleSel(x); });
    th.append(sb);
    th.append(el('span', 'tl', `${x.region === '해외' ? '🌎' : '🇰🇷'} ${platName(x)} · ${kindLabel(x)}`));
    const tr = el('span', 'tr' + (m.hot ? ' hot' : ''), `${m.hot ? '🔥 ' : m.fast ? '⚡ ' : ''}${m.mult != null ? `${m.mult.toFixed(1)}x` : `${m.score}점`}`); tr.title = (m.mult != null ? `평소(중앙값 ${short(m.med.med)}, ${m.med.n}개) 대비 ${m.mult.toFixed(1)}배` : '떡상점수') + (m.fmult != null ? ` · 팔로워 대비 ${m.fmult.toFixed(1)}배` : '') + (m.hot ? ' · 🔥 떡상(평소 3배↑ 또는 팔로워 2배↑)' : ''); th.append(tr);
    th.append(el('span', 'bl', x.views != null ? short(x.views) : `♥ ${short(x.likes)}`));
    th.append(el('span', 'br', `${x.postedApprox ? '약 ' : ''}${ago(x.postedAt)}`));
    const body = el('div', 'body');
    const u = el('div', 'user'); if (board.watch[x.user]) u.append(el('span', 'star', '★ ')); u.append(`@${x.user || '?'}`); if (x.followers) u.append(el('small', 'fol', ` ${short(x.followers)}`)); body.append(u);
    body.append(el('div', 'src', `${x.source || ''}${x.topic ? ` · ${x.topic}` : ` · ${OUT}`}`));
    const hk = hookOf(x);
    const hook = el('div', 'hook' + (hk.text ? '' : ' none'), hk.text ? `🎣 ${hk.text}` : '🎣 (첫 문장 없음)'); hook.title = hk.text ? `후킹 첫 문장 — ${hk.from}에서` : '캡션이 비었거나 해시태그뿐이에요'; body.append(hook);
    const chips = el('div', 'chips');
    const nz = noiseOf(x); if (nz) chips.append(el('span', 'chip bad', nz.label));
    if (talkOf(x)) chips.append(el('span', 'chip talk', '🎙 말로 가능'));
    if (stackByCode.has(x.code)) chips.append(el('span', 'chip talk', '받아쓰기 있음'));
    structOf(x).forEach((t) => chips.append(el('span', 'chip', t)));
    if (dups && dups.length) { const d = el('span', 'chip dup', `같은 글 +${dups.length}`); d.title = dups.map((r) => `@${r.x.user} ${short(r.x.views)}`).join(' · '); chips.append(d); }
    if (chips.childNodes.length) body.append(chips);
    const met = el('div', 'met');
    met.append(el('span', '', `♥ ${short(x.likes)}`), el('span', '', `💬 ${short(x.comments)}`));
    if (m.vph != null) met.append(el('span', '', `${short(m.vphRecent || m.vph)}/h${m.viewsLike ? '*' : ''}`));
    if (m.fmult != null) { const f = el('span', m.fmult >= 2 ? 'up' : '', `팔로워×${m.fmult >= 10 ? Math.round(m.fmult) : m.fmult.toFixed(1)}`); f.title = '조회수 ÷ 팔로워'; met.append(f); }
    const sc = el('span', 'score', `점수 ${m.score}`); sc.title = Object.entries(m.parts).map(([k, v]) => `${k} ${Math.round(v || 0)}`).join(' + '); met.append(sc);
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
    $('#onlyTalk').checked = F.onlyTalk; $('#onlyHot').checked = F.onlyHot; $('#showAds').checked = F.showAds;
    const list = filtered();
    const grid = $('#grid'); grid.replaceChildren();
    // 지금 보는 칸을 글로 풀어 준다(11/5 사용자 "아무것도 안 떠": 주제 줄의 💄 뷰티(해외)가 눌려 있어서 0개였는데 화면이 그걸 말해 주지 않았다)
    const GL = { all: '전체(국내 재테크 + 해외 뷰티)', beauty: '💄 뷰티(해외)', money: `💰 재테크(국내)${F.topic ? ` › ${F.topic}` : ''}`, etc: '🗂 그 밖' };
    const SL = { 24: '24시간', 48: '48시간', 72: '3일', 168: '7일' }, SRC = { all: '전체', reel: '릴스', carousel: '캐러셀', shorts: '유튜브 쇼츠', tiktok: '틱톡', xhs: '레드노트' };
    const where = `${GL[F.group] || F.group} · ${SL[F.span] || `${F.span}시간`} · ${SRC[F.src] || F.src}${F.region !== 'all' ? ` · ${F.region}` : ''} · 조회 ${short(F.minViews)}↑${F.minMult ? ` · ${F.minMult}배↑` : ''}${F.q.trim() ? ` · "${F.q.trim()}"` : ''}${F.onlyWatch ? ' · ★ 감시 계정만' : ''}${F.onlySaved ? ' · 💾 저장한 것만' : ''}${F.onlyTalk ? ' · 🎙 말로 풀 수 있는 것만' : ''}${F.onlyHot ? ' · 🔥 떡상만' : ''}`;
    const inGroup = (x) => { const g = fitGroup(x); return F.group === 'all' ? g !== 'etc' : g === F.group && !(F.group === 'money' && F.topic && x.topic !== F.topic); };
    if (!items.length) grid.append(el('p', 'empty', loading ? '읽는 중…' : token ? '아직 쌓인 게 없어요. 맥북 수집기(Aside·유튜브)가 07·10·13·16·19·22시 20분에 쌓아요. 옆 칸 📡 수집 현황을 보세요.' : '열쇠를 넣으면 불러와요.'));
    else if (!list.length) {
      const held = items.filter((x) => passBase(x) && inGroup(x) && !passViews(x)), noViews = held.filter((x) => x.views == null).length;
      const p = el('p', 'empty'); p.append(`지금 보는 칸은 ${where} 인데, 여기에 맞는 글이 없어요.`);
      if (hiddenNoise) p.append(el('div', 'hint', `광고·홍보로 숨긴 글 ${hiddenNoise}개 — 위 '광고·홍보도 보기'를 켜면 나와요.`));
      if (F.onlyTalk || F.onlyHot) p.append(el('div', 'hint', `${[F.onlyTalk ? '🎙 말로 풀 수 있는 것만' : '', F.onlyHot ? '🔥 떡상만' : ''].filter(Boolean).join(' · ')} 이 켜져 있어요. 끄면 더 나와요.`));
      if (held.length) p.append(el('div', 'hint', `최소 조회수(${short(F.minViews)})에 걸린 글 ${held.length}개${noViews ? ` — 그중 ${noViews}개는 아직 조회수를 못 받아 좋아요×200으로 쟀어요(다음 수집 때 채워져요)` : ''}.`));
      const within = items.filter((x) => passBase(x) && passViews(x));
      const cntG = { all: within.filter((x) => fitGroup(x) !== 'etc').length, money: within.filter((x) => fitGroup(x) === 'money').length, beauty: within.filter((x) => fitGroup(x) === 'beauty').length, etc: within.filter((x) => fitGroup(x) === 'etc').length };
      const jump = (label, fn) => { const b = el('button', '', label); b.style.cssText = 'margin:2px 4px;padding:2px 10px;font-size:12px'; b.addEventListener('click', fn); return b; };
      const alts = [['all', '전체'], ['money', '💰 재테크(국내)'], ['beauty', '💄 뷰티(해외)'], ['etc', '🗂 그 밖']].filter(([g]) => g !== F.group && cntG[g]);
      if (alts.length) { const d = el('div'); d.style.marginTop = '10px'; d.append('같은 기간·조건에서 다른 칸엔 있어요: '); alts.forEach(([g, label]) => d.append(jump(`${label} ${cntG[g]}개 보기`, () => { F.group = g; F.topic = ''; LS.set('radar.group', g); LS.set('radar.topic2', ''); render(); renderSide(); }))); p.append(d); }
      const wider = [[48, '48시간'], [72, '3일'], [168, '7일']].filter(([s]) => s > F.span).map(([s, l]) => { const keep = F.span; F.span = s; const n = items.filter((x) => passBase(x) && passViews(x) && inGroup(x)).length; F.span = keep; return [s, l, n]; }).filter((r) => r[2]);
      if (wider.length) { const d = el('div'); d.style.marginTop = '6px'; d.append('이 칸에서 기간을 넓히면: '); wider.forEach(([s, l, n]) => d.append(jump(`${l} ${n}개 보기`, () => { F.span = s; LS.set('radar.span72', s); if (s >= 168) loadAll(true); else render(); }))); p.append(d); }
      grid.append(p);
    }
    else list.slice(0, 300).forEach(({ x, m, dups }) => grid.append(card(x, m, dups)));
    const ig = items.filter((x) => x.platform === 'insta' && winH(x) <= F.span).length, tt = items.filter((x) => x.platform === 'tt' && winH(x) <= F.span).length, xh = items.filter((x) => x.platform === 'xhs' && winH(x) <= F.span).length, yt = items.filter((x) => x.platform === 'yt' && (x.views || 0) >= YT_MIN_VIEWS && !ytJunk(x) && winH(x) <= F.span).length;
    $('#count').textContent = `${list.length}개 표시${hiddenNoise ? ` · 광고·홍보 ${hiddenNoise}개 숨김` : ''}${mergedDup ? ` · 같은 글 ${mergedDup}개 묶음` : ''} — 보는 칸: ${where} · 기간 안 인스타 ${ig} · 유튜브 ${yt} · 틱톡 ${tt} · 레드노트 ${xh} · 캐러셀은 좋아요×200 기준 · * 는 점수에 좋아요×20`;
    setStatus(`마지막 수집 ${lastCollected ? ago(new Date(lastCollected).toISOString()) : '없음'} · 전체 ${items.length}개 · 읽은 시각 ${new Date(loadedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`);
    $('#pickCount').textContent = String(Object.keys(board.picks).length);
    renderSelBar();
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
    renderStatus(); renderTopicQ();
    const bb = $('#boardBox'); bb.replaceChildren();
    const ws = Object.keys(board.watch); bb.append(el('div', '', `감시 계정 ${ws.length}개 · 저장 ${Object.keys(board.saved).length}개 · 기획표 담김 ${Object.keys(board.picks).length}개`));
    ws.forEach((u) => { const s = el('span', 'w', `★ @${u} ✕`); s.title = '감시 해제'; s.addEventListener('click', async () => { delete board.watch[u]; await saveBoard('감시 해제 @' + u); render(); renderSide(); }); bb.append(s); });
    if (Object.keys(board.picks).length) { const b = el('button', '', '기획표 비우기'); b.style.cssText = 'margin-top:6px;font-size:11px;padding:2px 8px'; b.addEventListener('click', async () => { board.picks = {}; await saveBoard('기획표 비움'); render(); renderSide(); }); bb.append(el('div'), b); }
  }

  // 수집 현황(11/5 사용자 "뭘 했다는 거야"): 맥북 수집기가 매 실행 끝에 쓰는 수집상태.json — Aside 가 몇 쪽 검색해 몇 개 찾고, 계정 탭을 몇 개 열어 조회수를 몇 개 받고, 상세를 몇 개 열어 새 글이 몇 개인지
  const hm = (iso) => (iso ? new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) : '');
  function renderStatus() {
    const box = $('#stBox'); box.replaceChildren();
    if (!collect || !collect.last) { $('#stTime').textContent = '아직 없음'; box.append(el('p', 'hint', '맥북 수집기가 돌면 여기에 매 실행 결과가 적혀요(07·10·13·16·19·22시 20분, Aside 는 07·13·19시).')); return; }
    const L = collect.last, a = L.aside || {}, s = a.search || {}, c = a.accounts || {}, d = a.details || {};
    $('#stTime').textContent = `${hm(L.at)} 실행 · 다음 Aside ${collect.next || ''}`;
    const add = (t, cls = '') => box.append(el('div', `stl ${cls}`.trim(), t));
    if (a.ran) {
      add(`🔎 구글 검색 ${s.pages || 0}쪽 → 일주일 안 릴스 ${s.reels || 0}개${s.stale ? ` (옛 글 ${s.stale}개는 안 열었어요)` : ''}`);
      if (c.planned) add(`👤 계정 릴스 탭 ${c.opened}/${c.planned}개 (검색 걸림 ${c.hits} · 감시 차례 ${c.due} · 후보 ${c.cands}) → 조회수 ${c.views}개, 지난 검사 뒤 새로 올라온 릴스 ${c.newSince}개${c.blocked ? ' · ⚠️ 로그인 창이 떠서 멈춤' : ''}`, c.blocked ? 'warn' : '');
      else add(`👤 계정 릴스 탭 쉼 — ${c.why || ''}`, 'muted');
      add(`🎬 릴스 상세 ${d.opened || 0}개 → 새 글 ${d.new || 0}개 (새로 올라온 ${d.newSince || 0} · 검색 ${d.fromSearch || 0} · 처음 본 계정 앞쪽 ${d.front || 0}) · 옛 글 ${d.old || 0} · 아는 글 숫자만 새로 ${d.updated || 0}`);
      if (a.newAccounts && a.newAccounts.length) add(`★ 새 감시 계정 ${a.newAccounts.length}개: ${a.newAccounts.slice(0, 6).map((u) => '@' + u).join(' ')}`);
      add(`감시 계정 ${c.watchActive ?? '?'}개 활동 · ${c.resting ?? 0}개 쉼 · ${a.secs || 0}초 걸림`, 'muted');
    } else add(`Aside 쉼 — ${a.skip || '이 시각엔 유튜브만'}`, 'muted');
    if (L.blockedUntil) add(`⚠️ 인스타 계정 탭이 로그인 창으로 막혀 ${hm(L.blockedUntil)}까지 쉬어요(로그인은 하지 않아요)`, 'warn');
    add(`📺 유튜브 ${L.youtube || 0}개 · 인스타 ${L.insta || 0}개 저장 · 💵 Apify 이번 달 $${Number(L.apify && L.apify.month || 0).toFixed(2)} / $${L.apify && L.apify.cap || ''}`, 'muted');
    const runs = (collect.runs || []).slice(0, 8);
    if (runs.length) add('최근: ' + runs.map((r) => { const x = r.aside || {}; return `${hm(r.at)} ${x.ran ? `계정 ${(x.accounts || {}).opened || 0}·새 글 ${(x.details || {}).new || 0}` : '유튜브만'}`; }).join(' │ '), 'hint');
  }

  // 주제별 검색어(11/4 사용자 "어사이드로 주제별로"): 맥북 수집기가 07·13·19시에 Aside 시크릿 창으로 구글 site:instagram.com/reel <검색어> 최근 1주를 찾고,
  // 그 계정 릴스 탭 조회수·평소 중앙값까지 읽어 온다. 여기서 고치면 다음 수집부터 그 검색어로 긁는다. 재테크 주제는 한국어, 뷰티는 영어(규칙)
  function renderTopicQ() {
    const box = $('#tqBox'); box.replaceChildren();
    const topics = (topicQ && topicQ.topics) || {};
    $('#tqTime').textContent = topicQ ? `${Object.values(topics).flat().length}개` : '아직 없음';
    if (!topicQ) { box.append(el('p', 'hint', '맥북이 Aside로 처음 수집하면 기본 검색어가 생겨요(07·13·19시). 그 뒤 여기서 고칠 수 있어요.')); return; }
    const fromSearch = (t) => items.filter((x) => x.platform === 'insta' && x.topic === t && /^주제 검색/.test(x.source || '') && winH(x) <= F.span).length;
    [...BEAUTY, ...MONEY].forEach((t) => {
      const row = el('div', 'tq');
      const name = el('button', 'tqname' + ((t === '뷰티' ? F.group === 'beauty' : F.group === 'money' && F.topic === t) ? ' on' : ''), `${t === '뷰티' ? '💄 뷰티(해외)' : t}`);
      name.title = '이 주제만 보기'; name.append(el('small', '', String(fromSearch(t))));
      name.addEventListener('click', () => { if (t === '뷰티') { F.group = 'beauty'; F.topic = ''; } else { F.group = 'money'; F.topic = t; } LS.set('radar.group', F.group); LS.set('radar.topic2', F.topic); render(); renderSide(); });
      row.append(name);
      (topics[t] || []).forEach((w) => { const c = el('span', 'w', `${w} ✕`); c.title = '이 검색어 빼기'; c.addEventListener('click', () => saveTopicQ(t, (topics[t] || []).filter((v) => v !== w), `빼기 ${t}: ${w}`)); row.append(c); });
      const inp = el('input'); inp.type = 'text'; inp.placeholder = t === '뷰티' ? '+ 영어 검색어' : '+ 검색어'; inp.maxLength = 30;
      inp.addEventListener('keydown', (e) => { if (e.key !== 'Enter' || e.isComposing) return; const w = inp.value.trim(); if (!w) return; if ((topics[t] || []).includes(w)) { inp.value = ''; return; } if (t === '뷰티' && /[가-힣]/.test(w)) { toast('뷰티는 해외 글만 모으는 규칙이라 영어로 넣어 주세요'); return; } saveTopicQ(t, [...(topics[t] || []), w], `더하기 ${t}: ${w}`); });
      row.append(inp); box.append(row);
    });
    box.append(el('p', 'hint', '검색어마다 구글에서 최근 1주 인스타 릴스 20개쯤을 찾고, 그 계정의 최근 릴스 12개 조회수로 평소 대비 배수를 매겨요. 숫자는 지금 기간 안에 주제 검색으로 들어온 개수. Enter로 더하고 ✕로 빼요. 다음 수집(07·13·19시)부터 반영돼요.'));
  }
  async function saveTopicQ(t, list, msg) {
    try { topicQ = await updateJson(`${CFG.dir}/주제검색어.json`, (d) => ({ ...d, topics: { ...(d.topics || {}), [t]: list }, updatedAt: isoLocal(new Date()) }), `레이더 주제 검색어: ${msg}`); toast(`저장했어요 — ${msg}`); }
    catch (e) { toast(`저장 실패: ${e.message || e}`); }
    renderSide();
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
      tile('팔로워 대비', m.fmult != null ? `${m.fmult.toFixed(1)}x` : '-', x.followers ? `팔로워 ${short(x.followers)}${m.hot ? ' · 🔥 떡상' : ''}` : '팔로워 수를 못 받았어요'),
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
    $('#dSel').textContent = sel.has(x.id) ? '✓ 대본 뽑기에 담김 (누르면 빼기)' : '🎬 대본 뽑기에 담기';
    { const hk = hookOf(x), st = structOf(x), nz = noiseOf(x); $('#dHook').textContent = `🎣 후킹 첫 문장${hk.from ? `(${hk.from})` : ''}: ${hk.text || '없음'}${st.length ? ` · 구조: ${st.join(' → ')}` : ''}${talkOf(x) ? ' · 🎙 말로 풀 수 있는 주제' : ''}${nz ? ` · ${nz.label}` : ''}`; }
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

  // ── 대본 뽑기(1.14, 11/14 사용자 "레퍼 선택하고 대본뽑기 누르면 대본 바로", "인스타용/롱폼 두 가지", "롱폼은 스토리보드") ──
  // 레퍼를 고르고 종류를 정하면 재료(radar)를 아이디어뇌/맥북요청/<id>.json 에 '대기'로 올린다(소원저장소가 쓰는 길 그대로).
  // 맥북 도구/소원_맥북답변.py 가 받아쓰기·대본 규칙 문서를 붙여 claude(구독)로 쓰고, 아이디어뇌/대본/레이더/ 에 md 로 남긴 뒤 '완료'로 바꾼다.
  const REQ_DIR = '아이디어뇌/맥북요청', OUT_DIR = '아이디어뇌/대본/레이더', SEL_MAX = 5, MODEL_BEST = 'claude-fable-5-1';
  const sel = new Map(Object.entries(LS.get('radar.sel', {})));          // id → 레퍼 한 줄(새로고침해도 남게)
  let jobs = LS.get('radar.jobs', []), pastList = null, jobTimer = 0, sType = LS.get('radar.sType', 'insta'), shown = null;
  const TYPE = { insta: { label: '📱 인스타용 대본', file: '인스타대본', desc: '릴스 30~50초 · 블록 라벨·초·대사·(화면 요소) · / 는 두 줄 자막' }, long: { label: '🖥 롱폼 스토리보드', file: '롱폼보드', desc: '3~4분 · 장면 보드(장 번호·시간·말할 요점·화면·후킹/재후킹 자리) · 제목·썸네일 가안' } };
  const saveSel = () => LS.set('radar.sel', Object.fromEntries(sel)), saveJobs = () => LS.set('radar.jobs', jobs);
  function refOf(x) {
    const m = metrics(x), hk = hookOf(x);
    return { id: x.id, code: x.code, platform: `${platName(x)} ${kindLabel(x).replace(/^\S+\s/, '')}`, user: x.user, url: x.url, caption: (x.caption || '').slice(0, 1500), views: x.views, likes: x.likes, comments: x.comments, followers: x.followers || null,
      mult: m.mult != null ? Number(m.mult.toFixed(1)) : null, fmult: m.fmult != null ? Number(m.fmult.toFixed(1)) : null, age: ago(x.postedAt), topic: x.topic || '', hook: hk.text, hookFrom: hk.from, struct: structOf(x).join(' → '), memo: board.memos[x.id] || '', hasTranscript: stackByCode.has(x.code) };
  }
  function toggleSel(x) {
    if (sel.has(x.id)) sel.delete(x.id);
    else { if (sel.size >= SEL_MAX) { toast(`레퍼는 한 번에 ${SEL_MAX}개까지 골라요`); return; } sel.set(x.id, refOf(x)); }
    saveSel(); render();
    if (current && current.id === x.id) $('#dSel').textContent = sel.has(x.id) ? '✓ 대본 뽑기에 담김 (누르면 빼기)' : '🎬 대본 뽑기에 담기';
  }
  function renderSelBar() {
    const bar = $('#selBar'); bar.classList.toggle('on', sel.size > 0); document.body.classList.toggle('hassel', sel.size > 0);
    const box = $('#selList'); box.replaceChildren();
    $('#selCount').textContent = `레퍼 ${sel.size}개 선택`;
    sel.forEach((r, id) => { const c = el('button', 'w', `@${r.user} ${short(r.views)} ✕`); c.type = 'button'; c.title = '빼기'; c.addEventListener('click', () => { sel.delete(id); saveSel(); render(); }); box.append(c); });
  }
  function openScriptDlg() {
    if (!sel.size) { toast('카드 왼쪽 위 네모를 눌러 레퍼를 먼저 골라요'); return; }
    sel.forEach((r, id) => { const x = items.find((v) => v.id === id); if (x) sel.set(id, refOf(x)); });   // 숫자·받아쓰기 여부를 지금 값으로
    const ul = $('#sRefs'); ul.replaceChildren();
    sel.forEach((r) => { const li = el('li'); li.append(el('b', '', `@${r.user}`), ` 조회 ${short(r.views)}${r.mult ? ` · 평소 ${r.mult}배` : ''} · ${r.hasTranscript ? '받아쓰기 있음' : '캡션만(받아쓰기 없음)'}`); if (r.hook) li.append(el('div', 'muted', `🎣 ${r.hook}`)); ul.append(li); });
    $('#sTypeSeg').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === sType));
    $('#sTypeDesc').textContent = TYPE[sType].desc; $('#sMsg').textContent = '';
    $('#scriptDlg').showModal(); $('#sMemo').focus();
  }
  async function submitScript() {
    const refs = [...sel.values()]; if (!refs.length) return;
    const now = new Date(), id = makeId(now), memo = $('#sMemo').value.trim().slice(0, 400);
    const title = memo ? memo.slice(0, 30) : `${refs[0].user}${refs.length > 1 ? ` 외 ${refs.length - 1}` : ''}`;
    const req = { version: 1, id, at: isoLocal(now), kind: '레이더대본', model: MODEL_BEST, effort: 'high', status: '대기', radar: { type: sType, title, memo, refs },
      note: '떡상 레이더 대본 뽑기. 맥북 도구/소원_맥북답변.py 가 받아쓰기·대본 규칙을 붙여 쓰고 아이디어뇌/대본/레이더/ 에 md 로 남긴다' };
    $('#sSend').disabled = true; $('#sMsg').textContent = '맥북에 보내는 중…';
    try {
      await writeFile(`${REQ_DIR}/${id}.json`, JSON.stringify(req, null, 2) + '\n', null, `떡상 레이더: 대본 뽑기 요청 ${id}`);
      jobs.unshift({ id, type: sType, title, at: Date.now(), status: '대기', n: refs.length }); saveJobs();
      $('#scriptDlg').close(); $('#sMemo').value = ''; toast(`맥북에 보냈어요 — ${TYPE[sType].label} · 보통 1~3분`);
      $('#sjDetails').open = true; renderJobs(); pollJobs(true);
    } catch (e) { $('#sMsg').textContent = `보내지 못했어요: ${e.message || e}`; }
    finally { $('#sSend').disabled = false; }
  }
  const fmtSec = (s) => (s < 60 ? `${s}초` : `${Math.floor(s / 60)}분 ${pad(s % 60)}초`);
  function jobLine(j) {
    const sec = Math.round((Date.now() - j.at) / 1000);
    if (j.status === '한도대기') return `맥북 Claude 사용량 한도예요. ${j.retryAt ? `${j.retryAt}에` : '잠시 뒤'} 맥북이 다시 써요(창을 닫아도 돼요)`;
    if (j.status === '처리중') return `맥북 Claude가 쓰는 중… ${fmtSec(sec)}`;
    if (j.status === '실패') return `실패: ${j.error || '다시 눌러 주세요'}`;
    return sec >= 150 ? `맥북이 아직 안 받았어요(${fmtSec(sec)}). 맥북이 켜져 있는지 봐 주세요` : `맥북이 받기를 기다리는 중… ${fmtSec(sec)}`;
  }
  function renderJobs() {
    const box = $('#sjBox'); box.replaceChildren();
    const live = jobs.filter((j) => j.status !== '완료');
    $('#sjTime').textContent = live.length ? `${live.length}개 진행 중` : pastList ? `지난 결과 ${pastList.length}개` : '';
    live.forEach((j) => { const d = el('div', 'job' + (j.status === '실패' ? ' bad' : '')); d.append(el('b', '', `${TYPE[j.type].label} · ${j.title}`), el('div', 'muted', jobLine(j))); if (j.status === '실패') { const b = el('button', '', '지우기'); b.type = 'button'; b.addEventListener('click', () => { jobs = jobs.filter((v) => v.id !== j.id); saveJobs(); renderJobs(); }); d.append(b); } else d.append(el('span', 'spin', '')); box.append(d); });
    if (pastList == null) { box.append(el('p', 'hint', '카드 왼쪽 위 네모로 레퍼를 고르고 아래에 뜨는 🎬 대본 뽑기를 누르면 여기에 결과가 쌓여요.')); return; }
    if (!pastList.length && !live.length) box.append(el('p', 'hint', '아직 뽑은 대본이 없어요. 카드 왼쪽 위 네모로 레퍼를 고르고 아래에 뜨는 🎬 대본 뽑기를 눌러요.'));
    pastList.slice(0, 30).forEach((h) => { const b = el('button', 'hist', `${h.type === 'long' ? '🖥' : '📱'} ${h.title}`); b.type = 'button'; b.append(el('small', '', ` ${h.when}`)); b.title = h.path; b.addEventListener('click', () => openResult(h)); box.append(b); });
  }
  async function loadHistory() {
    try {
      const ls = await gh(`${repo()}/contents/${enc(OUT_DIR)}?ref=${encodeURIComponent(CFG.branch)}&t=${Date.now()}`);
      pastList = (Array.isArray(ls) ? ls : []).filter((f) => /\.md$/.test(f.name)).map((f) => { const m = f.name.match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})\d{2}-\w+_(인스타대본|롱폼보드)_(.*)\.md$/); return m ? { path: f.path, name: f.name, type: m[6] === '롱폼보드' ? 'long' : 'insta', title: m[7].replace(/-/g, ' '), when: `${Number(m[2])}/${Number(m[3])} ${m[4]}:${m[5]}`, key: f.name } : { path: f.path, name: f.name, type: /롱폼/.test(f.name) ? 'long' : 'insta', title: f.name.replace(/\.md$/, ''), when: '', key: f.name }; }).sort((a, b) => (a.key < b.key ? 1 : -1));
    } catch (e) { if (e.status === 404) pastList = []; }
    renderJobs();
  }
  function showResult(o) {   // o: { type, title, meta, text, path }
    shown = o;
    $('#rTitle').textContent = `${TYPE[o.type].label} — ${o.title}`; $('#rMeta').textContent = o.meta || ''; $('#rText').textContent = o.text || '';
    $('#rPath').textContent = o.path ? `저장: ${o.path} (맥북 폴더에는 5분쯤 뒤 동기화)` : '';
    if (!$('#resultDlg').open) $('#resultDlg').showModal();
  }
  async function openResult(h) {
    try { const f = await readFile(h.path); if (!f) { toast('파일이 없어요'); return; } const i = f.text.indexOf('\n---\n'); showResult({ type: h.type, title: h.title, meta: i > 0 ? f.text.slice(0, i).replace(/^# .*\n+/, '').trim() : '', text: i > 0 ? f.text.slice(i + 5).trim() : f.text, path: h.path }); }
    catch (e) { toast(`읽기 실패: ${e.message || e}`); }
  }
  let polling = false;
  async function pollJobs(now) {
    clearTimeout(jobTimer);
    const live = jobs.filter((j) => j.status !== '완료' && j.status !== '실패');
    if (!live.length || !token) { renderJobs(); return; }
    const next = () => { jobTimer = setTimeout(() => pollJobs(), live.some((j) => j.status !== '한도대기') ? 8000 : 60000); };
    if (polling) { next(); return; }
    if (!now) renderJobs();
    polling = true;
    try {
      for (const j of live) {
        let f = null;
        try { f = await readJson(`${REQ_DIR}/${j.id}.json`); } catch { continue; }   // 잠깐 끊긴 건 다음 차례에
        if (!f) { if (Date.now() - j.at > 20e3) { j.status = '실패'; j.error = '요청 파일이 사라졌어요. 지난 결과에 있는지 보고, 없으면 다시 눌러 주세요'; } continue; }
        const d = f.data || {};
        if (d.status === '완료' && d.text) {
          j.status = '완료';
          let path = d.saved || '';
          if (!path) {   // 맥북이 md 를 못 남겼으면 여기서 남긴다
            path = `${OUT_DIR}/${j.id}_${TYPE[j.type].file}_${j.title.replace(/[^가-힣0-9A-Za-z]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || '레퍼'}.md`;
            const refs = ((d.radar || {}).refs || []).map((r) => `  - @${r.user} · 조회 ${short(r.views)} · ${r.url}`).join('\n');
            try { await writeFile(path, `# ${TYPE[j.type].label.replace(/^\S+\s/, '')} — ${j.title}\n\n- 만든 때: ${isoLocal(new Date()).slice(0, 16).replace('T', ' ')} · 떡상 레이더 '대본 뽑기' · 모델 ${d.modelUsed || ''}\n- 주제 메모: ${(d.radar || {}).memo || '(없음)'}\n- 레퍼:\n${refs}\n\n---\n\n${d.text.trim()}\n`, null, `떡상 레이더 대본 뽑기: ${j.id}`); } catch { path = ''; }
          }
          showResult({ type: j.type, title: j.title, meta: `모델 ${d.modelUsed || ''} · ${d.took ? fmtSec(d.took) : ''} · 레퍼 ${j.n}개${(d.ruleFiles || []).length ? ` · 규칙 ${d.ruleFiles.join(', ')}` : ''}`, text: d.text, path });
          toast('대본이 나왔어요');
          gh(`${repo()}/contents/${enc(`${REQ_DIR}/${j.id}.json`)}`, { method: 'DELETE', body: { message: `떡상 레이더: 대본 받음 ${j.id}`, branch: CFG.branch, sha: f.sha } }).catch(() => { /* 못 지우면 맥북이 2시간 뒤 치운다 */ });
          loadHistory();
        } else if (d.status === '실패') { j.status = '실패'; j.error = d.error || ''; }
        else if (d.status === '한도대기') { j.status = '한도대기'; j.retryAt = d.retryAt || ''; }
        else if (d.status === '처리중') j.status = '처리중';
        if (Date.now() - j.at > 6 * 3600e3 && j.status !== '한도대기' && j.status !== '완료') { j.status = '실패'; j.error = '6시간이 지나도 답이 없어요'; }
      }
    } finally { polling = false; }
    jobs = jobs.filter((j) => j.status !== '완료').slice(0, 10); saveJobs(); renderJobs();
    if (jobs.some((j) => j.status !== '실패')) next();
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
    $('#onlyTalk').addEventListener('change', (e) => { F.onlyTalk = e.target.checked; LS.set('radar.onlyTalk', F.onlyTalk); render(); });
    $('#onlyHot').addEventListener('change', (e) => { F.onlyHot = e.target.checked; LS.set('radar.onlyHot', F.onlyHot); render(); });
    $('#showAds').addEventListener('change', (e) => { F.showAds = e.target.checked; LS.set('radar.showAds', F.showAds); render(); });
    $('#selGo').addEventListener('click', openScriptDlg);
    $('#selClear').addEventListener('click', () => { sel.clear(); saveSel(); render(); });
    $('#dSel').addEventListener('click', () => { if (current) toggleSel(current); });
    $('#sTypeSeg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; sType = b.dataset.v; LS.set('radar.sType', sType); $('#sTypeSeg').querySelectorAll('button').forEach((v) => v.classList.toggle('on', v.dataset.v === sType)); $('#sTypeDesc').textContent = TYPE[sType].desc; });
    $('#sSend').addEventListener('click', submitScript);
    $('#sCancel').addEventListener('click', () => $('#scriptDlg').close());
    $('#sMemo').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); submitScript(); } });
    $('#rClose').addEventListener('click', () => $('#resultDlg').close());
    $('#rCopy').addEventListener('click', async () => { if (!shown) return; try { await navigator.clipboard.writeText(shown.text); toast('복사했어요'); } catch { const r = document.createRange(); r.selectNodeContents($('#rText')); const g = getSelection(); g.removeAllRanges(); g.addRange(r); toast('글자를 골라 뒀어요 — ⌘C 로 복사'); } });
    $('#sjReload').addEventListener('click', () => { loadHistory(); pollJobs(true); });
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
  if (token) { loadHistory(); pollJobs(true); }
  window.radarDebug = { get items() { return items; }, metrics, filtered, noiseOf, talkOf, hookOf, structOf, fitGroup, F, get hidden() { return hiddenNoise; }, get merged() { return mergedDup; } };   // 시험·진단용(읽기)
  // 배포가 바뀌면 열려 있던 탭이 스스로 다시 뜬다(11/5: 어젯밤부터 열려 있던 탭이 옛 코드로 "전체 7 · 0개 표시"를 보여 주던 것. 🔄 새로고침은 자료만 다시 읽는다)
  const VERSION = '1.14.0';   // index.html 의 radar.js?v= 과 같게 올린다
  async function checkVersion() { try { const r = await fetch(`index.html?_=${Date.now()}`, { cache: 'no-store' }); const m = (await r.text()).match(/radar\.js\?v=([\d.]+)/); if (m && m[1] !== VERSION) location.reload(); } catch { /* 파일로 열었거나 잠깐 끊김 */ } }
  setInterval(() => { if (!document.hidden) { checkVersion(); loadAll(false); } }, 5 * 60e3);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkVersion(); });
})();
