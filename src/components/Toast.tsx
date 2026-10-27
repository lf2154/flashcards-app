import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

type ShowToast = (message: string) => void

const ToastContext = createContext<ShowToast>(() => {})

/** 短暫浮現的提示（例如「已新增」） */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('')
  const timer = useRef<number | undefined>(undefined)

  const show = useCallback<ShowToast>((m) => {
    setMessage(m)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setMessage(''), 1800)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      {message && (
        <div
          role="status"
          className="pointer-events-none fixed inset-x-0 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-[70] flex justify-center px-4"
        >
          <div className="rounded-full bg-slate-900 px-5 py-3 text-sm text-white shadow-lg dark:bg-slate-100 dark:text-slate-900">
            {message}
          </div>
        </div>
      )}
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
