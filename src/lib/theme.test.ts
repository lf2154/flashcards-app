import { describe, expect, it } from 'vitest'
import { parseThemeMode, resolveIsDark } from './theme'

describe('parseThemeMode', () => {
  it('接受三種合法值', () => {
    expect(parseThemeMode('light')).toBe('light')
    expect(parseThemeMode('dark')).toBe('dark')
    expect(parseThemeMode('system')).toBe('system')
  })

  it('不認得的值一律當作跟隨系統', () => {
    expect(parseThemeMode(null)).toBe('system')
    expect(parseThemeMode('blue')).toBe('system')
    expect(parseThemeMode(undefined)).toBe('system')
  })
})

describe('resolveIsDark', () => {
  it('跟隨系統時看系統設定', () => {
    expect(resolveIsDark('system', true)).toBe(true)
    expect(resolveIsDark('system', false)).toBe(false)
  })

  it('手動選擇時忽略系統設定', () => {
    expect(resolveIsDark('dark', false)).toBe(true)
    expect(resolveIsDark('light', true)).toBe(false)
  })
})
