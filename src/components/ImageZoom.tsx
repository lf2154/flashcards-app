import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const MAX_SCALE = 5

/**
 * 全螢幕看圖：雙指縮放、單指拖曳、點兩下放大／還原、點一下空白處關閉。
 * 用 portal 畫在最上層；所有事件都擋下來，免得傳到底下的卡片（翻面、滑動）。
 */
export function ImageZoom({ src, onClose }: { src: string; onClose: () => void }) {
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 })
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ dist: number; scale: number; x: number; y: number; px: number; py: number } | null>(null)
  const moved = useRef(false)
  const lastTap = useRef(0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const stop = (e: React.SyntheticEvent) => e.stopPropagation()

  const begin = () => {
    const pts = [...pointers.current.values()]
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length
    const dist = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0
    gesture.current = { dist, scale: view.scale, x: view.x, y: view.y, px: cx, py: cy }
  }

  const onDown = (e: React.PointerEvent) => {
    stop(e)
    try {
      // 手指滑出圖片範圍時也能繼續追蹤；有些瀏覽器會拒絕，拒絕也不影響縮放
      ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    } catch {
      /* 忽略 */
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 1) moved.current = false
    begin()
  }

  const onMove = (e: React.PointerEvent) => {
    stop(e)
    if (!pointers.current.has(e.pointerId) || !gesture.current) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const pts = [...pointers.current.values()]
    const g = gesture.current
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length
    if (Math.hypot(cx - g.px, cy - g.py) > 6) moved.current = true
    let scale = g.scale
    if (pts.length > 1 && g.dist > 0) {
      moved.current = true
      scale = Math.min(MAX_SCALE, Math.max(1, (g.scale * Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)) / g.dist))
    }
    // 放大時才能拖曳；縮回原尺寸時回到中間
    setView(scale <= 1 ? { scale: 1, x: 0, y: 0 } : { scale, x: g.x + cx - g.px, y: g.y + cy - g.py })
  }

  const onUp = (e: React.PointerEvent) => {
    stop(e)
    pointers.current.delete(e.pointerId)
    if (pointers.current.size > 0) {
      begin()
      return
    }
    gesture.current = null
    if (moved.current) return
    // 點一下：兩次點擊間隔很短＝點兩下放大／還原；否則點在圖片外面就關閉
    const t = Date.now()
    if (t - lastTap.current < 300) {
      lastTap.current = 0
      setView((v) => (v.scale > 1 ? { scale: 1, x: 0, y: 0 } : { scale: 2.5, x: 0, y: 0 }))
    } else {
      lastTap.current = t
      if ((e.target as HTMLElement).tagName !== 'IMG' && view.scale <= 1) onClose()
    }
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="放大圖片"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/95"
      style={{ touchAction: 'none' }}
      onClick={stop}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <img
        src={src}
        alt="放大的圖片"
        draggable={false}
        className="max-h-full max-w-full select-none"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transition: gesture.current ? 'none' : 'transform 150ms' }}
      />
      <button
        aria-label="關閉"
        className="pt-safe absolute top-2 right-2 flex h-12 w-12 items-center justify-center text-3xl text-white"
        onPointerDown={stop}
        onPointerUp={stop}
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
      >
        ×
      </button>
      <p className="pb-safe absolute bottom-3 text-sm text-white/70">雙指縮放 · 點兩下放大 · 點空白處關閉</p>
    </div>,
    document.body,
  )
}
