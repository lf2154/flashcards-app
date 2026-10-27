import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CountNumbers } from '../components/CountNumbers'
import { useDeckActions } from '../components/DeckActions'
import { db } from '../db'
import { useDeckCounts } from '../lib/hooks'

/** 牌組總覽：今日三種數字與大大的「開始學習」按鈕 */
export function DeckOverviewPage() {
  const { deckId = '' } = useParams()
  const navigate = useNavigate()
  // undefined＝載入中、null＝找不到
  const deck = useLiveQuery(() => db.decks.get(deckId).then((d) => d ?? null), [deckId])
  const counts = useDeckCounts()
  const actions = useDeckActions({ onDeleted: () => navigate('/', { replace: true }) })

  if (deck === undefined) return null
  if (deck === null) {
    return (
      <div className="px-4 pt-8 text-center">
        <p className="mb-4 text-slate-600 dark:text-slate-400">找不到這個牌組，可能已經被刪除了。</p>
        <Link to="/" className="text-indigo-600 dark:text-indigo-400">
          回到牌組列表
        </Link>
      </div>
    )
  }
  const c = counts?.get(deckId)
  const nothing = c && c.new + c.learning + c.review === 0

  return (
    <div className="px-4 pt-4">
      <div className="flex items-center justify-between">
        <Link to="/" className="flex h-12 items-center text-indigo-600 dark:text-indigo-400">
          ‹ 牌組
        </Link>
        <button aria-label="更多操作" className="h-12 w-12 text-2xl text-slate-500" onClick={() => actions.openMenu(deck)}>
          ⋯
        </button>
      </div>
      <h1 className="mt-1 text-2xl font-bold break-words">{deck.name}</h1>

      <div className="mt-8 flex flex-col items-center gap-2">
        <CountNumbers counts={c} large />
        <div className="flex text-xs text-slate-500">
          <span className="w-11 text-center">新卡</span>
          <span className="w-11 text-center">學習中</span>
          <span className="w-11 text-center">待複習</span>
        </div>
        {nothing && <p className="mt-3 text-sm text-slate-500">今天沒有要學的卡片了 🎉</p>}
      </div>

      <button
        className="mt-8 h-16 w-full rounded-2xl bg-indigo-600 text-xl font-semibold text-white active:bg-indigo-700"
        onClick={() => navigate(`/study/${deckId}`)}
      >
        開始學習
      </button>
      <div className="mt-3 flex gap-3">
        <Link
          to={`/add?deck=${deckId}`}
          className="flex h-12 flex-1 items-center justify-center rounded-xl border border-slate-300 font-medium dark:border-slate-600"
        >
          新增卡片
        </Link>
        <Link
          to={`/deck/${deckId}/settings`}
          className="flex h-12 flex-1 items-center justify-center rounded-xl border border-slate-300 font-medium dark:border-slate-600"
        >
          牌組設定
        </Link>
      </div>
      {actions.dialogs}
    </div>
  )
}
