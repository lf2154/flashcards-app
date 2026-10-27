import DOMPurify from 'dompurify'

// 所有要顯示的 HTML（包含匯入的 CSV 內容）一律先過濾，防止惡意程式碼（SPEC 10.5）。
const ALLOWED_TAGS = [
  'p', 'br', 'div', 'span', 'strong', 'b', 'em', 'i', 'u', 's',
  'ul', 'ol', 'li', 'code', 'pre', 'blockquote',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr',
]

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR: [] })
}
