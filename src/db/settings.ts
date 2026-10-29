import { db } from './index'
import { DEFAULT_ROLLOVER_HOUR } from '../lib/studyDay'

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key)
  return row ? (row.value as T) : fallback
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value })
}

export const SETTING_KEYS = {
  rolloverHour: 'rolloverHour',
  swipeGestures: 'swipeGestures',
  /** 全域預設朗讀語言（牌組、筆記都沒設定時使用） */
  speechLang: 'speechLang',
  /** 朗讀語速 0.5～1.5 */
  speechRate: 'speechRate',
} as const

export function getRolloverHour(): Promise<number> {
  return getSetting(SETTING_KEYS.rolloverHour, DEFAULT_ROLLOVER_HOUR)
}
