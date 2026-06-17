/**
 * cards.js
 * 卡牌資料庫、三選一介面、費用系統
 *
 * 【教學】Roguelite 卡牌流程：
 *  每關清完 → showCardChoice() 被呼叫
 *  → 從卡牌池隨機抽3張 → 玩家點選 → 加入當前牌組
 *  → 死亡時牌組清空，但解鎖的卡牌包永遠保留
 */

import { Game } from './game.js';

// ════════════════════════════════════════
// 完整卡牌資料庫（每職業30張）
// ════════════════════════════════════════
export const CARD_DB = {

  // ── VAREK 斷神騎 ──
  varek: [
    { id:'v01', name:'聖劍一擊',   cost:1, type:'攻擊', mult:1.2, element:'物理', desc:'物理攻擊，造成 120% 傷害。' },
    { id:'v02', name:'護盾猛撞',   cost:2, type:'攻擊', mult:1.4, element:'物理', desc:'撞擊敵人並充能格擋條。' },
    { id:'v03', name:'光明突刺',   cost:1, type:'攻擊', mult:1.3, element:'光',   desc:'光屬穿刺攻擊。' },
    { id:'v04', name:'黑暗波刃',   cost:2, type:'攻擊', mult:1.5, element:'暗',   desc:'扇形暗屬斬擊。' },
    { id:'v05', name:'審判之光',   cost:3, type:'攻擊', mult:2.2, element:'光',   desc:'大範圍光屬爆炸。', aoe:true, range:200 },
    { id:'v06', name:'暗影斬',     cost:2, type:'攻擊', mult:2.0, element:'暗',   desc:'暗屬單體高傷。' },
    { id:'v07', name:'鐵壁防禦',   cost:0, type:'防禦', effect:'next_reduce', desc:'下次受傷減少 50%。' },
    { id:'v08', name:'聖光庇護',   cost:2, type:'防禦', shield:300, desc:'獲得護盾值 300。' },
    { id:'v09', name:'完美反制',   cost:1, type:'特殊', effect:'next_parry', desc:'下次攻擊視為完美格擋，反擊+50%。' },
    { id:'v10', name:'衝鋒踐踏',   cost:2, type:'攻擊', mult:1.6, element:'物理', desc:'衝刺攻擊，敵人倒地 2s。', dash:true },
    { id:'v11', name:'落裂斬術',   cost:3, type:'攻擊', mult:2.0, element:'物理', desc:'跳躍下砸，全場暈眩。', aoe:true, range:250 },
    { id:'v12', name:'聖怒爆發',   cost:4, type:'爆發', mult:3.5, element:'光',   desc:'消耗聖怒，造成全場 350% 傷害。', aoe:true, range:999 },
    { id:'v13', name:'黑暗吸收',   cost:2, type:'防禦', effect:'dark_absorb', desc:'吸收暗屬能量，回復 8% HP。' },
    { id:'v14', name:'光輝連擊',   cost:2, type:'攻擊', mult:0.9, element:'光',   desc:'連續 3 次光屬攻擊。', hits:3 },
    { id:'v15', name:'神聖波動',   cost:3, type:'特殊', effect:'holy_wave', desc:'聖光環繞，持續傷害 4s。' },
    { id:'v16', name:'裂甲打擊',   cost:2, type:'減益', mult:1.0, element:'物理', desc:'降低敵人防禦 30%，持續 6s。' },
    { id:'v17', name:'戰場分析',   cost:0, type:'抽牌', draw:2,   desc:'摸 2 張牌。' },
    { id:'v18', name:'騎士誓言',   cost:1, type:'特殊', effect:'cost_reduce', desc:'下一張卡費用 -2（最低 0）。' },
    { id:'v19', name:'光暗共鳴',   cost:3, type:'爆發', mult:2.8, element:'光',   desc:'光+暗雙屬性爆發。', aoe:true, range:180 },
    { id:'v20', name:'重甲衝刺',   cost:1, type:'移動', effect:'dash_guard', desc:'衝刺，2s 內受傷減少 50%。', dash:true },
    { id:'v21', name:'聖光祝福',   cost:2, type:'輔助', effect:'team_heal', desc:'隊友 HP 回復 5%，光屬 buff 10s。' },
    { id:'v22', name:'裁決之刃',   cost:4, type:'攻擊', mult:2.5, element:'光',   desc:'對 BOSS 額外 +50% 傷害。' },
    { id:'v23', name:'暗影殘影',   cost:2, type:'特殊', effect:'decoy', desc:'留下殘影 5s，吸引仇恨。' },
    { id:'v24', name:'鐵血不屈',   cost:1, type:'特殊', effect:'low_hp_boost', desc:'HP≤30% 時，攻擊力 +80%。' },
    { id:'v25', name:'格擋連擊',   cost:1, type:'攻擊', mult:1.0, element:'物理', desc:'格擋後立即反擊 2 次。', hits:2 },
    { id:'v26', name:'聖域維持',   cost:2, type:'防禦', effect:'stance_guard', desc:'原地不動時，防禦 +100%。' },
    { id:'v27', name:'斷神意志',   cost:3, type:'特殊', effect:'free_3', desc:'下 3 次技能不消耗費用。' },
    { id:'v28', name:'神罰斬',     cost:5, type:'爆發', mult:4.5, element:'光',   desc:'終極爆發，全場大傷。', aoe:true, range:999 },
    { id:'v29', name:'暗黑結界',   cost:3, type:'防禦', shield:500, element:'暗', desc:'暗屬護盾 500，吸收後反傷。' },
    { id:'v30', name:'神殞衝擊',   cost:6, type:'爆發', mult:5.0, element:'物理', desc:'最強攻擊，擊退所有敵人。', aoe:true, range:999 },
  ],

  // ── LYRA 術式者 ──
  lyra: [
    { id:'l01', name:'火焰彈幕',   cost:1, type:'攻擊', mult:1.2, element:'火', desc:'連發 3 個火球。', hits:3 },
    { id:'l02', name:'冰牆屏障',   cost:2, type:'攻擊', mult:1.4, element:'冰', desc:'前方冰牆，阻擋+傷害。', aoe:true, range:100 },
    { id:'l03', name:'閃電鏈',     cost:2, type:'攻擊', mult:1.6, element:'雷', desc:'跳躍傷害，最多 3 目標。', chain:3 },
    { id:'l04', name:'林中藤縛',   cost:2, type:'控制', mult:0.8, element:'木', desc:'木屬範圍控制，綁住 3s。', aoe:true, range:150 },
    { id:'l05', name:'大地震顫',   cost:3, type:'攻擊', mult:1.8, element:'土', desc:'土屬全場暈眩 2s。', aoe:true, range:999 },
    { id:'l06', name:'元素爆心',   cost:3, type:'攻擊', mult:2.5, element:'火', desc:'選定點元素爆炸。', aoe:true, range:200 },
    { id:'l07', name:'火海灼燒',   cost:3, type:'攻擊', mult:0.5, element:'火', desc:'大範圍火焰地板，持續 5s。', aoe:true, range:250 },
    { id:'l08', name:'極寒之息',   cost:2, type:'攻擊', mult:1.5, element:'冰', desc:'冰屬錐形，凍結 2s。', cone:true },
    { id:'l09', name:'雷霆審判',   cost:4, type:'攻擊', mult:3.0, element:'雷', desc:'強力單體雷屬。' },
    { id:'l10', name:'木精共鳴',   cost:2, type:'輔助', element:'木', effect:'team_heal', desc:'木屬，隊友回復 8% HP。' },
    { id:'l11', name:'土崩術',     cost:2, type:'攻擊', mult:1.4, element:'土', desc:'土屬落石雨。', aoe:true, range:180 },
    { id:'l12', name:'五行循環',   cost:0, type:'抽牌', draw:5,   desc:'各摸一張五行屬性卡。' },
    { id:'l13', name:'法力充能',   cost:0, type:'特殊', costGain:3, desc:'回復 3 費。' },
    { id:'l14', name:'術式延長',   cost:1, type:'特殊', effect:'extend', desc:'當前所有效果延長 2s。' },
    { id:'l15', name:'元素屏蔽',   cost:2, type:'防禦', effect:'next_immune', desc:'免疫下次傷害。' },
    { id:'l16', name:'連鎖引爆',   cost:3, type:'特殊', effect:'force_chain', desc:'強制觸發元素連鎖爆炸。' },
    { id:'l17', name:'寒冰時停',   cost:4, type:'控制', element:'冰', desc:'凍結場內所有普通敵人 4s。' },
    { id:'l18', name:'燎原之火',   cost:4, type:'攻擊', mult:0.6, element:'火', desc:'全場火屬持續傷害 6s。', aoe:true, range:999 },
    { id:'l19', name:'雷網佈陣',   cost:3, type:'攻擊', mult:2.0, element:'雷', desc:'電網陷阱，踩中觸發。' },
    { id:'l20', name:'木系治癒',   cost:2, type:'輔助', element:'木', effect:'full_team_heal', desc:'全隊回復 12% HP。' },
    { id:'l21', name:'土石防禦',   cost:2, type:'防禦', defBuff:0.3, desc:'土屬護甲，減傷 30%，持續 8s。' },
    { id:'l22', name:'術式鏡像',   cost:3, type:'特殊', effect:'mirror', desc:'複製上一張卡的效果。' },
    { id:'l23', name:'冰雷共鳴',   cost:3, type:'攻擊', mult:2.8, element:'冰', desc:'冰+雷連鎖加強爆炸。', aoe:true, range:200 },
    { id:'l24', name:'大地之母',   cost:4, type:'攻擊', mult:3.2, element:'土', desc:'土木雙系共鳴爆炸。', aoe:true, range:220 },
    { id:'l25', name:'焰炎傳導',   cost:2, type:'攻擊', mult:1.2, element:'火', desc:'火屬，傳染灼傷給相鄰敵人。' },
    { id:'l26', name:'元素奔流',   cost:2, type:'特殊', costGain:3, desc:'本回合費用 +3。' },
    { id:'l27', name:'術式頓悟',   cost:1, type:'特殊', effect:'next_free', desc:'下張牌費用變為 0。' },
    { id:'l28', name:'崩解之星',   cost:5, type:'爆發', mult:5.0, element:'火', desc:'三屬性融合，超級爆發。', aoe:true, range:999 },
    { id:'l29', name:'五行封印',   cost:4, type:'控制', desc:'封印敵人 10s（BOSS 僅 3s）。' },
    { id:'l30', name:'神殞術式',   cost:6, type:'爆發', mult:6.0, element:'火', desc:'終極：連鎖全屬性崩解。', aoe:true, range:999 },
  ],

  // ── KAEL 影刃者 ──
  kael: [
    { id:'k01', name:'暗影斬',     cost:1, type:'攻擊', mult:1.4, element:'暗',   desc:'暗屬快速攻擊。' },
    { id:'k02', name:'魔力爆發',   cost:2, type:'攻擊', mult:1.8, element:'魔法', desc:'魔法屬性爆炸。', aoe:true, range:150 },
    { id:'k03', name:'影刃連擊',   cost:2, type:'攻擊', mult:0.7, element:'物理', desc:'連續 5 次物理攻擊。', hits:5 },
    { id:'k04', name:'致命一擊',   cost:3, type:'攻擊', mult:3.0, element:'暗',   desc:'必定暴擊的強力攻擊。', forceCrit:true },
    { id:'k05', name:'暗殺契機',   cost:1, type:'特殊', markAdd:3, desc:'暗殺標記 +3 層。' },
    { id:'k06', name:'影遁刺殺',   cost:3, type:'攻擊', mult:2.5, element:'暗',   desc:'影遁至背後，背刺 +200%。', dash:true, backStrike:true },
    { id:'k07', name:'魔法吸收',   cost:2, type:'防禦', effect:'magic_absorb', desc:'吸收魔法傷害轉為攻擊力。' },
    { id:'k08', name:'暗影分裂',   cost:2, type:'特殊', decoyCount:3, desc:'分裂為 3 個分身 5s。' },
    { id:'k09', name:'鎖鏈突刺',   cost:2, type:'攻擊', mult:1.5, element:'物理', desc:'物理穿刺，固定目標 2s。' },
    { id:'k10', name:'破甲重擊',   cost:2, type:'攻擊', mult:1.6, element:'物理', desc:'忽略 30% 護甲。', armorPen:0.3 },
    { id:'k11', name:'出血斬',     cost:1, type:'攻擊', mult:0.8, element:'物理', desc:'物理持續出血 5s。', bleed:true },
    { id:'k12', name:'刺客狂影',   cost:3, type:'特殊', effect:'frenzy', desc:'超速連擊模式 3s。' },
    { id:'k13', name:'暗殺衝刺',   cost:2, type:'攻擊', mult:1.2, element:'暗',   desc:'衝向目標，強制施加 3 標記。', dash:true, markAdd:3 },
    { id:'k14', name:'魔法侵蝕',   cost:2, type:'減益', element:'魔法', desc:'降低魔防 +魔法傷害 buff。' },
    { id:'k15', name:'影域陷阱',   cost:3, type:'攻擊', mult:2.2, element:'暗',   desc:'暗屬陷阱，觸碰爆發。' },
    { id:'k16', name:'靈魂汲取',   cost:2, type:'攻擊', mult:1.4, element:'暗',   desc:'吸 HP，暗屬攻擊。', lifeSteal:0.3 },
    { id:'k17', name:'消失術',     cost:1, type:'特殊', effect:'stealth', desc:'短暫隱身，下次必暴擊。' },
    { id:'k18', name:'暗夜奔行',   cost:1, type:'移動', speedBuff:0.8, duration:3, desc:'移速 +80% 持續 3s。' },
    { id:'k19', name:'魔力震波',   cost:3, type:'攻擊', mult:2.4, element:'魔法', desc:'魔法屬性衝擊波。', aoe:true, range:200 },
    { id:'k20', name:'標記爆炸',   cost:4, type:'爆發', effect:'mark_explode', desc:'所有標記層同時爆炸，每層 80% 傷害。' },
    { id:'k21', name:'影子護盾',   cost:2, type:'防禦', shield:250, element:'暗', desc:'暗屬護盾 250，受傷後反傷 50%。' },
    { id:'k22', name:'混沌之刃',   cost:3, type:'攻擊', mult:2.0, element:'暗',   desc:'物理+魔法+暗屬三合一攻擊。' },
    { id:'k23', name:'死亡凝視',   cost:2, type:'控制', element:'暗', desc:'恐懼敵人 1.5s，無法行動。' },
    { id:'k24', name:'暗殺宣告',   cost:1, type:'減益', effect:'mark_target', desc:'宣告目標，該目標受到 +50% 傷害 8s。' },
    { id:'k25', name:'影魔合一',   cost:3, type:'爆發', mult:3.2, element:'暗',   desc:'暗+魔法共鳴爆炸。', aoe:true, range:180 },
    { id:'k26', name:'深淵召喚',   cost:4, type:'特殊', effect:'summon', desc:'召喚暗屬分身輔助戰鬥。' },
    { id:'k27', name:'刺客誓言',   cost:1, type:'特殊', costReduce:3, desc:'下張卡費用 -3（最低 0）。' },
    { id:'k28', name:'末日宣判',   cost:5, type:'爆發', mult:4.5, element:'暗',   desc:'大範圍暗+魔法爆炸。', aoe:true, range:999 },
    { id:'k29', name:'影域滲透',   cost:3, type:'攻擊', mult:1.5, element:'暗',   desc:'影遁穿越所有敵人，各施加 2 標記。', dash:true, markAdd:2 },
    { id:'k30', name:'神殞暗刃',   cost:6, type:'爆發', mult:6.0, element:'暗',   desc:'終極：影遁連鎖消滅。', aoe:true, range:999 },
  ],
};

// ════════════════════════════════════════
// 當前跑圖牌組（死亡清空）
// ════════════════════════════════════════
export const RunDeck = {
  cards: [],        // 當前擁有的卡牌 id 陣列
  hand:  [],        // 當前手牌

  addCard(cardId) {
    this.cards.push(cardId);
  },

  reset() {
    this.cards = [];
    this.hand  = [];
  },

  // 重新洗牌並抽手牌
  drawHand(size = 5) {
    const shuffled = [...this.cards].sort(() => Math.random() - 0.5);
    this.hand = shuffled.slice(0, size);
    return this.hand;
  },
};

// ════════════════════════════════════════
// 三選一介面
// ════════════════════════════════════════
let _onChoiceComplete = null;

/**
 * @param {Function} onComplete  玩家選完後的回呼
 * @param {number}   poolSize    候選池大小（一般3，BOSS獎勵5）
 * @param {number}   pickCount   可選幾張（一般1，BOSS獎勵2）
 */
export function showCardChoice(onComplete, poolSize = 3, pickCount = 1) {
  _onChoiceComplete = onComplete;

  const overlay  = document.getElementById('card-overlay');
  const choices  = document.getElementById('card-choices');
  const timerBar = document.getElementById('card-timer-fill');
  const title    = document.getElementById('card-overlay-title');

  title.textContent = pickCount > 1 ? `選擇 ${pickCount} 張卡牌` : '選擇一張卡牌';

  // 從職業卡池隨機抽取
  const pool  = CARD_DB[Game.class] || [];
  const picks = shuffle([...pool]).slice(0, poolSize);

  choices.innerHTML = '';
  let picked = 0;
  let pendingCard = null;   // 目前「選中待確認」的卡牌資料

  // 確認按鈕
  const confirmBtn = document.getElementById('card-confirm-btn');
  if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.classList.remove('ready'); }

  // 確認選擇 → 真正把卡加入牌組
  const commitPending = () => {
    if (!pendingCard) return;
    const pendingEl = choices.querySelector('.card.pending');
    if (pendingEl) {
      pendingEl.classList.remove('pending');
      pendingEl.classList.add('selected');
      pendingEl.style.pointerEvents = 'none';
    }
    RunDeck.addCard(pendingCard.id);
    pendingCard = null;
    if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.classList.remove('ready'); }
    picked++;

    if (picked >= pickCount) {
      clearInterval(timerInterval);
      overlay.classList.add('hidden');
      _onChoiceComplete?.();
    }
  };

  if (confirmBtn) {
    // 移除舊事件再綁定（避免重複）
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
    newBtn.addEventListener('click', commitPending);
  }

  picks.forEach((card, idx) => {
    const el = document.createElement('div');
    el.className = 'card quality-common';
    el.dataset.cardId = card.id;
    el.style.animationDelay = `${idx * 0.08}s`;
    el.innerHTML = `
      <div class="card-cost">⚡ ${card.cost}</div>
      <div class="card-name">${card.name}</div>
      <div class="card-type">${card.type} · ${card.element || '通用'}</div>
      <div class="card-desc">${card.desc}</div>
    `;

    el.addEventListener('click', () => {
      if (el.classList.contains('selected')) return;  // 已確認，忽略

      // 第一步：標記為 pending（高亮但未確認）
      choices.querySelectorAll('.card.pending').forEach(c => c.classList.remove('pending'));
      el.classList.add('pending');
      pendingCard = card;

      // 亮起確認按鈕
      const cb = document.getElementById('card-confirm-btn');
      if (cb) { cb.disabled = false; cb.classList.add('ready'); }
    });

    choices.appendChild(el);
  });

  overlay.classList.remove('hidden');

  // 15 秒倒計時
  const totalMs = 15000;
  let elapsed   = 0;
  const interval = 200;
  const timerInterval = setInterval(() => {
    elapsed += interval;
    const pct = Math.max(0, 1 - elapsed / totalMs);
    timerBar.style.width = `${pct * 100}%`;

    if (elapsed >= totalMs) {
      clearInterval(timerInterval);
      // 逾時：若有 pending 就確認，否則自動選第一張
      if (pendingCard) {
        commitPending();
      } else {
        const first = choices.querySelector('.card:not(.selected)');
        if (first) first.click();
        setTimeout(commitPending, 50);
      }
    }
  }, interval);
}

// ════════════════════════════════════════
// 陣列洗牌（Fisher-Yates）
// ════════════════════════════════════════
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ── 依 id 取得卡牌物件 ──
export function getCardById(id) {
  for (const cls of Object.values(CARD_DB)) {
    const found = cls.find(c => c.id === id);
    if (found) return found;
  }
  return null;
}
