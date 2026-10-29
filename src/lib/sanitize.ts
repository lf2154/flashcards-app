import DOMPurify from 'dompurify'

// 所有要顯示的 HTML（包含匯入的 CSV 內容）一律先過濾，防止惡意程式碼（SPEC 10.5）。
const ALLOWED_TAGS = [
  'p', 'br', 'div', 'span', 'strong', 'b', 'em', 'i', 'u', 's',
  'ul', 'ol', 'li', 'code', 'pre', 'blockquote',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'img',
]

// 圖片只允許引用 App 自己存的圖（media://ID），不載入任何外部網址
const MEDIA_ONLY = /^media:\/\/[\w-]+$/i

// 圖片來源不是 media://（包含 DOMPurify 預設會放行的 data:）就整個移除；只保留填空用的兩種 class
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.nodeName === 'IMG' && !MEDIA_ONLY.test(node.getAttribute('src') ?? '')) {
    node.remove()
    return
  }
  const cls = node.getAttribute?.('class')
  if (cls && cls !== 'cloze' && cls !== 'cloze-answer') node.removeAttribute('class')
})

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ['src', 'alt', 'class'],
    ALLOWED_URI_REGEXP: MEDIA_ONLY,
  })
}
