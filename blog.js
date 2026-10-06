/* 소원저장소 — 블로그(일상 글) 탭
 * 맥북이 사진첩 사진을 찍은 시간대별로 묶어 <아이디어뇌>/일상/묶음.json + 미리보기/ 에 올린다(도구/일상사진_받기.py).
 * 여기서 묶음마다 말풍선을 띄우고, 사용자가 짧은 후기를 적어 '발행'을 누르면 일상/후기.json 에 status '대기'로 쌓는다.
 * 매일 밤 클라우드 루틴(신혼테크 일상 글, Opus)이 대기 후기로 패션 블로그(dnwls5102) 일상 글을 써서 확장에 넣는다.
 * 묶음 이름(예: 한강 밤)은 루틴이 사진을 보고 일상/이름.json 에 붙인다. 없으면 날짜·시간대로 부른다. */
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

  let groups = [], names = {}, reviews = [], reviewsSha = null, loading = false, loadedAt = 0;
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

  async function load(force) {
    if (loading || !SW.cfg().token || !navigator.onLine) { render(); return; }
    if (!force && Date.now() - loadedAt < 60000) { render(); return; }
    loading = true; render();
    try {
      const [g, n, r] = await Promise.all([readJSON(`${DIR()}/묶음.json`), readJSON(`${DIR()}/이름.json`), readJSON(`${DIR()}/후기.json`)]);
      groups = Array.isArray(g.data.groups) ? g.data.groups : [];
      names = n.data.names || {};
      reviews = Array.isArray(r.data.entries) ? r.data.entries : []; reviewsSha = r.sha;
      loadedAt = Date.now();
    } catch (e) { SW.toast(`블로그 불러오기 실패: ${e.message || e}`); }
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

  function bubble(g) {
    const rv = reviewOf(g.id);
    const label = names[g.id] || when(g);
    const card = el('article', 'bl-card');
    const head = el('div', 'bl-head');
    head.append(el('b', 'bl-name', label), el('span', 'bl-sub', `${names[g.id] ? when(g) + ' · ' : ''}${g.count}장`));
    card.append(head);
    const strip = el('div', 'bl-strip');
    const pick = g.photos.length <= 6 ? g.photos : [0, 1, 2, 3, 4, 5].map((k) => g.photos[Math.floor(k * (g.photos.length - 1) / 5)]);
    pick.forEach((f) => { const im = el('img'); im.alt = ''; im.loading = 'lazy'; strip.append(im); thumb(im, `${DIR()}/미리보기/${g.id}/${f}`); });
    card.append(strip);

    if (rv && rv.status === '완료') {
      card.classList.add('is-done');
      card.append(el('p', 'bl-status ok', `✔ 글로 만들었어요${rv.title ? ` · “${rv.title}”` : ''} — 크롬 확장에서 확인하고 발행하세요`));
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
    const btn = el('button', 'aqua-btn small', rv && rv.status === '대기' ? '고친 후기로 다시 발행' : '발행');
    btn.type = 'button';
    btn.addEventListener('click', () => publish(g, label, ta.value, btn));
    row.append(btn); card.append(row);
    return card;
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

  function render() {
    const box = $('#blList'); if (!box) return;
    const n = reviews.filter((r) => r.status === '대기').length;
    $('#blogCount').textContent = n ? String(n) : '';
    box.replaceChildren();
    if (!SW.cfg().token) { box.append(el('p', 'hint', '설정 ①에서 저장소 열쇠를 넣으면 사진 묶음이 보여요.')); return; }
    if (loading && !groups.length) { box.append(el('p', 'hint', '사진 묶음 불러오는 중…')); return; }
    if (!groups.length) { box.append(el('p', 'hint', '아직 사진 묶음이 없어요. 맥북이 켜져 있으면 3시간마다 사진첩에서 새 사진을 가져와요.')); return; }
    const sorted = [...groups].sort((a, b) => (a.start < b.start ? 1 : -1));
    const open = sorted.filter((g) => !(reviewOf(g.id) && reviewOf(g.id).status === '완료'));
    const done = sorted.filter((g) => reviewOf(g.id) && reviewOf(g.id).status === '완료');
    open.forEach((g) => box.append(bubble(g)));
    if (done.length) {
      const d = el('details', 'sc-opt'); d.append(el('summary', null, `글로 만든 묶음 ${done.length}개`));
      done.forEach((g) => d.append(bubble(g))); box.append(d);
    }
  }

  document.addEventListener('sowon:tab', (e) => { if (e.detail === 'blog') load(); });
  $('#blRefresh').addEventListener('click', () => load(true));
  window.addEventListener('online', () => load(true));
  render();
  load(true);
})();
