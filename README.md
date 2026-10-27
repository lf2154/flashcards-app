# 記憶卡

手機優先的間隔重複記憶卡 App（PWA）。使用 FSRS 演算法排程，資料只存在你自己的手機裡，可離線使用，並能匯出／匯入備份。

完整規格請看 [SPEC.md](./SPEC.md)；目前進度：**階段 1（骨架與部署）**。

網址：`https://<你的 GitHub 帳號>.github.io/flashcards-app/`

## 第一次部署（只需做一次）

1. 把程式碼合併到 `main` 分支（Claude Code 會幫你做，或在 GitHub 網站上合併 Pull Request）。
2. 打開 GitHub 儲存庫頁面 → **Settings（設定）** → 左側 **Pages**。
3. 在 **Build and deployment** 的 **Source** 選 **GitHub Actions**。
4. 到儲存庫的 **Actions** 分頁，等「測試並部署到 GitHub Pages」變成綠色打勾（約 1–2 分鐘）。
5. 回到 Settings → Pages，頁面上方會顯示網址；也可以直接用上面的網址格式。

> 如果 Actions 的「deploy」步驟出現 *Environment protection rules* 錯誤：Settings → Environments → github-pages → 把 Deployment branches 改成允許 `main`。

## 之後怎麼更新

把修改推到 `main`，GitHub Actions 會自動測試、建置、發布，不用任何手動操作。

使用者端：下次打開 App 時，畫面頂端會出現「有新版本，點此更新」，按下去才會套用，複習到一半不會被打斷。

## 加到手機主畫面

- **iPhone**：用 Safari 開網址 → 分享 → 加入主畫面。
- **Android**：用 Chrome 開網址 → 選單 → 安裝應用程式。

> iPhone 上「主畫面 App」與「Safari 分頁」的資料是分開的。請先加到主畫面，從主畫面開啟後再開始建立卡片。

## 開發

需要 Node.js 22 以上。

```bash
npm install        # 安裝套件
npm run dev        # 開發伺服器：http://localhost:5173/flashcards-app/
npm test           # 單元測試
npm run build      # 型別檢查 + 建置到 dist/
npm run preview    # 預覽建置結果（含離線功能）
npm run icons      # 重新產生 PWA 圖示（通常不用）
```

### 重要設定

- 網站在子路徑 `/flashcards-app/`：`vite.config.ts` 的 `BASE` 同時用在 Vite base、manifest 的 `start_url` / `scope`，要改請一起改。
- 使用 HashRouter（網址帶 `#`），靜態網站重新整理不會 404。
- Service Worker 採 `registerType: 'prompt'`，由使用者決定何時更新。
