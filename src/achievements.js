export const ACHIEVEMENTS = [
  { id: 'first',    icon: '🌱', name: 'はじまり',      desc: '初めてのセッションを完了' },
  { id: 'streak3',  icon: '✨', name: '3日連続',        desc: '3日連続でセッション'       },
  { id: 'streak7',  icon: '🌙', name: '1週間の旅',      desc: '7日連続でセッション'       },
  { id: 'streak30', icon: '⭐', name: '月の習慣',        desc: '30日連続でセッション'      },
  { id: 'min60',    icon: '⏳', name: '1時間の静寂',    desc: '累計60分達成'              },
  { id: 'min300',   icon: '🧘', name: '修行者',          desc: '累計300分達成'             },
  { id: 'ocean',    icon: '🌊', name: '深海探検',        desc: '深海テーマを使用'          },
  { id: 'forest',   icon: '🌿', name: '森の精',          desc: '森テーマを使用'            },
  { id: 'space',    icon: '💫', name: '星の旅人',        desc: '宇宙テーマを使用'          },
  { id: 'fire',     icon: '🔥', name: '焚き火の番人',    desc: '焚き火テーマを使用'        },
  { id: 'alltheme', icon: '🎯', name: '全テーマ制覇',    desc: '全4テーマを使用'           },
];

const ACH_KEY     = 'relax_space_achievements';
const THEMES_KEY  = 'relax_space_themes';
const SESSION_KEY = 'relax_space_sessions';

export function loadUnlocked() {
  try { return JSON.parse(localStorage.getItem(ACH_KEY) || '[]'); } catch { return []; }
}

export function recordTheme(theme) {
  let themes;
  try { themes = JSON.parse(localStorage.getItem(THEMES_KEY) || '[]'); } catch { themes = []; }
  if (!themes.includes(theme)) {
    themes.push(theme);
    localStorage.setItem(THEMES_KEY, JSON.stringify(themes));
  }
}

// セッション完了時に呼ぶ。新解除実績の配列と合計解除数を返す。
export function checkAchievements(log, streak) {
  let themes;
  try { themes = JSON.parse(localStorage.getItem(THEMES_KEY) || '[]'); } catch { themes = []; }

  const totalMinutes  = Object.values(log).reduce((a, b) => a + b, 0);
  const totalSessions = incrementSessions();

  const stats = { totalMinutes, totalSessions, streak, themes };

  const CONDITIONS = {
    first:    s => s.totalSessions >= 1,
    streak3:  s => s.streak >= 3,
    streak7:  s => s.streak >= 7,
    streak30: s => s.streak >= 30,
    min60:    s => s.totalMinutes >= 60,
    min300:   s => s.totalMinutes >= 300,
    ocean:    s => s.themes.includes('ocean'),
    forest:   s => s.themes.includes('forest'),
    space:    s => s.themes.includes('space'),
    fire:     s => s.themes.includes('fire'),
    alltheme: s => s.themes.length >= 4,
  };

  const unlocked    = loadUnlocked();
  const newlyUnlocked = [];

  for (const ach of ACHIEVEMENTS) {
    if (!unlocked.includes(ach.id) && CONDITIONS[ach.id]?.(stats)) {
      unlocked.push(ach.id);
      newlyUnlocked.push(ach);
    }
  }

  if (newlyUnlocked.length > 0) {
    localStorage.setItem(ACH_KEY, JSON.stringify(unlocked));
  }

  return { newlyUnlocked, unlockedCount: unlocked.length, total: ACHIEVEMENTS.length };
}

function incrementSessions() {
  const n = (parseInt(localStorage.getItem(SESSION_KEY) || '0', 10)) + 1;
  localStorage.setItem(SESSION_KEY, String(n));
  return n;
}
