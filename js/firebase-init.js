/**
 * firebase-init.js
 * 初始化 Firebase App、Auth、Firestore
 *
 * ════════════════════════════════════════
 * 【保母教學】如何取得你的 Firebase 設定？
 *
 * 1. 前往 https://console.firebase.google.com
 * 2. 點「新增專案」→ 名稱填 divfall → 繼續
 * 3. 建立完成後，點左側「專案設定（齒輪）」
 * 4. 往下找「您的應用程式」→ 點「</> 網頁應用程式」
 * 5. 輸入暱稱（隨便填）→「註冊應用程式」
 * 6. 複製 firebaseConfig 物件的值，填入下方
 *
 * 7. 啟用 Authentication：
 *    左側 → Authentication → 開始使用 → 電子郵件/密碼 → 啟用
 *
 * 8. 啟用 Firestore：
 *    左側 → Firestore Database → 建立資料庫
 *    選「以測試模式開始」→ 選亞洲地區（asia-east1）→ 完成
 * ════════════════════════════════════════
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth }        from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore }   from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ★★★ 把下面換成你自己的 Firebase 設定 ★★★
const firebaseConfig = {
  apiKey:            "AIzaSyCAqIHSF6BrzmshLNDbqcYwlTCX9fSr6kM",
  authDomain:        "divfalldivfall.firebaseapp.com",
  projectId:         "divfalldivfall",
  storageBucket:     "divfalldivfall.firebasestorage.app",
  messagingSenderId: "888794097385",
  appId:             "1:888794097385:web:96aefbaa394cd13d2df278"
};
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

console.log('[Firebase] 初始化完成');
