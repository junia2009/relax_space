/**
 * Relax Space — 胎内音シンセサイザー
 *
 * 録音素材を使わず、胎内音の研究で報告されている音響特性を
 * 生理学的なパラメータから合成する。主な根拠:
 *
 *  - Walker, Grimwade & Wood (1971): 子宮内の音は母体の循環動態に由来する
 *    低周波のランダムノイズで、外部の環境音の寄与は小さい。
 *  - 室岡 (1974, 1979): 胎内音 (母体大動脈音が主体) を聞かせると泣いている
 *    新生児が泣き止み鎮静する。→ 主役は心音ではなく「脈打つ血流音」。
 *  - Querleu et al. (1988): 子宮内の背景音は 100 Hz 未満が中心で 60–85 dB、
 *    100 Hz 以上は 60 dB 未満、500 Hz 以上では約 40 dB まで下がる。
 *    母体の腸音・声は背景音より大きく聞こえる。
 *  - Gerhardt & Abrams (2000): 母体の組織は低域通過フィルタとして働き、
 *    600–1000 Hz 以上を約 30 dB 減衰させる。125 Hz 付近はわずかに増強
 *    (+3.7 dB) される。
 *  - Riknagel et al. (2017): 妊娠後期の母体心音 (S1/S2) は 25–100 Hz、
 *    子宮動脈の血管雑音は 200–800 Hz。大動脈弁→子宮動脈の脈波伝播速度は
 *    6.6 ± 1.5 m/s。
 *  - Parga et al. (2018): 実際の胎内音は市販の胎内音より低域中心で、
 *    腸音の比重が大きく、強弱の変化も大きい。
 *  - 妊娠中の心拍は非妊娠時より 10–20 bpm 上昇し、妊娠後期に最大になる
 *    (Sanghavi & Rutherford 2014)。
 *  - 左室駆出時間 LVET(女性) ≈ 418 − 1.6 × HR [ms] (Weissler 1968)。
 */

import { noiseBuffer, biquad, chain } from './util.js';

// ── 生理学パラメータ ───────────────────────────────────────────────────────
export const WOMB = {
  hr: 80,             // 母体の安静時心拍 [bpm] (妊娠後期)
  respRate: 15,       // 母体の呼吸数 [回/分]
  rsa: 3,             // 呼吸性洞性不整脈: 吸気で心拍が上がる幅 [±bpm]
  hrv: 0.012,         // 拍ごとのランダムな揺らぎ (RR 間隔に対する比)
  ict: 0.045,         // 等容性収縮時間 [s]: S1 → 大動脈への駆出開始
  pttAorta: 0.03,     // 大動脈弁 → 腹部大動脈 の脈波到達時間 [s]
  pttUterine: 0.085,  // 大動脈弁 → 子宮動脈: 約 0.55 m ÷ 6.6 m/s
  uterineRI: 0.5,     // 子宮動脈の抵抗係数 (妊娠後期の正常値 ≈ 0.4–0.55)
  bowelMeanGap: 18,   // 腸音のかたまりが鳴る平均間隔 [s]
};

// 出力レベル (各成分の相対バランス。Querleu 1988 の帯域別レベルに合わせて
// オフライン解析で調整済み — README 参照)
const LEVEL = {
  background: 0.28,   // < 100 Hz の背景ノイズ
  aorta:      0.9,    // 母体大動脈音 (脈打つ低い「ゴォッ」)
  murmur:     0.05,   // 子宮動脈の血管雑音 (脈打つ「ザッ」)
  heart:      0.18,   // 母体心音 S1/S2 (血流音の奥でかすかに)
  bowel:      0.05,   // 腸音
  virtualBass: 0.22,  // 小型スピーカー向けの倍音 (後述)
};

// 動脈の流速波形 (拡張期の流速を 0、収縮期のピークを 1 とした脈動成分)
// 速やかに立ち上がり (加速時間 accel)、指数関数的に減衰する
function pulseShape(t, accel, tau) {
  if (t < 0) return 0;
  if (t < accel) return 0.5 * (1 - Math.cos(Math.PI * t / accel));
  return Math.exp(-(t - accel) / tau);
}

// 血流の乱流音の振幅は流速に対して非線形に増える (ここでは v^1.5)。
// 1拍分の「振幅の増分」カーブを AudioBuffer にしておき、拍ごとに
// AudioParam へ足し込む (重なった拍は自然に加算される)
function flowEnvelopeBuffer(ctx, { diastolic, accel, tau, length = 1.2 }) {
  const n = Math.floor(ctx.sampleRate * length);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  const base = diastolic ** 1.5;
  const peak = 1 - base;
  for (let i = 0; i < n; i++) {
    const v = diastolic + (1 - diastolic) * pulseShape(i / ctx.sampleRate, accel, tau);
    d[i] = (v ** 1.5 - base) / peak; // 0..1
  }
  d[n - 1] = 0;
  return { buf, base };
}

// 心音 (減衰する低周波の振動) を合成した AudioBuffer
// comps: [{ f: 周波数, delay: 開始 [s], decay: 減衰時定数 [s], amp }]
function heartSoundBuffer(ctx, comps, length) {
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * length);
  const buf = ctx.createBuffer(1, n, sr);
  const d = buf.getChannelData(0);
  let lp = 0;
  for (const c of comps) {
    const start = Math.floor(c.delay * sr);
    const att = 0.008;
    for (let i = start; i < n; i++) {
      const t = (i - start) / sr;
      const env = t < att ? Math.sin((Math.PI / 2) * (t / att)) : Math.exp(-(t - att) / c.decay);
      // 弁の閉鎖振動は減衰とともにわずかに周波数が下がる
      const ph = 2 * Math.PI * c.f * (t - 0.6 * t * t);
      lp += ((Math.random() * 2 - 1) - lp) * 0.012; // ~90 Hz の一次ローパスノイズ
      d[i] += c.amp * env * (Math.sin(ph) * 0.85 + lp * 2.5);
    }
  }
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(d[i]));
  for (let i = 0; i < n; i++) d[i] /= peak || 1;
  return buf;
}

// 小型スピーカー用の「仮想低音」: 100 Hz 未満はスマホではほぼ再生できないため、
// 低音を非線形処理して倍音 (100–300 Hz) を作り、脳に基音を補完させる
// (missing fundamental 現象。MaxxBass などの Virtual Bass と同じ原理)
function virtualBassCurve() {
  const n = 2048;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    // 非対称のソフトクリップ: 偶数次・奇数次の両方の倍音を生む
    curve[i] = Math.tanh(3 * x) * 0.8 + 0.25 * x * x;
  }
  return curve;
}

// ── 本体 ───────────────────────────────────────────────────────────────────
/**
 * @param {BaseAudioContext} ctx  AudioContext / OfflineAudioContext
 * @param {AudioNode} dest
 * @param {{ t0?: number, track?: (node: AudioScheduledSourceNode) => void, virtualBass?: boolean }} opts
 * @returns {{ scheduleUntil(t: number): void, pulseAt(t: number): number }}
 */
export function createWombSound(ctx, dest, { t0 = ctx.currentTime + 0.1, track = () => {}, virtualBass = true } = {}) {
  const P = WOMB;

  // 胎内フィルタ: 母体組織による低域通過 (4次 / 450 Hz → 1 kHz で約 −28 dB)
  // と 125 Hz 付近のわずかな増強
  const bus = ctx.createGain();
  const wombOut = chain(
    bus,
    biquad(ctx, 'lowshelf', 125, 0.707, 3.7),
    biquad(ctx, 'lowpass', 450),
    biquad(ctx, 'lowpass', 450),
  );
  wombOut.connect(dest);

  // 仮想低音に送る経路 (心音と大動脈音のみ — 拍のリズムを伝えるため)
  const vbIn = ctx.createGain();
  const shaper = ctx.createWaveShaper();
  shaper.curve = virtualBassCurve();
  shaper.oversample = '2x';
  const vbOut = ctx.createGain(); vbOut.gain.value = virtualBass ? LEVEL.virtualBass : 0;
  chain(vbIn, biquad(ctx, 'lowpass', 110), shaper,
        biquad(ctx, 'highpass', 100), biquad(ctx, 'lowpass', 300), vbOut);
  vbOut.connect(dest);

  const loop = (buffer, ...nodes) => {
    const src = ctx.createBufferSource();
    src.buffer = buffer; src.loop = true;
    chain(src, ...nodes);
    src.start(t0); track(src);
    return src;
  };
  const brown = noiseBuffer(ctx, 9, true);
  const white = noiseBuffer(ctx, 7, false);

  // 呼吸: 横隔膜の動きで背景音がゆっくり膨らむ。心拍の RSA と位相をそろえる
  const resp = ctx.createOscillator();
  resp.frequency.value = P.respRate / 60;
  resp.start(t0); track(resp);

  // 1) 背景の低周波ノイズ (< 100 Hz)
  const bgAmp = ctx.createGain(); bgAmp.gain.value = LEVEL.background;
  loop(brown, biquad(ctx, 'lowpass', 100), biquad(ctx, 'lowpass', 100), bgAmp);
  bgAmp.connect(bus);
  const respDepth = ctx.createGain(); respDepth.gain.value = LEVEL.background * 0.25;
  resp.connect(respDepth); respDepth.connect(bgAmp.gain);

  // 2) 母体大動脈音: 拍動性が強い (拡張期の流れが小さい) 低い「ゴォッ」
  const aortaEnv = flowEnvelopeBuffer(ctx, { diastolic: 0.12, accel: 0.06, tau: 0.11 });
  const aortaAmp = ctx.createGain(); aortaAmp.gain.value = LEVEL.aorta * aortaEnv.base;
  const aortaLp = biquad(ctx, 'lowpass', 160, 0.9);
  loop(brown, biquad(ctx, 'highpass', 30), aortaLp, aortaAmp);
  aortaAmp.connect(bus); aortaAmp.connect(vbIn);
  const aortaDepth = ctx.createGain(); aortaDepth.gain.value = LEVEL.aorta * (1 - aortaEnv.base);
  aortaDepth.connect(aortaAmp.gain);

  // 3) 子宮動脈の血管雑音 (200–800 Hz): 妊娠子宮の動脈は抵抗が低く拡張期にも
  //    血流が続くため (RI ≈ 0.5)、「ザッ…ザッ」が途切れずに脈打つ。
  //    流速が上がると乱流音の重心も高くなる
  const uterEnv = flowEnvelopeBuffer(ctx, { diastolic: 1 - P.uterineRI, accel: 0.09, tau: 0.17 });
  const murmurBp = biquad(ctx, 'bandpass', 300, 0.8);
  const murmurAmp = ctx.createGain(); murmurAmp.gain.value = LEVEL.murmur * uterEnv.base;
  loop(white, murmurBp, murmurAmp);
  murmurAmp.connect(bus);
  const murmurDepth = ctx.createGain(); murmurDepth.gain.value = LEVEL.murmur * (1 - uterEnv.base);
  murmurDepth.connect(murmurAmp.gain);
  const murmurSweep = ctx.createGain(); murmurSweep.gain.value = 200; // +200 Hz at peak
  murmurSweep.connect(murmurBp.frequency);

  // 4) 母体心音 S1 (僧帽弁 M1 → 三尖弁 T1) / S2 (大動脈弁 A2 → 肺動脈弁 P2)
  const s1 = heartSoundBuffer(ctx, [
    { f: 42, delay: 0,     decay: 0.035, amp: 1 },
    { f: 52, delay: 0.025, decay: 0.03,  amp: 0.7 },
  ], 0.2);
  const a2 = heartSoundBuffer(ctx, [{ f: 70, delay: 0, decay: 0.025, amp: 1 }], 0.14);
  const p2 = heartSoundBuffer(ctx, [{ f: 62, delay: 0, decay: 0.02,  amp: 1 }], 0.12);
  const heartAmp = ctx.createGain(); heartAmp.gain.value = LEVEL.heart;
  heartAmp.connect(bus); heartAmp.connect(vbIn);

  const oneShot = (buffer, t, gain, ...targets) => {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain(); g.gain.value = gain;
    src.connect(g);
    targets.forEach(n => g.connect(n));
    src.start(t);
  };

  // 5) 腸音: 小さな気泡がはじける音のかたまり。気泡の音は離れる際に
  //    ピッチが上がる (Minnaert 共鳴)。胎内フィルタを通るので丸く聞こえる
  function bowelCluster(t) {
    const bubbles = 2 + Math.floor(Math.random() * 7);
    const pan = (Math.random() - 0.5) * 0.6;
    let tt = t;
    for (let i = 0; i < bubbles; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const p = ctx.createStereoPanner(); p.pan.value = pan;
      const f0 = 140 + Math.random() * 260;
      const dur = 0.03 + Math.random() * 0.06;
      o.frequency.setValueAtTime(f0, tt);
      o.frequency.exponentialRampToValueAtTime(f0 * 1.35, tt + dur);
      const amp = LEVEL.bowel * (0.4 + Math.random() * 0.6);
      g.gain.setValueAtTime(0.0001, tt);
      g.gain.exponentialRampToValueAtTime(amp, tt + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, tt + dur);
      chain(o, g, p, bus);
      o.start(tt); o.stop(tt + dur + 0.02);
      tt += 0.03 + Math.random() * 0.14;
    }
  }

  // ── 拍のスケジューリング ──
  const respPhase = t => Math.sin(2 * Math.PI * (P.respRate / 60) * (t - t0)); // >0 で吸気
  const beats = [];        // 直近の S1 時刻 (映像との同期用)
  let nextBeat = t0 + 0.2;
  let nextBowel = t0 + 4 + Math.random() * P.bowelMeanGap;

  function scheduleBeat(t) {
    const insp = respPhase(t);
    const hr = P.hr + P.rsa * insp;
    // 振幅にもわずかな揺らぎを持たせる (同じ音の繰り返しに聞こえないように)
    const amp = 0.9 + Math.random() * 0.2;

    // 心音: S1、駆出時間の後に S2。S2 の分裂は吸気で広がる (生理的分裂)
    const lvet = (418 - 1.6 * hr) / 1000;
    const tS2 = t + P.ict + lvet;
    const split = 0.015 + 0.025 * Math.max(0, insp);
    oneShot(s1, t, amp, heartAmp);
    oneShot(a2, tS2, amp * 0.75, heartAmp);
    oneShot(p2, tS2 + split, amp * 0.4, heartAmp);

    // 血流: 駆出開始 + 脈波伝播時間 の後に到達
    const envShot = (env, tArrive, ...targets) => {
      const src = ctx.createBufferSource();
      src.buffer = env.buf;
      const g = ctx.createGain(); g.gain.value = amp;
      src.connect(g); targets.forEach(n => g.connect(n));
      src.start(tArrive);
    };
    envShot(aortaEnv, t + P.ict + P.pttAorta, aortaDepth);
    envShot(uterEnv, t + P.ict + P.pttUterine, murmurDepth, murmurSweep);

    beats.push(t);
    if (beats.length > 8) beats.shift();

    const rr = (60 / hr) * (1 + (Math.random() * 2 - 1) * P.hrv);
    return t + rr;
  }

  function scheduleUntil(tEnd) {
    while (nextBeat < tEnd) nextBeat = scheduleBeat(nextBeat);
    while (nextBowel < tEnd) {
      bowelCluster(nextBowel);
      // ポアソン過程 (指数分布の間隔) で不規則に
      nextBowel += Math.max(3, -Math.log(1 - Math.random()) * P.bowelMeanGap);
    }
  }

  // 映像用: 時刻 t の大動脈の脈動 (0..1)
  function pulseAt(t) {
    let v = 0;
    for (const b of beats) {
      v += pulseShape(t - (b + P.ict + P.pttAorta), 0.06, 0.11);
    }
    return Math.min(1, v);
  }

  return { scheduleUntil, pulseAt };
}
