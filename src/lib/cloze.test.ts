import { describe, expect, it } from 'vitest'
import { clozeOrdinals, findClozes, nextClozeNumber, renderCloze } from './cloze'
import { htmlToText } from './html'
import { sanitizeHtml } from './sanitize'

describe('填空記號解析', () => {
  it('找出編號、答案與提示', () => {
    const m = findClozes('<p>首都是{{c1::台北}}，人口{{c2::兩百萬::數字}}</p>')
    expect(m.map((x) => [x.ord, x.answerHtml, x.hint])).toEqual([
      [1, '台北', ''],
      [2, '兩百萬', '數字'],
    ])
  })

  it('同編號的多個空格屬於同一張卡；編號不重複、由小到大', () => {
    expect(clozeOrdinals('{{c2::a}} {{c1::b}} {{c2::c}}')).toEqual([1, 2])
  })

  it('沒有填空、或編號為 0 時回傳空清單', () => {
    expect(clozeOrdinals('<p>沒有填空</p>')).toEqual([])
    expect(clozeOrdinals('{{c0::x}}')).toEqual([])
  })

  it('下一個挖空編號', () => {
    expect(nextClozeNumber('')).toBe(1)
    expect(nextClozeNumber('{{c1::a}}{{c3::b}}')).toBe(4)
  })

  it('答案裡的粗體會保留', () => {
    expect(findClozes('{{c1::<strong>重點</strong>}}')[0].answerHtml).toBe('<strong>重點</strong>')
  })

  it('記號被標籤切開時，以去除標籤後的文字為準', () => {
    const html = '<p><strong>{{c1::</strong>答案}} 與 {{<em>c2::乙</em>}}</p>'
    expect(clozeOrdinals(html)).toEqual([1, 2])
    const q = htmlToText(sanitizeHtml(renderCloze(html, 1, 'question')))
    expect(q).toBe('[...] 與 乙')
    const a = htmlToText(sanitizeHtml(renderCloze(html, 2, 'answer')))
    expect(a).toBe('答案 與 乙')
  })

  it('提示中的格式只取文字', () => {
    expect(findClozes('{{c1::答::<b>提示</b>}}')[0].hint).toBe('提示')
  })
})

describe('填空顯示', () => {
  const html = '<p>{{c1::台北}}是{{c2::台灣::國家}}的首都</p>'

  it('正面：這張的空格顯示 [...] 或 [提示]，其他空格直接顯示答案', () => {
    expect(htmlToText(renderCloze(html, 1, 'question'))).toBe('[...]是台灣的首都')
    expect(htmlToText(renderCloze(html, 2, 'question'))).toBe('台北是[國家]的首都')
  })

  it('背面：這張的答案以醒目樣式標出', () => {
    const a = renderCloze(html, 1, 'answer')
    expect(a).toContain('<span class="cloze-answer">台北</span>')
    expect(htmlToText(a)).toBe('台北是台灣的首都')
  })

  it('朗讀：空格讀成「空白」，不讀括號符號', () => {
    expect(htmlToText(renderCloze(html, 1, 'speech'))).toBe('空白是台灣的首都')
  })

  it('提示裡的特殊字元維持編碼，不會變成程式碼', () => {
    const q = renderCloze('{{c1::x::&lt;script&gt;}}', 1, 'question')
    expect(q).toContain('[&lt;script&gt;]')
    expect(sanitizeHtml(q)).not.toMatch(/<script/i)
    expect(htmlToText(q)).toBe('[<script>]')
  })
})
