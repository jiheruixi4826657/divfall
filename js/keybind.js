/**
 * keybind.js  ──  自訂按鍵系統（橫向 2D 動作用）
 * ════════════════════════════════════════════════════════════════
 * - 定義所有「動作」(ACTIONS) 與預設鍵位
 * - 玩家可在設定面板重新綁定，存進 localStorage('divfall_keybind')
 * - game.js 在 keydown/keyup 時呼叫 actionForKey(key) 反查動作
 *
 * 【想加/改動作，改這裡】ACTIONS 加一條，預設鍵填進 keys 陣列即可。
 * 鍵值一律用 event.key.toLowerCase()（空白鍵 = ' '）。
 * ════════════════════════════════════════════════════════════════
 */

// 動作定義 + 出廠預設鍵位（一個動作可綁多顆鍵）
export const ACTIONS = {
  moveLeft:  { label: '左移',      keys: ['a', 'arrowleft'] },
  moveRight: { label: '右移',      keys: ['d', 'arrowright'] },
  jump:      { label: '跳躍 / 二段跳', keys: [' ', 'w', 'arrowup'] },
  roll:      { label: '翻滾 / 閃避',  keys: ['shift', 'l'] },
  drop:      { label: '下穿平台',   keys: ['s', 'arrowdown'] },
  attack:    { label: '普通攻擊',   keys: ['j'] },
  skill1:    { label: '技能 1',     keys: ['1', 'u'] },
  skill2:    { label: '技能 2',     keys: ['2', 'i'] },
  skill3:    { label: '技能 3',     keys: ['3', 'o'] },
  skill4:    { label: '技能 4',     keys: ['4', 'p'] },
  pause:     { label: '暫停選單',   keys: ['escape'] },
};

const STORAGE_KEY = 'divfall_keybind';

// 目前生效的綁定 { action: [key,...] }
let bindings = {};
// 反查表 { key: action }（同一顆鍵只對應一個動作，後綁的覆蓋前面）
let reverse  = {};

// ── 從預設複製一份乾淨綁定 ──
function freshDefaults() {
  const b = {};
  for (const [act, def] of Object.entries(ACTIONS)) b[act] = [...def.keys];
  return b;
}

// ── 重建反查表 ──
function rebuildReverse() {
  reverse = {};
  for (const [act, keys] of Object.entries(bindings)) {
    keys.forEach(k => { reverse[k] = act; });
  }
}

// ── 載入（localStorage 覆蓋預設；新版新增的動作自動補預設）──
export function loadBindings() {
  bindings = freshDefaults();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    for (const act of Object.keys(ACTIONS)) {
      if (Array.isArray(saved[act]) && saved[act].length) bindings[act] = saved[act];
    }
  } catch { /* 壞掉就用預設 */ }
  rebuildReverse();
  return bindings;
}

export function saveBindings() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings)); } catch {}
}

export function getBindings() { return bindings; }

// ── 由按下的鍵反查動作（找不到回 null）──
export function actionForKey(key) {
  return reverse[(key || '').toLowerCase()] || null;
}

// ── 重新綁定某動作為單一新鍵（會把該鍵從別的動作移除，避免衝突）──
export function rebindAction(action, newKey) {
  const k = (newKey || '').toLowerCase();
  if (!ACTIONS[action]) return;
  // 從所有動作移除這顆鍵
  for (const act of Object.keys(bindings)) {
    bindings[act] = bindings[act].filter(x => x !== k);
  }
  // 綁到目標動作
  bindings[action] = [k];
  rebuildReverse();
  saveBindings();
}

// ── 回復出廠預設 ──
export function resetBindings() {
  bindings = freshDefaults();
  rebuildReverse();
  saveBindings();
}

// ── 把鍵值轉成好看的標籤（給設定面板顯示）──
export function keyLabel(key) {
  const map = {
    ' ': 'Space', 'arrowleft': '←', 'arrowright': '→', 'arrowup': '↑', 'arrowdown': '↓',
    'shift': 'Shift', 'control': 'Ctrl', 'escape': 'Esc', 'enter': 'Enter', 'tab': 'Tab',
  };
  if (map[key]) return map[key];
  return key.length === 1 ? key.toUpperCase() : key;
}

// 啟動即載入
loadBindings();
