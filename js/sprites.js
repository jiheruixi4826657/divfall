/**
 * sprites.js  ──  側視角角色作畫（橫向 2D / 死亡細胞風佔位圖）
 * ════════════════════════════════════════════════════════════════
 * 純 Canvas 程式繪製的「佔位角色」。之後 user 會用像素圖 / AI 圖替換，
 * 替換方式：把 drawHero 內部換成 ctx.drawImage(spriteSheet, ...) 即可，
 * 對外簽名 drawHero(ctx, cls, x, y, pose) 不變，遊戲邏輯不用動。
 *
 * 座標：(x, y) = 角色「腳底中心」在畫面上的位置；身體往上(負 y)畫。
 * pose 欄位：
 *   facing   1=面右 / -1=面左
 *   animTime 累積秒數（驅動走路/呼吸週期）
 *   state    'idle'|'run'|'jump'|'fall'|'roll'|'attack'（沒給就由 moving 推斷）
 *   moving   (相容舊版) true→run
 *   attackP / castP  0~1 攻擊/施法進度（1=剛揮出）
 *   blink    無敵閃爍
 *   holyRage VAREK 聖怒火焰強度 0~100
 *
 * 【想改體型/顏色/武器，改這裡】COLORS 改配色；各 draw* 函式改造型。
 * ════════════════════════════════════════════════════════════════
 */

const COLORS = {
  varek: { skin:'#e8b88a', main:'#d8a23a', dark:'#7a5410', steel:'#cfd6e0', cloak:'#8a1f2a', glow:'#ffd070' },
  lyra:  { skin:'#e6c4a0', main:'#6a5acd', dark:'#2a2060', steel:'#b0a0ff', cloak:'#3a2a7a', glow:'#7af0ff' },
  kael:  { skin:'#d8b894', main:'#3a2f4a', dark:'#15101f', steel:'#9a8abf', cloak:'#1f1830', glow:'#b07aef' },
};

// 粗線條肢體（圓頭線段）
function limb(ctx, x1, y1, x2, y2, w, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

export function drawHero(ctx, cls, x, y, pose = {}) {
  const C = COLORS[cls] || COLORS.varek;
  const facing = pose.facing >= 0 ? 1 : -1;
  const t = pose.animTime || 0;
  const atk = Math.max(pose.attackP || 0, pose.castP || 0);

  // 推斷狀態
  let state = pose.state;
  if (!state) {
    if (atk > 0)          state = 'attack';
    else if (pose.moving) state = 'run';
    else                  state = 'idle';
  }

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);   // 面左時整體水平翻轉

  if (pose.blink) ctx.globalAlpha = 0.45;

  // ── 翻滾：畫成蜷曲的球，旋轉 ──
  if (state === 'roll') {
    const spin = (t * 16) % (Math.PI * 2);
    ctx.save();
    ctx.translate(0, -16);
    ctx.rotate(spin);
    ctx.fillStyle = C.cloak;
    ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.main;
    ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.steel;
    ctx.beginPath(); ctx.arc(5, -3, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.restore();
    return;
  }

  // 走路週期 / 呼吸
  const run   = state === 'run';
  const air   = state === 'jump' || state === 'fall';
  const cyc   = Math.sin(t * 14);
  const cyc2  = Math.cos(t * 14);
  const breath = Math.sin(t * 2.5) * 1.2;

  // 關鍵高度（腳底=0，往上為負）
  const hipY  = -26 + (run ? Math.abs(cyc) * -2 : 0) + (air ? -2 : 0);
  const shY   = hipY - 16 + (run ? 0 : breath * 0.4);
  const headY = shY - 12;

  // ── 腿 ──
  let frontFoot, backFoot;
  if (air) {
    // 跳/落：前腿收、後腿伸
    frontFoot = { x: 6,  y: state === 'jump' ? -10 : -2 };
    backFoot  = { x: -8, y: -4 };
  } else if (run) {
    frontFoot = { x: 9 + cyc * 8,  y: -Math.max(0, cyc) * 6 };
    backFoot  = { x: -9 - cyc * 8, y: -Math.max(0, -cyc) * 6 };
  } else {
    frontFoot = { x: 7,  y: 0 };
    backFoot  = { x: -7, y: 0 };
  }
  limb(ctx, -2, hipY, backFoot.x,  backFoot.y,  7, C.dark);   // 後腿（較暗）
  limb(ctx,  2, hipY, frontFoot.x, frontFoot.y, 7, C.main);   // 前腿

  // ── 披風/外袍（在身體後面）──
  ctx.fillStyle = C.cloak;
  ctx.beginPath();
  ctx.moveTo(-3, shY + 1);
  ctx.quadraticCurveTo(-14 - (run ? cyc2 * 4 : 0), hipY, -8, hipY + 8);
  ctx.lineTo(2, hipY);
  ctx.closePath();
  ctx.fill();

  // ── 軀幹 ──
  ctx.fillStyle = C.main;
  roundRect(ctx, -7, shY, 14, (hipY - shY) + 4, 5);
  ctx.fill();
  // 胸甲高光
  ctx.fillStyle = C.steel;
  roundRect(ctx, -4, shY + 2, 8, 9, 3);
  ctx.fill();

  // ── 持武器手臂（attack 時前擺）──
  const swing = atk > 0 ? (1 - atk) : 0;             // 0→1 揮出
  const armBase = { x: 4, y: shY + 3 };
  let handX, handY;
  if (atk > 0) {
    const ang = -1.4 + swing * 2.8;                   // 從上往下劈
    handX = armBase.x + Math.cos(ang) * 16;
    handY = armBase.y + Math.sin(ang) * 16;
  } else if (run) {
    handX = armBase.x + 8 + cyc2 * 4;
    handY = armBase.y + 8;
  } else {
    handX = armBase.x + 7;
    handY = armBase.y + 10 + breath * 0.3;
  }
  limb(ctx, armBase.x, armBase.y, handX, handY, 6, C.main);

  // ── 武器（依職業）──
  drawWeapon(ctx, cls, C, handX, handY, atk, swing);

  // ── 頭 ──
  ctx.fillStyle = C.skin;
  ctx.beginPath(); ctx.arc(2, headY, 8, 0, Math.PI * 2); ctx.fill();
  drawHeadGear(ctx, cls, C, headY);
  // 眼睛（面向側邊）
  ctx.fillStyle = C.glow;
  ctx.beginPath(); ctx.arc(7, headY - 1, 1.6, 0, Math.PI * 2); ctx.fill();

  // ── VAREK 聖怒火焰 ──
  if (cls === 'varek' && (pose.holyRage || 0) > 40) {
    const k = Math.min(1, (pose.holyRage - 40) / 60);
    ctx.globalAlpha = 0.5 * k;
    for (let i = 0; i < 4; i++) {
      const fx = -6 + i * 4;
      const fy = shY - 4 - Math.abs(Math.sin(t * 8 + i)) * 8;
      ctx.fillStyle = i % 2 ? '#ffd070' : '#ff7a30';
      ctx.beginPath(); ctx.arc(fx, fy, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

// ── 武器造型 ──
function drawWeapon(ctx, cls, C, hx, hy, atk, swing) {
  ctx.save();
  ctx.translate(hx, hy);
  if (cls === 'varek') {
    // 巨劍
    const ang = atk > 0 ? (-1.0 + swing * 2.6) : -0.5;
    ctx.rotate(ang);
    ctx.fillStyle = C.steel;
    roundRect(ctx, -2, -34, 4, 34, 2); ctx.fill();        // 劍身
    ctx.fillStyle = C.main;
    roundRect(ctx, -7, -2, 14, 4, 2); ctx.fill();         // 護手
    if (atk > 0) { // 揮砍殘影
      ctx.globalAlpha = 0.3; ctx.strokeStyle = C.glow; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 30, -1.2, 0.6); ctx.stroke();
    }
  } else if (cls === 'lyra') {
    // 法杖 + 元素球
    ctx.rotate(atk > 0 ? -0.3 + swing * 0.6 : 0.2);
    ctx.fillStyle = C.dark;
    roundRect(ctx, -1.5, -30, 3, 32, 1.5); ctx.fill();
    const og = ctx.createRadialGradient(0, -32, 1, 0, -32, 7);
    og.addColorStop(0, '#fff'); og.addColorStop(0.5, C.glow); og.addColorStop(1, 'transparent');
    ctx.fillStyle = og;
    ctx.beginPath(); ctx.arc(0, -32, 7, 0, Math.PI * 2); ctx.fill();
  } else {
    // 雙匕首
    ctx.rotate(atk > 0 ? -1.2 + swing * 2.0 : -0.3);
    ctx.fillStyle = C.steel;
    roundRect(ctx, -1.5, -16, 3, 16, 1.5); ctx.fill();
    ctx.fillStyle = C.main;
    roundRect(ctx, -4, -2, 8, 3, 1.5); ctx.fill();
    if (atk > 0) { ctx.globalAlpha = 0.3; ctx.strokeStyle = C.glow; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 18, -1.4, 0.4); ctx.stroke(); }
  }
  ctx.restore();
}

// ── 頭盔/兜帽 ──
function drawHeadGear(ctx, cls, C, headY) {
  if (cls === 'varek') {
    // 有角頭盔
    ctx.fillStyle = C.steel;
    roundRect(ctx, -6, headY - 9, 16, 8, 3); ctx.fill();
    ctx.fillStyle = C.main;
    ctx.beginPath(); ctx.moveTo(8, headY - 6); ctx.lineTo(14, headY - 12); ctx.lineTo(9, headY - 7); ctx.fill(); // 角
  } else {
    // 兜帽
    ctx.fillStyle = C.cloak;
    ctx.beginPath();
    ctx.moveTo(-7, headY + 4);
    ctx.quadraticCurveTo(-8, headY - 11, 4, headY - 11);
    ctx.quadraticCurveTo(11, headY - 9, 10, headY + 2);
    ctx.lineTo(6, headY + 1);
    ctx.quadraticCurveTo(6, headY - 7, -1, headY - 7);
    ctx.quadraticCurveTo(-5, headY - 6, -4, headY + 4);
    ctx.closePath(); ctx.fill();
  }
}

// 圓角矩形工具
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
