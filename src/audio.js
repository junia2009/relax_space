let audioCtx = null;
let masterGainNode = null;
let currentGeneration = 0;
let activeSourceNodes = [];

export function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

export function getAudioContext() {
  return audioCtx;
}

export function stopAudio() {
  currentGeneration++;
  activeSourceNodes.forEach(n => {
    try { n.stop(); } catch (_) {}
  });
  activeSourceNodes = [];
  if (masterGainNode) {
    masterGainNode.gain.setTargetAtTime(0, audioCtx.currentTime, 0.5);
    masterGainNode = null;
  }
}

export function startThemeAudio(theme) {
  stopAudio();
  const ctx = initAudio();
  const gen = currentGeneration;

  masterGainNode = ctx.createGain();
  masterGainNode.gain.setValueAtTime(0, ctx.currentTime);
  masterGainNode.gain.linearRampToValueAtTime(0.7, ctx.currentTime + 3);
  masterGainNode.connect(ctx.destination);

  if (theme === 'ocean') startOcean(ctx, masterGainNode, gen);
  else if (theme === 'forest') startForest(ctx, masterGainNode, gen);
  else if (theme === 'space') startSpace(ctx, masterGainNode, gen);
  else if (theme === 'fire') startFire(ctx, masterGainNode, gen);
}

function isAlive(gen) {
  return gen === currentGeneration;
}

function noiseBuffer(ctx, seconds = 3) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function loopNoise(ctx, dest, filterType, filterFreq, filterQ, gain) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, 4);
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = filterType;
  f.frequency.value = filterFreq;
  f.Q.value = filterQ;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(f); f.connect(g); g.connect(dest);
  src.start();
  activeSourceNodes.push(src);
  return { src, filter: f, gain: g };
}

// ── Ocean ─────────────────────────────────────────────────────────────────
function startOcean(ctx, dest, gen) {
  // Deep drone
  [55, 55.4, 82.5].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    g.gain.value = [0.25, 0.15, 0.08][i];
    osc.connect(g); g.connect(dest);
    osc.start();
    activeSourceNodes.push(osc);
  });

  // Water ambience
  loopNoise(ctx, dest, 'bandpass', 350, 0.4, 0.12);

  // Bubble scheduler
  function bubble() {
    if (!isAlive(gen)) return;
    setTimeout(() => {
      if (!isAlive(gen)) return;
      try {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        const freq = 300 + Math.random() * 800;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.8, ctx.currentTime + 0.12);
        g.gain.setValueAtTime(0.04, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
        osc.connect(g); g.connect(dest);
        osc.start(); osc.stop(ctx.currentTime + 0.15);
      } catch (_) {}
      bubble();
    }, (1.5 + Math.random() * 4) * 1000);
  }
  bubble();
}

// ── Forest ────────────────────────────────────────────────────────────────
function startForest(ctx, dest, gen) {
  // Wind
  const { filter: windFilter } = loopNoise(ctx, dest, 'bandpass', 700, 0.3, 0.18);

  // LFO for wind swell
  const lfo = ctx.createOscillator();
  const lfoG = ctx.createGain();
  lfo.frequency.value = 0.08;
  lfoG.gain.value = 250;
  lfo.connect(lfoG); lfoG.connect(windFilter.frequency);
  lfo.start();
  activeSourceNodes.push(lfo);

  // Leaf rustle
  loopNoise(ctx, dest, 'highpass', 3000, 1, 0.03);

  // Bird chirp scheduler
  function bird() {
    if (!isAlive(gen)) return;
    setTimeout(() => {
      if (!isAlive(gen)) return;
      try {
        const baseFreq = 2200 + Math.random() * 1000;
        const pattern = [0, 1, 0.5, 1.2, 0].map(r => baseFreq * (1 + r * 0.3));
        let t = ctx.currentTime;
        pattern.forEach(freq => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.frequency.value = freq;
          osc.frequency.exponentialRampToValueAtTime(freq * 1.15, t + 0.08);
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.05, t + 0.04);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
          osc.connect(g); g.connect(dest);
          osc.start(t); osc.stop(t + 0.2);
          t += 0.14;
        });
      } catch (_) {}
      bird();
    }, (4 + Math.random() * 9) * 1000);
  }
  bird();
}

// ── Space ─────────────────────────────────────────────────────────────────
function startSpace(ctx, dest, gen) {
  // Layered detuned pads
  const notes = [55, 82.5, 110, 146.8];
  notes.forEach((freq, i) => {
    [-4, 0, 4].forEach(detune => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const lfo = ctx.createOscillator();
      const lfoG = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.detune.value = detune;
      lfo.frequency.value = 0.04 + i * 0.015;
      lfoG.gain.value = 3;
      lfo.connect(lfoG); lfoG.connect(osc.detune);
      lfo.start();
      activeSourceNodes.push(lfo);
      g.gain.value = 0.06 / notes.length;
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 600;
      osc.connect(filt); filt.connect(g); g.connect(dest);
      osc.start();
      activeSourceNodes.push(osc);
    });
  });

  // High shimmer
  const shimmer = ctx.createOscillator();
  const shimG = ctx.createGain();
  shimmer.frequency.value = 1760;
  shimG.gain.value = 0.008;
  shimmer.connect(shimG); shimG.connect(dest);
  shimmer.start();
  activeSourceNodes.push(shimmer);
}

// ── Fire ──────────────────────────────────────────────────────────────────
function startFire(ctx, dest, gen) {
  // Base fire roar
  const { gain: fireG } = loopNoise(ctx, dest, 'bandpass', 500, 0.5, 0.22);

  // Low warmth
  loopNoise(ctx, dest, 'lowpass', 120, 1, 0.28);

  // Flicker LFO on fire
  const flicker = ctx.createOscillator();
  const flickG = ctx.createGain();
  flicker.type = 'sawtooth';
  flicker.frequency.value = 6;
  flickG.gain.value = 0.06;
  flicker.connect(flickG); flickG.connect(fireG.gain);
  flicker.start();
  activeSourceNodes.push(flicker);

  // Crackle scheduler
  function crackle() {
    if (!isAlive(gen)) return;
    setTimeout(() => {
      if (!isAlive(gen)) return;
      try {
        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.06, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const filt = ctx.createBiquadFilter();
        filt.type = 'highpass';
        filt.frequency.value = 800;
        const g = ctx.createGain();
        g.gain.value = 0.25;
        src.connect(filt); filt.connect(g); g.connect(dest);
        src.start();
      } catch (_) {}
      crackle();
    }, (0.2 + Math.random() * 1.2) * 1000);
  }
  crackle();
}

// ── Bell (timer completion) ───────────────────────────────────────────────
export function playBell() {
  const ctx = initAudio();
  [[440, 0.6, 4], [1108, 0.2, 2.5], [1760, 0.08, 1.5]].forEach(([freq, vol, dur]) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + dur);
  });
}
