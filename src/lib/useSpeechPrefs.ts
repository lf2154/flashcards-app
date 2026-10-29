import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { SETTING_KEYS } from '../db/settings'

/** 全域朗讀設定：預設語言與語速 */
export function useSpeechPrefs(): { lang: string; rate: number } {
  const rows = useLiveQuery(() => db.settings.bulkGet([SETTING_KEYS.speechLang, SETTING_KEYS.speechRate]), [])
  const lang = rows?.[0]?.value
  const rate = rows?.[1]?.value
  return {
    lang: typeof lang === 'string' ? lang : '',
    rate: typeof rate === 'number' && rate >= 0.5 && rate <= 1.5 ? rate : 1,
  }
}
