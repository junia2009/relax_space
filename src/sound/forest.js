/**
 * 森 — 夜の森
 *
 * テーマは「夜の森」(映像は蛍) なので、昼の小鳥ではなく夜の音で構成する。
 *
 *  - 鳴く虫: カンタン (樹上性のコオロギ) は約 2 kHz と鳴く虫の中で最も低く、
 *    スズムシ (約 3.2–4.5 kHz) やキリギリス (約 9.5 kHz) のように耳に刺さらない。
 *    人の耳が最も敏感な 3–4 kHz 帯 (外耳道の共鳴) を避けられる。
 *    翅の共鳴で鳴くため、ほぼ純音になる。
 *  - 鳴く速さは気温で決まる (Dolbear の法則, 1897:
 *    T[°C] = 10 + (N60 − 40) / 7)。初秋の夜 20 °C → 毎分 110 回。
 *    近くの個体どうしは鳴くタイミングがそろっていく (合唱の同期)。
 *  - フクロウ: 低い声で「ゴロスケ ホッホ」。夜の森の象徴としてまれに鳴く。
 *  - 遠くのせせらぎ: 流れの音も正体は水中の気泡の振動 (Minnaert 共鳴)。
 *    水の音は気分の改善効果が最も大きい (Buxton et al. 2021)。
 *    連続ノイズではなく、ひとつひとつの気泡の音の集まりとして合成する。
 *  - 葉擦れ: ときどき吹いて止む風。
 */
import {
  noiseBuffer, biquad, chain, panner, noiseShot, reverb, expRand,
  binauralBeat, eventScheduler,
} from './util.js';

const TEMP_C = 20;
const CHIRPS_PER_MIN = 40 + 7 * (TEMP_C - 10); // Dolbear の法則 → 110

export function createForest(ctx, dest, { t0 = ctx.currentTime + 0.1, track = () => {} } = {}) {
  // 夜の屋外: 短めの残響
  const air = ctx.createGain(); air.gain.value = 2.5;
  air.connect(dest);
  const verb = reverb(ctx, { seconds: 2.5, decay: 3, damping: 0.7 });
  const verbIn = ctx.createGain(); verbIn.gain.value = 0.3;
  chain(air, verbIn, verb, dest);

  const brown = noiseBuffer(ctx, 6, true);

  // 1) カンタンの合唱: 3 匹。共通の周期に少しずつ引き込まれて鳴く
  const period = 60 / CHIRPS_PER_MIN;
  const crickets = [0, 1, 2].map(i => ({
    freq: 1950 + i * 60 + Math.random() * 30,
    pan: [-0.6, 0.15, 0.7][i],
    amp: [0.012, 0.008, 0.01][i],
    phase: Math.random() * period,   // 最初はばらばら
    singing: true,
    toggleAt: t0 + 10 + Math.random() * 30,
  }));
  const cricketBus = ctx.createGain();
  chain(cricketBus, biquad(ctx, 'lowpass', 2600), air); // 距離で高域が少し落ちる

  function chirp(t, c) {
    // 1 回の鳴き = 翅を擦る 6–8 個のパルス (約 50 パルス/秒)
    const pulses = 6 + Math.floor(Math.random() * 3);
    const o = ctx.createOscillator();
    o.frequency.value = c.freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    for (let p = 0; p < pulses; p++) {
      const tp = t + p * 0.02;
      g.gain.setValueAtTime(0, tp);
      g.gain.linearRampToValueAtTime(c.amp, tp + 0.006);
      g.gain.linearRampToValueAtTime(0, tp + 0.016);
    }
    chain(o, g, panner(ctx, c.pan), cricketBus);
    o.start(t); o.stop(t + pulses * 0.02 + 0.02);
  }

  function cricketTick(t) {
    for (const c of crickets) {
      // 鳴いては休む (10–40 秒鳴き、5–20 秒休む)
      if (t >= c.toggleAt) {
        c.singing = !c.singing;
        c.toggleAt = t + (c.singing ? 10 + Math.random() * 30 : 5 + Math.random() * 15);
      }
      // 位相を共通のリズムへ少しずつ引き込む (合唱の同期)
      c.phase *= 0.85;
      if (c.singing) chirp(t + c.phase + Math.random() * 0.004, c);
    }
    return t + period * (1 + (Math.random() - 0.5) * 0.02);
  }

  // 2) フクロウ「ゴロスケ ホッホ」(低く、遠く)
  function hoot(t, f, dur, amp, pan) {
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(f * 1.04, t);
    o.frequency.linearRampToValueAtTime(f, t + dur * 0.4);
    o.frequency.linearRampToValueAtTime(f * 0.94, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(amp, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    chain(o, biquad(ctx, 'lowpass', 900), g, panner(ctx, pan), air);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function owl(t) {
    const f = 330 + Math.random() * 40;
    const pan = (Math.random() - 0.5) * 1.4;
    const a = 0.05;
    // ホッホ … ゴロスケ ホッホ
    hoot(t, f, 0.35, a, pan);
    hoot(t + 0.5, f, 0.35, a, pan);
    const s = t + 1.6;
    [0, 0.14, 0.28, 0.42].forEach((d, i) => hoot(s + d, f * (i % 2 ? 0.92 : 1), 0.12, a * 0.7, pan));
    hoot(s + 0.75, f, 0.35, a, pan);
    hoot(s + 1.25, f, 0.4, a, pan);
    return t + 45 + expRand(60);
  }

  // 3) 遠くのせせらぎ: 小さな気泡の音の集まり
  function brook(t) {
    const r = 1.2 + Math.pow(Math.random(), 1.5) * 4; // 半径 1.2–5.2 mm
    const f = 3.26 / (r / 1000);
    const dur = 0.015 + r * 0.01;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 1.2, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.004 + Math.random() * 0.004, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    chain(o, g, brookBus);
    o.start(t); o.stop(t + dur + 0.01);
    return t + expRand(1 / 18); // 平均 18 個/秒
  }
  const brookBus = ctx.createGain();
  chain(brookBus, biquad(ctx, 'lowpass', 1800), panner(ctx, -0.5), air);

  // 4) 葉擦れ: ときどき吹いて止む風
  function breeze(t) {
    const dur = 4 + Math.random() * 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.08, t + dur * 0.4);
    g.gain.linearRampToValueAtTime(0, t + dur);
    noiseShot(ctx, brown, t, dur + 0.1,
      biquad(ctx, 'bandpass', 350 + Math.random() * 200, 0.5),
      biquad(ctx, 'lowpass', 900), g, panner(ctx, (Math.random() - 0.5) * 1.2), air);
    return t + dur + 8 + Math.random() * 14;
  }

  // バイノーラルビート 10 Hz (α 波帯)
  binauralBeat(ctx, dest, t0, track, 220, 10, 0.014);

  return {
    scheduleUntil: eventScheduler([
      { next: t0 + 1, fire: cricketTick },
      { next: t0 + 0.5, fire: brook },
      { next: t0 + 3, fire: breeze },
      { next: t0 + 15 + Math.random() * 15, fire: owl },
    ]),
  };
}
