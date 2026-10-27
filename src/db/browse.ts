import { db } from './index'
import { buildDeckTree, descendantIds, flattenDeckTree } from './decks'
import type { Card, Note } from './types'

export interface BrowseItem {
  card: Card
  note: Note
  /** 卡片所在牌組的完整路徑，例如「英文::多益」 */
  deckPath: string
}

/**
 * 瀏覽模式用：某牌組（含子牌組）的所有卡片。
 * 順序：依牌組列表的順序，同牌組內依新增時間、再依卡片編號（反轉卡的正→反在前）。
 * 找不到牌組時回傳 null。
 */
export async function getBrowseItems(deckId: string): Promise<BrowseItem[] | null> {
  const decks = await db.decks.toArray()
  if (!decks.some((d) => d.id === deckId)) return null
  const flat = flattenDeckTree(buildDeckTree(decks))
  const order = new Map(flat.map((x, i) => [x.deck.id, i]))
  const paths = new Map(flat.map((x) => [x.deck.id, x.path]))

  const cards = await db.cards.where('deckId').anyOf(descendantIds(decks, deckId)).toArray()
  const notes = await db.notes.bulkGet([...new Set(cards.map((c) => c.noteId))])
  const noteById = new Map(notes.filter((n): n is Note => !!n).map((n) => [n.id, n]))

  return cards
    .filter((c) => noteById.has(c.noteId))
    .map((card) => ({ card, note: noteById.get(card.noteId)!, deckPath: paths.get(card.deckId) ?? '' }))
    .sort(
      (a, b) =>
        (order.get(a.card.deckId) ?? 0) - (order.get(b.card.deckId) ?? 0) ||
        a.note.createdAt - b.note.createdAt ||
        a.card.ordinal - b.card.ordinal ||
        (a.card.id < b.card.id ? -1 : 1),
    )
}
