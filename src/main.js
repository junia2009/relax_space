import './style.css';
import { initScene, startThemeScene, stopScene } from './scenes.js';
import { initAudio, startThemeAudio, stopAudio, playBell } from './audio.js';
import { PATTERNS, initBreathing, startBreathing, stopBreathing } from './breathing.js';

// ── App state ──────────────────────────────────────────────────────────────
const state = {
  theme:    'ocean',
  minutes:  10,
  breathKey: 'box',
  remaining: 0,
  timerId:  null,
};

// ── Theme accent colors ────────────────────────────────────────────────────
const THEME_COLORS = {
  ocean:  '#44aaff',
  forest: '#55dd88',
  space:  '#9966ff',
  fire:   '#ff6600',
};

// ── Build DOM ──────────────────────────────────────────────────────────────
document.querySelector('#app').innerHTML = `
  <!-- ── Home ── -->
  <div id="home-screen" class="screen">
    <div class="home-inner">
      <p class="app-kicker">Relax Space</p>
      <h1 class="app-title">静かな時間を</h1>

      <div class="themes-grid">
        <div class="theme-card selected" data-theme="ocean">
          <div class="theme-emoji">🌊</div>
          <div class="theme-name">深海</div>
          <div class="theme-desc">静かな海の底で</div>
        </div>
        <div class="theme-card" data-theme="forest">
          <div class="theme-emoji">🌿</div>
          <div class="theme-name">森</div>
          <div class="theme-desc">夜の森の静寂に</div>
        </div>
        <div class="theme-card" data-theme="space">
          <div class="theme-emoji">✨</div>
          <div class="theme-name">宇宙</div>
          <div class="theme-desc">星空の彼方へ</div>
        </div>
        <div class="theme-card" data-theme="fire">
          <div class="theme-emoji">🔥</div>
          <div class="theme-name">焚き火</div>
          <div class="theme-desc">炎の温もりの中で</div>
        </div>
      </div>

      <div class="settings-row">
        <div class="setting-group">
          <span class="setting-label">タイマー</span>
          <div class="option-row" id="timer-opts">
            <button class="opt-btn" data-min="5">5分</button>
            <button class="opt-btn active" data-min="10">10分</button>
            <button class="opt-btn" data-min="20">20分</button>
            <button class="opt-btn" data-min="0">∞</button>
          </div>
        </div>
        <div class="setting-group">
          <span class="setting-label">呼吸法</span>
          <div class="option-row" id="breath-opts">
            <button class="opt-btn active" data-breath="box">ボックス</button>
            <button class="opt-btn" data-breath="478">4-7-8</button>
            <button class="opt-btn" data-breath="relax">自然</button>
          </div>
        </div>
      </div>

      <button class="start-btn" id="start-btn">は じ め る</button>
    </div>
  </div>

  <!-- ── Session ── -->
  <div id="session-screen" class="screen hidden">
    <canvas id="three-canvas"></canvas>

    <div id="ui-overlay">
      <button id="back-btn">← 戻る</button>
      <div id="timer-display"></div>

      <div id="breathing-wrap">
        <div id="ring-outer">
          <div id="breathing-circle">
            <span id="breath-phase">吸う</span>
            <span id="breath-count">4</span>
          </div>
        </div>
        <div id="breath-label"></div>
      </div>
    </div>

    <div id="completion">
      <p class="cmp-title">お疲れ様でした</p>
      <p class="cmp-sub">セッションが完了しました</p>
      <button class="cmp-btn" id="cmp-back">ホームに戻る</button>
    </div>
  </div>
`;

// ── Init Three.js ──────────────────────────────────────────────────────────
initScene(document.getElementById('three-canvas'));

// ── Init Breathing ─────────────────────────────────────────────────────────
initBreathing(
  document.getElementById('breathing-circle'),
  document.getElementById('breath-phase'),
  document.getElementById('breath-count'),
);

// ── Theme selection ────────────────────────────────────────────────────────
document.querySelectorAll('.theme-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    state.theme = card.dataset.theme;
  });
});

// ── Timer options ──────────────────────────────────────────────────────────
document.querySelectorAll('#timer-opts .opt-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#timer-opts .opt-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.minutes = parseInt(btn.dataset.min, 10);
  });
});

// ── Breathing options ──────────────────────────────────────────────────────
document.querySelectorAll('#breath-opts .opt-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#breath-opts .opt-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.breathKey = btn.dataset.breath;
  });
});

// ── Start / End ────────────────────────────────────────────────────────────
document.getElementById('start-btn').addEventListener('click', startSession);
document.getElementById('back-btn').addEventListener('click', endSession);
document.getElementById('cmp-back').addEventListener('click', endSession);

function startSession() {
  document.getElementById('home-screen').classList.add('hidden');
  document.getElementById('session-screen').classList.remove('hidden');
  document.getElementById('completion').classList.remove('visible');

  // Theme accent color
  document.documentElement.style.setProperty('--theme', THEME_COLORS[state.theme] ?? '#ffffff');

  // Three.js scene
  startThemeScene(state.theme);

  // Audio
  initAudio();
  startThemeAudio(state.theme);

  // Breathing
  document.getElementById('breath-label').textContent = PATTERNS[state.breathKey].label;
  startBreathing(state.breathKey);

  // Timer
  if (state.minutes > 0) {
    state.remaining = state.minutes * 60;
    renderTimer();
    state.timerId = setInterval(() => {
      state.remaining--;
      renderTimer();
      if (state.remaining <= 0) {
        clearInterval(state.timerId);
        state.timerId = null;
        playBell();
        setTimeout(() => document.getElementById('completion').classList.add('visible'), 1200);
      }
    }, 1000);
  } else {
    document.getElementById('timer-display').textContent = '∞';
  }
}

function endSession() {
  document.getElementById('session-screen').classList.add('hidden');
  document.getElementById('home-screen').classList.remove('hidden');
  document.getElementById('completion').classList.remove('visible');

  stopScene();
  stopAudio();
  stopBreathing();

  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
}

function renderTimer() {
  const m = Math.floor(state.remaining / 60);
  const s = state.remaining % 60;
  document.getElementById('timer-display').textContent = `${m}:${String(s).padStart(2, '0')}`;
}
