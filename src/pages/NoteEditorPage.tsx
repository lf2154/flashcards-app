import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ConfirmDialog, PromptDialog } from '../components/Modal'
import { RichHtml } from '../components/RichHtml'
import { RichTextEditor } from '../components/RichTextEditor'
import { useToast } from '../components/Toast'
import { db } from '../db'
import { buildDeckTree, createDeck, flattenDeckTree } from '../db/decks'
import { createNote, deleteNote, findDuplicateNotes, NOTE_TYPE_LABELS, planNoteUpdate, updateNote } from '../db/notes'
import type { Note, NoteType } from '../db/types'
import { errorMessage } from '../lib/errors'
import { isHtmlEmpty } from '../lib/html'

const TYPES: NoteType[] = ['basic', 'basicReversed']
const LAST_DECK_KEY = 'lastDeckId'
const LAST_TYPE_KEY = 'lastNoteType'

const field = 'h-12 w-full rounded-xl border border-slate-300 bg-white px-3 dark:border-slate-600 dark:bg-slate-900'

function remember(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* 記不住也沒關係 */
  }
}
function recall(key: string): string {
  try {
    return localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}

/** 新增（/add）與編輯（/note/:id）共用的畫面 */
export function NoteEditorPage() {
  const { noteId } = useParams()
  // undefined＝載入中（或新增模式）、null＝找不到
  const note = useLiveQuery(async (): Promise<Note | null | undefined> => {
    if (!noteId) return undefined
    return (await db.notes.get(noteId)) ?? null
  }, [noteId])
  if (noteId) {
    if (note === undefined) return null
    if (note === null) {
      return (
        <div className="px-4 pt-8 text-center">
          <p className="mb-4 text-slate-600 dark:text-slate-400">找不到這則筆記，可能已經被刪除了。</p>
          <Link to="/" className="text-indigo-600 dark:text-indigo-400">
            回到牌組列表
          </Link>
        </div>
      )
    }
    return <NoteForm key={note.id} existing={note} />
  }
  return <NoteForm />
}

function NoteForm({ existing }: { existing?: Note }) {
  const navigate = useNavigate()
  const toast = useToast()
  const [params] = useSearchParams()
  const decks = useLiveQuery(() => db.decks.toArray(), [])
  const options = useMemo(() => flattenDeckTree(buildDeckTree(decks ?? [])), [decks])

  const [deckId, setDeckId] = useState(existing?.deckId ?? params.get('deck') ?? recall(LAST_DECK_KEY))
  const [type, setType] = useState<NoteType>(existing?.type ?? ((recall(LAST_TYPE_KEY) as NoteType) || 'basic'))
  const [front, setFront] = useState(existing?.front ?? '')
  const [back, setBack] = useState(existing?.back ?? '')
  const [extra, setExtra] = useState(existing?.extra ?? '')
  const [tags, setTags] = useState((existing?.tags ?? []).join(' '))
  const [resetKey, setResetKey] = useState(0)
  const [preview, setPreview] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [dupCount, setDupCount] = useState(0)
  const [confirm, setConfirm] = useState<null | { removeCount: number }>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [creatingDeck, setCreatingDeck] = useState(false)

  // 牌組還沒選、或選的牌組已不存在時，改選第一個
  useEffect(() => {
    if (!decks || decks.length === 0) return
    if (!decks.some((d) => d.id === deckId)) setDeckId(options[0]?.deck.id ?? decks[0].id)
  }, [decks, deckId, options])

  // 防重複：正面與同牌組既有筆記相同時提醒（仍可儲存）
  useEffect(() => {
    if (!deckId) return
    let cancelled = false
    const t = window.setTimeout(() => {
      void findDuplicateNotes(deckId, front, existing?.id).then((d) => !cancelled && setDupCount(d.length))
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [deckId, front, existing?.id])

  const parsedTags = tags.split(/[\s,，、]+/).filter(Boolean)

  const validate = (): boolean => {
    if (!deckId) return setError('請先選擇牌組'), false
    if (isHtmlEmpty(front)) return setError('請輸入正面'), false
    if (isHtmlEmpty(back)) return setError('請輸入背面'), false
    setError('')
    return true
  }

  const doSave = async () => {
    setBusy(true)
    try {
      if (existing) {
        await updateNote(existing.id, { deckId, type, front, back, extra, tags: parsedTags })
        toast('已儲存')
        navigate(-1)
      } else {
        await createNote({ deckId, type, front, back, extra, tags: parsedTags })
        remember(LAST_DECK_KEY, deckId)
        remember(LAST_TYPE_KEY, type)
        // 清空欄位、保留牌組與類型，方便連續新增
        setFront('')
        setBack('')
        setExtra('')
        setTags('')
        setResetKey((k) => k + 1)
        setPreview(false)
        toast('已新增')
      }
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
      setConfirm(null)
    }
  }

  const save = async () => {
    if (!validate()) return
    if (existing) {
      // 改類型會刪除卡片時，先提示會刪掉多少複習紀錄（SPEC 10.4）
      try {
        const plan = await planNoteUpdate(existing.id, { type })
        if (plan.removeCards.length > 0) return setConfirm({ removeCount: plan.removeCards.length })
      } catch (e) {
        return setError(errorMessage(e))
      }
    }
    await doSave()
  }

  if (decks && decks.length === 0) {
    return (
      <div className="pt-safe px-4 pt-8 text-center">
        <p className="mb-4 text-slate-600 dark:text-slate-400">還沒有牌組，請先建立一個。</p>
        <button className="h-12 rounded-xl bg-indigo-600 px-6 font-medium text-white" onClick={() => setCreatingDeck(true)}>
          新增牌組
        </button>
        <div className="mt-4">
          <Link to="/" className="text-indigo-600 dark:text-indigo-400">
            回到牌組列表
          </Link>
        </div>
        {creatingDeck && (
          <PromptDialog
            title="新增牌組"
            label="牌組名稱"
            confirmLabel="新增"
            onCancel={() => setCreatingDeck(false)}
            onSubmit={async (name) => {
              setDeckId(await createDeck(name))
              setCreatingDeck(false)
            }}
          />
        )}
      </div>
    )
  }

  const label = 'mb-1 block text-sm font-medium'
  return (
    <div className="pt-safe mx-auto flex min-h-dvh max-w-xl flex-col">
      <header className="flex items-center px-2 pt-2">
        <button className="h-12 px-3 text-indigo-600 dark:text-indigo-400" onClick={() => navigate(-1)}>
          ‹ 返回
        </button>
        <h1 className="flex-1 text-center text-lg font-bold">{existing ? '編輯筆記' : '新增卡片'}</h1>
        <button className="h-12 px-3 text-indigo-600 dark:text-indigo-400" onClick={() => setPreview((v) => !v)}>
          {preview ? '編輯' : '預覽'}
        </button>
      </header>

      <div className="flex-1 space-y-4 px-4 pt-3 pb-4">
        <div className="flex gap-3">
          <div className="min-w-0 flex-1">
            <label htmlFor="deck" className={label}>
              牌組
            </label>
            <select id="deck" className={field} value={deckId} onChange={(e) => setDeckId(e.target.value)}>
              {options.map((o) => (
                <option key={o.deck.id} value={o.deck.id}>
                  {o.path}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0 flex-1">
            <label htmlFor="type" className={label}>
              類型
            </label>
            <select id="type" className={field} value={type} onChange={(e) => setType(e.target.value as NoteType)}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {NOTE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {preview ? (
          <div className="space-y-3">
            <PreviewBox title="正面" html={front} />
            <PreviewBox title="背面" html={back} />
            {!isHtmlEmpty(extra) && <PreviewBox title="補充說明" html={extra} />}
            {type === 'basicReversed' && <p className="text-xs text-slate-500">這則筆記會產生 2 張卡片：正→反、反→正。</p>}
          </div>
        ) : (
          <div key={resetKey} className="space-y-4">
            <div>
              <span className={label}>正面</span>
              <RichTextEditor label="正面" value={front} onChange={setFront} placeholder="問題" autoFocus={!existing} />
              {dupCount > 0 && (
                <p role="alert" className="mt-1 rounded-lg bg-amber-50 p-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                  這個牌組已經有 {dupCount} 則正面相同的筆記，仍可儲存。
                </p>
              )}
            </div>
            <div>
              <span className={label}>背面</span>
              <RichTextEditor label="背面" value={back} onChange={setBack} placeholder="答案" />
            </div>
            <div>
              <span className={label}>補充說明（選填，只在背面顯示）</span>
              <RichTextEditor label="補充說明" value={extra} onChange={setExtra} />
            </div>
          </div>
        )}

        <div>
          <label htmlFor="tags" className={label}>
            標籤（選填，用空白分隔）
          </label>
          <input id="tags" className={field} value={tags} onChange={(e) => setTags(e.target.value)} />
        </div>

        {existing && (
          <button className="h-12 w-full rounded-xl border border-red-300 font-medium text-red-600 dark:border-red-900" onClick={() => setConfirmDelete(true)}>
            刪除這則筆記
          </button>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </div>

      <div className="pb-safe sticky bottom-0 border-t border-slate-200 bg-slate-50/95 p-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <button
          className="h-12 w-full rounded-xl bg-indigo-600 font-medium text-white active:bg-indigo-700 disabled:opacity-50"
          disabled={busy}
          onClick={save}
        >
          儲存
        </button>
      </div>

      {confirm && (
        <ConfirmDialog
          title="確定要改類型？"
          danger
          confirmLabel="繼續"
          message={`將刪除 ${confirm.removeCount} 張卡片的複習紀錄，無法復原。`}
          onCancel={() => setConfirm(null)}
          onConfirm={doSave}
        />
      )}
      {confirmDelete && existing && (
        <ConfirmDialog
          title="刪除這則筆記？"
          danger
          confirmLabel="刪除"
          message="這則筆記的所有卡片與複習紀錄都會一併刪除，無法復原。"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            await deleteNote(existing.id)
            toast('已刪除')
            navigate(-1)
          }}
        />
      )}
    </div>
  )
}

function PreviewBox({ title, html }: { title: string; html: string }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <h2 className="mb-1 text-xs text-slate-500">{title}</h2>
      {isHtmlEmpty(html) ? <p className="text-slate-400">（空白）</p> : <RichHtml html={html} />}
    </section>
  )
}
