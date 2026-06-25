/**
 * Relax Space — Audio Engine
 *
 * 設計根拠:
 *  1. 「具体的な自然音」優先: 連続的な広帯域ノイズの定常再生は脳に
 *     「ノイズ」として認識されやすい。波の打ち寄せ・鳥の囀り・焚き火の
 *     パチパチ・星のきらめきのように、時間的に変化する「音の出来事」
 *     として合成することで、同じ素材(フィルタ済みノイズ・サイン波)でも
 *     聴感上は自然音に近づき、リラックス効果が高まる。
 *  2. バイノーラルビート θ/α波 (4–10 Hz): 左右耳に微妙に異なる周波数を
 *     提示し脳が差分周波数を知覚。瞑想・不安低減と相関。
 *     (Oster 1973; Huang & Charyton 2008; Wahbeh et al. 2007)
 *  3. 純正律ドローン: 整数比倍音列はビート干渉が最小で心理的安定をもたらす。
 *     ノイズではなくサイン波なので「ノイズ感」を伴わない。
 */

let audioCtx = null;
let masterGain = null;
let currentGeneration = 0;
let activeSources = [];
let timers = [];

// ── Bootstrap ──────────────────────────────────────────────────────────────
export function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
export function getAudioContext() { return audioCtx; }

export function setVolume(v) {
  if (masterGain && audioCtx) {
    masterGain.gain.setTargetAtTime(v * 0.55, audioCtx.currentTime, 0.1);
  }
}

export function stopAudio() {
  currentGeneration++;
  timers.forEach(id => clearTimeout(id));
  timers = [];
  activeSources.forEach(n => { try { n.stop(); } catch (_) {} });
  activeSources = [];
  if (masterGain) {
    masterGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.8);
    masterGain = null;
  }
}

export function startThemeAudio(theme) {
  stopAudio();
  const ctx = initAudio();
  const gen = currentGeneration;

  masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0, ctx.currentTime);
  masterGain.gain.linearRampToValueAtTime(0.55, ctx.currentTime + 5);
  masterGain.connect(ctx.destination);

  if      (theme === 'ocean')  startOcean(ctx, masterGain, gen);
  else if (theme === 'forest') startForest(ctx, masterGain, gen);
  else if (theme === 'space')  startSpace(ctx, masterGain, gen);
  else if (theme === 'fire')   startFire(ctx, masterGain, gen);
}

function isAlive(gen) { return gen === currentGeneration; }
function track(node) { activeSources.push(node); return node; }
// generation が変わったら自動キャンセルされる setTimeout
function schedule(gen, fn, ms) {
  const id = setTimeout(() => { if (isAlive(gen)) fn(); }, ms);
  timers.push(id);
  return id;
}

// ── ブラウンノイズ生成 (ランダムウォーク積分) ─────────────────────────────
// 波の水音・葉擦れ・炎のパチパチ等、短い「音の出来事」の素材として使う。
// 単独で定常再生すると「ノイズ」に聞こえるため、必ずエンベロープで
// 時間変化させて使用する。
function brownNoiseBuffer(ctx, seconds = 4) {
  const n = ctx.sampleRate * seconds;
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    last = (last + w * 0.02) / 1.02;
    d[i] = last * 3.2;
  }
  return buf;
}

// ── バイノーラルビート ─────────────────────────────────────────────────────
function binauralBeat(ctx, dest, baseFreq, beatFreq, vol = 0.03) {
  [[-1, 0], [1, beatFreq]].forEach(([pan, offset]) => {
    const osc = ctx.createOscillator();
    const panner = ctx.createStereoPanner();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = baseFreq + offset;
    panner.pan.value = pan;
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(vol, ctx.currentTime + 8);
    osc.connect(panner); panner.connect(g); g.connect(dest);
    osc.start();
    track(osc);
  });
}

// ── 純正律ドローン ─────────────────────────────────────────────────────────
function justDrone(ctx, dest, root, ratios, gainPerPartial = 0.06) {
  ratios.forEach((r, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(gainPerPartial, ctx.currentTime + 6 + i);
    osc.type = 'sine';
    osc.frequency.value = root * r;
    osc.detune.value = (Math.random() - 0.5) * 2;
    osc.connect(g); g.connect(dest);
    osc.start();
    track(osc);
  });
}

// ── Ocean (波の音) ────────────────────────────────────────────────────────
function startOcean(ctx, dest, gen) {
  // 波音の素材: ブラウンノイズ → バンドパス。常時鳴らすのではなく
  // ゲイン/フィルタを「寄せて返す」エンベロープで動かし、波の打ち寄せに聞かせる
  const src = ctx.createBufferSource();
  src.buffer = brownNoiseBuffer(ctx, 4); src.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 300; bp.Q.value = 0.6;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 900;
  const waveG = ctx.createGain(); waveG.gain.value = 0.04;
  src.connect(bp); bp.connect(lp); lp.connect(waveG); waveG.connect(dest);
  src.start(); track(src);

  function scheduleWave() {
    if (!isAlive(gen)) return;
    const rise = 1.8 + Math.random() * 1.4;   // 押し波が満ちてくる時間
    const fall = 2.2 + Math.random() * 2;     // 引き波・泡が引く時間
    const peak = 0.3 + Math.random() * 0.14;
    const t0 = ctx.currentTime;
    waveG.gain.cancelScheduledValues(t0);
    waveG.gain.setValueAtTime(waveG.gain.value, t0);
    waveG.gain.linearRampToValueAtTime(peak, t0 + rise);
    waveG.gain.exponentialRampToValueAtTime(0.035, t0 + rise + fall);
    bp.frequency.cancelScheduledValues(t0);
    bp.frequency.setValueAtTime(bp.frequency.value, t0);
    bp.frequency.linearRampToValueAtTime(560, t0 + rise);
    bp.frequency.linearRampToValueAtTime(260, t0 + rise + fall);
    schedule(gen, scheduleWave, (rise + fall - 0.6) * 1000);
  }
  scheduleWave();

  // 深海の安定感: 純正律ドローン A1(55)・E2(82.5)・A2(110) Hz
  justDrone(ctx, dest, 55, [1, 1.5, 2], 0.06);

  // バイノーラルビート 6 Hz θ波: 瞑想・深いリラックス
  binauralBeat(ctx, dest, 200, 6, 0.03);
}

// ── Forest (小鳥の囀り) ───────────────────────────────────────────────────
function startForest(ctx, dest, gen) {
  // そよ風: 連続再生せず、時々ゆるやかに吹いて止む「ガスト」として表現
  function scheduleBreeze() {
    if (!isAlive(gen)) return;
    const src = ctx.createBufferSource();
    src.buffer = brownNoiseBuffer(ctx, 3); src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 250 + Math.random() * 150; bp.Q.value = 0.5;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 500;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, ctx.currentTime);
    src.connect(bp); bp.connect(lp); lp.connect(g); g.connect(dest);
    src.start(); track(src);
    const dur = 4 + Math.random() * 3;
    const t0 = ctx.currentTime;
    g.gain.linearRampToValueAtTime(0.1, t0 + dur * 0.4);
    g.gain.linearRampToValueAtTime(0, t0 + dur);
    schedule(gen, () => { try { src.stop(); } catch (_) {} }, (dur + 0.2) * 1000);
    schedule(gen, scheduleBreeze, (dur + 8 + Math.random() * 14) * 1000);
  }
  scheduleBreeze();

  // バイノーラルビート 10 Hz α波: 穏やかな覚醒・集中的リラックス
  binauralBeat(ctx, dest, 220, 10, 0.025);

  // 小鳥の囀り: 純正律比の短いサイン波フレーズ。2種の鳴き方をランダムに使用
  function chirpPhrase(t0, intervals, base) {
    intervals.forEach(([dt, ratio]) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const panner = ctx.createStereoPanner();
      const t = t0 + dt;
      o.frequency.value = base * ratio;
      panner.pan.value = (Math.random() - 0.5) * 1.6;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.03, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      o.connect(g); g.connect(panner); panner.connect(dest);
      o.start(t); o.stop(t + 0.28);
    });
  }
  function scheduleBird() {
    if (!isAlive(gen)) return;
    schedule(gen, () => {
      const base = 1760 + Math.random() * 880;
      const t0 = ctx.currentTime;
      if (Math.random() < 0.5) {
        // さえずり: 上昇フレーズ
        chirpPhrase(t0, [[0, 1], [0.18, 1.25], [0.38, 1.5], [0.56, 1]], base);
      } else {
        // 短い呼び鳴き: 2音の繰り返し
        chirpPhrase(t0, [[0, 1], [0.2, 1.5]], base);
        chirpPhrase(t0, [[0.55, 1], [0.75, 1.5]], base * 1.06);
      }
      scheduleBird();
    }, (4 + Math.random() * 8) * 1000);
  }
  scheduleBird();
}

// ── Space (宇宙) ──────────────────────────────────────────────────────────
function startSpace(ctx, dest, gen) {
  // 超低音パッド: 40 Hz 基音の純正律倍音列 — 宇宙的な重力感 (サイン波・ノイズ無し)
  justDrone(ctx, dest, 40, [1, 1.5, 2, 2.5, 3], 0.055);

  // 各倍音に極めて遅いLFO (0.02–0.06 Hz) で宇宙的な揺らぎ
  [40, 60, 80, 100, 120].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const modOsc = ctx.createOscillator();
    const modG = ctx.createGain();
    const g = ctx.createGain();
    osc.type = 'sine'; osc.frequency.value = freq;
    modOsc.frequency.value = 0.02 + i * 0.008;
    modG.gain.value = 1.5;
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.022, ctx.currentTime + 8 + i * 1.5);
    modOsc.connect(modG); modG.connect(osc.detune);
    osc.connect(g); g.connect(dest);
    osc.start(); modOsc.start();
    track(osc); track(modOsc);
  });

  // 星のきらめき: 連続ノイズではなく、ランダムな間隔で鳴る短いベル状のピン音
  function scheduleTwinkle() {
    if (!isAlive(gen)) return;
    schedule(gen, () => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const panner = ctx.createStereoPanner();
      const t = ctx.currentTime;
      o.type = 'sine';
      o.frequency.value = 2400 + Math.random() * 3600;
      panner.pan.value = (Math.random() - 0.5) * 1.8;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.02, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
      o.connect(g); g.connect(panner); panner.connect(dest);
      o.start(t); o.stop(t + 1.3);
      scheduleTwinkle();
    }, (1 + Math.random() * 3.5) * 1000);
  }
  scheduleTwinkle();

  // バイノーラルビート 4 Hz θ/δ境界: 深い瞑想・まどろみ
  binauralBeat(ctx, dest, 180, 4, 0.035);
}

// ── Fire (焚き火) ─────────────────────────────────────────────────────────
function startFire(ctx, dest, gen) {
  // 炉の温かみ: 純正律ドローンのみ (60 Hz + 90 Hz, 純正5度) — ノイズ無しの低音基盤
  justDrone(ctx, dest, 60, [1, 1.5], 0.07);

  // 薪のパチパチ: 短いノイズバーストを不規則な間隔で鳴らす
  function crackle() {
    if (!isAlive(gen)) return;
    schedule(gen, () => {
      const t0 = ctx.currentTime;
      const pops = Math.random() < 0.3 ? 2 : 1; // 時々連続2発
      for (let i = 0; i < pops; i++) {
        const t = t0 + i * (0.04 + Math.random() * 0.05);
        const src = ctx.createBufferSource();
        src.buffer = brownNoiseBuffer(ctx, 0.3);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = 900 + Math.random() * 2200; bp.Q.value = 3;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.16 + Math.random() * 0.1, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05 + Math.random() * 0.04);
        src.connect(bp); bp.connect(g); g.connect(dest);
        src.start(t); src.stop(t + 0.12);
      }
      crackle();
    }, (0.25 + Math.random() * 1.6) * 1000);
  }
  crackle();

  // 炉床の低い揺らぎ: ごく低音量のブラウンノイズをゆっくり波打たせる(暖かい息づき)
  const glowSrc = ctx.createBufferSource();
  glowSrc.buffer = brownNoiseBuffer(ctx, 4); glowSrc.loop = true;
  const glowLp = ctx.createBiquadFilter();
  glowLp.type = 'lowpass'; glowLp.frequency.value = 160;
  const glowG = ctx.createGain(); glowG.gain.value = 0.05;
  glowSrc.connect(glowLp); glowLp.connect(glowG); glowG.connect(dest);
  glowSrc.start(); track(glowSrc);
  const flickLfo = ctx.createOscillator();
  const flickG = ctx.createGain();
  flickLfo.frequency.value = 0.35; flickG.gain.value = 0.025;
  flickLfo.connect(flickG); flickG.connect(glowG.gain);
  flickLfo.start(); track(flickLfo);

  // バイノーラルビート 6 Hz θ波: 焚き火の前での瞑想状態
  binauralBeat(ctx, dest, 200, 6, 0.03);
}

// ── Bell (タイマー完了) ───────────────────────────────────────────────────
// チベタンシンギングボウルの倍音比を模倣: 1 : 2.756 : 5.404
export function playBell() {
  const ctx = initAudio();
  [[220, 0.5, 5], [220*2.756, 0.18, 3.5], [220*5.404, 0.06, 2]].forEach(([freq, vol, dur]) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + dur);
  });
}
