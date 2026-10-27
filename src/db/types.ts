// 資料模型（SPEC 第 3 節）。所有時間都存 UTC 毫秒數。

/** 與 ts-fsrs 的 State 數值相同：0 新卡、1 學習中、2 複習、3 重新學習 */
export const CardState = { New: 0, Learning: 1, Review: 2, Relearning: 3 } as const
export type CardStateValue = (typeof CardState)[keyof typeof CardState]

/** 評分：1 重來、2 困難、3 良好、4 簡單 */
export type Rating = 1 | 2 | 3 | 4

export type NoteType = 'basic' | 'basicReversed' | 'cloze'

export type NewCardOrder = 'sequential' | 'random'

export interface DeckSettings {
  /** 每日新卡上限 */
  newPerDay: number
  /** 每日複習上限 */
  reviewPerDay: number
  /** 目標記憶率 0.7～0.99 */
  desiredRetention: number
  /** 學習步驟（分鐘） */
  learningSteps: number[]
  /** 重新學習步驟（分鐘） */
  relearningSteps: number[]
  newOrder: NewCardOrder
  /** 朗讀語言（階段 3 使用），空字串＝未設定 */
  speechLang: string
  /** 翻到該面時自動朗讀（階段 3 使用） */
  autoSpeak: boolean
}

export interface Deck {
  id: string
  /** 只放自己這一層的名稱（不含「::」）；完整路徑由 parentId 推算 */
  name: string
  parentId: string | null
  description: string
  settings: DeckSettings
  createdAt: number
}

export interface Note {
  id: string
  deckId: string
  type: NoteType
  /** 簡易 HTML */
  front: string
  back: string
  /** 補充說明，只在背面顯示 */
  extra: string
  tags: string[]
  frontLang?: string
  backLang?: string
  createdAt: number
  updatedAt: number
}

/** 排程相關欄位（複習一次會改變的那些）；復原時整組還原 */
export interface CardSchedule {
  due: number
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  /** 目前在第幾個學習步驟 */
  learning_steps: number
  reps: number
  lapses: number
  state: CardStateValue
  last_review: number | null
}

export interface Card extends CardSchedule {
  id: string
  noteId: string
  deckId: string
  /**
   * 這是筆記的第幾張卡。基本卡：0；反轉卡：0＝正→反、1＝反→正；
   * 填空卡：對應挖空編號 cN 的 N（階段 3）。
   */
  ordinal: number
  /** 建立時間，用來決定新卡「依新增順序」 */
  createdAt: number
  suspended: boolean
  /** 被埋到明天 */
  buried: boolean
  /** 在哪一個學習日被埋（只有當天有效，隔天自動恢復） */
  buriedDay: number | null
  /** 旗幟：0 無、1 紅、2 橘、3 綠、4 藍 */
  flag: number
}

export interface ReviewLog {
  id: string
  cardId: string
  rating: Rating
  /** 評分前的卡片狀態 */
  state: CardStateValue
  /** 評分前的到期時間 */
  due: number
  reviewedAt: number
  durationMs: number
  /** 評分前的完整排程欄位，「復原」用 */
  prev: CardSchedule
}

export interface MediaRow {
  id: string
  blob: Blob
  mimeType: string
  width: number
  height: number
  createdAt: number
}

export interface SettingRow {
  key: string
  value: unknown
}
