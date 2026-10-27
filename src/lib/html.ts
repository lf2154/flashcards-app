// 富文字（簡易 HTML）的文字處理工具。

/** 去除 HTML 標籤、換行區塊轉成空白、去頭尾空白後的純文字（重複檢查、搜尋、朗讀共用，SPEC 10.5） */
export function htmlToText(html: string): string {
  if (!html) return ''
  // 先把區塊結尾換成換行，免得「<p>甲</p><p>乙</p>」被黏成「甲乙」
  const spaced = html.replace(/<\/(p|div|li|h[1-6]|tr)>|<br\s*\/?>/gi, '\n')
  const doc = new DOMParser().parseFromString(spaced, 'text/html')
  return (doc.body.textContent ?? '').replace(/ /g, ' ').trim()
}

/** 純文字轉成安全的 HTML（匯入純文字、預設欄位用） */
export function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return escaped
    .split(/\n/)
    .map((line) => `<p>${line}</p>`)
    .join('')
}

/** 編輯器空內容（只有空段落）視為沒填 */
export function isHtmlEmpty(html: string): boolean {
  return htmlToText(html) === '' && !/<img\b/i.test(html)
}
