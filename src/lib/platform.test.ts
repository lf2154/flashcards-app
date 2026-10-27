import { describe, expect, it } from 'vitest'
import { detectPlatform } from './platform'

describe('detectPlatform', () => {
  it('辨識 iPhone', () => {
    expect(detectPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 5)).toBe('ios')
  })
  it('辨識偽裝成 Mac 的 iPad', () => {
    expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe('ios')
  })
  it('一般 Mac 不是 iOS', () => {
    expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe('other')
  })
  it('辨識 Android', () => {
    expect(detectPlatform('Mozilla/5.0 (Linux; Android 14; Pixel 8)', 5)).toBe('android')
  })
})
