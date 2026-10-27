import { useMemo } from 'react'
import { sanitizeHtml } from '../lib/sanitize'

/** 顯示簡易 HTML。一律先過 DOMPurify 過濾（SPEC 10.5）。 */
export function RichHtml({ html, className = '' }: { html: string; className?: string }) {
  const clean = useMemo(() => sanitizeHtml(html), [html])
  return <div className={`rich ${className}`} dangerouslySetInnerHTML={{ __html: clean }} />
}
