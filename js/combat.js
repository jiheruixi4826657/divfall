/**
 * combat.js
 * 傷害計算、技能效果、Hit Stop、浮動數字
 *
 * 【教學】傷害公式：
 *  最終傷害 = (攻擊力 × 技能倍率 - 敵人防禦×0.5) × 屬性倍率 × 暴擊倍率
 *  最低保底 = 攻擊力 × 技能倍率 × 0.1
 */

import { Game, pauseGame, resumeGame, worldToScreen } from './game.js';
import { playSFX } from './bgm.js';

// ════════════════════════════════════════
// 屬性傷害倍率表
// ════════════════════════════════════════
// [攻擊屬性][防禦屬性] = 倍率
const ELEMENT_TABLE = {
  '火':  { '火':0.7, '冰':1.2, '雷':0.8, '木':0.8, '土':1.2, '光':1.0, '暗':1.0, '物理':1.2, '魔法':1.0 },
  '冰':  { '火':0.8, '冰':0.7, '雷':1.2, '木':1.2, '土':0.8, '光':1.0, '暗':1.0, '物理':1.2, '魔法':1.0 },
  '雷':  { '火':1.2, '冰':0.8, '雷':0.7, '木':0.8, '土':1.2, '光':1.0, '暗':1.0, '物理':1.2, '魔法':1.0 },
  '木':  { '火':1.2, '冰':0.8, '雷':0.8, '木':0.7, '土':0.8, '光':1.0, '暗':1.0, '物理':1.2, '魔法':1.0 },
  '土':  { '火':0.8, '冰':1.2, '雷':0.8, '木':1.2, '土':0.7, '光':1.0, '暗':1.0, '物理':1.2, '魔法':1.0 },
  '光':  { '火':1.0, '冰':1.0, '雷':1.0, '木':1.0, '土':1.0, '光':0.7, '暗':1.2, '物理':1.2, '魔法':1.0 },
  '暗':  { '火':1.0, '冰':1.0, '雷':1.0, '木':1.0, '土':1.0, '光':1.2, '暗':0.7, '物理':1.2, '魔法':1.0 },
  '物理':{ '火':1.0, '冰':1.0, '雷':1.0, '木':1.0, '土':1.0, '光':1.0, '暗':1.0, '物理':1.0, '魔法':1.2 },
  '魔法':{ '火':1.0, '冰':1.0, '雷':1.0, '木':1.0, '土':1.0, '光':1.0, '暗':1.0, '物理':1.2, '魔法':0.7 },
};

function getElementMult(atkEl, defEl) {
  return ELEMENT_TABLE[atkEl]?.[defEl] ?? 1.0;
}

// ════════════════════════════════════════
// 核心傷害計算
// ════════════════════════════════════════
export function calcDamage(player, enemy, skillMult = 1.0, atkElement = '物理') {
  const rawDmg  = player.atk * skillMult;
  const reduced = Math.max(rawDmg * 0.1, rawDmg - (enemy.def || 0) * 0.5);
  const elemMul = getElementMult(atkElement, enemy.element);

  // 暴擊判定
  const isCrit  = Math.random() < player.critR;
  const critMul = isCrit ? player.critM : 1.0;

  const final   = Math.floor(reduced * elemMul * critMul);
  return { damage: final, isCrit, elemMult: elemMul };
}

// ════════════════════════════════════════
// 普通攻擊（點擊目標位置，打最近的敵人）
// ════════════════════════════════════════
export function performAttack(player, enemies, targetX, targetY) {
  const nearest = findNearestEnemy(enemies, targetX, targetY, 220);
  if (!nearest) return;

  // 面向目標
  const sd = (nearest.x - player.x) - (nearest.y - player.y);
  if (Math.abs(sd) > 0.01) player.facing = Math.sign(sd);

  const { damage, isCrit } = calcDamage(player, nearest, 1.0, getPlayerElement(player.cls));
  applyDamage(nearest, damage, isCrit);
  playSFX(isCrit ? 'crit' : 'hit_light');
}

// ════════════════════════════════════════
// 技能觸發
// ════════════════════════════════════════
export function performSkill(player, skillKey, enemies) {
  if (Game.state === 'paused') return;

  const skillDef = getSkillDef(player.cls, skillKey);
  if (!skillDef) return;

  // 費用檢查（不足時給個提示，不要靜默無反應）
  if (player.cost < skillDef.cost) {
    const s = worldToScreen(player.x, player.y);
    showDamageNumber(s.x, s.y - 80, '費用不足', false, false);
    return;
  }
  player.cost -= skillDef.cost;
  window.__GameFns?.updateHUD();

  // 每次施法都在腳下閃一下，讓技能「看得見」
  spawnEffect(player.x, player.y, 55, skillDef.color || '#ffffff', 0.25);

  // 依技能類型執行
  switch (skillDef.type) {
    case 'single': {
      const target = findNearestEnemy(enemies, player.x, player.y, 320);
      if (!target) break;
      const { damage, isCrit } = calcDamage(player, target, skillDef.mult, skillDef.element);
      applyDamage(target, damage, isCrit);
      spawnEffect(target.x, target.y, 50, skillDef.color || '#fff', 0.3);
      hitStop(0.05);
      playSFX('hit_medium');
      break;
    }
    case 'aoe': {
      enemies.forEach(enemy => {
        const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
        if (dist > skillDef.range) return;
        const { damage, isCrit } = calcDamage(player, enemy, skillDef.mult, skillDef.element);
        applyDamage(enemy, damage, isCrit);
      });
      hitStop(0.1);
      playSFX('hit_heavy');
      spawnEffect(player.x, player.y, skillDef.range, skillDef.color || '#fff');
      break;
    }
    case 'dash': {
      // 向最近敵人衝刺
      const target = findNearestEnemy(enemies, player.x, player.y, 500);
      if (target) {
        const dx = target.x - player.x;
        const dy = target.y - player.y;
        const dist = Math.hypot(dx, dy);
        player.x += (dx / dist) * Math.min(dist - 60, 200);
        player.y += (dy / dist) * Math.min(dist - 60, 200);
        const { damage, isCrit } = calcDamage(player, target, skillDef.mult, skillDef.element);
        applyDamage(target, damage, isCrit);
      }
      playSFX('hit_medium');
      hitStop(0.05);
      break;
    }
    case 'heal': {
      const amount = player.maxHP * (skillDef.healPct || 0.1);
      player.heal(amount);
      const hs = worldToScreen(player.x, player.y);
      showDamageNumber(hs.x, hs.y - 70, `+${Math.floor(amount)}`, false, true);
      break;
    }
    case 'burst': {
      // 爆發技能：全場AOE
      enemies.forEach(enemy => {
        const { damage, isCrit } = calcDamage(player, enemy, skillDef.mult, skillDef.element);
        applyDamage(enemy, damage, isCrit);
      });
      hitStop(0.1);
      playSFX('hit_heavy');
      spawnEffect(player.x, player.y, 400, skillDef.color || '#EF9F27', 0.5);
      break;
    }
  }
}

// ════════════════════════════════════════
// 傷害套用
// ════════════════════════════════════════
function applyDamage(enemy, damage, isCrit) {
  enemy.takeDamage(damage);
  // enemy.x/y 是世界座標 → 投影成螢幕座標再顯示
  const s = worldToScreen(enemy.x, enemy.y);
  showDamageNumber(s.x, s.y - enemy.h - 24, damage, isCrit);
}

// ════════════════════════════════════════
// 浮動傷害數字（傳入的是螢幕座標）
// ════════════════════════════════════════
export function showDamageNumber(x, y, value, isCrit = false, isHeal = false) {
  const el = document.createElement('div');
  el.className = `dmg-float ${isCrit ? 'crit' : isHeal ? 'heal' : 'normal'}`;
  el.textContent = isCrit ? `${value}!` : String(value);
  el.style.left = `${x}px`;
  el.style.top  = `${y}px`;
  document.body.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

// ════════════════════════════════════════
// Hit Stop（畫面頓停）
// ════════════════════════════════════════
export function hitStop(duration) {
  // 用 Game.freeze 做時間式頓停，避免與「卡牌選擇暫停」搶 Game.state
  Game.freeze = Math.max(Game.freeze || 0, duration);
}

// ════════════════════════════════════════
// 特效生成
// ════════════════════════════════════════
function spawnEffect(x, y, r, color, life = 0.3) {
  Game.effects.push({ x, y, r, color, life });
}

// ════════════════════════════════════════
// 工具：尋找最近敵人
// ════════════════════════════════════════
function findNearestEnemy(enemies, x, y, maxDist) {
  let nearest = null;
  let minDist = maxDist;
  enemies.forEach(e => {
    if (!e.alive) return;
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < minDist) { minDist = d; nearest = e; }
  });
  return nearest;
}

// ── 各職業主要屬性 ──
function getPlayerElement(cls) {
  return { varek: '物理', lyra: '火', kael: '暗' }[cls] || '物理';
}

// ════════════════════════════════════════
// 技能定義表（對應技能鍵 q/w/e/r/space）
// ════════════════════════════════════════
const SKILL_DEFS = {
  varek: {
    q:     { name: '聖光突刺',   cost: 1, mult: 1.5, element: '光',  type: 'single', color: '#EFD27A' },
    w:     { name: '神聖護盾',   cost: 2, mult: 0,   element: '光',  type: 'heal', healPct: 0.08 },
    e:     { name: '落裂斬',     cost: 2, mult: 2.2, element: '物理',type: 'aoe',  range: 150, color: '#EFD27A' },
    r:     { name: '斷神斬',     cost: 4, mult: 3.5, element: '光',  type: 'burst',color: '#ffffff' },
    space: { name: '聖騎衝鋒',   cost: 1, mult: 1.2, element: '物理',type: 'dash' },
  },
  lyra: {
    q:     { name: '火焰彈幕',   cost: 1, mult: 1.2, element: '火',  type: 'single', color: '#ff6a00' },
    w:     { name: '冰錐術',     cost: 1, mult: 1.3, element: '冰',  type: 'single', color: '#7af0ef' },
    e:     { name: '雷擊術',     cost: 2, mult: 1.8, element: '雷',  type: 'aoe',  range: 180, color: '#f0f060' },
    r:     { name: '五行崩解',   cost: 5, mult: 4.0, element: '火',  type: 'burst',color: '#ff8800' },
    space: { name: '術式位移',   cost: 1, mult: 0,   element: '無',  type: 'dash' },
  },
  kael: {
    q:     { name: '暗影斬',     cost: 1, mult: 1.4, element: '暗',  type: 'single', color: '#b07aef' },
    w:     { name: '標記術',     cost: 1, mult: 0.8, element: '暗',  type: 'single', color: '#7a00b0' },
    e:     { name: '影遁刺殺',   cost: 2, mult: 2.5, element: '暗',  type: 'dash' },
    r:     { name: '暗殺爆發',   cost: 4, mult: 3.8, element: '魔法',type: 'burst',color: '#6a00b0' },
    space: { name: '影遁',       cost: 1, mult: 0,   element: '暗',  type: 'dash' },
  },
};

function getSkillDef(cls, key) {
  return SKILL_DEFS[cls]?.[key] || null;
}

export { getElementMult, ELEMENT_TABLE };
