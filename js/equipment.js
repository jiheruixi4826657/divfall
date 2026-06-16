/**
 * equipment.js
 * 裝備系統：槽位管理、詞條生成、強化、元素共鳴
 *
 * 【教學】裝備品質決定詞條數量：
 *  普通（灰）= 1條 / 稀有（藍）= 2條 / 史詩（紫）= 3條 / 傳說（金）= 4條+特效
 */

import { addEquipment, equipItem, spendGold } from './data.js';
import { Game } from './game.js';

// ════════════════════════════════════════
// 品質定義
// ════════════════════════════════════════
export const QUALITY = {
  COMMON: { id: 'common', name: '普通', color: '#a0a0a0', affix: 1, mult: 1.0 },
  RARE:   { id: 'rare',   name: '稀有', color: '#3498db', affix: 2, mult: 1.3 },
  EPIC:   { id: 'epic',   name: '史詩', color: '#9b59b6', affix: 3, mult: 1.6 },
  LEGEND: { id: 'legend', name: '傳說', color: '#EF9F27', affix: 4, mult: 2.0 },
};

// ════════════════════════════════════════
// 詞條池（按槽位分類）
// ════════════════════════════════════════
const AFFIX_POOL = {
  weapon: [
    { key: 'atk',        name: '攻擊力',     min: 15,  max: 120 },
    { key: 'critR',      name: '暴擊率',     min: 3,   max: 20,  pct: true },
    { key: 'critM',      name: '暴擊倍率',   min: 15,  max: 80,  pct: true },
    { key: 'skillDmg',   name: '技能傷害',   min: 10,  max: 60,  pct: true },
    { key: 'atkSpd',     name: '攻擊速度',   min: 5,   max: 30,  pct: true },
    { key: 'elemDmg',    name: '元素傷害',   min: 8,   max: 45,  pct: true },
  ],
  armor: [
    { key: 'maxHP',      name: '最大HP',     min: 80,  max: 500 },
    { key: 'def',        name: '防禦力',     min: 10,  max: 80  },
    { key: 'hpRegen',    name: 'HP回復/秒',  min: 5,   max: 30  },
    { key: 'dmgReduce',  name: '減傷',       min: 3,   max: 18,  pct: true },
    { key: 'maxCost',    name: '費用上限',   min: 1,   max: 2   },
  ],
  accA: [
    { key: 'critR',      name: '暴擊率',     min: 3,   max: 20,  pct: true },
    { key: 'critM',      name: '暴擊倍率',   min: 15,  max: 80,  pct: true },
    { key: 'speed',      name: '速度',       min: 5,   max: 40  },
    { key: 'costRegen',  name: '費用回復',   min: 0.5, max: 2   },
    { key: 'lifeSteal',  name: '吸血',       min: 3,   max: 20,  pct: true },
  ],
  accB: [
    { key: 'skillDmg',   name: '技能傷害',   min: 10,  max: 60,  pct: true },
    { key: 'elemDmg',    name: '元素傷害',   min: 8,   max: 45,  pct: true },
    { key: 'hpRegen',    name: 'HP回復/秒',  min: 5,   max: 30  },
    { key: 'cdReduce',   name: '冷卻縮減',   min: 5,   max: 25,  pct: true },
    { key: 'bossBonus',  name: 'BOSS傷害',   min: 5,   max: 25,  pct: true },
  ],
};

// ════════════════════════════════════════
// BOSS 掉落表（章節 BOSS × 職業 × 槽位）
// ════════════════════════════════════════
const BOSS_DROP_NAMES = {
  1: {
    varek: {
      weapon: '熔岩巨劍',   armor: '炙熔護甲',   accA: '熔鐵腕輪',   accB: '聖火墜飾',
    },
    lyra: {
      weapon: '烈焰法杖',   armor: '火焰法袍',   accA: '火焰指環',   accB: '燃燒護符',
    },
    kael: {
      weapon: '熔鐵雙刀',   armor: '炙熱遮面',   accA: '灼燒鐐銬',   accB: '火焰印記',
    },
  },
  2: {
    varek: { weapon: '腐化聖劍', armor: '孢子護甲', accA: '藤蔓腕輪', accB: '林靈墜飾' },
    lyra:  { weapon: '木系法杖', armor: '自然法袍', accA: '大地指環', accB: '腐化護符' },
    kael:  { weapon: '毒刺雙刀', armor: '霧林遮面', accA: '根系鐐銬', accB: '腐木印記' },
  },
  3: {
    varek: { weapon: '深海聖劍', armor: '冰晶護甲', accA: '雷石腕輪', accB: '海神墜飾' },
    lyra:  { weapon: '寒冰法杖', armor: '雷光法袍', accA: '冰雷指環', accB: '潮汐護符' },
    kael:  { weapon: '冰封雙刀', armor: '深淵遮面', accA: '雷鳴鐐銬', accB: '冰息印記' },
  },
  4: {
    varek: { weapon: '虛空聖劍', armor: '裂縫護甲', accA: '暗隙腕輪', accB: '虛無墜飾' },
    lyra:  { weapon: '暗能法杖', armor: '次元法袍', accA: '裂縫指環', accB: '虛空護符' },
    kael:  { weapon: '虛空雙刀', armor: '暗域遮面', accA: '空間鐐銬', accB: '裂隙印記' },
  },
  5: {
    varek: { weapon: '神座聖劍', armor: '神聖護甲', accA: '神力腕輪', accB: '落神墜飾' },
    lyra:  { weapon: '終焉法杖', armor: '神裂法袍', accA: '神座指環', accB: '墮神護符' },
    kael:  { weapon: '神殞雙刀', armor: '暗神遮面', accA: '封神鐐銬', accB: '神殞印記' },
  },
};

// ════════════════════════════════════════
// 生成裝備物件
// ════════════════════════════════════════
export function generateItem({ slot, chapter = 1, cls, quality = null, nameOverride = null }) {
  // 隨機品質（若未指定）
  const q = quality || rollQuality(chapter);

  // 隨機詞條
  const affixCount = QUALITY[q].affix;
  const pool = [...(AFFIX_POOL[slot] || AFFIX_POOL.accA)];
  const affixes = [];
  for (let i = 0; i < affixCount && pool.length > 0; i++) {
    const idx  = Math.floor(Math.random() * pool.length);
    const def  = pool.splice(idx, 1)[0];
    const mult = QUALITY[q].mult;
    const val  = lerp(def.min, def.max, Math.random()) * mult;
    affixes.push({
      key:  def.key,
      name: def.name,
      value: def.pct
        ? parseFloat((val).toFixed(1))
        : Math.floor(val),
      pct: !!def.pct,
    });
  }

  // 強化等級：初始 +0
  const item = {
    id:       `${slot}_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
    name:     nameOverride || `${QUALITY[q].name}${SLOT_NAMES[slot]}`,
    slot,
    cls:      cls || 'any',
    quality:  q,
    enhance:  0,
    chapter,
    affixes,
  };

  // 傳說裝備加特殊效果描述
  if (q === 'LEGEND') {
    item.legendEffect = rollLegendEffect(slot);
  }

  return item;
}

// ── BOSS 掉落（命名裝備）──
export function generateBossDrop(chapter, cls, slot) {
  // 各品質掉落概率
  const roll = Math.random();
  let q;
  if (chapter >= 5 && roll < 0.05) q = 'LEGEND';
  else if (chapter >= 4 && roll < 0.13) q = 'LEGEND';
  else if (roll < 0.02) q = 'LEGEND';
  else if (roll < 0.10) q = 'EPIC';
  else if (roll < 0.40) q = 'RARE';
  else q = 'COMMON';

  const nameOverride = BOSS_DROP_NAMES[chapter]?.[cls]?.[slot] || null;
  return generateItem({ slot, chapter, cls, quality: q, nameOverride });
}

// ════════════════════════════════════════
// 強化系統（消耗同品質同槽位裝備）
// ════════════════════════════════════════
const ENHANCE_REQ = [1, 2, 3, 4, 5, 7, 9, 12, 15, 20];
const ENHANCE_MULT = [1.05, 1.10, 1.15, 1.22, 1.30, 1.40, 1.52, 1.66, 1.82, 2.00];

export function getEnhanceCost(currentLevel) {
  return ENHANCE_REQ[currentLevel] || 20;
}

export function applyEnhance(item) {
  if (item.enhance >= 10) return item;
  const lv   = item.enhance;
  const next = lv + 1;
  const mult = ENHANCE_MULT[lv];

  const enhanced = {
    ...item,
    enhance: next,
    affixes: item.affixes.map(a => ({
      ...a,
      value: a.pct
        ? parseFloat((a.value * mult).toFixed(1))
        : Math.floor(a.value * mult),
    })),
  };
  return enhanced;
}

// ════════════════════════════════════════
// 元素共鳴（2件/4件同元素觸發）
// ════════════════════════════════════════
export function calcElementResonance(equipped) {
  const elemCount = {};
  Object.values(equipped).forEach(item => {
    if (!item?.element) return;
    elemCount[item.element] = (elemCount[item.element] || 0) + 1;
  });

  const bonuses = [];
  for (const [elem, count] of Object.entries(elemCount)) {
    if (count >= 4) bonuses.push({ elem, tier: 2, dmgBonus: 0.35, effect: `${elem}屬攻擊自帶元素效果` });
    else if (count >= 2) bonuses.push({ elem, tier: 1, dmgBonus: 0.15 });
  }
  return bonuses;
}

// ════════════════════════════════════════
// 套用裝備加成到玩家
// ════════════════════════════════════════
export function applyEquipmentStats(player, equippedItems) {
  // 重置到基礎值
  const base = BASE_STATS[player.cls];
  if (!base) return;

  Object.assign(player, {
    atk:    base.atk,
    def:    base.def,
    maxHP:  base.hp,
    speed:  base.speed,
    critR:  base.critR,
    critM:  base.critM,
  });

  // 累加裝備詞條
  Object.values(equippedItems).forEach(item => {
    if (!item?.affixes) return;
    item.affixes.forEach(a => {
      switch (a.key) {
        case 'atk':       player.atk     += a.value; break;
        case 'def':       player.def     += a.value; break;
        case 'maxHP':     player.maxHP   += a.value; break;
        case 'speed':     player.speed   += a.value; break;
        case 'critR':     player.critR   += a.value / 100; break;
        case 'critM':     player.critM   += a.value / 100; break;
      }
    });
  });

  // 元素共鳴加成
  const resonance = calcElementResonance(equippedItems);
  resonance.forEach(r => { player._elemBonus = (player._elemBonus || {});
    player._elemBonus[r.elem] = (player._elemBonus[r.elem] || 0) + r.dmgBonus;
  });
}

// ════════════════════════════════════════
// 裝備 UI（格子 + 詞條顯示）
// ════════════════════════════════════════
export function renderEquipmentPanel(equipped, owned, onEquip) {
  const panel = document.getElementById('equipment-panel');
  if (!panel) return;

  const slots = ['weapon', 'armor', 'accA', 'accB'];
  panel.innerHTML = `
    <div class="eq-slots">
      ${slots.map(slot => {
        const item = equipped[slot];
        return `<div class="eq-slot" data-slot="${slot}">
          <div class="eq-slot-label">${SLOT_NAMES[slot]}</div>
          ${item ? renderItemCard(item) : '<div class="eq-empty">空</div>'}
        </div>`;
      }).join('')}
    </div>
    <div class="eq-owned">
      <h4>持有裝備</h4>
      ${owned.map((item, i) => `
        <div class="eq-owned-item" data-idx="${i}">
          <span class="eq-item-name" style="color:${QUALITY[item.quality]?.color}">${item.name} +${item.enhance}</span>
          <button onclick="__EquipFns.equip(${i})">裝備</button>
        </div>
      `).join('')}
    </div>
  `;
}

function renderItemCard(item) {
  const q = QUALITY[item.quality];
  return `<div class="eq-item-card" style="border-color:${q?.color}">
    <div class="eq-item-name" style="color:${q?.color}">${item.name} +${item.enhance}</div>
    ${item.affixes.map(a =>
      `<div class="eq-affix">${a.name}: +${a.value}${a.pct ? '%' : ''}</div>`
    ).join('')}
    ${item.legendEffect ? `<div class="eq-legend-fx">${item.legendEffect}</div>` : ''}
  </div>`;
}

// ── 工具 ──
function rollQuality(chapter) {
  const r = Math.random();
  if (chapter >= 5 && r < 0.03) return 'LEGEND';
  if (r < 0.02)                  return 'LEGEND';
  if (r < 0.10)                  return 'EPIC';
  if (r < 0.35)                  return 'RARE';
  return 'COMMON';
}

function lerp(a, b, t) { return a + (b - a) * t; }

const SLOT_NAMES = { weapon: '武器', armor: '護甲', accA: '飾品A', accB: '飾品B' };

const BASE_STATS = {
  varek: { hp: 1200, atk: 85,  def: 60, speed: 2.2, critR: 0.10, critM: 1.80 },
  lyra:  { hp: 750,  atk: 110, def: 25, speed: 2.7, critR: 0.15, critM: 2.00 },
  kael:  { hp: 900,  atk: 100, def: 35, speed: 3.2, critR: 0.20, critM: 2.20 },
};

const LEGEND_EFFECTS = {
  weapon: ['攻擊時有15%機率觸發連擊', '每次暴擊回復1費', '擊殺敵人後攻擊力+5%（最多5層）'],
  armor:  ['受傷後2秒內無法被暴擊', '每10秒自動回復5%HP', 'HP≤20%時獲得50%減傷'],
  accA:   ['影遁/衝刺後必定暴擊', '費用滿時攻擊力+30%', '元素連鎖觸發時回復2費'],
  accB:   ['對BOSS傷害額外+25%', '技能命中後移速+20% 3s', '每局開始額外獲得1張傳說卡'],
};

function rollLegendEffect(slot) {
  const pool = LEGEND_EFFECTS[slot] || LEGEND_EFFECTS.accB;
  return pool[Math.floor(Math.random() * pool.length)];
}

window.__EquipFns = { applyEnhance, generateBossDrop, applyEquipmentStats };
export { SLOT_NAMES, BASE_STATS };
