import { db } from './index'
import type { Card, Note, NoteType } from './types'
import { AppError } from '../lib/errors'
import { newId } from '../lib/id'
import { now } from '../lib/clock'
import { htmlToText } from '../lib/html'
import { newSchedule } from '../scheduler/fsrs'

export interface NoteInput {
  deckId: string
  type: NoteType
  front: string
  back: string
  extra?: string
  tags?: string[]
  frontLang?: string
  backLang?: string
}

export const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  basic: '基本（正反面）',
  basicReversed: '基本＋反轉',
  cloze: '填空',
}

/** 這種筆記類型應該有哪些卡片編號 */
export function ordinalsFor(type: NoteType): number[] {
  switch (type) {
    case 'basic':
      return [0]
    case 'basicReversed':
      return [0, 1]
    case 'cloze':
      // 填空卡在階段 3 開放
      throw new AppError('填空卡將在階段 3 開放')
  }
}

function makeCard(note: Note, ordinal: number, createdAt: number): Card {
  return {
    id: newId(),
    noteId: note.id,
    deckId: note.deckId,
    ordinal,
    createdAt,
    ...newSchedule(createdAt),
    suspended: false,
    buried: false,
    buriedDay: null,
    flag: 0,
  }
}

function cleanTags(tags: string[] | undefined): string[] {
  return [...new Set((tags ?? []).map((t) => t.trim()).filter(Boolean))]
}

/** 新增筆記，並依類型產生卡片 */
export async function createNote(input: NoteInput, createdAt = now()): Promise<string> {
  const ordinals = ordinalsFor(input.type)
  const note: Note = {
    id: newId(),
    deckId: input.deckId,
    type: input.type,
    front: input.front,
    back: input.back,
    extra: input.extra ?? '',
    tags: cleanTags(input.tags),
    frontLang: input.frontLang,
    backLang: input.backLang,
    createdAt,
    updatedAt: createdAt,
  }
  await db.transaction('rw', db.decks, db.notes, db.cards, async () => {
    if (!(await db.decks.get(input.deckId))) throw new AppError('找不到這個牌組')
    await db.notes.add(note)
    await db.cards.bulkAdd(ordinals.map((o) => makeCard(note, o, createdAt)))
  })
  return note.id
}

export interface NotePatch {
  deckId?: string
  type?: NoteType
  front?: string
  back?: string
  extra?: string
  tags?: string[]
  frontLang?: string
  backLang?: string
}

export interface NoteUpdatePlan {
  /** 要新增的卡片編號 */
  addOrdinals: number[]
  /** 要刪除的卡片（連同其複習紀錄） */
  removeCards: Card[]
}

/**
 * 預先算出「更新這則筆記會新增／刪除哪些卡片」（SPEC 10.4）。
 * 會刪除卡片時，畫面必須先提示「將刪除 N 張卡片的複習紀錄」，使用者同意才執行。
 * 仍存在的卡片一律保留原本的複習進度。
 */
export async function planNoteUpdate(noteId: string, patch: NotePatch): Promise<NoteUpdatePlan> {
  const note = await db.notes.get(noteId)
  if (!note) throw new AppError('找不到這則筆記')
  const type = patch.type ?? note.type
  const wanted = new Set(ordinalsFor(type))
  const cards = await db.cards.where('noteId').equals(noteId).toArray()
  const have = new Set(cards.map((c) => c.ordinal))
  return {
    addOrdinals: [...wanted].filter((o) => !have.has(o)),
    removeCards: cards.filter((c) => !wanted.has(c.ordinal)),
  }
}

/** 更新筆記，並依規則同步卡片 */
export async function updateNote(noteId: string, patch: NotePatch): Promise<void> {
  await db.transaction('rw', db.decks, db.notes, db.cards, db.reviewLogs, async () => {
    const note = await db.notes.get(noteId)
    if (!note) throw new AppError('找不到這則筆記')
    const plan = await planNoteUpdate(noteId, patch)
    const updated: Note = {
      ...note,
      ...patch,
      tags: patch.tags ? cleanTags(patch.tags) : note.tags,
      updatedAt: now(),
    }
    if (patch.deckId && !(await db.decks.get(patch.deckId))) throw new AppError('找不到這個牌組')
    await db.notes.put(updated)

    if (plan.removeCards.length) {
      const ids = plan.removeCards.map((c) => c.id)
      await db.reviewLogs.where('cardId').anyOf(ids).delete()
      await db.cards.bulkDelete(ids)
    }
    if (plan.addOrdinals.length) {
      const t = now()
      await db.cards.bulkAdd(plan.addOrdinals.map((o) => makeCard(updated, o, t)))
    }
    if (patch.deckId && patch.deckId !== note.deckId) {
      await db.cards.where('noteId').equals(noteId).modify({ deckId: patch.deckId })
    }
  })
}

/** 刪除筆記：連同它的卡片與複習紀錄一併刪除 */
export async function deleteNote(noteId: string): Promise<void> {
  await db.transaction('rw', db.notes, db.cards, db.reviewLogs, async () => {
    const cardIds = await db.cards.where('noteId').equals(noteId).primaryKeys()
    await db.reviewLogs.where('cardId').anyOf(cardIds).delete()
    await db.cards.bulkDelete(cardIds)
    await db.notes.delete(noteId)
  })
}

/** 同牌組中，正面（純文字）相同的既有筆記，用於「防重複」提醒 */
export async function findDuplicateNotes(deckId: string, front: string, excludeNoteId?: string): Promise<Note[]> {
  const target = htmlToText(front)
  if (!target) return []
  const notes = await db.notes.where('deckId').equals(deckId).toArray()
  return notes.filter((n) => n.id !== excludeNoteId && htmlToText(n.front) === target)
}
