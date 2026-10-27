// 深色模式：淺色／深色／跟隨系統。
// 階段 1 先存在 localStorage（index.html 的內嵌腳本也讀同一個 key，避免開啟時閃白）；
// 階段 2 建好資料庫後，若要搬進 settings 資料表，需要寫 migration，不可直接丟掉。

export type ThemeMode = 'light' | 'dark' | 'system'

export const THEME_STORAGE_KEY = 'theme'

export const THEME_LABELS: Record<ThemeMode, string> = {
  light: '淺色',
  dark: '深色',
  system: '跟隨系統',
}

/** 把任何讀到的值轉成合法的主題；不認得的一律當作「跟隨系統」 */
export function parseThemeMode(value: unknown): ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
}

/** 依使用者選擇與系統設定，算出實際要不要用深色 */
export function resolveIsDark(mode: ThemeMode, systemPrefersDark: boolean): boolean {
  if (mode === 'system') return systemPrefersDark
  return mode === 'dark'
}

export function loadThemeMode(): ThemeMode {
  try {
    return parseThemeMode(localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    // 隱私模式或被封鎖時 localStorage 可能丟錯，退回預設即可
    return 'system'
  }
}

export function saveThemeMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode)
  } catch {
    /* 存不了就只在本次有效 */
  }
}

/** 把主題套用到畫面（切換 <html> 的 dark class 與狀態列顏色） */
export function applyTheme(mode: ThemeMode): void {
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const dark = resolveIsDark(mode, systemDark)
  document.documentElement.classList.toggle('dark', dark)
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? '#0b1120' : '#4f46e5')
}
