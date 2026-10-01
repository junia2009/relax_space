/**
 * サウンドスケープ共通の部品。
 *
 * 各テーマは create*(ctx, dest, { t0, track }) を公開し、
 * { scheduleUntil(t) } を返す。音の出来事はすべて AudioContext の時刻で
 * 先読み予約するため、setTimeout のゆらぎに影響されず、
 * OfflineAudioContext でそのまま描画・解析もできる。
 */

export function noiseBuffer(ctx, seconds, brown) {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) { last = (last + w * 0.02) / 1.02; d[i] = last * 3.5; }
    else d[i] = w * 0.5;
  }
  // ループの継ぎ目でクリックが出ないよう両端を短くクロスフェード
  const fade = Math.floor(ctx.sampleRate * 0.05);
  for (let i = 0; i < fade; i++) {
    const a = i / fade;
    d[i] = d[i] * a + d[n - fade + i] * (1 - a);
  }
  return buf;
}

export function biquad(ctx, type, freq, Q = 0.707, gain = 0) {
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = Q; f.gain.value = gain;
  return f;
}

export function chain(...nodes) {
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
  return nodes[nodes.length - 1];
}

export function panner(ctx, pan) {
  const p = ctx.createStereoPanner();
  p.pan.value = pan;
  return p;
}

// 共有ノイズバッファから、ランダムな位置を短く切り出して鳴らす
// (出来事ごとに新しいバッファを生成しない)
export function noiseShot(ctx, buffer, t, dur, ...nodes) {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  chain(src, ...nodes);
  const offset = Math.random() * Math.max(0, buffer.duration - dur - 0.1);
  src.start(t, offset, dur);
  return src;
}

// 人工残響: 指数減衰するノイズを畳み込む。高域ほど早く減衰させ、
// 自然な空間 (水中・夜の森・宇宙の広がり) を表現する
export function reverb(ctx, { seconds = 3, decay = 3, damping = 0.6 } = {}) {
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * seconds);
  const ir = ctx.createBuffer(2, n, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      lp += ((Math.random() * 2 - 1) - lp) * (1 - damping * t); // 時間とともに暗くなる
      d[i] = lp * Math.pow(1 - t, decay);
    }
  }
  const conv = ctx.createConvolver();
  conv.buffer = ir;
  return conv;
}

// 乱数: 指数分布 (ポアソン過程の間隔)
export function expRand(mean) {
  return -Math.log(1 - Math.random()) * mean;
}

// 乱数: パレート分布 (べき乗則)。xmin 以上、上限 xmax で打ち切り
export function paretoRand(alpha, xmin = 1, xmax = Infinity) {
  return Math.min(xmax, xmin * Math.pow(1 - Math.random(), -1 / alpha));
}

// 純正律ドローン: 整数比の倍音列はうなりが最小で心理的に安定する
export function justDrone(ctx, dest, t0, track, root, ratios, gainPerPartial) {
  ratios.forEach((r, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gainPerPartial, t0 + 6 + i);
    osc.frequency.value = root * r;
    osc.detune.value = (Math.random() - 0.5) * 2;
    osc.connect(g); g.connect(dest);
    osc.start(t0); track(osc);
  });
}

// バイノーラルビート: 左右の耳に beatFreq だけ異なる純音を提示する
// (ヘッドホン使用時のみ成立。不安・痛み・注意への効果はメタ分析で
//  中程度 g = 0.45: Garcia-Argibay et al. 2019)
export function binauralBeat(ctx, dest, t0, track, baseFreq, beatFreq, vol) {
  [[-1, 0], [1, beatFreq]].forEach(([pan, offset]) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.value = baseFreq + offset;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 8);
    chain(osc, panner(ctx, pan), g, dest);
    osc.start(t0); track(osc);
  });
}

// 複数の「出来事の流れ」をまとめて先読み予約するスケジューラ。
// streams: [{ next: 最初の時刻, fire: t => 次の時刻 }]
export function eventScheduler(streams) {
  return function scheduleUntil(tEnd) {
    for (const s of streams) {
      while (s.next < tEnd) s.next = s.fire(s.next);
    }
  };
}
