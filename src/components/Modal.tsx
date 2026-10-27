import { useEffect, useState, type ReactNode } from 'react'
import { errorMessage } from '../lib/errors'

/** 從畫面下方升起的對話框（單手好按） */
export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="pb-safe max-h-[85dvh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 text-lg font-bold">{title}</h2>
        {children}
      </div>
    </div>
  )
}

const btn = 'h-12 flex-1 rounded-xl font-medium disabled:opacity-50'

export function ConfirmDialog(props: {
  title: string
  message: ReactNode
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const run = async () => {
    setBusy(true)
    setError('')
    try {
      await props.onConfirm()
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }
  return (
    <Modal title={props.title} onClose={props.onCancel}>
      <div className="mb-4 text-slate-700 dark:text-slate-300">{props.message}</div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <div className="flex gap-3">
        <button className={`${btn} border border-slate-300 dark:border-slate-600`} onClick={props.onCancel} disabled={busy}>
          取消
        </button>
        <button
          className={`${btn} text-white ${props.danger ? 'bg-red-600 active:bg-red-700' : 'bg-indigo-600 active:bg-indigo-700'}`}
          onClick={run}
          disabled={busy}
        >
          {props.confirmLabel ?? '確定'}
        </button>
      </div>
    </Modal>
  )
}

export function PromptDialog(props: {
  title: string
  label: string
  initial?: string
  hint?: string
  confirmLabel?: string
  onSubmit: (value: string) => void | Promise<void>
  onCancel: () => void
}) {
  const [value, setValue] = useState(props.initial ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      await props.onSubmit(value)
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }
  return (
    <Modal title={props.title} onClose={props.onCancel}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <label className="mb-1 block text-sm text-slate-600 dark:text-slate-400" htmlFor="prompt-input">
          {props.label}
        </label>
        <input
          id="prompt-input"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-12 w-full rounded-xl border border-slate-300 bg-transparent px-3 dark:border-slate-600"
        />
        {props.hint && <p className="mt-1 text-xs text-slate-500">{props.hint}</p>}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-4 flex gap-3">
          <button type="button" className={`${btn} border border-slate-300 dark:border-slate-600`} onClick={props.onCancel} disabled={busy}>
            取消
          </button>
          <button type="submit" className={`${btn} bg-indigo-600 text-white active:bg-indigo-700`} disabled={busy}>
            {props.confirmLabel ?? '確定'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/** 一排大按鈕的選單（動作表） */
export function ActionSheet(props: {
  title: string
  actions: { label: string; onClick: () => void; danger?: boolean; disabled?: boolean }[]
  onClose: () => void
}) {
  return (
    <Modal title={props.title} onClose={props.onClose}>
      <ul className="-mx-1">
        {props.actions.map((a) => (
          <li key={a.label}>
            <button
              disabled={a.disabled}
              onClick={() => {
                props.onClose()
                a.onClick()
              }}
              className={`flex h-12 w-full items-center rounded-lg px-3 text-left active:bg-slate-100 disabled:opacity-40 dark:active:bg-slate-800 ${
                a.danger ? 'text-red-600' : ''
              }`}
            >
              {a.label}
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
