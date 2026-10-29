import type { Note } from '../db/types'
import { renderCloze } from './cloze'
import { htmlToText } from './html'

export interface CardSides {
  /** 正面（問題）HTML */
  q: string
  /** 背面的答案 HTML */
  a: string
  /** 答案本身就包含整段問題（填空卡），背面不用再重複顯示問題 */
  answerIncludesQuestion: boolean
  /** 填空卡的「背面補充」（筆記的背面欄位），顯示在答案下方 */
  backNote: string
  /** 朗讀用的純文字 */
  qSpeech: string
  aSpeech: string
  /** 這張卡兩面各自的筆記朗讀語言（未設定時由呼叫端沿用牌組設定） */
  qLang?: string
  aLang?: string
}

/**
 * 一張卡的正反面內容。
 * - 基本卡：問正面、答背面
 * - 反轉卡第 2 張（ordinal 1）：問背面、答正面
 * - 填空卡第 N 張：問「挖掉 cN 的文字」、答「標出 cN 答案的文字」
 */
export function sidesOf(note: Note, ordinal: number): CardSides {
  if (note.type === 'cloze') {
    const a = renderCloze(note.front, ordinal, 'answer')
    return {
      q: renderCloze(note.front, ordinal, 'question'),
      a,
      answerIncludesQuestion: true,
      backNote: note.back,
      qSpeech: htmlToText(renderCloze(note.front, ordinal, 'speech')),
      aSpeech: htmlToText(a),
      qLang: note.frontLang,
      aLang: note.frontLang,
    }
  }
  const reversed = note.type === 'basicReversed' && ordinal === 1
  const [q, a, qLang, aLang] = reversed
    ? [note.back, note.front, note.backLang, note.frontLang]
    : [note.front, note.back, note.frontLang, note.backLang]
  return {
    q,
    a,
    answerIncludesQuestion: false,
    backNote: '',
    qSpeech: htmlToText(q),
    aSpeech: htmlToText(a),
    qLang,
    aLang,
  }
}
