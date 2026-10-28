import { db } from './index'
import type { Deck, DeckSettings } from './types'
import { AppError } from '../lib/errors'
import { newId } from '../lib/id'
import { now } from '../lib/clock'
import { newSchedule } from '../scheduler/fsrs'

export const DECK_SEPARATOR = '::'

export function defaultDeckSettings(): DeckSettings {
  return {
    newPerDay: 20,
    reviewPerDay: 200,
    desiredRetention: 0.9,
    learningSteps: [1, 10],
    relearningSteps: [10],
    newOrder: 'sequential',
    speechLang: '',
    autoSpeak: false,
  }
}

// ───────── 樹狀結構（純函式） ─────────

export interface DeckNode {
  deck: Deck
  children: DeckNode[]
  /** 完整路徑，例如「英文::多益」 */
  path: string
}

export function buildDeckTree(decks: Deck[]): DeckNode[] {
  const byParent = new Map<string, Deck[]>()
  for (const d of decks) {
    const key = d.parentId ?? ''
    const l = byParent.get(key)
    if (l) l.push(d)
    else byParent.set(key, [d])
  }
  const make = (d: Deck, prefix: string): DeckNode => {
    const path = prefix ? `${prefix}${DECK_SEPARATOR}${d.name}` : d.name
    const kids = (byParent.get(d.id) ?? []).sort(byName).map((k) => make(k, path))
    return { deck: d, children: kids, path }
  }
  return (byParent.get('') ?? []).sort(byName).map((d) => make(d, ''))
}

const byName = (a: Deck, b: Deck) => a.name.localeCompare(b.name, 'zh-Hant')

/** 攤平成「完整路徑＋牌組」清單（選擇牌組的下拉用） */
export function flattenDeckTree(nodes: DeckNode[]): { path: string; deck: Deck; depth: number }[] {
  const out: { path: string; deck: Deck; depth: number }[] = []
  const walk = (list: DeckNode[], depth: number) => {
    for (const n of list) {
      out.push({ path: n.path, deck: n.deck, depth })
      walk(n.children, depth + 1)
    }
  }
  walk(nodes, 0)
  return out
}

/** 某牌組與它所有子孫牌組的 ID */
export function descendantIds(decks: Deck[], rootId: string): string[] {
  const ids = [rootId]
  for (let i = 0; i < ids.length; i++) {
    for (const d of decks) if (d.parentId === ids[i]) ids.push(d.id)
  }
  return ids
}

function cleanName(raw: string): string {
  const name = raw.trim()
  if (!name) throw new AppError('請輸入牌組名稱')
  return name
}

function assertNoSeparator(name: string) {
  if (name.includes(DECK_SEPARATOR)) throw new AppError('名稱不能包含「::」。若要建立子牌組，請在新增牌組時輸入完整路徑。')
}

function findChild(decks: Deck[], parentId: string | null, name: string): Deck | undefined {
  return decks.find((d) => d.parentId === parentId && d.name === name)
}

// ───────── 資料庫操作 ─────────

/**
 * 新增牌組。名稱可以用「::」一次建立多層，例如「英文::多益」
 * 會自動建立（或沿用已有的）「英文」，再在底下建立「多益」。
 * 最後一層若已存在，視為重複並回報錯誤。回傳最後一層的 ID。
 */
export async function createDeck(rawName: string, parentId: string | null = null): Promise<string> {
  const parts = rawName.split(DECK_SEPARATOR).map(cleanName)
  return db.transaction('rw', db.decks, async () => {
    const decks = await db.decks.toArray()
    if (parentId && !decks.some((d) => d.id === parentId)) throw new AppError('找不到上層牌組')
    let current = parentId
    for (let i = 0; i < parts.length; i++) {
      const existing = findChild(decks, current, parts[i])
      const last = i === parts.length - 1
      if (existing) {
        if (last) throw new AppError(`已經有名為「${parts[i]}」的牌組`)
        current = existing.id
        continue
      }
      const deck: Deck = {
        id: newId(),
        name: parts[i],
        parentId: current,
        description: '',
        settings: defaultDeckSettings(),
        createdAt: now(),
      }
      await db.decks.add(deck)
      decks.push(deck)
      current = deck.id
    }
    return current as string
  })
}

export async function renameDeck(id: string, rawName: string): Promise<void> {
  const name = cleanName(rawName)
  assertNoSeparator(name)
  await db.transaction('rw', db.decks, async () => {
    const deck = await db.decks.get(id)
    if (!deck) throw new AppError('找不到這個牌組')
    const decks = await db.decks.toArray()
    const clash = findChild(decks, deck.parentId, name)
    if (clash && clash.id !== id) throw new AppError(`同一層已經有名為「${name}」的牌組`)
    await db.decks.update(id, { name })
  })
}

/** 移動牌組到另一個父牌組底下（null＝移到最上層） */
export async function moveDeck(id: string, newParentId: string | null): Promise<void> {
  await db.transaction('rw', db.decks, async () => {
    const decks = await db.decks.toArray()
    const deck = decks.find((d) => d.id === id)
    if (!deck) throw new AppError('找不到這個牌組')
    if (newParentId && descendantIds(decks, id).includes(newParentId)) {
      throw new AppError('不能把牌組移到它自己或它的子牌組底下')
    }
    const clash = findChild(decks, newParentId, deck.name)
    if (clash && clash.id !== id) throw new AppError(`目標位置已經有名為「${deck.name}」的牌組`)
    await db.decks.update(id, { parentId: newParentId })
  })
}

export async function updateDeckSettings(id: string, patch: Partial<DeckSettings>): Promise<void> {
  await db.transaction('rw', db.decks, async () => {
    const deck = await db.decks.get(id)
    if (!deck) throw new AppError('找不到這個牌組')
    await db.decks.update(id, { settings: { ...deck.settings, ...patch } })
  })
}

export interface DeckDeletionInfo {
  decks: number
  notes: number
  cards: number
}

/** 刪除前給確認視窗用：將會刪掉多少牌組／筆記／卡片（含子牌組） */
export async function getDeckDeletionInfo(id: string): Promise<DeckDeletionInfo> {
  const ids = descendantIds(await db.decks.toArray(), id)
  const [notes, cards] = await Promise.all([
    db.notes.where('deckId').anyOf(ids).count(),
    db.cards.where('deckId').anyOf(ids).count(),
  ])
  return { decks: ids.length, notes, cards }
}

/** 刪除牌組：子牌組、其中的筆記、卡片與複習紀錄一併刪除（交易，要嘛全成功要嘛全不動） */
export async function deleteDeck(id: string): Promise<void> {
  await db.transaction('rw', [db.decks, db.notes, db.cards, db.reviewLogs], async () => {
    const ids = descendantIds(await db.decks.toArray(), id)
    const cardIds = await db.cards.where('deckId').anyOf(ids).primaryKeys()
    await db.reviewLogs.where('cardId').anyOf(cardIds).delete()
    await db.cards.bulkDelete(cardIds)
    await db.notes.where('deckId').anyOf(ids).delete()
    await db.decks.bulkDelete(ids)
  })
}

/**
 * 重置牌組：牌組（含子牌組）的所有卡片變回新卡、取消埋卡，並刪除這些卡的複習紀錄。
 * 新卡順序（依新增時間）不變；暫停的卡與旗幟保留。無法復原。
 */
export async function resetDeck(id: string, at = now()): Promise<number> {
  return db.transaction('rw', [db.decks, db.cards, db.reviewLogs], async () => {
    const ids = descendantIds(await db.decks.toArray(), id)
    const cardIds = await db.cards.where('deckId').anyOf(ids).primaryKeys()
    await db.reviewLogs.where('cardId').anyOf(cardIds).delete()
    await db.cards
      .where('deckId')
      .anyOf(ids)
      .modify({ ...newSchedule(at), buried: false, buriedDay: null })
    return cardIds.length
  })
}
