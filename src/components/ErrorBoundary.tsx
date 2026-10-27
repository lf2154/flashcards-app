import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
  copied: boolean
}

/** 接住畫面出錯，用白話中文提示，並提供「複製錯誤訊息」方便回報（SPEC 7） */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, copied: false }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  private copy = async () => {
    const { error } = this.state
    if (!error) return
    const text = `${error.name}: ${error.message}\n${error.stack ?? ''}\n${navigator.userAgent}`
    try {
      await navigator.clipboard.writeText(text)
      this.setState({ copied: true })
    } catch {
      window.prompt('請手動複製下面的錯誤訊息：', text)
    }
  }

  render() {
    const { error, copied } = this.state
    if (!error) return this.props.children
    return (
      <div className="pt-safe pb-safe flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-xl font-bold">哎呀，出了點問題</h1>
        <p className="max-w-sm text-slate-600 dark:text-slate-400">
          你的卡片資料不會因此遺失。請先重新整理；若還是一樣，按下方按鈕複製錯誤訊息，貼給 Claude Code 就能修好。
        </p>
        <button
          className="h-12 min-w-40 rounded-xl bg-indigo-600 px-6 font-medium text-white active:bg-indigo-700"
          onClick={() => window.location.reload()}
        >
          重新整理
        </button>
        <button
          className="h-12 min-w-40 rounded-xl border border-slate-300 px-6 font-medium dark:border-slate-600"
          onClick={this.copy}
        >
          {copied ? '已複製' : '複製錯誤訊息'}
        </button>
      </div>
    )
  }
}
