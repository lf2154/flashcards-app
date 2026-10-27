import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// 測試環境沒有 Service Worker，換成假的
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: vi.fn(),
  }),
}))

import { App } from './App'

beforeEach(() => {
  window.location.hash = '#/'
  localStorage.clear()
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
})

describe('App 骨架', () => {
  it('底部導覽列有四個分頁並可切換', async () => {
    const user = userEvent.setup()
    render(<App />)
    const nav = screen.getByRole('navigation', { name: '主要導覽' })
    for (const label of ['牌組', '瀏覽', '統計', '設定']) {
      expect(nav).toHaveTextContent(label)
    }
    await user.click(screen.getByRole('link', { name: '統計' }))
    expect(screen.getByRole('heading', { name: '統計' })).toBeInTheDocument()
  })

  it('設定頁切換深色模式會套用 dark class 並記住', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('link', { name: '設定' }))
    await user.click(screen.getByRole('radio', { name: '深色' }))
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('theme')).toBe('dark')
    await user.click(screen.getByRole('radio', { name: '淺色' }))
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('首頁顯示加入主畫面引導，按「我知道了」後不再顯示', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByText('先把記憶卡加到主畫面')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '我知道了' }))
    expect(screen.queryByText('先把記憶卡加到主畫面')).not.toBeInTheDocument()
    expect(localStorage.getItem('installGuideDismissed')).toBe('1')
  })
})
