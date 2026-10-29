// 填空卡：語法 {{c1::答案}} 或 {{c1::答案::提示}}；同編號的多個空格屬於同一張卡。
// 填空記號可能被粗體等標籤切開（例如「<b>{{c1::</b>答案}}」），所以一律在
// 「去除標籤後的文字」上找記號，再對應回 HTML 的位置（SPEC 10.5）。

export interface ClozeMatch {
  /** 整個記號在 HTML 中的範圍 [start, end) */
  start: number
  end: number
  ord: number
  /** 答案部分的 HTML（保留裡面的粗體等格式） */
  answerHtml: string
  /** 提示（去除標籤後的 HTML 文字，特殊字元仍是 &lt; 這類編碼）；沒有就是空字串 */
  hint: string
}

const MARKER = /\{\{c(\d+)::([\s\S]*?)\}\}/g

const stripTags = (s: string) => s.replace(/<[^>]*>/g, '')

/** 找出所有填空記號 */
export function findClozes(html: string): ClozeMatch[] {
  // 逐字記下「不在標籤裡的字元」與它在 HTML 中的位置
  const idx: number[] = []
  let text = ''
  for (let i = 0; i < html.length; i++) {
    if (html[i] === '<') {
      const close = html.indexOf('>', i)
      if (close === -1) break
      i = close
      continue
    }
    idx.push(i)
    text += html[i]
  }

  const out: ClozeMatch[] = []
  for (const m of text.matchAll(MARKER)) {
    const ord = Number(m[1])
    if (!Number.isInteger(ord) || ord < 1) continue
    const tStart = m.index
    const tEnd = tStart + m[0].length
    // 答案（含提示）在文字中的範圍：「{{cN::」之後、「}}」之前
    const innerStart = tStart + m[0].indexOf('::') + 2
    const innerEnd = tEnd - 2
    // 對應回 HTML：從「::」最後一個冒號之後，到「}}」第一個括號之前（中間的標籤一併保留）
    const hStart = idx[tStart]
    const hEnd = idx[tEnd - 1] + 1
    const hInnerStart = idx[innerStart - 1] + 1
    const hInnerEnd = idx[innerEnd]
    const innerHtml = html.slice(hInnerStart, hInnerEnd)

    // 「答案::提示」：在文字上找第一個「::」，再對應回 HTML
    const innerText = m[2]
    const sep = innerText.indexOf('::')
    let answerHtml = innerHtml
    let hint = ''
    if (sep !== -1) {
      const hSep = idx[innerStart + sep]
      answerHtml = html.slice(hInnerStart, hSep)
      hint = stripTags(html.slice(idx[innerStart + sep + 1] + 1, hInnerEnd)).trim()
    }
    out.push({ start: hStart, end: hEnd, ord, answerHtml, hint })
  }
  return out
}

/** 這段文字有哪些填空編號（由小到大、不重複） */
export function clozeOrdinals(html: string): number[] {
  return [...new Set(findClozes(html).map((m) => m.ord))].sort((a, b) => a - b)
}

/** 「挖空」按鈕要用的下一個編號 */
export function nextClozeNumber(html: string): number {
  const ords = clozeOrdinals(html)
  return ords.length ? ords[ords.length - 1] + 1 : 1
}

export type ClozeMode = 'question' | 'answer' | 'speech'

/**
 * 產生第 ord 張卡要顯示的 HTML：
 * - question：這張的空格顯示「[...]」或「[提示]」
 * - answer：這張的答案以醒目樣式標出
 * - speech：朗讀用，這張的空格換成「空白」
 * 其他編號的空格一律直接顯示答案（與 Anki 相同）。
 */
export function renderCloze(html: string, ord: number, mode: ClozeMode): string {
  let out = html
  const matches = findClozes(html)
  // 從後面往前換，前面的位置才不會跑掉
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i]
    let rep = m.answerHtml
    if (m.ord === ord) {
      if (mode === 'question') rep = `<span class="cloze">[${m.hint || '...'}]</span>`
      else if (mode === 'answer') rep = `<span class="cloze-answer">${m.answerHtml}</span>`
      else rep = '空白'
    }
    out = out.slice(0, m.start) + rep + out.slice(m.end)
  }
  return out
}
