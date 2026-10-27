import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { getDeckCounts } from '../db/study'
import { now } from './clock'

/** 所有牌組（資料變動時自動更新；載入中為 undefined） */
export function useDecks() {
  return useLiveQuery(() => db.decks.toArray(), [])
}

/** 每個牌組今天的三個數字（資料變動時自動更新） */
export function useDeckCounts() {
  return useLiveQuery(() => getDeckCounts(now()), [])
}
