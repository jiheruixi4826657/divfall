/**
 * stagebg.js  ──  各章節「場景氛圍」（地板配色 + 背景 + 環境粒子 + 霧）
 * ════════════════════════════════════════════════════════════════
 * 每一章換一套配色與環境氛圍，營造不同關卡的感覺。
 *
 * 【想改場景顏色/氛圍，改這裡的 THEMES】
 *  - bg:      背景漸層三色（中心→外圍）
 *  - floorA/B: 地磚顏色範圍（會隨機在兩者間取色）
 *  - line:    地磚邊線色
 *  - fog:     邊緣暗角/霧色
 *  - amb:     環境粒子類型 'ember|snow|spore|mote|spark' 與顏色
 * ════════════════════════════════════════════════════════════════
 */

export const THEMES = {
  // 第一章・熔鐵廢都（火）
  1: { bg:['#2a1018','#140810','#050204'], floorA:[46,28,30], floorB:[64,34,28], line:'rgba(200,90,50,.16)',
       fog:'rgba(40,8,4,0.55)', amb:{ type:'ember', color:'#ff7a30', n:36 } },
  // 第二章・腐化幽林（木/土）
  2: { bg:['#0e2418','#08160e','#030803'], floorA:[26,40,28], floorB:[34,52,30], line:'rgba(90,200,120,.14)',
       fog:'rgba(6,24,10,0.5)', amb:{ type:'spore', color:'#7df0a0', n:30 } },
  // 第三章・冰封深淵（冰/雷）
  3: { bg:['#102234','#0a1622','#040810'], floorA:[34,46,60], floorB:[44,58,76], line:'rgba(120,200,255,.16)',
       fog:'rgba(10,20,40,0.5)', amb:{ type:'snow', color:'#cdeeff', n:46 } },
  // 第四章・虛空之境（暗/光）
  4: { bg:['#1c0e2e','#100820','#040208'], floorA:[36,24,52], floorB:[48,30,70], line:'rgba(160,110,240,.18)',
       fog:'rgba(14,4,30,0.55)', amb:{ type:'mote', color:'#d8b0ff', n:40 } },
  // 第五章・神殞聖殿（全屬性/最終）
  5: { bg:['#2a1e08','#160f06','#060402'], floorA:[54,42,22], floorB:[72,56,28], line:'rgba(240,200,100,.2)',
       fog:'rgba(30,18,2,0.5)', amb:{ type:'spark', color:'#ffd86a', n:42 } },
};

let _theme = THEMES[1];
let _amb   = [];        // 環境粒子（螢幕座標）

export function getTheme() { return _theme; }

// 切換章節主題（重置環境粒子）
export function setStageTheme(chapter) {
  _theme = THEMES[chapter] || THEMES[1];
  _amb = [];
}

// ── 環境粒子更新（螢幕座標，與相機無關，當作氛圍疊層）──
export function updateAmbient(delta, w, h) {
  const cfg = _theme.amb;
  // 補滿粒子
  while (_amb.length < cfg.n) _amb.push(spawn(cfg.type, w, h, true));

  for (let i = _amb.length - 1; i >= 0; i--) {
    const p = _amb[i];
    p.x += p.vx * delta;
    p.y += p.vy * delta;
    p.phase += delta;
    p.x += Math.sin(p.phase * p.sway) * p.swayAmt * delta; // 飄
    p.life -= delta;
    // 出界或壽命到 → 重生
    if (p.life <= 0 || p.y < -20 || p.y > h + 20 || p.x < -20 || p.x > w + 20) {
      _amb[i] = spawn(cfg.type, w, h, false);
    }
  }
}

function spawn(type, w, h, anywhere) {
  const base = { phase: Math.random() * 6, sway: 1 + Math.random() * 2, swayAmt: 10 + Math.random() * 20 };
  switch (type) {
    case 'ember': // 火星上升
      return { ...base, x: Math.random() * w, y: anywhere ? Math.random() * h : h + 10,
               vx: 0, vy: -(20 + Math.random() * 40), size: 1.5 + Math.random() * 2, life: 3 + Math.random() * 3 };
    case 'snow':  // 雪花下落
      return { ...base, x: Math.random() * w, y: anywhere ? Math.random() * h : -10,
               vx: -10 + Math.random() * 20, vy: 30 + Math.random() * 40, size: 1.5 + Math.random() * 2.5, life: 8 };
    case 'spore': // 孢子緩飄
      return { ...base, x: Math.random() * w, y: anywhere ? Math.random() * h : h + 10,
               vx: -8 + Math.random() * 16, vy: -(8 + Math.random() * 18), size: 1.5 + Math.random() * 2, life: 5 + Math.random() * 4 };
    case 'mote':  // 光點漂浮
      return { ...base, x: Math.random() * w, y: Math.random() * h,
               vx: -12 + Math.random() * 24, vy: -12 + Math.random() * 24, size: 1 + Math.random() * 2, life: 4 + Math.random() * 4 };
    case 'spark': // 金色火花上升
    default:
      return { ...base, x: Math.random() * w, y: anywhere ? Math.random() * h : h + 10,
               vx: -6 + Math.random() * 12, vy: -(30 + Math.random() * 50), size: 1.5 + Math.random() * 2, life: 3 + Math.random() * 2 };
  }
}

// ── 繪製環境粒子（螢幕座標，疊在最上層氛圍）──
export function renderAmbient(ctx) {
  const col = _theme.amb.color;
  ctx.save();
  ctx.fillStyle = col;
  _amb.forEach(p => {
    ctx.globalAlpha = Math.min(0.8, p.life * 0.3);
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
  });
  ctx.restore();
}

// ── 邊緣暗角/霧（讓中央聚焦、四周變暗）──
export function renderVignette(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, 'transparent');
  g.addColorStop(1, _theme.fog);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
