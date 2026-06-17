/**
 * stagebg.js  ──  橫向 2D 場景：視差背景 + 環境粒子 + 暗角霧
 * ════════════════════════════════════════════════════════════════
 * 死亡細胞式側捲場景。背景分多層，依相機 X 以不同速度捲動 → 視差深度感。
 *
 * 【想改場景，改這裡的 THEMES】
 *  - sky:    天空漸層（上→下）
 *  - far/mid/near: 三層剪影色（遠→近）
 *  - ground: 地面色 [上緣亮, 下方暗]
 *  - fog:    邊緣暗角色
 *  - amb:    環境粒子 { type:'ember|snow|spore|mote|spark', color, n }
 *
 * API（給 game.js 用）：
 *  setStageTheme(chapter) / getTheme()
 *  renderParallax(ctx, camX, w, h, groundY)   背景三層
 *  updateAmbient(delta,w,h) / renderAmbient(ctx)   環境粒子
 *  renderVignette(ctx,w,h)   邊緣暗角
 * ════════════════════════════════════════════════════════════════
 */

export const THEMES = {
  1: { // 熔鐵廢都
    sky:['#3a1410','#1a0a0c','#0a0406'], far:'#2a1418', mid:'#3a1a16', near:'#1e0e0c',
    ground:['#4a2820','#1a0c08'], fog:'rgba(40,8,4,0.5)',
    amb:{ type:'ember', color:'#ff7a30', n:30 },
  },
  2: { // 腐化幽林
    sky:['#16281a','#0c160e','#040a06'], far:'#1a2c1e', mid:'#22381f', near:'#0e1c10',
    ground:['#2a3a22','#0c160a'], fog:'rgba(8,30,12,0.5)',
    amb:{ type:'spore', color:'#7fe0a0', n:26 },
  },
  3: { // 冰封深淵
    sky:['#16263a','#0c1622','#04080e'], far:'#1c3048', mid:'#24405c', near:'#0e1c2c',
    ground:['#2a4258','#0c1622'], fog:'rgba(120,180,220,0.16)',
    amb:{ type:'snow', color:'#cfeeff', n:40 },
  },
  4: { // 虛空之境
    sky:['#1e1430','#100a1e','#05030c'], far:'#241a3a', mid:'#2e2048', near:'#160e26',
    ground:['#2c2046','#0e0820'], fog:'rgba(40,12,60,0.5)',
    amb:{ type:'mote', color:'#b07aef', n:24 },
  },
  5: { // 神殞聖殿
    sky:['#322414','#1a1208','#080502'], far:'#3a2c16', mid:'#4a3818', near:'#1e160a',
    ground:['#4a3a1c','#1a1206'], fog:'rgba(60,40,8,0.45)',
    amb:{ type:'spark', color:'#ffd070', n:34 },
  },
};

let current = THEMES[1];
let particles = [];

export function setStageTheme(chapter) {
  current = THEMES[chapter] || THEMES[1];
  particles = [];   // 重置環境粒子，換場
  return current;
}
export function getTheme() { return current; }

// ════════════════════════════════════════
// 視差背景（三層剪影 + 天空）
// camX = 相機左緣世界座標；w,h = 畫面；groundY = 地面螢幕 y
// ════════════════════════════════════════
export function renderParallax(ctx, camX, w, h, groundY) {
  // 天空漸層
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, current.sky[0]);
  sky.addColorStop(0.55, current.sky[1]);
  sky.addColorStop(1, current.sky[2]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // 三層剪影：遠(0.15)、中(0.35)、近(0.6) 速度
  drawSilhouetteLayer(ctx, camX * 0.15, w, groundY, current.far,  120, 70,  0);
  drawSilhouetteLayer(ctx, camX * 0.35, w, groundY, current.mid,  90,  120, 1);
  drawSilhouetteLayer(ctx, camX * 0.6,  w, groundY, current.near, 60,  180, 2);
}

// 用確定性偽隨機畫一排高低不一的柱狀剪影（廢墟/樹/冰柱/石碑）
function drawSilhouetteLayer(ctx, scroll, w, groundY, color, spacing, maxH, seedOff) {
  ctx.fillStyle = color;
  const startX = -((scroll % spacing) + spacing);
  let idx = Math.floor(scroll / spacing);
  for (let x = startX; x < w + spacing; x += spacing) {
    const seed = ((idx * 2654435761) ^ (seedOff * 40503)) >>> 0;
    const r = (seed % 1000) / 1000;
    const hgt = maxH * (0.45 + r * 0.55);
    const wid = spacing * (0.55 + ((seed >> 10) % 100) / 250);
    const top = groundY - hgt;
    // 主體
    roundTop(ctx, x, top, wid, hgt, Math.min(wid * 0.4, 16));
    idx++;
  }
}

function roundTop(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.fill();
}

// ════════════════════════════════════════
// 環境粒子（火星/雪/孢子/光點/火花）
// ════════════════════════════════════════
export function updateAmbient(delta, w, h) {
  const cfg = current.amb;
  // 補滿
  while (particles.length < cfg.n) particles.push(spawnParticle(cfg, w, h, true));

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * delta;
    p.y += p.vy * delta;
    p.life -= delta;
    if (p.life <= 0 || p.y < -10 || p.y > h + 10 || p.x < -10 || p.x > w + 10) {
      particles[i] = spawnParticle(cfg, w, h, false);
    }
  }
}

function spawnParticle(cfg, w, h, anywhere) {
  const t = cfg.type;
  let vx = 0, vy = 0, x = Math.random() * w, y = anywhere ? Math.random() * h : -5;
  if (t === 'ember' || t === 'spark') { vy = -20 - Math.random() * 30; vx = (Math.random() - 0.5) * 20; y = anywhere ? Math.random() * h : h + 5; }
  else if (t === 'snow')  { vy = 30 + Math.random() * 40; vx = (Math.random() - 0.5) * 24; }
  else if (t === 'spore') { vy = -8 - Math.random() * 12; vx = (Math.random() - 0.5) * 16; y = anywhere ? Math.random() * h : h + 5; }
  else { vy = (Math.random() - 0.5) * 16; vx = (Math.random() - 0.5) * 16; } // mote 飄浮
  return { x, y, vx, vy, life: 2 + Math.random() * 4, size: 1 + Math.random() * 2.2, color: cfg.color };
}

export function renderAmbient(ctx) {
  ctx.save();
  particles.forEach(p => {
    ctx.globalAlpha = Math.min(0.8, p.life * 0.35);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
  });
  ctx.restore();
}

// ════════════════════════════════════════
// 邊緣暗角（讓畫面更有氛圍/聚焦中央）
// ════════════════════════════════════════
export function renderVignette(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.72);
  g.addColorStop(0, 'transparent');
  g.addColorStop(1, current.fog);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
