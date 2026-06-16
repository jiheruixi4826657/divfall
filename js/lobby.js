/**
 * lobby.js
 * 多人大廳：建立/加入房間、等待介面
 */

import { auth } from './firebase-init.js';
import { connectSocket, getSocket } from './socket-client.js';
import { startGame } from './game.js';

let currentCode = null;
let selectedClass = null;

// ── DOM 元素 ──
const btnOpenLobby  = document.getElementById('btn-open-lobby');
const btnBackHub    = document.getElementById('btn-back-hub');
const btnCreateRoom = document.getElementById('btn-create-room');
const btnJoinRoom   = document.getElementById('btn-join-room');
const btnStartMulti = document.getElementById('btn-start-multi');
const inputCode     = document.getElementById('input-room-code');
const lobbyError    = document.getElementById('lobby-error');
const roomInfo      = document.getElementById('lobby-room-info');
const codeDisplay   = document.getElementById('lobby-code-display');
const playersEl     = document.getElementById('lobby-players');

// 從 Hub 偵測選擇的職業
document.querySelectorAll('.class-card').forEach(c => {
  c.addEventListener('click', () => { selectedClass = c.dataset.class; });
});

// ── 開啟大廳 ──
btnOpenLobby?.addEventListener('click', async () => {
  if (!selectedClass) {
    alert('請先在主選單選擇職業');
    return;
  }
  document.getElementById('screen-hub').classList.add('hidden');
  document.getElementById('screen-lobby').classList.remove('hidden');
  lobbyError.textContent = '';

  await connectSocket();
  bindSocketEvents();
});

// ── 返回 Hub ──
btnBackHub?.addEventListener('click', () => {
  if (currentCode) getSocket()?.emit('leave_room', { code: currentCode });
  currentCode = null;
  roomInfo.classList.add('hidden');
  document.getElementById('screen-lobby').classList.add('hidden');
  document.getElementById('screen-hub').classList.remove('hidden');
});

// ── 建立房間 ──
btnCreateRoom?.addEventListener('click', () => {
  const user = auth.currentUser;
  if (!user) return;

  getSocket()?.emit('create_room', {
    userId:   user.uid,
    username: user.displayName || user.email,
    cls:      selectedClass,
  });
});

// ── 加入房間 ──
btnJoinRoom?.addEventListener('click', () => {
  const code = inputCode.value.trim().toUpperCase();
  if (code.length !== 6) { lobbyError.textContent = '請輸入6碼房間代碼'; return; }

  const user = auth.currentUser;
  if (!user) return;

  getSocket()?.emit('join_room', {
    code,
    userId:   user.uid,
    username: user.displayName || user.email,
    cls:      selectedClass,
  });
});

// ── 開始遊戲（房主）──
btnStartMulti?.addEventListener('click', () => {
  if (!currentCode) return;
  getSocket()?.emit('start_game', { code: currentCode });
});

// ════════════════════════════════════════
// Socket 事件
// ════════════════════════════════════════
function bindSocketEvents() {
  const socket = getSocket();
  if (!socket) return;

  // 房間建立成功
  socket.on('room_created', ({ code, room }) => {
    currentCode = code;
    codeDisplay.textContent = code;
    roomInfo.classList.remove('hidden');
    renderPlayers(room.players, room.host, socket.id);
    btnStartMulti.disabled = false; // 房主可開始
    lobbyError.textContent = '';
  });

  // 房間更新（有人加入/離開）
  socket.on('room_updated', ({ room }) => {
    renderPlayers(room.players, room.host, socket.id);
    // 非房主只有 >=2 人才顯示準備狀態
    const isHost = room.host === socket.id;
    btnStartMulti.disabled = !isHost || room.players.length < 1;
  });

  // 加入失敗
  socket.on('join_error', ({ message }) => {
    lobbyError.textContent = message;
  });

  // 遊戲開始
  socket.on('game_start', ({ room }) => {
    document.getElementById('screen-lobby').classList.add('hidden');
    startGame(selectedClass);
  });
}

// ── 渲染玩家列表 ──
function renderPlayers(players, hostSocketId, mySocketId) {
  if (!playersEl) return;
  const classNames = { varek:'斷神騎', lyra:'術式者', kael:'影刃者' };

  playersEl.innerHTML = players.map(p => `
    <div class="lobby-player-row">
      <div class="lobby-player-icon">${p.username?.[0] || '?'}</div>
      <span class="lobby-player-name">${p.username}</span>
      <span class="lobby-player-class">${classNames[p.cls] || p.cls}</span>
      ${p.socketId === hostSocketId ? '<span class="lobby-player-host">👑 房主</span>' : ''}
      ${p.socketId === mySocketId   ? '<span style="color:#1ABC9C;font-size:.72rem"> (你)</span>' : ''}
    </div>
  `).join('');
}
