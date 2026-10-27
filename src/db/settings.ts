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
} as const

export function getRolloverHour(): Promise<number> {
  return getSetting(SETTING_KEYS.rolloverHour, DEFAULT_ROLLOVER_HOUR)
}
