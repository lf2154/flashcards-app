import { useCallback, useEffect } from 'react'
import { useToast } from '../components/Toast'
import type { Deck, Note } from '../db/types'
import { sidesOf } from './cardSides'
import { primeSpeech, resolveLang, speak, stopSpeaking } from './speech'
import { useSpeechPrefs } from './useSpeechPrefs'

/**
 * 朗讀卡片的某一面。語言：筆記設定 → 牌組設定 → 全域預設。
 * 找不到語音時用中文提示，不讓 App 出錯；離開畫面時停止朗讀。
 */
export function useCardSpeech() {
  const toast = useToast()
  const prefs = useSpeechPrefs()

  useEffect(() => stopSpeaking, [])

  return useCallback(
    (note: Note, ordinal: number, deck: Deck | undefined, side: 'q' | 'a', quiet = false) => {
      primeSpeech()
      const s = sidesOf(note, ordinal)
      const lang = resolveLang(side === 'q' ? s.qLang : s.aLang, deck?.settings.speechLang, prefs.lang)
      const r = speak(side === 'q' ? s.qSpeech : s.aSpeech, lang, prefs.rate)
      if (!r.ok) toast(r.message)
      else if (r.note && !quiet) toast(r.note)
    },
    [prefs.lang, prefs.rate, toast],
  )
}
