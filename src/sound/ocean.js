/**
 * 深海 — 海の中で聞こえる音
 *
 * テーマは「海の底」なので、浜辺で聞く波音ではなく水中の音場を合成する。
 *
 *  - 水中で聞こえる波の音の正体は、砕けた波が巻き込んだ気泡の振動音。
 *    気泡は半径に反比例した固有振動数で鳴る (Minnaert 共鳴:
 *    f ≈ 3.26 / a [Hz, a は半径 m] → 半径 3 mm で約 1 kHz)。
 *    砕波音のスペクトルは 500–2000 Hz に山があり 1 kHz 付近が最大、
 *    2 kHz 以上は約 −10 dB/oct で下がる (Deane 1997)。
 *  - うねり (groundswell) の周期は 10–16 秒。砕波は周期ごとに訪れる。
 *  - 海面から深く離れるほど高域は吸収されるため、全体を緩やかに減衰させ、
 *    長い残響で水中の広がりを出す。
 *  - 遠くのザトウクジラの歌: 歌の単位 (unit) の基本周波数は 30 Hz–5 kHz、
 *    大半は 3 kHz 未満。距離で高域が落ちた、低く長いうなり声として鳴らす。
 *  - 水の音は自然音の中でも気分の改善効果が最も大きい
 *    (Buxton et al. 2021, PNAS のメタ分析)。
 */
import {
  noiseBuffer, biquad, chain, panner, noiseShot, reverb, expRand,
  justDrone, binauralBeat, eventScheduler,
} from './util.js';

const MINNAERT = 3.26; // f [Hz] × 半径 [m]

export function createOcean(ctx, dest, { t0 = ctx.currentTime + 0.1, track = () => {} } = {}) {
  // 水中の伝搬: 高域を緩やかに減衰 (深いほど暗い音に)
  const water = ctx.createGain(); water.gain.value = 4;
  const depthLp = biquad(ctx, 'lowpass', 2200, 0.5);
  chain(water, depthLp, dest);
  const verb = reverb(ctx, { seconds: 4.5, decay: 2.5, damping: 0.8 });
  const verbIn = ctx.createGain(); verbIn.gain.value = 0.35;
  chain(water, verbIn, verb, dest);

  const brown = noiseBuffer(ctx, 6, true);

  // 気泡1個の音: 固有振動数で鳴り、急速に減衰しながら少しピッチが上がる
  function bubble(t, radiusMm, amp, pan) {
    const f = MINNAERT / (radiusMm / 1000);
    const dur = 0.02 + radiusMm * 0.012; // 大きい泡ほど長く鳴る
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 1.15, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(amp, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    chain(o, g, panner(ctx, pan), water);
    o.start(t); o.stop(t + dur + 0.01);
  }

  // 1) 頭上で砕ける波: 気泡の群れ + 低いうねりの圧力変動
  function breakingWave(t) {
    const period = 10 + Math.random() * 4;  // うねりの周期 10–14 s
    const rise = 1.2 + Math.random() * 0.8;
    const fall = 3 + Math.random() * 2;
    const strength = 0.7 + Math.random() * 0.3;
    const pan = (Math.random() - 0.5) * 0.8;

    // 低い「ゴォー」(波の質量が動く圧力変動)
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22 * strength, t + rise);
    g.gain.exponentialRampToValueAtTime(0.0001, t + rise + fall);
    noiseShot(ctx, brown, t, rise + fall + 0.1,
      biquad(ctx, 'lowpass', 280), g, panner(ctx, pan), water);

    // 気泡: 砕けた瞬間に密度が最大になり、泡が抜けるにつれて減る。
    // 半径 1.5–6 mm (≈ 2.2 kHz–540 Hz、中心は約 1 kHz)
    const total = rise + fall;
    let tt = t + rise * 0.6;
    while (tt < t + total) {
      const k = (tt - t - rise * 0.6) / (total - rise * 0.6); // 0..1
      const density = 70 * strength * Math.exp(-4 * k);      // 個/秒
      if (density < 2) break;
      const r = 1.5 + Math.pow(Math.random(), 1.6) * 4.5;    // 小さい泡ほど多い
      bubble(tt, r, 0.018 * strength * (1 - k * 0.7), pan + (Math.random() - 0.5) * 0.6);
      tt += expRand(1 / density);
    }
    return t + period;
  }

  // 2) 近くを昇っていく泡の列 (ポコ…ポコポコ): 大きめの泡は低く丸い
  function bubbleStream(t) {
    const n = 4 + Math.floor(Math.random() * 8);
    const pan = (Math.random() - 0.5) * 1.4;
    let tt = t;
    for (let i = 0; i < n; i++) {
      const r = 5 + Math.random() * 5; // 半径 5–10 mm ≈ 650–330 Hz
      bubble(tt, r, 0.03 + Math.random() * 0.02, pan);
      tt += 0.08 + Math.random() * 0.25;
    }
    return t + 6 + expRand(14);
  }

  // 3) 遠いザトウクジラの歌: 2–4 個の unit からなるフレーズ
  function whale(t) {
    const units = 2 + Math.floor(Math.random() * 3);
    const pan = (Math.random() - 0.5) * 1.2;
    let tt = t;
    for (let i = 0; i < units; i++) {
      const f0 = 120 + Math.random() * 220;      // 120–340 Hz
      const glide = 0.7 + Math.random() * 0.7;   // 上がる/下がるうなり
      const dur = 1.4 + Math.random() * 1.6;
      const o = ctx.createOscillator();
      o.type = 'sawtooth';                       // 倍音を含む声
      o.frequency.setValueAtTime(f0, tt);
      o.frequency.exponentialRampToValueAtTime(f0 * glide, tt + dur);
      const vib = ctx.createOscillator();
      const vibG = ctx.createGain();
      vib.frequency.value = 4 + Math.random() * 2;
      vibG.gain.value = f0 * 0.012;
      vib.connect(vibG); vibG.connect(o.frequency);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, tt);
      g.gain.exponentialRampToValueAtTime(0.03, tt + dur * 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, tt + dur);
      // 遠距離: 倍音は上から順に失われる
      chain(o, biquad(ctx, 'lowpass', f0 * 2.5, 1.5), g, panner(ctx, pan), water);
      o.start(tt); o.stop(tt + dur + 0.05);
      vib.start(tt); vib.stop(tt + dur + 0.05);
      tt += dur + 0.4 + Math.random() * 1.2;
    }
    return tt + 35 + expRand(40);
  }

  // 深海の安定感: 純正律ドローン A1(55)・E2(82.5)・A2(110) Hz
  justDrone(ctx, dest, t0, track, 55, [1, 1.5, 2], 0.022);
  // バイノーラルビート 6 Hz (θ 波帯)
  binauralBeat(ctx, dest, t0, track, 200, 6, 0.012);

  return {
    scheduleUntil: eventScheduler([
      { next: t0 + 0.5, fire: breakingWave },
      { next: t0 + 4 + Math.random() * 4, fire: bubbleStream },
      { next: t0 + 12 + Math.random() * 10, fire: whale },
    ]),
  };
}
