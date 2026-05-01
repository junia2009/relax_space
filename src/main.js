import './style.css';
import { initScene, startThemeScene, stopScene } from './scenes.js';
import { initAudio, startThemeAudio, stopAudio, playBell, setVolume } from './audio.js';
import { PATTERNS, initBreathing, startBreathing, stopBreathing } from './breathing.js';
import { ACHIEVEMENTS, loadUnlocked, recordTheme, checkAchievements } from './achievements.js';

// ── Version ────────────────────────────────────────────────────────────────
const VERSION = 'v1.5.2';

// ── App state ──────────────────────────────────────────────────────────────
const state = {
  theme:    'ocean',
  minutes:  10,
  breathKey: 'box',
  remaining: 0,
  timerId:  null,
};

// ── Volume state ───────────────────────────────────────────────────────────
const vol = { level: 1, muted: false };

// ── Retention / habit log ──────────────────────────────────────────────────
const LOG_KEY = 'relax_space_log';

function dateKey(d = new Date()) {
  return d.toISOString().split('T')[0];
}

function loadLog() {
  try { return JSON.parse(localStorage.getItem(LOG_KEY) || '{}'); } catch { return {}; }
}

function logSession(minutes) {
  if (minutes < 1) return;
  const log = loadLog();
  const k = dateKey();
  log[k] = (log[k] || 0) + minutes;
  localStorage.setItem(LOG_KEY, JSON.stringify(log));
}

function getStreak(log) {
  let streak = 0;
  const d = new Date();
  while (true) {
    if (log[dateKey(d)]) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return streak;
}

function habitMessage(streak) {
  if (streak >= 30) return '1ヶ月間、毎日続けています。すごい！';
  if (streak >= 14) return '2週間連続。習慣が定着してきました。';
  if (streak >= 7)  return '1週間連続！ 素晴らしいペースです。';
  if (streak >= 3)  return '3日連続。いいリズムが生まれています。';
  if (streak >= 1)  return '今日もリラックスできました。';
  return 'また来てね。';
}

function renderHomeStats() {
  const log = loadLog();
  const todayMin = log[dateKey()] || 0;
  const streak = getStreak(log);
  const el = document.getElementById('home-stats');
  if (!el) return;
  if (todayMin > 0 || streak > 0) {
    el.textContent = `今日 ${todayMin}分 · 連続 ${streak}日`;
    el.style.display = 'block';
  }
}

// ── Theme accent colors ────────────────────────────────────────────────────
const THEME_COLORS = {
  ocean:  '#44aaff',
  forest: '#55dd88',
  space:  '#9966ff',
  fire:   '#ff6600',
};

const THEME_GLOW = {
  ocean:  'rgba(68,170,255,0.22)',
  forest: 'rgba(85,221,136,0.22)',
  space:  'rgba(153,102,255,0.22)',
  fire:   'rgba(255,102,0,0.22)',
};

const THEME_GLOW_STRONG = {
  ocean:  'rgba(68,170,255,0.5)',
  forest: 'rgba(85,221,136,0.5)',
  space:  'rgba(153,102,255,0.5)',
  fire:   'rgba(255,102,0,0.5)',
};

// ── Build DOM ──────────────────────────────────────────────────────────────
document.querySelector('#app').innerHTML = `
  <!-- ── Home ── -->
  <div id="home-screen" class="screen">
    <div class="home-inner">
      <p class="app-kicker">Relax Space</p>
      <h1 class="app-title">静かな時間を</h1>
      <p class="app-desc">音・呼吸・映像で、数分間だけ<br>頭を手放す場所。</p>
      <p class="home-stats" id="home-stats"></p>
      <div id="home-achievements"></div>

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
        <button class="setting-pill" id="timer-pill">
          <span class="pill-label">タイマー</span>
          <span class="pill-sep">|</span>
          <span class="pill-value" id="timer-value">10分</span>
        </button>
        <button class="setting-pill" id="breath-pill">
          <span class="pill-label">呼吸法</span>
          <span class="pill-sep">|</span>
          <span class="pill-value" id="breath-value">ボックス</span>
        </button>
      </div>

      <button class="start-btn" id="start-btn">は じ め る</button>
    </div>
    <p class="version-badge">${VERSION}</p>
  </div>

  <!-- ── Session ── -->
  <div id="session-screen" class="screen hidden">
    <canvas id="three-canvas"></canvas>
    <div id="session-vignette"></div>

    <div id="ui-overlay">
      <div id="session-controls">
        <button id="back-btn">← 戻る</button>
        <div id="timer-display"></div>
        <div id="vol-ctrl">
          <button id="mute-btn" aria-label="ミュート">🔊</button>
          <input type="range" id="vol-slider" min="0" max="1" step="0.05" value="1" aria-label="音量">
        </div>
      </div>

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
      <p class="cmp-sub" id="cmp-sub">セッションが完了しました</p>
      <p class="cmp-stats" id="cmp-stats"></p>
      <p class="cmp-habit" id="cmp-habit"></p>
      <div id="cmp-achievements"></div>
      <button class="cmp-btn" id="cmp-back">ホームに戻る</button>
    </div>
  </div>

  <div id="settings-overlay"></div>
  <div id="settings-sheet">
    <div class="sheet-handle"></div>
    <p class="sheet-title" id="sheet-title"></p>
    <div class="sheet-opts" id="timer-opts">
      <button class="opt-btn" data-min="5">5分</button>
      <button class="opt-btn active" data-min="10">10分</button>
      <button class="opt-btn" data-min="20">20分</button>
      <button class="opt-btn" data-min="0">∞</button>
    </div>
    <div class="sheet-opts sheet-opts-hidden" id="breath-opts">
      <button class="opt-btn active" data-breath="box">ボックス</button>
      <button class="opt-btn" data-breath="478">4-7-8</button>
      <button class="opt-btn" data-breath="relax">自然</button>
    </div>
  </div>

  <div id="transition-veil"></div>
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

// ── Settings bottom sheet ──────────────────────────────────────────────────
function openSheet(type) {
  const timerOpts  = document.getElementById('timer-opts');
  const breathOpts = document.getElementById('breath-opts');
  document.getElementById('sheet-title').textContent = type === 'timer' ? 'タイマー' : '呼吸法';
  timerOpts.classList.toggle('sheet-opts-hidden',  type !== 'timer');
  breathOpts.classList.toggle('sheet-opts-hidden', type !== 'breath');
  document.getElementById('settings-sheet').classList.add('open');
  document.getElementById('settings-overlay').classList.add('open');
}

function closeSheet() {
  document.getElementById('settings-sheet').classList.remove('open');
  document.getElementById('settings-overlay').classList.remove('open');
}

document.getElementById('timer-pill').addEventListener('click',  () => openSheet('timer'));
document.getElementById('breath-pill').addEventListener('click', () => openSheet('breath'));
document.getElementById('settings-overlay').addEventListener('click', closeSheet);

// ── Timer options ──────────────────────────────────────────────────────────
document.querySelectorAll('#timer-opts .opt-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#timer-opts .opt-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.minutes = parseInt(btn.dataset.min, 10);
    document.getElementById('timer-value').textContent = btn.textContent;
    closeSheet();
  });
});

// ── Breathing options ──────────────────────────────────────────────────────
document.querySelectorAll('#breath-opts .opt-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#breath-opts .opt-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.breathKey = btn.dataset.breath;
    document.getElementById('breath-value').textContent = btn.textContent;
    closeSheet();
  });
});

// ── Home stats on load ─────────────────────────────────────────────────────
renderHomeStats();
renderHomeAchievements();

// ── Control auto-hide ──────────────────────────────────────────────────────
let fadeTimer = null;
function showSessionControls() {
  const el = document.getElementById('session-controls');
  if (!el) return;
  el.classList.remove('faded');
  clearTimeout(fadeTimer);
  fadeTimer = setTimeout(() => el.classList.add('faded'), 4000);
}

// ── Start / End ────────────────────────────────────────────────────────────
document.getElementById('start-btn').addEventListener('click', startSession);
document.getElementById('back-btn').addEventListener('click', endSession);
document.getElementById('cmp-back').addEventListener('click', endSession);

// ── Volume control ─────────────────────────────────────────────────────────
document.getElementById('mute-btn').addEventListener('click', () => {
  vol.muted = !vol.muted;
  document.getElementById('mute-btn').textContent = vol.muted ? '🔇' : '🔊';
  setVolume(vol.muted ? 0 : vol.level);
});

document.getElementById('vol-slider').addEventListener('input', e => {
  vol.level = parseFloat(e.target.value);
  if (!vol.muted) setVolume(vol.level);
  document.getElementById('mute-btn').textContent = vol.level === 0 ? '🔇' : '🔊';
});

function startSession() {
  const veil = document.getElementById('transition-veil');
  veil.classList.add('active');

  setTimeout(() => {
    document.getElementById('home-screen').classList.add('hidden');
    document.getElementById('session-screen').classList.remove('hidden');
    document.getElementById('completion').classList.remove('visible');

    // Reset volume UI
    vol.muted = false;
    vol.level = 1;
    document.getElementById('mute-btn').textContent = '🔊';
    document.getElementById('vol-slider').value = 1;

    // Theme accent color
    document.documentElement.style.setProperty('--theme', THEME_COLORS[state.theme] ?? '#ffffff');
    document.documentElement.style.setProperty('--theme-glow', THEME_GLOW[state.theme] ?? 'rgba(255,255,255,0.12)');
    document.documentElement.style.setProperty('--theme-glow-strong', THEME_GLOW_STRONG[state.theme] ?? 'rgba(255,255,255,0.5)');

    // Record theme for achievements
    recordTheme(state.theme);

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
          logSession(state.minutes);
          setTimeout(() => showCompletion(state.minutes), 1200);
        }
      }, 1000);
    } else {
      document.getElementById('timer-display').textContent = '∞';
      state.startedAt = Date.now();
    }

    // Start control auto-hide
    document.getElementById('session-screen').addEventListener('pointerdown', showSessionControls, { passive: true });
    showSessionControls();

    setTimeout(() => veil.classList.remove('active'), 80);
  }, 650);
}

function showCompletion(sessionMinutes) {
  const log    = loadLog();
  const todayMin = log[dateKey()] || 0;
  const streak = getStreak(log);

  document.getElementById('cmp-stats').textContent =
    `今日 ${todayMin}分 · 連続 ${streak}日`;
  document.getElementById('cmp-habit').textContent = habitMessage(streak);

  // Achievement check
  const { newlyUnlocked, unlockedCount, total } = checkAchievements(log, streak);
  renderCompletionAchievements(newlyUnlocked);
  renderHomeAchievements();

  document.getElementById('completion').classList.add('visible');
}

function renderCompletionAchievements(list) {
  const el = document.getElementById('cmp-achievements');
  if (!el) return;
  el.innerHTML = '';
  if (list.length === 0) return;

  list.forEach((ach, i) => {
    const card = document.createElement('div');
    card.className = 'ach-unlock';
    card.style.animationDelay = `${i * 0.18}s`;
    card.innerHTML = `
      <span class="ach-new">NEW</span>
      <span class="ach-icon">${ach.icon}</span>
      <span class="ach-info">
        <span class="ach-name">${ach.name}</span>
        <span class="ach-desc">${ach.desc}</span>
      </span>`;
    el.appendChild(card);
  });
}

function renderHomeAchievements() {
  const el = document.getElementById('home-achievements');
  if (!el) return;
  const unlocked = loadUnlocked();
  if (unlocked.length === 0) { el.innerHTML = ''; return; }

  const icons = ACHIEVEMENTS
    .filter(a => unlocked.includes(a.id))
    .map(a => `<span title="${a.name}">${a.icon}</span>`)
    .join('');

  el.innerHTML = `
    <div class="home-ach">
      <span class="home-ach-icons">${icons}</span>
      <span class="home-ach-count">${unlocked.length} / ${ACHIEVEMENTS.length}</span>
    </div>`;
}

function endSession() {
  const veil = document.getElementById('transition-veil');
  veil.classList.add('active');

  // Clean up auto-hide
  clearTimeout(fadeTimer);
  document.getElementById('session-screen').removeEventListener('pointerdown', showSessionControls);
  document.getElementById('session-controls')?.classList.remove('faded');

  setTimeout(() => {
    // Log elapsed minutes before clearing state
    const elapsed = state.minutes > 0
      ? state.minutes - Math.floor(state.remaining / 60)
      : Math.floor((Date.now() - (state.startedAt || Date.now())) / 60000);
    if (elapsed >= 1) logSession(elapsed);

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

    renderHomeStats();
    renderHomeAchievements();

    setTimeout(() => veil.classList.remove('active'), 80);
  }, 550);
}

function renderTimer() {
  const m = Math.floor(state.remaining / 60);
  const s = state.remaining % 60;
  document.getElementById('timer-display').textContent = `${m}:${String(s).padStart(2, '0')}`;
}
