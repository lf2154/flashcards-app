// 統一的「現在」。所有商業邏輯都呼叫 now()，不直接用 Date.now()，
// 這樣階段 5 的開發者工具「時間快轉一天」才能一次生效、測試也能固定時間。

let offsetMs = 0

export function now(): number {
  return Date.now() + offsetMs
}

/** 開發者工具／測試用：讓時間往後（或往前）偏移 */
export function setClockOffset(ms: number): void {
  offsetMs = ms
}

export function getClockOffset(): number {
  return offsetMs
}
