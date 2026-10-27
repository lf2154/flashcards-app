import { describe, expect, it } from 'vitest'
import { htmlToText, isHtmlEmpty, textToHtml } from './html'
import { sanitizeHtml } from './sanitize'

describe('htmlToText', () => {
  it('去除標籤並去頭尾空白', () => {
    expect(htmlToText('<p> <strong>Hello</strong> </p>')).toBe('Hello')
  })
  it('段落之間不會黏在一起', () => {
    expect(htmlToText('<p>甲</p><p>乙</p>')).toBe('甲\n乙')
  })
  it('處理空值與 &nbsp;', () => {
    expect(htmlToText('')).toBe('')
    expect(htmlToText('<p>a&nbsp;b</p>')).toBe('a b')
  })
})

describe('isHtmlEmpty', () => {
  it('只有空段落視為空', () => {
    expect(isHtmlEmpty('<p></p>')).toBe(true)
    expect(isHtmlEmpty('<p>x</p>')).toBe(false)
  })
})

describe('textToHtml', () => {
  it('跳脫特殊字元', () => {
    expect(textToHtml('<b>&')).toBe('<p>&lt;b&gt;&amp;</p>')
  })
})

describe('sanitizeHtml', () => {
  it('移除腳本與事件屬性，保留粗體', () => {
    const dirty = '<p onclick="alert(1)"><strong>好</strong><script>alert(2)</script></p><img src=x onerror=alert(3)>'
    const clean = sanitizeHtml(dirty)
    expect(clean).toContain('<strong>好</strong>')
    expect(clean).not.toMatch(/script|onclick|onerror|<img/i)
  })
})
