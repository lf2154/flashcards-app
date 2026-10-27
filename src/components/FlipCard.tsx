import { useEffect, useState, type ReactNode } from 'react'
import { RichHtml } from './RichHtml'
import type { Note } from '../db/types'

/** 反轉卡的第 2 張（ordinal 1）是「反→正」：問背面、答正面 */
export function sidesOf(note: Note, ordinal: number): { q: string; a: string } {
  const reversed = note.type === 'basicReversed' && ordinal === 1
  return reversed ? { q: note.back, a: note.front } : { q: note.front, a: note.back }
}

const face =
  'flip-face flex min-h-[60dvh] flex-col justify-center rounded-2xl bg-white px-6 py-8 text-2xl shadow-md ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800'

/**
 * 會翻轉的卡片。正面＝問題；背面＝問題＋分隔線＋答案（＋補充說明）。
 * 背面內容等第一次翻面才放進畫面，翻面前不會有答案藏在頁面裡。
 * 換卡時請用 key 讓它重新建立，新卡才會直接以正面出現、不會倒轉回來。
 */
export function FlipCard({ note, ordinal, flipped }: { note: Note; ordinal: number; flipped: boolean }) {
  const [backReady, setBackReady] = useState(flipped)
  useEffect(() => {
    if (flipped) setBackReady(true)
  }, [flipped])
  const { q, a } = sidesOf(note, ordinal)

  return (
    <div className="flip-scene">
      <div className={`flip-inner ${flipped ? 'is-flipped' : ''}`}>
        <div className={face} aria-hidden={flipped} inert={flipped}>
          <RichHtml html={q} className="text-center" />
        </div>
        <div className={`${face} flip-back`} aria-hidden={!flipped} inert={!flipped}>
          {(flipped || backReady) && <Answer q={q} a={a} extra={note.extra} />}
        </div>
      </div>
    </div>
  )
}

function Answer({ q, a, extra }: { q: string; a: string; extra: string }): ReactNode {
  return (
    <>
      <RichHtml html={q} className="text-center" />
      <hr className="my-5 border-slate-300 dark:border-slate-700" />
      <RichHtml html={a} className="text-center" />
      {extra && <RichHtml html={extra} className="mt-4 text-center text-base text-slate-500 dark:text-slate-400" />}
    </>
  )
}
