import { useMemo } from 'react'
import { sanitizeHtml } from '../lib/sanitize'
import { useMediaHtml } from '../lib/useMediaHtml'

/** 顯示簡易 HTML。一律先過 DOMPurify 過濾（SPEC 10.5），再把 media://ID 換成圖片。 */
export function RichHtml({ html, className = '' }: { html: string; className?: string }) {
  const clean = useMemo(() => sanitizeHtml(html), [html])
  const shown = useMediaHtml(clean)
  return <div className={`rich ${className}`} dangerouslySetInnerHTML={{ __html: shown }} />
}
