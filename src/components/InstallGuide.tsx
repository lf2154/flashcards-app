import { useState } from 'react'
import { detectPlatform, isStandalone } from '../lib/platform'

const DISMISS_KEY = 'installGuideDismissed'

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

/** 加入主畫面的步驟說明，首頁引導與設定頁共用 */
export function InstallSteps() {
  const platform = detectPlatform()
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {platform !== 'android' && (
        <section>
          <h3 className="font-semibold">iPhone（請用 Safari）</h3>
          <ol className="list-decimal pl-5">
            <li>點畫面下方的「分享」按鈕（方框加向上箭頭）</li>
            <li>往下滑，點「加入主畫面」</li>
            <li>點右上角「加入」</li>
          </ol>
        </section>
      )}
      {platform !== 'ios' && (
        <section>
          <h3 className="font-semibold">Android（請用 Chrome）</h3>
          <ol className="list-decimal pl-5">
            <li>點右上角的「⋮」選單</li>
            <li>點「安裝應用程式」（或「加到主畫面」）</li>
            <li>點「安裝」</li>
          </ol>
        </section>
      )}
      <p className="rounded-lg bg-amber-50 p-3 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
        <strong>重要：</strong>
        iPhone 上「主畫面 App」和「Safari 分頁」的資料是分開的。請先加到主畫面、從主畫面開啟後，再開始建立卡片。
      </p>
      <p className="text-slate-600 dark:text-slate-400">
        你的資料只存在這支手機裡，沒有上傳到任何地方，所以請記得定期到「設定」匯出備份。
      </p>
    </div>
  )
}

/**
 * 首次開啟的引導卡片。已經從主畫面開啟、或使用者按過「我知道了」就不再顯示。
 * 「已關閉」的紀錄存在 localStorage，只是個人偏好，遺失了頂多再看一次。
 */
export function InstallGuide() {
  const [dismissed, setDismissed] = useState(readDismissed)

  if (dismissed || isStandalone()) return null

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* 存不了就只在本次關閉 */
    }
    setDismissed(true)
  }

  return (
    <section className="mx-4 mt-4 rounded-2xl border border-indigo-200 bg-white p-4 shadow-sm dark:border-indigo-900 dark:bg-slate-900">
      <h2 className="mb-2 text-lg font-bold">先把記憶卡加到主畫面</h2>
      <InstallSteps />
      <button
        className="mt-4 h-12 w-full rounded-xl bg-indigo-600 font-medium text-white active:bg-indigo-700"
        onClick={dismiss}
      >
        我知道了
      </button>
    </section>
  )
}
