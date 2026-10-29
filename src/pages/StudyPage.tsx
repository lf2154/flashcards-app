import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CardListSheet } from '../components/CardListSheet'
import { FlipCard } from '../components/FlipCard'
import { ListButton } from '../components/ListButton'
import { ActionSheet } from '../components/Modal'
import { useToast } from '../components/Toast'
import { db } from '../db'
import { getBrowseItems, type BrowseItem } from '../db/browse'
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
import { useSwipe, type SwipeDirection } from '../lib/useSwipe'
import { useCardSpeech } from '../lib/useCardSpeech'
import { primeSpeech, stopSpeaking } from '../lib/speech'
import { formatInterval } from '../scheduler/fsrs'

/** 「上一張」可以回到的動作：評分、跳過、暫停／埋卡／旗幟 */
type UndoEntry =
  | { kind: 'review'; logId: string }
  | { kind: 'skip'; cardId: string }
  | { kind: 'flags'; cardId: string; prev: CardFlags }

/** 只留兩個評分：忘記＝FSRS 的「重來」、OK＝FSRS 的「良好」 */
const FORGOT: Rating = 1
const OK: Rating = 3
const RATING_UI: { rating: Rating; label: string; color: string }[] = [
  { rating: FORGOT, label: '忘記', color: 'bg-red-600 active:bg-red-700' },
  { rating: OK, label: 'OK', color: 'bg-green-600 active:bg-green-700' },
]

const FLAG_NAMES = ['無旗幟', '紅旗', '橘旗', '綠旗', '藍旗']
const FLAG_COLORS = ['', 'bg-red-500', 'bg-orange-500', 'bg-green-500', 'bg-blue-500']

/** 拖曳到夠遠時，卡片上方顯示「放開會發生什麼事」 */
const SWIPE_HINT: Record<SwipeDirection, { text: string; cls: string }> = {
  up: { text: '忘記', cls: 'bg-red-600' },
  down: { text: 'OK', cls: 'bg-green-600' },
  left: { text: '下一張', cls: 'bg-slate-700' },
  right: { text: '上一張', cls: 'bg-slate-700' },
}

export function StudyPage() {
  const { deckId = '' } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [state, setState] = useState<StudyState | null>(null)
  // 卡片翻到背面（看得到答案）；評分只在背面時可用
  const [flipped, setFlipped] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [list, setList] = useState<BrowseItem[] | null>(null)
  const [preview, setPreview] = useState<BrowseItem | null>(null)
  const [undoCount, setUndoCount] = useState(0)
  // 卡片內容比畫面高、需要上下捲動時，上下滑改成捲動，評分請用按鈕
  const [scrollable, setScrollable] = useState(false)
  const mainRef = useRef<HTMLElement>(null)
  const undoStack = useRef<UndoEntry[]>([])
  const credit = useRef(0)
  // 這一輪被「跳過」的卡；其他卡都輪完了才會回來
  const skipped = useRef<Set<string>>(new Set())
  // 用 ref 擋連點：state 要等下次繪製才更新，連按兩下可能兩次都通過
  const busyRef = useRef(false)
  const swipeSetting = useLiveQuery(() => db.settings.get(SETTING_KEYS.swipeGestures), [])
  const swipeOn = swipeSetting?.value !== false
  const speakCard = useCardSpeech()

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
  const speakSide = useCallback(
    (side: 'q' | 'a', quiet = false) => card && speakCard(card.note, card.card.ordinal, card.deck, side, quiet),
    [card, speakCard],
  )

  // 換卡時先停掉前一張的朗讀；牌組開啟自動朗讀時，翻到哪一面就念哪一面（SPEC 4.5、10.7）
  const cardKey = card ? `${card.card.id}-${card.shownAt}` : ''
  useEffect(() => {
    stopSpeaking()
    if (cardKey && card?.deck.settings.autoSpeak) speakSide(flipped ? 'a' : 'q', true)
    // 只在換卡或翻面時觸發
  }, [cardKey, flipped])

  const pushUndo = (entry: UndoEntry) => {
    undoStack.current.push(entry)
    setUndoCount(undoStack.current.length)
  }

  const rate = useCallback(
    (rating: Rating) => {
      if (!card || !flipped) return
      primeSpeech()
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
    if (!entry) {
      toast('已經是第一張了')
      return
    }
    setUndoCount(undoStack.current.length)
    void run(async () => {
      if (entry.kind === 'review') {
        const cardId = await undoReview(entry.logId)
        await load(cardId ?? undefined)
        toast('已復原上一張的評分')
      } else if (entry.kind === 'skip') {
        skipped.current.delete(entry.cardId)
        await load(entry.cardId)
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

  /** 從卡片清單挑一張，直接複習它（就算還沒到期也會提前複習） */
  const studyThis = (cardId: string) => {
    setPreview(null)
    setList(null)
    void run(async () => {
      if (card && card.card.id !== cardId) pushUndo({ kind: 'skip', cardId: card.card.id })
      skipped.current.delete(cardId)
      await load(cardId)
    })
  }

  const openList = () => {
    getBrowseItems(deckId)
      .then((items) => setList(items ?? []))
      .catch((e) => setError(errorMessage(e)))
  }

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
    if (!card) return
    // iPhone 只允許在點擊後發聲：趁這次點擊解鎖，之後的自動朗讀才會生效
    primeSpeech()
    setFlipped((f) => !f)
  }, [card])

  // 鍵盤快捷鍵：空白鍵翻面、1 忘記、2 OK、← 上一張、→ 下一張、↑ 忘記、↓ OK、Ctrl+Z 上一張
  const overlayOpen = menuOpen || list !== null || preview !== null
  useEffect(() => {
    if (overlayOpen) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return
      const key = e.key
      if (((e.ctrlKey || e.metaKey) && key.toLowerCase() === 'z') || key === 'ArrowLeft') {
        e.preventDefault()
        goBack()
      } else if (key === 'ArrowRight') {
        e.preventDefault()
        skip()
      } else if (key === ' ') {
        e.preventDefault()
        toggleFlip()
      } else if (key === '1' || key === 'ArrowUp') {
        e.preventDefault()
        rate(FORGOT)
      } else if (key === '2' || key === 'ArrowDown') {
        e.preventDefault()
        rate(OK)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [overlayOpen, rate, goBack, skip, toggleFlip])

  // 手勢：左右滑＝下一張／上一張；翻到背面後上滑＝忘記、下滑＝OK
  const verticalOk = flipped && !scrollable
  const swipe = useSwipe({
    enabled: swipeOn && !busy && !!card,
    onLeft: skip,
    onRight: goBack,
    onUp: verticalOk ? () => rate(FORGOT) : undefined,
    onDown: verticalOk ? () => rate(OK) : undefined,
  })

  // 量一下卡片是否超出畫面（換卡、翻面、旋轉螢幕時重算）
  useLayoutEffect(() => {
    const el = mainRef.current
    if (!el) return
    const measure = () => setScrollable(el.scrollHeight > el.clientHeight + 2)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    if (el.firstElementChild) ro.observe(el.firstElementChild)
    return () => ro.disconnect()
  }, [card, flipped])

  const counts = state?.counts
  const kind = card?.kind
  const count = (n: number | undefined, color: string, active: boolean, label: string) => (
    <span className={`${color} px-1.5 text-lg font-semibold tabular-nums ${active ? 'underline underline-offset-4' : ''}`} aria-label={`${label} ${n ?? 0}`}>
      {n ?? 0}
    </span>
  )
  const flag = card?.card.flag ?? 0
  const hint = swipe.pending ? SWIPE_HINT[swipe.pending] : null

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
          <ListButton onClick={openList} disabled={!state} />
          <button aria-label="更多操作" disabled={!card} className="h-12 w-10 text-2xl text-slate-500 disabled:opacity-30" onClick={() => setMenuOpen(true)}>
            ⋯
          </button>
        </div>
      </header>

      <main
        ref={mainRef}
        className="relative min-h-0 flex-1 overflow-y-auto"
        style={{ touchAction: scrollable ? 'pan-y' : 'none' }}
        onClick={() => !swipe.wasDrag() && toggleFlip()}
        {...swipe.handlers}
      >
        {card && (
          <div className="relative mx-auto max-w-xl px-4 py-6">
            {hint && (
              <div className="pointer-events-none absolute inset-x-0 top-8 z-20 flex justify-center">
                <span className={`rounded-full px-5 py-2 text-lg font-bold text-white shadow-lg ${hint.cls}`}>{hint.text}</span>
              </div>
            )}
            <div
              className="relative"
              style={{
                transform: swipe.drag.x || swipe.drag.y ? `translate(${swipe.drag.x * 0.5}px, ${swipe.drag.y * 0.5}px)` : undefined,
                transition: swipe.drag.x || swipe.drag.y ? 'none' : 'transform 150ms',
              }}
            >
              {flag > 0 && <div className={`absolute top-0 bottom-0 left-0 z-10 w-1.5 rounded-l-2xl ${FLAG_COLORS[flag]}`} aria-label={FLAG_NAMES[flag]} />}
              <FlipCard key={cardKey} note={card.note} ordinal={card.card.ordinal} flipped={flipped} onSpeak={(side) => speakSide(side)} />
            </div>
            {swipeOn && (
              <p className="mt-3 text-center text-xs text-slate-400">
                {flipped
                  ? scrollable
                    ? '卡片較長，請用下方按鈕評分 · 左右滑換卡'
                    : '上滑＝忘記 · 下滑＝OK · 點卡片蓋回'
                  : '點卡片翻面 · 左滑下一張 · 右滑上一張'}
              </p>
            )}
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
            <button className="h-14 w-full rounded-xl bg-indigo-600 text-lg font-semibold text-white active:bg-indigo-700" onClick={toggleFlip}>
              顯示答案
            </button>
          ) : (
            <div className="flex gap-2">
              {RATING_UI.map((r) => (
                <button
                  key={r.rating}
                  disabled={busy}
                  onClick={() => rate(r.rating)}
                  className={`flex h-14 flex-1 items-center justify-center rounded-xl text-xl font-semibold text-white disabled:opacity-60 ${r.color}`}
                >
                  {r.label}
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
            { label: `上一張${undoCount ? '' : '（已經是第一張）'}`, disabled: undoCount === 0, onClick: goBack },
            { label: '下一張（這張先跳過）', onClick: skip },
            { label: flipped ? '朗讀答案' : '朗讀正面', onClick: () => speakSide(flipped ? 'a' : 'q') },
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

      {list && !preview && (
        <CardListSheet items={list} currentCardId={card?.card.id} onClose={() => setList(null)} onPick={(item) => setPreview(item)} />
      )}
      {preview && (
        <CardPreview
          item={preview}
          onBack={() => setPreview(null)}
          onClose={() => {
            setPreview(null)
            setList(null)
          }}
          onStudy={() => studyThis(preview.card.id)}
        />
      )}
    </div>
  )
}

/** 從卡片清單點開的單張卡：可以只看（點卡片翻面），也可以按「複習這張」直接複習 */
function CardPreview(props: { item: BrowseItem; onBack: () => void; onClose: () => void; onStudy: () => void }) {
  const [flipped, setFlipped] = useState(false)
  const speakCard = useCardSpeech()
  const { item } = props
  const suspended = item.card.suspended
  return (
    <div role="dialog" aria-modal="true" aria-label="查看卡片" className="pt-safe fixed inset-0 z-[65] flex flex-col bg-slate-100 dark:bg-slate-950">
      <header className="flex h-14 shrink-0 items-center justify-between px-2">
        <button className="h-12 px-2 text-indigo-600 dark:text-indigo-400" onClick={props.onBack}>
          ‹ 卡片清單
        </button>
        <span className="truncate px-2 text-sm text-slate-500">{item.deckPath}</span>
        <button className="h-12 px-2 text-indigo-600 dark:text-indigo-400" onClick={props.onClose}>
          回到複習
        </button>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto" onClick={() => setFlipped((f) => !f)}>
        <div className="mx-auto max-w-xl px-4 py-6">
          <FlipCard note={item.note} ordinal={item.card.ordinal} flipped={flipped} onSpeak={(side) => speakCard(item.note, item.card.ordinal, item.deck, side)} />
          <p className="mt-3 text-center text-xs text-slate-400">點卡片翻面；只看不會影響複習進度</p>
        </div>
      </main>
      <footer className="pb-safe shrink-0 border-t border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
        <button
          disabled={suspended}
          onClick={props.onStudy}
          className="h-14 w-full rounded-xl bg-indigo-600 text-lg font-semibold text-white active:bg-indigo-700 disabled:bg-slate-400"
        >
          {suspended ? '這張卡已暫停，無法複習' : '複習這張'}
        </button>
      </footer>
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
