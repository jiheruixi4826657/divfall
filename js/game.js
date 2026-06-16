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

  // 繪製（暫時用矩形代替，之後換3D模型）
  render(ctx) {
    const alpha = this.invincible > 0 && Math.floor(this.invincible * 10) % 2 === 0 ? 0.3 : 1;
    ctx.globalAlpha = alpha;

    const colors = { varek: '#EFD27A', lyra: '#7AF0EF', kael: '#B07AEF' };
    ctx.fillStyle = colors[this.cls] || '#fff';
    ctx.fillRect(this.x - this.w/2, this.y - this.h/2, this.w, this.h);

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
    ctx.fillStyle = this.isBoss ? '#e74c3c' : '#c0392b';
    ctx.fillRect(this.x - this.w/2, this.y - this.h/2, this.w, this.h);

    // HP 條
    const barW = this.w;
    const pct  = this.hp / this.maxHP;
    ctx.fillStyle = '#333';
    ctx.fillRect(this.x - barW/2, this.y - this.h/2 - 10, barW, 5);
    ctx.fillStyle = this.isBoss ? '#e74c3c' : '#27ae60';
    ctx.fillRect(this.x - barW/2, this.y - this.h/2 - 10, barW * pct, 5);

    // 名稱（BOSS才顯示）
    if (this.isBoss) {
      ctx.fillStyle = '#E8E0F8';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.name, this.x, this.y - this.h/2 - 16);
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

  // 地板（佔位用，之後換成場景貼圖）
  ctx.fillStyle = '#0a0710';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 地板格線（簡單視覺）
  ctx.strokeStyle = 'rgba(100,80,150,.12)';
  ctx.lineWidth = 1;
  const gridSize = 80;
  const offX = (Game.camera.x % gridSize + gridSize) % gridSize;
  const offY = (Game.camera.y % gridSize + gridSize) % gridSize;
  for (let x = -offX; x < canvas.width + gridSize; x += gridSize) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (let y = -offY; y < canvas.height + gridSize; y += gridSize) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
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
