import { db } from './index'
import type { Card, Deck, Note, Rating, ReviewLog } from './types'
import { AppError } from '../lib/errors'
import { newId } from '../lib/id'
import { applyRating, pickSchedule, previewRatings, type RatingPreview } from '../scheduler/fsrs'
import {
  computeCounts,
  computeDoneInfo,
  pickNext,
  prepare,
  type CardKind,
  type Counts,
  type DoneInfo,
  type QueueContext,
} from '../scheduler/queue'
import { studyDayIndex, studyDayStart } from '../lib/studyDay'
import { getRolloverHour } from './settings'

/** 從資料庫讀出算佇列需要的全部資料 */
export async function loadQueueContext(now: number): Promise<QueueContext> {
  const rolloverHour = await getRolloverHour()
  const dayStart = studyDayStart(now, rolloverHour)
  const [decks, cards, todayLogs] = await Promise.all([
    db.decks.toArray(),
    db.cards.toArray(),
    db.reviewLogs.where('reviewedAt').aboveOrEqual(dayStart).toArray(),
  ])
  return { decks, cards, todayLogs, now, rolloverHour }
}

/** 首頁：每個牌組今天的新卡／學習中／待複習 */
export async function getDeckCounts(now: number): Promise<Map<string, Counts>> {
  return computeCounts(prepare(await loadQueueContext(now)))
}

const kindOf = (c: Card): CardKind => (c.state === 0 ? 'new' : c.state === 2 ? 'review' : 'learning')

export interface StudyCard {
  card: Card
  note: Note
  deck: Deck
  kind: CardKind
  /** 交錯用額度，下次取卡時原樣傳回 */
  credit: number
  /** 卡片顯示的時刻（排程以此為準） */
  shownAt: number
  previews: Record<Rating, RatingPreview>
}

export interface StudyState {
  counts: Counts
  next: StudyCard | null
  done: DoneInfo | null
  /** 被跳過的卡都輪完了，呼叫端應清空跳過清單 */
  skipCleared: boolean
}

export interface StudyOptions {
  /** 交錯用額度，上一次取卡結果的 credit 原樣傳回 */
  credit?: number
  /** 復原之後要「回到那一張卡」時指定（只要它沒被暫停就直接顯示） */
  forceCardId?: string
  /** 這一輪被「跳過」的卡 */
  skip?: ReadonlySet<string>
}

/** 取得這個牌組下一張要複習的卡（以及三個數字）；沒有了就回傳完成資訊 */
export async function getStudyState(deckId: string, now: number, options: StudyOptions = {}): Promise<StudyState> {
  const { credit = 0, forceCardId, skip } = options
  const ctx = await loadQueueContext(now)
  const p = prepare(ctx)
  const counts = computeCounts(p).get(deckId)
  if (!counts) throw new AppError('找不到這個牌組')
  let pick = pickNext(p, deckId, credit, skip)
  const forced = forceCardId ? ctx.cards.find((c) => c.id === forceCardId && !c.suspended) : undefined
  if (forced) pick = { card: forced, kind: kindOf(forced), credit }
  if (!pick) return { counts, next: null, done: computeDoneInfo(p, deckId), skipCleared: false }
  const [note, deck] = await Promise.all([db.notes.get(pick.card.noteId), db.decks.get(pick.card.deckId)])
  if (!note || !deck) throw new AppError('卡片資料不完整，請重新整理後再試')
  return {
    counts,
    next: {
      card: pick.card,
      note,
      deck,
      kind: pick.kind,
      credit: pick.credit,
      shownAt: now,
      previews: previewRatings(pick.card, deck.settings, now),
    },
    done: null,
    skipCleared: pick.skipCleared === true,
  }
}

/**
 * 評分：更新卡片排程並寫入 reviewLog（同一個交易）。
 * 回傳 reviewLog 的 ID，「復原」時用。
 */
export async function answerCard(
  cardId: string,
  rating: Rating,
  shownAt: number,
  answeredAt: number,
): Promise<string> {
  return db.transaction('rw', db.cards, db.decks, db.reviewLogs, async () => {
    const card = await db.cards.get(cardId)
    if (!card) throw new AppError('找不到這張卡片')
    const deck = await db.decks.get(card.deckId)
    if (!deck) throw new AppError('找不到這張卡片的牌組')
    const next = applyRating(card, deck.settings, rating, shownAt, answeredAt)
    const log: ReviewLog = {
      id: newId(),
      cardId,
      rating,
      state: card.state,
      due: card.due,
      reviewedAt: answeredAt,
      durationMs: Math.max(0, answeredAt - shownAt),
      prev: pickSchedule(card),
    }
    await db.reviewLogs.add(log)
    await db.cards.update(cardId, next)
    return log.id
  })
}

/** 復原一次評分：卡片整組排程還原到評分前，並刪除那筆 reviewLog */
export async function undoReview(logId: string): Promise<string | null> {
  return db.transaction('rw', db.cards, db.reviewLogs, async () => {
    const log = await db.reviewLogs.get(logId)
    if (!log) return null
    await db.cards.update(log.cardId, log.prev)
    await db.reviewLogs.delete(logId)
    return log.cardId
  })
}

// ───────── 暫停／埋卡／旗幟（每個都回傳「操作前」的狀態，供復原） ─────────

export interface CardFlags {
  suspended: boolean
  buried: boolean
  buriedDay: number | null
  flag: number
}

const flagsOf = (c: Card): CardFlags => ({
  suspended: c.suspended,
  buried: c.buried,
  buriedDay: c.buriedDay,
  flag: c.flag,
})

async function patchCard(cardId: string, patch: Partial<CardFlags>): Promise<CardFlags> {
  return db.transaction('rw', db.cards, async () => {
    const card = await db.cards.get(cardId)
    if (!card) throw new AppError('找不到這張卡片')
    await db.cards.update(cardId, patch)
    return flagsOf(card)
  })
}

export const setSuspended = (cardId: string, suspended: boolean) => patchCard(cardId, { suspended })

export async function buryCardUntilTomorrow(cardId: string, now: number): Promise<CardFlags> {
  const hour = await getRolloverHour()
  return patchCard(cardId, { buried: true, buriedDay: studyDayIndex(now, hour) })
}

export const setFlag = (cardId: string, flag: number) => patchCard(cardId, { flag })

export const restoreCardFlags = (cardId: string, flags: CardFlags) => patchCard(cardId, flags)
