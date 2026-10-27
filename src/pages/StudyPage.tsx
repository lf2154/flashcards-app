import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FlipCard } from '../components/FlipCard'
import { ActionSheet } from '../components/Modal'
import { NavArrows } from '../components/NavArrows'
import { useToast } from '../components/Toast'
import { db } from '../db'
import { SETTING_KEYS } from '../db/settings'
import {
  answerCard,
  buryCardUntilTomorrow,
  getStudyState,
  restoreCardFlags,
  setFlag,
  setSuspended,
  undoReview,
  type CardFlags,
  type StudyCard,
  type StudyState,
} from '../db/study'
import type { Rating } from '../db/types'
import { now } from '../lib/clock'
import { errorMessage } from '../lib/errors'
import { useSwipe } from '../lib/useSwipe'
import { formatInterval } from '../scheduler/fsrs'

/** 「上一張」可以回到的動作：評分、跳過、暫停／埋卡／旗幟 */
type UndoEntry =
  | { kind: 'review'; logId: string }
  | { kind: 'skip'; cardId: string }
  | { kind: 'flags'; cardId: string; prev: CardFlags }

const RATING_UI: { rating: Rating; label: string; color: string }[] = [
  { rating: 1, label: '重來', color: 'bg-red-600 active:bg-red-700' },
  { rating: 2, label: '困難', color: 'bg-orange-500 active:bg-orange-600' },
  { rating: 3, label: '良好', color: 'bg-green-600 active:bg-green-700' },
  { rating: 4, label: '簡單', color: 'bg-blue-600 active:bg-blue-700' },
]

const FLAG_NAMES = ['無旗幟', '紅旗', '橘旗', '綠旗', '藍旗']
const FLAG_COLORS = ['', 'bg-red-500', 'bg-orange-500', 'bg-green-500', 'bg-blue-500']

export function StudyPage() {
  const { deckId = '' } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [state, setState] = useState<StudyState | null>(null)
  // 卡片翻到背面（看得到答案）；評分鍵只在背面時出現
  const [flipped, setFlipped] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [undoCount, setUndoCount] = useState(0)
  const undoStack = useRef<UndoEntry[]>([])
  const credit = useRef(0)
  // 這一輪被「跳過」的卡；其他卡都輪完了才會回來
  const skipped = useRef<Set<string>>(new Set())
  // 用 ref 擋連點：state 要等下次繪製才更新，連按兩下可能兩次都通過
  const busyRef = useRef(false)
  const swipeSetting = useLiveQuery(() => db.settings.get(SETTING_KEYS.swipeGestures), [])
  const swipeOn = swipeSetting?.value !== false

  const load = useCallback(
    async (forceCardId?: string) => {
      const s = await getStudyState(deckId, now(), { credit: credit.current, forceCardId, skip: skipped.current })
      if (s.next && !forceCardId) credit.current = s.next.credit
      if (s.skipCleared) skipped.current = new Set()
      setState(s)
      setFlipped(false)
      return s
    },
    [deckId],
  )

  useEffect(() => {
    load().catch((e) => setError(errorMessage(e)))
  }, [load])

  // 所有會改資料的動作共用：防連點、錯誤提示
  const run = useCallback(async (fn: () => Promise<void>) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }, [])

  const card: StudyCard | null = state?.next ?? null

  const pushUndo = (entry: UndoEntry) => {
    undoStack.current.push(entry)
    setUndoCount(undoStack.current.length)
  }

  const rate = useCallback(
    (rating: Rating) => {
      if (!card || !flipped) return
      void run(async () => {
        const logId = await answerCard(card.card.id, rating, card.shownAt, now())
        pushUndo({ kind: 'review', logId })
        await load()
      })
    },
    [card, flipped, run, load],
  )

  /** 上一張：回到上一張卡（評分過的會復原評分） */
  const goBack = useCallback(() => {
    const entry = undoStack.current.pop()
    if (!entry) return
    setUndoCount(undoStack.current.length)
    void run(async () => {
      if (entry.kind === 'review') {
        const cardId = await undoReview(entry.logId)
        await load(cardId ?? undefined)
        toast('已復原上一張的評分')
      } else if (entry.kind === 'skip') {
        skipped.current.delete(entry.cardId)
        await load(entry.cardId)
        toast('回到上一張')
      } else {
        await restoreCardFlags(entry.cardId, entry.prev)
        await load(entry.cardId)
        toast('已復原')
      }
    })
  }, [run, load, toast])

  /** 下一張：這張先跳過、不評分，等其他卡輪完再出現 */
  const skip = useCallback(() => {
    if (!card) return
    const id = card.card.id
    void run(async () => {
      skipped.current.add(id)
      pushUndo({ kind: 'skip', cardId: id })
      const s = await load()
      if (s.next?.card.id === id) toast('沒有其他卡片了')
    })
  }, [card, run, load, toast])

  const flagsAction = (change: () => Promise<CardFlags>, message: string, keepCard: boolean) => {
    if (!card) return
    void run(async () => {
      const prev = await change()
      pushUndo({ kind: 'flags', cardId: card.card.id, prev })
      await load(keepCard ? card.card.id : undefined)
      toast(message)
    })
  }

  const toggleFlip = useCallback(() => {
    if (card) setFlipped((f) => !f)
  }, [card])

  // 鍵盤快捷鍵：空白鍵翻面，1–4 評分，Ctrl+Z 或 ← 上一張，→ 下一張
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') || e.key === 'ArrowLeft') {
        e.preventDefault()
        goBack()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        skip()
      } else if (e.key === ' ') {
        e.preventDefault()
        toggleFlip()
      } else if (['1', '2', '3', '4'].includes(e.key)) {
        rate(Number(e.key) as Rating)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [rate, goBack, skip, toggleFlip])

  // 滑動手勢（翻到背面後：左滑＝重來、右滑＝良好）
  const swipe = useSwipe({ enabled: swipeOn && flipped && !busy, onLeft: () => rate(1), onRight: () => rate(3) })

  const counts = state?.counts
  const kind = card?.kind
  const count = (n: number | undefined, color: string, active: boolean, label: string) => (
    <span className={`${color} px-1.5 text-lg font-semibold tabular-nums ${active ? 'underline underline-offset-4' : ''}`} aria-label={`${label} ${n ?? 0}`}>
      {n ?? 0}
    </span>
  )
  const flag = card?.card.flag ?? 0

  return (
    <div className="pt-safe fixed inset-0 flex flex-col bg-slate-100 dark:bg-slate-950">
      <header className="flex h-14 shrink-0 items-center justify-between px-1">
        <Link to={`/deck/${deckId}`} aria-label="返回牌組" className="flex h-12 w-11 items-center justify-center text-slate-500">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </Link>
        <div className="flex">
          {count(counts?.new, 'text-new', kind === 'new', '新卡')}
          {count(counts?.learning, 'text-learning', kind === 'learning', '學習中')}
          {count(counts?.review, 'text-due', kind === 'review', '待複習')}
        </div>
        <div className="flex items-center">
          <NavArrows
            prevLabel="上一張"
            nextLabel="下一張"
            prevAria="上一張（回到上一張卡）"
            nextAria="下一張（這張先跳過）"
            prevDisabled={undoCount === 0 || busy}
            nextDisabled={!card || busy}
            onPrev={goBack}
            onNext={skip}
          />
          <button aria-label="更多操作" disabled={!card} className="h-12 w-10 text-2xl text-slate-500 disabled:opacity-30" onClick={() => setMenuOpen(true)}>
            ⋯
          </button>
        </div>
      </header>

      <main
        className="relative min-h-0 flex-1 overflow-y-auto"
        style={{ touchAction: 'pan-y' }}
        onClick={() => !swipe.wasDrag() && toggleFlip()}
        {...swipe.handlers}
      >
        {card && (
          <div
            className="relative mx-auto max-w-xl px-4 py-6"
            style={{ transform: swipe.dragX ? `translateX(${swipe.dragX * 0.5}px)` : undefined, transition: swipe.dragX ? 'none' : 'transform 150ms' }}
          >
            {flag > 0 && <div className={`absolute top-6 bottom-6 left-4 z-10 w-1.5 rounded-l-2xl ${FLAG_COLORS[flag]}`} aria-label={FLAG_NAMES[flag]} />}
            <FlipCard key={`${card.card.id}-${card.shownAt}`} note={card.note} ordinal={card.card.ordinal} flipped={flipped} />
          </div>
        )}
        {state && !card && <DoneView state={state} deckId={deckId} onRefresh={() => run(async () => void (await load()))} />}
        {!state && !error && <p className="pt-20 text-center text-slate-400">載入中…</p>}
      </main>

      {error && (
        <p role="alert" className="mx-4 mb-2 rounded-lg bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}

      {card && (
        <footer className="pb-safe shrink-0 border-t border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
          {!flipped ? (
            <button className="h-14 w-full rounded-xl bg-indigo-600 text-lg font-semibold text-white active:bg-indigo-700" onClick={() => setFlipped(true)}>
              顯示答案
            </button>
          ) : (
            <div className="flex gap-2">
              {RATING_UI.map((r) => (
                <button
                  key={r.rating}
                  disabled={busy}
                  onClick={() => rate(r.rating)}
                  className={`flex h-14 flex-1 flex-col items-center justify-center rounded-xl text-white disabled:opacity-60 ${r.color}`}
                >
                  <span className="text-xs opacity-90">{card.previews[r.rating].label}</span>
                  <span className="text-base font-semibold">{r.label}</span>
                </button>
              ))}
            </div>
          )}
        </footer>
      )}

      {menuOpen && card && (
        <ActionSheet
          title="這張卡片"
          onClose={() => setMenuOpen(false)}
          actions={[
            { label: '編輯此卡', onClick: () => navigate(`/note/${card.note.id}`) },
            { label: '暫停此卡', onClick: () => flagsAction(() => setSuspended(card.card.id, true), '已暫停此卡', false) },
            { label: '埋到明天', onClick: () => flagsAction(() => buryCardUntilTomorrow(card.card.id, now()), '已埋到明天', false) },
            {
              label: `標記旗幟：${FLAG_NAMES[flag]} → ${FLAG_NAMES[(flag + 1) % 5]}`,
              onClick: () => flagsAction(() => setFlag(card.card.id, (flag + 1) % 5), FLAG_NAMES[(flag + 1) % 5], true),
            },
          ]}
        />
      )}
    </div>
  )
}

function DoneView({ state, deckId, onRefresh }: { state: StudyState; deckId: string; onRefresh: () => void }) {
  const done = state.done
  if (!done) return null
  if (done.totalCards === 0) {
    return (
      <div className="px-6 pt-20 text-center">
        <p className="mb-4 text-lg">這個牌組還沒有卡片</p>
        <Link to={`/add?deck=${deckId}`} className="inline-flex h-12 items-center rounded-xl bg-indigo-600 px-6 font-medium text-white">
          新增卡片
        </Link>
      </div>
    )
  }
  return (
    <div className="px-6 pt-16 text-center">
      <p className="text-5xl">🎉</p>
      <h2 className="mt-4 text-2xl font-bold">恭喜！今天的卡片已完成</h2>
      <p className="mt-4 text-slate-600 dark:text-slate-400">
        明天預計：新卡 <b className="text-new">{done.tomorrowNew}</b> 張、待複習 <b className="text-due">{done.tomorrowReview}</b> 張
      </p>
      {done.laterLearning > 0 && done.nextLearningDue !== null && (
        <div className="mt-4 rounded-xl bg-white p-3 text-sm text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-400">
          還有 {done.laterLearning} 張學習中的卡片，最快 {formatInterval(Math.max(0, done.nextLearningDue - now()))}後到期。
          <button className="mt-2 block h-12 w-full rounded-lg border border-slate-300 font-medium dark:border-slate-600" onClick={onRefresh}>
            重新整理
          </button>
        </div>
      )}
      <div className="mt-8 flex flex-col items-center gap-3">
        <Link to={`/deck/${deckId}/browse`} className="inline-flex h-12 items-center rounded-xl border border-slate-300 px-8 font-medium dark:border-slate-600">
          瀏覽所有卡片
        </Link>
        <Link to={`/deck/${deckId}`} className="inline-flex h-12 items-center rounded-xl bg-indigo-600 px-8 font-medium text-white">
          返回牌組
        </Link>
      </div>
    </div>
  )
}
