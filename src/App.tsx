import { HashRouter, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { BrowsePage } from './pages/BrowsePage'
import { DecksPage } from './pages/DecksPage'
import { SettingsPage } from './pages/SettingsPage'
import { StatsPage } from './pages/StatsPage'

// 使用 HashRouter（網址帶 #），靜態網站重新整理才不會出現 404（SPEC 10.1）
export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<DecksPage />} />
          <Route path="browse" element={<BrowsePage />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<DecksPage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
