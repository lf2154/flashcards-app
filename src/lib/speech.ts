// 語音朗讀：使用瀏覽器內建的 Web Speech API（免費、可離線，依手機已安裝的語音）。
// iPhone 只允許在使用者點擊後發聲，所以第一次要在點擊的當下呼叫 primeSpeech()（SPEC 10.7）。

export const SPEECH_LANGS: { code: string; label: string }[] = [
  { code: 'zh-TW', label: '中文（台灣）' },
  { code: 'en-US', label: '英文（美國）' },
  { code: 'en-GB', label: '英文（英國）' },
  { code: 'ja-JP', label: '日文' },
  { code: 'ko-KR', label: '韓文' },
  { code: 'zh-HK', label: '粵語（香港）' },
  { code: 'zh-CN', label: '中文（中國）' },
  { code: 'fr-FR', label: '法文' },
  { code: 'de-DE', label: '德文' },
  { code: 'es-ES', label: '西班牙文' },
]

export function langLabel(code: string): string {
  return SPEECH_LANGS.find((l) => l.code.toLowerCase() === code.toLowerCase())?.label ?? code
}

/** 同語言找不到時的替代順序（例如台灣中文找不到，先試香港再試大陸） */
const FALLBACKS: Record<string, string[]> = {
  'zh-tw': ['zh-hk', 'zh-cn'],
  'zh-hk': ['zh-tw', 'zh-cn'],
  'zh-cn': ['zh-tw', 'zh-hk'],
  'en-us': ['en-gb', 'en-au'],
  'en-gb': ['en-us', 'en-au'],
}

const norm = (lang: string) => lang.replace('_', '-').toLowerCase()

type VoiceLike = Pick<SpeechSynthesisVoice, 'lang' | 'name'>

/** 依語言代碼挑語音。exact＝完全符合；否則是同語言的替代語音；找不到回傳 null */
export function pickVoice<V extends VoiceLike>(voices: V[], lang: string): { voice: V; exact: boolean } | null {
  const want = norm(lang)
  const exact = voices.find((v) => norm(v.lang) === want)
  if (exact) return { voice: exact, exact: true }
  for (const alt of FALLBACKS[want] ?? []) {
    const v = voices.find((x) => norm(x.lang) === alt)
    if (v) return { voice: v, exact: false }
  }
  const prefix = want.split('-')[0]
  const same = voices.find((v) => norm(v.lang).split('-')[0] === prefix)
  return same ? { voice: same, exact: false } : null
}

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
}

// 語音清單是非同步載入的：一開始可能是空的，要等 voiceschanged
let voices: SpeechSynthesisVoice[] = []
if (isSpeechSupported()) {
  const load = () => {
    voices = window.speechSynthesis.getVoices()
  }
  load()
  window.speechSynthesis.addEventListener?.('voiceschanged', load)
}

let primed = false
/** iPhone 解鎖語音：在使用者點擊的當下呼叫（之後的自動朗讀才會生效） */
export function primeSpeech(): void {
  if (primed || !isSpeechSupported()) return
  primed = true
  const u = new SpeechSynthesisUtterance(' ')
  u.volume = 0
  window.speechSynthesis.speak(u)
}

export function stopSpeaking(): void {
  if (isSpeechSupported()) window.speechSynthesis.cancel()
}

export type SpeakResult =
  | { ok: true; note?: string }
  | { ok: false; message: string }

/**
 * 朗讀一段文字（會先停止正在念的）。lang 空字串＝用手機預設語音。
 * 回傳結果讓畫面決定要不要顯示提示；任何情況都不丟錯。
 */
export function speak(text: string, lang: string, rate = 1): SpeakResult {
  if (!isSpeechSupported()) return { ok: false, message: '這個瀏覽器不支援朗讀' }
  const t = text.trim()
  stopSpeaking()
  if (!t) return { ok: true }
  const u = new SpeechSynthesisUtterance(t)
  u.rate = rate
  let note: string | undefined
  if (lang) {
    u.lang = lang
    // 語音清單還沒載入（或手機不提供清單）時，只設定語言、交給瀏覽器決定
    if (voices.length > 0) {
      const pick = pickVoice(voices, lang)
      if (!pick) {
        return { ok: false, message: `這支手機沒有「${langLabel(lang)}」的語音，可到系統設定下載語音後再試` }
      }
      u.voice = pick.voice
      u.lang = pick.voice.lang
      if (!pick.exact) note = `沒有「${langLabel(lang)}」語音，改用「${langLabel(pick.voice.lang)}」`
    }
  }
  try {
    window.speechSynthesis.speak(u)
  } catch {
    return { ok: false, message: '朗讀失敗，請再試一次' }
  }
  return { ok: true, note }
}

/** 決定要用的語言：筆記自己的設定 → 牌組設定 → 全域預設 */
export function resolveLang(...candidates: (string | undefined | null)[]): string {
  return candidates.find((c) => !!c) ?? ''
}
