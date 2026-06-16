/**
 * shop.js
 * 跑圖商店（局內）+ 大廳商店（局外永久購買）
 *
 * 【教學】兩種商店的差異：
 *  跑圖商店 → 在遊戲過程中隨機出現，用「局內金幣」購買，死亡後清空
 *  大廳商店 → 在主選單Hub購買，用「持久金幣」購買，永久保留
 */

import { spendGold, buyCardPack } from './data.js';
import { Game } from './game.js';
import { playSFX } from './bgm.js';

// ════════════════════════════════════════
// 跑圖商店商品表
// ════════════════════════════════════════
const RUN_SHOP_ITEMS = [
  {
    id: 'potion_small',
    name: '回復藥（小）',
    desc: '立即回復 20% 最大HP',
    price: 50,
    icon: '🧪',
    onBuy: (player) => {
      player.heal(player.maxHP * 0.20);
      playSFX('gold');
    },
  },
  {
    id: 'potion_large',
    name: '回復藥（大）',
    desc: '立即回復 50% 最大HP',
    price: 120,
    icon: '🍶',
    onBuy: (player) => {
      player.heal(player.maxHP * 0.50);
      playSFX('gold');
    },
  },
  {
    id: 'random_card',
    name: '隨機卡牌',
    desc: '獲得一張本職業的隨機卡牌',
    price: 80,
    icon: '🃏',
    onBuy: () => {
      import('./cards.js').then(({ CARD_DB, RunDeck }) => {
        const pool = CARD_DB[Game.class] || [];
        if (pool.length === 0) return;
        const card = pool[Math.floor(Math.random() * pool.length)];
        RunDeck.addCard(card.id);
        showToast(`獲得卡牌：${card.name}`);
        playSFX('card_pick');
      });
    },
  },
  {
    id: 'random_equip',
    name: '隨機裝備',
    desc: '獲得一件隨機裝備',
    price: 150,
    icon: '⚔️',
    onBuy: () => {
      import('./equipment.js').then(({ generateItem }) => {
        const slots = ['weapon', 'armor', 'accA', 'accB'];
        const slot  = slots[Math.floor(Math.random() * slots.length)];
        const item  = generateItem({ slot, chapter: Game.chapter, cls: Game.class });
        import('./data.js').then(({ addEquipment }) => addEquipment(item));
        showToast(`獲得裝備：${item.name}`);
        playSFX('gold');
      });
    },
  },
  {
    id: 'cost_crystal',
    name: '費用晶石',
    desc: '本局每回合費用永久 +1',
    price: 200,
    icon: '💎',
    onBuy: (player) => {
      player.maxCost = (player.maxCost || 3) + 1;
      player.cost    = Math.min(player.cost + 1, player.maxCost);
      showToast('費用上限 +1！');
      playSFX('level_up');
    },
  },
  {
    id: 'crit_rune',
    name: '暴擊符文',
    desc: '本局暴擊率 +10%',
    price: 180,
    icon: '✨',
    onBuy: (player) => {
      player.critR = Math.min(0.90, (player.critR || 0) + 0.10);
      showToast('暴擊率 +10%！');
      playSFX('level_up');
    },
  },
];

// ════════════════════════════════════════
// 大廳商店商品表（永久購買）
// ════════════════════════════════════════
const HUB_SHOP_ITEMS = [
  // ── VAREK 擴充包 ──
  { id: 'pack_varek_light',    name: '光明聖騎擴充包',   cls: 'varek', price: 600,  icon: '🗡️',  desc: '解鎖 VAREK 光系強化卡牌' },
  { id: 'pack_varek_dark',     name: '暗影騎士擴充包',   cls: 'varek', price: 600,  icon: '🗡️',  desc: '解鎖 VAREK 暗系強化卡牌' },
  { id: 'pack_varek_phys',     name: '物理強襲擴充包(騎)',cls: 'varek', price: 600,  icon: '🗡️',  desc: '解鎖 VAREK 物理強化卡牌' },
  // ── LYRA 擴充包 ──
  { id: 'pack_lyra_fire',      name: '火焰術式擴充包',   cls: 'lyra',  price: 600,  icon: '🔥',  desc: '解鎖 LYRA 火系強化卡牌' },
  { id: 'pack_lyra_ice',       name: '冰雪術式擴充包',   cls: 'lyra',  price: 600,  icon: '❄️',  desc: '解鎖 LYRA 冰系強化卡牌' },
  { id: 'pack_lyra_trio',      name: '雷木土擴充包',     cls: 'lyra',  price: 600,  icon: '⚡',  desc: '解鎖 LYRA 雷/木/土強化卡牌' },
  // ── KAEL 擴充包 ──
  { id: 'pack_kael_shadow',    name: '暗影刺客擴充包',   cls: 'kael',  price: 600,  icon: '🗡️',  desc: '解鎖 KAEL 暗系強化卡牌' },
  { id: 'pack_kael_magic',     name: '魔法暗器擴充包',   cls: 'kael',  price: 600,  icon: '🎴',  desc: '解鎖 KAEL 魔法強化卡牌' },
  { id: 'pack_kael_phys',      name: '物理強襲擴充包(刃)',cls: 'kael',  price: 800,  icon: '🗡️',  desc: '解鎖 KAEL 物理強化卡牌' },
  // ── 通用 ──
  { id: 'warehouse_expand',    name: '倉庫擴充',          cls: 'any',   price: 200,  icon: '📦',  desc: '裝備倉庫 +10 格' },
  { id: 'equip_material_pack', name: '裝備精煉材料包',    cls: 'any',   price: 400,  icon: '🔨',  desc: '強化材料 ×5（可直接強化裝備）' },
];

// ════════════════════════════════════════
// 跑圖商店：隨機顯示3件商品
// ════════════════════════════════════════
export function showRunShop(player, runGold, onGoldChange) {
  // 隨機選3件
  const items = shuffle([...RUN_SHOP_ITEMS]).slice(0, 3);

  const overlay = createOverlay('跑圖商店');
  const grid = overlay.querySelector('.shop-grid');

  let gold = runGold;

  items.forEach(item => {
    const el = document.createElement('div');
    el.className = 'shop-item';
    el.innerHTML = `
      <div class="shop-icon">${item.icon}</div>
      <div class="shop-name">${item.name}</div>
      <div class="shop-desc">${item.desc}</div>
      <button class="btn-buy ${gold < item.price ? 'disabled' : ''}"
        data-price="${item.price}">
        💰 ${item.price}
      </button>
    `;
    el.querySelector('.btn-buy').addEventListener('click', () => {
      if (gold < item.price) return;
      gold -= item.price;
      onGoldChange(gold);
      item.onBuy(player);
      el.querySelector('.btn-buy').textContent = '✓ 已購買';
      el.querySelector('.btn-buy').disabled = true;
      overlay.querySelector('#shop-gold').textContent = `💰 ${gold}`;
    });
    grid.appendChild(el);
  });

  overlay.querySelector('#shop-gold').textContent = `💰 ${gold}`;
  overlay.querySelector('#shop-close').addEventListener('click', () => {
    overlay.remove();
    // 繼續遊戲
    import('./game.js').then(m => { m.Game.state = 'running'; });
  });

  document.body.appendChild(overlay);
}

// ════════════════════════════════════════
// 大廳商店 UI
// ════════════════════════════════════════
export function renderHubShop(currentGold, unlockedPacks, onUpdate) {
  const container = document.getElementById('hub-shop-content');
  if (!container) return;

  const cls = document.querySelector('.class-card.selected')?.dataset.class || 'any';

  const filtered = HUB_SHOP_ITEMS.filter(i => i.cls === cls || i.cls === 'any');

  container.innerHTML = filtered.map(item => {
    const owned = unlockedPacks?.includes(item.id);
    return `
      <div class="hub-shop-item">
        <span class="shop-icon">${item.icon}</span>
        <div class="hub-shop-info">
          <div class="hub-shop-name">${item.name}</div>
          <div class="hub-shop-desc">${item.desc}</div>
        </div>
        <button class="btn-hub-buy ${owned ? 'owned' : ''} ${currentGold < item.price && !owned ? 'disabled' : ''}"
          data-id="${item.id}" data-price="${item.price}" ${owned ? 'disabled' : ''}>
          ${owned ? '✓ 已解鎖' : `💰 ${item.price}`}
        </button>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.btn-hub-buy:not([disabled])').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id    = btn.dataset.id;
      const price = parseInt(btn.dataset.price);
      try {
        await buyCardPack(id, price);
        showToast('購買成功！');
        playSFX('gold');
        onUpdate?.();
      } catch (e) {
        showToast(e.message || '購買失敗', true);
      }
    });
  });
}

// ════════════════════════════════════════
// 工具函數
// ════════════════════════════════════════
function createOverlay(title) {
  const el = document.createElement('div');
  el.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,.85);backdrop-filter:blur(4px);
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    gap:16px;z-index:80;color:#E8E0F8;font-family:sans-serif;padding:20px;
  `;
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;">
      <h2 style="color:#EF9F27;font-size:1.4rem">${title}</h2>
      <span id="shop-gold" style="color:#EF9F27"></span>
    </div>
    <div class="shop-grid" style="display:flex;gap:14px;flex-wrap:wrap;justify-content:center;"></div>
    <button id="shop-close" style="padding:10px 28px;background:#333;border:1px solid #555;
      border-radius:8px;color:#E8E0F8;cursor:pointer;font-size:.95rem">
      離開商店
    </button>
  `;
  return el;
}

function showToast(msg, isError = false) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = `
    position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
    background:${isError ? '#c0392b' : '#27ae60'};color:#fff;
    padding:10px 24px;border-radius:8px;font-size:.9rem;z-index:999;
    animation:float-up .9s ease-out forwards;pointer-events:none;
  `;
  document.body.appendChild(t);
  t.addEventListener('animationend', () => t.remove());
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
