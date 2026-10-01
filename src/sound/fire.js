/**
 * 焚き火
 *
 *  - パチパチ音: 薪の内部の水分やガスがはじける音。こうした「クラックリング
 *    ノイズ」は大小の出来事がべき乗則に従って分布する (Sethna, Dahmen &
 *    Myers 2001, Nature)。小さなパチが大半で、大きなパチッはまれ。
 *    また一度はじけると続けてはじけやすい (群発する) ため、
 *    自己励起型の点過程 (Hawkes 過程) で発生させる。
 *    大きな気泡ほど低く長く鳴る。
 *  - 炎のゆらぎ: 燃え上がった炎は浮力による渦で周期的に揺れ (パフィング)、
 *    その周波数は火元の直径 D [m] で決まる: f = 1.5 / √D
 *    (Cetegen & Ahmed 1993)。直径 50 cm の焚き火 → 約 2.1 Hz。
 *    常時鳴らさず、ときどき燃え上がる「ボォッ」として鳴らす。
 *  - 薪が崩れる音: まれに「ゴトッ」と沈み、火の粉が小さくはぜる。
 *  - 基盤は純正律ドローン (60 Hz + 90 Hz)。
 */
import {
  noiseBuffer, biquad, chain, panner, noiseShot, expRand, paretoRand,
  justDrone, binauralBeat, eventScheduler,
} from './util.js';

const FIRE_DIAMETER = 0.5;                        // m
const PUFF_HZ = 1.5 / Math.sqrt(FIRE_DIAMETER);   // ≈ 2.1 Hz

export function createFire(ctx, dest, { t0 = ctx.currentTime + 0.1, track = () => {} } = {}) {
  const white = noiseBuffer(ctx, 3, false);
  const brown = noiseBuffer(ctx, 6, true);

  // 焚き火は目の前: 残響なし。ごく軽く高域を丸める
  const out = ctx.createGain(); out.gain.value = 4;
  chain(out, biquad(ctx, 'lowpass', 5000, 0.5), dest);

  // 1) パチッ: 大きさ s はべき乗分布。大きいほど低く・長く・大きい
  function pop(t, s) {
    const size = Math.min(s, 8);                 // 1..8
    const freq = 2000 / Math.sqrt(size) * (0.8 + Math.random() * 0.4);
    const dur = 0.004 + size * 0.004;
    const g = ctx.createGain();
    const amp = Math.min(0.5, 0.05 * size);
    g.gain.setValueAtTime(amp, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.02);
    noiseShot(ctx, white, t, dur + 0.03,
      biquad(ctx, 'bandpass', freq, 2 + Math.random() * 3),
      g, panner(ctx, (Math.random() - 0.5) * 0.5), out);
  }

  // Hawkes 過程: 基本発生率 λ0 に、直前の出来事による励起が加わり指数減衰する
  const LAMBDA0 = 1.2;     // 回/秒
  const JUMP = 2.5;        // 1 回はじけるごとに増える発生率
  const TAU = 0.25;        // 励起の減衰時定数 [s]
  let excitation = 0;
  function crackle(t) {
    pop(t, paretoRand(2.2));                      // P(s) ∝ s^-3.2
    excitation += JUMP;
    // 次の発生までの間隔を、減衰する発生率のもとで逐次サンプリング (thinning)
    let tt = t;
    for (;;) {
      const lambdaMax = LAMBDA0 + excitation;
      const dt = expRand(1 / lambdaMax);
      tt += dt;
      excitation *= Math.exp(-dt / TAU);
      if (Math.random() * lambdaMax <= LAMBDA0 + excitation) return tt;
    }
  }

  // 2) 燃え上がり: 低い炎の音が膨らみ、パフィング周波数で揺れる
  function flare(t) {
    const dur = 3 + Math.random() * 4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.14, t + dur * 0.35);
    g.gain.linearRampToValueAtTime(0, t + dur);
    const puff = ctx.createGain(); puff.gain.value = 1;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = PUFF_HZ * (0.9 + Math.random() * 0.2);
    const depth = ctx.createGain(); depth.gain.value = 0.35;
    lfo.connect(depth); depth.connect(puff.gain);
    lfo.start(t); lfo.stop(t + dur + 0.1);
    noiseShot(ctx, brown, t, dur + 0.1,
      biquad(ctx, 'lowpass', 420, 0.8), g, puff, out);
    return t + 10 + expRand(14);
  }

  // 3) 薪が崩れる: 鈍い「ゴトッ」に続いて小さなパチが降る
  function settle(t) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    noiseShot(ctx, brown, t, 0.4, biquad(ctx, 'lowpass', 180, 1.2), g, out);
    const n = 8 + Math.floor(Math.random() * 12);
    for (let i = 0; i < n; i++) pop(t + 0.05 + expRand(0.35), 1 + Math.random() * 0.5);
    return t + 40 + expRand(50);
  }

  // 炉の温かみ: 純正律ドローン (60 Hz + 90 Hz, 純正 5 度)
  justDrone(ctx, dest, t0, track, 60, [1, 1.5], 0.025);
  // バイノーラルビート 6 Hz (θ 波帯)
  binauralBeat(ctx, dest, t0, track, 200, 6, 0.012);

  return {
    scheduleUntil: eventScheduler([
      { next: t0 + 0.3, fire: crackle },
      { next: t0 + 4 + Math.random() * 4, fire: flare },
      { next: t0 + 20 + Math.random() * 20, fire: settle },
    ]),
  };
}
