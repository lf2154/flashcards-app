// 「今天」的唯一定義處（SPEC 10.2）：
// 依手機時區與「換日時間」（預設凌晨 4 點）計算。全專案都要用這裡的函式，
// 不可以在別處自己算日期，否則複習到期日、每日上限、統計會互相對不上。

const DAY_MS = 86_400_000

/** 換日時間預設值：凌晨 4 點（與 Anki 相同） */
export const DEFAULT_ROLLOVER_HOUR = 4

/** 該時間點所屬「學習日」的編號（可用來比較先後；相鄰兩天差 1） */
export function studyDayIndex(ts: number, rolloverHour: number): number {
  // 先把時間往回推「換日時間」，凌晨 0～4 點就仍算前一天
  const shifted = new Date(ts - rolloverHour * 3_600_000)
  return Math.round(Date.UTC(shifted.getFullYear(), shifted.getMonth(), shifted.getDate()) / DAY_MS)
}

/** 該時間點所屬「學習日」的開始時刻（毫秒） */
export function studyDayStart(ts: number, rolloverHour: number): number {
  const shifted = new Date(ts - rolloverHour * 3_600_000)
  const start = new Date(shifted.getFullYear(), shifted.getMonth(), shifted.getDate(), rolloverHour, 0, 0, 0)
  return start.getTime()
}

/** 下一個學習日的開始時刻（用 setDate 推進，夏令時間切換也不會錯） */
export function nextStudyDayStart(ts: number, rolloverHour: number): number {
  const start = new Date(studyDayStart(ts, rolloverHour))
  start.setDate(start.getDate() + 1)
  return start.getTime()
}

/** 學習日編號轉成當地日期 YYYY/MM/DD（顯示用） */
export function formatStudyDay(dayIndex: number): string {
  const d = new Date(dayIndex * DAY_MS)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}/${m}/${day}`
}
