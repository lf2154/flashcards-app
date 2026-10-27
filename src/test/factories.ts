import type { Card, Deck, ReviewLog } from '../db/types'
import { defaultDeckSettings } from '../db/decks'
import { newSchedule } from '../scheduler/fsrs'

let seq = 0

export function makeDeck(over: Partial<Deck> & { id: string }): Deck {
  return {
    name: over.id,
    parentId: null,
    description: '',
    settings: defaultDeckSettings(),
    createdAt: 0,
    ...over,
  }
}

export function makeCard(over: Partial<Card> = {}): Card {
  seq++
  const id = over.id ?? `c${seq}`
  return {
    id,
    noteId: over.noteId ?? `n${id}`,
    deckId: 'd1',
    ordinal: 0,
    createdAt: seq,
    ...newSchedule(0),
    suspended: false,
    buried: false,
    buriedDay: null,
    flag: 0,
    ...over,
  }
}

export function makeLog(card: Card, over: Partial<ReviewLog> = {}): ReviewLog {
  seq++
  return {
    id: `l${seq}`,
    cardId: card.id,
    rating: 3,
    state: card.state,
    due: card.due,
    reviewedAt: 0,
    durationMs: 1000,
    prev: {
      due: card.due,
      stability: card.stability,
      difficulty: card.difficulty,
      elapsed_days: card.elapsed_days,
      scheduled_days: card.scheduled_days,
      learning_steps: card.learning_steps,
      reps: card.reps,
      lapses: card.lapses,
      state: card.state,
      last_review: card.last_review,
    },
    ...over,
  }
}
