import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db'
import { SETTING_KEYS, setSetting } from '../db/settings'
import { InstallSteps } from '../components/InstallGuide'
import { PageHeader } from '../components/PageHeader'
import { isStandalone } from '../lib/platform'
import { applyTheme, loadThemeMode, saveThemeMode, THEME_LABELS, type ThemeMode } from '../lib/theme'

const THEME_ORDER: ThemeMode[] = ['light', 'dark', 'system']

export function SettingsPage() {
  const [theme, setTheme] = useState<ThemeMode>(loadThemeMode)
  const swipeRow = useLiveQuery(() => db.settings.get(SETTING_KEYS.swipeGestures), [])
  const swipeOn = swipeRow?.value !== false

  const changeTheme = (mode: ThemeMode) => {
    setTheme(mode)
    saveThemeMode(mode)
    applyTheme(mode)
  }

  return (
    <>
      <PageHeader title="設定" />

      <section className="mx-4 mt-4 rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
        <h2 className="mb-3 font-semibold">外觀</h2>
        <div role="radiogroup" aria-label="外觀" className="flex gap-2">
          {THEME_ORDER.map((mode) => (
            <button
              key={mode}
              role="radio"
              aria-checked={theme === mode}
              onClick={() => changeTheme(mode)}
              className={`h-12 flex-1 rounded-xl border text-sm font-medium ${
                theme === mode
                  ? 'border-indigo-600 bg-indigo-600 text-white'
                  : 'border-slate-300 dark:border-slate-600'
              }`}
            >
              {THEME_LABELS[mode]}
            </button>
          ))}
        </div>
      </section>

      <section className="mx-4 mt-4 rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
        <h2 className="mb-3 font-semibold">複習</h2>
        <label className="flex min-h-12 items-center justify-between gap-3">
          <span>
            滑動手勢
            <span className="block text-xs text-slate-500">翻面後：左滑＝重來、右滑＝良好</span>
          </span>
          <input
            type="checkbox"
            className="h-6 w-6 accent-indigo-600"
            checked={swipeOn}
            onChange={(e) => void setSetting(SETTING_KEYS.swipeGestures, e.target.checked)}
          />
        </label>
      </section>

      <section className="mx-4 mt-4 rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
        <h2 className="mb-3 font-semibold">加入主畫面</h2>
        {isStandalone() ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            你正在從主畫面開啟記憶卡，一切正常。
          </p>
        ) : (
          <InstallSteps />
        )}
      </section>

      <p className="mt-6 text-center text-xs text-slate-400">記憶卡 v{__APP_VERSION__}</p>
    </>
  )
}
