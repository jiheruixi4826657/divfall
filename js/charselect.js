/**
 * charselect.js  ──  選角卡片裡的「活的」角色預覽動畫
 * ════════════════════════════════════════════════════════════════
 * 把遊戲內同一套向量角色（sprites.js 的 drawHero）畫在選角卡片的小 canvas 上，
 * 讓三個職業在選角畫面就會「呼吸 + 偶爾擺個攻擊/施法動作」。
 *
 * 【想改預覽行為，改這裡】
 *  - 待機/動作節奏 → loop() 內的時間判斷
 *  - 角色大小/位置 → drawHero 的 sx,sy 與 ctx.scale
 * ════════════════════════════════════════════════════════════════
 */
import { drawHero } from './sprites.js';

function initPortrait(canvas) {
  const cls = canvas.dataset.class;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  let t = 0;
  let actTimer = 0;       // 動作（攻擊/施法）剩餘秒數
  let actType  = null;    // 'atk' | 'cast'
  let nextAct  = 1.5 + Math.random() * 2;  // 下次動作倒數
  let last = performance.now();

  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    t += dt;

    // 偶爾觸發一個動作
    nextAct -= dt;
    if (nextAct <= 0 && actTimer <= 0) {
      actType  = Math.random() < 0.5 ? 'atk' : 'cast';
      actTimer = actType === 'atk' ? 0.28 : 0.35;
      nextAct  = 2.5 + Math.random() * 2.5;
    }
    if (actTimer > 0) actTimer -= dt;

    ctx.clearRect(0, 0, W, H);
    // 放大一點讓角色填滿卡片
    ctx.save();
    ctx.translate(W / 2, H - 12);
    ctx.scale(1.5, 1.5);
    drawHero(ctx, cls, 0, 0, {
      facing:   1,
      animTime: t,
      moving:   false,                       // 待機（呼吸）
      castP:    actType === 'cast' ? Math.max(0, actTimer / 0.35) : 0,
      attackP:  actType === 'atk'  ? Math.max(0, actTimer / 0.28) : 0,
      holyRage: cls === 'varek' ? 60 : 0,    // 讓 VAREK 帶點聖怒火焰
    });
    ctx.restore();

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

// 頁面載入後，為每張選角卡片啟動預覽
function boot() {
  document.querySelectorAll('.class-portrait').forEach(initPortrait);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
