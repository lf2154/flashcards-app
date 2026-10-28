import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../db'
import {
  buildDeckTree,
  createDeck,
  deleteDeck,
  descendantIds,
  flattenDeckTree,
  getDeckDeletionInfo,
  moveDeck,
  renameDeck,
  resetDeck,
  type DeckDeletionInfo,
} from '../db/decks'
import type { Deck } from '../db/types'
import { errorMessage } from '../lib/errors'
import { ActionSheet, ConfirmDialog, Modal, PromptDialog } from './Modal'
import { useToast } from './Toast'

type Dialog =
  | { kind: 'menu'; deck: Deck }
  | { kind: 'rename'; deck: Deck }
  | { kind: 'newChild'; deck: Deck }
  | { kind: 'move'; deck: Deck }
  | { kind: 'delete'; deck: Deck; info: DeckDeletionInfo }
  | { kind: 'reset'; deck: Deck; info: DeckDeletionInfo }
  | { kind: 'create' }

/**
 * 牌組的新增／改名／移動／刪除。首頁與牌組總覽共用。
 * 回傳 open* 函式與要放進畫面的 dialogs。
 */
export function useDeckActions(options: { onDeleted?: (deck: Deck) => void; onCreated?: (id: string) => void } = {}) {
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const navigate = useNavigate()
  const toast = useToast()
  const close = () => setDialog(null)

  const confirmWithInfo = async (kind: 'delete' | 'reset', deck: Deck) => {
    try {
      setDialog({ kind, deck, info: await getDeckDeletionInfo(deck.id) })
    } catch (e) {
      toast(errorMessage(e))
    }
  }

  let dialogs: ReactNode = null
  if (dialog?.kind === 'menu') {
    const deck = dialog.deck
    dialogs = (
      <ActionSheet
        title={deck.name}
        onClose={close}
        actions={[
          { label: '牌組設定', onClick: () => navigate(`/deck/${deck.id}/settings`) },
          { label: '新增子牌組', onClick: () => setDialog({ kind: 'newChild', deck }) },
          { label: '改名', onClick: () => setDialog({ kind: 'rename', deck }) },
          { label: '移動到其他牌組底下', onClick: () => setDialog({ kind: 'move', deck }) },
          { label: '重置牌組（全部變回新卡）', onClick: () => void confirmWithInfo('reset', deck) },
          { label: '刪除牌組', danger: true, onClick: () => void confirmWithInfo('delete', deck) },
        ]}
      />
    )
  } else if (dialog?.kind === 'create') {
    dialogs = (
      <PromptDialog
        title="新增牌組"
        label="牌組名稱"
        hint="想建立子牌組，可以用「::」分隔，例如「英文::多益」。"
        confirmLabel="新增"
        onCancel={close}
        onSubmit={async (name) => {
          const id = await createDeck(name)
          close()
          toast('已新增牌組')
          options.onCreated?.(id)
        }}
      />
    )
  } else if (dialog?.kind === 'newChild') {
    const parent = dialog.deck
    dialogs = (
      <PromptDialog
        title={`在「${parent.name}」底下新增子牌組`}
        label="子牌組名稱"
        confirmLabel="新增"
        onCancel={close}
        onSubmit={async (name) => {
          await createDeck(name, parent.id)
          close()
          toast('已新增子牌組')
        }}
      />
    )
  } else if (dialog?.kind === 'rename') {
    const deck = dialog.deck
    dialogs = (
      <PromptDialog
        title="改名"
        label="牌組名稱"
        initial={deck.name}
        confirmLabel="儲存"
        onCancel={close}
        onSubmit={async (name) => {
          await renameDeck(deck.id, name)
          close()
        }}
      />
    )
  } else if (dialog?.kind === 'move') {
    dialogs = (
      <MoveDialog
        deck={dialog.deck}
        onCancel={close}
        onDone={() => {
          close()
          toast('已移動')
        }}
      />
    )
  } else if (dialog?.kind === 'reset') {
    const { deck, info } = dialog
    dialogs = (
      <ConfirmDialog
        title={`重置「${deck.name}」？`}
        danger
        confirmLabel="重置"
        onCancel={close}
        message={
          <>
            <p>
              這個牌組{info.decks > 1 && `（含 ${info.decks - 1} 個子牌組）`}的 <b>{info.cards}</b> 張卡片會全部變回「新卡」，
              就像剛建立時一樣，可以從頭開始學。
            </p>
            <p className="mt-2">卡片內容不會刪除；學習紀錄會清除。暫停的卡和旗幟會保留。</p>
            <p className="mt-2 font-medium text-red-600">重置後無法復原。建議先到「設定」匯出備份。</p>
          </>
        }
        onConfirm={async () => {
          await resetDeck(deck.id)
          close()
          toast('已重置，卡片都變回新卡了')
        }}
      />
    )
  } else if (dialog?.kind === 'delete') {
    const { deck, info } = dialog
    dialogs = (
      <ConfirmDialog
        title={`刪除「${deck.name}」？`}
        danger
        confirmLabel="刪除"
        onCancel={close}
        message={
          <>
            <p>
              將刪除這個牌組
              {info.decks > 1 && `與其中 ${info.decks - 1} 個子牌組`}，以及 <b>{info.notes}</b> 則筆記、
              <b>{info.cards}</b> 張卡片和所有複習紀錄。
            </p>
            <p className="mt-2 font-medium text-red-600">刪除後無法復原。建議先到「設定」匯出備份。</p>
          </>
        }
        onConfirm={async () => {
          await deleteDeck(deck.id)
          close()
          toast('已刪除牌組')
          options.onDeleted?.(deck)
        }}
      />
    )
  }

  return {
    openMenu: (deck: Deck) => setDialog({ kind: 'menu', deck }),
    openCreate: () => setDialog({ kind: 'create' }),
    dialogs,
  }
}

function MoveDialog({ deck, onCancel, onDone }: { deck: Deck; onCancel: () => void; onDone: () => void }) {
  const [error, setError] = useState('')
  const [list, setList] = useState<{ id: string | null; label: string; depth: number }[] | null>(null)

  if (list === null) {
    void db.decks.toArray().then((all) => {
      const blocked = new Set(descendantIds(all, deck.id))
      const options = flattenDeckTree(buildDeckTree(all))
        .filter((x) => !blocked.has(x.deck.id))
        .map((x) => ({ id: x.deck.id as string | null, label: x.deck.name, depth: x.depth }))
      setList([{ id: null, label: '（最上層）', depth: 0 }, ...options])
    })
  }

  return (
    <Modal title={`把「${deck.name}」移到…`} onClose={onCancel}>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <ul>
        {(list ?? []).map((o) => (
          <li key={o.id ?? 'root'}>
            <button
              className="flex h-12 w-full items-center rounded-lg px-3 text-left active:bg-slate-100 dark:active:bg-slate-800"
              style={{ paddingLeft: `${0.75 + o.depth * 1.25}rem` }}
              disabled={o.id === deck.parentId}
              onClick={async () => {
                try {
                  await moveDeck(deck.id, o.id)
                  onDone()
                } catch (e) {
                  setError(errorMessage(e))
                }
              }}
            >
              {o.label}
              {o.id === deck.parentId && <span className="ml-2 text-xs text-slate-400">目前位置</span>}
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
