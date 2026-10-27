import { describe, expect, it } from 'vitest'
import { formatStudyDay, nextStudyDayStart, studyDayIndex, studyDayStart } from './studyDay'

// 一律用「當地時間」建構日期，所以不論測試機器在哪個時區都成立
const at = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime()

describe('換日時間（預設凌晨 4 點）', () => {
  it('凌晨 3:59 還算前一天，4:00 起算新的一天', () => {
    const before = studyDayIndex(at(2026, 10, 27, 3, 59), 4)
    const after = studyDayIndex(at(2026, 10, 27, 4, 0), 4)
    expect(after - before).toBe(1)
    expect(studyDayIndex(at(2026, 10, 26, 23, 59), 4)).toBe(before)
  })

  it('學習日的開始時刻是當天 4:00', () => {
    expect(studyDayStart(at(2026, 10, 27, 15, 30), 4)).toBe(at(2026, 10, 27, 4, 0))
    expect(studyDayStart(at(2026, 10, 27, 2, 0), 4)).toBe(at(2026, 10, 26, 4, 0))
  })

  it('下一個學習日從隔天 4:00 開始', () => {
    expect(nextStudyDayStart(at(2026, 10, 27, 15, 30), 4)).toBe(at(2026, 10, 28, 4, 0))
    expect(nextStudyDayStart(at(2026, 10, 27, 2, 0), 4)).toBe(at(2026, 10, 27, 4, 0))
  })

  it('可以自訂換日時間', () => {
    expect(studyDayIndex(at(2026, 10, 27, 0, 30), 0)).toBe(studyDayIndex(at(2026, 10, 27, 23, 0), 0))
    expect(studyDayIndex(at(2026, 10, 27, 5, 0), 6)).toBe(studyDayIndex(at(2026, 10, 26, 12, 0), 6))
  })

  it('格式化成 2026/10/27', () => {
    expect(formatStudyDay(studyDayIndex(at(2026, 10, 27, 12, 0), 4))).toBe('2026/10/27')
  })
})
