import { lazy } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { FullScreenLayout } from './components/FullScreenLayout'
import { ToastProvider } from './components/Toast'
import { BrowsePage } from './pages/BrowsePage'
import { DeckOverviewPage } from './pages/DeckOverviewPage'
import { DecksPage } from './pages/DecksPage'
import { DeckSettingsPage } from './pages/DeckSettingsPage'
import { SettingsPage } from './pages/SettingsPage'
import { StatsPage } from './pages/StatsPage'
import { StudyPage } from './pages/StudyPage'

// 編輯器（TipTap）比較大，只在需要時才載入，首頁開啟更快；離線時仍會被預先快取
const NoteEditorPage = lazy(() => import('./pages/NoteEditorPage').then((m) => ({ default: m.NoteEditorPage })))

// 使用 HashRouter（網址帶 #），靜態網站重新整理才不會出現 404（SPEC 10.1）
export function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<DecksPage />} />
            <Route path="deck/:deckId" element={<DeckOverviewPage />} />
            <Route path="browse" element={<BrowsePage />} />
            <Route path="stats" element={<StatsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route element={<FullScreenLayout />}>
            <Route path="study/:deckId" element={<StudyPage />} />
            <Route path="add" element={<NoteEditorPage />} />
            <Route path="note/:noteId" element={<NoteEditorPage />} />
            <Route path="deck/:deckId/settings" element={<DeckSettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </HashRouter>
  )
}
