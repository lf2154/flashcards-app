import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { UpdatePrompt } from './UpdatePrompt'

/** 沒有底部導覽列的全螢幕外框（複習、新增／編輯、牌組設定） */
export function FullScreenLayout() {
  return (
    <>
      <UpdatePrompt />
      <Suspense fallback={null}>
        <Outlet />
      </Suspense>
    </>
  )
}
