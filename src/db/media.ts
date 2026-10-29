import { db } from './index'
import { newId } from '../lib/id'
import { now } from '../lib/clock'

// 圖片以 Blob 存在 IndexedDB 的 media 資料表；卡片內容用 media://ID 引用。

export const MEDIA_SCHEME = 'media://'
const MEDIA_REF = /media:\/\/([\w-]+)/g

export async function addMedia(blob: Blob, width: number, height: number): Promise<string> {
  const id = newId()
  await db.media.add({ id, blob, mimeType: blob.type || 'image/jpeg', width, height, createdAt: now() })
  return id
}

export async function getMediaBlob(id: string): Promise<Blob | undefined> {
  return (await db.media.get(id))?.blob
}

/** 一段 HTML 裡引用了哪些圖片 */
export function mediaIdsIn(html: string): string[] {
  return [...new Set([...html.matchAll(MEDIA_REF)].map((m) => m[1]))]
}

/** 刪除超過一天、而且沒有任何筆記引用的圖片（剛插入、還沒按儲存的圖片不會被刪） */
export async function cleanupOrphanMedia(olderThanMs = 86_400_000): Promise<number> {
  return db.transaction('rw', db.notes, db.media, async () => {
    const used = new Set<string>()
    await db.notes.each((n) => {
      for (const id of mediaIdsIn(n.front + n.back + n.extra)) used.add(id)
    })
    const cutoff = now() - olderThanMs
    const orphans = await db.media.filter((m) => !used.has(m.id) && m.createdAt < cutoff).primaryKeys()
    await db.media.bulkDelete(orphans)
    return orphans.length
  })
}
