import { useEffect, useMemo, useState } from 'react'
import { getMediaBlob, mediaIdsIn } from '../db/media'

/**
 * 把 HTML 裡的 media://ID 換成可以顯示的 Object URL。
 * 離開畫面（或內容改變）時釋放 URL，避免記憶體越用越多（SPEC 10.6）。
 * 圖片還沒載入好之前先不放 src；找不到的圖片顯示「（圖片遺失）」。
 */
export function useMediaHtml(html: string): string {
  const ids = useMemo(() => mediaIdsIn(html), [html])
  const key = ids.join(',')
  const [urls, setUrls] = useState<{ key: string; map: Record<string, string | null> }>({ key: '', map: {} })

  useEffect(() => {
    if (!key) return
    let alive = true
    const created: string[] = []
    void (async () => {
      const map: Record<string, string | null> = {}
      for (const id of key.split(',')) {
        const blob = await getMediaBlob(id).catch(() => undefined)
        if (blob) {
          const u = URL.createObjectURL(blob)
          created.push(u)
          map[id] = u
        } else map[id] = null
      }
      if (alive) setUrls({ key, map })
      else created.forEach((u) => URL.revokeObjectURL(u))
    })()
    return () => {
      alive = false
      created.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [key])

  if (!key) return html
  const ready = urls.key === key
  return html.replace(/<img src="media:\/\/([\w-]+)"([^>]*)>/g, (_, id: string, rest: string) => {
    if (!ready) return `<img${rest} data-loading="">`
    const u = urls.map[id]
    return u ? `<img src="${u}"${rest}>` : '<span class="text-slate-400">（圖片遺失）</span>'
  })
}
