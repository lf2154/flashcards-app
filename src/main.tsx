import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { applyTheme, loadThemeMode } from './lib/theme'
import { cleanupOrphanMedia } from './db/media'
import './index.css'

// 跟隨系統時，系統切換深淺色要即時反映
const mode = loadThemeMode()
applyTheme(mode)
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  applyTheme(loadThemeMode())
})

// 申請「永久儲存」，降低瀏覽器在空間不足時清掉卡片資料的風險；被拒絕也不影響使用
navigator.storage?.persist?.().catch(() => {})

// 開啟後稍等一下，清理超過一天、沒有任何筆記用到的圖片（SPEC 3）；失敗也不影響使用
window.setTimeout(() => {
  cleanupOrphanMedia().catch((e) => console.warn('清理圖片失敗', e))
}, 5000)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
