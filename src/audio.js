/**
 * Relax Space — Audio Engine
 *
 * 各テーマの音は src/sound/*.js で、研究で報告された音響特性・物理法則から
 * 合成している (根拠は各ファイル冒頭と README を参照)。ここでは
 * テーマの切り替え、音量、先読みスケジューリングだけを担う。
 *
 * 全テーマ共通の方針:
 *  1. 「具体的な音の出来事」として合成する: 定常的な広帯域ノイズは脳に
 *     「ノイズ」として認識されやすい。波・気泡・虫・パチパチのように
 *     時間的に変化する出来事として鳴らす (胎内音のみ例外: 途切れず続くこと
 *     自体が安心材料のため連続再生する)。
 *  2. 人の耳が最も敏感な 3–4 kHz 帯 (外耳道の共鳴) にエネルギーを集めない。
 *  3. 音の出来事は AudioContext の時刻で先読み予約する
 *     (setTimeout のゆらぎに左右されない)。
 */
import { createOcean } from './sound/ocean.js';
import { createForest } from './sound/forest.js';
import { createSpace } from './sound/space.js';
import { createFire } from './sound/fire.js';
import { createWombSound } from './sound/womb.js';

const SOUNDSCAPES = {
  ocean:  createOcean,
  forest: createForest,
  space:  createSpace,
  fire:   createFire,
  womb:   createWombSound,
};

let audioCtx = null;
let masterGain = null;
let currentGeneration = 0;
let activeSources = [];
let timers = [];
let soundscape = null;
let soundscapeTheme = null;

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
  soundscape = null;
  soundscapeTheme = null;
  if (masterGain) {
    masterGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.8);
    masterGain = null;
  }
}

export function startThemeAudio(theme) {
  stopAudio();
  const ctx = initAudio();
  const gen = currentGeneration;
  const create = SOUNDSCAPES[theme];
  if (!create) return;

  masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0, ctx.currentTime);
  masterGain.gain.linearRampToValueAtTime(0.55, ctx.currentTime + 5);
  masterGain.connect(ctx.destination);

  soundscape = create(ctx, masterGain, { track: node => activeSources.push(node) });
  soundscapeTheme = theme;

  function scheduler() {
    if (gen !== currentGeneration) return;
    soundscape.scheduleUntil(ctx.currentTime + 0.5);
    timers.push(setTimeout(scheduler, 150));
  }
  scheduler();
}

// 胎内音: 映像の脈動を実際に聞こえている拍に同期させる (0..1)
export function getWombPulse() {
  if (soundscapeTheme !== 'womb' || !audioCtx) return 0;
  return soundscape.pulseAt(audioCtx.currentTime - (audioCtx.outputLatency || 0));
}

// タイマー終了時: 寝かしつけ玩具のように、ゆっくり音を消してから止める
export function fadeOutAudio(seconds) {
  if (!masterGain || !audioCtx) return;
  const t = audioCtx.currentTime;
  masterGain.gain.cancelScheduledValues(t);
  masterGain.gain.setValueAtTime(masterGain.gain.value, t);
  masterGain.gain.linearRampToValueAtTime(0, t + seconds);
  const gen = currentGeneration;
  timers.push(setTimeout(() => { if (gen === currentGeneration) stopAudio(); }, (seconds + 0.5) * 1000));
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
