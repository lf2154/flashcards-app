import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * 有新版本時，在畫面頂端顯示一條提示，由使用者自己按「更新」才套用。
 * 不自動重新整理，避免複習到一半被打斷（SPEC 7、10.1）。
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.error('Service Worker 註冊失敗', error)
    },
  })

  if (!needRefresh && !offlineReady) return null

  const close = () => {
    setNeedRefresh(false)
    setOfflineReady(false)
  }

  return (
    <div
      role="status"
      className="sticky top-[env(safe-area-inset-top)] z-50 bg-indigo-600 text-white shadow-lg"
    >
      <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3">
        <p className="flex-1 text-sm">
          {needRefresh ? '有新版本，點此更新' : '已可離線使用，沒網路也能開啟'}
        </p>
        {needRefresh && (
          <button
            className="h-10 rounded-lg bg-white px-4 text-sm font-semibold text-indigo-700"
            onClick={() => updateServiceWorker(true)}
          >
            更新
          </button>
        )}
        <button className="h-10 px-2 text-sm text-indigo-100" onClick={close}>
          {needRefresh ? '稍後' : '知道了'}
        </button>
      </div>
    </div>
  )
}
