/**
 * data.js
 * Firestore 資料讀寫中心
 * 所有與雲端資料庫的互動都在這裡集中管理
 *
 * 【教學】Firestore 資料結構：
 *  users/{userId}/
 *    profile    → 玩家基本資訊（名稱、等級、金幣）
 *    equipment  → 裝備（持有清單 + 各職業已穿戴）
 *    cards      → 解鎖的卡牌包
 *    meta       → 天賦點數
 *    progress   → 進度（最高章節/關卡）
 *    currentRun → 當前跑圖存檔
 */

import { db, auth } from './firebase-init.js';
import {
  doc, getDoc, updateDoc, setDoc,
  arrayUnion, increment, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ── 取得當前使用者 UID（方便工具函數使用）──
function uid() {
  const user = auth.currentUser;
  if (!user) throw new Error('使用者未登入');
  return user.uid;
}

// ── 取得玩家文件參考（單一文件）──
const userDoc = () => doc(db, 'users', uid());

// ════════════════════════════════════════
// 讀取玩家完整資料（登入時使用）
// 回傳合併後的物件，方便前端直接使用
// ════════════════════════════════════════
export async function loadUserData(userId) {
  const id   = userId || uid();
  const snap = await getDoc(doc(db, 'users', id));
  if (!snap.exists()) return {};
  return snap.data();
}

// ════════════════════════════════════════
// 儲存跑圖進度（每關清完自動存）
// ════════════════════════════════════════
export async function saveRun({ cls, chapter, stage, currentHP, gold, deck }) {
  await updateDoc(userDoc(), {
    runActive: true, runCls: cls, runChapter: chapter, runStage: stage,
    runHP: currentHP, runGold: gold, runDeck: deck ?? [],
  });
}

export async function clearRun() {
  await updateDoc(userDoc(), {
    runActive: false, runCls: null, runChapter: 1, runStage: 0,
    runHP: 0, runGold: 0, runDeck: [],
  });
}

// ════════════════════════════════════════
// 死亡後金幣結算
// keepGold = true：保留（扣5%手續費）
// keepGold = false：放棄
// ════════════════════════════════════════
export async function settleDeath(runGold, keepGold) {
  if (keepGold && runGold > 0) {
    const kept = Math.floor(runGold * 0.95);
    await updateDoc(userDoc(), { gold: increment(kept) });
    await clearRun();
    return kept;
  }
  await clearRun();
  return 0;
}

// ════════════════════════════════════════
// 通關章節後：更新最高進度
// ════════════════════════════════════════
export async function updateProgress(chapter, stage) {
  const snap = await getDoc(userDoc());
  const cur  = snap.data() || {};
  const updates = {};

  if (chapter > (cur.highestChapter || 0)) updates.highestChapter = chapter;
  if (stage   > (cur.highestStage   || 0)) updates.highestStage   = stage;

  if (Object.keys(updates).length > 0) {
    await updateDoc(userDoc(), updates);
  }
}

// ════════════════════════════════════════
// 擊殺 BOSS 後：加天賦點、記錄擊殺
// ════════════════════════════════════════
export async function onBossKill(bossId) {
  await updateDoc(userDoc(), {
    totalTalentPts: increment(1),
    bossesKilled: arrayUnion(bossId)
  });
}

// ════════════════════════════════════════
// 通關章節：加10天賦點
// ════════════════════════════════════════
export async function onChapterClear() {
  await updateDoc(userDoc(), { totalTalentPts: increment(10) });
}

// ════════════════════════════════════════
// 升等：更新等級與累計 EXP
// ════════════════════════════════════════
export async function addExp(amount) {
  const snap = await getDoc(userDoc());
  let { level = 1, totalExp = 0 } = snap.data() || {};

  totalExp += amount;

  // 升等公式：每升一級需要 300 + 目標等級×60 EXP
  while (level < 50) {
    const needed = 300 + (level + 1) * 60;
    const used   = calcTotalExpForLevel(level);
    if (totalExp >= used + needed) {
      level++;
    } else break;
  }

  await updateDoc(userDoc(), { level, totalExp });
  return level;
}

// 計算到達指定等級所需的累計 EXP
function calcTotalExpForLevel(targetLevel) {
  let total = 0;
  for (let lv = 1; lv < targetLevel; lv++) {
    total += 300 + (lv + 1) * 60;
  }
  return total;
}

// ════════════════════════════════════════
// 裝備：新增到持有清單
// ════════════════════════════════════════
export async function addEquipment(item) {
  await updateDoc(userDoc(), { ownedEquipment: arrayUnion(item) });
}

// ════════════════════════════════════════
// 裝備：穿戴（更新 equipped 物件）
// slot = 'weapon' | 'armor' | 'accA' | 'accB'
// cls  = 'varek' | 'lyra' | 'kael'
// ════════════════════════════════════════
export async function equipItem(cls, slot, item) {
  const clsKey = cls === 'varek' ? 'equippedVarek' : cls === 'lyra' ? 'equippedLyra' : 'equippedKael';
  await updateDoc(userDoc(), { [`${clsKey}.${slot}`]: item });
}

// ════════════════════════════════════════
// 商店購買：扣金幣 + 解鎖卡牌包
// ════════════════════════════════════════
export async function buyCardPack(packId, cost) {
  const snap = await getDoc(userDoc());
  const gold = snap.data()?.gold ?? 0;

  if (gold < cost) throw new Error('金幣不足');

  await updateDoc(userDoc(), {
    gold: increment(-cost),
    unlockedPacks: arrayUnion(packId)
  });
}

// ════════════════════════════════════════
// 商店：購買一般道具（扣金幣）
// ════════════════════════════════════════
export async function spendGold(amount) {
  const snap = await getDoc(userDoc());
  const gold = snap.data()?.gold ?? 0;
  if (gold < amount) throw new Error('金幣不足');
  await updateDoc(userDoc(), { gold: increment(-amount) });
}

// ════════════════════════════════════════
// 天賦：解鎖節點
// cls    = 'varek' | 'lyra' | 'kael'
// nodeId = 'node_1' ... 'node_15'
// ════════════════════════════════════════
export async function unlockTalent(cls, nodeId) {
  const snap = await getDoc(userDoc());
  const pts  = snap.data()?.totalTalentPts || 0;

  if (pts < 1) throw new Error('天賦點數不足');

  const key = `${cls}Talents.${nodeId}`;
  await updateDoc(userDoc(), {
    [key]: true,
    totalTalentPts: increment(-1)
  });
}
