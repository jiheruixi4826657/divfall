/**
 * multiplayer.js
 * 多人模式：客戶端遊戲同步邏輯
 *
 * 【教學】本地預測 + 伺服器修正：
 *  玩家移動時，本地立即更新（不等伺服器），畫面流暢
 *  伺服器回傳的位置若有偏差，用插值平滑修正（不會瞬間跳動）
 *  傷害結算則完全由伺服器決定（防止作弊）
 */

import { getSocket, emitMove, emitAttack, emitDamage, emitCardSelected } from './socket-client.js';
import { Game } from './game.js';
import { showDamageNumber } from './combat.js';
import { playSFX } from './bgm.js';

// 其他玩家的資料（非自己）
const remotePlayers = new Map(); // socketId → { x, y, cls, targetX, targetY, hp, maxHP }

// ════════════════════════════════════════
// 初始化多人同步（遊戲開始後呼叫）
// ════════════════════════════════════════
export function initMultiplayer(roomCode) {
  const socket = getSocket();
  if (!socket) return;

  window.__roomCode = roomCode;

  // ── 接收其他玩家位置 ──
  socket.on('player_move', ({ socketId, x, y }) => {
    if (socketId === socket.id) return;
    if (!remotePlayers.has(socketId)) {
      remotePlayers.set(socketId, { x, y, targetX: x, targetY: y, cls: 'varek', hp: 100, maxHP: 100 });
    } else {
      const p = remotePlayers.get(socketId);
      p.targetX = x;
      p.targetY = y;
    }
  });

  // ── 接收其他玩家攻擊動作（播放動畫）──
  socket.on('player_attack', ({ socketId, targetId, damage, isCrit }) => {
    if (socketId === socket.id) return;
    const enemy = Game.enemies.find(e => e.id === targetId);
    if (enemy) {
      enemy.takeDamage(damage);
      showDamageNumber(enemy.x, enemy.y - 30, damage, isCrit);
    }
  });

  // ── 傷害結算結果（伺服器回傳）──
  socket.on('damage_applied', ({ enemyId, damage, isCrit, remainingHP }) => {
    const enemy = Game.enemies.find(e => e.id === enemyId);
    if (!enemy) return;
    if (remainingHP !== null) enemy.hp = remainingHP;
    showDamageNumber(enemy.x, enemy.y - 30, damage, isCrit);
  });

  socket.on('enemy_died', ({ enemyId }) => {
    const enemy = Game.enemies.find(e => e.id === enemyId);
    if (enemy) { enemy.hp = 0; enemy.alive = false; }
  });

  // ── 卡牌選擇狀態同步 ──
  socket.on('card_selected', ({ socketId, cardId }) => {
    updateTeammatePickStatus(socketId, true);
  });

  // ── 隊友 HP 更新（顯示在左上角）──
  socket.on('teammate_hp', ({ socketId, hp, maxHP }) => {
    const p = remotePlayers.get(socketId) || {};
    p.hp = hp; p.maxHP = maxHP;
    remotePlayers.set(socketId, p);
    updateTeammateHUD();
  });

  // ── 開始同步自己的位置（每100ms）──
  startPositionSync(roomCode);
}

// ════════════════════════════════════════
// 每幀更新：遠端玩家位置插值
// ════════════════════════════════════════
export function updateRemotePlayers(delta) {
  remotePlayers.forEach((p) => {
    // 平滑插值（lerp 係數 = 0.2 per frame，約5幀追上）
    p.x = lerp(p.x, p.targetX, Math.min(1, delta * 12));
    p.y = lerp(p.y, p.targetY, Math.min(1, delta * 12));
  });
}

// ════════════════════════════════════════
// 渲染遠端玩家
// ════════════════════════════════════════
export function renderRemotePlayers(ctx) {
  const colors = { varek: '#EFD27A', lyra: '#7AF0EF', kael: '#B07AEF' };
  remotePlayers.forEach((p) => {
    ctx.globalAlpha = 0.85;
    ctx.fillStyle   = colors[p.cls] || '#aaaaaa';
    ctx.fillRect(p.x - 20, p.y - 20, 40, 40);
    ctx.globalAlpha = 1;

    // 名稱
    ctx.fillStyle  = '#E8E0F8';
    ctx.font       = '11px sans-serif';
    ctx.textAlign  = 'center';
    ctx.fillText(p.username || '隊友', p.x, p.y - 26);
  });
}

// ════════════════════════════════════════
// 同步攻擊結果到伺服器
// ════════════════════════════════════════
export function syncAttack(enemy, damage, isCrit, element) {
  const code = window.__roomCode;
  if (!code) return;
  emitAttack(code, enemy.id, damage, isCrit, element);
  emitDamage(code, enemy.id, damage, isCrit);
}

// ════════════════════════════════════════
// 同步卡牌選擇
// ════════════════════════════════════════
export function syncCardPick(cardId) {
  const code = window.__roomCode;
  if (!code) return;
  emitCardSelected(code, cardId);
}

// ════════════════════════════════════════
// 更新卡牌選擇介面的隊友狀態
// ════════════════════════════════════════
function updateTeammatePickStatus(socketId, done) {
  const socket = getSocket();
  const el = document.getElementById('card-teammate-status');
  if (!el) return;

  const p   = remotePlayers.get(socketId);
  const name = p?.username || '隊友';

  let row = el.querySelector(`[data-sid="${socketId}"]`);
  if (!row) {
    row = document.createElement('div');
    row.className = 'teammate-pick-status';
    row.dataset.sid = socketId;
    el.appendChild(row);
  }
  row.innerHTML = `
    <span class="name">${name}</span>
    <span class="${done ? 'done' : 'wait'}">${done ? '✓ 已選擇' : '⏳ 等待中'}</span>
  `;
}

// ════════════════════════════════════════
// 更新左上角隊友 HP 條
// ════════════════════════════════════════
function updateTeammateHUD() {
  const container = document.getElementById('hud-teammates');
  if (!container) return;

  container.innerHTML = '';
  remotePlayers.forEach((p, sid) => {
    const pct = p.maxHP > 0 ? (p.hp / p.maxHP * 100) : 0;
    const el  = document.createElement('div');
    el.className = 'teammate-bar';
    el.innerHTML = `
      <span class="teammate-name">${p.username || '隊友'}</span>
      <div class="teammate-hp-bar-wrap">
        <div class="teammate-hp-fill" style="width:${pct}%"></div>
      </div>
      <span style="font-size:.7rem;color:#9080b0">${Math.ceil(p.hp)}</span>
    `;
    container.appendChild(el);
  });
}

// ════════════════════════════════════════
// 位置同步定時器
// ════════════════════════════════════════
function startPositionSync(code) {
  setInterval(() => {
    const p = Game.player;
    if (!p || (Game.state !== 'running' && Game.state !== 'boss')) return;
    emitMove(code, Math.round(p.x), Math.round(p.y));

    // 同步自己的 HP 給隊友
    getSocket()?.emit('teammate_hp_update', {
      code,
      hp:    Math.ceil(p.hp),
      maxHP: p.maxHP,
    });
  }, 100);
}

// ── 插值工具 ──
function lerp(a, b, t) { return a + (b - a) * t; }

// ── 取得遠端玩家清單（給 game.js render 用）──
export function getRemotePlayers() { return remotePlayers; }
