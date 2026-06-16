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
  camera:   { x: 0, y: 0 },

  // 時間
  lastTime: 0,
  delta:    0,           // 前一幀到這幀的秒數

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
// 玩家類別
// ════════════════════════════════════════
export class Player {
  constructor(cls, stats) {
    this.cls   = cls;
    this.x     = canvas.width  / 2;
    this.y     = canvas.height / 2;
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

    // 技能費用
    this.maxCost = 3;
    this.cost    = 3;

    // 動畫
    this.facing  = 1;            // 1=右, -1=左
    this.animFrame = 0;
    this.animTimer = 0;

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

    // 套用速度
    this.x = clamp(this.x + dx * speed, 20, canvas.width  - 20);
    this.y = clamp(this.y + dy * speed, 20, canvas.height - 20);

    if (dx !== 0) this.facing = Math.sign(dx);
  }

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
    else playSFX('hit_light');
  }

  // 回復
  heal(amount) {
    this.hp = Math.min(this.maxHP, this.hp + amount);
    updateHUD();
  }

  render(ctx) {
    const blink = this.invincible > 0 && Math.floor(this.invincible * 10) % 2 === 0;
    ctx.globalAlpha = blink ? 0.35 : 1;
    const x = this.x, y = this.y;
    const f = this.facing; // 1=右 -1=左

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(f, 1);

    if (this.cls === 'varek') {
      // 聖怒光暈
      if (this.holyRage > 50) {
        const g = ctx.createRadialGradient(0,0,10,0,0,36);
        g.addColorStop(0, `rgba(255,210,80,${(this.holyRage-50)/100})`);
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0,0,36,0,Math.PI*2); ctx.fill();
      }
      // 盾（左手）
      ctx.fillStyle = '#8a6820'; ctx.strokeStyle = '#EFD27A'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(-14, 4, 7, 12, -0.2, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      // 身體
      const bg = ctx.createLinearGradient(-10,-18,10,18);
      bg.addColorStop(0,'#d4a540'); bg.addColorStop(1,'#7a5010');
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.roundRect(-10,-18,20,36,4); ctx.fill();
      // 護甲紋
      ctx.strokeStyle='rgba(255,220,100,.4)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(-8,-5); ctx.lineTo(8,-5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-8,5); ctx.lineTo(8,5); ctx.stroke();
      // 頭
      const hg = ctx.createRadialGradient(-2,-24,2,-2,-24,12);
      hg.addColorStop(0,'#f5dfa0'); hg.addColorStop(1,'#c08030');
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.arc(0,-26,11,0,Math.PI*2); ctx.fill();
      // 頭盔
      ctx.fillStyle='#EFD27A'; ctx.strokeStyle='#8a6820'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(-12,-26); ctx.arc(0,-26,12,Math.PI,0); ctx.closePath(); ctx.fill(); ctx.stroke();
      // 劍（右手）
      ctx.fillStyle='#ccc'; ctx.strokeStyle='#888'; ctx.lineWidth=1;
      ctx.fillRect(12,-22,5,28); ctx.strokeRect(12,-22,5,28);
      ctx.fillStyle='#EFD27A'; ctx.fillRect(9,-8,11,4);

    } else if (this.cls === 'lyra') {
      // 魔法光環
      const t = Date.now()/800;
      for (let i=0;i<3;i++){
        const a = t + i*2.094;
        ctx.beginPath(); ctx.arc(Math.cos(a)*20, Math.sin(a)*20+0, 4,0,Math.PI*2);
        ctx.fillStyle = ['rgba(100,220,255,.7)','rgba(80,180,255,.5)','rgba(150,255,220,.6)'][i];
        ctx.fill();
      }
      // 法袍
      const rg = ctx.createLinearGradient(-11,-16,11,20);
      rg.addColorStop(0,'#2a6a8a'); rg.addColorStop(1,'#0a2030');
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.moveTo(-11,-16); ctx.lineTo(11,-16); ctx.lineTo(14,20); ctx.lineTo(-14,20); ctx.closePath(); ctx.fill();
      // 法袍紋飾
      ctx.strokeStyle='rgba(100,220,255,.5)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(-8,0); ctx.lineTo(8,0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,-16); ctx.lineTo(0,20); ctx.stroke();
      // 頭
      const lhg = ctx.createRadialGradient(0,-27,2,0,-27,11);
      lhg.addColorStop(0,'#e0f8ff'); lhg.addColorStop(1,'#7ab8d0');
      ctx.fillStyle=lhg; ctx.beginPath(); ctx.arc(0,-26,11,0,Math.PI*2); ctx.fill();
      // 頭髮
      ctx.fillStyle='#b0e8ff';
      ctx.beginPath(); ctx.arc(0,-26,11,Math.PI,0); ctx.fill();
      ctx.beginPath(); ctx.arc(-6,-22,5,0,Math.PI); ctx.fill();
      // 法杖
      ctx.strokeStyle='#7AF0EF'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.moveTo(14,-24); ctx.lineTo(14,22); ctx.stroke();
      ctx.fillStyle='rgba(100,255,240,.9)';
      ctx.beginPath(); ctx.arc(14,-26,6,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#fff'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.arc(14,-26,6,0,Math.PI*2); ctx.stroke();

    } else { // kael
      // 暗影效果
      const sg = ctx.createRadialGradient(0,0,5,0,0,32);
      sg.addColorStop(0,'rgba(80,0,120,.4)'); sg.addColorStop(1,'transparent');
      ctx.fillStyle=sg; ctx.beginPath(); ctx.arc(0,0,32,0,Math.PI*2); ctx.fill();
      // 身體（皮革）
      const kg = ctx.createLinearGradient(-9,-16,9,18);
      kg.addColorStop(0,'#2a1040'); kg.addColorStop(1,'#0d0018');
      ctx.fillStyle=kg;
      ctx.beginPath(); ctx.roundRect(-9,-16,18,34,3); ctx.fill();
      // 斗篷
      ctx.fillStyle='rgba(40,0,70,.85)';
      ctx.beginPath(); ctx.moveTo(-12,-12); ctx.lineTo(-18,22); ctx.lineTo(-9,18); ctx.closePath(); ctx.fill();
      // 頭
      const khg = ctx.createRadialGradient(0,-27,2,0,-27,10);
      khg.addColorStop(0,'#d0b0e0'); khg.addColorStop(1,'#7040a0');
      ctx.fillStyle=khg; ctx.beginPath(); ctx.arc(0,-26,10,0,Math.PI*2); ctx.fill();
      // 面具
      ctx.fillStyle='rgba(20,0,40,.7)';
      ctx.beginPath(); ctx.ellipse(0,-24,7,5,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(180,100,255,.8)';
      ctx.beginPath(); ctx.arc(-3,-24,2,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(3,-24,2,0,Math.PI*2); ctx.fill();
      // 匕首（右）
      ctx.fillStyle='#B07AEF'; ctx.strokeStyle='#5a2090'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(12,-18); ctx.lineTo(18,2); ctx.lineTo(14,2); ctx.lineTo(10,-18); ctx.closePath(); ctx.fill(); ctx.stroke();
      // 匕首（左）
      ctx.fillStyle='#9060cf';
      ctx.beginPath(); ctx.moveTo(-12,-10); ctx.lineTo(-18,8); ctx.lineTo(-14,8); ctx.lineTo(-10,-10); ctx.closePath(); ctx.fill(); ctx.stroke();
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

// ════════════════════════════════════════
// 敵人基礎類別
// ════════════════════════════════════════
export class Enemy {
  constructor({ id, name, hp, atk, speed, element, x, y, isBoss = false }) {
    this.id      = id;
    this.name    = name;
    this.maxHP   = hp;
    this.hp      = hp;
    this.atk     = atk;
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
    if (this.isBoss) onBossDefeated(this);
  }

  render(ctx) {
    if (!this.alive) return;
    const x = this.x, y = this.y;
    const hw = this.w/2, hh = this.h/2;

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
    update(Game.delta);
  }
  render();

  requestAnimationFrame(gameLoop);
}

function update(delta) {
  // 更新玩家
  if (Game.player) Game.player.update(delta);

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

  // 檢查關卡清除
  checkStageClear();
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 背景漸層
  const bgGrad = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 0, canvas.width/2, canvas.height/2, Math.max(canvas.width,canvas.height)*0.8);
  bgGrad.addColorStop(0, '#120820');
  bgGrad.addColorStop(1, '#050308');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 石磚地板
  const tileW = 96, tileH = 64;
  const offX = ((Game.camera.x % tileW) + tileW) % tileW;
  const offY = ((Game.camera.y % tileH) + tileH) % tileH;
  for (let ty = -offY - tileH; ty < canvas.height + tileH; ty += tileH) {
    for (let tx = -offX - tileW; tx < canvas.width + tileW; tx += tileW) {
      const row = Math.floor((ty + offY) / tileH);
      const col = Math.floor((tx + offX) / tileW);
      const seed = (row * 31 + col * 17) & 0xff;
      const dark = 0.06 + (seed % 20) * 0.002;
      ctx.fillStyle = `rgba(${40+seed%10},${25+seed%8},${60+seed%12},${dark+0.18})`;
      ctx.fillRect(tx+1, ty+1, tileW-2, tileH-2);
      ctx.strokeStyle = 'rgba(80,60,120,.18)';
      ctx.lineWidth = 1;
      ctx.strokeRect(tx+1, ty+1, tileW-2, tileH-2);
    }
  }

  // 地板中心光暈（聚光燈效果）
  if (Game.player) {
    const pl = ctx.createRadialGradient(Game.player.x, Game.player.y, 20, Game.player.x, Game.player.y, 260);
    pl.addColorStop(0, 'rgba(80,50,140,.18)');
    pl.addColorStop(1, 'transparent');
    ctx.fillStyle = pl;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // 敵人
  Game.enemies.forEach(e => e.render(ctx));

  // 投射物
  Game.projectiles.forEach(p => p.render(ctx));

  // 玩家
  if (Game.player) Game.player.render(ctx);

  // 效果
  renderEffects(ctx);
}

function renderEffects(ctx) {
  Game.effects.forEach(ef => {
    ctx.globalAlpha = ef.life;
    ctx.fillStyle = ef.color || '#fff';
    ctx.beginPath();
    ctx.arc(ef.x, ef.y, ef.r * (1 - ef.life * 0.5), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });
}

// ════════════════════════════════════════
// 關卡清除判定
// ════════════════════════════════════════
function checkStageClear() {
  const allDead = Game.enemies.length > 0 && Game.enemies.every(e => !e.alive);
  if (!allDead) return;

  Game.enemies = [];
  Game.stage++;

  if (Game.stage % 5 === 0) {
    // BOSS 擊敗後的特殊流程由 onBossDefeated 處理
    return;
  }

  // 一般關卡清除
  Game.state = GameState.PAUSED;
  playSFX('card_pick');
  saveRun({
    cls: Game.class, chapter: Game.chapter, stage: Game.stage,
    currentHP: Game.player.hp, gold: 0, deck: [], skills: {}
  });
  updateProgress(Game.chapter, Game.stage);
  showCardChoice(() => {
    // 卡牌選完後繼續下一關
    loadNextStage();
  });
}

// ════════════════════════════════════════
// BOSS 擊敗
// ════════════════════════════════════════
async function onBossDefeated(boss) {
  await onBossKill(boss.id);

  if (Game.stage % 50 === 0) {
    // 章節 BOSS
    await onChapterClear();
    if (Game.chapter >= 5) {
      // 遊戲通關
      gameEnd(true);
      return;
    }
    Game.chapter++;
  }

  Game.state = GameState.PAUSED;
  // 顯示5選2卡牌（BOSS獎勵）
  showCardChoice(() => loadNextStage(), 5, 2);
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

  if (isBoss) {
    const boss = BOSS_DATA[chapter]?.[Math.ceil(stageInChapter / 5) - 1];
    if (boss) {
      Game.state = GameState.BOSS;
      Game.enemies.push(new Enemy({
        ...boss,
        x: canvas.width / 2,
        y: canvas.height / 3,
        isBoss: true,
      }));
    }
  } else {
    const count    = 3 + Math.floor(chapter * 1.5);
    const baseHP   = (200 + chapter * 150) * (1 + (stage % 5) * 0.08);
    const baseATK  = 10 + chapter * 8;
    const elements = CHAPTER_ELEMENTS[chapter] || ['物理'];
    for (let i = 0; i < count; i++) {
      Game.enemies.push(new Enemy({
        id:      `enemy_ch${chapter}_s${stage}_${i}`,
        name:    '腐化怪',
        hp:      Math.floor(baseHP),
        atk:     baseATK,
        speed:   1.5,
        element: elements[i % elements.length],
        x:       100 + Math.random() * (canvas.width  - 200),
        y:       100 + Math.random() * (canvas.height - 200),
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
  Game.stage   = savedRun?.stage   || 0;

  const stats = { ...CLASS_STATS[cls] };
  Game.player  = new Player(cls, stats);

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
function setupInput() {
  const keyMap = {
    'arrowup': 'up', 'w': 'up',
    'arrowdown': 'down', 's': 'down',
    'arrowleft': 'left', 'a': 'left',
    'arrowright': 'right', 'd': 'right',
    'q': 'q', 'e': 'e', 'r': 'r', 'f': 'w',
    ' ': 'space',
  };

  window.addEventListener('keydown', ev => {
    const k = keyMap[ev.key.toLowerCase()];
    if (k) { Game.input[k] = true; ev.preventDefault(); }
    if (ev.key === ' ') triggerSkill('space');
    if (ev.key.toLowerCase() === 'q') triggerSkill('q');
    if (ev.key.toLowerCase() === 'w') triggerSkill('w');
    if (ev.key.toLowerCase() === 'e') triggerSkill('e');
    if (ev.key.toLowerCase() === 'r') triggerSkill('r');
  });
  window.addEventListener('keyup', ev => {
    const k = keyMap[ev.key.toLowerCase()];
    if (k) Game.input[k] = false;
  });

  // 技能按鈕（手機）
  document.querySelectorAll('.skill-btn').forEach(btn => {
    btn.addEventListener('touchstart', ev => {
      ev.preventDefault();
      triggerSkill(btn.dataset.skill);
    });
  });

  // 普通攻擊（滑鼠點擊 canvas）
  canvas.addEventListener('click', ev => {
    if (Game.state !== GameState.RUNNING && Game.state !== GameState.BOSS) return;
    triggerAttack(ev.clientX, ev.clientY);
  });
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
function triggerAttack(targetX, targetY) {
  if (!Game.player) return;
  import('./combat.js').then(({ performAttack }) => {
    performAttack(Game.player, Game.enemies, targetX, targetY);
  });
}

function triggerSkill(skillKey) {
  if (Game.state !== GameState.RUNNING && Game.state !== GameState.BOSS) return;
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

// ── 掛載給其他模組存取 ──
window.__GameFns = { startGame, pauseGame, resumeGame, updateHUD, Game };

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
