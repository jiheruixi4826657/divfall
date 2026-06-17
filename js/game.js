/**
 * game.js
 * 遊戲主循環、場景管理、玩家物件
 *
 * 【教學】遊戲主循環概念：
 *  requestAnimationFrame 每 16.7ms（60fps）呼叫一次 gameLoop
 *  每次循環：
 *    1. update() → 更新所有物件位置、狀態
 *    2. render() → 把物件畫到 canvas
 *    3. 再次呼叫 requestAnimationFrame → 下一幀
 */

import { saveRun, clearRun, addExp, onBossKill, onChapterClear, updateProgress } from './data.js';
import { showCardChoice } from './cards.js';
import { playBGM, playSFX } from './bgm.js';
import { showDamageNumber, hitStop } from './combat.js';
import { drawHero } from './sprites.js';
import { updateFX, renderFXWorld, renderFlash, shakeOffset } from './fx.js';

// ── Canvas 設定 ──
const canvas = document.getElementById('game-canvas');
const ctx    = canvas.getContext('2d');

// ── 遊戲狀態 ──
export const GameState = {
  IDLE:     'idle',      // 未開始
  RUNNING:  'running',   // 跑圖中
  PAUSED:   'paused',    // 暫停（卡牌選擇中）
  BOSS:     'boss',      // BOSS 戰中
  DEAD:     'dead',      // 死亡
  CLEAR:    'clear',     // 通關
};

// ── 世界與等距投影設定 ──
// 遊戲邏輯都跑在「俯視世界座標 (wx, wy)」，
// 只有在繪製時才投影成 2.5D 斜角等距畫面（玩家永遠置中，世界在腳下捲動）
const WORLD = { w: 2600, h: 2600 };   // 競技場大小（世界座標）
const ISO   = { kx: 0.5, ky: 0.26 };  // 等距壓縮比例（2:1 斜角）

// ── 全局遊戲物件 ──
export const Game = {
  state:    GameState.IDLE,
  class:    null,        // 'varek' | 'lyra' | 'kael'
  chapter:  1,
  stage:    0,
  player:   null,
  enemies:  [],
  projectiles: [],
  effects:  [],
  camera:   { wx: WORLD.w / 2, wy: WORLD.h / 2 },

  // 時間
  lastTime: 0,
  delta:    0,           // 前一幀到這幀的秒數
  freeze:   0,           // 打擊頓停剩餘秒數（>0 時暫停更新但持續繪製）

  // 輸入狀態
  input: {
    up: false, down: false, left: false, right: false,
    attack: false, q: false, w: false, e: false, r: false,
    joystick: { x: 0, y: 0 },  // 手機搖桿
  },
};

// ── Canvas 自適應大小 ──
function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ════════════════════════════════════════
// 等距投影：世界座標 (wx,wy) → 螢幕像素 (x,y)
// 相機永遠跟著玩家，所以玩家會保持在畫面中央
// ════════════════════════════════════════
export function worldToScreen(wx, wy) {
  const dx = wx - Game.camera.wx;
  const dy = wy - Game.camera.wy;
  return {
    x: canvas.width  / 2 + (dx - dy) * ISO.kx,
    y: canvas.height / 2 + (dx + dy) * ISO.ky,
  };
}
// 深度值（越大越靠近鏡頭，越晚繪製）
function depthOf(wx, wy) { return wx + wy; }

// ════════════════════════════════════════
// 玩家類別
// ════════════════════════════════════════
export class Player {
  constructor(cls, stats) {
    this.cls   = cls;
    this.x     = WORLD.w / 2;   // 世界座標（不是螢幕座標）
    this.y     = WORLD.h / 2;
    this.w     = 40;
    this.h     = 40;
    this.speed = stats.speed;

    // 生命值
    this.maxHP = stats.hp;
    this.hp    = stats.hp;

    // 戰鬥數值
    this.atk    = stats.atk;
    this.def    = stats.def;
    this.critR  = stats.critR;   // 暴擊率 0~1
    this.critM  = stats.critM;   // 暴擊倍率 (e.g. 1.8)

    // 技能費用（會隨時間回復）
    this.maxCost   = 6;
    this.cost      = 6;
    this._costTimer = 0;

    // 動畫狀態（給 sprites.js 用）
    this.facing    = 1;          // 1=右, -1=左
    this.animTime  = 0;          // 動畫時鐘（累積秒數）
    this.moving    = false;      // 本幀是否在移動 → 走路動畫
    this.castTimer = 0;          // 施法動作剩餘秒數
    this.castDur   = 0.35;       // 施法動作總長
    this.atkTimer  = 0;          // 普攻揮砍剩餘秒數
    this.atkDur    = 0.28;       // 普攻揮砍總長

    // 無敵時間（受傷後短暫無敵，避免連續扣血）
    this.invincible = 0;

    // 職業專屬值
    if (cls === 'varek') {
      this.holyRage = 0;         // 聖怒值 0~100
    }
    if (cls === 'kael') {
      this.markStacks = {};      // 各敵人的暗殺標記層數
    }
  }

  // 每幀更新
  update(delta) {
    this.move(delta);
    if (this.invincible > 0) this.invincible -= delta;

    // 動畫時鐘 + 動作計時器衰減
    this.animTime += delta;
    if (this.castTimer > 0) this.castTimer -= delta;
    if (this.atkTimer  > 0) this.atkTimer  -= delta;

    // 費用回復：每 1.1 秒回 1 點（上限 maxCost）
    if (this.cost < this.maxCost) {
      this._costTimer += delta;
      if (this._costTimer >= 1.1) {
        this._costTimer = 0;
        this.cost = Math.min(this.maxCost, this.cost + 1);
        updateHUD();
      }
    }
  }

  // 移動
  move(delta) {
    const speed = this.speed * delta * 60; // 換算成像素/幀
    let dx = 0, dy = 0;

    // 鍵盤
    if (Game.input.left  || Game.input.joystick.x < -0.2) dx -= 1;
    if (Game.input.right || Game.input.joystick.x >  0.2) dx += 1;
    if (Game.input.up    || Game.input.joystick.y < -0.2) dy -= 1;
    if (Game.input.down  || Game.input.joystick.y >  0.2) dy += 1;

    // 斜向正規化（避免斜向更快）
    if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }

    // 是否在移動 → 驅動走路動畫
    this.moving = (dx !== 0 || dy !== 0);

    // 套用速度（世界座標，夾在競技場範圍內）
    this.x = clamp(this.x + dx * speed, 40, WORLD.w - 40);
    this.y = clamp(this.y + dy * speed, 40, WORLD.h - 40);

    // 朝向：依等距投影後的水平移動方向決定（dx-dy）
    const screenDir = dx - dy;
    if (Math.abs(screenDir) > 0.01) this.facing = Math.sign(screenDir);
  }

  // ── 觸發動作動畫（由 combat / 輸入呼叫）──
  playCast()   { this.castTimer = this.castDur; }
  playAttack() { this.atkTimer  = this.atkDur; }

  // 受傷
  takeDamage(dmg) {
    if (this.invincible > 0) return;
    this.hp = Math.max(0, this.hp - dmg);
    this.invincible = 0.6;    // 0.6 秒無敵
    updateHUD();

    if (this.cls === 'varek') {
      this.holyRage = Math.min(100, this.holyRage + dmg * 0.5);
    }

    if (this.hp <= 0) onPlayerDead();
    else playSFX('player_hurt');
  }

  // 回復
  heal(amount) {
    this.hp = Math.min(this.maxHP, this.hp + amount);
    updateHUD();
  }

  // sx,sy = 螢幕上「腳底」的位置（由主迴圈投影後傳入）
  render(ctx, sx, sy) {
    const blink = this.invincible > 0 && Math.floor(this.invincible * 10) % 2 === 0;

    // 地面陰影（移動時略縮，做出彈跳感）
    const shW = this.moving ? 20 : 22;
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(sx, sy, shW, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // 把動畫參數打包給 sprites.js
    drawHero(ctx, this.cls, sx, sy, {
      facing:   this.facing,
      animTime: this.animTime,
      moving:   this.moving,
      castP:    this.castDur > 0 ? Math.max(0, this.castTimer / this.castDur) : 0,
      attackP:  this.atkDur  > 0 ? Math.max(0, this.atkTimer  / this.atkDur)  : 0,
      blink,
      holyRage: this.holyRage || 0,
    });
  }
}

// ════════════════════════════════════════
// 敵人基礎類別
// ════════════════════════════════════════
export class Enemy {
  constructor({ id, name, hp, atk, speed, element, def, x, y, isBoss = false }) {
    this.id      = id;
    this.name    = name;
    this.maxHP   = hp;
    this.hp      = hp;
    this.atk     = atk;
    this.def     = def ?? (isBoss ? 40 : 12);  // 防禦（避免傷害計算出現 NaN）
    this.speed   = speed;
    this.element = element;  // 屬性（火/冰/... 用於傷害倍率）
    this.x       = x;
    this.y       = y;
    this.w       = isBoss ? 80 : 40;
    this.h       = isBoss ? 80 : 40;
    this.isBoss  = isBoss;
    this.alive   = true;

    this.attackCooldown = 0;
    this.phase = 1;          // BOSS 階段
  }

  update(delta) {
    if (!this.alive) return;
    this.moveTowardPlayer(delta);
    this.tryAttack(delta);
    this.updatePhase();
  }

  moveTowardPlayer(delta) {
    if (!Game.player) return;
    const dx = Game.player.x - this.x;
    const dy = Game.player.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 50) return; // 已到近戰距離
    const speed = this.speed * delta * 60;
    this.x += (dx / dist) * speed;
    this.y += (dy / dist) * speed;
  }

  tryAttack(delta) {
    this.attackCooldown -= delta;
    if (this.attackCooldown > 0 || !Game.player) return;
    const dist = Math.hypot(Game.player.x - this.x, Game.player.y - this.y);
    if (dist < 60) {
      Game.player.takeDamage(this.atk);
      this.attackCooldown = 1.2;
    }
  }

  updatePhase() {
    if (!this.isBoss) return;
    const pct = this.hp / this.maxHP;
    if (pct <= 0.3 && this.phase < 3) this.phase = 3;
    else if (pct <= 0.6 && this.phase < 2) this.phase = 2;
  }

  takeDamage(dmg) {
    this.hp = Math.max(0, this.hp - dmg);
    if (this.hp <= 0) this.die();
  }

  die() {
    this.alive = false;
    playSFX(this.isBoss ? 'boss_kill' : 'kill');
    // 通關結算統一由 checkStageClear 處理（避免重複觸發）
  }

  // sx,sy = 螢幕上「腳底」位置（主迴圈投影後傳入）
  render(ctx, sx, sy) {
    if (!this.alive) return;
    const hw = this.w/2, hh = this.h/2;
    const x = sx, y = sy - hh;  // 身體中心抬到腳底上方

    // 地面陰影
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(sx, sy, hw * 0.9, hw * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(x, y);

    if (this.isBoss) {
      // BOSS 光暈
      const t = Date.now()/600;
      const pulse = 1 + Math.sin(t)*0.08;
      const bg = ctx.createRadialGradient(0,0,10,0,0,hw*1.8*pulse);
      bg.addColorStop(0,'rgba(200,30,30,.3)'); bg.addColorStop(1,'transparent');
      ctx.fillStyle=bg; ctx.beginPath(); ctx.arc(0,0,hw*1.8*pulse,0,Math.PI*2); ctx.fill();

      // 身體
      const eg = ctx.createRadialGradient(-hw*.3,-hh*.3,4,0,0,hw);
      eg.addColorStop(0,'#8a1010'); eg.addColorStop(1,'#2a0000');
      ctx.fillStyle=eg;
      ctx.beginPath();
      // 六角形BOSS形狀
      for(let i=0;i<6;i++){
        const a=i*Math.PI/3 - Math.PI/6;
        i===0 ? ctx.moveTo(Math.cos(a)*hw*pulse, Math.sin(a)*hh*pulse)
              : ctx.lineTo(Math.cos(a)*hw*pulse, Math.sin(a)*hh*pulse);
      }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle='#ff4040'; ctx.lineWidth=2;
      ctx.stroke();

      // 眼睛
      ctx.fillStyle='#ff2020';
      ctx.beginPath(); ctx.arc(-12,-8,6,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(12,-8,6,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#fff';
      ctx.beginPath(); ctx.arc(-12,-8,3,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(12,-8,3,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#ff0000';
      ctx.beginPath(); ctx.arc(-12,-8,1.5,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(12,-8,1.5,0,Math.PI*2); ctx.fill();

      // 嘴
      ctx.strokeStyle='#ff4040'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(0,8,10,0.2,Math.PI-0.2); ctx.stroke();

    } else {
      // 普通敵人 — 暗色鬼怪造型
      const elemColors = {
        fire:'#e74c3c', ice:'#3498db', lightning:'#f1c40f',
        wood:'#27ae60', earth:'#8B5E3C', light:'#f9e4a0',
        dark:'#8e44ad', physical:'#95a5a6', magic:'#1abc9c'
      };
      const col = elemColors[this.element] || '#c0392b';

      // 身體光暈
      const sg = ctx.createRadialGradient(0,0,4,0,0,hw+6);
      sg.addColorStop(0, col+'88'); sg.addColorStop(1,'transparent');
      ctx.fillStyle=sg; ctx.beginPath(); ctx.arc(0,0,hw+6,0,Math.PI*2); ctx.fill();

      // 身體（橢圓）
      const eg2 = ctx.createRadialGradient(-6,-8,2,0,0,hw);
      eg2.addColorStop(0, col+'cc'); eg2.addColorStop(1,'#1a0008');
      ctx.fillStyle=eg2;
      ctx.beginPath(); ctx.ellipse(0,4,hw*.8,hh*.9,0,0,Math.PI*2); ctx.fill();

      // 眼睛
      ctx.fillStyle=col;
      ctx.beginPath(); ctx.arc(-7,-4,4,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(7,-4,4,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#fff';
      ctx.beginPath(); ctx.arc(-7,-4,2,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(7,-4,2,0,Math.PI*2); ctx.fill();

      // 爪子
      ctx.strokeStyle=col+'aa'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(-hw,0); ctx.lineTo(-hw-8,-6); ctx.moveTo(-hw,0); ctx.lineTo(-hw-8,4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hw,0);  ctx.lineTo(hw+8,-6);  ctx.moveTo(hw,0);  ctx.lineTo(hw+8,4); ctx.stroke();
    }

    ctx.restore();

    // HP 條
    const barW = Math.max(this.w, 50);
    const pct  = this.hp / this.maxHP;
    const barY = y - hh - 14;
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.fillRect(x - barW/2 - 1, barY - 1, barW + 2, 8);
    ctx.fillStyle = pct > 0.5 ? '#27ae60' : pct > 0.25 ? '#e67e22' : '#e74c3c';
    ctx.fillRect(x - barW/2, barY, barW * pct, 6);
    ctx.strokeStyle='rgba(255,255,255,.15)'; ctx.lineWidth=1;
    ctx.strokeRect(x - barW/2, barY, barW, 6);

    // 名稱（BOSS才顯示）
    if (this.isBoss) {
      ctx.fillStyle = '#ffaaaa';
      ctx.font = 'bold 13px "微軟正黑體",sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor='#000'; ctx.shadowBlur=4;
      ctx.fillText(this.name, x, y - hh - 20);
      ctx.shadowBlur=0;
    }
  }
}

// ════════════════════════════════════════
// 遊戲主循環
// ════════════════════════════════════════
function gameLoop(timestamp) {
  if (Game.state === GameState.IDLE) return;

  Game.delta   = Math.min((timestamp - Game.lastTime) / 1000, 0.05); // 最大 50ms 防卡頓
  Game.lastTime = timestamp;

  if (Game.state === GameState.RUNNING || Game.state === GameState.BOSS) {
    if (Game.freeze > 0) Game.freeze -= Game.delta;   // 頓停：暫停更新但畫面照常
    else update(Game.delta);
  }
  render();

  requestAnimationFrame(gameLoop);
}

function update(delta) {
  // 更新玩家
  if (Game.player) {
    Game.player.update(delta);
    // 相機平滑跟隨玩家（玩家保持畫面中央）
    Game.camera.wx += (Game.player.x - Game.camera.wx) * Math.min(1, delta * 10);
    Game.camera.wy += (Game.player.y - Game.camera.wy) * Math.min(1, delta * 10);
  }

  // 更新敵人
  Game.enemies.forEach(e => e.update(delta));

  // 更新效果
  Game.effects = Game.effects.filter(ef => {
    ef.life -= delta;
    return ef.life > 0;
  });

  // 更新投射物
  Game.projectiles.forEach(p => p.update(delta));
  Game.projectiles = Game.projectiles.filter(p => p.alive);

  // 更新打擊特效（粒子/震屏/閃光）
  updateFX(delta);

  // 檢查關卡清除
  checkStageClear();
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 螢幕震動：把整個世界畫面做位移
  const so = shakeOffset();
  ctx.save();
  ctx.translate(so.x, so.y);

  // 背景漸層（深淵）— 畫大一點避免震動時露邊
  const bgGrad = ctx.createRadialGradient(canvas.width/2, canvas.height*0.45, 0, canvas.width/2, canvas.height*0.45, Math.max(canvas.width,canvas.height)*0.85);
  bgGrad.addColorStop(0, '#1a0f2e');
  bgGrad.addColorStop(0.6, '#0c0718');
  bgGrad.addColorStop(1, '#040208');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(-20, -20, canvas.width + 40, canvas.height + 40);

  renderIsoFloor();

  // 中心聚光燈（疊在地板上方，讓玩家周圍更亮）
  const cl = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 30, canvas.width/2, canvas.height/2, 360);
  cl.addColorStop(0, 'rgba(120,90,200,.16)');
  cl.addColorStop(1, 'transparent');
  ctx.fillStyle = cl;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 效果（地面層，畫在角色下方）
  renderEffects(ctx);

  // ── 收集所有角色，依深度（wx+wy）排序後繪製（遠的先畫）──
  const drawables = [];
  Game.enemies.forEach(e => { if (e.alive) drawables.push(e); });
  if (Game.player) drawables.push(Game.player);
  drawables.sort((a, b) => depthOf(a.x, a.y) - depthOf(b.x, b.y));

  drawables.forEach(obj => {
    const s = worldToScreen(obj.x, obj.y);
    obj.render(ctx, s.x, s.y);
  });

  // 投射物
  Game.projectiles.forEach(p => {
    const s = worldToScreen(p.x, p.y);
    p.render(ctx, s.x, s.y);
  });

  // 打擊粒子 / 斬擊弧（畫在角色之上）
  renderFXWorld(ctx, worldToScreen);

  ctx.restore();           // 結束螢幕震動位移

  // 命中閃光（不受震動影響，蓋全螢幕）
  renderFlash(ctx, canvas.width, canvas.height);
}

// ── 等距菱形地板 ──
function renderIsoFloor() {
  const G = 75; // 每格世界單位
  const cgx = Math.round(Game.camera.wx / G);
  const cgy = Math.round(Game.camera.wy / G);
  const R = 14; // 繪製半徑（格）
  for (let gy = cgy - R; gy <= cgy + R; gy++) {
    for (let gx = cgx - R; gx <= cgx + R; gx++) {
      const wx = gx * G, wy = gy * G;
      // 競技場外不畫
      if (wx < 0 || wy < 0 || wx > WORLD.w || wy > WORLD.h) continue;
      const c = worldToScreen(wx, wy);
      // 視錐裁切
      if (c.x < -100 || c.x > canvas.width + 100 || c.y < -100 || c.y > canvas.height + 100) continue;

      const hw = G * ISO.kx, hh = G * ISO.ky;
      const seed = ((gx * 73856093) ^ (gy * 19349663)) & 0xff;
      const shade = 22 + (seed % 16);
      ctx.fillStyle = `rgb(${shade + 14},${shade + 6},${shade + 28})`;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y - hh);
      ctx.lineTo(c.x + hw, c.y);
      ctx.lineTo(c.x, c.y + hh);
      ctx.lineTo(c.x - hw, c.y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(120,90,180,.14)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

function renderEffects(ctx) {
  Game.effects.forEach(ef => {
    const s = worldToScreen(ef.x, ef.y);
    ctx.globalAlpha = Math.max(0, ef.life);
    const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, ef.r);
    grad.addColorStop(0, ef.color || '#fff');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, ef.r * (1.1 - ef.life * 0.4), ef.r * ISO.ky / ISO.kx * (1.1 - ef.life * 0.4), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });
}

// ════════════════════════════════════════
// 關卡清除判定（每幀檢查，敵人全滅就結算）
// ════════════════════════════════════════
let _clearing = false;
function checkStageClear() {
  if (_clearing) return;
  if (Game.state !== GameState.RUNNING && Game.state !== GameState.BOSS) return;
  // 需要「曾經有敵人」且「全部死亡」
  if (Game.enemies.length === 0 || !Game.enemies.every(e => !e.alive)) return;

  _clearing = true;
  const clearedBoss = (Game.stage % 5 === 0);  // 剛清掉的是不是 BOSS 關
  Game.enemies = [];
  Game.state   = GameState.PAUSED;
  playSFX('card_pick');

  (async () => {
    // ── BOSS 結算：加天賦點、通關章節 ──
    if (clearedBoss) {
      try {
        await onBossKill(`ch${Game.chapter}_s${Game.stage}`);
        if (Game.stage % 50 === 0) {
          await onChapterClear();
          if (Game.chapter >= 5) { gameEnd(true); return; }
          Game.chapter++;
        }
      } catch (e) { console.warn('[結算] BOSS 獎勵寫入失敗（可能未登入）', e.message); }
    }

    // ── 進入下一關 ──
    Game.stage++;
    try {
      await saveRun({ cls: Game.class, chapter: Game.chapter, stage: Game.stage,
                      currentHP: Game.player.hp, gold: 0, deck: [] });
      await updateProgress(Game.chapter, Game.stage);
    } catch (e) { /* 未登入時略過雲端存檔，不影響遊玩 */ }

    // 卡牌獎勵：BOSS 5選2，一般 3選1
    const poolSize  = clearedBoss ? 5 : 3;
    const pickCount = clearedBoss ? 2 : 1;
    showCardChoice(() => { _clearing = false; loadNextStage(); }, poolSize, pickCount);
  })();
}

// ════════════════════════════════════════
// 玩家死亡
// ════════════════════════════════════════
function onPlayerDead() {
  Game.state = GameState.DEAD;
  playSFX('hit_heavy');

  const runGold = 0; // TODO: 從跑圖記錄讀取
  showDeathScreen(runGold);
}

function showDeathScreen(runGold) {
  const overlay = document.createElement('div');
  overlay.id = 'death-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,.85);
    display:flex;flex-direction:column;align-items:center;
    justify-content:center;gap:20px;z-index:100;color:#E8E0F8;
    font-family:sans-serif;
  `;
  overlay.innerHTML = `
    <h2 style="color:#e74c3c;font-size:2rem">你已死亡</h2>
    <p>此局金幣：💰 ${runGold}</p>
    <p style="font-size:.85rem;color:#9080b0">保留金幣將扣除 5% 手續費</p>
    <div style="display:flex;gap:12px">
      <button id="btn-keep-gold" style="padding:12px 24px;background:#EF9F27;border:none;border-radius:8px;font-weight:700;cursor:pointer;color:#1a0e00">
        保留金幣（-5%）返回大廳
      </button>
      <button id="btn-abandon-gold" style="padding:12px 24px;background:#333;border:1px solid #555;border-radius:8px;color:#E8E0F8;cursor:pointer">
        放棄金幣返回大廳
      </button>
    </div>
  `;
  document.body.appendChild(overlay);

  const { settleDeath } = window.__DataFns || {};
  document.getElementById('btn-keep-gold').onclick = async () => {
    if (settleDeath) await settleDeath(runGold, true);
    location.reload();
  };
  document.getElementById('btn-abandon-gold').onclick = async () => {
    if (settleDeath) await settleDeath(runGold, false);
    location.reload();
  };
}

// ════════════════════════════════════════
// 遊戲通關
// ════════════════════════════════════════
function gameEnd(won) {
  Game.state = GameState.CLEAR;
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,.9);
    display:flex;flex-direction:column;align-items:center;
    justify-content:center;gap:20px;z-index:100;color:#E8E0F8;font-family:sans-serif;
  `;
  overlay.innerHTML = `
    <h2 style="color:#EF9F27;font-size:2.2rem">${won ? '神殞封印完成' : '遊戲結束'}</h2>
    <p style="color:#9080b0">你已封印了最後的墮神</p>
    <button onclick="location.reload()" style="padding:14px 32px;background:#EF9F27;border:none;border-radius:8px;font-weight:700;cursor:pointer;color:#1a0e00;font-size:1rem">返回主選單</button>
  `;
  document.body.appendChild(overlay);
}

// ════════════════════════════════════════
// 載入下一關
// ════════════════════════════════════════
export function loadNextStage() {
  Game.state = GameState.RUNNING;
  Game.enemies = [];
  spawnEnemiesForStage(Game.chapter, Game.stage);
  playBGM(Game.stage % 5 === 0 ? `ch${Game.chapter}_boss` : `ch${Game.chapter}_explore`);
  updateHUD();
}

// ── 依章節/關卡生成敵人 ──
function spawnEnemiesForStage(chapter, stage) {
  const isBoss = stage % 5 === 0;
  const stageInChapter = ((stage - 1) % 50) + 1;

  const px = Game.player?.x ?? WORLD.w / 2;
  const py = Game.player?.y ?? WORLD.h / 2;

  if (isBoss) {
    const boss = BOSS_DATA[chapter]?.[Math.ceil(stageInChapter / 5) - 1]
              || BOSS_DATA[chapter]?.[0]
              || { id:`ch${chapter}_boss`, name:'墮神守衛', hp: 8000 + chapter*2000, atk: 40 + chapter*10, speed: 1.1, element: (CHAPTER_ELEMENTS[chapter]||['物理'])[0] };
    Game.state = GameState.BOSS;
    Game.enemies.push(new Enemy({
      ...boss,
      x: clamp(px, 200, WORLD.w - 200),
      y: clamp(py - 300, 150, WORLD.h - 150),
      isBoss: true,
    }));
  } else {
    const count    = 3 + Math.floor(chapter * 1.5);
    const baseHP   = (200 + chapter * 150) * (1 + (stage % 5) * 0.08);
    const baseATK  = 10 + chapter * 8;
    const elements = CHAPTER_ELEMENTS[chapter] || ['物理'];
    for (let i = 0; i < count; i++) {
      // 在玩家周圍環狀生成（世界座標），避免貼臉
      const ang  = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const dist = 280 + Math.random() * 180;
      const ex = clamp(px + Math.cos(ang) * dist, 60, WORLD.w - 60);
      const ey = clamp(py + Math.sin(ang) * dist, 60, WORLD.h - 60);
      Game.enemies.push(new Enemy({
        id:      `enemy_ch${chapter}_s${stage}_${i}`,
        name:    '腐化怪',
        hp:      Math.floor(baseHP),
        atk:     baseATK,
        speed:   1.5,
        element: elements[i % elements.length],
        x: ex, y: ey,
      }));
    }
  }
}

// ════════════════════════════════════════
// 職業預設數值
// ════════════════════════════════════════
const CLASS_STATS = {
  varek: { hp: 1200, atk: 85,  def: 60, speed: 2.2, critR: 0.10, critM: 1.80 },
  lyra:  { hp: 750,  atk: 110, def: 25, speed: 2.7, critR: 0.15, critM: 2.00 },
  kael:  { hp: 900,  atk: 100, def: 35, speed: 3.2, critR: 0.20, critM: 2.20 },
};

// ── 章節主要屬性 ──
const CHAPTER_ELEMENTS = {
  1: ['物理', '火'],
  2: ['木', '土'],
  3: ['冰', '雷'],
  4: ['暗', '光'],
  5: ['火', '冰', '雷', '木', '土', '光', '暗'],
};

// ── BOSS 資料（簡化版，完整版在 boss-data.js）──
const BOSS_DATA = {
  1: [
    { id: 'ch1_boss1', name: '熔鐵守衛', hp: 8000,  atk: 40, speed: 1.2, element: '火' },
    { id: 'ch1_boss2', name: '鐵甲騎士', hp: 9500,  atk: 45, speed: 1.0, element: '物理' },
    { id: 'ch1_boss3', name: '火焰犬',   hp: 10500, atk: 50, speed: 2.0, element: '火' },
    { id: 'ch1_boss4', name: '廢都守護', hp: 11500, atk: 55, speed: 1.3, element: '物理' },
    { id: 'ch1_boss5', name: '熔鐵機關', hp: 12000, atk: 58, speed: 1.0, element: '火' },
    { id: 'ch1_boss6', name: '鐵血將軍', hp: 13000, atk: 62, speed: 1.2, element: '物理' },
    { id: 'ch1_boss7', name: '爐心怪物', hp: 14000, atk: 65, speed: 1.5, element: '火' },
    { id: 'ch1_boss8', name: '廢都魔像', hp: 15000, atk: 68, speed: 0.9, element: '物理' },
    { id: 'ch1_boss9', name: '火焰巨人', hp: 16000, atk: 72, speed: 1.1, element: '火' },
    { id: 'ch1_final', name: '熔鐵巨像 IGNUS', hp: 45000, atk: 90, speed: 0.8, element: '火' },
  ],
};

// ════════════════════════════════════════
// 開始遊戲（從 Hub 呼叫）
// ════════════════════════════════════════
export function startGame(cls, savedRun = null) {
  Game.class   = cls;
  Game.chapter = savedRun?.chapter || 1;
  Game.stage   = savedRun?.stage   || 1;   // 從第 1 關開始（0 會被誤判成 BOSS 關而生不出怪）

  const stats = { ...CLASS_STATS[cls] };
  Game.player  = new Player(cls, stats);
  Game.camera  = { wx: Game.player.x, wy: Game.player.y };

  if (savedRun?.currentHP) Game.player.hp = savedRun.currentHP;

  document.getElementById('screen-hub').classList.add('hidden');
  document.getElementById('screen-game').classList.remove('hidden');

  setupInput();
  setupJoystick();
  updateHUD();
  loadNextStage();

  Game.lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

// ── 暫停 / 恢復（Hit Stop 用）──
export function pauseGame()  { Game.state = GameState.PAUSED; }
export function resumeGame() { Game.state = GameState.RUNNING; }

// ════════════════════════════════════════
// 鍵盤輸入
// ════════════════════════════════════════
let _inputBound = false;
function setupInput() {
  if (_inputBound) return;   // 避免重複綁定全域監聽
  _inputBound = true;

  const keyMap = {
    'arrowup': 'up', 'w': 'up',
    'arrowdown': 'down', 's': 'down',
    'arrowleft': 'left', 'a': 'left',
    'arrowright': 'right', 'd': 'right',
  };

  window.addEventListener('keydown', ev => {
    const key = ev.key.toLowerCase();
    if (key === 'escape') { togglePause(); return; }
    const k = keyMap[key];
    if (k) { Game.input[k] = true; ev.preventDefault(); }
    if (Game.state === GameState.PAUSED) return;
    if (ev.key === ' ') { triggerSkill('space'); ev.preventDefault(); }
    if (key === 'q') triggerSkill('q');
    if (key === 'e') triggerSkill('e');
    if (key === 'r') triggerSkill('r');
    if (key === 'f') triggerSkill('w');
    if (key === 'j' || key === 'k') triggerAttack();  // 普通攻擊
  });
  window.addEventListener('keyup', ev => {
    const k = keyMap[ev.key.toLowerCase()];
    if (k) Game.input[k] = false;
  });

  // 技能按鈕（手機）— touch + click 都綁，桌機也能按
  document.querySelectorAll('.skill-btn').forEach(btn => {
    const fire = ev => {
      ev.preventDefault();
      const s = btn.dataset.skill;
      if (s === 'attack') triggerAttack(); else triggerSkill(s);
    };
    btn.addEventListener('touchstart', fire, { passive: false });
    btn.addEventListener('click', fire);
  });

  // 普通攻擊（滑鼠點擊畫面 = 攻擊最近的敵人）
  canvas.addEventListener('click', () => {
    if (Game.state !== GameState.RUNNING && Game.state !== GameState.BOSS) return;
    triggerAttack();
  });
}

// ════════════════════════════════════════
// ESC 暫停選單
// ════════════════════════════════════════
let _pauseState = null;
function togglePause() {
  if (document.getElementById('pause-overlay')) { hidePause(); return; }
  if (Game.state !== GameState.RUNNING && Game.state !== GameState.BOSS) return;
  showPause();
}
function showPause() {
  _pauseState = Game.state;
  Game.state = GameState.PAUSED;
  const a = window.__Audio || {};
  const sfxOn = a.SFX?.enabled !== false;
  const bgmOn = a.BGM?.enabled !== false;
  const ov = document.createElement('div');
  ov.id = 'pause-overlay';
  ov.style.cssText = `position:fixed;inset:0;background:rgba(8,4,18,.82);z-index:200;
    display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;
    color:#E8E0F8;font-family:'微軟正黑體',sans-serif;backdrop-filter:blur(2px)`;
  ov.innerHTML = `
    <h2 style="color:#EF9F27;font-size:2rem;letter-spacing:.1em">暫停</h2>
    <button id="pz-resume" style="min-width:200px;padding:14px;background:linear-gradient(135deg,#b8730a,#EF9F27);border:none;border-radius:8px;font-weight:700;color:#1a0e00;cursor:pointer;font-size:1rem">繼續遊戲</button>
    <button id="pz-bgm" style="min-width:200px;padding:12px;background:rgba(20,15,35,.9);border:1px solid #5a4080;border-radius:8px;color:#E8E0F8;cursor:pointer">背景音樂：${bgmOn ? '開' : '關'}</button>
    <button id="pz-sfx" style="min-width:200px;padding:12px;background:rgba(20,15,35,.9);border:1px solid #5a4080;border-radius:8px;color:#E8E0F8;cursor:pointer">音效：${sfxOn ? '開' : '關'}</button>
    <button id="pz-quit" style="min-width:200px;padding:12px;background:#3a1010;border:1px solid #7a2020;border-radius:8px;color:#e8a0a0;cursor:pointer">放棄並返回大廳</button>
    <p style="font-size:.8rem;color:#7060a0">按 ESC 也可以繼續</p>`;
  document.body.appendChild(ov);
  document.getElementById('pz-resume').onclick = hidePause;
  document.getElementById('pz-bgm').onclick = (e) => {
    const on = a.BGM?.enabled !== false; a.setBGMEnabled?.(!on);
    e.target.textContent = `背景音樂：${!on ? '開' : '關'}`;
  };
  document.getElementById('pz-sfx').onclick = (e) => {
    const on = a.SFX?.enabled !== false; a.setSFXEnabled?.(!on);
    e.target.textContent = `音效：${!on ? '開' : '關'}`;
  };
  document.getElementById('pz-quit').onclick = () => location.reload();
}
function hidePause() {
  const ov = document.getElementById('pause-overlay');
  if (ov) ov.remove();
  if (_pauseState) { Game.state = _pauseState; _pauseState = null; }
}

// ════════════════════════════════════════
// 虛擬搖桿
// ════════════════════════════════════════
function setupJoystick() {
  const zone  = document.getElementById('joystick-zone');
  const base  = document.getElementById('joystick-base');
  const stick = document.getElementById('joystick-stick');
  if (!zone) return;

  let active = false;
  let originX, originY;
  const maxDist = 40;

  zone.addEventListener('touchstart', ev => {
    ev.preventDefault();
    active = true;
    const touch = ev.changedTouches[0];
    const rect  = base.getBoundingClientRect();
    originX = rect.left + rect.width  / 2;
    originY = rect.top  + rect.height / 2;
  });

  zone.addEventListener('touchmove', ev => {
    ev.preventDefault();
    if (!active) return;
    const touch = ev.changedTouches[0];
    let dx = touch.clientX - originX;
    let dy = touch.clientY - originY;
    const dist = Math.hypot(dx, dy);
    if (dist > maxDist) { dx = dx/dist*maxDist; dy = dy/dist*maxDist; }

    stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    Game.input.joystick = { x: dx / maxDist, y: dy / maxDist };
  });

  const endJoystick = () => {
    active = false;
    stick.style.transform = 'translate(-50%, -50%)';
    Game.input.joystick = { x: 0, y: 0 };
  };
  zone.addEventListener('touchend',   endJoystick);
  zone.addEventListener('touchcancel', endJoystick);
}

// ════════════════════════════════════════
// 攻擊 / 技能觸發（呼叫 combat.js）
// ════════════════════════════════════════
function triggerAttack() {
  if (!Game.player) return;
  if (Game.state !== GameState.RUNNING && Game.state !== GameState.BOSS) return;
  Game.player.playAttack();   // 揮砍動畫
  import('./combat.js').then(({ performAttack }) => {
    // 攻擊離玩家最近的敵人
    performAttack(Game.player, Game.enemies, Game.player.x, Game.player.y);
  });
}

function triggerSkill(skillKey) {
  if (Game.state !== GameState.RUNNING && Game.state !== GameState.BOSS) return;
  Game.player.playCast();     // 施法動畫
  import('./combat.js').then(({ performSkill }) => {
    performSkill(Game.player, skillKey, Game.enemies);
  });
}

// ════════════════════════════════════════
// HUD 更新
// ════════════════════════════════════════
function updateHUD() {
  const p = Game.player;
  if (!p) return;

  const hpBar  = document.getElementById('hud-hp-bar');
  const hpText = document.getElementById('hud-hp-text');
  const costEl = document.getElementById('hud-cost-val');
  const chapEl = document.getElementById('hud-chapter');
  const stagEl = document.getElementById('hud-stage-num');

  if (hpBar)  hpBar.style.width  = `${(p.hp / p.maxHP) * 100}%`;
  if (hpText) hpText.textContent = `${Math.ceil(p.hp)} / ${p.maxHP}`;
  if (costEl) costEl.textContent = p.cost;
  if (chapEl) chapEl.textContent = `Chapter ${Game.chapter}`;
  if (stagEl) stagEl.textContent = `Stage ${Game.stage}`;
}

// ── 工具函數 ──
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// ── 掛載給其他模組存取（_update / loadNextStage 供除錯與測試用）──
window.__GameFns = { startGame, pauseGame, resumeGame, updateHUD, Game, loadNextStage, _update: update };

// Hub 按鈕事件
document.getElementById('btn-start-solo')?.addEventListener('click', () => {
  const selected = document.querySelector('.class-card.selected');
  if (!selected) return;
  startGame(selected.dataset.class);
});

document.querySelectorAll('.class-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.class-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    document.getElementById('btn-start-solo').disabled = false;
  });
});
