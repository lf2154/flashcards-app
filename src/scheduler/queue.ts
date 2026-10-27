// 出卡佇列：決定今天有哪些卡、數字多少、下一張是哪一張。
// 全部是純函式（資料由外面傳進來），方便寫單元測試。
//
// 規則（SPEC 4.2、5、10.3）：
// - 順序：學習中且已到期 → 待複習／新卡（交錯）→ 學習中提前（learn ahead）
// - 每日新卡／複習上限以「今天」reviewLogs 的實際數量計算
// - 父牌組的上限同時約束子牌組
// - 兄弟卡（同一則筆記的其他卡）今天已出現過一張，其餘延到明天
import type { Card, Deck, ReviewLog } from '../db/types'
import { CardState } from '../db/types'
import { nextStudyDayStart, studyDayIndex } from '../lib/studyDay'

export interface QueueContext {
  decks: Deck[]
  cards: Card[]
  /** 「今天」（學習日）內的所有複習紀錄 */
  todayLogs: ReviewLog[]
  now: number
  rolloverHour: number
}

export interface Counts {
  new: number
  learning: number
  review: number
}

export type CardKind = 'new' | 'learning' | 'review'

/** 學習中卡片提前顯示的時間窗：20 分鐘（同 Anki 的 learn ahead） */
export const LEARN_AHEAD_MS = 20 * 60_000

/** 字串雜湊成 0～1，用來做「看起來隨機、但同一天內固定」的排序 */
export function hash01(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967296
}

interface Gathered {
  new: Card[]
  review: Card[]
  learning: Card[]
}

export interface Prepared {
  ctx: QueueContext
  today: number
  dayEnd: number
  /** 每個牌組（含子牌組）算出的今日卡片 */
  gathered: Map<string, Gathered>
}

const isLearningState = (s: number) => s === CardState.Learning || s === CardState.Relearning

export function prepare(ctx: QueueContext): Prepared {
  const { decks, cards, todayLogs, now, rolloverHour } = ctx
  const today = studyDayIndex(now, rolloverHour)
  const dayEnd = nextStudyDayStart(now, rolloverHour)
  const cardById = new Map(cards.map((c) => [c.id, c]))

  // 今天已經出現過的筆記 → 當天出現過的卡片 ID
  const seenToday = new Map<string, Set<string>>()
  // 各牌組「自己」今天已用掉的新卡／複習數
  const usedNewOwn = new Map<string, number>()
  const usedReviewOwn = new Map<string, number>()
  for (const log of todayLogs) {
    const card = cardById.get(log.cardId)
    if (!card) continue
    let set = seenToday.get(card.noteId)
    if (!set) seenToday.set(card.noteId, (set = new Set()))
    set.add(card.id)
    if (log.state === CardState.New) usedNewOwn.set(card.deckId, (usedNewOwn.get(card.deckId) ?? 0) + 1)
    if (log.state === CardState.Review) usedReviewOwn.set(card.deckId, (usedReviewOwn.get(card.deckId) ?? 0) + 1)
  }

  const dueDay = (c: Card) => studyDayIndex(c.due, rolloverHour)
  const isNewCandidate = (c: Card) => c.state === CardState.New
  const isReviewCandidate = (c: Card) => c.state === CardState.Review && dueDay(c) <= today

  // 先排除暫停、今天被埋、以及「兄弟卡今天已出現過」的卡
  const eligible = cards.filter((c) => {
    if (c.suspended) return false
    if (c.buried && c.buriedDay === today) return false
    if (isNewCandidate(c) || c.state === CardState.Review) {
      const seen = seenToday.get(c.noteId)
      if (seen && [...seen].some((id) => id !== c.id)) return false
    }
    return true
  })

  // 同一則筆記同時有好幾張候選卡時，只留一張（待複習優先於新卡，再比編號）
  const byNote = new Map<string, Card[]>()
  for (const c of eligible) {
    if (!isNewCandidate(c) && !isReviewCandidate(c)) continue
    const list = byNote.get(c.noteId)
    if (list) list.push(c)
    else byNote.set(c.noteId, [c])
  }
  const dropped = new Set<string>()
  for (const list of byNote.values()) {
    if (list.length < 2) continue
    list.sort(
      (a, b) =>
        Number(isNewCandidate(a)) - Number(isNewCandidate(b)) || a.ordinal - b.ordinal,
    )
    for (const c of list.slice(1)) dropped.add(c.id)
  }

  const ownNew = new Map<string, Card[]>()
  const ownReview = new Map<string, Card[]>()
  const ownLearning = new Map<string, Card[]>()
  const push = (m: Map<string, Card[]>, c: Card) => {
    const l = m.get(c.deckId)
    if (l) l.push(c)
    else m.set(c.deckId, [c])
  }
  for (const c of eligible) {
    if (dropped.has(c.id)) continue
    if (isNewCandidate(c)) push(ownNew, c)
    else if (isReviewCandidate(c)) push(ownReview, c)
    else if (isLearningState(c.state) && c.due < dayEnd) push(ownLearning, c)
  }

  const children = new Map<string, Deck[]>()
  for (const d of decks) {
    const key = d.parentId ?? ''
    const l = children.get(key)
    if (l) l.push(d)
    else children.set(key, [d])
  }

  const gathered = new Map<string, Gathered>()
  // 回傳：該牌組子樹的卡片，以及子樹今天已用掉的數量
  const walk = (deck: Deck): { g: Gathered; usedNew: number; usedReview: number } => {
    let usedNew = usedNewOwn.get(deck.id) ?? 0
    let usedReview = usedReviewOwn.get(deck.id) ?? 0
    let newCards = [...(ownNew.get(deck.id) ?? [])]
    let reviewCards = [...(ownReview.get(deck.id) ?? [])]
    let learning = [...(ownLearning.get(deck.id) ?? [])]
    for (const child of children.get(deck.id) ?? []) {
      const r = walk(child)
      usedNew += r.usedNew
      usedReview += r.usedReview
      newCards = newCards.concat(r.g.new)
      reviewCards = reviewCards.concat(r.g.review)
      learning = learning.concat(r.g.learning)
    }
    const s = deck.settings
    newCards.sort(
      s.newOrder === 'random'
        ? (a, b) => hash01(a.id + today) - hash01(b.id + today)
        : (a, b) => a.createdAt - b.createdAt || a.ordinal - b.ordinal || (a.id < b.id ? -1 : 1),
    )
    reviewCards.sort((a, b) => dueDay(a) - dueDay(b) || hash01(a.id + today) - hash01(b.id + today))
    learning.sort((a, b) => a.due - b.due)
    const g: Gathered = {
      new: newCards.slice(0, Math.max(0, s.newPerDay - usedNew)),
      review: reviewCards.slice(0, Math.max(0, s.reviewPerDay - usedReview)),
      learning,
    }
    gathered.set(deck.id, g)
    return { g, usedNew, usedReview }
  }
  for (const root of children.get('') ?? []) walk(root)

  return { ctx, today, dayEnd, gathered }
}

/** 每個牌組今天的三個數字（父牌組包含子牌組） */
export function computeCounts(p: Prepared): Map<string, Counts> {
  const out = new Map<string, Counts>()
  for (const [id, g] of p.gathered) {
    out.set(id, { new: g.new.length, learning: g.learning.length, review: g.review.length })
  }
  return out
}

/** 新卡與複習卡交錯：用累積的「新卡額度」決定這次出哪一種（純函式、結果固定） */
export function chooseKind(
  newCount: number,
  reviewCount: number,
  credit: number,
): { kind: 'new' | 'review'; credit: number } | null {
  if (newCount === 0 && reviewCount === 0) return null
  if (reviewCount === 0) return { kind: 'new', credit }
  if (newCount === 0) return { kind: 'review', credit }
  const next = credit + newCount / (newCount + reviewCount)
  if (next >= 1) return { kind: 'new', credit: next - 1 }
  return { kind: 'review', credit: next }
}

export interface Pick {
  card: Card
  kind: CardKind
  /** 交錯用的額度，下次呼叫時原樣傳回來 */
  credit: number
}

/** 取得這個牌組（含子牌組）下一張要複習的卡；沒有就回傳 null */
export function pickNext(p: Prepared, deckId: string, credit = 0): Pick | null {
  const g = p.gathered.get(deckId)
  if (!g) return null
  const { now } = p.ctx

  const due = g.learning.find((c) => c.due <= now)
  if (due) return { card: due, kind: 'learning', credit }

  const choice = chooseKind(g.new.length, g.review.length, credit)
  if (choice) {
    const card = choice.kind === 'new' ? g.new[0] : g.review[0]
    return { card, kind: choice.kind, credit: choice.credit }
  }

  const ahead = g.learning.find((c) => c.due <= now + LEARN_AHEAD_MS)
  if (ahead) return { card: ahead, kind: 'learning', credit }
  return null
}

/** 今天做完之後，畫面上要顯示的「明天預計」與「稍後學習中」資訊 */
export interface DoneInfo {
  /** 這個牌組（含子牌組）一共有幾張卡；0 代表還沒有任何卡片 */
  totalCards: number
  tomorrowNew: number
  tomorrowReview: number
  /** 還沒到時間的學習中卡片數，以及最快的到期時間 */
  laterLearning: number
  nextLearningDue: number | null
}

export function computeDoneInfo(p: Prepared, deckId: string): DoneInfo {
  const { ctx, today } = p
  const ids = new Set<string>()
  const collect = (id: string) => {
    ids.add(id)
    for (const d of ctx.decks) if (d.parentId === id) collect(d.id)
  }
  collect(deckId)
  const deck = ctx.decks.find((d) => d.id === deckId)
  const own = ctx.cards.filter((c) => ids.has(c.deckId) && !c.suspended)
  const dueDay = (c: Card) => studyDayIndex(c.due, ctx.rolloverHour)

  const reviewTomorrow = own.filter((c) => c.state === CardState.Review && dueDay(c) <= today + 1).length
  const newLeft = own.filter((c) => c.state === CardState.New).length
  const learning = own.filter((c) => isLearningState(c.state) && c.due > ctx.now)
  const nextDue = learning.length ? Math.min(...learning.map((c) => c.due)) : null
  return {
    totalCards: ctx.cards.filter((c) => ids.has(c.deckId)).length,
    tomorrowNew: Math.min(newLeft, deck?.settings.newPerDay ?? 0),
    tomorrowReview: Math.min(reviewTomorrow, deck?.settings.reviewPerDay ?? 0),
    laterLearning: learning.length,
    nextLearningDue: nextDue,
  }
}
