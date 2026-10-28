import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './index'
import {
  buildDeckTree,
  createDeck,
  deleteDeck,
  flattenDeckTree,
  getDeckDeletionInfo,
  resetDeck,
  moveDeck,
  renameDeck,
  updateDeckSettings,
} from './decks'
import { createNote, deleteNote, findDuplicateNotes, planNoteUpdate, updateNote } from './notes'
import {
  answerCard,
  buryCardUntilTomorrow,
  getDeckCounts,
  getStudyState,
  restoreCardFlags,
  setSuspended,
  undoReview,
} from './study'
import { CardState } from './types'
import { getBrowseItems } from './browse'

const MIN = 60_000
const NOW = new Date(2026, 9, 27, 10, 0).getTime()

beforeEach(async () => {
  await Promise.all([db.decks, db.notes, db.cards, db.reviewLogs, db.media, db.settings].map((t) => t.clear()))
})

const note = (deckId: string, front: string, type: 'basic' | 'basicReversed' = 'basic') =>
  createNote({ deckId, type, front: `<p>${front}</p>`, back: '<p>答</p>' }, NOW)

describe('牌組管理', () => {
  it('用「::」一次建立多層，沿用已存在的上層', async () => {
    const leaf = await createDeck('英文::多益')
    await createDeck('英文::托福')
    const tree = buildDeckTree(await db.decks.toArray())
    expect(tree).toHaveLength(1)
    expect(tree[0].deck.name).toBe('英文')
    expect(tree[0].children.map((c) => c.path)).toEqual(['英文::多益', '英文::托福'])
    expect((await db.decks.get(leaf))!.parentId).toBe(tree[0].deck.id)
  })

  it('同一層不能有同名牌組、名稱不能空白', async () => {
    await createDeck('數學')
    await expect(createDeck('數學')).rejects.toThrow('已經有')
    await expect(createDeck('   ')).rejects.toThrow('請輸入')
  })

  it('改名、移動，並阻擋移到自己的子牌組底下', async () => {
    const a = await createDeck('甲')
    const b = await createDeck('乙', a)
    await renameDeck(a, '甲甲')
    expect((await db.decks.get(a))!.name).toBe('甲甲')
    await expect(moveDeck(a, b)).rejects.toThrow('不能把牌組移到')
    await moveDeck(b, null)
    expect((await db.decks.get(b))!.parentId).toBeNull()
    await expect(renameDeck(b, 'x::y')).rejects.toThrow('::')
  })

  it('可以修改牌組設定', async () => {
    const id = await createDeck('設定')
    await updateDeckSettings(id, { newPerDay: 5, learningSteps: [2, 15] })
    const s = (await db.decks.get(id))!.settings
    expect(s.newPerDay).toBe(5)
    expect(s.reviewPerDay).toBe(200)
    expect(s.learningSteps).toEqual([2, 15])
  })

  it('刪除前算得出會刪多少，刪除時子牌組、筆記、卡片、紀錄一併消失', async () => {
    const parent = await createDeck('父')
    const child = await createDeck('子', parent)
    const keep = await createDeck('保留')
    await note(parent, 'a')
    const n2 = await note(child, 'b', 'basicReversed')
    await note(keep, 'c')
    const [firstCard] = await db.cards.where('noteId').equals(n2).toArray()
    await answerCard(firstCard.id, 3, NOW, NOW)

    expect(await getDeckDeletionInfo(parent)).toEqual({ decks: 2, notes: 2, cards: 3 })
    await deleteDeck(parent)
    expect(await db.decks.count()).toBe(1)
    expect(await db.notes.count()).toBe(1)
    expect(await db.cards.count()).toBe(1)
    expect(await db.reviewLogs.count()).toBe(0)
  })

  it('重置牌組：含子牌組的卡全部變回新卡、刪除紀錄；暫停與旗幟保留；其他牌組不受影響', async () => {
    const parent = await createDeck('父')
    const child = await createDeck('子', parent)
    const other = await createDeck('其他')
    await note(parent, 'a')
    await note(child, 'b')
    await note(other, 'c')
    const [a, b, c] = await Promise.all(
      [parent, child, other].map(async (d) => (await db.cards.where('deckId').equals(d).toArray())[0]),
    )
    for (const card of [a, b, c]) await answerCard(card.id, 3, NOW, NOW)
    await setSuspended(b.id, true)
    await buryCardUntilTomorrow(a.id, NOW)
    await db.cards.update(a.id, { flag: 2 })

    expect(await resetDeck(parent, NOW + 5000)).toBe(2)
    const ra = (await db.cards.get(a.id))!
    expect(ra).toMatchObject({ state: CardState.New, reps: 0, lapses: 0, last_review: null, buried: false, flag: 2 })
    expect((await db.cards.get(b.id))!).toMatchObject({ state: CardState.New, suspended: true })
    expect((await db.cards.get(c.id))!.state).toBe(CardState.Learning)
    expect((await db.reviewLogs.toArray()).map((l) => l.cardId)).toEqual([c.id])
    // 今天的新卡額度也跟著回來
    expect((await getDeckCounts(NOW + 6000)).get(parent)!.new).toBe(1)
  })

  it('攤平成含完整路徑的清單', async () => {
    await createDeck('英文::多益')
    expect(flattenDeckTree(buildDeckTree(await db.decks.toArray())).map((x) => x.path)).toEqual(['英文', '英文::多益'])
  })
})

describe('筆記與卡片', () => {
  it('基本卡 1 張、反轉卡 2 張', async () => {
    const d = await createDeck('d')
    const basic = await note(d, 'basic')
    const rev = await note(d, 'rev', 'basicReversed')
    expect(await db.cards.where('noteId').equals(basic).count()).toBe(1)
    const revCards = await db.cards.where('noteId').equals(rev).sortBy('ordinal')
    expect(revCards.map((c) => c.ordinal)).toEqual([0, 1])
    expect(revCards.every((c) => c.state === CardState.New)).toBe(true)
  })

  it('填空卡在階段 3 之前不能建立', async () => {
    const d = await createDeck('d')
    await expect(createNote({ deckId: d, type: 'cloze', front: '{{c1::a}}', back: '' })).rejects.toThrow('階段 3')
  })

  it('基本 → 基本＋反轉：新增反向卡，正向卡保留複習進度', async () => {
    const d = await createDeck('d')
    const id = await note(d, 'x')
    const [card] = await db.cards.where('noteId').equals(id).toArray()
    await answerCard(card.id, 3, NOW, NOW)
    const learned = (await db.cards.get(card.id))!

    expect((await planNoteUpdate(id, { type: 'basicReversed' })).addOrdinals).toEqual([1])
    await updateNote(id, { type: 'basicReversed' })
    const cards = await db.cards.where('noteId').equals(id).sortBy('ordinal')
    expect(cards).toHaveLength(2)
    expect(cards[0].id).toBe(card.id)
    expect(cards[0].state).toBe(learned.state)
    expect(cards[0].due).toBe(learned.due)
    expect(cards[1].state).toBe(CardState.New)
  })

  it('基本＋反轉 → 基本：先算出會刪幾張，刪除反向卡與其紀錄、保留正向卡', async () => {
    const d = await createDeck('d')
    const id = await note(d, 'x', 'basicReversed')
    const [fwd, rev] = await db.cards.where('noteId').equals(id).sortBy('ordinal')
    await answerCard(rev.id, 3, NOW, NOW)
    await answerCard(fwd.id, 3, NOW, NOW)

    const plan = await planNoteUpdate(id, { type: 'basic' })
    expect(plan.removeCards.map((c) => c.id)).toEqual([rev.id])
    await updateNote(id, { type: 'basic' })
    expect((await db.cards.where('noteId').equals(id).toArray()).map((c) => c.id)).toEqual([fwd.id])
    expect((await db.reviewLogs.toArray()).map((l) => l.cardId)).toEqual([fwd.id])
  })

  it('只改文字不影響卡片與進度；換牌組時卡片跟著搬', async () => {
    const d1 = await createDeck('d1')
    const d2 = await createDeck('d2')
    const id = await note(d1, 'x')
    const [card] = await db.cards.where('noteId').equals(id).toArray()
    await answerCard(card.id, 3, NOW, NOW)
    await updateNote(id, { front: '<p>改了</p>', tags: [' a ', 'a', 'b'], deckId: d2 })
    const after = (await db.cards.get(card.id))!
    expect(after.deckId).toBe(d2)
    expect(after.state).toBe(CardState.Learning)
    expect((await db.notes.get(id))!.tags).toEqual(['a', 'b'])
  })

  it('刪除筆記連同卡片與紀錄', async () => {
    const d = await createDeck('d')
    const id = await note(d, 'x', 'basicReversed')
    const [c] = await db.cards.where('noteId').equals(id).toArray()
    await answerCard(c.id, 3, NOW, NOW)
    await deleteNote(id)
    expect(await db.notes.count()).toBe(0)
    expect(await db.cards.count()).toBe(0)
    expect(await db.reviewLogs.count()).toBe(0)
  })

  it('防重複：以去除標籤後的純文字比對，只看同牌組', async () => {
    const d1 = await createDeck('d1')
    const d2 = await createDeck('d2')
    const id = await createNote({ deckId: d1, type: 'basic', front: '<p><strong>apple</strong></p>', back: '' }, NOW)
    expect(await findDuplicateNotes(d1, '<p> apple </p>')).toHaveLength(1)
    expect(await findDuplicateNotes(d1, 'apple', id)).toHaveLength(0)
    expect(await findDuplicateNotes(d2, 'apple')).toHaveLength(0)
    expect(await findDuplicateNotes(d1, '<p></p>')).toHaveLength(0)
  })
})

describe('複習流程', () => {
  async function setup(n = 5) {
    const d = await createDeck('d')
    for (let i = 0; i < n; i++) await createNote({ deckId: d, type: 'basic', front: `<p>q${i}</p>`, back: '<p>a</p>' }, NOW + i)
    return d
  }

  it('建 5 張卡，首頁顯示 5 張新卡', async () => {
    const d = await setup(5)
    expect((await getDeckCounts(NOW)).get(d)).toEqual({ new: 5, learning: 0, review: 0 })
  })

  it('取卡回傳正面內容與四個鍵的間隔預覽', async () => {
    const d = await setup(5)
    const s = await getStudyState(d, NOW)
    expect(s.next!.note.front).toBe('<p>q0</p>')
    expect(s.next!.kind).toBe('new')
    expect(s.next!.previews[1].label).toBe('1分')
    expect(s.next!.previews[3].label).toBe('10分')
  })

  it('按「重來」：卡片進入學習中、1 分鐘後到期、寫入複習紀錄、數字更新', async () => {
    const d = await setup(5)
    const s = await getStudyState(d, NOW)
    const logId = await answerCard(s.next!.card.id, 1, NOW, NOW + 5000)
    const card = (await db.cards.get(s.next!.card.id))!
    expect(card.state).toBe(CardState.Learning)
    expect(card.due).toBe(NOW + 5000 + 1 * MIN)
    const log = (await db.reviewLogs.get(logId))!
    expect(log).toMatchObject({ rating: 1, state: CardState.New, durationMs: 5000 })

    const s2 = await getStudyState(d, NOW + 6000)
    expect(s2.counts).toEqual({ new: 4, learning: 1, review: 0 })
    // 1 分鐘還沒到，先出下一張新卡
    expect(s2.next!.card.id).not.toBe(card.id)
    // 1 分鐘後這張回來
    const s3 = await getStudyState(d, NOW + 5000 + MIN)
    expect(s3.next!.card.id).toBe(card.id)
    expect(s3.next!.kind).toBe('learning')
  })

  it('復原：卡片整組排程還原、刪除複習紀錄、數字回到原狀', async () => {
    const d = await setup(3)
    const before = await getStudyState(d, NOW)
    const cardBefore = { ...before.next!.card }
    const logId = await answerCard(cardBefore.id, 3, NOW, NOW + 3000)
    expect((await db.cards.get(cardBefore.id))!.state).toBe(CardState.Learning)

    expect(await undoReview(logId)).toBe(cardBefore.id)
    expect(await db.cards.get(cardBefore.id)).toEqual(cardBefore)
    expect(await db.reviewLogs.count()).toBe(0)
    expect((await getDeckCounts(NOW)).get(d)).toEqual({ new: 3, learning: 0, review: 0 })
    expect(await undoReview(logId)).toBeNull() // 重複復原不會出錯
  })

  it('連續復原：複習兩張後，依序復原回去', async () => {
    const d = await setup(3)
    const a = (await getStudyState(d, NOW)).next!
    const l1 = await answerCard(a.card.id, 3, NOW, NOW)
    const b = (await getStudyState(d, NOW)).next!
    const l2 = await answerCard(b.card.id, 4, NOW, NOW)
    await undoReview(l2)
    await undoReview(l1)
    expect((await db.cards.get(a.card.id))!.state).toBe(CardState.New)
    expect((await db.cards.get(b.card.id))!.state).toBe(CardState.New)
  })

  it('每日新卡上限依今天 reviewLogs 實際數量計算，隔天重新開始', async () => {
    const d = await setup(5)
    await updateDeckSettings(d, { newPerDay: 2 })
    expect((await getDeckCounts(NOW)).get(d)!.new).toBe(2)
    const s = (await getStudyState(d, NOW)).next!
    await answerCard(s.card.id, 3, NOW, NOW)
    expect((await getDeckCounts(NOW + 1000)).get(d)!.new).toBe(1)
    await undoReview((await db.reviewLogs.toArray())[0].id)
    expect((await getDeckCounts(NOW + 1000)).get(d)!.new).toBe(2)
    // 隔天（越過凌晨 4 點）
    await answerCard(s.card.id, 3, NOW, NOW)
    const tomorrow = NOW + 24 * 60 * MIN
    expect((await getDeckCounts(tomorrow)).get(d)!.new).toBe(2)
  })

  it('暫停：不再出現，取消暫停後回來', async () => {
    const d = await setup(1)
    const c = (await getStudyState(d, NOW)).next!.card
    const before = await setSuspended(c.id, true)
    expect(before.suspended).toBe(false)
    const s = await getStudyState(d, NOW)
    expect(s.next).toBeNull()
    expect(s.done).not.toBeNull()
    await setSuspended(c.id, false)
    expect((await getStudyState(d, NOW)).next!.card.id).toBe(c.id)
  })

  it('埋到明天：今天不出現、隔天自動恢復；可復原', async () => {
    const d = await setup(1)
    const c = (await getStudyState(d, NOW)).next!.card
    const prev = await buryCardUntilTomorrow(c.id, NOW)
    expect((await getStudyState(d, NOW)).next).toBeNull()
    expect((await getStudyState(d, NOW + 24 * 60 * MIN)).next!.card.id).toBe(c.id)
    await restoreCardFlags(c.id, prev)
    expect((await getStudyState(d, NOW)).next!.card.id).toBe(c.id)
  })

  it('跳過不會改變卡片的排程，也不寫入複習紀錄', async () => {
    const d = await setup(2)
    const first = (await getStudyState(d, NOW)).next!
    const before = await db.cards.get(first.card.id)
    const s = await getStudyState(d, NOW, { skip: new Set([first.card.id]) })
    expect(s.next!.card.id).not.toBe(first.card.id)
    expect(s.counts).toEqual({ new: 2, learning: 0, review: 0 })
    expect(await db.cards.get(first.card.id)).toEqual(before)
    expect(await db.reviewLogs.count()).toBe(0)
  })

  it('反轉卡的兩面今天只出一張，做完後明天預計顯示', async () => {
    const d = await createDeck('d')
    await createNote({ deckId: d, type: 'basicReversed', front: '<p>x</p>', back: '<p>y</p>' }, NOW)
    const first = (await getStudyState(d, NOW)).next!
    expect(first.card.ordinal).toBe(0)
    await answerCard(first.card.id, 4, NOW, NOW) // 簡單：畢業
    const after = await getStudyState(d, NOW + 1000)
    expect(after.next).toBeNull() // 反向卡延到明天
    expect(after.done!.tomorrowNew).toBe(1)
  })
})

describe('瀏覽模式', () => {
  it('列出牌組（含子牌組）所有卡片：依牌組順序、新增時間、卡片編號；包含暫停的卡', async () => {
    const parent = await createDeck('A')
    const child = await createDeck('B', parent)
    await createNote({ deckId: child, type: 'basic', front: '<p>child</p>', back: '<p>x</p>' }, NOW)
    await createNote({ deckId: parent, type: 'basicReversed', front: '<p>p2</p>', back: '<p>y</p>' }, NOW + 2)
    await createNote({ deckId: parent, type: 'basic', front: '<p>p1</p>', back: '<p>z</p>' }, NOW + 1)
    const [first] = await db.cards.toArray()
    await setSuspended(first.id, true)

    const items = (await getBrowseItems(parent))!
    expect(items.map((x) => `${x.note.front}#${x.card.ordinal}`)).toEqual([
      '<p>p1</p>#0',
      '<p>p2</p>#0',
      '<p>p2</p>#1',
      '<p>child</p>#0',
    ])
    expect(items[3].deckPath).toBe('A::B')
    expect(await getBrowseItems('nope')).toBeNull()
  })

  it('瀏覽不會改變任何卡片或紀錄', async () => {
    const d = await createDeck('d')
    await note(d, 'x')
    const before = await db.cards.toArray()
    await getBrowseItems(d)
    expect(await db.cards.toArray()).toEqual(before)
    expect(await db.reviewLogs.count()).toBe(0)
  })
})
