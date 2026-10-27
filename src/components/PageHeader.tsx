export function PageHeader({ title }: { title: string }) {
  return (
    <header className="px-4 pt-4">
      <h1 className="text-2xl font-bold">{title}</h1>
    </header>
  )
}

/** 還沒做的分頁用的占位內容 */
export function ComingSoon({ stage, children }: { stage: number; children: string }) {
  return (
    <div className="mx-4 mt-6 rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
      <p>{children}</p>
      <p className="mt-1 text-sm">（階段 {stage} 開放）</p>
    </div>
  )
}
