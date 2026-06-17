/**
 * sprites.js  ──  角色「向量作畫 + 動畫」模組
 * ════════════════════════════════════════════════════════════════
 * 這裡集中所有「玩家角色」的繪製。全部用 Canvas 即時繪製向量形狀，
 * 不依賴任何圖檔，所以 60fps 很順、檔案也小。
 *
 * 【你要改美術，改這個檔就好，不會動到遊戲邏輯】
 *  - 想改顏色 → 找各職業的 COLORS 區塊
 *  - 想改體型/武器 → 改對應的 draw 函數內的座標
 *  - 想調動畫幅度 → 改 pose 計算（在 game.js 的 Player.render 裡）
 *
 * 座標系：呼叫端會先把「腳底」對到 (sx,sy)，這裡以「腳底為原點 y=0」往上畫，
 *  頭大約在 y=-54。facing=1 朝右、-1 朝左（自動鏡像）。
 * ════════════════════════════════════════════════════════════════
 */

// 緩動：讓攻擊/施法揮動有「快出慢收」的手感
const easeOut = t => 1 - Math.pow(1 - t, 3);

/**
 * 主入口：畫一個英雄
 * @param ctx    Canvas context
 * @param cls    'varek' | 'lyra' | 'kael'
 * @param sx,sy  螢幕上腳底座標
 * @param pose   {
 *    facing, animTime, moving,
 *    castP,    // 0~1 施法進度（0=無）
 *    attackP,  // 0~1 普攻揮砍進度（0=無）
 *    blink,    // 受傷閃爍
 *    holyRage  // VAREK 聖怒 0~100
 *  }
 */
export function drawHero(ctx, cls, sx, sy, pose) {
  const p = pose || {};
  const t        = p.animTime || 0;
  const moving   = !!p.moving;
  const facing   = p.facing >= 0 ? 1 : -1;
  const castP    = p.castP   || 0;
  const attackP  = p.attackP || 0;

  // ── 共用動畫參數 ──
  const walk   = moving ? Math.sin(t * 11) : 0;                  // 走路相位 -1~1
  const bob    = moving ? -Math.abs(Math.sin(t * 11)) * 3        // 走路上下彈跳
                        :  Math.sin(t * 2.4) * 1.4;              // 待機呼吸
  const lean   = (moving ? 0.09 : 0) + attackP * 0.12;          // 前傾（移動/攻擊）
  const legA   = walk * 0.5;                                     // 腿擺動角
  // 武器揮動角：普攻時從上往下大幅斬擊；施法時舉起
  const slash  = Math.sin(easeOut(attackP) * Math.PI);          // 0→1→0 的揮砍包絡
  const weaponA = -walk * 0.25                                   // 走路時輕微擺
                  - slash * 2.2                                  // 普攻大揮砍
                  - castP * 1.3;                                 // 施法舉起

  ctx.save();
  ctx.globalAlpha = p.blink ? 0.35 : 1;
  ctx.translate(sx, sy);
  ctx.rotate(lean * facing * 0.5);   // 整體前傾
  ctx.scale(facing, 1);
  ctx.translate(0, bob);

  if (cls === 'varek')      drawVarek(ctx, { t, legA, weaponA, slash, castP, holyRage: p.holyRage || 0 });
  else if (cls === 'lyra')  drawLyra (ctx, { t, legA, weaponA, slash, castP });
  else                      drawKael (ctx, { t, legA, weaponA, slash, castP });

  ctx.restore();
}

// 畫兩條會擺動的腿（共用）
function drawLegs(ctx, legA, colDark, colMid) {
  ctx.save();
  // 後腿
  ctx.fillStyle = colDark;
  ctx.save(); ctx.translate(-4, -14); ctx.rotate(-legA);
  ctx.beginPath(); ctx.roundRect(-4, 0, 8, 16, 3); ctx.fill(); ctx.restore();
  // 前腿
  ctx.fillStyle = colMid;
  ctx.save(); ctx.translate(4, -14); ctx.rotate(legA);
  ctx.beginPath(); ctx.roundRect(-4, 0, 8, 16, 3); ctx.fill(); ctx.restore();
  ctx.restore();
}

/* ══════════════════════════════════════════════════════════
   VAREK 斷神騎 ── 兇悍重甲、有角戰盔、巨劍、聖怒火焰
   COLORS：改這裡換配色
══════════════════════════════════════════════════════════ */
function drawVarek(ctx, a) {
  const C = { gold:'#f0c24a', goldD:'#9c6a10', steel:'#cdd6e0', dark:'#3a2c10', cape:'#7a1418', skin:'#e8b890', eye:'#fff6c0' };

  // 聖怒火焰光暈
  if (a.holyRage > 30) {
    const k = (a.holyRage - 30) / 70;
    for (let i = 0; i < 5; i++) {
      const fa = a.t * 6 + i * 1.25;
      const fx = Math.cos(fa) * 16, fy = -26 + Math.sin(a.t * 8 + i) * 14;
      ctx.fillStyle = `rgba(255,${150 + i * 18},40,${0.25 * k})`;
      ctx.beginPath(); ctx.ellipse(fx, fy, 6, 11, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  // 披風（在身後，會飄）
  const cw = Math.sin(a.t * 4) * 3;
  ctx.fillStyle = C.cape;
  ctx.beginPath();
  ctx.moveTo(-8, -44); ctx.quadraticCurveTo(-20 + cw, -20, -14 + cw, -2);
  ctx.lineTo(6, -6); ctx.lineTo(4, -44); ctx.closePath(); ctx.fill();

  // 腿
  drawLegs(ctx, a.legA, C.goldD, C.gold);

  // 盾（左手）
  ctx.fillStyle = C.goldD; ctx.strokeStyle = C.gold; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(-15, -22, 8, 13, -0.15, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,230,140,.6)';
  ctx.beginPath(); ctx.moveTo(-15, -30); ctx.lineTo(-15, -14); ctx.stroke();

  // 軀幹（重甲）
  const bg = ctx.createLinearGradient(-12, -44, 12, -12);
  bg.addColorStop(0, C.gold); bg.addColorStop(1, C.goldD);
  ctx.fillStyle = bg; ctx.strokeStyle = C.dark; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(-12, -44, 24, 34, 5); ctx.fill(); ctx.stroke();
  // 胸口聖紋
  ctx.strokeStyle = 'rgba(255,240,180,.7)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, -30, 5, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -38); ctx.lineTo(0, -22); ctx.moveTo(-7, -30); ctx.lineTo(7, -30); ctx.stroke();
  // 尖刺肩甲
  ctx.fillStyle = C.steel;
  ctx.beginPath(); ctx.moveTo(-13, -44); ctx.lineTo(-18, -50); ctx.lineTo(-9, -42); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(13, -44); ctx.lineTo(18, -50); ctx.lineTo(9, -42); ctx.closePath(); ctx.fill();

  // 頭 + 有角戰盔
  ctx.fillStyle = C.skin;
  ctx.beginPath(); ctx.arc(0, -52, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = C.gold; ctx.strokeStyle = C.goldD; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, -54, 10, Math.PI, 0); ctx.lineTo(9, -50); ctx.lineTo(-9, -50); ctx.closePath(); ctx.fill(); ctx.stroke();
  // 牛角
  ctx.beginPath(); ctx.moveTo(-9, -58); ctx.quadraticCurveTo(-18, -64, -14, -52); ctx.quadraticCurveTo(-12, -58, -9, -58); ctx.fill();
  ctx.beginPath(); ctx.moveTo(9, -58); ctx.quadraticCurveTo(18, -64, 14, -52); ctx.quadraticCurveTo(12, -58, 9, -58); ctx.fill();
  // 發光眼縫
  ctx.fillStyle = C.eye;
  ctx.fillRect(-7, -52, 14, 2.5);

  // 巨劍（右手，會揮砍）
  ctx.save();
  ctx.translate(11, -30);
  ctx.rotate(a.weaponA);
  // 揮砍殘影
  if (a.slash > 0.15) {
    ctx.strokeStyle = `rgba(255,240,180,${a.slash * 0.6})`; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, 30, -1.0, 0.6); ctx.stroke();
  }
  ctx.fillStyle = C.steel; ctx.strokeStyle = '#8893a0'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-3, 4); ctx.lineTo(3, 4); ctx.lineTo(3, -34); ctx.lineTo(0, -40); ctx.lineTo(-3, -34); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.gold; ctx.fillRect(-7, 2, 14, 4);            // 護手
  ctx.fillStyle = C.goldD; ctx.fillRect(-2, 6, 4, 9);           // 握把
  ctx.restore();
}

/* ══════════════════════════════════════════════════════════
   LYRA 術式者 ── 兜帽戰袍、發光眼、環繞元素球、施法時法杖前刺
══════════════════════════════════════════════════════════ */
function drawLyra(ctx, a) {
  const C = { robe:'#1f6b7a', robeD:'#0a2230', trim:'#3fd8c8', hair:'#9fe8e0', skin:'#f0d0b0', glow:'#7af0ff' };

  // 環繞元素球（施法時轉更快、更亮）
  const spin = a.t * (2 + a.castP * 6);
  const elem = ['#ff8a3c', '#9fe8ff', '#f5e663']; // 火 冰 雷
  for (let i = 0; i < 3; i++) {
    const ang = spin + i * 2.094;
    const ex = Math.cos(ang) * 22, ey = -28 + Math.sin(ang) * 10;
    ctx.fillStyle = elem[i];
    ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.arc(ex, ey, 4 + a.castP * 2, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // 腿（戰靴）
  drawLegs(ctx, a.legA, '#10303a', '#1f5560');

  // 戰袍（下襬會飄）
  const sway = Math.sin(a.t * 5) * 3;
  const rg = ctx.createLinearGradient(0, -42, 0, -2);
  rg.addColorStop(0, C.robe); rg.addColorStop(1, C.robeD);
  ctx.fillStyle = rg;
  ctx.beginPath();
  ctx.moveTo(-10, -42); ctx.lineTo(10, -42);
  ctx.lineTo(14 + sway, -2); ctx.lineTo(-14 + sway, -2); ctx.closePath(); ctx.fill();
  // 袍上發光符文線
  ctx.strokeStyle = 'rgba(80,230,220,.6)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, -40); ctx.lineTo(0, -6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-7, -24); ctx.lineTo(7, -24); ctx.stroke();

  // 兜帽 + 頭
  ctx.fillStyle = C.skin;
  ctx.beginPath(); ctx.arc(0, -50, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = C.robe; ctx.strokeStyle = C.trim; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-11, -44); ctx.quadraticCurveTo(0, -64, 11, -44);
  ctx.quadraticCurveTo(6, -52, 0, -53); ctx.quadraticCurveTo(-6, -52, -11, -44); ctx.closePath();
  ctx.fill(); ctx.stroke();
  // 發光雙眼
  ctx.fillStyle = C.glow;
  ctx.beginPath(); ctx.arc(-3, -50, 1.8, 0, Math.PI * 2); ctx.arc(3, -50, 1.8, 0, Math.PI * 2); ctx.fill();

  // 法杖（右手，施法時往前刺、杖頭爆亮）
  ctx.save();
  ctx.translate(12, -30);
  ctx.rotate(a.weaponA * 0.5 - 0.1 - a.castP * 0.5);
  ctx.strokeStyle = '#0d8a86'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 14); ctx.lineTo(0, -26); ctx.stroke();
  const orbR = 6 + a.castP * 5;
  ctx.fillStyle = `rgba(120,255,240,${0.4 + a.castP * 0.5})`;
  ctx.beginPath(); ctx.arc(0, -28, orbR + 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#bfffff';
  ctx.beginPath(); ctx.arc(0, -28, orbR, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/* ══════════════════════════════════════════════════════════
   KAEL 影刃者 ── 深兜帽、發光裂眼、飄動斗篷、雙匕首交叉斬
══════════════════════════════════════════════════════════ */
function drawKael(ctx, a) {
  const C = { leather:'#241433', leatherD:'#0d0018', cloak:'#1a0e28', purple:'#b07aef', purpleD:'#5a2090', eye:'#d8a0ff', skin:'#b89ac8' };

  // 暗影煙霧
  for (let i = 0; i < 4; i++) {
    const sa = a.t * 3 + i * 1.6;
    ctx.fillStyle = `rgba(110,40,170,${0.12})`;
    ctx.beginPath(); ctx.ellipse(Math.cos(sa) * 14, -18 + Math.sin(sa) * 16, 9, 9, 0, 0, Math.PI * 2); ctx.fill();
  }

  // 飄動斗篷（在身後）
  const cw = Math.sin(a.t * 5) * 5;
  ctx.fillStyle = C.cloak;
  ctx.beginPath();
  ctx.moveTo(-9, -42); ctx.quadraticCurveTo(-22 + cw, -18, -16 + cw, 0);
  ctx.lineTo(8, -4); ctx.lineTo(5, -42); ctx.closePath(); ctx.fill();

  // 腿
  drawLegs(ctx, a.legA, '#180a28', '#2c1648');

  // 軀幹（皮甲）
  const kg = ctx.createLinearGradient(-9, -42, 9, -10);
  kg.addColorStop(0, C.leather); kg.addColorStop(1, C.leatherD);
  ctx.fillStyle = kg; ctx.strokeStyle = C.purpleD; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(-9, -42, 18, 32, 4); ctx.fill(); ctx.stroke();
  // 交叉皮帶
  ctx.strokeStyle = 'rgba(160,110,230,.5)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-8, -40); ctx.lineTo(8, -16); ctx.moveTo(8, -40); ctx.lineTo(-8, -16); ctx.stroke();

  // 深兜帽 + 頭
  ctx.fillStyle = C.skin;
  ctx.beginPath(); ctx.arc(0, -50, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = C.cloak; ctx.strokeStyle = C.purpleD; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-12, -42); ctx.quadraticCurveTo(0, -66, 12, -42);
  ctx.quadraticCurveTo(7, -50, 0, -51); ctx.quadraticCurveTo(-7, -50, -12, -42); ctx.closePath();
  ctx.fill(); ctx.stroke();
  // 兜帽內陰影
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  ctx.beginPath(); ctx.ellipse(0, -49, 6, 5, 0, 0, Math.PI * 2); ctx.fill();
  // 發光裂眼
  ctx.fillStyle = C.eye;
  ctx.beginPath(); ctx.moveTo(-5, -50); ctx.lineTo(-1, -49); ctx.lineTo(-5, -48); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(5, -50); ctx.lineTo(1, -49); ctx.lineTo(5, -48); ctx.closePath(); ctx.fill();

  // 雙匕首（攻擊時交叉斬）
  const da = a.weaponA;
  // 右手匕首
  ctx.save(); ctx.translate(10, -28); ctx.rotate(da);
  if (a.slash > 0.15) { ctx.strokeStyle = `rgba(176,122,239,${a.slash*0.7})`; ctx.lineWidth=5; ctx.lineCap='round';
    ctx.beginPath(); ctx.arc(0,0,22,-0.9,0.7); ctx.stroke(); }
  drawDagger(ctx, C.purple, C.purpleD); ctx.restore();
  // 左手匕首（反向斬）
  ctx.save(); ctx.translate(-8, -24); ctx.rotate(-da * 0.8 + 0.3);
  drawDagger(ctx, '#8a5cc0', C.purpleD); ctx.restore();
}

function drawDagger(ctx, col, colD) {
  ctx.fillStyle = col; ctx.strokeStyle = colD; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-2.5, 3); ctx.lineTo(2.5, 3); ctx.lineTo(1.5, -20); ctx.lineTo(0, -24); ctx.lineTo(-1.5, -20); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = colD; ctx.fillRect(-4, 2, 8, 3);
}
