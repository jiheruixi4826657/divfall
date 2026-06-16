/**
 * room-manager.js
 * 房間的建立、加入、離開、查詢
 *
 * 【教學】房間代碼如何產生？
 *  6碼隨機大寫英數字，碰撞率極低
 *  房間存在記憶體中（Render 重啟後清空，這是正常的）
 */

class RoomManager {
  constructor() {
    this.rooms = new Map(); // code → RoomData
  }

  // 產生唯一6碼代碼
  _generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code;
    do {
      code = Array.from({ length: 6 }, () =>
        chars[Math.floor(Math.random() * chars.length)]
      ).join('');
    } while (this.rooms.has(code));
    return code;
  }

  // 建立房間
  create(socketId, userId, username, cls) {
    const code = this._generateCode();
    this.rooms.set(code, {
      code,
      host:    socketId,
      state:   'lobby',   // 'lobby' | 'ingame'
      players: [{
        socketId, userId, username, cls,
        hp: 100, maxHP: 100, ready: true
      }],
      createdAt: Date.now(),
    });
    return code;
  }

  // 加入房間
  join(code, socketId, userId, username, cls) {
    const room = this.rooms.get(code);
    if (!room)                        return { error: '找不到此房間' };
    if (room.state === 'ingame')      return { error: '遊戲已開始' };
    if (room.players.length >= 3)     return { error: '房間已滿（最多3人）' };
    if (room.players.find(p => p.userId === userId)) return { error: '您已在此房間' };

    room.players.push({ socketId, userId, username, cls, hp: 100, maxHP: 100, ready: false });
    return { ok: true };
  }

  // 離開房間
  leave(code, socketId) {
    const room = this.rooms.get(code);
    if (!room) return { roomEmpty: true };

    room.players = room.players.filter(p => p.socketId !== socketId);

    if (room.players.length === 0) {
      this.rooms.delete(code);
      return { roomEmpty: true };
    }

    // 如果房主離開，轉移給下一位
    if (room.host === socketId) {
      room.host = room.players[0].socketId;
    }

    return { ok: true };
  }

  get(code)           { return this.rooms.get(code) || null; }
  count()             { return this.rooms.size; }

  // 找出玩家所在的房間代碼
  findPlayerRoom(socketId) {
    for (const [code, room] of this.rooms) {
      if (room.players.find(p => p.socketId === socketId)) return code;
    }
    return null;
  }

  // 更新玩家 HP（給 GameSync 使用）
  updatePlayerHP(code, socketId, hp) {
    const room = this.rooms.get(code);
    if (!room) return;
    const player = room.players.find(p => p.socketId === socketId);
    if (player) player.hp = hp;
  }
}

module.exports = { RoomManager };
