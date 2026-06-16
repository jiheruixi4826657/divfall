/**
 * server.js
 * Node.js 後端主體：Express + Socket.io
 * 部署至 Render 免費方案
 *
 * 【教學】為什麼需要後端伺服器？
 *  - 多人遊戲需要一個「中間人」同步所有玩家的位置/攻擊/傷害
 *  - Firebase 負責「存檔資料」，Socket.io 負責「即時通訊」
 *  - Render 免費版：每月750小時，閒置15分鐘會休眠
 *  - UptimeRobot 每5分鐘 ping /ping 端點，防止休眠
 *
 * 【部署步驟 — 保母版】
 *  1. 到 https://github.com 建立新 repo（取名 divfall-server）
 *  2. 把 server/ 資料夾內所有檔案推上去
 *  3. 到 https://render.com 註冊，New → Web Service
 *  4. 連結你的 GitHub repo
 *  5. Build Command: npm install
 *     Start Command: node server.js
 *  6. 部署完成後你會拿到一個 URL（如 https://divfall-server.onrender.com）
 *  7. 把這個 URL 填入前端 socket-client.js 的 SERVER_URL
 */

const express   = require('express');
const http      = require('http');
const { Server } = require('socket.io');
const { RoomManager } = require('./room-manager');
const { GameSync }    = require('./game-sync');

const app    = express();
const server = http.createServer(app);

// ── CORS 設定（允許你的 GitHub Pages 網址）──
// 部署後把下面的 origin 換成你的 GitHub Pages 網址
const io = new Server(server, {
  cors: {
    origin: [
      'https://你的帳號.github.io',  // ← 換成你的實際 GitHub Pages 網址
      'http://localhost:3000',        // 本地開發用
      'http://localhost:3333',
    ],
    methods: ['GET', 'POST'],
  },
  pingTimeout:  20000,
  pingInterval: 10000,
});

const rooms = new RoomManager();
const sync  = new GameSync(io, rooms);

// ════════════════════════════════════════
// 保活端點（UptimeRobot 每5分鐘 ping 這裡）
// ════════════════════════════════════════
app.get('/ping', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), rooms: rooms.count() });
});

app.get('/', (req, res) => {
  res.json({ name: '神殞 DIVFALL Server', version: '1.0' });
});

// ════════════════════════════════════════
// Socket.io 連線處理
// ════════════════════════════════════════
io.on('connection', (socket) => {
  console.log(`[Socket] 玩家連線: ${socket.id}`);

  // ── 建立房間 ──
  socket.on('create_room', ({ userId, username, cls }) => {
    const code = rooms.create(socket.id, userId, username, cls);
    socket.join(code);
    socket.emit('room_created', { code, room: rooms.get(code) });
    console.log(`[Room] ${username} 建立房間 ${code}`);
  });

  // ── 加入房間 ──
  socket.on('join_room', ({ code, userId, username, cls }) => {
    const result = rooms.join(code, socket.id, userId, username, cls);
    if (result.error) {
      socket.emit('join_error', { message: result.error });
      return;
    }
    socket.join(code);
    io.to(code).emit('room_updated', { room: rooms.get(code) });
    console.log(`[Room] ${username} 加入房間 ${code}`);
  });

  // ── 離開房間 ──
  socket.on('leave_room', ({ code }) => {
    handleLeave(socket, code);
  });

  // ── 房主開始遊戲 ──
  socket.on('start_game', ({ code }) => {
    const room = rooms.get(code);
    if (!room || room.host !== socket.id) return;
    if (room.players.length < 1) return;
    io.to(code).emit('game_start', { room });
    console.log(`[Room] 房間 ${code} 開始遊戲`);
  });

  // ── 玩家移動（100ms 間隔）──
  socket.on('player_move', (data) => {
    socket.to(data.code).emit('player_move', {
      socketId: socket.id,
      x: data.x,
      y: data.y,
    });
  });

  // ── 玩家攻擊（即時廣播）──
  socket.on('player_attack', (data) => {
    socket.to(data.code).emit('player_attack', {
      socketId: socket.id,
      targetId: data.targetId,
      damage:   data.damage,
      isCrit:   data.isCrit,
      element:  data.element,
    });
  });

  // ── 傷害結算（伺服器權威）──
  socket.on('damage_result', (data) => {
    sync.processDamage(socket, data);
  });

  // ── 卡牌選擇同步 ──
  socket.on('card_selected', (data) => {
    io.to(data.code).emit('card_selected', {
      socketId: socket.id,
      cardId:   data.cardId,
    });
  });

  // ── 神鏈技能請求 ──
  socket.on('divine_chain_request', (data) => {
    socket.to(data.code).emit('divine_chain_request', { from: socket.id });
  });

  socket.on('divine_chain_activate', (data) => {
    io.to(data.code).emit('divine_chain_activate', { by: socket.id });
  });

  // ── 斷線 ──
  socket.on('disconnect', () => {
    const code = rooms.findPlayerRoom(socket.id);
    if (code) handleLeave(socket, code);
    console.log(`[Socket] 玩家斷線: ${socket.id}`);
  });
});

// ── 離開房間共用邏輯 ──
function handleLeave(socket, code) {
  const result = rooms.leave(code, socket.id);
  socket.leave(code);
  if (result.roomEmpty) {
    console.log(`[Room] 房間 ${code} 已解散`);
  } else {
    io.to(code).emit('room_updated', { room: rooms.get(code) });
  }
}

// ════════════════════════════════════════
// 啟動伺服器
// ════════════════════════════════════════
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`[Server] 神殞 DIVFALL 伺服器啟動，Port: ${PORT}`);
});
