import type { Counts } from '../scheduler/queue'

const zero = 'text-slate-300 dark:text-slate-600'

/** 三色數字：新卡（藍）、學習中（紅）、待複習（綠），與 Anki 相同 */
export function CountNumbers({ counts, large = false }: { counts?: Counts; large?: boolean }) {
  const c = counts ?? { new: 0, learning: 0, review: 0 }
  const size = large ? 'text-3xl' : 'text-base'
  const cell = (n: number, color: string, label: string) => (
    <span className={`${n === 0 ? zero : color} ${size} min-w-[2.75rem] text-center font-semibold tabular-nums`} aria-label={`${label} ${n}`}>
      {n}
    </span>
  )
  return (
    <span className="inline-flex">
      {cell(c.new, 'text-new', '新卡')}
      {cell(c.learning, 'text-learning', '學習中')}
      {cell(c.review, 'text-due', '待複習')}
    </span>
  )
}
