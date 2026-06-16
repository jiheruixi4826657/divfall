/**
 * auth.js
 * 處理登入、註冊、登出，以及登入後跳轉 Hub
 *
 * 【教學】Firebase Auth 流程：
 *  - createUserWithEmailAndPassword → 建立帳號
 *  - signInWithEmailAndPassword     → 登入
 *  - onAuthStateChanged             → 自動偵測登入狀態（頁面重整後自動維持登入）
 *  - signOut                        → 登出
 */

import { auth, db } from './firebase-init.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  doc, setDoc, getDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { loadUserData } from './data.js';

// ── DOM 元素 ──
const screenAuth     = document.getElementById('screen-auth');
const screenHub      = document.getElementById('screen-hub');
const screenLoading  = document.getElementById('screen-loading');
const loadingText    = document.getElementById('loading-text');

const formLogin      = document.getElementById('form-login');
const formRegister   = document.getElementById('form-register');

const loginEmail     = document.getElementById('login-email');
const loginPassword  = document.getElementById('login-password');
const loginError     = document.getElementById('login-error');

const regUsername    = document.getElementById('reg-username');
const regEmail       = document.getElementById('reg-email');
const regPassword    = document.getElementById('reg-password');
const registerError  = document.getElementById('register-error');

const hubUsername    = document.getElementById('hub-username');
const hubGold        = document.getElementById('hub-gold');
const hubTalent      = document.getElementById('hub-talent');

// ── 畫面切換工具 ──
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

function showLoading(text = '載入中...') {
  loadingText.textContent = text;
  showScreen('screen-loading');
}

// ── Firebase 錯誤代碼轉中文 ──
function authErrorMsg(code) {
  const map = {
    'auth/email-already-in-use':  '此電子郵件已被使用',
    'auth/invalid-email':         '電子郵件格式錯誤',
    'auth/weak-password':         '密碼至少需要 6 個字元',
    'auth/user-not-found':        '找不到此帳號',
    'auth/wrong-password':        '密碼錯誤',
    'auth/invalid-credential':    '帳號或密碼錯誤',
    'auth/too-many-requests':     '嘗試次數過多，請稍後再試',
  };
  return map[code] || `發生錯誤（${code}）`;
}

// ════════════════════════════════════════
// 【登入】
// ════════════════════════════════════════
document.getElementById('btn-login').addEventListener('click', async () => {
  loginError.textContent = '';
  const email = loginEmail.value.trim();
  const pwd   = loginPassword.value;
  if (!email || !pwd) { loginError.textContent = '請填寫所有欄位'; return; }

  showLoading('登入中...');
  try {
    await signInWithEmailAndPassword(auth, email, pwd);
    // onAuthStateChanged 會自動處理跳轉
  } catch (e) {
    showScreen('screen-auth');
    loginError.textContent = authErrorMsg(e.code);
  }
});

// ════════════════════════════════════════
// 【註冊】
// 流程：
//  1. 檢查玩家名稱是否已存在（查 usernames/{name}）
//  2. 建立 Firebase Auth 帳號
//  3. 在 Firestore 寫入玩家資料
// ════════════════════════════════════════
document.getElementById('btn-register').addEventListener('click', async () => {
  registerError.textContent = '';
  const username = regUsername.value.trim();
  const email    = regEmail.value.trim();
  const pwd      = regPassword.value;

  if (!username || !email || !pwd) { registerError.textContent = '請填寫所有欄位'; return; }
  if (username.length < 2)         { registerError.textContent = '名稱至少2個字元'; return; }
  if (!/^[a-zA-Z0-9一-龥_]+$/.test(username)) {
    registerError.textContent = '名稱只能含中英文、數字、底線'; return;
  }

  showLoading('建立帳號中...');

  try {
    // Step 1：確認名稱未被佔用
    const nameDoc = await getDoc(doc(db, 'usernames', username));
    if (nameDoc.exists()) {
      showScreen('screen-auth');
      formLogin.classList.add('hidden');
      formRegister.classList.remove('hidden');
      registerError.textContent = '此名稱已被使用，請換一個';
      return;
    }

    // Step 2：建立 Auth 帳號
    const credential = await createUserWithEmailAndPassword(auth, email, pwd);
    const uid = credential.user.uid;

    // Step 3：寫入 Firestore 玩家資料（全部存在單一文件 users/{uid}）
    await Promise.all([
      // 名稱索引（確保唯一）
      setDoc(doc(db, 'usernames', username), { uid }),
      // 玩家完整資料（一個文件搞定）
      setDoc(doc(db, 'users', uid), {
        displayName: username,
        level: 1,
        totalExp: 0,
        gold: 0,
        createdAt: serverTimestamp(),
        // 裝備
        ownedEquipment: [],
        equippedVarek: {},
        equippedLyra: {},
        equippedKael: {},
        // 卡牌包
        unlockedPacks: [],
        // 天賦
        varekTalents: {},
        lyraTalents: {},
        kaelTalents: {},
        totalTalentPts: 0,
        // 進度
        highestChapter: 1,
        highestStage: 0,
        bossesKilled: [],
        // 當前跑圖
        runActive: false,
        runCls: null,
        runChapter: 1,
        runStage: 0,
        runHP: 0,
        runGold: 0,
        runDeck: [],
      })
    ]);

    // onAuthStateChanged 自動跳轉
  } catch (e) {
    showScreen('screen-auth');
    formLogin.classList.add('hidden');
    formRegister.classList.remove('hidden');
    registerError.textContent = authErrorMsg(e.code);
  }
});

// ════════════════════════════════════════
// 【登出】
// ════════════════════════════════════════
document.getElementById('btn-logout').addEventListener('click', async () => {
  await signOut(auth);
});

// ════════════════════════════════════════
// 【表單切換】
// ════════════════════════════════════════
document.getElementById('btn-to-register').addEventListener('click', () => {
  formLogin.classList.add('hidden');
  formRegister.classList.remove('hidden');
  loginError.textContent = '';
});
document.getElementById('btn-to-login').addEventListener('click', () => {
  formRegister.classList.add('hidden');
  formLogin.classList.remove('hidden');
  registerError.textContent = '';
});

// ════════════════════════════════════════
// 【自動登入偵測】onAuthStateChanged
// 每次頁面載入時自動執行，判斷使用者是否已登入
// ════════════════════════════════════════
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // 已登入 → 讀取資料 → 顯示 Hub
    showLoading('讀取玩家資料...');
    try {
      const profile = await loadUserData(user.uid);
      updateHubDisplay(profile);
      showScreen('screen-hub');
    } catch (e) {
      console.error('讀取資料失敗', e);
      showScreen('screen-hub');
    }
  } else {
    // 未登入 → 顯示登入畫面
    showScreen('screen-auth');
  }
});

// ── Hub 畫面更新玩家資訊 ──
function updateHubDisplay(profile) {
  if (!profile) return;
  hubUsername.textContent = profile.displayName || '玩家';
  hubGold.textContent     = `💰 ${profile.gold ?? 0}`;
  hubTalent.textContent   = `⭐ ${profile.totalTalentPts ?? 0} 天賦點`;
}

export { showScreen, showLoading };
