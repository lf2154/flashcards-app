import { describe, expect, it } from 'vitest'
import { CardState, type Card, type Deck } from '../db/types'
import { studyDayIndex } from '../lib/studyDay'
import { makeCard, makeDeck, makeLog } from '../test/factories'
import {
  chooseKind,
  computeCounts,
  computeDoneInfo,
  LEARN_AHEAD_MS,
  pickNext,
  prepare,
  type QueueContext,
} from './queue'

const MIN = 60_000
const DAY = 86_400_000
const NOW = new Date(2026, 9, 27, 10, 0).getTime()
const TODAY = studyDayIndex(NOW, 4)

const ctx = (over: Partial<QueueContext> & { decks?: Deck[]; cards?: Card[] }): QueueContext => ({
  decks: [makeDeck({ id: 'd1' })],
  cards: [],
  todayLogs: [],
  now: NOW,
  rolloverHour: 4,
  ...over,
})

const reviewCard = (over: Partial<Card> = {}) =>
  makeCard({ state: CardState.Review, due: NOW - DAY, stability: 5, difficulty: 5, reps: 3, ...over })

const counts = (c: QueueContext, id = 'd1') => computeCounts(prepare(c)).get(id)!

describe('今日數字', () => {
  it('新卡、學習中、待複習分開計算', () => {
    const c = ctx({
      cards: [
        makeCard(),
        makeCard(),
        makeCard({ state: CardState.Learning, due: NOW + 5 * MIN }),
        reviewCard(),
        reviewCard({ due: NOW + 3 * DAY }), // 還沒到期，不算
      ],
    })
    expect(counts(c)).toEqual({ new: 2, learning: 1, review: 1 })
  })

  it('暫停的卡不算', () => {
    expect(counts(ctx({ cards: [makeCard({ suspended: true }), makeCard()] })).new).toBe(1)
  })

  it('埋到明天的卡今天不算，隔天自動恢復', () => {
    const buried = makeCard({ buried: true, buriedDay: TODAY })
    expect(counts(ctx({ cards: [buried] })).new).toBe(0)
    expect(counts(ctx({ cards: [buried], now: NOW + DAY })).new).toBe(1)
  })
})

describe('跨換日時間（換日＝凌晨 4 點）', () => {
  // 到期時間是 10/28 下午 3 點的複習卡 → 屬於「10/28 這一天」，從 10/28 凌晨 4:00 起可複習
  const card = () => reviewCard({ due: new Date(2026, 9, 28, 15, 0).getTime() })
  const at = (h: number, m: number) => new Date(2026, 9, 28, h, m).getTime()

  it('10/28 凌晨 3:59 還算 10/27，尚未到期', () => {
    expect(counts(ctx({ cards: [card()], now: at(3, 59) })).review).toBe(0)
  })
  it('10/28 凌晨 4:00 起算新的一天，到期', () => {
    expect(counts(ctx({ cards: [card()], now: at(4, 0) })).review).toBe(1)
  })
  it('當天稍晚（早於卡片的實際到期時刻）也能複習，不必等到下午 3 點', () => {
    expect(counts(ctx({ cards: [card()], now: at(9, 0) })).review).toBe(1)
  })
  it('每日上限也跟著換日：昨天學的新卡不佔今天的額度', () => {
    const deck = makeDeck({ id: 'd1' })
    deck.settings.newPerDay = 1
    const learned = makeCard({ state: CardState.Learning, due: at(12, 0) })
    // 這筆 log 屬於「今天」才會被傳進來；換日後 loadQueueContext 不會再載入它
    const withLog = ctx({
      decks: [deck],
      cards: [learned, makeCard()],
      todayLogs: [makeLog(learned, { state: CardState.New, reviewedAt: at(5, 0) })],
      now: at(6, 0),
    })
    const afterRollover = ctx({ decks: [deck], cards: [learned, makeCard()], todayLogs: [], now: at(6, 0) })
    expect(counts(withLog).new).toBe(0)
    expect(counts(afterRollover).new).toBe(1)
  })
})

describe('每日上限', () => {
  it('新卡上限＝設定值減去今天已學的新卡', () => {
    const deck = makeDeck({ id: 'd1' })
    deck.settings.newPerDay = 3
    const cards = Array.from({ length: 10 }, () => makeCard())
    expect(counts(ctx({ decks: [deck], cards })).new).toBe(3)

    const learned = makeCard({ state: CardState.Learning, due: NOW + MIN })
    const log = makeLog(learned, { state: CardState.New, reviewedAt: NOW - MIN })
    expect(counts(ctx({ decks: [deck], cards: [...cards, learned], todayLogs: [log] })).new).toBe(2)
  })

  it('複習上限', () => {
    const deck = makeDeck({ id: 'd1' })
    deck.settings.reviewPerDay = 2
    const cards = Array.from({ length: 5 }, () => reviewCard())
    expect(counts(ctx({ decks: [deck], cards })).review).toBe(2)
  })

  it('父牌組的上限同時約束子牌組', () => {
    const parent = makeDeck({ id: 'p' })
    parent.settings.newPerDay = 5
    const child = makeDeck({ id: 'c', parentId: 'p' })
    child.settings.newPerDay = 20
    const cards = [
      ...Array.from({ length: 4 }, () => makeCard({ deckId: 'p' })),
      ...Array.from({ length: 10 }, () => makeCard({ deckId: 'c' })),
    ]
    const result = computeCounts(prepare(ctx({ decks: [parent, child], cards })))
    expect(result.get('p')!.new).toBe(5)
    expect(result.get('c')!.new).toBe(10) // 單獨學子牌組時只看子牌組自己的上限
  })

  it('父牌組數字包含子牌組', () => {
    const parent = makeDeck({ id: 'p' })
    const child = makeDeck({ id: 'c', parentId: 'p' })
    const cards = [makeCard({ deckId: 'p' }), makeCard({ deckId: 'c' }), reviewCard({ deckId: 'c' })]
    expect(computeCounts(prepare(ctx({ decks: [parent, child], cards }))).get('p')).toEqual({
      new: 2, learning: 0, review: 1,
    })
  })
})

describe('兄弟卡', () => {
  const siblings = () => [
    makeCard({ id: 'a', noteId: 'n1', ordinal: 0 }),
    makeCard({ id: 'b', noteId: 'n1', ordinal: 1 }),
  ]

  it('同一則筆記的兩張新卡，今天只出一張', () => {
    const c = ctx({ cards: siblings() })
    expect(counts(c).new).toBe(1)
    expect(pickNext(prepare(c), 'd1')!.card.id).toBe('a')
  })

  it('其中一張今天答過後，另一張延到明天', () => {
    const [a, b] = siblings()
    const answered = { ...a, state: CardState.Learning, due: NOW + MIN }
    const c = ctx({ cards: [answered, b], todayLogs: [makeLog(a, { state: CardState.New, reviewedAt: NOW })] })
    const p = prepare(c)
    expect(computeCounts(p).get('d1')!.new).toBe(0)
    // 已答過的那張仍在學習中，可繼續
    expect(computeCounts(p).get('d1')!.learning).toBe(1)
  })

  it('隔天兄弟卡恢復出現', () => {
    const [a, b] = siblings()
    const c = ctx({ cards: [{ ...a, state: CardState.Learning, due: NOW + MIN }, b], now: NOW + DAY, todayLogs: [] })
    expect(counts(c).new).toBe(1)
  })

  it('待複習優先於新卡', () => {
    const r = reviewCard({ id: 'r', noteId: 'n2', ordinal: 1 })
    const n = makeCard({ id: 'nn', noteId: 'n2', ordinal: 0 })
    const p = prepare(ctx({ cards: [n, r] }))
    expect(computeCounts(p).get('d1')).toEqual({ new: 0, learning: 0, review: 1 })
  })
})

describe('出卡順序', () => {
  it('學習中且已到期的卡最優先', () => {
    const c = ctx({
      cards: [
        reviewCard({ id: 'r' }),
        makeCard({ id: 'n' }),
        makeCard({ id: 'l', state: CardState.Learning, due: NOW - MIN }),
      ],
    })
    expect(pickNext(prepare(c), 'd1')!.card.id).toBe('l')
  })

  it('學習中但還沒到時間的卡，不會搶在其他卡前面', () => {
    const c = ctx({
      cards: [makeCard({ id: 'l', state: CardState.Learning, due: NOW + 5 * MIN }), reviewCard({ id: 'r' })],
    })
    expect(pickNext(prepare(c), 'd1')!.card.id).toBe('r')
  })

  it('learn ahead：其他卡做完、學習中卡片 20 分鐘內到期就提前顯示', () => {
    const soon = makeCard({ id: 'l1', state: CardState.Learning, due: NOW + LEARN_AHEAD_MS - MIN })
    const late = makeCard({ id: 'l2', state: CardState.Learning, due: NOW + LEARN_AHEAD_MS + 5 * MIN })
    expect(pickNext(prepare(ctx({ cards: [soon] })), 'd1')!.card.id).toBe('l1')
    expect(pickNext(prepare(ctx({ cards: [late] })), 'd1')).toBeNull()
  })

  it('新卡依新增順序出', () => {
    const c = ctx({ cards: [makeCard({ id: 'second', createdAt: 20 }), makeCard({ id: 'first', createdAt: 10 })] })
    expect(pickNext(prepare(c), 'd1')!.card.id).toBe('first')
  })

  it('待複習先出最久以前到期的', () => {
    const c = ctx({
      cards: [reviewCard({ id: 'recent', due: NOW - DAY }), reviewCard({ id: 'old', due: NOW - 5 * DAY })],
    })
    expect(pickNext(prepare(c), 'd1')!.card.id).toBe('old')
  })

  it('沒有卡可出時回傳 null，並算出明天的預計數量', () => {
    const c = ctx({ cards: [reviewCard({ due: NOW + DAY }), reviewCard({ due: NOW + 5 * DAY })] })
    const p = prepare(c)
    expect(pickNext(p, 'd1')).toBeNull()
    expect(computeDoneInfo(p, 'd1')).toMatchObject({ tomorrowReview: 1, tomorrowNew: 0 })
  })
})

describe('新卡與複習交錯', () => {
  it('只有一種時直接出那一種', () => {
    expect(chooseKind(0, 3, 0)!.kind).toBe('review')
    expect(chooseKind(3, 0, 0)!.kind).toBe('new')
    expect(chooseKind(0, 0, 0)).toBeNull()
  })

  it('新卡 2、複習 8：約每 5 張出 1 張新卡，且穿插在中間', () => {
    let credit = 0
    let n = 2
    let r = 8
    const seq: string[] = []
    while (n + r > 0) {
      const pick = chooseKind(n, r, credit)!
      credit = pick.credit
      seq.push(pick.kind[0])
      if (pick.kind === 'new') n--
      else r--
    }
    const s = seq.join('')
    expect(s.split('n').length - 1).toBe(2)
    expect(s.indexOf('n')).toBeGreaterThan(0)
    expect(s.indexOf('n')).toBeLessThan(s.length - 1)
  })
})
