import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db'
import { SETTING_KEYS, setSetting } from '../db/settings'
import { useToast } from '../components/Toast'
import { isSpeechSupported, primeSpeech, speak, SPEECH_LANGS } from '../lib/speech'
import { useSpeechPrefs } from '../lib/useSpeechPrefs'
import { InstallSteps } from '../components/InstallGuide'
import { PageHeader } from '../components/PageHeader'
import { isStandalone } from '../lib/platform'
import { applyTheme, loadThemeMode, saveThemeMode, THEME_LABELS, type ThemeMode } from '../lib/theme'

const THEME_ORDER: ThemeMode[] = ['light', 'dark', 'system']

export function SettingsPage() {
  const [theme, setTheme] = useState<ThemeMode>(loadThemeMode)
  const swipeRow = useLiveQuery(() => db.settings.get(SETTING_KEYS.swipeGestures), [])
  const swipeOn = swipeRow?.value !== false
  const speech = useSpeechPrefs()
  const toast = useToast()
  const testSpeak = () => {
    primeSpeech()
    const sample = speech.lang.startsWith('en') ? 'Hello, this is a test.' : speech.lang.startsWith('ja') ? 'こんにちは' : speech.lang.startsWith('ko') ? '안녕하세요' : '你好，這是朗讀測試。'
    const r = speak(sample, speech.lang, speech.rate)
    if (!r.ok) toast(r.message)
    else if (r.note) toast(r.note)
  }

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
            <span className="block text-xs text-slate-500">左滑下一張、右滑上一張；翻面後上滑＝忘記、下滑＝OK</span>
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
        <h2 className="mb-3 font-semibold">語音朗讀</h2>
        {!isSpeechSupported() && <p className="mb-2 text-sm text-amber-700">這個瀏覽器不支援朗讀。</p>}
        <label htmlFor="speech-lang" className="mb-1 block text-sm">
          預設朗讀語言
        </label>
        <select
          id="speech-lang"
          className="h-12 w-full rounded-xl border border-slate-300 bg-transparent px-3 dark:border-slate-600"
          value={speech.lang}
          onChange={(e) => void setSetting(SETTING_KEYS.speechLang, e.target.value)}
        >
          <option value="">手機預設</option>
          {SPEECH_LANGS.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">牌組或筆記另外設定語言時，以它們為準。</p>
        <label htmlFor="speech-rate" className="mt-4 mb-1 flex justify-between text-sm">
          <span>朗讀語速</span>
          <span className="tabular-nums text-slate-500">{speech.rate.toFixed(1)} 倍</span>
        </label>
        <input
          id="speech-rate"
          type="range"
          min={0.5}
          max={1.5}
          step={0.1}
          value={speech.rate}
          className="h-10 w-full accent-indigo-600"
          onChange={(e) => void setSetting(SETTING_KEYS.speechRate, Number(e.target.value))}
        />
        <button
          className="mt-2 h-12 w-full rounded-xl border border-slate-300 font-medium disabled:opacity-40 dark:border-slate-600"
          disabled={!isSpeechSupported()}
          onClick={testSpeak}
        >
          試聽
        </button>
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
