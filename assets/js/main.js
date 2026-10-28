(function () {
  'use strict';

  // 公開前に設定する値（ここだけ書き換えればページ内のLINEボタンすべてに反映される）
  var CONFIG = {
    lineUrl: '', // 例: 'https://lin.ee/xxxxxxx'。空のあいだはお問い合わせ欄へスクロールする
    lineOaId: '' // 例: '@abc1234'。入れると質問チップを押したとき、その文章が入った状態でLINEが開く
  };
  window.LP_CONFIG = CONFIG;

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  var Sound = window.LPSound;

  if (CONFIG.lineUrl) {
    document.querySelectorAll('.js-line').forEach(function (a) { a.href = CONFIG.lineUrl; a.target = '_blank'; a.rel = 'noopener'; });
  }

  // ---------- 計測（GTMを入れれば dataLayer 経由でGA4へ） ----------
  window.dataLayer = window.dataLayer || [];
  function track(event, params) {
    var p = { event: event }; for (var k in params) p[k] = params[k]; window.dataLayer.push(p);
  }
  document.querySelectorAll('[data-cta]').forEach(function (el) {
    el.addEventListener('click', function () { track('cta_click', { cta_type: el.getAttribute('data-cta'), cta_position: el.getAttribute('data-cta-pos') || '' }); });
  });
  if ('IntersectionObserver' in window) {
    var sio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { track('section_view', { section_name: e.target.getAttribute('data-section') }); sio.unobserve(e.target); } });
    }, { threshold: 0.25 });
    document.querySelectorAll('[data-section]').forEach(function (el) { sio.observe(el); });
  }

  // ---------- サウンド ----------
  var soundBtn = document.querySelector('.sound');
  soundBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    var on = Sound.toggle();
    soundBtn.classList.toggle('is-on', on);
    soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    soundBtn.querySelector('.sound__label').textContent = on ? 'SOUND ON' : 'SOUND OFF';
    track('sound_toggle', { state: on ? 'on' : 'off' });
  });
  // クリックした場所に波紋＋水滴音（音はボタンやリンクを押したときだけ。画面のどこを触っても鳴ると耳障りなため）
  document.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target.closest && e.target.closest('a, button, summary, input, label') && !e.target.closest('.sound')) Sound.play('drop');
    if (reduceMotion || !hasGsap) return;
    var r = document.createElement('span');
    r.className = 'ripple'; r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px';
    document.body.appendChild(r);
    window.gsap.fromTo(r, { scale: 0.4, opacity: 1 }, { scale: 7, opacity: 0, duration: 0.8, ease: 'power2.out', onComplete: function () { r.remove(); } });
  }, { passive: true });

  // ---------- ヘッダー／下部固定ボタン ----------
  var header = document.querySelector('.header');
  var sticky = document.querySelector('.sticky');
  var hero = document.querySelector('.hero');
  var lastY = 0;
  window.addEventListener('scroll', function () {
    var y = window.scrollY;
    // スマホはハンバーガーを常に押せるよう、ヘッダーを隠さない
    header.classList.toggle('is-hide', window.innerWidth >= 1100 && y > 400 && y > lastY);
    header.classList.toggle('is-scrolled', y > 60);
    lastY = y;
    if (sticky) sticky.classList.toggle('is-show', y > hero.offsetHeight * 0.7);
  }, { passive: true });

  // ---------- ハンバーガーメニュー ----------
  var burger = document.querySelector('.burger');
  var menu = document.querySelector('.menu');
  function setMenu(open) {
    document.body.classList.toggle('is-menu', open);
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    burger.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
    menu.setAttribute('aria-hidden', open ? 'false' : 'true');
    header.classList.remove('is-hide');
    if (open) { Sound.play('sw'); track('menu_open', {}); }
  }
  burger.addEventListener('click', function () { setMenu(!document.body.classList.contains('is-menu')); });
  menu.querySelectorAll('a').forEach(function (a, i) {
    a.style.transitionDelay = (0.15 + i * 0.04) + 's';
    a.addEventListener('click', function () { setMenu(false); });
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });

  // ---------- 進捗バー ----------
  var bar = document.querySelector('.progress i');
  function drawProgress() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = 'scaleX(' + (max > 0 ? window.scrollY / max : 0) + ')';
  }
  window.addEventListener('scroll', drawProgress, { passive: true });

  // ---------- 右下のLINEボタン ----------
  // ファーストビューを過ぎたら出す／お問い合わせ欄が見えている間は引っ込める／止まると一言しゃべる
  var fline = document.querySelector('.fline');
  var flineMsg = fline.querySelector('.fline__msg');
  var contactEl = document.querySelector('#contact');
  var MESSAGES = {
    '02_about': '気軽に聞いてね', '03_role': '気軽に聞いてね', '04_numbers': '気軽に聞いてね',
    '05_work': '仕事のこと、聞いてみる？', '06_team': '見学もできるよ', '07_growth': '未経験でも大丈夫？って聞いてOK',
    '08_career': '資格のことも聞けるよ', '09_projects': '気軽に聞いてね', '10_workstyle': '休みのこと、聞いてみる？',
    '11_message': '社長にも聞けるよ', '12_recruit': '給料のこと、聞いてみる？'
  };
  var currentSec = '';
  var talkTimer = null, idleTimer = null;
  function talk() {
    var msg = MESSAGES[currentSec] || '気軽に聞いてね';
    flineMsg.textContent = msg;
    fline.classList.add('is-talk', 'is-wiggle');
    clearTimeout(talkTimer);
    talkTimer = setTimeout(function () { fline.classList.remove('is-talk', 'is-wiggle'); }, 3600);
  }
  // v7：右下のLINEボタンは最初からずっと出しておく（メニューを開いている間だけ隠す）
  fline.classList.add('is-show');
  function updateFline() {
    fline.classList.remove('is-talk');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () { if (fline.classList.contains('is-show')) talk(); }, 1400);
  }
  window.addEventListener('scroll', updateFline, { passive: true });
  if ('IntersectionObserver' in window) {
    var cio2 = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) currentSec = e.target.getAttribute('data-section'); });
    }, { rootMargin: '-45% 0px -45% 0px' });
    document.querySelectorAll('[data-section]').forEach(function (el) { cio2.observe(el); });
  }
  fline.addEventListener('click', function () { track('line_float_click', { section: currentSec, message: flineMsg.textContent }); });

  // ---------- FAQ ----------
  document.querySelectorAll('.faq__q').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.closest('.faq__item'); var open = item.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) track('faq_open', { faq_question: btn.textContent.trim() });
    });
  });

  // ---------- BEFORE/AFTER ----------
  document.querySelectorAll('.ba-item').forEach(function (item) {
    var range = item.querySelector('input');
    range.addEventListener('input', function () { item.style.setProperty('--pos', range.value + '%'); });
  });

  // ---------- ON/OFF ----------
  var onoff = document.querySelector('.onoff');
  var touched = false;
  function setMode(mode) {
    onoff.classList.toggle('is-off', mode === 'off');
    onoff.querySelectorAll('.switch button').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-mode') === mode ? 'true' : 'false'); });
  }
  onoff.querySelectorAll('.switch button').forEach(function (b) {
    b.addEventListener('click', function () { touched = true; setMode(b.getAttribute('data-mode')); Sound.play('sw'); track('onoff_switch', { mode: b.getAttribute('data-mode') }); });
  });

  // ---------- フォーム ----------
  var form = document.querySelector('.form');
  var started = false;
  form.addEventListener('input', function () { if (!started) { started = true; track('form_start', {}); } });
  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    // TODO: 公開環境決定後に送信処理を実装し、成功時のみ form_submit_success を送る
    form.querySelector('.form__msg').classList.add('is-show');
  });

  function ready() { root.classList.add('is-ready'); }

  if (!hasGsap || reduceMotion) { ready(); return; }

  var gsap = window.gsap, ST = window.ScrollTrigger;
  gsap.registerPlugin(ST);
  root.classList.add('js-anim');

  // ---------- オープニング ----------
  var heroImg = document.querySelector('.hero__img');
  gsap.set('.hero__sticker', { opacity: 0, x: -60, rotate: -8 });
  gsap.set('.hero__badge', { opacity: 0, scale: .6 });
  gsap.set('.hero__photo', { opacity: 0, scale: .92 });
  var tl = gsap.timeline({ delay: .2, onStart: ready });
  // 安全策：4秒たっても演出が始まらないとき（通信が遅い・端末が演出を止めた等）は、演出なしで全部表示する
  // （「始まった」扱いになっても途中で止まることがあるので、最初の文章が実際に見えているかで判断する）
  setTimeout(function () {
    var lead = document.querySelector('.hero__lead');
    if (lead && parseFloat(getComputedStyle(lead).opacity) > 0.5) return;
    tl.kill();
    root.classList.remove('js-anim');
    gsap.set('.rv, .rv-mask, .hero__sticker, .hero__badge, .hero__photo', { clearProps: 'all' });
    ready();
  }, 4000);
  tl.to('.loader', { opacity: 0, duration: .5 })
    .to('.hero__copy .rv-mask', { clipPath: 'inset(0 0 0% 0)', duration: 1, ease: 'expo.out', stagger: .12 }, '-=.1')
    .to('.hero__photo', { opacity: 1, scale: 1, duration: 1.4, ease: 'expo.out' }, '<.1')
    .to('.hero__sticker', { opacity: 1, x: 0, rotate: 0, duration: 1.2, ease: 'back.out(1.4)' }, '<.4')
    .to('.hero__badge', { opacity: 1, scale: 1, duration: .8, ease: 'back.out(2)' }, '<.2')
    .to('.hero .rv', { opacity: 1, y: 0, duration: .9, ease: 'power3.out', stagger: .08 }, '<');
  gsap.to('.hero__badge svg', { rotate: 360, duration: 24, ease: 'none', repeat: -1, transformOrigin: '50% 50%' });
  gsap.to('.hero__under', { attr: { transform: 'translate(10 50) rotate(-4 300 280)' }, duration: 5, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  gsap.to('.hero__sticker', { y: -10, duration: 2.4, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 2 });
  gsap.to(heroImg, { attr: { y: 30 }, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

  // ---------- 出てくる演出 ----------
  ST.batch('.sec .rv, .marquee + .sec .rv, .contact .rv, .voice .rv, .pause .rv, .waiting .rv, .quick .rv, .numband .rv, .diag .rv', {
    start: 'top 88%',
    onEnter: function (els) { gsap.to(els, { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out', stagger: .08, overwrite: true }); }
  });

  // 写真のパララックス（枠の中で写真がゆっくり動く）
  gsap.utils.toArray('img.px').forEach(function (img) {
    gsap.fromTo(img, { yPercent: -8 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: img.parentNode, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  // 図形：スクロールで漂う・回る
  gsap.utils.toArray('.blob').forEach(function (el) {
    var sp = parseFloat(el.getAttribute('data-speed') || '.2'), rot = parseFloat(el.getAttribute('data-rot') || '0');
    var trg = el.closest('section') || el.parentNode;
    gsap.fromTo(el, { y: -220 * sp, rotate: -rot / 2 }, { y: 220 * sp, rotate: rot / 2, ease: 'none', scrollTrigger: { trigger: trg, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  // 大きな英字見出し：左右に少しずれる
  gsap.utils.toArray('.sec-head__en, .contact__en').forEach(function (el, i) {
    gsap.fromTo(el, { x: i % 2 ? 40 : -40 }, { x: i % 2 ? -40 : 40, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  // マーキー
  gsap.utils.toArray('.marquee__track').forEach(function (t, i) {
    var tw = i % 2
      ? gsap.fromTo(t, { xPercent: -50 }, { xPercent: 0, duration: 30, ease: 'none', repeat: -1 })
      : gsap.to(t, { xPercent: -50, duration: 30, ease: 'none', repeat: -1 });
    ST.create({ trigger: t, start: 'top bottom', end: 'bottom top', onUpdate: function (s) { tw.timeScale(1 + Math.min(Math.abs(s.getVelocity()) / 400, 4)); gsap.to(tw, { timeScale: 1, duration: .8, overwrite: true }); } });
  });

  // 切り絵イラスト：ゆっくり浮かび、コピーが1行ずつ出る
  var inter = document.querySelector('.interlude');
  if (inter) {
    gsap.fromTo('.interlude__art', { y: 60, scale: .94, opacity: 0 }, { y: -40, scale: 1, opacity: 1, ease: 'none', scrollTrigger: { trigger: inter, start: 'top bottom', end: 'bottom 40%', scrub: true } });
    gsap.from('.interlude__copy span', { yPercent: 120, opacity: 0, duration: .9, ease: 'back.out(1.6)', stagger: .15, scrollTrigger: { trigger: inter, start: 'top 60%', once: true } });
  }

  // 数字のカウントアップ
  document.querySelectorAll('[data-count]').forEach(function (el) {
    var target = parseFloat(el.getAttribute('data-count')), o = { v: 0 };
    el.textContent = '0';
    ST.create({ trigger: el, start: 'top 90%', once: true, onEnter: function () { gsap.to(o, { v: target, duration: 1.8, ease: 'power3.out', onUpdate: function () { el.textContent = Math.round(o.v); } }); } });
  });

  // ON/OFF：初めて見えたとき一度だけ自動でOFFにする
  ST.create({ trigger: onoff, start: 'top 55%', once: true, onEnter: function () { setTimeout(function () { if (!touched) setMode('off'); }, 1500); } });

  // ---------- 仕事内容：PCは横スクロール ----------
  var mm = gsap.matchMedia();
  mm.add('(min-width: 900px)', function () {
    var wrapEl = document.querySelector('.hs'), track = document.querySelector('.hs__track'), bar = document.querySelector('.hs__bar i');
    root.classList.add('js-pin');
    function dist() { return Math.max(0, track.scrollWidth - window.innerWidth + 60); }
    var tw = gsap.to(track, { x: function () { return -dist(); }, ease: 'none', scrollTrigger: { trigger: wrapEl, start: 'center center', end: function () { return '+=' + dist(); }, scrub: 1, pin: true, invalidateOnRefresh: true, onUpdate: function (s) { gsap.set(bar, { scaleX: s.progress }); } } });
    return function () { root.classList.remove('js-pin'); tw.kill(); gsap.set(track, { x: 0 }); };
  });

  // ---------- 配管ライン（ページ全体） ----------
  var main = document.querySelector('main');
  var pipe = document.querySelector('.pipe');
  var pBg = pipe.querySelector('.pipe__bg'), pFg = pipe.querySelector('.pipe__fg'), head = pipe.querySelector('.pipe__head');
  // 配管らしく見せるパーツ：外側の管・水の流れ（ハイライト）・継手
  var pShell = pipe.querySelector('.pipe__shell'), pFlow = pipe.querySelector('.pipe__flow'), pMask = pipe.querySelector('.pipe__mask');
  var maskEl = pipe.querySelector('#pipe-mask'), jointsG = pipe.querySelector('.pipe__joints');
  var SVGNS = 'http://www.w3.org/2000/svg';
  var samples = [], total = 0, joints = [];

  // 管の曲がり角の前後と、まっすぐな区間の一定間隔に継手を置く
  function buildJoints(mobile) {
    jointsG.innerHTML = ''; joints = [];
    var step = 4, every = mobile ? 300 : 420, size = mobile ? 15 : 21, thick = mobile ? 5 : 7;
    var prevAxis = null, prevPt = null, run = 0;
    function add(l, x, y, horiz) {
      var r = document.createElementNS(SVGNS, 'rect');
      r.setAttribute('x', x - (horiz ? thick : size) / 2); r.setAttribute('y', y - (horiz ? size : thick) / 2);
      r.setAttribute('width', horiz ? thick : size); r.setAttribute('height', horiz ? size : thick); r.setAttribute('rx', 2);
      jointsG.appendChild(r); joints.push({ l: l, el: r, wet: false });
    }
    for (var l = 0; l + step <= total; l += step) {
      var p = pFg.getPointAtLength(l), q = pFg.getPointAtLength(l + step);
      var dx = Math.abs(q.x - p.x), dy = Math.abs(q.y - p.y);
      var axis = dy < .2 ? 'h' : dx < .2 ? 'v' : null;
      if (axis && prevAxis === null && prevPt) { add(l, p.x, p.y, axis === 'h'); run = 0; }          // 曲がり終わり
      if (!axis && prevAxis && prevPt) { add(l, prevPt.x, prevPt.y, prevAxis === 'h'); run = 0; }    // 曲がり始め
      if (axis) { run += step; if (run >= every) { add(l, p.x, p.y, axis === 'h'); run = 0; } }
      prevAxis = axis; prevPt = p;
    }
  }

  function roundPath(pts, r) {
    var d = 'M' + pts[0][0] + ' ' + pts[0][1];
    for (var i = 1; i < pts.length - 1; i++) {
      var a = pts[i - 1], b = pts[i], c = pts[i + 1];
      var ux = Math.sign(b[0] - a[0]), uy = Math.sign(b[1] - a[1]), vx = Math.sign(c[0] - b[0]), vy = Math.sign(c[1] - b[1]);
      var rr = Math.min(r, (Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1])) / 2, (Math.abs(c[0] - b[0]) + Math.abs(c[1] - b[1])) / 2);
      d += ' L' + (b[0] - ux * rr) + ' ' + (b[1] - uy * rr) + ' Q' + b[0] + ' ' + b[1] + ' ' + (b[0] + vx * rr) + ' ' + (b[1] + vy * rr);
    }
    var l = pts[pts.length - 1];
    return d + ' L' + l[0] + ' ' + l[1];
  }

  function buildPipe() {
    var W = main.clientWidth, H = main.scrollHeight;
    pipe.setAttribute('width', W); pipe.setAttribute('height', H); pipe.setAttribute('viewBox', '0 0 ' + W + ' ' + H); pipe.style.height = H + 'px';
    var mobile = W < 768;
    var inset = mobile ? 10 : Math.max(24, (W - 1180) / 2 - 24);
    var left = inset, right = W - inset;
    var top0 = main.getBoundingClientRect().top + window.scrollY;
    var y0 = document.querySelector('.hero + .marquee').getBoundingClientRect().top + window.scrollY - top0 - 30;
    var pts = [[right, y0]], side = 'right';
    document.querySelectorAll('main > section.sec, main > section.contact').forEach(function (sec) {
      // 横に渡る管は、セクション上の余白（文字のない所）を通す
      var pad = parseFloat(getComputedStyle(sec).paddingTop) || 100;
      var y = sec.getBoundingClientRect().top + window.scrollY - top0 + pad * 0.4;
      pts.push([side === 'right' ? right : left, y]);
      side = side === 'right' ? 'left' : 'right';
      pts.push([side === 'right' ? right : left, y]);
    });
    // ページの一番下まで管を伸ばし、最後はフォームの下の余白（文字のない所）を通って中央で終わる
    var contact = document.querySelector('main > section.contact');
    var padB = contact ? parseFloat(getComputedStyle(contact).paddingBottom) || 80 : 80;
    var yEnd = H - padB * 0.5;
    pts.push([side === 'right' ? right : left, yEnd]);
    pts.push([Math.round(W * (mobile ? .2 : .36)), yEnd]);
    var d = roundPath(pts, mobile ? 30 : 70);
    [pShell, pBg, pFg, pFlow, pMask].forEach(function (p) { p.setAttribute('d', d); });
    maskEl.setAttribute('x', 0); maskEl.setAttribute('y', 0); maskEl.setAttribute('width', W); maskEl.setAttribute('height', H);
    total = pFg.getTotalLength();
    pFg.style.strokeDasharray = total; pMask.style.strokeDasharray = total;
    samples = [];
    for (var i = 0; i <= 500; i++) { var l = total * i / 500; samples.push([l, pFg.getPointAtLength(l).y]); }
    buildJoints(mobile);
    head.setAttribute('r', mobile ? 5 : 7);
    drawPipe();
  }
  function drawPipe() {
    if (!total) return;
    var top0 = main.getBoundingClientRect().top + window.scrollY;
    var y = window.scrollY + window.innerHeight * .6 - top0, len = 0;
    for (var i = 0; i < samples.length; i++) { if (samples[i][1] <= y) len = samples[i][0]; }
    // 最後までスクロールしたら、管の終点まで水を届ける
    if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4) len = total;
    pFg.style.strokeDashoffset = total - len;
    pMask.style.strokeDashoffset = total - len;   // 水の流れ（ハイライト）は、水が届いた所だけに出す
    for (var j = 0; j < joints.length; j++) {
      var wet = joints[j].l <= len;
      if (wet !== joints[j].wet) { joints[j].wet = wet; joints[j].el.classList.toggle('is-wet', wet); }
    }
    var p = pFg.getPointAtLength(len); head.setAttribute('cx', p.x); head.setAttribute('cy', p.y);
    head.style.opacity = len > 2 && len < total - 2 ? 1 : 0;
  }
  window.addEventListener('scroll', drawPipe, { passive: true });
  ST.addEventListener('refresh', buildPipe);
  window.addEventListener('load', function () { ST.refresh(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ST.refresh(); });
  buildPipe();
})();
