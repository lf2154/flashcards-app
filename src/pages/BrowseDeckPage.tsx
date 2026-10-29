import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FlipCard } from '../components/FlipCard'
import { ActionSheet } from '../components/Modal'
import { CardListSheet } from '../components/CardListSheet'
import { ListButton } from '../components/ListButton'
import { getBrowseItems } from '../db/browse'
import { CardState } from '../db/types'
import { useSwipe } from '../lib/useSwipe'
import { useCardSpeech } from '../lib/useCardSpeech'
import { primeSpeech } from '../lib/speech'

const STATE_LABELS: Record<number, { text: string; cls: string }> = {
  [CardState.New]: { text: '新卡', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200' },
  [CardState.Learning]: { text: '學習中', cls: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200' },
  [CardState.Relearning]: { text: '重新學習', cls: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200' },
  [CardState.Review]: { text: '複習中', cls: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200' },
}

/**
 * 瀏覽模式：像翻一疊卡片一樣自由前後切換、隨時翻面看答案。
 * 不評分、不改變任何排程。
 */
export function BrowseDeckPage() {
  const { deckId = '' } = useParams()
  const navigate = useNavigate()
  const items = useLiveQuery(() => getBrowseItems(deckId), [deckId])
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const speakCard = useCardSpeech()

  const total = items?.length ?? 0
  // 卡片被刪除後清單變短時，停在最後一張
  const i = Math.min(index, Math.max(0, total - 1))
  const item = items?.[i]

  const go = useCallback(
    (delta: number) => {
      const next = i + delta
      if (next < 0 || next >= total) return
      setIndex(next)
      setFlipped(false)
    },
    [i, total],
  )

  useEffect(() => {
    if (menuOpen || listOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === ' ') {
        e.preventDefault()
        setFlipped((f) => !f)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, menuOpen, listOpen])

  // 像翻相簿：左滑看下一張、右滑看上一張
  const swipe = useSwipe({ enabled: total > 1, onLeft: () => go(1), onRight: () => go(-1) })

  if (items === undefined) return null
  if (items === null) {
    return (
      <div className="pt-safe px-4 pt-8 text-center">
        <p className="mb-4 text-slate-600 dark:text-slate-400">找不到這個牌組，可能已經被刪除了。</p>
        <Link to="/" className="text-indigo-600 dark:text-indigo-400">
          回到牌組列表
        </Link>
      </div>
    )
  }

  const badge = item ? STATE_LABELS[item.card.state] : undefined

  return (
    <div className="pt-safe fixed inset-0 flex flex-col bg-slate-100 dark:bg-slate-950">
      <header className="flex h-14 shrink-0 items-center justify-between px-1">
        <Link to={`/deck/${deckId}`} aria-label="返回牌組" className="flex h-12 w-11 items-center justify-center text-slate-500">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </Link>
        <div className="text-center leading-tight">
          <div className="text-xs text-slate-500">瀏覽模式</div>
          <div className="font-semibold tabular-nums">{total ? `${i + 1} / ${total}` : '0 / 0'}</div>
        </div>
        <div className="flex items-center">
          <ListButton onClick={() => setListOpen(true)} disabled={total === 0} />
          <button aria-label="更多操作" disabled={!item} className="h-12 w-10 text-2xl text-slate-500 disabled:opacity-30" onClick={() => setMenuOpen(true)}>
            ⋯
          </button>
        </div>
      </header>

      <main
        className="relative min-h-0 flex-1 overflow-y-auto"
        style={{ touchAction: 'pan-y' }}
        onClick={() => {
          if (!item || swipe.wasDrag()) return
          primeSpeech()
          setFlipped((f) => !f)
        }}
        {...swipe.handlers}
      >
        {item ? (
          <div
            className="mx-auto max-w-xl px-4 py-6"
            style={{ transform: swipe.drag.x ? `translateX(${swipe.drag.x * 0.5}px)` : undefined, transition: swipe.drag.x ? 'none' : 'transform 150ms' }}
          >
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
              {badge && <span className={`rounded-full px-2 py-0.5 ${badge.cls}`}>{badge.text}</span>}
              {item.card.suspended && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900 dark:bg-amber-950 dark:text-amber-200">已暫停</span>}
              {item.note.type === 'basicReversed' && (
                <span className="text-slate-500">{item.card.ordinal === 1 ? '反→正' : '正→反'}</span>
              )}
              <span className="ml-auto truncate text-slate-500">{item.deckPath}</span>
            </div>
            <FlipCard
              key={item.card.id}
              note={item.note}
              ordinal={item.card.ordinal}
              flipped={flipped}
              onSpeak={(side) => speakCard(item.note, item.card.ordinal, item.deck, side)}
            />
            <p className="mt-3 text-center text-xs text-slate-400">點卡片翻面 · 左滑下一張 · 右滑上一張；瀏覽不會影響複習排程</p>
          </div>
        ) : (
          <div className="px-6 pt-20 text-center">
            <p className="mb-4 text-lg">這個牌組還沒有卡片</p>
            <Link to={`/add?deck=${deckId}`} className="inline-flex h-12 items-center rounded-xl bg-indigo-600 px-6 font-medium text-white">
              新增卡片
            </Link>
          </div>
        )}
      </main>

      {item && (
        <footer className="pb-safe shrink-0 border-t border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
          <button
            className="h-14 w-full rounded-xl bg-indigo-600 text-lg font-semibold text-white active:bg-indigo-700"
            onClick={() => setFlipped((f) => !f)}
          >
            {flipped ? '蓋回' : '顯示答案'}
          </button>
        </footer>
      )}

      {listOpen && (
        <CardListSheet
          items={items}
          currentCardId={item?.card.id}
          onClose={() => setListOpen(false)}
          onPick={(_, index) => {
            setIndex(index)
            setFlipped(false)
            setListOpen(false)
          }}
        />
      )}

      {menuOpen && item && (
        <ActionSheet title="這張卡片" onClose={() => setMenuOpen(false)} actions={[{ label: '編輯此卡', onClick: () => navigate(`/note/${item.note.id}`) }]} />
      )}
    </div>
  )
}
