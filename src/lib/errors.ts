/** 給使用者看的白話錯誤（訊息本身就是中文，可以直接顯示） */
export class AppError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AppError'
  }
}

/** 取得要顯示給使用者的錯誤訊息 */
export function errorMessage(e: unknown): string {
  if (e instanceof AppError) return e.message
  if (e instanceof Error) return `發生未預期的錯誤：${e.message}`
  return '發生未預期的錯誤'
}
