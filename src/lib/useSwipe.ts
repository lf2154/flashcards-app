import { useRef, useState } from 'react'

/** 要滑超過這個距離才算數，不夠就彈回（SPEC 10.9） */
export const SWIPE_DISTANCE = 80
/** 避開螢幕左右邊緣，免得跟 iPhone 的「返回」手勢衝突（SPEC 10.9） */
const EDGE_GUARD = 24
/** 手指移動超過這個距離，就不再當成「點一下」 */
const TAP_SLOP = 10

export type SwipeDirection = 'left' | 'right' | 'up' | 'down'

interface Options {
  /** 各方向的動作；沒給（或 undefined）就代表那個方向不能滑 */
  onLeft?: () => void
  onRight?: () => void
  onUp?: () => void
  onDown?: () => void
  /** 整個手勢開關 */
  enabled: boolean
}

/**
 * 上下左右滑動手勢（只處理觸控，不處理滑鼠）。
 * 回傳要掛到元素上的事件、拖曳中的位移（做跟手的效果）、目前會觸發的方向，
 * 以及 wasDrag()：剛剛那一下是不是滑動，用來避免滑完又觸發「點一下翻面」。
 * 注意：要能上下滑，元素需設定 touch-action: none，否則瀏覽器會拿去捲動。
 */
export function useSwipe(options: Options) {
  const start = useRef<{ x: number; y: number } | null>(null)
  const dragged = useRef(false)
  const [drag, setDrag] = useState({ x: 0, y: 0 })

  const allowed = (d: SwipeDirection) =>
    !!(d === 'left' ? options.onLeft : d === 'right' ? options.onRight : d === 'up' ? options.onUp : options.onDown)

  /** 依位移判斷方向：取移動較多的那一軸，且該方向有設定動作 */
  const directionOf = (dx: number, dy: number): SwipeDirection | null => {
    const horizontal = Math.abs(dx) >= Math.abs(dy)
    const d: SwipeDirection = horizontal ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down'
    return allowed(d) ? d : null
  }

  const end = (x: number, y: number, cancelled: boolean) => {
    if (!start.current) return
    const dx = x - start.current.x
    const dy = y - start.current.y
    start.current = null
    setDrag({ x: 0, y: 0 }) // 不論成功與否都彈回原位
    if (cancelled || Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_DISTANCE) return
    const d = directionOf(dx, dy)
    if (d === 'left') options.onLeft?.()
    else if (d === 'right') options.onRight?.()
    else if (d === 'up') options.onUp?.()
    else if (d === 'down') options.onDown?.()
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
      // 只往允許的方向跟手；不允許的那一軸固定不動
      const canX = allowed('left') || allowed('right')
      const canY = allowed('up') || allowed('down')
      setDrag({ x: canX ? dx : 0, y: canY ? dy : 0 })
    },
    onPointerUp: (e: React.PointerEvent) => end(e.clientX, e.clientY, false),
    onPointerCancel: (e: React.PointerEvent) => end(e.clientX, e.clientY, true),
  }

  const pending =
    Math.max(Math.abs(drag.x), Math.abs(drag.y)) >= SWIPE_DISTANCE ? directionOf(drag.x, drag.y) : null

  return { handlers, drag, pending, wasDrag: () => dragged.current }
}
