/**
 * Relax Space — Audio Engine
 *
 * 設計根拠:
 *  1. ピンクノイズ (1/f): 自然音のスペクトル分布に一致。白色ノイズより
 *     睡眠の質向上・認知負荷低減。(Lendner et al. 2020; Zhou et al. 2012)
 *  2. バイノーラルビート θ波 (4–8 Hz): 左右耳に微妙に異なる周波数を提示し
 *     脳が差分周波数を知覚。θ帯域は瞑想・不安低減と相関。
 *     (Oster 1973; Huang & Charyton 2008; Wahbeh et al. 2007)
 *  3. 純正律ドローン (A 基音 55 Hz): 整数比倍音列(1:2:3:4)はビート干渉が
 *     最小で心理的安定をもたらす。
 *  4. 低域重視フィルタリング: ISO 226 上 2–4 kHz が最感度帯域。
 *     抑制することで「ノイズ感」を排除。
 */

let audioCtx = null;
let masterGain = null;
let currentGeneration = 0;
let activeSources = [];

// ── Bootstrap ──────────────────────────────────────────────────────────────
export function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
export function getAudioContext() { return audioCtx; }

export function stopAudio() {
  currentGeneration++;
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
  // ゆっくり立ち上げることで突然のノイズ感を防ぐ
  masterGain.gain.linearRampToValueAtTime(0.55, ctx.currentTime + 5);
  masterGain.connect(ctx.destination);

  if      (theme === 'ocean')  startOcean(ctx, masterGain, gen);
  else if (theme === 'forest') startForest(ctx, masterGain, gen);
  else if (theme === 'space')  startSpace(ctx, masterGain, gen);
  else if (theme === 'fire')   startFire(ctx, masterGain, gen);
}

function isAlive(gen) { return gen === currentGeneration; }
function track(node) { activeSources.push(node); return node; }

// ── ピンクノイズ生成 (Paul Kellet アルゴリズム) ───────────────────────────
// 1/f スペクトル: 白色ノイズより自然音に近く、聴覚的ストレスが低い
function pinkNoiseBuffer(ctx, seconds = 4) {
  const n = ctx.sampleRate * seconds;
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886*b0 + w*0.0555179;
    b1 = 0.99332*b1 + w*0.0750759;
    b2 = 0.96900*b2 + w*0.1538520;
    b3 = 0.86650*b3 + w*0.3104856;
    b4 = 0.55000*b4 + w*0.5329522;
    b5 = -0.7616*b5 - w*0.0168980;
    d[i] = (b0+b1+b2+b3+b4+b5+b6+w*0.5362) * 0.12;
    b6 = w * 0.115926;
  }
  return buf;
}

function loopPink(ctx, dest, lpFreq, gainVal) {
  const src = ctx.createBufferSource();
  src.buffer = pinkNoiseBuffer(ctx, 4);
  src.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = lpFreq; lp.Q.value = 0.5;
  const g = ctx.createGain(); g.gain.value = gainVal;
  src.connect(lp); lp.connect(g); g.connect(dest);
  src.start();
  track(src);
  return { src, lp, g };
}

// ── バイノーラルビート ─────────────────────────────────────────────────────
// 左右耳に異なる周波数 → 脳が差分をθ/α波として知覚
// ※ヘッドフォン使用時に最も効果的
function binauralBeat(ctx, dest, baseFreq, beatFreq, vol = 0.04) {
  [[-1, 0], [1, beatFreq]].forEach(([pan, offset]) => {
    const osc = ctx.createOscillator();
    const panner = ctx.createStereoPanner();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = baseFreq + offset;
    panner.pan.value = pan;
    // バイノーラルもゆっくりフェードイン
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(vol, ctx.currentTime + 8);
    osc.connect(panner); panner.connect(g); g.connect(dest);
    osc.start();
    track(osc);
  });
}

// ── 純正律ドローン ─────────────────────────────────────────────────────────
// 整数比倍音 (1:1.5:2 = 根音・5度・オクターブ) — 最小のビート干渉
function justDrone(ctx, dest, root, ratios, gainPerPartial = 0.06) {
  ratios.forEach((r, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(gainPerPartial, ctx.currentTime + 6 + i);
    osc.type = 'sine';
    osc.frequency.value = root * r;
    osc.detune.value = (Math.random() - 0.5) * 2; // ±1 cent の微細な揺らぎ
    osc.connect(g); g.connect(dest);
    osc.start();
    track(osc);
  });
}

// ── Ocean (深海) ──────────────────────────────────────────────────────────
function startOcean(ctx, dest, gen) {
  // ピンクノイズ → LP 300 Hz: 深海の静かな環境音
  const { lp: waveLp } = loopPink(ctx, dest, 300, 0.5);

  // 波の揺らぎ: 0.08 Hz LFO でカットオフを緩やかに変動
  const lfo = ctx.createOscillator();
  const lfoG = ctx.createGain();
  lfo.frequency.value = 0.08; lfoG.gain.value = 70;
  lfo.connect(lfoG); lfoG.connect(waveLp.frequency);
  lfo.start(); track(lfo);

  // 海底の圧力感: さらに低域の pink → LP 80 Hz
  loopPink(ctx, dest, 80, 0.28);

  // 純正律ドローン A1(55)・E2(82.5)・A2(110) Hz
  justDrone(ctx, dest, 55, [1, 1.5, 2], 0.07);

  // バイノーラルビート 6 Hz θ波: 瞑想・深いリラックス
  binauralBeat(ctx, dest, 200, 6, 0.035);
}

// ── Forest (森) ───────────────────────────────────────────────────────────
function startForest(ctx, dest, gen) {
  // 風: pink → BP 80–600 Hz で葉擦れの自然な質感
  const windSrc = ctx.createBufferSource();
  windSrc.buffer = pinkNoiseBuffer(ctx, 4); windSrc.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 280; bp.Q.value = 0.4;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 600;
  const windG = ctx.createGain(); windG.gain.value = 0.5;
  windSrc.connect(bp); bp.connect(lp); lp.connect(windG); windG.connect(dest);
  windSrc.start(); track(windSrc);

  // 風の強弱: 0.07 Hz LFO
  const lfo = ctx.createOscillator();
  const lfoG = ctx.createGain();
  lfo.frequency.value = 0.07; lfoG.gain.value = 0.18;
  lfo.connect(lfoG); lfoG.connect(windG.gain);
  lfo.start(); track(lfo);

  // 森の低音基盤: pink → LP 60 Hz
  loopPink(ctx, dest, 60, 0.2);

  // バイノーラルビート 10 Hz α波: 穏やかな覚醒・集中的リラックス
  binauralBeat(ctx, dest, 220, 10, 0.03);

  // 鳥の声: 純正律比の短いサイン波フレーズ
  function scheduleBird() {
    if (!isAlive(gen)) return;
    setTimeout(() => {
      if (!isAlive(gen)) return;
      const base = 1760 + Math.random() * 880;
      [[0, base], [0.18, base * 1.25], [0.38, base * 1.5], [0.56, base]].forEach(([dt, freq]) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        const t = ctx.currentTime + dt;
        o.frequency.value = freq;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.025, t + 0.04);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
        o.connect(g); g.connect(dest);
        o.start(t); o.stop(t + 0.28);
      });
      scheduleBird();
    }, (6 + Math.random() * 14) * 1000);
  }
  scheduleBird();
}

// ── Space (宇宙) ──────────────────────────────────────────────────────────
function startSpace(ctx, dest, gen) {
  // 超低音パッド: 40 Hz 基音の純正律倍音列 — 宇宙的な重力感
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

  // 遠くの星の輝き: pink → HP 5000 Hz → 極めて低音量
  const starSrc = ctx.createBufferSource();
  starSrc.buffer = pinkNoiseBuffer(ctx, 4); starSrc.loop = true;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 5000;
  const starG = ctx.createGain(); starG.gain.value = 0.025;
  starSrc.connect(hp); hp.connect(starG); starG.connect(dest);
  starSrc.start(); track(starSrc);

  // バイノーラルビート 4 Hz θ/δ境界: 深い瞑想・まどろみ
  binauralBeat(ctx, dest, 180, 4, 0.04);
}

// ── Fire (焚き火) ─────────────────────────────────────────────────────────
function startFire(ctx, dest, gen) {
  // 炉の重低音共鳴: pink → LP 150 Hz
  const { g: warmG } = loopPink(ctx, dest, 150, 0.45);

  // 炎の中域: pink → BP 400–1200 Hz (低音量)
  const midSrc = ctx.createBufferSource();
  midSrc.buffer = pinkNoiseBuffer(ctx, 4); midSrc.loop = true;
  const midBp = ctx.createBiquadFilter();
  midBp.type = 'bandpass'; midBp.frequency.value = 600; midBp.Q.value = 0.8;
  const midLp = ctx.createBiquadFilter();
  midLp.type = 'lowpass'; midLp.frequency.value = 1200;
  const midG = ctx.createGain(); midG.gain.value = 0.14;
  midSrc.connect(midBp); midBp.connect(midLp); midLp.connect(midG); midG.connect(dest);
  midSrc.start(); track(midSrc);

  // 炎のゆらぎ: 0.4 Hz サイン波でゆったりと強弱
  const flickLfo = ctx.createOscillator();
  const flickG = ctx.createGain();
  flickLfo.frequency.value = 0.4; flickG.gain.value = 0.1;
  flickLfo.connect(flickG); flickG.connect(warmG.gain);
  flickLfo.start(); track(flickLfo);

  // パチパチ: pink → HP 2000 Hz → 超低音量 + 不規則LFO
  const crackSrc = ctx.createBufferSource();
  crackSrc.buffer = pinkNoiseBuffer(ctx, 3); crackSrc.loop = true;
  const crackHp = ctx.createBiquadFilter();
  crackHp.type = 'highpass'; crackHp.frequency.value = 2000;
  const crackG = ctx.createGain(); crackG.gain.value = 0.045;
  const crackLfo = ctx.createOscillator();
  const crackLfoG = ctx.createGain();
  crackLfo.type = 'sawtooth'; crackLfo.frequency.value = 9;
  crackLfoG.gain.value = 0.03;
  crackLfo.connect(crackLfoG); crackLfoG.connect(crackG.gain);
  crackSrc.connect(crackHp); crackHp.connect(crackG); crackG.connect(dest);
  crackSrc.start(); crackLfo.start();
  track(crackSrc); track(crackLfo);

  // 炉床の体感振動: 60 Hz + 90 Hz (純正5度)
  justDrone(ctx, dest, 60, [1, 1.5], 0.065);

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
