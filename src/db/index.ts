import Dexie, { type EntityTable } from 'dexie'
import type { Card, Deck, MediaRow, Note, ReviewLog, SettingRow } from './types'

// 資料庫版本：日後要改資料結構，一律「新增 version(N+1)」並寫 upgrade（migration）。
// 絕對不可以清空重建，否則使用者一更新 App 就會遺失卡片（SPEC 10.2）。
export class FlashcardsDB extends Dexie {
  decks!: EntityTable<Deck, 'id'>
  notes!: EntityTable<Note, 'id'>
  cards!: EntityTable<Card, 'id'>
  reviewLogs!: EntityTable<ReviewLog, 'id'>
  media!: EntityTable<MediaRow, 'id'>
  settings!: EntityTable<SettingRow, 'key'>

  constructor(name = 'flashcards') {
    super(name)
    this.version(1).stores({
      decks: 'id, parentId',
      notes: 'id, deckId, type, *tags, updatedAt',
      cards: 'id, noteId, deckId, state, due',
      reviewLogs: 'id, cardId, reviewedAt',
      media: 'id',
      settings: 'key',
    })
  }
}

export const db = new FlashcardsDB()
