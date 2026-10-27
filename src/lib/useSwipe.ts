import { useRef, useState } from 'react'

/** 要滑超過這個距離才算數，不夠就彈回（SPEC 10.9） */
const SWIPE_DISTANCE = 90
/** 避開螢幕左右邊緣，免得跟 iPhone 的「返回」手勢衝突（SPEC 10.9） */
const EDGE_GUARD = 24
/** 手指移動超過這個距離，就不再當成「點一下」 */
const TAP_SLOP = 10

/**
 * 左右滑動手勢（只處理觸控，不處理滑鼠）。
 * 回傳要掛到元素上的事件、拖曳中的位移（做跟手的效果），
 * 以及 wasDrag()：剛剛那一下是不是滑動，用來避免滑完又觸發「點一下翻面」。
 */
export function useSwipe(options: { enabled: boolean; onLeft: () => void; onRight: () => void }) {
  const start = useRef<{ x: number; y: number } | null>(null)
  const dragged = useRef(false)
  const [dragX, setDragX] = useState(0)

  const end = (x: number, cancelled: boolean) => {
    if (!start.current) return
    const dx = x - start.current.x
    start.current = null
    setDragX(0) // 不論成功與否都彈回原位
    if (cancelled) return
    if (dx <= -SWIPE_DISTANCE) options.onLeft()
    else if (dx >= SWIPE_DISTANCE) options.onRight()
  }

  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      dragged.current = false
      if (!options.enabled || e.pointerType === 'mouse') return
      if (e.clientX < EDGE_GUARD || e.clientX > window.innerWidth - EDGE_GUARD) return
      start.current = { x: e.clientX, y: e.clientY }
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!start.current) return
      const dx = e.clientX - start.current.x
      const dy = e.clientY - start.current.y
      if (Math.abs(dx) > TAP_SLOP || Math.abs(dy) > TAP_SLOP) dragged.current = true
      if (Math.abs(dy) > Math.abs(dx) * 1.5 && Math.abs(dy) > 12) {
        start.current = null // 往上下捲動，不是左右滑
        setDragX(0)
        return
      }
      setDragX(dx)
    },
    onPointerUp: (e: React.PointerEvent) => end(e.clientX, false),
    onPointerCancel: (e: React.PointerEvent) => end(e.clientX, true),
  }

  return { handlers, dragX, wasDrag: () => dragged.current }
}
