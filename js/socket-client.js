/**
 * socket-client.js
 * 前端 Socket.io 連線管理
 *
 * 【教學】
 *  前端用 <script> 載入 socket.io CDN，然後 io() 建立連線
 *  SERVER_URL 就是你 Render 上伺服器的網址
 *  開發時指向 localhost，上線後換成 Render 的網址
 */

// ★★★ 部署後換成你的 Render 伺服器網址 ★★★
const SERVER_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : 'https://divfall-server.onrender.com';  // ← 換成你的 Render 網址

// Socket.io CDN 動態載入
let socket = null;

export function getSocket() { return socket; }

export async function connectSocket() {
  if (socket?.connected) return socket;

  // 動態載入 Socket.io 客戶端 script
  await loadScript('https://cdn.socket.io/4.7.2/socket.io.min.js');

  socket = io(SERVER_URL, {
    reconnection:      true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });

  socket.on('connect',    () => console.log('[Socket] 已連線:', socket.id));
  socket.on('disconnect', () => console.log('[Socket] 已斷線'));
  socket.on('connect_error', (e) => console.warn('[Socket] 連線失敗:', e.message));

  return socket;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload  = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// ════════════════════════════════════════
// 多人同步：移動（節流至100ms）
// ════════════════════════════════════════
let _lastMoveTime = 0;
export function emitMove(code, x, y) {
  const now = Date.now();
  if (now - _lastMoveTime < 100) return;
  _lastMoveTime = now;
  socket?.emit('player_move', { code, x, y });
}

// 攻擊（即時）
export function emitAttack(code, targetId, damage, isCrit, element) {
  socket?.emit('player_attack', { code, targetId, damage, isCrit, element });
}

// 傷害結算
export function emitDamage(code, enemyId, damage, isCrit) {
  socket?.emit('damage_result', { code, enemyId, damage, isCrit });
}

// 卡牌選擇
export function emitCardSelected(code, cardId) {
  socket?.emit('card_selected', { code, cardId });
}

export { SERVER_URL };
