import { useEffect, useRef, useState, type ReactNode } from 'react'
import { RichHtml } from './RichHtml'
import { ImageZoom } from './ImageZoom'
import type { Note } from '../db/types'
import { isHtmlEmpty } from '../lib/html'
import { sidesOf } from '../lib/cardSides'
import { isSpeechSupported } from '../lib/speech'

const face =
  'flip-face flex min-h-[60dvh] flex-col justify-center rounded-2xl border border-slate-200 bg-white px-6 py-8 text-2xl dark:border-slate-800 dark:bg-slate-900'

/**
 * 會翻轉的卡片。正面＝問題；背面＝問題＋分隔線＋答案（填空卡為標出答案的整段文字）＋補充說明。
 * 背面內容等第一次翻面才放進畫面，翻面前不會有答案藏在頁面裡。
 * 換卡時請用 key 讓它重新建立，新卡才會直接以正面出現、不會倒轉回來。
 * onSpeak：有給的話，兩面右上角各顯示一個喇叭按鈕。
 */
export function FlipCard(props: { note: Note; ordinal: number; flipped: boolean; onSpeak?: (side: 'q' | 'a') => void }) {
  const { note, ordinal, flipped, onSpeak } = props
  const [backReady, setBackReady] = useState(flipped)
  const [zoom, setZoom] = useState<string | null>(null)
  // 第一次出現時不播動畫；之後每次翻面才播
  const [animated, setAnimated] = useState(false)
  const first = useRef(true)
  useEffect(() => {
    if (flipped) setBackReady(true)
    if (first.current) first.current = false
    else setAnimated(true)
  }, [flipped])
  const motion = flipped ? (animated ? 'to-back' : 'is-flipped') : animated ? 'to-front' : ''
  const sides = sidesOf(note, ordinal)
  const canSpeak = !!onSpeak && isSpeechSupported()

  // 點到圖片＝放大看圖（不翻面）
  const onClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement
    if (t.tagName === 'IMG' && (t as HTMLImageElement).src) {
      e.stopPropagation()
      setZoom((t as HTMLImageElement).src)
    }
  }

  const speaker = (side: 'q' | 'a') =>
    canSpeak && (side === 'q' ? sides.qSpeech : sides.aSpeech) ? (
      <button
        aria-label={side === 'q' ? '朗讀正面' : '朗讀答案'}
        className="absolute top-2 right-2 z-10 flex h-12 w-12 items-center justify-center rounded-full text-slate-400 active:bg-slate-100 dark:active:bg-slate-800"
        onClick={(e) => {
          e.stopPropagation()
          onSpeak?.(side)
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M11 5 6 9H2v6h4l5 4V5Z" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
        </svg>
      </button>
    ) : null

  return (
    <div className="flip-scene" onClick={onClick}>
      <div className={`flip-inner ${motion}`}>
        <div className={face} aria-hidden={flipped} inert={flipped}>
          {speaker('q')}
          <RichHtml html={sides.q} className="text-center" />
        </div>
        <div className={`${face} flip-back`} aria-hidden={!flipped} inert={!flipped}>
          {speaker('a')}
          {(flipped || backReady) && <Answer sides={sides} extra={note.extra} />}
        </div>
      </div>
      {zoom && <ImageZoom src={zoom} onClose={() => setZoom(null)} />}
    </div>
  )
}

function Answer({ sides, extra }: { sides: ReturnType<typeof sidesOf>; extra: string }): ReactNode {
  return (
    <>
      {!sides.answerIncludesQuestion && (
        <>
          <RichHtml html={sides.q} className="text-center" />
          <hr className="my-5 border-slate-300 dark:border-slate-700" />
        </>
      )}
      <RichHtml html={sides.a} className="text-center" />
      {!isHtmlEmpty(sides.backNote) && (
        <>
          <hr className="my-5 border-slate-300 dark:border-slate-700" />
          <RichHtml html={sides.backNote} className="text-center text-xl" />
        </>
      )}
      {!isHtmlEmpty(extra) && <RichHtml html={extra} className="mt-4 text-center text-base text-slate-500 dark:text-slate-400" />}
    </>
  )
}
