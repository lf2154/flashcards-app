import { beforeEach, describe, expect, it } from 'vitest'
import { fitWithin } from './image'
import { db } from '../db'
import { addMedia, cleanupOrphanMedia, mediaIdsIn } from '../db/media'
import { createDeck } from '../db/decks'
import { createNote } from '../db/notes'
import { setClockOffset } from './clock'

describe('圖片縮小', () => {
  it('長邊超過 1600 時等比縮小', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 })
    expect(fitWithin(3000, 4000)).toEqual({ width: 1200, height: 1600 })
  })
  it('本來就小的不放大', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 })
  })
})

describe('圖片資料', () => {
  beforeEach(async () => {
    setClockOffset(0)
    await Promise.all([db.decks, db.notes, db.cards, db.media].map((t) => t.clear()))
  })

  it('找出 HTML 引用的圖片', () => {
    expect(mediaIdsIn('<img src="media://a1"><p>x</p><img src="media://b-2"><img src="media://a1">')).toEqual(['a1', 'b-2'])
  })

  it('清理：只刪超過一天且沒被引用的圖片', async () => {
    const used = await addMedia(new Blob(['a'], { type: 'image/jpeg' }), 1, 1)
    const orphan = await addMedia(new Blob(['b'], { type: 'image/jpeg' }), 1, 1)
    const d = await createDeck('d')
    await createNote({ deckId: d, type: 'basic', front: `<img src="media://${used}">`, back: 'x' })

    expect(await cleanupOrphanMedia()).toBe(0) // 剛插入的圖片（可能還在編輯中）不刪
    setClockOffset(2 * 86_400_000)
    expect(await cleanupOrphanMedia()).toBe(1)
    expect((await db.media.toArray()).map((m) => m.id)).toEqual([used])
    expect(orphan).not.toBe(used)
    setClockOffset(0)
  })
})
