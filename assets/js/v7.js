(function () {
  'use strict';

  // v7：30秒タイマー・休日カレンダー・配管ラインのゴール・質問チップ・診断・離脱前の一言
  var Sound = window.LPSound || { play: function () {} };
  var CONFIG = window.LP_CONFIG || {};
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.dataLayer = window.dataLayer || [];
  function track(event, params) {
    var p = { event: event }; for (var k in params) p[k] = params[k]; window.dataLayer.push(p);
  }
  function onView(el, fn, margin) {
    if (!el) return;
    if (!('IntersectionObserver' in window)) { fn(); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { io.disconnect(); fn(); } });
    }, { rootMargin: margin || '0px 0px -25% 0px' });
    io.observe(el);
  }

  // ---------- 30秒でわかる：見えている間だけ30→0 ----------
  var timer = document.querySelector('.quick__timer');
  if (timer) {
    var tNum = timer.querySelector('b'), left = 30, tick = null;
    var qio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting && !tick && left > 0) {
          tick = setInterval(function () {
            left--;
            timer.style.setProperty('--t', left / 30);
            tNum.textContent = left;
            if (left <= 0) { clearInterval(tick); tick = null; timer.classList.add('is-done'); tNum.textContent = 'OK!'; Sound.play('get'); track('quick_read_done', {}); }
          }, 1000);
        } else if (!e.isIntersecting && tick) { clearInterval(tick); tick = null; }
      });
    }, { threshold: 0.3 });
    qio.observe(timer.closest('.quick'));
  }

  // ---------- 休日カレンダー（2026年をもとにしたイメージ） ----------
  var months = document.querySelector('.hcal__months');
  if (months) {
    var HOLIDAYS = ['1-1', '1-12', '2-11', '2-23', '3-20', '4-29', '5-3', '5-4', '5-5', '5-6', '7-20', '8-11', '9-21', '9-22', '9-23', '10-12', '11-3', '11-23'];
    var SPECIAL = ['1-2', '8-13', '8-14', '12-29', '12-30', '12-31']; // お盆・正月
    // 休みの考え方は「土日祝＋盆・正月」（9/30 中村様回答）。塗りはその考え方のイメージで、
    // 見出しの数字は回答どおり「約120日」を表示する。※実際の会社カレンダーが届いたら差し替え
    var TOTAL = 120, Y = 2026, off = {}, d, key;
    for (d = new Date(Y, 0, 1); d.getFullYear() === Y; d.setDate(d.getDate() + 1)) {
      key = (d.getMonth() + 1) + '-' + d.getDate();
      if (d.getDay() === 0 || d.getDay() === 6 || HOLIDAYS.indexOf(key) >= 0) off[key] = 'h';
    }
    SPECIAL.forEach(function (k) { if (!off[k]) off[k] = 's'; });
    var html = '';
    for (var m = 0; m < 12; m++) {
      var first = new Date(Y, m, 1).getDay(), days = new Date(Y, m + 1, 0).getDate(), n = 0, cells = '';
      for (var e = 0; e < first; e++) cells += '<i class="e"></i>';
      for (var day = 1; day <= days; day++) { var t = off[(m + 1) + '-' + day]; if (t) n++; cells += '<i' + (t ? ' class="' + t + '"' : '') + '></i>'; }
      html += '<div class="hcal__m"><b>' + (m + 1) + '月<small>' + n + '日</small></b><div class="hcal__g">' + cells + '</div></div>';
    }
    months.innerHTML = html;
    var mEls = [].slice.call(months.querySelectorAll('.hcal__m'));
    var nEl = document.querySelector('.hcal__n');
    var fill = function () {
      mEls.forEach(function (el, i) {
        setTimeout(function () {
          el.classList.add('is-on');
          nEl.textContent = Math.round(TOTAL * (i + 1) / mEls.length);
          if (i % 3 === 2) Sound.play('pop');
        }, reduceMotion ? 0 : 140 * i);
      });
    };
    nEl.textContent = '0';
    onView(months, fill);
  }

  // ---------- 配管ラインのゴール：線が最後まで届いたら「LINEで相談」が出る ----------
  var main = document.querySelector('main');
  var pFg = document.querySelector('.pipe__fg');
  var goal = document.querySelector('.pgoal');
  var goalDone = false;
  function placeGoal() {
    if (!pFg || !goal || !pFg.getTotalLength) return;
    var len = pFg.getTotalLength(); if (!len) return;
    var pt = pFg.getPointAtLength(len), W = main.clientWidth;
    goal.style.left = pt.x + 'px'; goal.style.top = pt.y + 'px';
    goal.classList.toggle('is-left', pt.x < W / 2);
    goal.classList.toggle('is-right', pt.x >= W / 2);
  }
  function checkGoal() {
    if (!pFg || !goal) return;
    var off = parseFloat(pFg.style.strokeDashoffset || '9999');
    var reached = off < 4;
    if (reached && !goalDone) { goalDone = true; Sound.play('goal'); track('pipe_goal', {}); }
    goal.classList.toggle('is-goal', reached);
  }
  if (window.ScrollTrigger) window.ScrollTrigger.addEventListener('refresh', function () { placeGoal(); checkGoal(); });
  window.addEventListener('load', placeGoal);
  // 画像の遅延読み込みなどでページの高さが変わったら、配管ラインとゴールを引き直す
  if (window.ScrollTrigger && 'ResizeObserver' in window) {
    var lastH = main.scrollHeight, rTimer = null;
    new ResizeObserver(function () {
      if (Math.abs(main.scrollHeight - lastH) < 2) return;
      lastH = main.scrollHeight;
      clearTimeout(rTimer);
      rTimer = setTimeout(function () { window.ScrollTrigger.refresh(); lastH = main.scrollHeight; }, 250);
    }).observe(main);
  }
  window.addEventListener('scroll', checkGoal, { passive: true });
  placeGoal();

  // ---------- 質問チップ：押すとその質問をLINEで送れる ----------
  document.querySelectorAll('.js-lineq').forEach(function (a) {
    var q = a.getAttribute('data-q');
    if (CONFIG.lineOaId) {
      a.href = 'https://line.me/R/oaMessage/' + encodeURIComponent(CONFIG.lineOaId) + '/?' + encodeURIComponent(q);
      a.target = '_blank'; a.rel = 'noopener';
    } else if (CONFIG.lineUrl) {
      a.href = CONFIG.lineUrl; a.target = '_blank'; a.rel = 'noopener';
    }
    a.addEventListener('click', function () {
      track('cta_click', { cta_type: 'line_question', cta_position: a.getAttribute('data-cta-pos') || '', question: q });
      // 公式アカウントIDが無いあいだは、質問文をコピーしておく（LINEで貼り付けるだけで送れる）
      if (!CONFIG.lineOaId && navigator.clipboard) { navigator.clipboard.writeText(q).catch(function () {}); }
    });
  });

  // ---------- 配管工、向いてる？診断 ----------
  var diag = document.querySelector('.diag__card');
  if (diag) {
    var qs = [].slice.call(diag.querySelectorAll('.diag__q'));
    var dots = [].slice.call(diag.querySelectorAll('.diag__dots li'));
    var result = diag.querySelector('.diag__result');
    var answers = [];
    var TYPES = {
      body: ['現場で輝く、アクティブ職人タイプ', '体を動かすのが好きなあなたは、外の現場でぐんぐん伸びるタイプ。先輩と一緒に動きながら、1年で一人で配管作業ができるようになる人も。'],
      mind: ['しくみ探究、図面も描ける技術者タイプ', '「どうなってるんだろう？」が原動力のあなたは、図面から考えられる配管工に向いています。資格の費用は会社が負担します。'],
      team: ['チームを明るくする、ムードメーカータイプ', '誰かと一緒に動くのが好きなあなたは、少人数のチームにぴったり。先輩との距離も近く、分からないことをすぐ聞ける環境です。'],
      calm: ['コツコツ積み上げる、こだわり職人タイプ', '一人で集中できるあなたは、丁寧な仕事で信頼される職人タイプ。一つずつ覚えていけば、3年で図面から施工まで任されます。']
    };
    // 診断で高さが変わるので、配管ラインとゴールの位置を引き直す
    function relayout() { if (window.ScrollTrigger) window.ScrollTrigger.refresh(); }
    function show(i) {
      qs.forEach(function (q, j) { q.classList.toggle('is-active', j === i); });
      dots.forEach(function (dt, j) { dt.classList.toggle('is-on', j <= i); });
      relayout();
    }
    function finish() {
      qs.forEach(function (q) { q.classList.remove('is-active'); });
      var t = answers[1] ? 'mind' : answers[2] ? 'team' : answers[0] ? 'body' : 'calm';
      if (answers[0] && answers[1] && answers[2]) t = 'team';
      diag.querySelector('.diag__type').textContent = TYPES[t][0];
      diag.querySelector('.diag__msg').textContent = TYPES[t][1] + 'どのタイプも、先輩たちはみんな未経験からのスタートです。';
      result.hidden = false;
      relayout();
      Sound.play('reveal');
      track('diag_complete', { result: t });
    }
    qs.forEach(function (q, i) {
      q.querySelectorAll('button').forEach(function (b) {
        b.addEventListener('click', function () {
          answers[i] = b.getAttribute('data-v') === '1';
          Sound.play('drop');
          if (i < qs.length - 1) show(i + 1); else finish();
        });
      });
    });
    diag.querySelector('.diag__retry').addEventListener('click', function () { answers = []; result.hidden = true; show(0); });
  }

  // ---------- 離脱前の一言（PCのみ・1回だけ） ----------
  var exitm = document.querySelector('.exitm');
  if (exitm && window.matchMedia('(pointer: fine) and (min-width: 1100px)').matches) {
    var seen = false, armed = false;
    try { seen = sessionStorage.getItem('lp_exitm') === '1'; } catch (err) {}
    setTimeout(function () { armed = true; }, 15000);
    var openExit = function () {
      if (seen || !armed) return;
      seen = true;
      try { sessionStorage.setItem('lp_exitm', '1'); } catch (err) {}
      exitm.hidden = false;
      track('exit_modal_show', {});
    };
    var closeExit = function () { exitm.hidden = true; };
    document.addEventListener('mouseout', function (ev) { if (!ev.relatedTarget && ev.clientY <= 0) openExit(); });
    exitm.querySelector('.exitm__x').addEventListener('click', closeExit);
    exitm.querySelector('.exitm__bg').addEventListener('click', closeExit);
    exitm.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', closeExit); });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') closeExit(); });
  }

  // 代表メッセージの開閉でも配管ラインを引き直す
  var msgMore = document.querySelector('details.msg-more');
  if (msgMore) msgMore.addEventListener('toggle', function () {
    if (msgMore.open) track('message_full_open', {});
    if (window.ScrollTrigger) window.ScrollTrigger.refresh();
  });
})();

// 仕事の流れ：見えたら01から順に点けていく
(function () {
  var steps = [].slice.call(document.querySelectorAll('.wstep'));
  if (!steps.length) return;
  var Sound = window.LPSound || { play: function () {} };
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
    steps.forEach(function (s) { s.classList.add('is-on'); });
    return;
  }
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      io.disconnect();
      steps.forEach(function (s, i) {
        setTimeout(function () { s.classList.add('is-on'); if (i === steps.length - 1) Sound.play('pop'); }, 200 * i);
      });
    });
  }, { rootMargin: '0px 0px -30% 0px' });
  io.observe(document.querySelector('.wflow'));
})();

// v9：敦賀マップ。中村住設から各施設へ配管を伸ばし、水が届いた建物から明かりをつける
(function () {
  var map = document.querySelector('.tmap');
  if (!map) return;
  var Sound = window.LPSound || { play: function () {} };
  var svg = map.querySelector('.tmap__pipes');
  var home = map.querySelector('.tbld--home');
  var blds = [].slice.call(map.querySelectorAll('.tbld:not(.tbld--home)'));
  var NS = 'http://www.w3.org/2000/svg', fills = [], done = false;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function pos(el) {
    var cs = getComputedStyle(el), W = map.clientWidth, H = map.clientHeight;
    return [parseFloat(cs.getPropertyValue('--x')) / 100 * W, parseFloat(cs.getPropertyValue('--y')) / 100 * H];
  }
  // 横に出てから縦に曲がる、角の丸い配管
  function route(a, b) {
    var r = Math.min(18, Math.abs(b[0] - a[0]) / 2, Math.abs(b[1] - a[1]) / 2);
    var sx = Math.sign(b[0] - a[0]), sy = Math.sign(b[1] - a[1]);
    return 'M' + a[0] + ' ' + a[1] + ' H' + (b[0] - sx * r) + ' Q' + b[0] + ' ' + a[1] + ' ' + b[0] + ' ' + (a[1] + sy * r) + ' V' + b[1];
  }
  function build() {
    var W = map.clientWidth, H = map.clientHeight;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.innerHTML = ''; fills = [];
    var h = pos(home);
    blds.forEach(function (b, i) {
      var d = route(h, pos(b));
      ['s', 'b', 'f'].forEach(function (c) {
        var p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); p.setAttribute('class', c); svg.appendChild(p);
        if (c === 'f') {
          var L = p.getTotalLength(); p.style.strokeDasharray = L;
          p.style.strokeDashoffset = b.classList.contains('is-on') ? 0 : L;
          fills[i] = p;
        }
      });
    });
  }
  function run() {
    if (done) return; done = true;
    blds.forEach(function (b, i) {
      var t = reduce ? 0 : 500 + i * 650;
      setTimeout(function () { if (fills[i]) fills[i].style.strokeDashoffset = 0; }, t);
      setTimeout(function () { b.classList.add('is-on'); Sound.play(i === blds.length - 1 ? 'get' : 'drop'); }, reduce ? 0 : t + 750);
    });
  }
  // 見出しの数字：見えたら0から数える
  var n = document.querySelector('.tcount__n');
  if (n && 'IntersectionObserver' in window && !reduce) {
    var to = +n.getAttribute('data-to');
    var nio = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) return; nio.disconnect();
      for (var k = 1; k <= to; k++) (function (k) { setTimeout(function () { n.textContent = k; if (k === to) Sound.play('pop'); }, k * 160); })(k);
    }, { rootMargin: '0px 0px -20% 0px' });
    nio.observe(n);
  } else if (n) n.textContent = n.getAttribute('data-to');
  build();
  window.addEventListener('resize', function () { clearTimeout(map._t); map._t = setTimeout(build, 200); });
  if (!('IntersectionObserver' in window)) { run(); return; }
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { io.disconnect(); run(); } });
  }, { rootMargin: '0px 0px -30% 0px' });
  io.observe(map);
})();

// 軽量化：ずっと動いている小さな演出は、画面に見えている間だけ動かす
(function () {
  if (!('IntersectionObserver' in window)) return;
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { e.target.classList.toggle('is-offscreen', !e.isIntersecting); });
  });
  document.querySelectorAll('.hero__scroll, .pause, .waiting, .quick, .pgoal').forEach(function (el) {
    el.classList.add('is-offscreen');
    io.observe(el);
  });
})();
