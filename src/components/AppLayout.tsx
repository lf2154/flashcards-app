import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { UpdatePrompt } from './UpdatePrompt'

/** 所有分頁共用的外框：內容區可捲動，底部固定導覽列 */
export function AppLayout() {
  return (
    <div className="pt-safe mx-auto min-h-dvh max-w-xl pb-[calc(3.5rem+env(safe-area-inset-bottom))]">
      <UpdatePrompt />
      <main>
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
