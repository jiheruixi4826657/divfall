# 神殞 DIVFALL — 正式上線完整指南

## 架構總覽

```
玩家瀏覽器
   │
   ├── 前端（GitHub Pages）
   │     免費靜態網頁託管，全世界都能訪問
   │     網址：https://你的帳號.github.io/divfall/
   │
   ├── Firebase（Google）
   │     帳號登入 + 雲端存檔
   │     免費方案即可
   │
   └── Render（後端伺服器）
         Socket.io 多人即時通訊
         免費方案750小時/月
         網址：https://divfall-server.onrender.com
         由 UptimeRobot 每5分鐘保活
```

---

## STEP 1：設定 Firebase（約15分鐘）

### 1-1 建立 Firebase 專案
1. 前往 https://console.firebase.google.com
2. 點「新增專案」→ 名稱填 `divfall` → 點「繼續」
3. 「啟用 Google Analytics」可關閉 → 點「建立專案」
4. 等待建立完成（約30秒）

### 1-2 建立網頁應用程式
1. 在 Firebase Console 首頁，點「</> 網頁」圖示
2. 應用程式暱稱填 `divfall-web` → 點「註冊應用程式」
3. **複製** 出現的 `firebaseConfig` 物件（很重要！）
4. 點「繼續前往主控台」

### 1-3 啟用 Authentication
1. 左側選單 → 「Authentication」→ 「開始使用」
2. 「登入方式」→ 點「電子郵件/密碼」
3. 右上「啟用」開關打開 → 儲存

### 1-4 建立 Firestore 資料庫
1. 左側選單 → 「Firestore Database」→「建立資料庫」
2. 選「**以測試模式開始**」（30天後要手動改規則）
3. 地區選「**asia-east1（台灣）**」→ 完成

### 1-5 填入你的 Firebase 設定
打開 `js/firebase-init.js`，把 `YOUR_API_KEY` 等替換成剛才複製的值：

```javascript
const firebaseConfig = {
  apiKey:            "AIza...",           // ← 你的值
  authDomain:        "divfall.firebaseapp.com",
  projectId:         "divfall",
  storageBucket:     "divfall.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abcdef"
};
```

---

## STEP 2：上傳前端到 GitHub Pages（約10分鐘）

### 2-1 安裝 Git
- 下載：https://git-scm.com/download/win
- 安裝時全部點「Next」即可

### 2-2 建立 GitHub 帳號
- 前往 https://github.com → Sign up

### 2-3 建立前端 Repository
1. GitHub 首頁 → 右上「+」→「New repository」
2. Repository name 填：`divfall`（**必須小寫**）
3. 設為 **Public**（GitHub Pages 免費版需要Public）
4. 點「Create repository」

### 2-4 上傳遊戲檔案

打開 Windows 命令提示字元（在開始功能表搜尋 `cmd`），輸入：

```bash
cd "C:\Users\user\Desktop\Claude code\神殞"

git init
git add .
git commit -m "初始版本：神殞 DIVFALL"
git branch -M main
git remote add origin https://github.com/你的帳號/divfall.git
git push -u origin main
```

### 2-5 啟用 GitHub Pages
1. 在 GitHub 的 divfall repo 頁面
2. 點「Settings」→ 左側「Pages」
3. Source 選「**Deploy from a branch**」
4. Branch 選「**main**」→ 資料夾選「**/ (root)**」
5. 點「Save」
6. 等 2-3 分鐘後重新整理，你會看到：
   **「Your site is published at https://你的帳號.github.io/divfall/」**

---

## STEP 3：部署後端到 Render（約20分鐘）

### 3-1 建立後端 Repository
1. GitHub 建立新 repo，名稱：`divfall-server`
2. 上傳 `server/` 資料夾內的所有檔案：

```bash
mkdir divfall-server-repo
cd divfall-server-repo

copy "C:\Users\user\Desktop\Claude code\神殞\server\server.js" .
copy "C:\Users\user\Desktop\Claude code\神殞\server\room-manager.js" .
copy "C:\Users\user\Desktop\Claude code\神殞\server\game-sync.js" .
copy "C:\Users\user\Desktop\Claude code\神殞\server\package.json" .

git init
git add .
git commit -m "神殞後端伺服器"
git branch -M main
git remote add origin https://github.com/你的帳號/divfall-server.git
git push -u origin main
```

### 3-2 在 Render 建立 Web Service
1. 前往 https://render.com → 用 GitHub 帳號登入
2. New → 「Web Service」
3. 選「Connect a repository」→ 選 `divfall-server`
4. 設定：
   - **Name**: `divfall-server`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: **Free**
5. 點「Deploy Web Service」
6. 等待部署完成（3-5分鐘），你會看到：
   `https://divfall-server.onrender.com` ← 這就是你的伺服器網址

### 3-3 設定 CORS（很重要！）
打開 `server/server.js`，把 CORS origin 換成你的 GitHub Pages 網址：

```javascript
origin: [
  'https://你的帳號.github.io',  // ← 換成你的
  'http://localhost:3000',
],
```

然後重新推到 GitHub（Render 會自動重新部署）。

### 3-4 更新前端的伺服器網址
打開 `js/socket-client.js`：

```javascript
: 'https://divfall-server.onrender.com'  // ← 換成你的 Render 網址
```

---

## STEP 4：設定 UptimeRobot 保活（約5分鐘）

**原理**：Render 免費版閒置 15 分鐘後休眠，下次有人連線需要 30-50 秒冷啟動。
UptimeRobot 每 5 分鐘 ping 一次，讓伺服器保持喚醒。

1. 前往 https://uptimerobot.com → 免費註冊
2. 「Add New Monitor」
3. 設定：
   - **Monitor Type**: HTTP(s)
   - **Friendly Name**: divfall-server
   - **URL**: `https://divfall-server.onrender.com/ping`
   - **Monitoring Interval**: **5 minutes**
4. 點「Create Monitor」
5. 完成！它會每5分鐘自動 ping，讓你的伺服器保持運作

---

## STEP 5：Firestore 安全規則（上線前必做）

預設的「測試模式」30天後會停用。上線前到 Firebase Console：
Firestore → 「規則」→ 貼上以下規則：

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // 使用者只能讀寫自己的資料
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // 使用者名稱索引：任何登入者都可讀（查詢是否重複），只有自己可寫
    match /usernames/{username} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
                   && request.resource.data.uid == request.auth.uid;
    }
  }
}
```

---

## 更新遊戲

每次修改前端程式後，重新執行：
```bash
cd "C:\Users\user\Desktop\Claude code\神殞"
git add .
git commit -m "更新說明"
git push
```
GitHub Pages 約 2 分鐘後自動更新。

---

## 常見問題

| 問題 | 解決方法 |
|------|---------|
| 登入頁面白屏 | 檢查 firebase-init.js 的 apiKey 是否正確貼入 |
| 多人連線失敗 | 確認 socket-client.js 的 SERVER_URL 與 Render 網址相符 |
| Render 伺服器很慢 | 正常！免費版冷啟動需要30-50秒，UptimeRobot設定後可改善 |
| Firebase 讀取規則錯誤 | 確認 Firestore 規則已更新（測試模式30天後過期）|
| GitHub Pages 404 | 確認 Settings → Pages 有正確設定 main branch |
