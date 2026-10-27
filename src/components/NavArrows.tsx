/** 「上一張／下一張」兩顆按鈕（圖示＋小字），複習與瀏覽模式共用 */
export function NavArrows(props: {
  prevLabel: string
  nextLabel: string
  prevAria: string
  nextAria: string
  prevDisabled: boolean
  nextDisabled: boolean
  onPrev: () => void
  onNext: () => void
}) {
  const btn = 'flex h-12 w-12 flex-col items-center justify-center rounded-lg text-slate-600 active:bg-slate-200 disabled:opacity-30 dark:text-slate-300 dark:active:bg-slate-800'
  const icon = (d: string) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
  return (
    <>
      <button aria-label={props.prevAria} disabled={props.prevDisabled} className={btn} onClick={props.onPrev}>
        {icon('M15 5l-7 7 7 7')}
        <span className="text-[10px] leading-tight">{props.prevLabel}</span>
      </button>
      <button aria-label={props.nextAria} disabled={props.nextDisabled} className={btn} onClick={props.onNext}>
        {icon('M9 5l7 7-7 7')}
        <span className="text-[10px] leading-tight">{props.nextLabel}</span>
      </button>
    </>
  )
}
