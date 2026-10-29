import { describe, expect, it } from 'vitest'
import { pickVoice, resolveLang } from './speech'

const v = (lang: string, name = lang) => ({ lang, name })

describe('挑選語音', () => {
  const voices = [v('en-GB'), v('zh-HK'), v('zh-CN'), v('ja_JP')]

  it('完全符合優先', () => {
    expect(pickVoice(voices, 'en-GB')).toEqual({ voice: voices[0], exact: true })
    expect(pickVoice(voices, 'ja-JP')!.exact).toBe(true) // 底線寫法也認得
  })

  it('zh-TW 找不到時優先用 zh-HK，再用 zh-CN', () => {
    expect(pickVoice(voices, 'zh-TW')).toEqual({ voice: voices[1], exact: false })
    expect(pickVoice([v('zh-CN')], 'zh-TW')!.voice.lang).toBe('zh-CN')
  })

  it('同語言的其他地區也可以替代', () => {
    expect(pickVoice(voices, 'en-US')!.voice.lang).toBe('en-GB')
  })

  it('完全沒有該語言時回傳 null', () => {
    expect(pickVoice(voices, 'ko-KR')).toBeNull()
  })
})

describe('朗讀語言的優先順序', () => {
  it('筆記 → 牌組 → 全域預設', () => {
    expect(resolveLang('en-US', 'ja-JP', 'zh-TW')).toBe('en-US')
    expect(resolveLang(undefined, 'ja-JP', 'zh-TW')).toBe('ja-JP')
    expect(resolveLang('', '', 'zh-TW')).toBe('zh-TW')
    expect(resolveLang(undefined, '', '')).toBe('')
  })
})
