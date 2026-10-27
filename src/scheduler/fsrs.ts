import {
  FSRS,
  StrategyMode,
  generatorParameters,
  type Card as FsrsCard,
  type Grade,
  type StepUnit,
} from 'ts-fsrs'
import type { Card, CardSchedule, CardStateValue, DeckSettings, Rating } from '../db/types'

// 排程一律交給 ts-fsrs（FSRS 演算法），這裡只做「我們的資料 ↔ ts-fsrs」的轉換。

const MAX_INTERVAL_DAYS = 36500

/** 新卡的初始排程 */
export function newSchedule(now: number): CardSchedule {
  return {
    due: now,
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    learning_steps: 0,
    reps: 0,
    lapses: 0,
    state: 0,
    last_review: null,
  }
}

const toSteps = (minutes: number[]): StepUnit[] => minutes.map((m) => `${m}m` as StepUnit)

/**
 * 依牌組設定建立排程器。
 * - 開啟短期學習步驟（learning steps）與間隔微幅隨機化（fuzz）
 * - 隨機種子只由「卡片 ID＋複習次數」決定：同一張卡、同一次複習，
 *   不論何時算都得到同樣的間隔，所以按鈕上的預覽與實際排程才會一致。
 */
function makeFsrs(settings: DeckSettings, cardId: string): FSRS {
  const f = new FSRS(
    generatorParameters({
      request_retention: settings.desiredRetention,
      maximum_interval: MAX_INTERVAL_DAYS,
      enable_fuzz: true,
      enable_short_term: true,
      learning_steps: toSteps(settings.learningSteps),
      relearning_steps: toSteps(settings.relearningSteps),
    }),
  )
  f.useStrategy(StrategyMode.SEED, function (this: { current: FsrsCard }) {
    return `${cardId}_${this.current.reps}`
  } as never)
  return f
}

function toFsrsCard(c: CardSchedule): FsrsCard {
  return {
    due: new Date(c.due),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    learning_steps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    last_review: c.last_review === null ? undefined : new Date(c.last_review),
  }
}

function fromFsrsCard(c: FsrsCard): CardSchedule {
  return {
    due: c.due.getTime(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    learning_steps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state as CardStateValue,
    last_review: c.last_review ? c.last_review.getTime() : null,
  }
}

export function pickSchedule(c: CardSchedule): CardSchedule {
  return {
    due: c.due,
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    learning_steps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    last_review: c.last_review,
  }
}

export const RATINGS: Rating[] = [1, 2, 3, 4]

export interface RatingPreview {
  schedule: CardSchedule
  /** 按鈕上顯示的下次間隔，例如「10分」「4天」 */
  label: string
}

/** 四個評分鍵各自的結果與間隔文字。以「卡片顯示的時刻」計算。 */
export function previewRatings(
  card: Card,
  settings: DeckSettings,
  shownAt: number,
): Record<Rating, RatingPreview> {
  const rec = makeFsrs(settings, card.id).repeat(toFsrsCard(card), shownAt)
  const out = {} as Record<Rating, RatingPreview>
  for (const r of RATINGS) {
    const item = rec[r as Grade]
    const schedule = fromFsrsCard(item.card)
    out[r] = { schedule, label: intervalLabel(schedule, shownAt) }
  }
  return out
}

/**
 * 實際評分。
 * 排程以「卡片顯示的時刻 shownAt」計算（與按鈕預覽完全相同的結果），
 * 再把到期時間往後補上「思考時間」（答題時刻 − 顯示時刻），
 * 這樣「1 分鐘後再出現」是從按下按鈕那一刻算起，而不是從翻開卡片那一刻。
 */
export function applyRating(
  card: Card,
  settings: DeckSettings,
  rating: Rating,
  shownAt: number,
  answeredAt: number,
): CardSchedule {
  const item = makeFsrs(settings, card.id).next(toFsrsCard(card), shownAt, rating as Grade)
  const next = fromFsrsCard(item.card)
  next.due += answeredAt - shownAt
  next.last_review = answeredAt
  return next
}

// ───────── 間隔文字 ─────────

const MIN = 60_000

function trimNumber(n: number): string {
  return String(Math.round(n * 10) / 10)
}

/** 天數轉文字：天／個月／年 */
export function formatDays(days: number): string {
  if (days < 30) return `${Math.max(1, Math.round(days))}天`
  if (days < 365) return `${trimNumber(days / 30)}個月`
  return `${trimNumber(days / 365)}年`
}

/** 毫秒轉文字：分／小時／天／個月／年 */
export function formatInterval(ms: number): string {
  if (ms < MIN) return '<1分'
  const minutes = ms / MIN
  if (minutes < 60) return `${Math.round(minutes)}分`
  const hours = minutes / 60
  if (hours < 24) return `${trimNumber(hours)}小時`
  return formatDays(hours / 24)
}

function intervalLabel(s: CardSchedule, shownAt: number): string {
  // 複習狀態以「排定天數」顯示（不受思考時間影響）；學習中以實際差距顯示
  if (s.state === 2 && s.scheduled_days > 0) return formatDays(s.scheduled_days)
  return formatInterval(s.due - shownAt)
}

