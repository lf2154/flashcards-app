import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CountNumbers } from '../components/CountNumbers'
import { useDeckActions } from '../components/DeckActions'
import { InstallGuide } from '../components/InstallGuide'
import { PageHeader } from '../components/PageHeader'
import { buildDeckTree, type DeckNode } from '../db/decks'
import { useDeckCounts, useDecks } from '../lib/hooks'
import type { Counts } from '../scheduler/queue'

const COLLAPSED_KEY = 'collapsedDecks'

function loadCollapsed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

export function DecksPage() {
  const decks = useDecks()
  const counts = useDeckCounts()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(loadCollapsed)
  const [fabOpen, setFabOpen] = useState(false)
  const actions = useDeckActions({ onCreated: (id) => navigate(`/deck/${id}`) })
  const tree = useMemo(() => buildDeckTree(decks ?? []), [decks])

  const toggle = (id: string) => {
    const next = new Set(collapsed)
    if (!next.delete(id)) next.add(id)
    setCollapsed(next)
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]))
    } catch {
      /* 記不住展開狀態也沒關係 */
    }
  }

  const renderNode = (node: DeckNode, depth: number): React.ReactNode => {
    const isCollapsed = collapsed.has(node.deck.id)
    return (
      <li key={node.deck.id}>
        <div
          className="flex min-h-14 items-center border-b border-slate-100 dark:border-slate-800"
          style={{ paddingLeft: `${0.5 + depth * 1.25}rem` }}
        >
          {node.children.length > 0 ? (
            <button
              aria-label={isCollapsed ? `展開 ${node.deck.name}` : `收合 ${node.deck.name}`}
              aria-expanded={!isCollapsed}
              className="h-12 w-8 shrink-0 text-slate-400"
              onClick={() => toggle(node.deck.id)}
            >
              {isCollapsed ? '▸' : '▾'}
            </button>
          ) : (
            <span className="w-8 shrink-0" />
          )}
          <Link to={`/deck/${node.deck.id}`} className="flex min-h-14 min-w-0 flex-1 items-center justify-between gap-2">
            <span className="truncate font-medium">{node.deck.name}</span>
            <CountNumbers counts={counts?.get(node.deck.id) as Counts | undefined} />
          </Link>
          <button
            aria-label={`${node.deck.name} 的更多操作`}
            className="h-12 w-11 shrink-0 text-xl text-slate-400"
            onClick={() => actions.openMenu(node.deck)}
          >
            ⋯
          </button>
        </div>
        {!isCollapsed && node.children.length > 0 && <ul>{node.children.map((c) => renderNode(c, depth + 1))}</ul>}
      </li>
    )
  }

  return (
    <>
      <PageHeader title="牌組" />
      <InstallGuide />

      {decks && decks.length === 0 ? (
        <div className="mx-4 mt-6 rounded-2xl border border-dashed border-slate-300 p-6 text-center dark:border-slate-700">
          <p className="mb-4 text-slate-600 dark:text-slate-400">還沒有牌組。先建立一個，再開始新增卡片。</p>
          <button className="h-12 rounded-xl bg-indigo-600 px-6 font-medium text-white active:bg-indigo-700" onClick={actions.openCreate}>
            新增牌組
          </button>
        </div>
      ) : (
        <>
          <div className="mt-2 flex items-center justify-end text-[11px] text-slate-500">
            <span className="w-11 text-center">新卡</span>
            <span className="w-11 text-center">學習中</span>
            <span className="w-11 text-center">待複習</span>
            <span className="w-11" />
          </div>
          <ul className="mt-1">{tree.map((n) => renderNode(n, 0))}</ul>
        </>
      )}

      {/* 右下角浮動「＋」 */}
      {fabOpen && <div className="fixed inset-0 z-40" onClick={() => setFabOpen(false)} />}
      <div className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-end gap-2">
        {fabOpen && (
          <ul className="mb-1 w-44 overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
            <li>
              <button
                className="h-12 w-full px-4 text-left active:bg-slate-100 dark:active:bg-slate-800"
                onClick={() => {
                  setFabOpen(false)
                  navigate('/add')
                }}
              >
                新增卡片
              </button>
            </li>
            <li>
              <button
                className="h-12 w-full px-4 text-left active:bg-slate-100 dark:active:bg-slate-800"
                onClick={() => {
                  setFabOpen(false)
                  actions.openCreate()
                }}
              >
                新增牌組
              </button>
            </li>
            <li>
              <button disabled className="h-12 w-full px-4 text-left text-slate-400">
                匯入（階段 4 開放）
              </button>
            </li>
          </ul>
        )}
        <button
          aria-label="新增"
          aria-expanded={fabOpen}
          onClick={() => setFabOpen((v) => !v)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-3xl text-white shadow-lg active:bg-indigo-700"
        >
          {fabOpen ? '×' : '＋'}
        </button>
      </div>

      {actions.dialogs}
    </>
  )
}
