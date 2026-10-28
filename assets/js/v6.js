(function () {
  'use strict';

  // v6：後半を飽きさせない仕掛け（すごろく・はしご・進み具合の一言・FAQの続き）
  var Sound = window.LPSound || { play: function () {} };
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.dataLayer = window.dataLayer || [];
  function track(event, params) {
    var p = { event: event }; for (var k in params) p[k] = params[k]; window.dataLayer.push(p);
  }
  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  // ---------- 成長すごろく：水滴が線をたどり、通過したマスが開く ----------
  var road = document.querySelector('.road__body');
  var rsteps = [].slice.call(document.querySelectorAll('.rstep'));
  var roadDone = false;
  function updateRoad() {
    if (!road) return;
    var r = road.getBoundingClientRect();
    var p = clamp((window.innerHeight * 0.62 - r.top) / r.height);
    road.style.setProperty('--p', p);
    rsteps.forEach(function (s, i) {
      var on = s.offsetTop + 34 <= p * r.height;
      if (on && !s.classList.contains('is-on')) { s.classList.add('is-on'); Sound.play('get'); }
      else if (!on) s.classList.remove('is-on');
      if (on && i === rsteps.length - 1 && !roadDone) { roadDone = true; track('sugoroku_goal', {}); }
    });
  }

  // ---------- キャリアのはしご：スクロールで下から1段ずつ点く ----------
  var ladder = document.querySelector('.ladder');
  var rungs = [].slice.call(document.querySelectorAll('.rung')).reverse(); // 下（LV.1）から
  function updateLadder() {
    if (!ladder) return;
    var r = ladder.getBoundingClientRect();
    var p = clamp((window.innerHeight * 0.5 - r.top) / (r.height - window.innerHeight * 0.6));
    var lit = Math.min(rungs.length, Math.floor(p * (rungs.length + 0.4) + 0.6));
    rungs.forEach(function (g, i) {
      var on = i < lit;
      if (on && !g.classList.contains('is-on')) Sound.play('pop');
      g.classList.toggle('is-on', on);
      g.classList.toggle('is-here', on && i === lit - 1);
    });
  }

  // ---------- 進み具合の一言 ----------
  var pmsg = document.querySelector('.pmsg');
  var pPct = pmsg.querySelector('.pmsg__pct'), pText = pmsg.querySelector('.pmsg__t');
  var MILESTONES = [[0.25, 'いい調子！'], [0.5, '半分きました！'], [0.75, 'あと少し！'], [0.92, 'ゴールはLINEです']];
  var shown = {}, pmsgTimer = null;
  function updateMsg() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var p = max > 0 ? window.scrollY / max : 0;
    MILESTONES.forEach(function (m) {
      if (p >= m[0] && !shown[m[0]]) {
        shown[m[0]] = true;
        pPct.textContent = Math.round(m[0] * 100) + '%';
        pText.textContent = m[1];
        pmsg.classList.add('is-show'); Sound.play('bubble');
        clearTimeout(pmsgTimer);
        pmsgTimer = setTimeout(function () { pmsg.classList.remove('is-show'); }, 2600);
        track('read_milestone', { percent: Math.round(m[0] * 100) });
      }
    });
  }

  function onScroll() { updateRoad(); updateLadder(); updateMsg(); }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  if (reduceMotion) {
    rsteps.forEach(function (s) { s.classList.add('is-on'); });
    if (road) road.style.setProperty('--p', 1);
    rungs.forEach(function (g) { g.classList.add('is-on'); });
  } else {
    onScroll();
  }

  // ---------- よくある質問：残りを開く ----------
  var moreBtn = document.querySelector('.faq__morebtn');
  var more = document.getElementById('faq-more');
  if (moreBtn && more) {
    moreBtn.addEventListener('click', function () {
      var open = more.hasAttribute('hidden');
      if (open) more.removeAttribute('hidden'); else more.setAttribute('hidden', '');
      moreBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      moreBtn.firstChild.textContent = open ? '閉じる' : '残りの質問も見る（6問）';
      if (open) track('faq_more', {});
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    });
  }

  // 募集要項の開閉でページの高さが変わるので、配管ラインを引き直す
  var jobDetails = document.querySelector('details.job');
  if (jobDetails) jobDetails.addEventListener('toggle', function () {
    if (jobDetails.open) track('job_detail_open', {});
    if (window.ScrollTrigger) window.ScrollTrigger.refresh();
  });
})();
