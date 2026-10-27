import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useToast } from '../components/Toast'
import { db } from '../db'
import { updateDeckSettings } from '../db/decks'
import type { NewCardOrder } from '../db/types'
import { AppError, errorMessage } from '../lib/errors'

/** 「1 10」→ [1, 10]；每個步驟是 1～1440 分鐘 */
function parseSteps(text: string, label: string): number[] {
  const parts = text.split(/[\s,，、]+/).filter(Boolean)
  return parts.map((p) => {
    const n = Number(p)
    if (!Number.isFinite(n) || n <= 0 || n > 1440) throw new AppError(`${label}請輸入 1～1440 的分鐘數，例如「1 10」`)
    return n
  })
}

function parseInteger(text: string, label: string, max = 9999): number {
  const n = Number(text)
  if (!Number.isInteger(n) || n < 0 || n > max) throw new AppError(`${label}請輸入 0～${max} 的整數`)
  return n
}

const input = 'h-12 w-full rounded-xl border border-slate-300 bg-transparent px-3 dark:border-slate-600'

export function DeckSettingsPage() {
  const { deckId = '' } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const deck = useLiveQuery(() => db.decks.get(deckId), [deckId])
  const [form, setForm] = useState<null | {
    newPerDay: string
    reviewPerDay: string
    retention: string
    learning: string
    relearning: string
    order: NewCardOrder
  }>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (deck && !form) {
      const s = deck.settings
      setForm({
        newPerDay: String(s.newPerDay),
        reviewPerDay: String(s.reviewPerDay),
        retention: String(Math.round(s.desiredRetention * 100)),
        learning: s.learningSteps.join(' '),
        relearning: s.relearningSteps.join(' '),
        order: s.newOrder,
      })
    }
  }, [deck, form])

  if (!deck || !form) return null
  const set = (patch: Partial<typeof form>) => setForm({ ...form, ...patch })

  const save = async () => {
    try {
      const retention = Number(form.retention)
      if (!Number.isFinite(retention) || retention < 70 || retention > 99) {
        throw new AppError('目標記憶率請輸入 70～99 之間的數字')
      }
      await updateDeckSettings(deckId, {
        newPerDay: parseInteger(form.newPerDay, '每日新卡上限'),
        reviewPerDay: parseInteger(form.reviewPerDay, '每日複習上限'),
        desiredRetention: retention / 100,
        learningSteps: parseSteps(form.learning, '學習步驟'),
        relearningSteps: parseSteps(form.relearning, '重新學習步驟'),
        newOrder: form.order,
      })
      toast('已儲存')
      navigate(-1)
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const field = (id: string, label: string, value: string, onChange: (v: string) => void, hint?: string, mode: 'numeric' | 'text' = 'numeric') => (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <input id={id} inputMode={mode} className={input} value={value} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  )

  return (
    <div className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-xl flex-col">
      <header className="flex items-center px-2 pt-2">
        <button className="h-12 px-3 text-indigo-600 dark:text-indigo-400" onClick={() => navigate(-1)}>
          ‹ 返回
        </button>
        <h1 className="flex-1 truncate pr-12 text-center text-lg font-bold">牌組設定：{deck.name}</h1>
      </header>
      <div className="flex-1 space-y-4 px-4 py-4">
        {field('newPerDay', '每日新卡上限', form.newPerDay, (v) => set({ newPerDay: v }), '預設 20')}
        {field('reviewPerDay', '每日複習上限', form.reviewPerDay, (v) => set({ reviewPerDay: v }), '預設 200')}
        {field('retention', '目標記憶率（%）', form.retention, (v) => set({ retention: v }), '預設 90。越高越常複習、忘得越少。')}
        {field('learning', '學習步驟（分鐘）', form.learning, (v) => set({ learning: v }), '新卡要依序通過的間隔，用空白分隔。預設「1 10」。', 'text')}
        {field('relearning', '重新學習步驟（分鐘）', form.relearning, (v) => set({ relearning: v }), '複習卡按「重來」後的間隔。預設「10」。', 'text')}
        <div>
          <label htmlFor="order" className="mb-1 block text-sm font-medium">
            新卡出現順序
          </label>
          <select id="order" className={input} value={form.order} onChange={(e) => set({ order: e.target.value as NewCardOrder })}>
            <option value="sequential">依新增順序</option>
            <option value="random">隨機</option>
          </select>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
      <div className="sticky bottom-0 border-t border-slate-200 bg-slate-50/95 p-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <button className="h-12 w-full rounded-xl bg-indigo-600 font-medium text-white active:bg-indigo-700" onClick={save}>
          儲存
        </button>
      </div>
    </div>
  )
}
