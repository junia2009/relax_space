// Breathing patterns: [inhale, hold-in, exhale, hold-out] seconds
export const PATTERNS = {
  'box':   { label: 'ボックス呼吸  4-4-4-4', phases: [4, 4, 4, 4] },
  '478':   { label: '4-7-8 呼吸法',          phases: [4, 7, 8, 0] },
  'relax': { label: '自然呼吸  4-6',          phases: [4, 0, 6, 0] },
};

const PHASE_NAMES  = ['吸う', '止める', '吐く', '止める'];
const PHASE_SCALE  = [1.5, 1.5, 1.0, 1.0]; // target scale at end of phase

let circleEl = null;
let phaseEl  = null;
let countEl  = null;

let running      = false;
let pattern      = null;
let phaseIdx     = 0;
let phaseStart   = 0;
let countdownId  = null;

export function initBreathing(circle, phase, count) {
  circleEl = circle;
  phaseEl  = phase;
  countEl  = count;
}

export function startBreathing(key) {
  stopBreathing();
  pattern  = PATTERNS[key] ?? PATTERNS['box'];
  phaseIdx = 0;
  running  = true;
  // Start with exhale scale so first inhale is visible
  applyScale(1.0, 0.05);
  phaseStart = performance.now();
  scheduleCountdown();
}

export function stopBreathing() {
  running = false;
  if (countdownId) { clearTimeout(countdownId); countdownId = null; }
}

// ── internals ──────────────────────────────────────────────────────────────
function currentPhaseDuration() {
  return pattern.phases[phaseIdx];
}

function advancePhase() {
  if (!running) return;
  phaseIdx = (phaseIdx + 1) % 4;

  // Skip zero-duration phases (e.g. no hold in "relax")
  if (currentPhaseDuration() === 0) {
    advancePhase();
    return;
  }
  phaseStart = performance.now();
  applyScale(PHASE_SCALE[phaseIdx], currentPhaseDuration());
  scheduleCountdown();
}

function scheduleCountdown() {
  if (!running) return;
  const dur = currentPhaseDuration();
  if (dur === 0) { advancePhase(); return; }

  updateLabel();
  const elapsed = (performance.now() - phaseStart) / 1000;
  const remaining = Math.max(0, dur - elapsed);
  countEl.textContent = Math.ceil(remaining);

  // Tick every ~100 ms for smooth countdown, advance when done
  if (remaining <= 0.05) {
    advancePhase();
    return;
  }
  countdownId = setTimeout(scheduleCountdown, 100);
}

function updateLabel() {
  if (phaseEl) phaseEl.textContent = PHASE_NAMES[phaseIdx];
}

function applyScale(scale, durationSec) {
  if (!circleEl) return;
  const easing = phaseIdx === 0 ? 'ease-in' : phaseIdx === 2 ? 'ease-out' : 'linear';
  circleEl.style.transition = `transform ${durationSec}s ${easing}`;
  circleEl.style.transform  = `scale(${scale})`;
}
