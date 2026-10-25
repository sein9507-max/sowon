/* 소원저장소 — 블로그(일상 글) 탭
 * 맥북이 사진첩 사진을 찍은 시간대별로 묶어 <아이디어뇌>/일상/묶음.json + 미리보기/ 에 올린다(도구/일상사진_받기.py).
 * 여기서 묶음마다 말풍선을 띄우고, 사용자가 짧은 후기를 적어 '발행'을 누르면 일상/후기.json 에 status '대기'로 쌓는다.
 * 매일 밤 클라우드 루틴(신혼테크 일상 글, Opus)이 대기 후기로 패션 블로그(dnwls5102) 일상 글을 써서 확장에 넣는다.
 * 이미 쓴 묶음·안 쓸 묶음은 '건너뛰기'로 status '건너뜀' 을 남긴다(루틴은 대기만 읽으니 글을 안 쓴다). 되돌리기로 지운다.
 * 묶음 이름(예: 한강 밤)은 루틴이 사진을 보고 일상/이름.json 에 붙인다. 없으면 날짜·시간대로 부른다.
 * 1.10.0 (사용자 10/22 "다 같은 장소인데 묶음이 나뉘어 있다 — 위아래 묶음 합치기"): 묶음마다 '위랑 합치기·아래랑 합치기'.
 *   일상/합치기.json 에 합친 묶음 id 를 남기고 맥북에 '지금 가져오기'를 요청한다. 맥북(일상사진_받기.py)이 실제로 합쳐
 *   묶음.json 에 올린다(합친 묶음은 parts 에 원래 묶음을 같이 둔다). 앱은 parts 를 펼쳐 합치기.json 대로 다시 합쳐 보여 주므로
 *   맥북이 돌기 전에도 바로 합쳐 보이고, '나누기'도 바로 된다. 합친 묶음 번호는 가장 이른 묶음 번호다. */
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
  const DIR = () => SW.cfg().dir.split('/').filter(Boolean)[0] + '/일상';   // 아이디어뇌/일상
  const enc = (p) => p.split('/').map(encodeURIComponent).join('/');
  const url = (p) => `${SW.repoPath()}/contents/${enc(p)}?ref=${encodeURIComponent(SW.cfg().branch)}&t=${Date.now()}`;
  const DOW = ['일', '월', '화', '수', '목', '금', '토'];

  let updatedAt = '', pullAt = LS.get('mb.blogPullAt', '');
  let groups = [], names = {}, reviews = [], reviewsSha = null, loading = false, loadedAt = 0;
  let merges = [];                                // 합치기.json — [[묶음 id, 묶음 id…], …]
  const thumbs = new Map();                       // 경로 → data: 주소
  let drafts = LS.get('mb.blogDrafts', {});      // 묶음 id → 쓰다 만 후기

  async function readJSON(path) {
    try {
      const meta = await SW.gh(url(path));
      return { data: JSON.parse(SW.b64decode(meta.content || '') || '{}'), sha: meta.sha };
    } catch (e) { if (e.status === 404) return { data: {}, sha: null }; throw e; }
  }
  async function writeReviews(mutate, message) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const f = await readJSON(`${DIR()}/후기.json`);
      const entries = Array.isArray(f.data.entries) ? f.data.entries : [];
      mutate(entries);
      const body = { version: 1, note: '소원저장소 블로그 탭이 쌓는 일상 후기. status 대기 → 루틴이 글을 쓰면 완료', entries };
      try {
        const res = await SW.gh(`${SW.repoPath()}/contents/${enc(`${DIR()}/후기.json`)}`, { method: 'PUT', body: { message, branch: SW.cfg().branch, content: SW.b64encode(JSON.stringify(body, null, 2) + '\n'), ...(f.sha ? { sha: f.sha } : {}) } });
        reviews = entries; reviewsSha = res.content.sha; return;
      } catch (e) { if ((e.status === 409 || e.status === 422) && attempt < 2) continue; throw e; }
    }
  }

  // 파일 하나를 읽고 → build(지금 내용) 로 새 내용을 만들어 올린다. 다른 기기가 먼저 고쳤으면(409·422) 다시 읽어서 한 번 더.
  async function save(path, build, message) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const f = await readJSON(path);
      const body = build(f.data);
      try {
        await SW.gh(`${SW.repoPath()}/contents/${enc(path)}`, { method: 'PUT', body: { message, branch: SW.cfg().branch, content: SW.b64encode(JSON.stringify(body, null, 2) + '\n'), ...(f.sha ? { sha: f.sha } : {}) } });
        return body;
      } catch (e) { if ((e.status === 409 || e.status === 422) && attempt < 2) continue; throw e; }
    }
  }
  const mergeList = (d) => (Array.isArray(d.merges) ? d.merges : []).map((m) => m.ids).filter((ids) => Array.isArray(ids) && ids.length > 1);

  // 맥북이 합쳐 올린 묶음은 parts(원래 묶음)로 펼친다. 미리보기는 합친 묶음 폴더에 있으니 dirOf 로 기억한다.
  function expand(raw) {
    const out = [];
    raw.forEach((g) => {
      const dirOf = {}; g.photos.forEach((f) => { dirOf[f] = g.id; });
      if (Array.isArray(g.parts) && g.parts.length > 1) g.parts.forEach((p) => out.push({ ...p, count: p.photos.length, dirOf, parts: [p.id] }));
      else out.push({ ...g, dirOf, parts: [g.id] });
    });
    return out;
  }
  // 합치기.json 대로 묶는다. 합친 묶음 번호·시작은 가장 이른 묶음 것 (맥북도 같은 규칙).
  function combine(list) {
    const root = {};
    const find = (x) => { while (root[x] && root[x] !== x) x = root[x]; return x; };
    merges.forEach((ids) => ids.slice(1).forEach((b) => { const ra = find(ids[0]), rb = find(b); if (ra !== rb) root[rb] = ra; }));
    const by = new Map();
    list.forEach((g) => { const r = find(g.id); if (!by.has(r)) by.set(r, []); by.get(r).push(g); });
    return [...by.values()].map((gs) => {
      if (gs.length === 1) return gs[0];
      gs.sort((a, b) => (a.start < b.start ? -1 : 1));
      const photos = gs.flatMap((g) => g.photos).sort();
      return { id: gs[0].id, start: gs[0].start, end: gs.map((g) => g.end).sort().pop(), count: photos.length, photos,
        dirOf: Object.assign({}, ...gs.map((g) => g.dirOf)), parts: gs.flatMap((g) => g.parts) };
    });
  }
  let rawGroups = [];
  const regroup = () => { groups = combine(expand(rawGroups)); };

  async function load(force) {
    if (loading || !SW.cfg().token || !navigator.onLine) { render(); return; }
    if (!force && Date.now() - loadedAt < 60000) { render(); return; }
    loading = true; render();
    try {
      const [g, n, r, m] = await Promise.all([readJSON(`${DIR()}/묶음.json`), readJSON(`${DIR()}/이름.json`), readJSON(`${DIR()}/후기.json`), readJSON(`${DIR()}/합치기.json`)]);
      rawGroups = Array.isArray(g.data.groups) ? g.data.groups : [];
      merges = mergeList(m.data); regroup();
      updatedAt = g.data.updatedAt || '';
      names = n.data.names || {};
      reviews = Array.isArray(r.data.entries) ? r.data.entries : []; reviewsSha = r.sha;
      loadedAt = Date.now();
    } catch (e) { if (e.status !== 401) SW.toast(`블로그 불러오기 실패: ${e.message || e}`); }
    finally { loading = false; render(); }
  }

  function when(g) {
    const s = new Date(g.start), h = s.getHours();
    const part = h < 5 ? '새벽' : h < 11 ? '아침' : h < 14 ? '점심' : h < 18 ? '오후' : '저녁';
    return `${s.getMonth() + 1}월 ${s.getDate()}일 (${DOW[s.getDay()]}) ${part}`;
  }
  const reviewOf = (id) => reviews.find((r) => r.groupId === id);

  async function thumb(img, path) {
    if (thumbs.has(path)) { img.src = thumbs.get(path); return; }
    try {
      const meta = await SW.gh(url(path));
      const src = `data:image/jpeg;base64,${String(meta.content || '').replace(/\s/g, '')}`;
      thumbs.set(path, src); img.src = src;
    } catch { img.alt = '사진을 못 불러왔어요'; }
  }

  const thumbPath = (g, f) => `${DIR()}/미리보기/${(g.dirOf && g.dirOf[f]) || g.id}/${f}`;

  function bubble(g, up, down) {
    const rv = reviewOf(g.id);
    const label = names[g.id] || when(g);
    const card = el('article', 'bl-card');
    const head = el('div', 'bl-head');
    // 1.11.1 (사용자 10/26 "지도·시간 보고 비슷한 장소끼리"): 맥북 일상사진_받기.py 가 묶음마다 동네 이름(place)·사진 퍼짐(spreadM)을 넣는다 → 어디 묶음인지 바로 보이게
    head.append(el('b', 'bl-name', label), el('span', 'bl-sub', `${names[g.id] ? when(g) + ' · ' : ''}${g.count}장${g.place ? ` · 📍 ${g.place}` : ''}`));
    card.append(head);
    const strip = el('div', 'bl-strip');
    const pick = g.photos.length <= 6 ? g.photos : [0, 1, 2, 3, 4, 5].map((k) => g.photos[Math.floor(k * (g.photos.length - 1) / 5)]);
    pick.forEach((f) => { const im = el('img'); im.alt = ''; im.loading = 'lazy'; strip.append(im); thumb(im, thumbPath(g, f)); });
    card.append(strip);
    // 1.9.0 (사용자 10/21 "18개 묶음이면 어떤 사진이 들어갔는지 모른다 — 펼쳐서 한눈에"): 전체 사진 격자 펼치기
    const more = el('button', 'mini-btn bl-more', `📷 ${g.count}장 모두 보기`); more.type = 'button';
    const grid = el('div', 'bl-grid'); grid.hidden = true;
    more.addEventListener('click', () => {
      if (!grid.childElementCount) g.photos.forEach((f) => { const im = el('img'); im.alt = ''; im.loading = 'lazy'; grid.append(im); thumb(im, thumbPath(g, f)); });
      grid.hidden = !grid.hidden; more.textContent = grid.hidden ? `📷 ${g.count}장 모두 보기` : '접기';
    });
    card.append(more, grid);

    if (rv && rv.status === '건너뜀') {
      card.classList.add('is-done');
      const row = el('div', 'bl-row');
      row.append(el('span', 'bl-status', `⏭ 건너뛴 묶음 · ${rv.note || '안 쓸래요'}`));
      const back = el('button', 'mini-btn', '되돌리기'); back.type = 'button';
      back.addEventListener('click', () => unskip(g, back));
      row.append(back); card.append(row);
      return card;
    }
    if (rv && rv.status === '완료') {
      card.classList.add('is-done');
      card.append(el('p', 'bl-status ok', `✔ 글로 만들었어요${rv.title ? ` · “${rv.title}”` : ''} — 크롬 확장에서 확인하고 발행하세요`));
      card.append(el('p', 'hint small', '이 묶음 사진은 맥북이 사진 앱 앨범 “블로그에 쓴 사진 (지워도 됨)”에 모아 둬요. 앨범을 열어 전체 선택 → 삭제하면 사진첩에서 정리돼요.'));
      return card;
    }
    const say = el('div', 'bl-say');
    const ta = el('textarea', 'paper bl-text');
    ta.rows = 4; ta.placeholder = '어땠어요? 생각나는 대로 짧게 적어요.\n예: 가는 길에 사람이 너무 많아서 힘들었는데, 운 좋게 분수 앞자리에 앉아서 행복했다';
    ta.value = rv && rv.status !== '완료' ? rv.text : (drafts[g.id] || '');
    ta.addEventListener('input', () => { drafts[g.id] = ta.value; LS.set('mb.blogDrafts', drafts); });
    say.append(ta); card.append(say);
    const row = el('div', 'bl-row');
    if (rv && rv.status === '대기') row.append(el('span', 'bl-status wait', '⏳ 대기 중 — 밤 10시에 글로 만들어요 (고쳐서 다시 눌러도 돼요)'));
    if (rv && rv.status === '실패') row.append(el('span', 'bl-status bad', `다시 확인 필요: ${rv.note || '루틴이 글을 못 썼어요'}`));
    const btn = el('button', 'aqua-btn small bl-pub', rv && rv.status === '대기' ? '고친 후기로 다시 발행' : '발행');
    btn.type = 'button';
    btn.addEventListener('click', () => publish(g, label, ta.value, btn));
    if (!rv || rv.status !== '대기') {
      const skips = el('div', 'bl-skips');
      skips.append(el('span', 'bl-sub', '이 묶음은'));
      [['이미 썼어요', '이미 쓴 글'], ['안 쓸래요', '안 쓸래요']].forEach(([t, note]) => {
        const sk = el('button', 'mini-btn bl-skip', `⏭ ${t}`); sk.type = 'button';
        sk.addEventListener('click', () => skip(g, label, note, sk));
        skips.append(sk);
      });
      row.append(skips);
    }
    row.append(btn); card.append(row);
    // 1.10.0: 같은 장소인데 나뉜 묶음 합치기 (위·아래 = 지금 목록에서 바로 위·아래 묶음)
    const mrow = el('div', 'bl-skips bl-merge');
    if (g.parts.length > 1) {
      mrow.append(el('span', 'bl-sub', `🔗 묶음 ${g.parts.length}개를 합쳤어요`));
      const sp = el('button', 'mini-btn', '나누기'); sp.type = 'button';
      sp.addEventListener('click', () => split(g, sp));
      mrow.append(sp);
    }
    [[up, '⬆ 위랑 합치기'], [down, '⬇ 아래랑 합치기']].forEach(([other, t]) => {
      if (!other) return;
      const mb = el('button', 'mini-btn', t); mb.type = 'button';
      mb.addEventListener('click', () => merge(g, other, mb));
      mrow.append(mb);
    });
    if (mrow.childElementCount) card.append(mrow);
    return card;
  }

  async function merge(g, other, btn) {
    if (!SW.cfg().token) { SW.toast('설정에서 저장소 열쇠를 먼저 넣어주세요'); SW.openSettings(); return; }
    const [keep, gone] = g.start <= other.start ? [g, other] : [other, g];   // 이른 묶음 번호가 남는다
    btn.disabled = true;
    try {
      const body = await save(`${DIR()}/합치기.json`, (d) => {
        const list = Array.isArray(d.merges) ? d.merges : [];
        list.push({ ids: [keep.id, gone.id], at: SW.isoLocal(new Date()) });
        return { version: 1, note: '소원저장소 블로그 탭 위랑·아래랑 합치기. 맥북 도구/일상사진_받기.py 가 읽어 묶음.json 에서 합친다', merges: list };
      }, `일상 묶음 합치기 ${keep.id} + ${gone.id}`);
      merges = mergeList(body);
      // 없어지는 묶음의 후기·쓰다 만 글은 남는 묶음으로 옮긴다 (둘 다 있으면 이어 붙인다)
      const live = (id) => reviews.find((x) => x.groupId === id && x.status !== '완료');
      if (live(gone.id)) {
        await writeReviews((entries) => {
          const i = entries.findIndex((x) => x.groupId === gone.id && x.status !== '완료');
          const k = entries.findIndex((x) => x.groupId === keep.id && x.status !== '완료');
          if (i < 0) return;
          if (k < 0) { entries[i] = { ...entries[i], groupId: keep.id, photos: keep.count + gone.count }; return; }
          const a = entries[k], b = entries[i];
          if (a.status === '건너뜀' && b.status !== '건너뜀') entries[k] = { ...b, id: a.id, groupId: keep.id };
          else if (a.status !== '건너뜀' && b.text) entries[k] = { ...a, text: [a.text, b.text].filter(Boolean).join('\n') };
          entries[k].photos = keep.count + gone.count;
          entries.splice(i, 1);
        }, `일상 후기 묶음 합치기 ${keep.id} + ${gone.id}`);
      }
      if (drafts[gone.id]) {
        drafts[keep.id] = [drafts[keep.id], drafts[gone.id]].filter(Boolean).join('\n');
        delete drafts[gone.id]; LS.set('mb.blogDrafts', drafts);
      }
      regroup();
      SW.toast('합쳤어요. 맥북이 5분쯤 뒤 사진 묶음도 합쳐 둬요 (잘못 눌렀으면 \'나누기\')');
      requestPull().catch(() => {});
    } catch (e) { SW.toast(`합치기 실패: ${e.message || e}`); }
    finally { btn.disabled = false; render(); }
  }
  async function split(g, btn) {
    btn.disabled = true;
    try {
      const parts = new Set(g.parts);
      const body = await save(`${DIR()}/합치기.json`, (d) => {
        const list = (Array.isArray(d.merges) ? d.merges : []).filter((m) => !(m.ids || []).some((id) => parts.has(id)));
        return { version: 1, note: '소원저장소 블로그 탭 위랑·아래랑 합치기. 맥북 도구/일상사진_받기.py 가 읽어 묶음.json 에서 합친다', merges: list };
      }, `일상 묶음 나누기 ${g.id}`);
      merges = mergeList(body); regroup();
      SW.toast('원래 묶음으로 나눴어요. 후기는 맨 앞 묶음에 남아요');
      requestPull().catch(() => {});
    } catch (e) { SW.toast(`나누기 실패: ${e.message || e}`); }
    finally { btn.disabled = false; render(); }
  }

  async function publish(g, label, text, btn) {
    text = text.trim();
    if (text.length < 10) { SW.toast('후기를 한두 문장만 더 적어주세요'); return; }
    if (!SW.cfg().token) { SW.toast('설정에서 저장소 열쇠를 먼저 넣어주세요'); SW.openSettings(); return; }
    btn.disabled = true;
    try {
      await writeReviews((entries) => {
        const at = SW.isoLocal(new Date());
        const i = entries.findIndex((x) => x.groupId === g.id && x.status !== '완료');
        const entry = { id: i >= 0 ? entries[i].id : SW.makeId(new Date()), groupId: g.id, label, text, at, status: '대기', photos: g.count };
        if (i >= 0) entries[i] = entry; else entries.push(entry);
      }, `일상 후기 ${label}`);
      delete drafts[g.id]; LS.set('mb.blogDrafts', drafts);
      SW.toast('발행 대기에 넣었어요. 밤 10시에 글로 만들어요');
    } catch (e) { SW.toast(`발행 실패: ${e.message || e}`); }
    finally { btn.disabled = false; render(); }
  }

  async function skip(g, label, note, btn) {
    if (!SW.cfg().token) { SW.toast('설정에서 저장소 열쇠를 먼저 넣어주세요'); SW.openSettings(); return; }
    btn.disabled = true;
    try {
      await writeReviews((entries) => {
        const i = entries.findIndex((x) => x.groupId === g.id && x.status !== '완료');
        const entry = { id: i >= 0 ? entries[i].id : SW.makeId(new Date()), groupId: g.id, label, text: '', at: SW.isoLocal(new Date()), status: '건너뜀', note, photos: g.count };
        if (i >= 0) entries[i] = entry; else entries.push(entry);
      }, `일상 묶음 건너뛰기 ${label}`);
      SW.toast('건너뛰었어요. 맨 아래 \'건너뛴 묶음\'에서 되돌릴 수 있어요');
    } catch (e) { SW.toast(`건너뛰기 실패: ${e.message || e}`); }
    finally { btn.disabled = false; render(); }
  }
  async function unskip(g, btn) {
    btn.disabled = true;
    try {
      await writeReviews((entries) => {
        const i = entries.findIndex((x) => x.groupId === g.id && x.status === '건너뜀');
        if (i >= 0) entries.splice(i, 1);
      }, `일상 묶음 되돌리기 ${names[g.id] || g.id}`);
      SW.toast('다시 목록에 올렸어요');
    } catch (e) { SW.toast(`되돌리기 실패: ${e.message || e}`); }
    finally { btn.disabled = false; render(); }
  }

  // 맥북에 '지금 가져오기' 요청을 남긴다. 맥북 동기화(5분마다)가 일상/요청.json 을 보고 바로 사진첩을 확인한다.
  async function pull(btn) {
    if (!SW.cfg().token) { SW.toast('설정에서 저장소 열쇠를 먼저 넣어주세요'); SW.openSettings(); return; }
    btn.disabled = true;
    try {
      await requestPull();
      SW.toast('맥북에 요청했어요. 5분쯤 뒤 새로 불러오기를 눌러주세요');
    } catch (e) { SW.toast(`요청 실패: ${e.message || e}`); }
    finally { btn.disabled = false; render(); }
  }
  async function requestPull() {
    const at = SW.isoLocal(new Date());
    await save(`${DIR()}/요청.json`, () => ({ version: 1, note: '소원저장소 블로그 탭 지금 사진 가져오기 버튼. 맥북 도구/일상사진_받기.py 가 읽는다', requestedAt: at }), '일상 사진 지금 가져오기');
    pullAt = at; LS.set('mb.blogPullAt', pullAt);
  }
  const hm = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

  function render() {
    const up = $('#blUpdated');
    if (up) {
      const waiting = pullAt && (!updatedAt || new Date(pullAt) > new Date(updatedAt));
      up.textContent = (updatedAt ? `사진 묶음 마지막 업데이트 ${hm(updatedAt)} · 맥북이 3시간마다 확인해요` : '')
        + (waiting ? ` · ⏳ ${hm(pullAt)} 요청함 — 맥북이 켜져 있으면 5분 안에 가져와요` : '');
    }
    const box = $('#blList'); if (!box) return;
    const n = reviews.filter((r) => r.status === '대기').length;
    $('#blogCount').textContent = n ? String(n) : '';
    box.replaceChildren();
    if (!SW.cfg().token) { box.append(el('p', 'hint', '설정 ①에서 저장소 열쇠를 넣으면 사진 묶음이 보여요.')); return; }
    if (loading && !groups.length) { box.append(el('p', 'hint', '사진 묶음 불러오는 중…')); return; }
    if (!groups.length) { box.append(el('p', 'hint', '아직 사진 묶음이 없어요. 맥북이 켜져 있으면 3시간마다 사진첩에서 새 사진을 가져와요.')); return; }
    const sorted = [...groups].sort((a, b) => (a.start < b.start ? 1 : -1));
    const st = (g) => (reviewOf(g.id) || {}).status;
    const open = sorted.filter((g) => st(g) !== '완료' && st(g) !== '건너뜀');
    const done = sorted.filter((g) => st(g) === '완료');
    const skipped = sorted.filter((g) => st(g) === '건너뜀');
    if (!open.length) box.append(el('p', 'hint', '후기 쓸 묶음이 없어요. 새 사진이 오면 여기 떠요.'));
    else box.append(el('p', 'hint small bl-count', `후기 쓸 묶음 ${open.length}개 · 맥북이 예전 사진까지 거슬러 올라가 10묶음쯤 채워 둬요`));
    open.forEach((g, i) => box.append(bubble(g, open[i - 1], open[i + 1])));
    [[done, '글로 만든 묶음'], [skipped, '건너뛴 묶음']].forEach(([list, title]) => {
      if (!list.length) return;
      const d = el('details', 'sc-opt'); d.append(el('summary', null, `${title} ${list.length}개`));
      list.forEach((g) => d.append(bubble(g))); box.append(d);
    });
  }

  document.addEventListener('sowon:tab', (e) => { if (e.detail === 'blog') load(); });
  $('#blRefresh').addEventListener('click', () => load(true));
  $('#blPull').addEventListener('click', (e) => pull(e.currentTarget));
  window.addEventListener('online', () => load(true));
  render();
  load(true);
})();
