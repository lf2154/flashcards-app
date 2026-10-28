/** 右上角「卡片清單」按鈕（圖示＋小字），複習與瀏覽模式共用 */
export function ListButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      aria-label="卡片清單"
      disabled={disabled}
      onClick={onClick}
      className="flex h-12 w-12 flex-col items-center justify-center rounded-lg text-slate-600 active:bg-slate-200 disabled:opacity-30 dark:text-slate-300 dark:active:bg-slate-800"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
      </svg>
      <span className="text-[10px] leading-tight">卡片清單</span>
    </button>
  )
}
