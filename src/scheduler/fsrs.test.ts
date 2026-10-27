import { describe, expect, it } from 'vitest'
import { defaultDeckSettings } from '../db/decks'
import { CardState, type Card } from '../db/types'
import { applyRating, formatDays, formatInterval, previewRatings } from './fsrs'
import { makeCard } from '../test/factories'

const MIN = 60_000
const DAY = 86_400_000
const settings = defaultDeckSettings()
const T0 = new Date(2026, 9, 27, 10, 0).getTime()

describe('新卡連按四種評分', () => {
  const card = makeCard({ id: 'new1' })
  const prev = previewRatings(card, settings, T0)

  it('重來：進入學習中，1 分鐘後再出現', () => {
    expect(prev[1].schedule.state).toBe(CardState.Learning)
    expect(prev[1].schedule.due - T0).toBe(1 * MIN)
    expect(prev[1].label).toBe('1分')
  })

  it('困難：仍在學習中，間隔介於第一與第二步驟之間', () => {
    expect(prev[2].schedule.state).toBe(CardState.Learning)
    const d = prev[2].schedule.due - T0
    expect(d).toBeGreaterThan(1 * MIN)
    expect(d).toBeLessThan(10 * MIN)
  })

  it('良好：進入第二個學習步驟，10 分鐘後', () => {
    expect(prev[3].schedule.state).toBe(CardState.Learning)
    expect(prev[3].schedule.due - T0).toBe(10 * MIN)
    expect(prev[3].label).toBe('10分')
  })

  it('簡單：直接畢業成複習卡，至少 1 天後', () => {
    expect(prev[4].schedule.state).toBe(CardState.Review)
    expect(prev[4].schedule.scheduled_days).toBeGreaterThanOrEqual(1)
    expect(prev[4].label).toMatch(/天|個月/)
  })

  it('四個鍵的間隔由小到大', () => {
    const d = [1, 2, 3, 4].map((r) => prev[r as 1 | 2 | 3 | 4].schedule.due)
    expect([...d].sort((a, b) => a - b)).toEqual(d)
  })
})

describe('複習卡遺忘', () => {
  // 一張 10 天前複習過、穩定度 10 天、今天到期的複習卡
  const review: Card = makeCard({
    id: 'rev1',
    state: CardState.Review,
    stability: 10,
    difficulty: 5,
    reps: 4,
    lapses: 0,
    scheduled_days: 10,
    elapsed_days: 10,
    last_review: T0 - 10 * DAY,
    due: T0,
  })

  it('按「重來」進入重新學習，遺忘次數＋1，10 分鐘後再出現', () => {
    const next = applyRating(review, settings, 1, T0, T0)
    expect(next.state).toBe(CardState.Relearning)
    expect(next.lapses).toBe(1)
    expect(next.due - T0).toBe(10 * MIN)
  })

  it('按「良好」仍是複習卡，間隔拉長', () => {
    const next = applyRating(review, settings, 3, T0, T0)
    expect(next.state).toBe(CardState.Review)
    expect(next.scheduled_days).toBeGreaterThan(10)
    expect(next.lapses).toBe(0)
  })

  it('重新學習中答「良好」後回到複習', () => {
    const relearn = applyRating(review, settings, 1, T0, T0)
    const back = applyRating({ ...review, ...relearn }, settings, 3, T0 + 10 * MIN, T0 + 10 * MIN)
    expect(back.state).toBe(CardState.Review)
    expect(back.lapses).toBe(1)
  })
})

describe('預覽與實際排程一致', () => {
  it('不論思考多久，實際結果的間隔都與按鈕預覽相同', () => {
    const card = makeCard({ id: 'same1' })
    const prev = previewRatings(card, settings, T0)
    for (const r of [1, 2, 3, 4] as const) {
      const actual = applyRating(card, settings, r, T0, T0 + 20_000)
      expect(actual.state).toBe(prev[r].schedule.state)
      expect(actual.scheduled_days).toBe(prev[r].schedule.scheduled_days)
      // 到期時間 = 預覽 + 思考時間（從按下按鈕那一刻開始算）
      expect(actual.due).toBe(prev[r].schedule.due + 20_000)
    }
  })

  it('複習卡也一致（含間隔微幅隨機化）', () => {
    const card = makeCard({
      id: 'same2', state: CardState.Review, stability: 20, difficulty: 6, reps: 6,
      scheduled_days: 20, elapsed_days: 20, last_review: T0 - 20 * DAY, due: T0,
    })
    const prev = previewRatings(card, settings, T0)
    for (const r of [2, 3, 4] as const) {
      expect(applyRating(card, settings, r, T0, T0 + 5000).scheduled_days).toBe(prev[r].schedule.scheduled_days)
    }
  })

  it('同一張卡在不同時間算出的間隔相同（隨機種子固定）', () => {
    const card = makeCard({
      id: 'seed1', state: CardState.Review, stability: 30, difficulty: 5, reps: 5,
      scheduled_days: 30, elapsed_days: 30, last_review: T0 - 30 * DAY, due: T0,
    })
    const a = previewRatings(card, settings, T0)[3].schedule.scheduled_days
    const b = previewRatings(card, settings, T0 + 3 * 3_600_000)[3].schedule.scheduled_days
    expect(a).toBe(b)
  })
})

describe('間隔文字', () => {
  it('分、小時、天、個月、年', () => {
    expect(formatInterval(30_000)).toBe('<1分')
    expect(formatInterval(10 * MIN)).toBe('10分')
    expect(formatInterval(90 * MIN)).toBe('1.5小時')
    expect(formatInterval(2 * DAY)).toBe('2天')
    expect(formatDays(45)).toBe('1.5個月')
    expect(formatDays(400)).toBe('1.1年')
  })
})
