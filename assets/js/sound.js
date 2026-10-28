/*
 * 効果音（初期状態はOFF。SOUND ボタンでONにした人だけ鳴る）
 * assets/sound/ の drop.mp3 / switch.mp3 / pop.mp3（ElevenLabsで生成）を使う。
 * 読み込めない場合は、ブラウザ内で合成した水滴音で代用する。
 */
window.LPSound = (function () {
  'use strict';
  var FILES = {
    drop: 'assets/sound/drop.mp3', sw: 'assets/sound/switch.mp3', pop: 'assets/sound/pop.mp3',
    // v8 追加（ElevenLabs）：すごろくのGET・30秒OK／配管ラインのゴール／診断結果／進み具合の一言
    get: 'assets/sound/get.mp3', goal: 'assets/sound/goal.mp3', reveal: 'assets/sound/reveal.mp3', bubble: 'assets/sound/bubble.mp3'
  };
  var ctx = null, on = false, buffers = {};

  function ensure() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    Object.keys(FILES).forEach(function (k) {
      fetch(FILES[k]).then(function (r) { if (!r.ok) throw 0; return r.arrayBuffer(); })
        .then(function (b) { return ctx.decodeAudioData(b); })
        .then(function (buf) { buffers[k] = buf; })
        .catch(function () { /* 音源がなければ合成音を使う */ });
    });
    return ctx;
  }

  // 生成した音源は長めなので、頭の無音を飛ばして先頭だけを短くフェードアウトして鳴らす
  var MAX_LEN = { drop: 0.5, sw: 0.6, pop: 0.35, get: 0.5, goal: 0.85, reveal: 0.7, bubble: 0.3 };
  // 音源ごとの元の音量差をそろえる（ピークがおよそ0.4になるように）
  var VOL = { drop: 0.5, sw: 0.5, pop: 0.35, get: 0.45, goal: 0.45, reveal: 0.85, bubble: 0.9 };
  var offsets = {};
  function leadOffset(buf) {
    var d = buf.getChannelData(0), th = 0.02;
    for (var i = 0; i < d.length; i++) { if (Math.abs(d[i]) > th) return Math.max(0, i / buf.sampleRate - 0.005); }
    return 0;
  }
  function playBuffer(name, buf, vol) {
    if (offsets[name] === undefined) offsets[name] = leadOffset(buf);
    var len = MAX_LEN[name] || 0.5, t = ctx.currentTime;
    var s = ctx.createBufferSource(); var g = ctx.createGain();
    s.buffer = buf;
    g.gain.setValueAtTime(vol, t);
    g.gain.setValueAtTime(vol, t + len * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(g); g.connect(ctx.destination);
    s.start(t, offsets[name], len + 0.05);
  }

  // 水滴：高めの正弦波を素早く下げ、短く減衰させる
  function synthDrop(base, vol) {
    var t = ctx.currentTime;
    var o = ctx.createOscillator(); var g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(base * 2.4, t);
    o.frequency.exponentialRampToValueAtTime(base, t + 0.09);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.25);
  }

  function play(name) {
    if (!on || !ctx) return;
    if (buffers[name]) { playBuffer(name, buffers[name], VOL[name] || 0.5); return; }
    if (name === 'drop') synthDrop(520 + Math.random() * 160, 0.18);
    else if (name === 'sw') { synthDrop(700, 0.14); setTimeout(function () { synthDrop(980, 0.1); }, 70); }
    else if (name === 'get' || name === 'reveal') { synthDrop(880, 0.1); setTimeout(function () { synthDrop(1320, 0.08); }, 90); }
    else if (name === 'goal') { synthDrop(520, 0.16); setTimeout(function () { synthDrop(780, 0.1); }, 120); setTimeout(function () { synthDrop(1040, 0.1); }, 240); }
    else synthDrop(900, 0.08);
  }

  // iPhoneは「消音モード」だとWeb Audioの音が出ない。SOUNDを自分でONにした人には、
  // 音楽アプリと同じ扱い（playback）にして消音モードでも鳴らす（iOS 16.4以降のSafari）
  function unlock() {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    if (!ctx) return;
    if (ctx.state !== 'running') ctx.resume();
    // タップした瞬間に無音を1回鳴らして、スマホの再生制限を解除しておく
    var b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource();
    s.buffer = b; s.connect(ctx.destination); s.start(0);
  }

  function toggle(force) {
    on = typeof force === 'boolean' ? force : !on;
    if (on) { ensure(); unlock(); play('sw'); }
    return on;
  }

  // 画面を切り替えて戻ったときなどに止まっていたら、次のタップで再開する
  document.addEventListener('pointerdown', function () {
    if (on && ctx && ctx.state !== 'running') unlock();
  }, { passive: true });

  return { play: play, toggle: toggle, isOn: function () { return on; } };
})();
