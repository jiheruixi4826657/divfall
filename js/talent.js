/**
 * talent.js
 * 天賦樹系統：15節點 × 3職業，永久保留
 *
 * 【教學】天賦 vs 技能的差異：
 *  技能點 → 每次跑圖升等獲得，死亡清空
 *  天賦點 → 殺BOSS/通關章節獲得，永久保留，跨局持續強化角色
 */

import { unlockTalent } from './data.js';
import { playSFX } from './bgm.js';

// ════════════════════════════════════════
// 天賦節點定義（每職業15節點）
// ════════════════════════════════════════
export const TALENT_TREES = {

  varek: [
    { id: 'T1',  name: '騎士血脈',   cost: 1, effect: { maxHP: 0.05 },         desc: '最大HP +5%',             row: 0 },
    { id: 'T2',  name: '重甲精通',   cost: 1, effect: { def: 0.08 },           desc: '護甲防禦 +8%',           row: 0 },
    { id: 'T3',  name: '聖怒積累',   cost: 2, effect: { holyRageGain: 0.20 },  desc: '聖怒值獲取速度 +20%',    row: 1, requires: ['T1'] },
    { id: 'T4',  name: '光芒祝福',   cost: 1, effect: { lightDmg: 0.10 },      desc: '光屬傷害 +10%',          row: 1 },
    { id: 'T5',  name: '暗影意志',   cost: 1, effect: { darkDmg: 0.10 },       desc: '暗屬傷害 +10%',          row: 1 },
    { id: 'T6',  name: '格擋大師',   cost: 2, effect: { parryWindow: 0.05 },   desc: '完美格擋窗口 +0.05s',    row: 1, requires: ['T2'] },
    { id: 'T7',  name: '破甲專家',   cost: 2, effect: { armorPen: 0.15 },      desc: '攻擊忽略敵人15%防禦',    row: 2, requires: ['T4'] },
    { id: 'T8',  name: '神聖恢復',   cost: 2, effect: { parryHeal: 0.03 },     desc: '完美格擋後回HP 3%',      row: 2, requires: ['T6'] },
    { id: 'T9',  name: '鐵血戰士',   cost: 1, effect: { critR: 0.05 },         desc: '暴擊率 +5%',             row: 2 },
    { id: 'T10', name: '斷神傳承',   cost: 2, effect: { burstCDR: 0.20 },      desc: '斷神斬冷卻 -20%',        row: 2, requires: ['T3'] },
    { id: 'T11', name: '封印者',     cost: 2, effect: { bossDmg: 0.08 },       desc: '對BOSS傷害 +8%',         row: 3, requires: ['T7'] },
    { id: 'T12', name: '戰場掌控',   cost: 2, effect: { knockdownSlow: true }, desc: '擊倒敵人時範圍減速',     row: 3, requires: ['T9'] },
    { id: 'T13', name: '復仇意志',   cost: 3, effect: { deathStack: true },    desc: '每死亡1次永久攻+2%（最多10層）', row: 3, requires: ['T10'] },
    { id: 'T14', name: '神聖壓制',   cost: 2, effect: { lightStun: 0.15 },     desc: '光屬攻擊有15%機率眩暈0.5s',  row: 3, requires: ['T8'] },
    { id: 'T15', name: '斷神覺醒',   cost: 3, effect: { burstInvincible: 3 }, desc: '聖怒爆發時獲得3s無敵',   row: 4, requires: ['T11', 'T13'] },
  ],

  lyra: [
    { id: 'T1',  name: '元素親和',   cost: 1, effect: { allElemDmg: 0.05 },    desc: '所有元素傷害 +5%',       row: 0 },
    { id: 'T2',  name: '魔法精研',   cost: 1, effect: { costReduce: 0.5 },     desc: '技能費用平均 -0.5',      row: 0 },
    { id: 'T3',  name: '連鎖天賦',   cost: 2, effect: { chainChance: 0.15 },   desc: '元素連鎖觸發機率 +15%',  row: 1, requires: ['T1'] },
    { id: 'T4',  name: '火焰掌控',   cost: 1, effect: { fireDmg: 0.12 },       desc: '火屬傷害 +12%',          row: 1 },
    { id: 'T5',  name: '冰霜精通',   cost: 1, effect: { freezeDur: 1.0 },      desc: '冰凍持續 +1s',           row: 1 },
    { id: 'T6',  name: '術式加速',   cost: 2, effect: { skillCDR: 0.15 },      desc: '技能冷卻 -15%',          row: 1, requires: ['T2'] },
    { id: 'T7',  name: '雷電之眼',   cost: 2, effect: { lightningCrit: 0.10 }, desc: '雷屬暴擊 +10%',          row: 2, requires: ['T4'] },
    { id: 'T8',  name: '法力汲取',   cost: 2, effect: { killCostGain: 1 },     desc: '擊殺敵人回復1費',        row: 2, requires: ['T6'] },
    { id: 'T9',  name: '元素爆炸',   cost: 2, effect: { chainRange: 0.30 },    desc: '元素連鎖範圍 +30%',      row: 2, requires: ['T3'] },
    { id: 'T10', name: '魔法穿透',   cost: 2, effect: { magicPen: 0.20 },      desc: '技能忽略20%魔法防禦',    row: 2, requires: ['T5'] },
    { id: 'T11', name: '自然之力',   cost: 1, effect: { earthWoodDmg: 0.12 },  desc: '木/土傷害 +12%',         row: 2 },
    { id: 'T12', name: '五行循環',   cost: 3, effect: { cycleBuff: 0.10 },     desc: '完成一次元素循環後下輪傷害+10%', row: 3, requires: ['T9'] },
    { id: 'T13', name: '崩解強化',   cost: 2, effect: { collapseBonus: 0.50 }, desc: '元素崩解額外 +50%',      row: 3, requires: ['T10', 'T11'] },
    { id: 'T14', name: '術式大師',   cost: 2, effect: { noDecay: true },       desc: '同一技能連續施放不衰減', row: 3, requires: ['T8'] },
    { id: 'T15', name: '神殞術式',   cost: 3, effect: { awakeDur: 3 },         desc: '五行覺醒持續時間 +3s',   row: 4, requires: ['T12', 'T13'] },
  ],

  kael: [
    { id: 'T1',  name: '暗影精通',   cost: 1, effect: { darkDmg: 0.10 },       desc: '暗屬傷害 +10%',          row: 0 },
    { id: 'T2',  name: '刺殺本能',   cost: 1, effect: { critR: 0.08 },         desc: '暴擊率 +8%',             row: 0 },
    { id: 'T3',  name: '標記大師',   cost: 2, effect: { markExpDmg: 0.25 },    desc: '暗殺標記爆發傷害 +25%',  row: 1, requires: ['T1'] },
    { id: 'T4',  name: '影遁強化',   cost: 2, effect: { blink: 1 },            desc: '影遁次數 +1（每場景）',  row: 1, requires: ['T2'] },
    { id: 'T5',  name: '物理強化',   cost: 1, effect: { physDmg: 0.10 },       desc: '物理攻擊 +10%',          row: 1 },
    { id: 'T6',  name: '魔力汲取',   cost: 2, effect: { magicEnemyDmg: 0.15 }, desc: '對魔法敵人傷害 +15%',    row: 1 },
    { id: 'T7',  name: '影子網絡',   cost: 2, effect: { decoyDur: 3 },         desc: '分身持續時間 +3s',       row: 2, requires: ['T4'] },
    { id: 'T8',  name: '致命暗殺',   cost: 2, effect: { backStrikeCrit: true },$desc: '背刺必定暴擊',          row: 2, requires: ['T3'] },
    { id: 'T9',  name: '速度狂魔',   cost: 1, effect: { speed: 0.15 },         desc: '速度 +15%',              row: 2, requires: ['T5'] },
    { id: 'T10', name: '魔法剝奪',   cost: 2, effect: { silenceChance: 0.20 }, desc: '攻擊有20%機率封印敵人技能2s', row: 2, requires: ['T6'] },
    { id: 'T11', name: '暗影不死',   cost: 3, effect: { nearDeathBlink: true },$desc: 'HP≤10%時自動影遁並回HP 20%', row: 3, requires: ['T7'] },
    { id: 'T12', name: '連鎖標記',   cost: 2, effect: { blinkMark: 3 },        desc: '每次影遁自動施加3層標記',row: 3, requires: ['T8'] },
    { id: 'T13', name: '黑暗契約',   cost: 2, effect: { darkContract: true },  desc: '每局開始暴擊倍率+50%但HP-10%', row: 3, requires: ['T9'] },
    { id: 'T14', name: '深淵領域',   cost: 2, effect: { domainDur: 2 },        desc: '影域展開持續 +2s',       row: 3, requires: ['T10'] },
    { id: 'T15', name: '神殞暗刃',   cost: 3, effect: { postBlinkDark: 5 },    desc: '影遁後5s內所有攻擊+100%暗屬傷害', row: 4, requires: ['T11', 'T12'] },
  ],
};

// ════════════════════════════════════════
// 天賦加成套用到玩家（開局時呼叫）
// ════════════════════════════════════════
export function applyTalents(player, talentData) {
  const tree = TALENT_TREES[player.cls];
  if (!tree || !talentData) return;

  tree.forEach(node => {
    if (!talentData[node.id]) return;
    const fx = node.effect;

    if (fx.maxHP)       player.maxHP    = Math.floor(player.maxHP * (1 + fx.maxHP));
    if (fx.def)         player.def      = Math.floor(player.def   * (1 + fx.def));
    if (fx.critR)       player.critR    = Math.min(0.90, player.critR + fx.critR);
    if (fx.critM)       player.critM   += fx.critM;
    if (fx.speed)       player.speed   *= (1 + fx.speed);
    if (fx.allElemDmg)  player._allElemBonus = (player._allElemBonus || 0) + fx.allElemDmg;
    if (fx.fireDmg)     player._fireBonus    = (player._fireBonus    || 0) + fx.fireDmg;
    if (fx.darkDmg)     player._darkBonus    = (player._darkBonus    || 0) + fx.darkDmg;
    if (fx.lightDmg)    player._lightBonus   = (player._lightBonus   || 0) + fx.lightDmg;
    if (fx.physDmg)     player._physBonus    = (player._physBonus    || 0) + fx.physDmg;
    if (fx.bossDmg)     player._bossBonus    = (player._bossBonus    || 0) + fx.bossDmg;
    if (fx.armorPen)    player._armorPen     = (player._armorPen     || 0) + fx.armorPen;
  });

  // 確保 HP 不超過新上限
  player.hp = Math.min(player.hp, player.maxHP);
}

// ════════════════════════════════════════
// 天賦樹 UI 渲染
// ════════════════════════════════════════
export function renderTalentTree(cls, unlockedNodes, totalPts, onUnlock) {
  const overlay = document.getElementById('talent-overlay');
  if (!overlay) return;

  const tree = TALENT_TREES[cls];
  if (!tree) return;

  // 按行分組
  const rows = {};
  tree.forEach(n => { (rows[n.row] = rows[n.row] || []).push(n); });

  overlay.innerHTML = `
    <div class="talent-header">
      <h2>${CLS_NAME[cls]} 天賦樹</h2>
      <span class="talent-pts">⭐ 剩餘天賦點：<strong>${totalPts}</strong></span>
      <button id="talent-close" class="btn-secondary btn-small">關閉</button>
    </div>
    <div class="talent-grid">
      ${Object.entries(rows).map(([row, nodes]) => `
        <div class="talent-row">
          ${nodes.map(node => {
            const unlocked  = !!unlockedNodes[node.id];
            const canUnlock = !unlocked && totalPts >= node.cost
              && (!node.requires || node.requires.every(r => unlockedNodes[r]));

            return `<div class="talent-node ${unlocked ? 'unlocked' : ''} ${canUnlock ? 'can-unlock' : 'locked'}"
                      data-id="${node.id}" data-cost="${node.cost}">
              <div class="talent-name">${node.name}</div>
              <div class="talent-desc">${node.desc}</div>
              <div class="talent-cost">${unlocked ? '✓' : `⭐ ${node.cost}`}</div>
              ${node.requires?.length ? `<div class="talent-req">需要：${node.requires.join(', ')}</div>` : ''}
            </div>`;
          }).join('')}
        </div>
      `).join('')}
    </div>
  `;

  overlay.classList.remove('hidden');

  // 解鎖按鈕事件
  overlay.querySelectorAll('.talent-node.can-unlock').forEach(el => {
    el.addEventListener('click', async () => {
      const id   = el.dataset.id;
      const cost = parseInt(el.dataset.cost);
      try {
        await unlockTalent(cls, id);
        playSFX('level_up');
        onUnlock?.();
      } catch (e) {
        alert(e.message);
      }
    });
  });

  overlay.querySelector('#talent-close')?.addEventListener('click', () => {
    overlay.classList.add('hidden');
  });
}

const CLS_NAME = { varek: 'VAREK 斷神騎', lyra: 'LYRA 術式者', kael: 'KAEL 影刃者' };
