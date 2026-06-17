/**
 * game.js  ──  橫向 2D 平台動作引擎（死亡細胞風）
 * ════════════════════════════════════════════════════════════════
 * 取代原本的 2.5D 等距版本。核心：
 *  - 物理：重力、跑/跳/二段跳/翻滾、coyote time、跳躍緩衝、可變跳躍高度
 *  - 碰撞：地面 + 單向平台（可下穿）+ 房間左右牆
 *  - 相機：水平跟隨玩家，鎖定垂直，依畫面高度等比縮放整個房間
 *  - 關卡：競技場房間，清怪 → 門開 → 走進門 → 下一間
 *
 * 座標系：世界座標 (wx, wy)，y 往下為正；角色 (x, y) 的 y = 腳底。
 * worldToScreen 是對外唯一投影接口（combat.js 靜態 import）。
 * ════════════════════════════════════════════════════════════════
 */

import { saveRun, addExp, onBossKill, onChapterClear, updateProgress } from './data.js';
import { showCardChoice } from './cards.js';
import { playBGM, playSFX } from './bgm.js';
import { showDamageNumber, meleeHit } from './combat.js';
import { drawHero } from './sprites.js';
import { updateFX, renderFXWorld, renderFlash, shakeOffset } from './fx.js';
import { setStageTheme, updateAmbient, renderAmbient, renderVignette, getTheme, renderParallax } from './stagebg.js';
import { actionForKey } from './keybind.js';

// ── Canvas ──
const canvas = document.getElementById('game-canvas');
const ctx    = canvas.getContext('2d');

// ── 遊戲狀態 ──
export const GameState = {
  IDLE: 'idle', RUNNING: 'running', PAUSED: 'paused',
  BOSS: 'boss', DEAD: 'dead', CLEAR: 'clear',
};

// ── 世界 / 物理常數（調手感改這裡）──
const ROOM_H    = 720;     // 房間世界高度（畫面等比縮放對齊它）
const GROUND_Y  = 600;     // 地面世界 y（腳踩這條線）
const GRAVITY   = 2400;
const MAX_FALL  = 1500;
const RUN_SPEED = 430;     // 最高跑速
const RUN_ACCEL = 4200;    // 地面加速度
const AIR_ACCEL = 2200;    // 空中操控
const FRICTION  = 3400;    // 放開時的地面摩擦
const JUMP_VEL  = 840;     // 起跳速度
const DJUMP_VEL = 760;     // 二段跳
const COYOTE    = 0.10;    // 離地後仍可跳的寬限
const JBUFFER   = 0.12;    // 落地前預按跳的緩衝
const ROLL_SPEED= 640;
const ROLL_TIME = 0.32;
const ROLL_IFR  = 0.26;    // 翻滾無敵時長
const ROLL_CD   = 0.45;

// ── 全局遊戲物件 ──
export const Game = {
  state: GameState.IDLE,
  class: null,
  chapter: 1,
  stage: 0,
  player: null,
  enemies: [],
  projectiles: [],
  effects: [],
  room: { w: 2000, platforms: [] },
  doorOpen: false,
  camera: { x: 0, y: 0 },
  view: { scale: 1, worldW: 1280 },   // render 用：縮放比 + 可視世界寬
  lastTime: 0,
  delta: 0,
  freeze: 0,
  input: { left: false, right: false, drop: false },
};

// ── Canvas 自適應 ──
function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  Game.view.scale  = canvas.height / ROOM_H;
  Game.view.worldW = canvas.width / Game.view.scale;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ════════════════════════════════════════
// 世界座標 → 螢幕像素（對外唯一投影接口）
// ════════════════════════════════════════
export function worldToScreen(wx, wy) {
  const s = Game.view.scale;
  return { x: (wx - Game.camera.x) * s, y: wy * s };
}

// ════════════════════════════════════════
// 玩家
// ════════════════════════════════════════
export class Player {
  constructor(cls, stats) {
    this.cls = cls;
    this.x = 200; this.y = GROUND_Y;     // 腳底
    this.vx = 0; this.vy = 0;
    this.w = 30; this.h = 52;            // 碰撞箱
    this.onGround = true;
    this.facing = 1;

    this.maxHP = stats.hp; this.hp = stats.hp;
    this.atk = stats.atk; this.def = stats.def;
    this.critR = stats.critR; this.critM = stats.critM;
    this.runMul = stats.runMul || 1;

    // 技能費用
    this.maxCost = 6; this.cost = 6; this._costTimer = 0;

    // 跳躍 / 翻滾狀態機
    this.maxJumps = 2; this.jumpsLeft = 2;
    this.coyote = 0; this.jumpBuffer = 0; this.jumpHeld = false;
    this.rolling = 0; this.rollCD = 0;
    this.dropTimer = 0;                  // 下穿平台寬限

    // 攻擊
    this.attackTimer = 0; this.attackDur = 0.26; this.attackCD = 0;
    this._swingHit = new Set();          // 本次揮砍已命中的敵人

    this.invincible = 0;
    this.animTime = 0;
    this.moving = false;

    if (cls === 'varek') this.holyRage = 0;
    if (cls === 'kael')  this.markStacks = {};
  }

  get airborne() { return !this.onGround; }

  requestJump() { this.jumpBuffer = JBUFFER; this.jumpHeld = true; }
  releaseJump() {
    this.jumpHeld = false;
    if (this.vy < -300) this.vy = -300;   // 可變跳躍高度：放開就減速上升
  }
  requestRoll() {
    if (this.rolling > 0 || this.rollCD > 0) return;
    this.rolling = ROLL_TIME; this.rollCD = ROLL_CD; this.invincible = ROLL_IFR;
    this.vx = this.facing * ROLL_SPEED;
    playSFX('player_hurt');   // 暫借「咻」聲，batch2 換翻滾音
  }
  requestDrop() { this.dropTimer = 0.18; }

  attack() {
    if (this.attackCD > 0 || this.rolling > 0) return;
    this.attackTimer = this.attackDur;
    this.attackCD = this.attackDur + 0.06;
    this._swingHit.clear();
    Game.player.playAttackPose();
  }
  playAttackPose() { this.attackTimer = Math.max(this.attackTimer, this.attackDur); }

  update(delta) {
    this.animTime += delta;
    if (this.invincible > 0) this.invincible -= delta;
    if (this.rollCD > 0) this.rollCD -= delta;
    if (this.attackCD > 0) this.attackCD -= delta;
    if (this.attackTimer > 0) this.attackTimer -= delta;
    if (this.dropTimer > 0) this.dropTimer -= delta;
    if (this.coyote > 0) this.coyote -= delta;
    if (this.jumpBuffer > 0) this.jumpBuffer -= delta;

    // 費用回復
    if (this.cost < this.maxCost) {
      this._costTimer += delta;
      if (this._costTimer >= 1.1) { this._costTimer = 0; this.cost = Math.min(this.maxCost, this.cost + 1); updateHUD(); }
    }

    // ── 水平輸入 / 加速 ──
    const wasGround = this.onGround;
    let dir = 0;
    if (Game.input.left)  dir -= 1;
    if (Game.input.right) dir += 1;

    if (this.rolling > 0) {
      this.rolling -= delta;
      // 翻滾中鎖定方向、不受輸入
    } else {
      const accel = this.onGround ? RUN_ACCEL : AIR_ACCEL;
      const target = dir * RUN_SPEED * this.runMul;
      if (dir !== 0) {
        this.vx += Math.sign(target - this.vx) * accel * delta;
        if ((target - this.vx) * dir < 0) this.vx = target; // 不過衝
        this.facing = dir;
      } else if (this.onGround) {
        // 摩擦
        const f = FRICTION * delta;
        if (Math.abs(this.vx) <= f) this.vx = 0; else this.vx -= Math.sign(this.vx) * f;
      }
    }
    this.moving = Math.abs(this.vx) > 20;

    // ── 跳躍（緩衝 + coyote + 二段）──
    if (this.jumpBuffer > 0) {
      if (this.onGround || this.coyote > 0) {
        this.vy = -JUMP_VEL; this.onGround = false; this.coyote = 0; this.jumpBuffer = 0;
        this.jumpsLeft = this.maxJumps - 1;
        playSFX('hit_light');
      } else if (this.jumpsLeft > 0) {
        this.vy = -DJUMP_VEL; this.jumpBuffer = 0; this.jumpsLeft--;
        spawnEffect(this.x, this.y - 6, 26, '#cfe0ff', 0.2);  // 二段跳氣流
        playSFX('hit_light');
      }
    }

    // ── 重力 ──
    this.vy += GRAVITY * delta;
    if (this.vy > MAX_FALL) this.vy = MAX_FALL;

    // ── 積分 ──
    this.x += this.vx * delta;
    const prevFeet = this.y;
    this.y += this.vy * delta;

    // ── 碰撞：左右牆 ──
    const half = this.w / 2;
    if (this.x < half) { this.x = half; this.vx = 0; }
    if (this.x > Game.room.w - half) { this.x = Game.room.w - half; this.vx = 0; }

    // ── 碰撞：地面 ──
    this.onGround = false;
    if (this.y >= GROUND_Y) {
      this.y = GROUND_Y; this.vy = 0; this.onGround = true;
    }
    // ── 碰撞：單向平台（只在下落且非下穿時）──
    if (!this.onGround && this.vy >= 0 && this.dropTimer <= 0) {
      for (const p of Game.room.platforms) {
        if (this.x + half < p.x || this.x - half > p.x + p.w) continue;
        if (prevFeet <= p.y + 4 && this.y >= p.y) {
          this.y = p.y; this.vy = 0; this.onGround = true; break;
        }
      }
    }

    if (this.onGround) {
      if (!wasGround) playSFX('hit_light');   // 落地
      this.jumpsLeft = this.maxJumps;
      this.coyote = COYOTE;
    }

    // ── 攻擊判定（揮砍有效幀）──
    if (this.attackTimer > 0) this.resolveMelee();
  }

  resolveMelee() {
    const reach = 78, vReach = 46;
    const fx = this.x + this.facing * 40;
    const fy = this.y - this.h * 0.5;
    for (const e of Game.enemies) {
      if (!e.alive || this._swingHit.has(e)) continue;
      const onSide = (e.x - this.x) * this.facing > -10;
      const ex = e.x, ey = e.y - (e.h || 40) * 0.5;
      if (onSide && Math.abs(ex - fx) < reach && Math.abs(ey - fy) < vReach) {
        this._swingHit.add(e);
        meleeHit(this, e, 1.0);                  // 傷害 + 特效 + 音效 + 頓停
        e.vx += this.facing * 280; e.vy = -160;  // 擊退 + 微浮
        e.hurtTimer = 0.12;
      }
    }
  }

  takeDamage(dmg) {
    if (this.invincible > 0 || this.rolling > 0) return;
    this.hp = Math.max(0, this.hp - dmg);
    this.invincible = 0.7;
    updateHUD();
    if (this.cls === 'varek') this.holyRage = Math.min(100, this.holyRage + dmg * 0.5);
    if (this.hp <= 0) onPlayerDead(); else playSFX('player_hurt');
  }
  heal(amount) { this.hp = Math.min(this.maxHP, this.hp + amount); updateHUD(); }

  // sx,sy = 腳底螢幕座標
  render(ctx, sx, sy) {
    const s = Game.view.scale;
    const blink = this.invincible > 0 && Math.floor(this.invincible * 20) % 2 === 0;

    // 地面陰影（離地時縮小）
    const airK = this.onGround ? 1 : 0.5;
    ctx.save();
    ctx.globalAlpha = 0.32 * airK;
    ctx.fillStyle = '#000';
    const groundScreen = (GROUND_Y) * s;
    ctx.beginPath(); ctx.ellipse(sx, groundScreen, 18 * s * airK, 6 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    let state = 'idle';
    if (this.rolling > 0) state = 'roll';
    else if (!this.onGround) state = this.vy < 0 ? 'jump' : 'fall';
    else if (this.attackTimer > 0) state = 'attack';
    else if (this.moving) state = 'run';

    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(s, s);
    drawHero(ctx, this.cls, 0, 0, {
      facing: this.facing, animTime: this.animTime, state,
      attackP: this.attackDur > 0 ? Math.max(0, this.attackTimer / this.attackDur) : 0,
      blink, holyRage: this.holyRage || 0,
    });
    ctx.restore();
  }
}

// ════════════════════════════════════════
// 敵人（側視角，有重力，預警→攻擊）
// ════════════════════════════════════════
export class Enemy {
  constructor({ id, name, hp, atk, speed, element, def, x, y, isBoss = false }) {
    this.id = id; this.name = name;
    this.maxHP = hp; this.hp = hp;
    this.atk = atk; this.def = def ?? (isBoss ? 40 : 12);
    this.speed = speed; this.element = element;
    this.x = x; this.y = y ?? GROUND_Y;
    this.vx = 0; this.vy = 0; this.onGround = false;
    this.w = isBoss ? 70 : 34; this.h = isBoss ? 88 : 46;
    this.isBoss = isBoss; this.alive = true;
    this.facing = -1;
    this.attackCooldown = 0; this.windup = 0; this.struck = false;
    this.hurtTimer = 0; this.phase = 1;
  }

  update(delta) {
    if (!this.alive) return;
    const p = Game.player;
    if (this.hurtTimer > 0) this.hurtTimer -= delta;

    // 重力
    this.vy += GRAVITY * delta;
    if (this.vy > MAX_FALL) this.vy = MAX_FALL;

    // AI：朝玩家水平接近 / 預警 / 攻擊
    const dxp = p ? p.x - this.x : 0;
    const dist = Math.abs(dxp);
    const range = this.isBoss ? 90 : 64;
    if (this.attackCooldown > 0) this.attackCooldown -= delta;

    let moveDir = 0;
    if (this.windup > 0) {
      // 預警中：站定、計時，結束瞬間出手
      this.windup -= delta;
      if (this.windup <= 0 && !this.struck) {
        this.struck = true;
        if (p && Math.abs(p.x - this.x) < range + 26 && Math.abs((p.y) - this.y) < 70) p.takeDamage(this.atk);
        this.attackCooldown = this.isBoss ? 1.0 : 1.4;
      }
    } else if (this.hurtTimer > 0) {
      // 受擊硬直：不動
    } else if (p) {
      if (dist > range) { moveDir = Math.sign(dxp); this.facing = moveDir; }
      else if (this.attackCooldown <= 0) { this.windup = this.isBoss ? 0.5 : 0.42; this.struck = false; }
    }

    // 水平移動（受擊退時 vx 已被設定，會自然衰減）
    if (moveDir !== 0 && Math.abs(this.vx) < this.speed * 60) {
      this.vx += moveDir * 1200 * delta;
    }
    this.vx *= Math.pow(0.0001, delta);   // 阻力（擊退快速衰減）
    this.x += this.vx * delta;
    this.y += this.vy * delta;

    // 牆 / 地面
    const half = this.w / 2;
    this.x = Math.max(half, Math.min(Game.room.w - half, this.x));
    this.onGround = false;
    if (this.y >= GROUND_Y) { this.y = GROUND_Y; this.vy = 0; this.onGround = true; }

    if (this.isBoss) this.updatePhase();
  }

  updatePhase() {
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
  }

  render(ctx, sx, sy) {
    if (!this.alive) return;
    const s = Game.view.scale;
    const hw = this.w / 2, bodyH = this.h;
    const groundScreen = GROUND_Y * s;

    // 陰影
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(sx, groundScreen, hw * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    const elemColors = {
      '火':'#e74c3c','冰':'#3aa0e0','雷':'#f1c40f','木':'#27ae60','土':'#9a7a4a',
      '光':'#f9e4a0','暗':'#8e44ad','物理':'#95a5a6','魔法':'#1abc9c',
    };
    let col = elemColors[this.element] || '#c0392b';
    const flash = this.hurtTimer > 0;
    const wind  = this.windup > 0;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(s, s);
    if (this.facing < 0) ctx.scale(-1, 1);

    // 預警閃紅
    if (wind) { ctx.shadowColor = '#ff3030'; ctx.shadowBlur = 16; }

    // 身體（蹲伏的鬼怪輪廓）
    ctx.fillStyle = flash ? '#fff' : col;
    roundRectP(ctx, -hw, -bodyH, this.w, bodyH, Math.min(hw, 14));
    ctx.fill();
    // 暗部
    if (!flash) { ctx.fillStyle = 'rgba(0,0,0,.35)'; roundRectP(ctx, -hw, -bodyH * 0.5, this.w, bodyH * 0.5, 8); ctx.fill(); }
    // 眼睛
    ctx.fillStyle = wind ? '#fff' : '#ff3030';
    ctx.beginPath(); ctx.arc(hw * 0.35, -bodyH * 0.72, this.isBoss ? 5 : 3.5, 0, Math.PI * 2); ctx.fill();
    if (this.isBoss) { ctx.beginPath(); ctx.arc(hw * 0.7, -bodyH * 0.72, 5, 0, Math.PI * 2); ctx.fill(); }
    // 爪/尖角
    ctx.strokeStyle = flash ? '#fff' : 'rgba(0,0,0,.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-hw, -bodyH); ctx.lineTo(-hw + 6, -bodyH - 10); ctx.moveTo(hw, -bodyH); ctx.lineTo(hw - 6, -bodyH - 10); ctx.stroke();
    ctx.restore();

    // HP 條
    const barW = Math.max(this.w, 44) * s;
    const pct = this.hp / this.maxHP;
    const barY = sy - bodyH * s - 14;
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(sx - barW / 2 - 1, barY - 1, barW + 2, 7);
    ctx.fillStyle = pct > 0.5 ? '#27ae60' : pct > 0.25 ? '#e67e22' : '#e74c3c';
    ctx.fillRect(sx - barW / 2, barY, barW * pct, 5);

    if (this.isBoss) {
      ctx.fillStyle = '#ffaaaa'; ctx.font = `bold ${13}px "微軟正黑體",sans-serif`; ctx.textAlign = 'center';
      ctx.shadowColor = '#000'; ctx.shadowBlur = 4;
      ctx.fillText(this.name, sx, barY - 8); ctx.shadowBlur = 0;
    }
  }
}

// ════════════════════════════════════════
// 主循環
// ════════════════════════════════════════
function gameLoop(timestamp) {
  if (Game.state === GameState.IDLE) return;
  Game.delta = Math.min((timestamp - Game.lastTime) / 1000, 0.05);
  Game.lastTime = timestamp;

  if (Game.state === GameState.RUNNING || Game.state === GameState.BOSS) {
    if (Game.freeze > 0) Game.freeze -= Game.delta; else update(Game.delta);
  }
  render();
  requestAnimationFrame(gameLoop);
}

function update(delta) {
  if (Game.player) {
    Game.player.update(delta);
    // 相機水平跟隨（置中 + 夾在房間內）
    const targetX = Game.player.x - Game.view.worldW / 2;
    Game.camera.x += (targetX - Game.camera.x) * Math.min(1, delta * 8);
    Game.camera.x = clamp(Game.camera.x, 0, Math.max(0, Game.room.w - Game.view.worldW));
  }
  Game.enemies.forEach(e => e.update(delta));
  Game.effects = Game.effects.filter(ef => { ef.life -= delta; return ef.life > 0; });
  Game.projectiles.forEach(p => p.update?.(delta));
  Game.projectiles = Game.projectiles.filter(p => p.alive);
  updateFX(delta);
  updateAmbient(delta, canvas.width, canvas.height);
  checkStageClear();
  checkDoor();
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const so = shakeOffset();
  ctx.save();
  ctx.translate(so.x, so.y);

  const theme = getTheme();
  const groundScreen = GROUND_Y * Game.view.scale;

  // 視差背景
  renderParallax(ctx, Game.camera.x, canvas.width, canvas.height, groundScreen);

  // 地面 + 平台
  renderGround(theme, groundScreen);

  // 地面層效果（角色下方）
  renderEffects(ctx);

  // 敵人 → 玩家
  Game.enemies.forEach(e => { if (e.alive) { const s = worldToScreen(e.x, e.y); e.render(ctx, s.x, s.y); } });
  if (Game.player) { const s = worldToScreen(Game.player.x, Game.player.y); Game.player.render(ctx, s.x, s.y); }

  // 投射物
  Game.projectiles.forEach(p => { const s = worldToScreen(p.x, p.y); p.render?.(ctx, s.x, s.y); });

  // 打擊粒子 / 斬擊弧
  renderFXWorld(ctx, worldToScreen);

  // 門（清關後出現在右側）
  renderDoor(groundScreen);

  ctx.restore();

  renderVignette(ctx, canvas.width, canvas.height);
  renderAmbient(ctx);
  renderFlash(ctx, canvas.width, canvas.height);
}

// ── 地面 + 單向平台 ──
function renderGround(theme, groundScreen) {
  const s = Game.view.scale;
  const w = canvas.width, h = canvas.height;
  // 地面主體
  const gg = ctx.createLinearGradient(0, groundScreen, 0, h);
  gg.addColorStop(0, theme.ground[0]);
  gg.addColorStop(1, theme.ground[1]);
  ctx.fillStyle = gg;
  ctx.fillRect(0, groundScreen, w, h - groundScreen);
  // 地面上緣高光線
  ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, groundScreen); ctx.lineTo(w, groundScreen); ctx.stroke();

  // 平台
  Game.room.platforms.forEach(p => {
    const a = worldToScreen(p.x, p.y);
    const pw = p.w * s, ph = 16 * s;
    const pg = ctx.createLinearGradient(0, a.y, 0, a.y + ph);
    pg.addColorStop(0, theme.ground[0]); pg.addColorStop(1, theme.ground[1]);
    ctx.fillStyle = pg;
    roundRectP(ctx, a.x, a.y, pw, ph, 4 * s); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x + pw, a.y); ctx.stroke();
  });
}

function renderEffects(ctx) {
  Game.effects.forEach(ef => {
    const s = worldToScreen(ef.x, ef.y);
    ctx.globalAlpha = Math.max(0, ef.life);
    const r = ef.r * Game.view.scale;
    const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r);
    grad.addColorStop(0, ef.color || '#fff'); grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  });
}

// ── 出口門 ──
function renderDoor(groundScreen) {
  if (!Game.doorOpen) return;
  const s = Game.view.scale;
  const d = worldToScreen(Game.room.w - 40, GROUND_Y);
  const dw = 56 * s, dh = 110 * s;
  const t = Date.now() / 400;
  const glow = 0.5 + Math.sin(t) * 0.25;
  ctx.save();
  ctx.globalAlpha = glow;
  const g = ctx.createLinearGradient(0, d.y - dh, 0, d.y);
  g.addColorStop(0, '#fff0b0'); g.addColorStop(1, '#EF9F27');
  ctx.fillStyle = g;
  roundRectP(ctx, d.x - dw / 2, d.y - dh, dw, dh, 8 * s); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(15 * s)}px "微軟正黑體",sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('→', d.x, d.y - dh / 2);
}

// ════════════════════════════════════════
// 清關判定 → 開門
// ════════════════════════════════════════
function checkStageClear() {
  if (Game.doorOpen || Game._clearing) return;
  if (Game.state !== GameState.RUNNING && Game.state !== GameState.BOSS) return;
  if (Game.enemies.length === 0 || !Game.enemies.every(e => !e.alive)) return;
  Game.enemies = [];
  Game.doorOpen = true;
  playSFX('card_pick');
  showToast('區域肅清 — 前往右側出口 →');
}

// ── 走進門 → 結算 + 下一間 ──
function checkDoor() {
  if (!Game.doorOpen || Game._clearing || !Game.player) return;
  if (Game.player.x < Game.room.w - 70) return;
  Game._clearing = true;
  Game.doorOpen = false;
  const clearedBoss = (Game.stage % 5 === 0);
  Game.state = GameState.PAUSED;

  (async () => {
    if (clearedBoss) {
      try {
        await onBossKill(`ch${Game.chapter}_s${Game.stage}`);
        if (Game.stage % 50 === 0) {
          await onChapterClear();
          if (Game.chapter >= 5) { gameEnd(true); return; }
          Game.chapter++;
        }
      } catch (e) { console.warn('[結算] BOSS 獎勵寫入失敗', e.message); }
    }
    Game.stage++;
    try {
      await saveRun({ cls: Game.class, chapter: Game.chapter, stage: Game.stage, currentHP: Game.player.hp, gold: 0, deck: [] });
      await updateProgress(Game.chapter, Game.stage);
    } catch {}
    const poolSize = clearedBoss ? 5 : 3;
    const pickCount = clearedBoss ? 2 : 1;
    showCardChoice(() => { Game._clearing = false; loadNextStage(); }, poolSize, pickCount);
  })();
}

// ════════════════════════════════════════
// 載入下一間房
// ════════════════════════════════════════
export function loadNextStage() {
  Game.state = GameState.RUNNING;
  Game.enemies = [];
  Game.doorOpen = false;
  setStageTheme(Game.chapter);
  buildRoom(Game.chapter, Game.stage);
  // 玩家放到房間左側起點
  Game.player.x = 160; Game.player.y = GROUND_Y; Game.player.vx = 0; Game.player.vy = 0;
  Game.camera.x = 0;
  spawnEnemiesForStage(Game.chapter, Game.stage);
  playBGM(Game.stage % 5 === 0 ? `ch${Game.chapter}_boss` : `ch${Game.chapter}_explore`);
  updateHUD();
}

// ── 產生房間（寬度 + 幾塊單向平台）──
function buildRoom(chapter, stage) {
  const isBoss = stage % 5 === 0;
  const w = isBoss ? 1700 : 1900 + ((stage * 137) % 5) * 120;
  const platforms = [];
  if (!isBoss) {
    // 用確定性偽隨機鋪 2~3 塊平台（高低差）
    const n = 2 + ((stage * 71) % 2);
    for (let i = 0; i < n; i++) {
      const seed = (stage * 911 + i * 263) >>> 0;
      const px = 360 + (seed % (w - 760));
      const py = GROUND_Y - (150 + (seed % 3) * 90);
      const pw = 180 + (seed % 120);
      platforms.push({ x: px, y: py, w: pw });
    }
  }
  Game.room = { w, platforms };
}

// ── 生成敵人（橫向排佈在房間地面）──
function spawnEnemiesForStage(chapter, stage) {
  const isBoss = stage % 5 === 0;
  const stageInChapter = ((stage - 1) % 50) + 1;
  if (isBoss) {
    const boss = BOSS_DATA[chapter]?.[Math.ceil(stageInChapter / 5) - 1] || BOSS_DATA[chapter]?.[0]
      || { id:`ch${chapter}_boss`, name:'墮神守衛', hp: 8000 + chapter*2000, atk: 40 + chapter*10, speed: 1.0, element:(CHAPTER_ELEMENTS[chapter]||['物理'])[0] };
    Game.state = GameState.BOSS;
    Game.enemies.push(new Enemy({ ...boss, x: Game.room.w - 400, y: GROUND_Y, isBoss: true }));
  } else {
    const count = 3 + Math.floor(chapter * 1.2);
    const baseHP = (200 + chapter * 150) * (1 + (stage % 5) * 0.08);
    const baseATK = 10 + chapter * 8;
    const elements = CHAPTER_ELEMENTS[chapter] || ['物理'];
    for (let i = 0; i < count; i++) {
      const ex = 600 + (i / count) * (Game.room.w - 800) + (Math.random() * 80 - 40);
      Game.enemies.push(new Enemy({
        id:`enemy_ch${chapter}_s${stage}_${i}`, name:'腐化怪',
        hp: Math.floor(baseHP), atk: baseATK, speed: 1.4,
        element: elements[i % elements.length], x: ex, y: GROUND_Y,
      }));
    }
  }
}

// ════════════════════════════════════════
// 職業數值 / 章節屬性 / BOSS
// ════════════════════════════════════════
const CLASS_STATS = {
  varek: { hp: 1200, atk: 85,  def: 60, critR: 0.10, critM: 1.80, runMul: 0.92 },
  lyra:  { hp: 750,  atk: 110, def: 25, critR: 0.15, critM: 2.00, runMul: 1.05 },
  kael:  { hp: 900,  atk: 100, def: 35, critR: 0.20, critM: 2.20, runMul: 1.18 },
};
const CHAPTER_ELEMENTS = {
  1:['物理','火'], 2:['木','土'], 3:['冰','雷'], 4:['暗','光'],
  5:['火','冰','雷','木','土','光','暗'],
};
const BOSS_DATA = {
  1: [
    { id:'ch1_boss1', name:'熔鐵守衛', hp:8000,  atk:40, speed:1.0, element:'火' },
    { id:'ch1_boss2', name:'鐵甲騎士', hp:9500,  atk:45, speed:0.9, element:'物理' },
    { id:'ch1_boss3', name:'火焰犬',   hp:10500, atk:50, speed:1.4, element:'火' },
    { id:'ch1_final', name:'熔鐵巨像 IGNUS', hp:45000, atk:90, speed:0.8, element:'火' },
  ],
};

// ════════════════════════════════════════
// 開始遊戲
// ════════════════════════════════════════
export function startGame(cls, savedRun = null) {
  Game.class = cls;
  Game.chapter = savedRun?.chapter || 1;
  Game.stage = savedRun?.stage || 1;
  const stats = { ...CLASS_STATS[cls] };
  Game.player = new Player(cls, stats);
  if (savedRun?.currentHP) Game.player.hp = savedRun.currentHP;

  document.getElementById('screen-hub').classList.add('hidden');
  document.getElementById('screen-game').classList.remove('hidden');
  resizeCanvas();

  setupInput();
  initSkillBar(cls);
  updateHUD();
  loadNextStage();

  Game.lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

export function pauseGame()  { Game.state = GameState.PAUSED; }
export function resumeGame() { Game.state = GameState.RUNNING; }

// ════════════════════════════════════════
// 輸入（鍵盤經 keybind.js 反查；滑鼠/觸控按鈕）
// ════════════════════════════════════════
let _inputBound = false;
function setupInput() {
  if (_inputBound) return; _inputBound = true;

  window.addEventListener('keydown', ev => {
    const action = actionForKey(ev.key);
    if (action === 'pause') { togglePause(); ev.preventDefault(); return; }
    if (!action) return;
    if (Game.state === GameState.PAUSED) return;

    switch (action) {
      case 'moveLeft':  Game.input.left = true; ev.preventDefault(); break;
      case 'moveRight': Game.input.right = true; ev.preventDefault(); break;
      case 'drop':      Game.input.drop = true; Game.player?.requestDrop(); ev.preventDefault(); break;
      case 'jump':      if (!ev.repeat) Game.player?.requestJump(); ev.preventDefault(); break;
      case 'roll':      if (!ev.repeat) Game.player?.requestRoll(); ev.preventDefault(); break;
      case 'attack':    if (!ev.repeat) triggerAttack(); ev.preventDefault(); break;
      case 'skill1':    triggerSkill('q'); break;
      case 'skill2':    triggerSkill('w'); break;
      case 'skill3':    triggerSkill('e'); break;
      case 'skill4':    triggerSkill('r'); break;
    }
  });

  window.addEventListener('keyup', ev => {
    const action = actionForKey(ev.key);
    if (action === 'moveLeft')  Game.input.left = false;
    if (action === 'moveRight') Game.input.right = false;
    if (action === 'drop')      Game.input.drop = false;
    if (action === 'jump')      Game.player?.releaseJump();
  });

  // 技能格 / 攻擊鈕（觸控 + 點擊）
  const bindEl = (el, fn) => {
    const fire = e => { e.preventDefault(); el.classList.add('pressing'); setTimeout(() => el.classList.remove('pressing'), 120); fn(); };
    el.addEventListener('touchstart', fire, { passive: false });
    el.addEventListener('click', fire);
  };
  document.querySelectorAll('.skill-slot').forEach(el => {
    const s = el.dataset.skill;
    bindEl(el, () => triggerSkill(s));
  });
  const atkBtn = document.getElementById('skill-attack');
  if (atkBtn) bindEl(atkBtn, triggerAttack);

  // 觸控移動 / 跳 / 滾 按鈕（mobile-pad）
  bindHold('mb-left',  () => Game.input.left = true,  () => Game.input.left = false);
  bindHold('mb-right', () => Game.input.right = true, () => Game.input.right = false);
  document.getElementById('mb-jump')?.addEventListener('touchstart', e => { e.preventDefault(); Game.player?.requestJump(); }, { passive:false });
  document.getElementById('mb-roll')?.addEventListener('touchstart', e => { e.preventDefault(); Game.player?.requestRoll(); }, { passive:false });

  // 滑鼠點畫面 = 攻擊
  canvas.addEventListener('mousedown', () => {
    if (Game.state === GameState.RUNNING || Game.state === GameState.BOSS) triggerAttack();
  });
}

function bindHold(id, on, off) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = e => { e.preventDefault(); on(); el.classList.add('pressing'); };
  const end   = e => { e?.preventDefault(); off(); el.classList.remove('pressing'); };
  el.addEventListener('touchstart', start, { passive:false });
  el.addEventListener('touchend', end);
  el.addEventListener('touchcancel', end);
  el.addEventListener('mousedown', start);
  el.addEventListener('mouseup', end);
  el.addEventListener('mouseleave', end);
}

function triggerAttack() {
  if (!Game.player) return;
  if (Game.state !== GameState.RUNNING && Game.state !== GameState.BOSS) return;
  Game.player.attack();
}
function triggerSkill(skillKey) {
  if (Game.state !== GameState.RUNNING && Game.state !== GameState.BOSS) return;
  Game.player.playAttackPose();
  import('./combat.js').then(({ performSkill }) => performSkill(Game.player, skillKey, Game.enemies));
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
  _pauseState = Game.state; Game.state = GameState.PAUSED;
  const a = window.__Audio || {};
  const sfxOn = a.SFX?.enabled !== false, bgmOn = a.BGM?.enabled !== false;
  const ov = document.createElement('div');
  ov.id = 'pause-overlay';
  ov.style.cssText = `position:fixed;inset:0;background:rgba(8,4,18,.82);z-index:200;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;color:#E8E0F8;font-family:'微軟正黑體',sans-serif;backdrop-filter:blur(2px)`;
  ov.innerHTML = `
    <h2 style="color:#EF9F27;font-size:2rem;letter-spacing:.1em">暫停</h2>
    <button id="pz-resume" class="pz-btn pz-main">繼續遊戲</button>
    <button id="pz-keys" class="pz-btn">⌨ 按鍵設定</button>
    <button id="pz-bgm" class="pz-btn">背景音樂：${bgmOn ? '開' : '關'}</button>
    <button id="pz-sfx" class="pz-btn">音效：${sfxOn ? '開' : '關'}</button>
    <button id="pz-quit" class="pz-btn pz-quit">放棄並返回大廳</button>
    <p style="font-size:.8rem;color:#7060a0">按 ESC 也可以繼續</p>`;
  document.body.appendChild(ov);
  // 簡易內聯樣式
  ov.querySelectorAll('.pz-btn').forEach(b => b.style.cssText = 'min-width:220px;padding:12px;border-radius:8px;border:1px solid #5a4080;background:rgba(20,15,35,.9);color:#E8E0F8;cursor:pointer;font-size:.95rem');
  ov.querySelector('.pz-main').style.cssText += ';background:linear-gradient(135deg,#b8730a,#EF9F27);color:#1a0e00;font-weight:700;border:none';
  ov.querySelector('.pz-quit').style.cssText += ';background:#3a1010;border-color:#7a2020;color:#e8a0a0';

  document.getElementById('pz-resume').onclick = hidePause;
  document.getElementById('pz-keys').onclick = () => { import('./keybindui.js').then(m => m.openKeybindPanel()); };
  document.getElementById('pz-bgm').onclick = e => { const on = a.BGM?.enabled !== false; a.setBGMEnabled?.(!on); e.target.textContent = `背景音樂：${!on ? '開' : '關'}`; };
  document.getElementById('pz-sfx').onclick = e => { const on = a.SFX?.enabled !== false; a.setSFXEnabled?.(!on); e.target.textContent = `音效：${!on ? '開' : '關'}`; };
  document.getElementById('pz-quit').onclick = () => location.reload();
}
function hidePause() {
  document.getElementById('pause-overlay')?.remove();
  if (_pauseState) { Game.state = _pauseState; _pauseState = null; }
}

// ════════════════════════════════════════
// 死亡 / 通關
// ════════════════════════════════════════
function onPlayerDead() {
  Game.state = GameState.DEAD;
  playSFX('hit_heavy');
  showDeathScreen(0);
}
function showDeathScreen(runGold) {
  const ov = document.createElement('div');
  ov.id = 'death-overlay';
  ov.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.85);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;z-index:100;color:#E8E0F8;font-family:sans-serif`;
  ov.innerHTML = `
    <h2 style="color:#e74c3c;font-size:2rem">你已死亡</h2>
    <p>此局金幣：💰 ${runGold}</p>
    <button onclick="location.reload()" style="padding:14px 32px;background:#EF9F27;border:none;border-radius:8px;font-weight:700;cursor:pointer;color:#1a0e00;font-size:1rem">返回大廳</button>`;
  document.body.appendChild(ov);
}
function gameEnd(won) {
  Game.state = GameState.CLEAR;
  const ov = document.createElement('div');
  ov.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.9);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;z-index:100;color:#E8E0F8;font-family:sans-serif`;
  ov.innerHTML = `
    <h2 style="color:#EF9F27;font-size:2.2rem">${won ? '神殞封印完成' : '遊戲結束'}</h2>
    <button onclick="location.reload()" style="padding:14px 32px;background:#EF9F27;border:none;border-radius:8px;font-weight:700;cursor:pointer;color:#1a0e00;font-size:1rem">返回主選單</button>`;
  document.body.appendChild(ov);
}

// ════════════════════════════════════════
// HUD
// ════════════════════════════════════════
function updateHUD() {
  const p = Game.player; if (!p) return;
  const hpBar = document.getElementById('hud-hp-bar');
  const hpText = document.getElementById('hud-hp-text');
  const costEl = document.getElementById('hud-cost-val');
  const chapEl = document.getElementById('hud-chapter');
  const stagEl = document.getElementById('hud-stage-num');
  if (hpBar)  hpBar.style.width = `${(p.hp / p.maxHP) * 100}%`;
  if (hpText) hpText.textContent = `${Math.ceil(p.hp)} / ${p.maxHP}`;
  if (costEl) costEl.textContent = p.cost;
  if (chapEl) chapEl.textContent = `Chapter ${Game.chapter}`;
  if (stagEl) stagEl.textContent = `Stage ${Game.stage}`;
  if (_skillDefs) {
    ['q','w','e','r'].forEach(sk => {
      const slot = document.getElementById(`skill-slot-${sk}`);
      if (!slot) return; const def = _skillDefs[sk];
      slot.classList.toggle('no-cost', !!(def && p.cost < def.cost));
    });
  }
}

let _skillDefs = null;
function initSkillBar(cls) {
  import('./combat.js').then(({ getSkillDefs }) => {
    _skillDefs = getSkillDefs(cls);
    const keyLabels = { q:'1', w:'2', e:'3', r:'4', space:'⟳' };
    const typeLabels = { single:'單體', aoe:'範圍', dash:'衝刺', heal:'回復', burst:'爆發' };
    Object.entries(_skillDefs).forEach(([sk, def]) => {
      const slot = document.getElementById(`skill-slot-${sk}`);
      if (!slot) return;
      const nameEl = slot.querySelector('.skill-name-label');
      const costEl = slot.querySelector('.skill-cost-label');
      const keyEl  = slot.querySelector('.skill-key');
      const tipEl  = slot.querySelector('.skill-tooltip');
      if (nameEl) nameEl.textContent = def.name;
      if (costEl) costEl.textContent = `⚡${def.cost}`;
      if (keyEl && keyLabels[sk]) keyEl.textContent = keyLabels[sk];
      if (tipEl) {
        const tl = typeLabels[def.type] || def.type;
        tipEl.innerHTML = `<span class="tip-name">${def.name}</span><span class="tip-meta">${def.element ?? ''} · ${tl}</span><span class="tip-cost">費用 ⚡${def.cost}${def.mult ? ' &nbsp; 倍率 ×' + def.mult : ''}</span>`;
      }
    });
    updateHUD();
  });
}

// ── 小提示（畫面中上方淡出）──
function showToast(text) {
  const t = document.createElement('div');
  t.textContent = text;
  t.style.cssText = `position:fixed;top:18%;left:50%;transform:translateX(-50%);background:rgba(8,4,18,.85);border:1px solid rgba(239,159,39,.5);color:#EF9F27;padding:10px 22px;border-radius:8px;font-weight:700;z-index:60;pointer-events:none;animation:toastfade 2.6s ease forwards`;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

// ── 特效 helper（給 combat.js / 內部用）──
function spawnEffect(x, y, r, color, life = 0.3) { Game.effects.push({ x, y, r, color, life }); }

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
// 平台/敵人圓角矩形（世界縮放後直接畫）
function roundRectP(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ── 掛載供測試/除錯 ──
window.__GameFns = { startGame, pauseGame, resumeGame, updateHUD, Game, loadNextStage, _update: update };

// Hub 按鈕
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
