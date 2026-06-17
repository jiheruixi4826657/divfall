/**
 * fx.js  ──  打擊感特效系統（粒子 / 斬擊軌跡 / 螢幕震動 / 命中閃光）
 * ════════════════════════════════════════════════════════════════
 * 這是「Hades 爽感」的來源。全部用 Canvas 即時繪製，效能很輕。
 *
 * 【想調爽度，改這裡】
 *  - 粒子數量/壽命 → fxHit() 裡的迴圈與 life
 *  - 震屏幅度 → fxHit/fxBigHit 裡的 addShake 數值
 *  - 閃光強度 → FX.flash 設定值
 *
 * 座標：粒子用「世界座標」儲存，繪製時由 game.js 投影成等距畫面。
 * ════════════════════════════════════════════════════════════════
 */

export const FX = {
  particles: [],   // {x,y,vx,vy,life,maxLife,size,color}
  slashes:   [],   // {x,y,angle,life,color,r}
  shake:     0,    // 螢幕震動強度（像素）
  flash:     0,    // 全螢幕閃光 0~1
  flashColor: '#ffffff',
};

// ── 命中特效：粒子噴濺 + 斬擊弧 + 震屏（power 越大越誇張）──
export function fxHit(x, y, color = '#fff', power = 1) {
  const n = Math.min(18, 6 + Math.floor(power * 4));
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 60 + Math.random() * 160 * power;
    FX.particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 40,        // 略往上噴
      life: 0.3 + Math.random() * 0.3,
      maxLife: 0.6,
      size: 2 + Math.random() * 3,
      color,
    });
  }
  FX.slashes.push({ x, y, angle: Math.random() * Math.PI, life: 0.18, maxLife: 0.18, color, r: 26 + power * 4 });
  addShake(Math.min(10, 2.5 + power * 1.5));
}

// ── 暴擊/大招：更強的閃光 + 震屏 ──
export function fxBigHit(x, y, color = '#fff') {
  fxHit(x, y, color, 3);
  FX.flash = 0.5;
  FX.flashColor = color;
  addShake(12);
  // 衝擊環
  FX.slashes.push({ x, y, angle: 0, life: 0.3, maxLife: 0.3, color, r: 50, ring: true });
}

// ── 死亡爆散 ──
export function fxDeath(x, y, color = '#c0392b') {
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const sp = 80 + Math.random() * 120;
    FX.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5, maxLife: 0.5, size: 3, color });
  }
  addShake(5);
}

export function addShake(v) { FX.shake = Math.max(FX.shake, v); }

// ── 每幀更新（在 game.js update 裡呼叫）──
export function updateFX(delta) {
  // 粒子
  for (let i = FX.particles.length - 1; i >= 0; i--) {
    const p = FX.particles[i];
    p.life -= delta;
    if (p.life <= 0) { FX.particles.splice(i, 1); continue; }
    p.x += p.vx * delta;
    p.y += p.vy * delta;
    p.vy += 280 * delta;     // 重力
    p.vx *= 0.92;            // 空氣阻力
  }
  // 斬擊弧
  for (let i = FX.slashes.length - 1; i >= 0; i--) {
    FX.slashes[i].life -= delta;
    if (FX.slashes[i].life <= 0) FX.slashes.splice(i, 1);
  }
  // 衰減
  FX.shake *= Math.pow(0.001, delta);   // 快速回正
  if (FX.shake < 0.2) FX.shake = 0;
  FX.flash = Math.max(0, FX.flash - delta * 2.5);
}

// ── 繪製世界層粒子/斬擊（在角色之後呼叫，傳入投影函數）──
export function renderFXWorld(ctx, worldToScreen) {
  // 斬擊弧
  FX.slashes.forEach(s => {
    const c = worldToScreen(s.x, s.y);
    const k = s.life / s.maxLife;
    ctx.save();
    ctx.globalAlpha = k;
    if (s.ring) {
      ctx.strokeStyle = s.color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(c.x, c.y, s.r * (1.4 - k) , s.r * (1.4 - k) * 0.5, 0, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.strokeStyle = s.color; ctx.lineWidth = 4 * k + 1; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(c.x, c.y, s.r, s.angle - 0.9, s.angle + 0.9); ctx.stroke();
    }
    ctx.restore();
  });
  // 粒子
  FX.particles.forEach(p => {
    const c = worldToScreen(p.x, p.y);
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(c.x, c.y, p.size, 0, Math.PI * 2); ctx.fill();
  });
  ctx.globalAlpha = 1;
}

// ── 全螢幕閃光（在最上層呼叫）──
export function renderFlash(ctx, w, h) {
  if (FX.flash <= 0) return;
  ctx.save();
  ctx.globalAlpha = FX.flash;
  ctx.fillStyle = FX.flashColor;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

// ── 取得本幀震動位移（render 開頭套用）──
export function shakeOffset() {
  if (FX.shake <= 0) return { x: 0, y: 0 };
  return { x: (Math.random() * 2 - 1) * FX.shake, y: (Math.random() * 2 - 1) * FX.shake };
}

// 元素 → 顏色（給打擊特效上色用）
export const ELEMENT_COLOR = {
  '火': '#ff6a2c', '冰': '#7af0ff', '雷': '#f5e663', '木': '#5fe08a',
  '土': '#caa46a', '光': '#fff0b0', '暗': '#b07aef', '物理': '#dfe6ee', '魔法': '#5fe8d8',
};
