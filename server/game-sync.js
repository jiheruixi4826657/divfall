/**
 * game-sync.js
 * 伺服器端遊戲狀態同步（傷害結算、敵人同步）
 *
 * 【教學】為什麼傷害要由伺服器計算？
 *  如果讓玩家自己回報傷害，有人可以修改封包作弊（秒殺BOSS）
 *  由伺服器接收「我攻擊了這個敵人，使用了這個技能」
 *  然後伺服器自己計算傷害，廣播結果給所有人
 *  這叫「伺服器權威（Server Authoritative）」
 */

class GameSync {
  constructor(io, rooms) {
    this.io    = io;
    this.rooms = rooms;
    // 各房間的敵人狀態（簡化版，完整版需要完整同步敵人AI）
    this.enemyStates = new Map();
  }

  // 處理傷害請求
  processDamage(socket, { code, enemyId, damage, isCrit }) {
    const room = this.rooms.get(code);
    if (!room) return;

    // 取得或初始化房間敵人狀態
    if (!this.enemyStates.has(code)) {
      this.enemyStates.set(code, {});
    }
    const enemies = this.enemyStates.get(code);

    if (!enemies[enemyId]) {
      enemies[enemyId] = { hp: null }; // hp=null 表示還沒同步過
    }

    // 套用傷害
    if (enemies[enemyId].hp !== null) {
      enemies[enemyId].hp = Math.max(0, enemies[enemyId].hp - damage);
    }

    // 廣播傷害結果給房間所有人
    this.io.to(code).emit('damage_applied', {
      enemyId,
      damage,
      isCrit,
      from: socket.id,
      remainingHP: enemies[enemyId].hp,
    });

    // 敵人死亡判定
    if (enemies[enemyId].hp === 0) {
      this.io.to(code).emit('enemy_died', { enemyId });
      delete enemies[enemyId];
    }
  }

  // 初始化房間敵人（關卡開始時）
  initRoomEnemies(code, enemyList) {
    const state = {};
    enemyList.forEach(e => { state[e.id] = { hp: e.hp }; });
    this.enemyStates.set(code, state);
  }

  // 清理已解散房間的資料
  cleanRoom(code) {
    this.enemyStates.delete(code);
  }
}

module.exports = { GameSync };
