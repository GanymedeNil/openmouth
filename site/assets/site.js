// OpenMouth landing page: scroll reveals and the interactive demos of each feature.
// Everything here is a simulation in the browser; nothing records or uploads anything.
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const still = () => motionQuery.matches;
  const tint = (s) => (s >= 90 ? 'good' : s >= 75 ? 'fair' : 'poor');
  const once = (fn) => { let done = false; return () => { if (!done) { done = true; fn(); } }; };
  const icon = (id) => `<svg class="i"><use href="#i-${id}"/></svg>`;

  function h(tag, props, ...kids) {
    const e = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k === 'class') e.className = v;
        else if (k === 'html') e.innerHTML = v;
        else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) e.append(kid.nodeType ? kid : String(kid));
    return e;
  }

  // Show a list of new elements one after another.
  function stagger(els, gap, start) {
    if (still()) return;
    els.forEach((e) => e.classList.add('is-hidden'));
    void document.body.offsetHeight;
    els.forEach((e, i) => setTimeout(() => e.classList.remove('is-hidden'), (start || 0) + i * gap));
  }

  function countUp(el, to, digits, ms, suffix) {
    digits = digits || 0; suffix = suffix || '';
    if (still()) { el.textContent = to.toFixed(digits) + suffix; return; }
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - t, 3);
      el.textContent = (to * e).toFixed(digits) + suffix;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // ---------- speech: the browser's own voice stands in for 听示范 ----------

  const speech = (() => {
    const synth = window.speechSynthesis;
    let voice = null;
    const pick = () => {
      const vs = synth.getVoices();
      voice = vs.find((v) => /en[-_]US/i.test(v.lang) && /Samantha|Ava|Allison|Alex|Google US/i.test(v.name)) ||
        vs.find((v) => /en[-_]US/i.test(v.lang)) || vs.find((v) => /^en/i.test(v.lang)) || null;
    };
    if (synth) { pick(); if (synth.addEventListener) synth.addEventListener('voiceschanged', pick); }
    function say(text, rate) {
      rate = rate || 1;
      return new Promise((resolve) => {
        const fallback = setTimeout(resolve, 500 + (text.length * 75) / rate);
        if (!synth) return;
        try {
          synth.cancel();
          const u = new SpeechSynthesisUtterance(text);
          u.lang = 'en-US';
          if (voice) u.voice = voice;
          u.rate = 0.95 * rate;
          u.onend = u.onerror = () => { clearTimeout(fallback); resolve(); };
          synth.speak(u);
        } catch (e) { /* the timer resolves */ }
      });
    }
    return { say, stop: () => synth && synth.cancel() };
  })();

  $$('[data-slow]').forEach((b) => b.addEventListener('click', () => b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'))));
  $$('[data-say]').forEach((b) => b.addEventListener('click', async () => {
    if (b.classList.contains('is-playing')) { speech.stop(); return; }
    const slow = b.closest('.window').querySelector('[data-slow]');
    b.classList.add('is-playing');
    await speech.say(b.dataset.say, slow && slow.getAttribute('aria-pressed') === 'true' ? 0.7 : 1);
    b.classList.remove('is-playing');
  }));

  // ---------- page chrome: theme, top bar, progress, dots, reveals ----------

  $('.theme-toggle').addEventListener('click', () => {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('om-theme', root.dataset.theme); } catch (e) { /* not saved */ }
  });

  const progress = $('.progress i'), topbar = $('.topbar');
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const max = document.documentElement.scrollHeight - innerHeight;
      progress.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, scrollY / max) : 0) + ')';
      topbar.classList.toggle('is-scrolled', scrollY > 8);
    });
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const sections = $$('main > section');
  const dots = $$('.dots a');
  const navIO = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    dots.forEach((d) => d.classList.toggle('is-active', d.getAttribute('href') === '#' + e.target.id));
  }), { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach((s) => navIO.observe(s));

  const revealIO = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('is-in');
    revealIO.unobserve(e.target);
  }), { rootMargin: '0px 0px -8% 0px' });
  $$('.reveal').forEach((el) => revealIO.observe(el));

  // per-section hooks: run a demo when its screen comes into view, pause it when it leaves
  const hooks = {};
  const sectionIO = new IntersectionObserver((entries) => entries.forEach((e) => {
    const hook = hooks[e.target.id];
    if (e.isIntersecting) {
      e.target.classList.add('is-in');
      if (hook && hook.enter) hook.enter();
    } else if (hook && hook.leave) {
      hook.leave();
    }
  }), { rootMargin: '0px 0px -22% 0px' });

  function watch(el, cb) {
    new IntersectionObserver(([e]) => cb(e.isIntersecting), { threshold: 0.3 }).observe(el);
  }

  // A row of bars that bounces like a voice.
  function makeMeter(box, n) {
    const bars = Array.from({ length: n }, () => h('i'));
    box.append(...bars);
    let timer = null, t = 0;
    const frame = () => {
      t++;
      bars.forEach((b, i) => {
        const v = still()
          ? 0.35 + 0.3 * Math.abs(Math.sin(i * 0.7))
          : (0.3 + 0.7 * Math.abs(Math.sin(t * 0.33 + i * 0.31)) * Math.abs(Math.sin(t * 0.09 + i * 0.12))) * (0.55 + Math.random() * 0.45);
        b.style.height = Math.round(4 + v * 32) + 'px';
      });
    };
    return {
      tick: frame,
      start() { frame(); if (!still()) timer = setInterval(frame, 90); },
      stop() { clearInterval(timer); timer = null; bars.forEach((b) => { b.style.height = '6px'; }); },
    };
  }

  // ---------- the sentence and two takes of it ----------

  const S1 = 'I think this is the third Thursday of the month.';
  const ok = (p) => ({ p });
  const bad = (p, got) => ({ p, got, st: 'err' });
  const acc = (p) => ({ p, st: 'acc' });
  const miss = (p) => ({ p, st: 'miss' });
  const STRESS = { p: 'ˈ', mark: true };
  const word = (w, ...ph) => ({ w, ph: ph.map((x) => (typeof x === 'string' ? ok(x) : x)) });

  const TAKES = [
    {
      scores: [82, 85, 68],
      caps: ['良好 · 30 个音中 3 处读错、3 处有口音', '语速 3.1 音节/秒 · 停顿 1 次', '和示范比'],
      words: [
        word('I', 'aɪ'), word('think', bad('θ', 's'), 'ɪ', 'ŋ', 'k'), word('this', acc('ð'), 'ɪ', 's'), word('is', 'ɪ', acc('z')),
        word('the', 'ð', 'ə'), word('third', 'θ', 'ɜː', 'r', miss('d')), word('Thursday', STRESS, bad('θ', 't'), 'ɜː', 'r', 'z', 'd', 'eɪ'),
        word('of', 'ʌ', 'v'), word('the', 'ð', 'ə'), word('month.', 'm', 'ʌ', 'n', acc('θ')),
      ],
    },
    {
      scores: [94, 91, 83],
      caps: ['优秀 · 30 个音中 0 处读错、1 处有口音', '语速 3.6 音节/秒 · 停顿 0 次', '和示范比'],
      words: [
        word('I', 'aɪ'), word('think', 'θ', 'ɪ', 'ŋ', 'k'), word('this', 'ð', 'ɪ', 's'), word('is', 'ɪ', 'z'),
        word('the', 'ð', 'ə'), word('third', 'θ', 'ɜː', 'r', 'd'), word('Thursday', STRESS, 'θ', 'ɜː', 'r', 'z', 'd', 'eɪ'),
        word('of', 'ʌ', 'v'), word('the', 'ð', 'ə'), word('month.', 'm', 'ʌ', 'n', acc('θ')),
      ],
    },
  ];
  const NOTES = {
    'θ s': '舌尖轻放在上下齿之间，往外送气摩擦；不要把舌头缩回去发成 /s/。',
    'θ t': '舌尖放在齿间持续送气，不要像 /t/ 那样先堵住再爆破。',
    'θ acc': '舌尖再往前一点，轻放在上下齿之间、稍微露出来，气流从舌齿缝隙中送出。',
    'ð acc': '舌尖在齿间，同时振动声带，气流不中断；不要停在齿龈后面发成 /z/。',
    'z acc': '词尾的 /z/ 也要振动声带，不要清化成 /s/。',
    'd miss': '词尾的 /d/ 也要读出来：舌尖抵住上齿龈，轻轻收住，不要整个吞掉。',
  };
  const status = (w) => (w.ph.some((p) => p.st === 'err' || p.st === 'miss') ? 'err' : w.ph.some((p) => p.st === 'acc') ? 'acc' : 'ok');
  const STATUS = { err: '读错', acc: '有口音', ok: '读对了', miss: '漏读' };
  const ipaStd = (w) => '/' + w.ph.map((p) => p.p).join('') + '/';
  const ipaYou = (w) => '/' + w.ph.map((p) => {
    if (p.st === 'err') return `<span class="ph-err">${p.got}</span>`;
    if (p.st === 'miss') return '<span class="ph-miss">_</span>';
    if (p.st === 'acc') return `<span class="ph-acc">${p.p}</span>`;
    return p.p;
  }).join('') + '/';
  const problem = (w) => w.ph.find((p) => p.st);
  const what = (p) => (p.st === 'err' ? `/${p.p}/ 读成了 /${p.got}/` : p.st === 'miss' ? `漏读了词尾的 /${p.p}/` : `/${p.p}/ 有口音，还不够到位`);
  const note = (p) => NOTES[p.st === 'err' ? p.p + ' ' + p.got : p.p + ' ' + p.st] || '';

  function renderWords(box, take, onPick) {
    box.textContent = '';
    return TAKES[take].words.map((w, i) => {
      const st = status(w), inner = `<b>${w.w}</b><span class="ipa std">${ipaStd(w)}</span><span class="ipa you">${ipaYou(w)}</span>`;
      const el = onPick
        ? h('button', { class: `word word--${st}`, type: 'button', 'aria-pressed': 'false', 'aria-label': `${w.w.replace('.', '')}：${STATUS[st]}`, html: inner, onclick: () => onPick(i) })
        : h('span', { class: `word word--${st}`, html: inner });
      box.append(el);
      return el;
    });
  }

  function renderMetrics(box, take, animate) {
    const t = TAKES[take];
    box.textContent = '';
    ['发音', '流利度', '语调相似度'].forEach((title, i) => {
      const value = h('p', { class: 'metric__value ' + tint(t.scores[i]) }, animate ? '0' : String(t.scores[i]));
      box.append(h('div', { class: 'card metric' }, h('p', { class: 'metric__title' }, title), value, h('p', { class: 'metric__cap' }, t.caps[i])));
      if (animate) countUp(value, t.scores[i], 0, 900);
    });
  }

  // ---------- 1 · hero ----------

  {
    const metrics = $('.hero .metrics');
    renderMetrics(metrics, 0, false);
    const words = renderWords($('[data-words="hero"]'), 0);
    hooks.top = { enter: once(() => { renderMetrics(metrics, 0, true); stagger(words, 90, 450); }) };
  }

  // ---------- 2 · practice and scoring ----------

  const practice = (() => {
    const root = $('#practice');
    const btn = $('.rec-btn', root), label = $('.rec-label', root), meterBox = $('.meter', root), result = $('.result', root);
    const compareBtn = $('[data-compare]', root), playbackBtn = $('[data-playback]', root);
    const meter = makeMeter(meterBox, 40);
    let state = 'idle', takes = 0, stopTimer = 0, flashTimer = 0, restLabel = '录音 · 空格';

    const setLabel = (t) => { restLabel = t; label.textContent = t; };
    const flash = (t) => {
      label.textContent = t;
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => { label.textContent = restLabel; }, 2400);
    };

    function start() {
      state = 'rec';
      speech.stop();
      btn.classList.add('is-rec');
      btn.setAttribute('aria-label', '停止并打分');
      setLabel('录音中 · 再按空格结束');
      meterBox.classList.add('is-on');
      meter.start();
      stopTimer = setTimeout(stop, 3600);
    }
    async function stop() {
      if (state !== 'rec') return;
      clearTimeout(stopTimer);
      state = 'busy';
      meter.stop();
      meterBox.classList.remove('is-on');
      btn.classList.remove('is-rec');
      btn.classList.add('is-busy');
      setLabel('打分中…');
      await sleep(still() ? 250 : 900);
      btn.classList.remove('is-busy');
      show(takes % 2);
      takes++;
      state = 'done';
      btn.setAttribute('aria-label', '再读一次');
      setLabel('再读一次 · 空格');
      compareBtn.disabled = playbackBtn.disabled = false;
    }
    const toggle = () => { if (state === 'rec') stop(); else if (state !== 'busy') start(); };
    btn.addEventListener('click', toggle);

    compareBtn.addEventListener('click', async () => {
      compareBtn.classList.add('is-playing');
      flash('先放示范…');
      await speech.say(S1, 1);
      compareBtn.classList.remove('is-playing');
      flash('再放你读的（网页演示里没有录音）');
    });
    playbackBtn.addEventListener('click', () => flash('网页演示没有录下你的声音'));

    const legendHTML = '<span><b class="ph-err">abc</b> 读错</span><span><b class="ph-miss">_</b> 漏读</span><span><b class="ph-acc">abc</b> 有口音</span><span>ˈ 重读音节</span><span class="spacer"></span><span>点一个词：看问题和讲解</span>';

    // before the first take: the same layout, waiting to be filled in
    function pending() {
      const metrics = h('div', { class: 'metrics' });
      ['发音', '流利度', '语调相似度'].forEach((t) => metrics.append(h('div', { class: 'card metric' },
        h('p', { class: 'metric__title' }, t), h('p', { class: 'metric__value pending' }, '—'), h('p', { class: 'metric__cap' }, '读完马上出分'))));
      const words = h('div', { class: 'words' });
      TAKES[0].words.forEach((w) => words.append(h('span', { class: 'word word--pending', html: `<b>${w.w}</b><span class="ipa std">${ipaStd(w)}</span><span class="ipa you">/ ? /</span>` })));
      const steps = h('div', {
        class: 'card steps',
        html: `<div class="step">${icon('speaker')}<b>听示范</b><small>可以开 0.7× 慢速</small></div>${icon('right').replace('class="i"', 'class="i step__arrow"')}` +
          `<div class="step">${icon('mic')}<b>跟读录音</b><small>空格开始，再按一次结束</small></div>${icon('right').replace('class="i"', 'class="i step__arrow"')}` +
          `<div class="step">${icon('seal')}<b>看结果</b><small>点一个词，看问题和讲解</small></div>`,
      });
      result.append(metrics, h('div', { class: 'card words-card' }, words, h('div', { class: 'legend-row', html: legendHTML })), steps);
    }
    pending();

    function show(take) {
      result.textContent = '';
      const metrics = h('div', { class: 'metrics' });
      renderMetrics(metrics, take, true);
      const words = h('div', { class: 'words' });
      const legend = h('div', { class: 'legend-row', html: legendHTML });
      const detail = h('div', { class: 'card detail' });
      result.append(metrics, h('div', { class: 'card words-card' }, words, legend), detail);
      const els = renderWords(words, take, (i) => pick(i));
      stagger(els, 60, 150);
      function pick(i) {
        els.forEach((e, j) => e.setAttribute('aria-pressed', String(i === j)));
        renderDetail(detail, TAKES[take].words[i]);
      }
      const first = TAKES[take].words.findIndex((w) => status(w) !== 'ok');
      pick(Math.max(0, first));
    }

    function renderDetail(box, w) {
      const p = problem(w), st = p ? p.st : 'ok', name = w.w.replace(/\.$/, '');
      box.className = 'card detail detail--' + (st === 'miss' ? 'err' : st);
      box.innerHTML =
        `<div class="detail__head"><b>${name}</b><span class="ipa std">${ipaStd(w)}</span><span class="tag tag--${st}">${STATUS[st]}</span></div>` +
        (p ? `<p class="detail__what">${what(p)}</p><p class="detail__tip">${note(p)}</p>` : '<p class="detail__tip">这个词每个音都读对了。</p>') +
        `<div class="detail__play"><button class="mac-btn" type="button">${icon('speaker')}先听示范，再听你读的</button>` +
        `<span class="listen-pill" data-a>${icon('play')}示范</span><span class="listen-pill" data-b>${icon('play')}你读的</span></div>`;
      const a = $('[data-a]', box), b = $('[data-b]', box), play = $('button', box);
      play.addEventListener('click', async () => {
        play.disabled = true;
        a.classList.add('is-on');
        await speech.say(name, 0.85);
        a.classList.remove('is-on');
        b.classList.add('is-on');
        await sleep(1100);
        b.classList.remove('is-on');
        play.disabled = false;
      });
    }

    let visible = false;
    watch(root, (v) => { visible = v; });
    return { toggle, get visible() { return visible; } };
  })();

  // ---------- 3 · coaching ----------

  {
    const sec = $('#coach');
    const coach = $('.coach', sec), issues = $('.issues', sec);
    coach.innerHTML = `<h4>${icon('bubble')}讲解</h4>
      <p class="js-line"><b>82 分</b>，需要注意的地方：</p>
      <ul>
        <li class="js-line"><b>think</b>：/θ/ 读成了 /s/。舌尖轻放在上下齿之间，往外送气摩擦；不要把舌头缩回去发成 /s/。</li>
        <li class="js-line"><b>Thursday</b>：/θ/ 读成了 /t/。舌尖放在齿间持续送气，不要像 /t/ 那样先堵住再爆破。</li>
        <li class="js-line"><b>third</b>：漏读了词尾的 /d/。舌尖抵住上齿龈，轻轻收住，不要整个吞掉。</li>
        <li class="js-line"><b>this</b>：（口音）/ð/ 舌尖要伸到齿间，同时振动声带，不要停在齿龈后面发成 /z/。</li>
        <li class="js-line"><b>is</b>：（口音）词尾的 /z/ 也要振动声带，不要清化成 /s/。</li>
        <li class="js-line"><b>month</b>：（口音）/θ/ 舌尖再往前一点，放到上下齿之间。</li>
      </ul>
      <p class="js-line">建议把这几个词单独慢读 3 遍，再连回句子：<b>think、third、Thursday</b>。</p>
      <p class="js-line"><b>节奏和语调</b>：流利度 85。</p>
      <ul>
        <li class="js-line">比示范慢 18%：先跟着慢速练熟，再逐步提到示范的速度。</li>
        <li class="js-line">Thursday 的重音在第一个音节，要读得更长、更响、音调更高。</li>
        <li class="js-line">语调有点平，句子里重要的词可以读得高一点、重一点。</li>
      </ul>`;
    const rows = [
      ['think', 'err', '/θ/ → /s/', '舌尖放到上下齿之间送气'],
      ['Thursday', 'err', '/θ/ → /t/', '持续送气，不要先堵住再爆破'],
      ['third', 'miss', '/d/', '词尾舌尖抵住齿龈收住'],
      ['this', 'acc', '/ð/', '舌尖伸到齿间，同时振动声带'],
      ['is', 'acc', '/z/', '词尾保持浊音'],
      ['month', 'acc', '/θ/', '舌尖再往前一点'],
    ];
    issues.innerHTML = `<h4>所有问题</h4><table><thead><tr><th>词</th><th>问题</th><th>怎么改</th></tr></thead><tbody>${rows.map(([w, st, ph, fix]) =>
      `<tr><td><b>${w}</b></td><td><span class="tag tag--${st}">${STATUS[st]}</span> ${ph}</td><td>${fix}</td></tr>`).join('')}</tbody></table>`;

    const tabs = $$('.tabs [data-tab]', sec);
    tabs.forEach((t) => t.addEventListener('click', () => {
      tabs.forEach((x) => x.setAttribute('aria-selected', String(x === t)));
      coach.hidden = t.dataset.tab !== 'coach';
      issues.hidden = t.dataset.tab !== 'issues';
    }));
    const lines = $$('.js-line', coach);
    if (!still()) lines.forEach((l) => l.classList.add('is-hidden'));
    hooks.coach = { enter: once(() => lines.forEach((l, i) => setTimeout(() => l.classList.remove('is-hidden'), 300 + i * 140))) };

    const PITFALLS = [
      ['th', '/θ/ 常读成 /s/、/f/、/t/；/ð/ 常读成 /z/、/d/', '舌尖轻放在上下齿之间、稍伸出一点，气流从舌齿缝隙中送出；/ð/ 同时振动声带。不要把舌头缩回去。', 'think · this · Thursday'],
      ['v 和 w', '/v/ 常读成 /w/', '/v/ 上齿轻咬下唇并振动声带；/w/ 是双唇收圆向前突出，不碰牙齿。', 'very · view · village'],
      ['长短元音', '/ɪ/ 和 /iː/ 分不清', '/ɪ/（ship）短而放松，嘴角不往两边拉；/iː/（sheep）嘴角拉开、舌头抬高，并且拖长一点。', 'ship · sheep · sit · seat'],
      ['l 和 n', '/l/ 和 /n/ 混着读', '/n/ 舌尖抵上齿龈，气流从鼻腔出（捏住鼻子会发不出）；/l/ 气流从舌头两侧出，不走鼻腔。', 'nine · lovely · light'],
      ['l 和 r', '/r/ 常读成 /l/', '/r/ 舌尖向上卷但不碰上颚，嘴唇微圆；/l/ 是舌尖贴住上齿龈。', 'red · lorry · road'],
      ['词尾辅音', '词尾的 /d/、/k/、/z/ 被吞掉或清化', '词尾辅音也要读出来；/z/、/d/、/ɡ/ 这样的浊音要保持声带振动，前面的元音可以稍微拉长。', 'looked · asked · apples'],
      ['n 和 ŋ', '/n/ 和 /ŋ/ 混着读', '/ŋ/（sing）舌根抬起抵住软腭，像「昂」的韵尾；/n/ 是舌尖抵住上齿龈收尾。', 'thinking · in · sing'],
    ];
    const chips = $('.pitfalls .chips', sec), card = $('.pitfall', sec);
    const chipEls = PITFALLS.map(([name], i) => {
      const c = h('button', { class: 'chip', type: 'button', role: 'tab', 'aria-selected': 'false', onclick: () => pick(i) }, name);
      chips.append(c);
      return c;
    });
    function pick(i) {
      const [name, from, tip, eg] = PITFALLS[i];
      chipEls.forEach((c, j) => c.setAttribute('aria-selected', String(i === j)));
      card.innerHTML = `<b>${name}</b><p class="from">常见：${from}</p><p>${tip}</p><p class="fine">例词：${eg}</p>`;
    }
    pick(0);
  }

  // ---------- 4 · articulation ----------

  if (window.OMMouth) {
    const { Mouth, shapes, PHONES } = window.OMMouth;
    const sec = $('#mouth');
    const big = new Mouth($('.mouth--big', sec));
    const [miniStd, miniYou] = $$('.mouth--mini', sec).map((s) => new Mouth(s, { labels: false }));
    const wordsBox = $('[data-words-guide]', sec), phonesBox = $('[data-phones]', sec), tipEl = $('.guide__tip', sec);
    const cmpTitle = $('.compare__title', sec), capStd = $('[data-std]', sec), capYou = $('[data-you]', sec);
    const figs = $$('.compare figure', sec);

    // the app's own one-line descriptions of each sound
    const TIPS = {
      'θ': '舌尖轻放在上下齿之间、稍伸出一点，气流从舌齿缝隙中送出，声带不振动。',
      'ð': '和 /θ/ 一样舌尖在齿间，同时声带振动；不要缩回去发成 /z/ 或 /d/。',
      'ɪ': '比 /iː/ 放松：嘴和牙齿张开一点，舌位稍低，嘴角不用力，短促。',
      'ŋ': '舌后部抵住软腭，软腭放下，气流从鼻腔出（像汉语「昂」的尾音），不要发出 /ɡ/。',
      'k': '舌后部抬起抵住软腭，憋住气再弹开，声带不振动。',
      's': '舌尖靠近上齿龈但不碰到，留一条窄缝送气，牙齿几乎合拢，声带不振动。',
      'z': '和 /s/ 一样舌尖靠近齿龈留窄缝，但声带振动（像蜜蜂的嗡嗡声）。',
      'v': '和 /f/ 口型一样（上齿咬下唇），但声带振动，摸喉咙有震感。',
      'w': '双唇收圆向前突出（像吹口哨），舌后部抬高，然后马上滑向后面的元音；不要用牙齿碰嘴唇。',
      'e': '嘴比 /ɪ/ 再张开一些，舌头放平、舌尖轻抵下齿。',
      'r': '舌尖向上卷起、靠近但不碰上颚，舌身往后缩，嘴唇微微撅起；不要发成 /l/ 或 /w/。',
      'i': '嘴角拉开，舌面高而靠前，但短而轻（happy 的结尾）。',
      'l': '舌尖抵住上齿龈，气流从舌头两侧流出，声带振动；词尾的 l 舌身要往后抬。',
      'n': '舌尖抵住上齿龈，软腭放下，气流从鼻腔出，声带振动。',
      'aɪ': '从大口型 /a/ 滑向 /ɪ/，下巴从低抬到高。',
      't': '舌尖抵住上齿龈（上门牙后面的牙床），憋住气再弹开，声带不振动。',
      'ʃ': '嘴唇向前撅出、上下齿几乎合拢，舌身抬向硬腭前部，舌尖在齿龈后面，送气。',
      'iː': '嘴角向两边拉开，舌面抬高靠前，拉长。',
      'p': '双唇闭紧，憋住气再突然张开；声带不振动，有一股气冲出来。',
      'd': '和 /t/ 一样舌尖抵住上齿龈再弹开，但声带振动。',
    };
    const WORDS = [
      { w: 'think', ph: ['θ', 'ɪ', 'ŋ', 'k'], bad: 0, you: 's', st: 'err' },
      { w: 'this', ph: ['ð', 'ɪ', 's'], bad: 0, you: 'z', st: 'acc' },
      { w: 'very', ph: ['v', 'e', 'r', 'i'], bad: 0, you: 'w', st: 'err' },
      { w: 'light', ph: ['l', 'aɪ', 't'], bad: 0, you: 'n', st: 'err' },
      { w: 'sheep', ph: ['ʃ', 'iː', 'p'], bad: 1, you: 'ɪ', st: 'acc' },
      { w: 'red', ph: ['r', 'e', 'd'], bad: 0, you: 'l', st: 'err' },
    ];
    let wi = 0, token = 0, phoneEls = [];
    const last = (sym) => { const s = shapes(sym); return s[s.length - 1]; };

    const wordEls = WORDS.map((w, i) => {
      const b = h('button', { class: 'chip ' + (w.st === 'err' ? 'has-err' : 'has-acc'), type: 'button', role: 'tab', 'aria-selected': 'false', onclick: () => selectWord(i, true) }, w.w);
      wordsBox.append(b);
      return b;
    });

    function selectWord(i, play) {
      wi = i;
      const w = WORDS[i];
      wordEls.forEach((b, j) => b.setAttribute('aria-selected', String(i === j)));
      phonesBox.textContent = '';
      phoneEls = w.ph.map((sym, j) => {
        const b = h('button', { class: 'chip' + (j === w.bad ? ' is-bad' : ''), type: 'button', role: 'tab', 'aria-selected': 'false', 'aria-label': `/${sym}/` + (j === w.bad ? '，读得不对' : ''), onclick: () => { token++; clearNow(); showPhone(j); } }, `/${sym}/`);
        phonesBox.append(b);
        return b;
      });
      const std = w.ph[w.bad];
      cmpTitle.textContent = `这个词里的 /${std}/ ${w.st === 'err' ? '读错了' : '有口音'}，打分后并排对比：`;
      capStd.textContent = `标准 /${std}/`;
      capYou.textContent = `你接近 /${w.you}/`;
      capYou.className = 'you';
      miniStd.set(last(std));
      miniYou.set(last(w.you));
      if (play) playWord(); else showPhone(w.bad, false);
    }

    const clearNow = () => phoneEls.forEach((b) => b.classList.remove('is-now'));

    function showPhone(j, animate) {
      const sym = WORDS[wi].ph[j];
      phoneEls.forEach((b, k) => b.setAttribute('aria-selected', String(j === k)));
      if (animate === false || still()) big.set(last(sym)); else big.to(last(sym), 280);
      tipEl.innerHTML = `<b class="ipa">/${sym}/</b>　${TIPS[sym] || ''}`;
    }

    async function playWord() {
      const my = ++token, w = WORDS[wi];
      if (still()) { showPhone(w.bad, false); return; }
      phoneEls.forEach((b) => b.setAttribute('aria-selected', 'false'));
      await big.to(PHONES.rest, 220);
      for (let j = 0; j < w.ph.length; j++) {
        if (my !== token) return;
        clearNow();
        phoneEls[j].classList.add('is-now');
        tipEl.innerHTML = `<b class="ipa">/${w.ph[j]}/</b>　${TIPS[w.ph[j]] || ''}`;
        for (const s of shapes(w.ph[j])) { await big.to(s, 230); if (my !== token) return; }
        await sleep(520);
      }
      if (my !== token) return;
      clearNow();
      await sleep(200);
      if (my === token) showPhone(w.bad);
    }

    figs[0].addEventListener('click', () => { token++; clearNow(); showPhone(WORDS[wi].bad); });
    figs[1].addEventListener('click', () => {
      token++; clearNow();
      const you = WORDS[wi].you;
      phoneEls.forEach((b) => b.setAttribute('aria-selected', 'false'));
      if (still()) big.set(last(you)); else big.to(last(you), 280);
      tipEl.innerHTML = `<b class="ipa">你接近的 /${you}/</b>　${TIPS[you] || ''}`;
    });
    $('[data-replay]', sec).addEventListener('click', () => playWord());

    selectWord(0, false);
    hooks.mouth = { enter: once(() => setTimeout(() => playWord(), 700)) };
  }

  // ---------- 5 · rhythm and intonation ----------

  if (window.OMMouth) {
    const spline = window.OMMouth.spline;
    const sec = $('#rhythm');
    const svg = $('.pitch', sec), stats = $('.rhythm__stats', sec), tips = $('.tips', sec);
    const NS = 'http://www.w3.org/2000/svg';
    const el = (n, a, p) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };

    const WORDS = [['I', 0.8], ['think', 1.25], ['this', 1], ['is', 0.8], ['the', 0.75], ['third', 1.25], ['Thursday', 2], ['of', 0.8], ['the', 0.75], ['month', 1.4]];
    const REF = [[0.5, 0.52], [0.62, 0.8, 0.86, 0.74], [0.66, 0.58, 0.5], [0.46, 0.42], [0.4, 0.38], [0.48, 0.66, 0.76, 0.7], [0.72, 0.82, 0.78, 0.58, 0.48, 0.42], [0.36, 0.34], [0.33, 0.34], [0.46, 0.6, 0.52, 0.3, 0.16]];
    const YOU = [
      [[0.47, 0.5], [0.54, 0.6, 0.58, 0.55], [0.55, 0.53, 0.52], [0.5, 0.49], [0.48, 0.47], [0.5, 0.55, 0.56, 0.54], [0.5, 0.52, 0.51, 0.56, 0.64, 0.62], [0.5, 0.49], [0.49, 0.5], [0.52, 0.55, 0.53, 0.5, 0.47]],
      [[0.5, 0.53], [0.6, 0.76, 0.82, 0.72], [0.64, 0.57, 0.5], [0.47, 0.43], [0.41, 0.39], [0.5, 0.64, 0.72, 0.68], [0.7, 0.8, 0.76, 0.58, 0.5, 0.45], [0.38, 0.36], [0.35, 0.36], [0.47, 0.58, 0.5, 0.34, 0.26]],
    ];
    const INFO = [
      {
        stats: '流利度 85 · 语速 3.1 音节/秒 · 停顿 1 次 · 语调相似度 68',
        tips: [
          ['bulb', '比示范慢 18%：先跟着慢速练熟，再逐步提到示范的速度'],
          ['bulb', '在「the」和「third」之间停了 0.5 秒：这里不该停，把 the third 连起来读'],
          ['bulb', '「Thursday」/ˈθɜːrzdeɪ/ 的重音在第一个音节，你读得最突出的是 -day：重读音节要更长、更响、音调更高'],
          ['bulb', '声音的高低起伏比示范小很多，听起来偏平：重读的词音调要抬高'],
        ],
      },
      {
        stats: '流利度 91 · 语速 3.6 音节/秒 · 停顿 0 次 · 语调相似度 83',
        tips: [
          ['check', '语速和示范差不多，中间没有多余的停顿'],
          ['check', '「Thursday」的重音放对了'],
          ['bulb', '句尾「month」还可以再降一点：陈述句的句尾音调要落下来'],
        ],
      },
    ];

    const X0 = 6, X1 = 594, Y = (v) => 166 - v * 148;
    const total = WORDS.reduce((a, w) => a + w[1], 0);
    let x = X0;
    const cols = WORDS.map(([w, wd]) => { const c = { w, x0: x, x1: x + ((X1 - X0) * wd) / total }; x = c.x1; return c; });
    const pts = (c, vals) => {
      const a = c.x0 + (c.x1 - c.x0) * 0.1, b = c.x1 - (c.x1 - c.x0) * 0.1;
      return vals.map((v, i) => [a + ((b - a) * i) / (vals.length - 1), Y(v)]);
    };

    const hot = el('rect', { class: 'hot', x: cols[6].x0 + 2, y: 8, width: cols[6].x1 - cols[6].x0 - 4, height: 166, rx: 6 }, svg);
    cols.forEach((c, i) => { if (i) el('line', { class: 'grid', x1: c.x0, x2: c.x0, y1: 8, y2: 176 }, svg); });
    el('line', { class: 'base', x1: X0, x2: X1, y1: Y(0.5), y2: Y(0.5) }, svg);
    const pauseX = cols[4].x1;
    const pause = el('g', {}, svg);
    el('rect', { class: 'pause-bar', x: pauseX - 6, y: 22, width: 12, height: 150, rx: 4 }, pause);
    el('text', { class: 'pause-mark', x: pauseX, y: 16, 'text-anchor': 'middle' }, pause).textContent = '停 0.5 秒';
    const labels = cols.map((c) => {
      const t = el('text', { class: 'wlabel', x: (c.x0 + c.x1) / 2, y: 198, 'text-anchor': 'middle' }, svg);
      t.textContent = c.w;
      return t;
    });
    const refPaths = cols.map((c, i) => el('path', { class: 'ref', d: spline(pts(c, REF[i]), false) }, svg));
    let cur = YOU[0].map((a) => a.slice());
    const youPaths = cols.map((c, i) => el('path', { class: 'you', d: spline(pts(c, cur[i]), false) }, svg));

    const setYou = (vals) => youPaths.forEach((p, i) => p.setAttribute('d', spline(pts(cols[i], vals[i]), false)));
    let morphRaf = 0, take = 0;
    function morph(to) {
      cancelAnimationFrame(morphRaf);
      const from = cur.map((a) => a.slice()), goal = YOU[to];
      if (still()) { cur = goal.map((a) => a.slice()); setYou(cur); return; }
      const t0 = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - t0) / 650), e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        cur = from.map((a, i) => a.map((v, j) => v + (goal[i][j] - v) * e));
        setYou(cur);
        if (t < 1) morphRaf = requestAnimationFrame(step);
      };
      morphRaf = requestAnimationFrame(step);
    }
    function info(t) {
      stats.textContent = INFO[t].stats;
      tips.innerHTML = INFO[t].tips.map(([ic, text]) => `<li class="${ic === 'check' ? 'ok' : ''}">${icon(ic)}<span>${text}</span></li>`).join('');
      stagger($$('li', tips), 110, 100);
      const first = t === 0;
      hot.style.opacity = first ? '1' : '0';
      pause.style.opacity = first ? '1' : '0';
      labels[6].classList.toggle('is-hot', first);
    }
    info(0);

    // draw the curves once, left to right
    const drawn = [...refPaths, ...youPaths];
    let drawing = false;
    const undraw = () => drawn.forEach((p) => { p.classList.remove('draw', 'is-drawn'); p.style.removeProperty('--len'); p.style.transitionDelay = ''; });
    if (!still()) {
      drawing = true;
      drawn.forEach((p, k) => {
        p.style.setProperty('--len', Math.ceil(p.getTotalLength() + 2));
        p.style.transitionDelay = (k % cols.length) * 110 + (k >= cols.length ? 260 : 0) + 'ms';
        p.classList.add('draw');
      });
    }
    hooks.rhythm = {
      enter: once(() => {
        if (!drawing) return;
        requestAnimationFrame(() => drawn.forEach((p) => p.classList.add('is-drawn')));
        setTimeout(() => { undraw(); drawing = false; }, 3400);
      }),
    };

    const segBtns = $$('.seg button', sec);
    segBtns.forEach((b) => b.addEventListener('click', () => {
      const t = Number(b.dataset.take) - 1;
      if (t === take) return;
      take = t;
      segBtns.forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      if (drawing) { undraw(); drawing = false; }
      morph(t);
      info(t);
    }));
  }

  // ---------- 6 · long lines in pieces ----------

  {
    const root = $('#pieces-demo');
    const PIECES = [
      { t: "It's nice to meet you.", s: 95 },
      { t: "I'd like a cup of coffee, please.", s: 88 },
      { t: 'Could you tell me how to get to the station?', s: 81 },
    ];
    const WHOLE = 86;
    const sentence = $('.sentence--pieces', root), list = $('.pieces__list', root), status = $('.pieces__status', root);
    const rec = $('.rec-btn', root);
    PIECES.forEach((p, i) => { sentence.append(h('span', { class: 'piece' }, p.t)); if (i < PIECES.length - 1) sentence.append(' '); });
    const items = PIECES.map((p, i) => ({ n: String(i + 1), t: p.t, s: p.s })).concat([{ n: '全', t: '整句', s: WHOLE, whole: true }]);
    const btns = items.map((it, i) => {
      const b = h('button', { class: 'piece-btn' + (it.whole ? ' piece-btn--whole' : ''), type: 'button', role: 'tab', 'aria-selected': 'false', onclick: () => select(i) },
        h('span', { class: 'n' }, it.n), h('span', { class: 't' }, it.t), h('span', { class: 'slot' }));
      list.append(b);
      return b;
    });
    let cur = 0, busy = false, nextTimer = 0;
    function select(i) {
      clearTimeout(nextTimer);
      cur = i;
      const whole = items[i].whole;
      btns.forEach((b, j) => b.setAttribute('aria-selected', String(i === j)));
      sentence.classList.toggle('has-focus', !whole);
      $$('.piece', sentence).forEach((s, j) => s.classList.toggle('is-on', j === i));
      status.textContent = whole ? '把整句连起来读。只有整句的成绩会记下来。' : `第 ${i + 1} 段：只听、只读、只评这一段。点麦克风开始。`;
    }
    rec.addEventListener('click', async () => {
      if (busy) return;
      busy = true;
      speech.stop();
      const i = cur, it = items[i];
      rec.classList.add('is-rec');
      status.textContent = '录音中…';
      await sleep(still() ? 400 : 1500);
      rec.classList.remove('is-rec');
      rec.classList.add('is-busy');
      status.textContent = '打分中…';
      await sleep(still() ? 200 : 700);
      rec.classList.remove('is-busy');
      const slot = $('.slot', btns[i]);
      slot.textContent = '';
      slot.append(h('span', { class: `badge ${tint(it.s)} is-new` }, String(it.s)));
      busy = false;
      if (it.whole) { status.textContent = `整句 ${it.s} 分，记入这一句的成绩。`; return; }
      const nextI = i + 1;
      status.textContent = nextI < PIECES.length ? `第 ${i + 1} 段 ${it.s} 分，接着练第 ${nextI + 1} 段。` : `第 ${i + 1} 段 ${it.s} 分。三段都练过了，连起来读整句吧。`;
      nextTimer = setTimeout(() => { if (cur === i) { select(nextI); } }, 1300);
    });
    $('[data-say-piece]', root).addEventListener('click', async (e) => {
      const b = e.currentTarget;
      b.classList.add('is-playing');
      await speech.say(items[cur].whole ? PIECES.map((p) => p.t).join(' ') : items[cur].t, 1);
      b.classList.remove('is-playing');
    });
    select(0);
  }

  // ---------- 7 · auto shadowing ----------

  const auto = (() => {
    const root = $('#auto-demo');
    const LESSON = [
      { t: S1, s: 88 },
      { t: 'Thank you for thinking of them.', s: 93 },
      { t: 'The weather is better than that.', s: 79 },
    ];
    const list = $('.auto__list', root);
    const lis = LESSON.map((x) => { const li = h('li', null, h('span', null, x.t), h('span', { class: 'slot' })); list.append(li); return li; });
    const steps = $$('.flow li', root), sentence = $('.auto__sentence', root), bar = $('.auto__bar', root), barFill = $('.auto__bar i', root);
    const meterBox = $('.meter--auto', root), beep = $('.auto__beep', root), statusEl = $('.auto__status', root), toggleBtn = $('[data-auto-toggle]', root);
    const meter = makeMeter(meterBox, 30);
    let visible = false, paused = still(), running = false;

    function setPaused(p) {
      paused = p;
      toggleBtn.classList.toggle('is-paused', p);
      $('span', toggleBtn).textContent = p ? (running ? '继续' : '开始自动跟读') : '暂停';
      if (p && running) statusEl.dataset.prev = statusEl.textContent;
    }
    // wait `ms` of running time: the clock stops while paused or scrolled away
    async function tick(ms, fn) {
      let t = 0;
      while (t < ms) {
        await sleep(100);
        if (!visible || paused) continue;
        t += 100;
        if (fn) fn(Math.min(1, t / ms));
      }
    }
    const step = (name) => steps.forEach((s) => s.classList.toggle('is-now', s.dataset.step === name));

    async function loop() {
      if (running) return;
      running = true;
      for (;;) {
        lis.forEach((li) => { $('.slot', li).textContent = ''; });
        for (let i = 0; i < LESSON.length; i++) {
          lis.forEach((li, j) => li.classList.toggle('is-now', i === j));
          sentence.textContent = LESSON[i].t;
          step('listen');
          statusEl.textContent = `第 ${i + 1}/${LESSON.length} 句 · 播放示范`;
          bar.classList.add('is-on');
          await tick(2000, (p) => { barFill.style.transform = 'scaleX(' + p + ')'; });
          bar.classList.remove('is-on');
          barFill.style.transform = 'scaleX(0)';
          beep.classList.add('is-on');
          statusEl.textContent = '「嘀」一声，开始跟读';
          await tick(600);
          beep.classList.remove('is-on');
          step('read');
          statusEl.textContent = '跟读中…读完稍停一下，自动结束录音';
          meterBox.classList.add('is-on');
          await tick(2400, () => meter.tick());
          meterBox.classList.remove('is-on');
          meter.stop();
          step('score');
          statusEl.textContent = '打分中…';
          await tick(700);
          const s = LESSON[i].s;
          $('.slot', lis[i]).append(h('span', { class: `badge ${tint(s)} is-new` }, String(s)));
          statusEl.textContent = `这一句 ${s} 分`;
          await tick(1100);
          const end = i === LESSON.length - 1;
          step(end ? null : 'next');
          statusEl.textContent = end ? '整课读完，自动停下来' : '几秒后进入下一句';
          await tick(end ? 2600 : 800);
        }
      }
    }

    sentence.textContent = LESSON[0].t;
    lis[0].classList.add('is-now');
    statusEl.textContent = still() ? '点「开始自动跟读」' : '';
    setPaused(paused);
    toggleBtn.addEventListener('click', () => { setPaused(!paused); if (!paused) loop(); });
    watch(root, (v) => { visible = v; if (v && !paused) loop(); });
    return { toggle: () => toggleBtn.click(), get visible() { return visible; } };
  })();

  // space: record in the practice demo, or pause auto shadowing, like in the app
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest && e.target.closest('input, textarea, select, button, a, [contenteditable]')) return;
    if (practice.visible) { e.preventDefault(); practice.toggle(); }
    else if (auto.visible) { e.preventDefault(); auto.toggle(); }
  });

  // ---------- 8 · weak spots ----------

  {
    const root = $('#review-demo');
    const box = $('.sounds', root), forEl = $('.review__for', root), drills = $('.drills', root);
    const SOUNDS = [
      { ipa: '/θ/', n: 12, err: 5, acc: 2, as: '/s/', drills: [
        ['I <mark>th</mark>ink this is the <mark>th</mark>ird <mark>Th</mark>ursday of the mon<mark>th</mark>.', 'th 音 /θ/ /ð/ · 4 个 /θ/ · 上次在这句错过'],
        ['<mark>Th</mark>ank you for <mark>th</mark>inking of them.', 'th 音 /θ/ /ð/ · 2 个 /θ/'],
        ['I <mark>th</mark>ink this is a ship, not a sheep.', '长短元音 /ɪ/ /iː/ · 1 个 /θ/'],
      ] },
      { ipa: '/l/', n: 12, err: 4, acc: 1, as: '/n/', drills: [
        ['Nine <mark>l</mark>ove<mark>l</mark>y <mark>l</mark>ions are <mark>l</mark>ying in the <mark>l</mark>ight.', 'l、n、r · 5 个 /l/ · 上次在这句错过'],
        ['He wi<mark>ll</mark> <mark>l</mark>eave if you <mark>l</mark>ive here.', '长短元音 /ɪ/ /iː/ · 3 个 /l/'],
        ['The red <mark>l</mark>orry runs a<mark>l</mark>ong the road.', 'l、n、r · 2 个 /l/'],
        ["I'd <mark>l</mark>ike a cup of coffee, p<mark>l</mark>ease.", '日常句子 · 2 个 /l/'],
      ] },
      { ipa: '/v/', n: 9, err: 3, acc: 0, as: '/w/', drills: [
        ['E<mark>v</mark>ery e<mark>v</mark>ening, <mark>V</mark>i<mark>v</mark>ian wa<mark>v</mark>es at the <mark>v</mark>an.', 'v 和 w · 6 个 /v/'],
        ['We ha<mark>v</mark>e a <mark>v</mark>ery wide <mark>v</mark>iew o<mark>f</mark> the <mark>v</mark>illage.', 'v 和 w · 5 个 /v/ · 上次在这句错过'],
        ['He will lea<mark>v</mark>e if you li<mark>v</mark>e here.', '长短元音 /ɪ/ /iː/ · 2 个 /v/'],
      ] },
      { ipa: '/ɪ/', n: 15, err: 1, acc: 2, as: '/iː/', drills: [
        ['I th<mark>i</mark>nk th<mark>i</mark>s <mark>i</mark>s a sh<mark>i</mark>p, not a sheep.', '长短元音 /ɪ/ /iː/ · 4 个 /ɪ/'],
        ['Please s<mark>i</mark>t <mark>i</mark>n th<mark>i</mark>s seat.', '长短元音 /ɪ/ /iː/ · 3 个 /ɪ/'],
        ['He w<mark>i</mark>ll leave <mark>i</mark>f you l<mark>i</mark>ve here.', '长短元音 /ɪ/ /iː/ · 3 个 /ɪ/'],
      ] },
      { ipa: '/z/', n: 14, err: 0, acc: 2, as: '/s/', drills: [
        ['She picked six big red apple<mark>s</mark>.', '词尾辅音 · 1 个 /z/ · 上次在这句错过'],
        ['Every evening, Vivian wave<mark>s</mark> at the van.', 'v 和 w · 1 个 /z/'],
        ['Nine lovely lion<mark>s</mark> are lying in the light.', 'l、n、r · 1 个 /z/'],
      ] },
    ];
    const els = SOUNDS.map((s, i) => {
      const pct = Math.round(((s.n - s.err - s.acc) / s.n) * 100), t = tint(pct);
      const b = h('button', {
        class: 'sound', type: 'button', role: 'option', 'aria-selected': 'false', onclick: () => select(i),
        html: `<span class="sound__ipa">${s.ipa}</span><span class="sound__pct ${t}">对了 ${pct}%</span><span class="sound__bar"><i class="${t}"></i></span><span class="sound__note">最近 ${s.n} 次：读错 ${s.err}、有口音 ${s.acc} · 常读成 ${s.as}</span>`,
      });
      $('.sound__bar i', b).style.setProperty('--v', pct);
      box.append(b);
      return b;
    });
    function select(i) {
      els.forEach((b, j) => b.setAttribute('aria-selected', String(i === j)));
      forEl.textContent = `练 ${SOUNDS[i].ipa} 的句子（点左边的音可以切换）`;
      drills.innerHTML = SOUNDS[i].drills.map(([t, src]) => `<li><b>${t}</b><small>${src}</small></li>`).join('');
      stagger($$('li', drills), 70, 0);
    }
    select(0);
  }

  // ---------- 9 · AI assistant ----------

  {
    const chat = $('#chat');
    const log = $('.chat__log', chat), input = $('input', chat), form = $('.chat__input', chat), send = $('.send', chat), suggest = $('.chat__suggest', chat);
    const sideNew = $('#sets .side-new'), detail = $('#sets .set-detail');
    const ASK_SET = '针对我最弱的两个音做一组专项练习';
    const ASK_WHAT = '看看我最近的跟读，哪些音最需要练？';
    const ASK_WHY = '我的 /θ/ 为什么总是读成 /s/？';
    const SET = {
      title: '/θ/ 和 /l/：舌尖放在哪',
      intro: '你最近把 think、Thursday 里的 /θ/ 读成了 /s/，把 light、lovely 里的 /l/ 读成了 /n/。/θ/ 舌尖轻放在上下齿之间送气；/l/ 舌尖抵住上齿龈，气流从舌头两侧出。先慢读，再连起来读。',
      rows: [
        ['Thank you for thinking of them.', '谢谢你想着他们。', 'thank、thinking 里的 /θ/：舌尖放在齿间'],
        ['I think this is the third Thursday of the month.', '我想这是这个月的第三个星期四。', '四个 /θ/，先慢后快'],
        ['Nine lovely lions are lying in the light.', '九只可爱的狮子躺在阳光里。', 'nine 走鼻腔，lovely、lions 不走'],
        ["It's my pleasure.", '不客气。', 'pleasure 里的 /l/ 舌尖要贴住齿龈'],
        ['Please leave the light on.', '请把灯开着。', 'please、leave、light 三个 /l/'],
        ["I'd like a cup of coffee, please.", '请给我一杯咖啡。', 'like、please 的 /l/ 不要带鼻音'],
        ['The red lorry runs along the road.', '那辆红色卡车沿着路开。', 'lorry、along 是 /l/，red、runs 是 /r/'],
        ['I think this is a ship, not a sheep.', '我想这是一艘船，不是一只羊。', 'think 的 /θ/ 别读成 sink'],
      ],
    };
    let bot = 'Claude', busy = false, token = 0, setItem = null;

    const pause = (ms) => sleep(still() ? Math.min(ms, 250) : ms);
    function add(node) {
      node.classList.add('is-hidden');
      log.append(node);
      log.scrollTop = log.scrollHeight;
      requestAnimationFrame(() => requestAnimationFrame(() => node.classList.remove('is-hidden')));
      return node;
    }
    const me = (t) => add(h('div', { class: 'msg msg--me' }, t));
    const say = (html) => add(h('div', { class: 'msg msg--bot', html: `<span class="who">${bot}</span>${html}` }));
    const tool = (t) => add(h('div', { class: 'tool', html: `${icon('check')}${t}` }));
    async function typing(ms, my) {
      const t = add(h('div', { class: 'msg msg--bot typing', 'aria-label': '正在输入' }, h('i'), h('i'), h('i')));
      await pause(ms);
      t.remove();
      return my === token;
    }

    function showSuggestions(asked) {
      suggest.textContent = '';
      [ASK_SET, ASK_WHAT, ASK_WHY].filter((q) => q !== asked).forEach((q) => {
        suggest.append(h('button', { class: 'chip', type: 'button', onclick: () => { input.value = q; ask(q); } }, q));
      });
    }

    async function ask(q) {
      if (busy) return;
      busy = true;
      send.disabled = true;
      send.classList.remove('is-ready');
      suggest.textContent = '';
      const my = ++token;
      me(q);
      input.value = '';
      if (q === ASK_SET) {
        if (!(await typing(900, my))) return;
        tool('读取了 OpenMouth 的练习记录');
        if (!(await typing(1200, my))) return;
        say('你最近 23 次跟读里，最弱的两个音是：<ul><li><b>/θ/</b>：对了 42%，常读成 /s/</li><li><b>/l/</b>：对了 58%，常读成 /n/</li></ul>我做了一组 8 句的专项练习：先练舌尖的位置，再放进句子里。');
        await pause(700);
        if (my !== token) return;
        tool(`发送了「${SET.title}」到 OpenMouth`);
        addSet();
        await pause(500);
        if (my !== token) return;
        say('发好了，在 OpenMouth 左栏的「专项练习」里。每句下面写了要注意的地方，练完的成绩也会记进弱项复习。');
      } else if (q === ASK_WHAT) {
        if (!(await typing(900, my))) return;
        tool('读取了 OpenMouth 的练习记录');
        if (!(await typing(1200, my))) return;
        say('最需要练的是这三个：<ul><li><b>/θ/</b>：最近 12 次对了 42%，常读成 /s/（think、Thursday）</li><li><b>/l/</b>：对了 58%，常读成 /n/（light、lovely）</li><li><b>/v/</b>：对了 67%，常读成 /w/（very、view）</li></ul>建议先练 /θ/：舌尖轻放在上下齿之间送气。要不要我做一组专项练习？');
      } else {
        if (!(await typing(1100, my))) return;
        say('读 /θ/ 时你的舌尖缩在上齿龈后面，气流从舌尖和齿龈的窄缝出去，听起来就成了 /s/。<br>改法：舌尖轻轻放在上下齿之间、稍微露出一点，往外吹气，摸不到牙齿就不对。先单独慢读 think、third、Thursday，再连回句子。');
      }
      if (my !== token) return;
      busy = false;
      send.disabled = false;
      input.value = q === ASK_SET ? ASK_WHAT : ASK_SET;
      showSuggestions(input.value);
    }

    function addSet() {
      if (!setItem) {
        setItem = h('button', { class: 'side-item', type: 'button', onclick: () => openSet() },
          h('b', { html: `${SET.title}<span class="new">新</span>` }), h('small', null, `${SET.rows.length} 句 · AI 助手刚发来`));
        sideNew.append(setItem);
        if (!still()) { setItem.classList.add('is-hidden'); requestAnimationFrame(() => requestAnimationFrame(() => setItem.classList.remove('is-hidden'))); }
      }
      setTimeout(openSet, still() ? 0 : 500);
    }
    function openSet() {
      setItem.classList.add('is-active');
      detail.innerHTML = `<p class="set-intro">${icon('sparkles')}<span>${SET.intro}</span></p>` + SET.rows.map(([en, zh, tip], i) =>
        `<div class="set-row"><span>${i + 1}</span><div><b>${en}</b><small>${zh}</small><em>${icon('bulb')}${tip}</em></div></div>`).join('');
      stagger($$('.set-row', detail), 90, 100);
    }
    function reset() {
      token++;
      busy = false;
      send.disabled = false;
      log.textContent = '';
      say('你好！我能看到你在 OpenMouth 里的练习记录：分数、常错的音和最近的跟读。想先练什么？');
      input.value = ASK_SET;
      send.classList.add('is-ready');
      showSuggestions(ASK_SET);
    }

    detail.innerHTML = '<p class="set-detail__empty">AI 助手做好的练习<br>会出现在左边的「专项练习」里</p>';
    form.addEventListener('submit', (e) => { e.preventDefault(); if (input.value) ask(input.value); });
    const bots = $$('.seg button', chat);
    bots.forEach((b) => b.addEventListener('click', () => {
      bot = b.dataset.bot;
      bots.forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      reset();
    }));
    reset();
  }

  // ---------- 10 · importing, moving to a new Mac ----------

  {
    const tile = $('#import');
    const filesEl = h('div', { class: 'import__files' });
    $('.import', tile).prepend(filesEl);
    const fileEl = $('.import__file', tile), out = $('.import__out', tile);
    const zh = (t) => `<span class="zh">${t}</span>`, tm = (t) => `<span class="tm">${t}</span>`;
    const FORMATS = {
      txt: {
        files: ['Unit 1.txt'],
        text: `How are you today? ${zh('你今天好吗？')}\nIt costs 25 dollars.\n${zh('这个要 25 美元。')}\nTom: Good morning, Lucy.\nLucy: Good morning, Tom.`,
        rows: [['How are you today?', '你今天好吗？'], ['It costs 25 dollars.', '这个要 25 美元。'], ['Good morning, Lucy.', '', 'Tom'], ['Good morning, Tom.', '', 'Lucy']],
        src: '合成语音',
      },
      lrc: {
        files: ['Unit 2.lrc', 'Unit 2.mp3'],
        text: `${tm('[00:01.20]')}How are you today? ${zh('你今天好吗？')}\n${tm('[00:04.80]')}Fine, thank you. ${zh('很好，谢谢。')}\n${tm('[00:07.50]')}It's nice to meet you. ${zh('很高兴认识你。')}`,
        rows: [['How are you today?', '你今天好吗？', '', '0:01'], ['Fine, thank you.', '很好，谢谢。', '', '0:04'], ["It's nice to meet you.", '很高兴认识你。', '', '0:07']],
        src: '原声',
      },
      srt: {
        files: ['Unit 3.srt', 'Unit 3.m4a'],
        text: `1\n${tm('00:00:01,200 --> 00:00:03,900')}\nCould you tell me how to get to the station?\n${zh('你能告诉我怎么去车站吗？')}\n\n2\n${tm('00:00:04,500 --> 00:00:06,800')}\nI'd like a cup of coffee, please.\n${zh('请给我一杯咖啡。')}`,
        rows: [['Could you tell me how to get to the station?', '你能告诉我怎么去车站吗？', '', '0:01'], ["I'd like a cup of coffee, please.", '请给我一杯咖啡。', '', '0:04']],
        src: '原声',
      },
    };
    function show(key) {
      const f = FORMATS[key];
      filesEl.innerHTML = f.files.map((n) => `<span>${icon(/\.(mp3|m4a)$/.test(n) ? 'wave' : 'doc')}${n}</span>`).join('');
      fileEl.innerHTML = f.text;
      out.innerHTML = f.rows.map(([en, cn, who, at], i) =>
        `<li><span class="n">${i + 1}</span><div>${who ? `<span class="who">${who}:</span>` : ''}${en}${cn ? `<small>${cn}</small>` : ''}</div><span class="src">${icon(f.src === '原声' ? 'wave' : 'speaker')}${f.src}${at ? ' ' + at : ''}</span></li>`).join('');
      stagger($$('li', out), 90, 120);
    }
    const fmtBtns = $$('[data-fmt]', tile);
    fmtBtns.forEach((b) => b.addEventListener('click', () => {
      fmtBtns.forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      show(b.dataset.fmt);
    }));
    show('txt');

    const backup = $('#backup');
    const go = $('[data-backup]', backup), file = $('.move__file', backup), done = $('.move__done', backup), newMac = $('.mac--new', backup);
    go.addEventListener('click', async () => {
      go.disabled = true;
      done.textContent = '';
      newMac.classList.remove('is-done');
      file.classList.remove('is-going');
      void file.offsetWidth;
      file.classList.add('is-going');
      await sleep(still() ? 100 : 1700);
      newMac.classList.add('is-done');
      done.textContent = '导入完成：3 门课程、142 句成绩和录音；12 句保留了更好的成绩';
      go.textContent = '再来一次';
      go.disabled = false;
    });
  }

  // ---------- 11 · accuracy ----------

  {
    const grid = $('.dotgrid');
    const FALSE = new Set([31, 118, 187, 262]); // about 1.4% of 300, spread out
    for (let k = 0, n = 0; k < 300; k++) {
      const d = h('i');
      if (FALSE.has(k)) { d.className = 'is-false'; d.style.setProperty('--k', n++); }
      grid.append(d);
    }
    grid.setAttribute('aria-label', '每 300 个读对的音，大约 4 个会被误标成读错');
    grid.after(h('p', { class: 'fine' }, '每 300 个读对的音，大约 4 个会被误标'));
    const nums = $$('#accuracy [data-count]');
    hooks.accuracy = {
      enter: once(() => nums.forEach((n) => countUp(n, Number(n.dataset.count), Number(n.dataset.digits), 1300, n.dataset.suffix || ''))),
    };
  }

  // start watching sections now that every demo has registered its hooks
  sections.forEach((s) => sectionIO.observe(s));
})();
