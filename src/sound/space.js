/**
 * 宇宙
 *
 * 真空の宇宙に音はないが、宇宙空間を伝わる「電波」には耳で聞ける周波数の
 * ものがあり、探査機や地上の VLF 受信機で録音されている。その代表を合成する。
 *
 *  - ホイッスラー: 雷の電磁パルスが地球磁場に沿って宇宙空間を伝わる間に
 *    分散し、高い周波数ほど先に届くため「ヒューー」と下がる音になる。
 *    到達の遅れは Eckersley の法則 t = D / √f に従う (D: 分散係数)。
 *    磁力線に沿って南北半球を往復するとエコーが D の 2 倍、3 倍で
 *    さらに間延びして届く。本物は 1–10 kHz 帯だが、耳に刺さらないよう
 *    2.4 kHz–500 Hz の範囲で鳴らす。
 *  - 基盤は純正律ドローン (整数比の倍音列: うなりが最小で安定) と、
 *    極めて遅い揺らぎ。ノイズは使わない。
 */
import { biquad, chain, panner, reverb, expRand, justDrone, binauralBeat, eventScheduler } from './util.js';

export function createSpace(ctx, dest, { t0 = ctx.currentTime + 0.1, track = () => {} } = {}) {
  const verb = reverb(ctx, { seconds: 6, decay: 2, damping: 0.5 });
  const space = ctx.createGain(); space.gain.value = 5;
  space.connect(dest);
  const verbIn = ctx.createGain(); verbIn.gain.value = 0.5;
  chain(space, verbIn, verb, dest);

  // 1) 超低音パッド: 40 Hz 基音の純正律倍音列
  justDrone(ctx, dest, t0, track, 40, [1, 1.5, 2, 2.5, 3], 0.035);

  // 各倍音に極めて遅い揺らぎ (0.02–0.05 Hz) を与えて、空間の広がりを出す
  [40, 60, 80, 100, 120].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const modG = ctx.createGain();
    const g = ctx.createGain();
    osc.frequency.value = freq;
    mod.frequency.value = 0.02 + i * 0.008;
    modG.gain.value = 1.5; // ±1.5 cent
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.014, t0 + 8 + i * 1.5);
    mod.connect(modG); modG.connect(osc.detune);
    osc.connect(g); g.connect(dest);
    osc.start(t0); mod.start(t0);
    track(osc); track(mod);
  });

  // 2) ホイッスラー: f(t) = (D / (t + t_hi))² で下降する純音
  function whistlerTone(t, D, amp, pan) {
    const fHi = 2400, fLo = 500;
    const tHi = D / Math.sqrt(fHi);
    const tLo = D / Math.sqrt(fLo);
    const dur = tLo - tHi;
    const n = 64;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const tt = tHi + (i / (n - 1)) * dur;
      curve[i] = (D / tt) ** 2;
    }
    const o = ctx.createOscillator();
    o.frequency.setValueCurveAtTime(curve, t, dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(amp, t + dur * 0.15);
    g.gain.exponentialRampToValueAtTime(amp * 0.5, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    chain(o, g, panner(ctx, pan), space);
    o.start(t); o.stop(t + dur + 0.02);
    return dur;
  }

  function whistler(t) {
    const D = 35 + Math.random() * 30;   // 分散係数 [√s] (実測の典型 10–100)
    const pan = (Math.random() - 0.5) * 1.4;
    const amp = 0.012 + Math.random() * 0.006;
    const dur = whistlerTone(t, D, amp, pan);
    // 半球間を往復したエコー: 分散 2D・3D でより長く、より弱く
    if (Math.random() < 0.6) whistlerTone(t + dur * 1.1, D * 2, amp * 0.45, -pan * 0.5);
    if (Math.random() < 0.25) whistlerTone(t + dur * 3.3, D * 3, amp * 0.2, pan * 0.3);
    return t + 7 + expRand(12);
  }

  // バイノーラルビート 4 Hz (θ/δ 境界)
  binauralBeat(ctx, dest, t0, track, 180, 4, 0.018);

  return {
    scheduleUntil: eventScheduler([
      { next: t0 + 3 + Math.random() * 4, fire: whistler },
    ]),
  };
}
