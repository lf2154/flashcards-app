import { useMemo, useState } from 'react'
import { Modal } from './Modal'
import type { BrowseItem } from '../db/browse'
import { CardState } from '../db/types'
import { htmlToText } from '../lib/html'

/** 一次最多畫出這麼多列，卡片很多時請用搜尋縮小範圍 */
const MAX_ROWS = 200

const STATE_DOT: Record<number, { label: string; cls: string }> = {
  [CardState.New]: { label: '新卡', cls: 'bg-blue-500' },
  [CardState.Learning]: { label: '學習中', cls: 'bg-red-500' },
  [CardState.Relearning]: { label: '重新學習', cls: 'bg-red-500' },
  [CardState.Review]: { label: '複習中', cls: 'bg-green-500' },
}

/** 整副牌組的卡片清單（可搜尋），點一張就跳過去 */
export function CardListSheet(props: {
  items: BrowseItem[]
  currentCardId?: string
  onPick: (item: BrowseItem, index: number) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  // 先把每張卡的純文字算好，搜尋時才不會每打一個字就重算一次
  const rows = useMemo(
    () =>
      props.items.map((item, index) => {
        const front = htmlToText(item.note.front)
        const back = htmlToText(item.note.back)
        const reversed = item.note.type === 'basicReversed' && item.card.ordinal === 1
        return { item, index, q: reversed ? back : front, a: reversed ? front : back, search: `${front}\n${back}`.toLowerCase() }
      }),
    [props.items],
  )
  const q = query.trim().toLowerCase()
  const matched = q ? rows.filter((r) => r.search.includes(q)) : rows
  const shown = matched.slice(0, MAX_ROWS)

  return (
    <Modal title={`卡片清單（共 ${props.items.length} 張）`} onClose={props.onClose}>
      <input
        type="search"
        aria-label="搜尋卡片"
        placeholder="搜尋正面或背面的文字"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-2 h-12 w-full rounded-xl border border-slate-300 bg-transparent px-3 dark:border-slate-600"
      />
      {matched.length === 0 && <p className="py-6 text-center text-slate-500">找不到符合的卡片</p>}
      <ul className="-mx-1">
        {shown.map(({ item, index, q: front, a: back }) => {
          const dot = STATE_DOT[item.card.state]
          const current = item.card.id === props.currentCardId
          return (
            <li key={item.card.id}>
              <button
                onClick={() => props.onPick(item, index)}
                className={`flex min-h-14 w-full items-center gap-3 rounded-lg px-2 py-2 text-left active:bg-slate-100 dark:active:bg-slate-800 ${
                  current ? 'bg-indigo-50 dark:bg-indigo-950' : ''
                }`}
              >
                <span className="w-8 shrink-0 text-right text-xs text-slate-400 tabular-nums">{index + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{front || '（空白）'}</span>
                  <span className="block truncate text-sm text-slate-500">{back}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1 text-xs text-slate-500">
                  {item.card.suspended ? '已暫停' : dot?.label}
                  <span className={`h-2 w-2 rounded-full ${item.card.suspended ? 'bg-amber-500' : dot?.cls}`} />
                </span>
                {current && <span className="sr-only">（目前這張）</span>}
              </button>
            </li>
          )
        })}
      </ul>
      {matched.length > MAX_ROWS && (
        <p className="py-3 text-center text-sm text-slate-500">還有 {matched.length - MAX_ROWS} 張沒列出，請用搜尋縮小範圍</p>
      )}
    </Modal>
  )
}
