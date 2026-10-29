import { useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import { addMedia, getMediaBlob, mediaIdsIn } from '../db/media'
import { nextClozeNumber } from '../lib/cloze'
import { errorMessage } from '../lib/errors'
import { compressImage } from '../lib/image'

// 富文字編輯使用 TipTap，只開放粗體、斜體、底線、換行、清單、圖片（SPEC 10.5）。
// 圖片存在手機的資料庫，內容裡以 media://ID 引用；編輯器裡暫時換成可顯示的網址。

interface Props {
  value: string
  onChange: (html: string) => void
  label: string
  placeholder?: string
  autoFocus?: boolean
  /** 顯示「挖空」按鈕（填空卡的正面） */
  cloze?: boolean
  /** 顯示錯誤訊息（例如圖片讀不到） */
  onError?: (message: string) => void
}

export function RichTextEditor({ value, onChange, label, placeholder, autoFocus, cloze, onError }: Props) {
  // media://ID ↔ 編輯器裡用的 Object URL
  const urlOf = useRef(new Map<string, string>())
  const [mediaTick, setMediaTick] = useState(0)
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  // 提示字可能隨卡片類型改變，用 ref 讓編輯器隨時讀到最新的
  const placeholderRef = useRef(placeholder ?? '')
  placeholderRef.current = placeholder ?? ''
  const cameraInput = useRef<HTMLInputElement>(null)

  const toDisplay = (html: string) =>
    html.replace(/media:\/\/([\w-]+)/g, (m, id: string) => urlOf.current.get(id) ?? m)
  const toStored = (html: string) => {
    let out = html
    for (const [id, url] of urlOf.current) out = out.split(url).join(`media://${id}`)
    return out
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // 只留下規格允許的功能
        heading: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        link: false,
      }),
      Placeholder.configure({ placeholder: () => placeholderRef.current }),
      Image.configure({ inline: false, allowBase64: false }),
    ],
    content: toDisplay(value),
    autofocus: autoFocus ? 'end' : false,
    editorProps: { attributes: { 'aria-label': label, class: 'rich px-3 py-2' } },
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? '' : toStored(editor.getHTML())),
  })

  // 載入內容裡引用的圖片，換成可以顯示的網址
  useEffect(() => {
    const missing = mediaIdsIn(value).filter((id) => !urlOf.current.has(id))
    if (missing.length === 0) return
    let alive = true
    void (async () => {
      for (const id of missing) {
        const blob = await getMediaBlob(id).catch(() => undefined)
        if (blob && alive) urlOf.current.set(id, URL.createObjectURL(blob))
      }
      if (alive) setMediaTick((t) => t + 1)
    })()
    return () => {
      alive = false
    }
  }, [value])

  // 離開畫面時釋放圖片網址，避免記憶體越用越多（SPEC 10.6）
  useEffect(() => {
    const urls = urlOf.current
    return () => {
      for (const u of urls.values()) URL.revokeObjectURL(u)
      urls.clear()
    }
  }, [])

  // 外部把內容清空或換掉時（例如儲存後清空欄位），以及圖片載入好時，同步到編輯器
  useEffect(() => {
    // 編輯器剛建立或正在重建時還不能讀內容
    if (!editor || editor.isDestroyed) return
    const current = editor.isEmpty ? '' : toStored(editor.getHTML())
    // 編輯器裡還有沒換成網址的 media://，而且現在圖片已經載入好了
    const mediaReady = editor.getHTML().includes('src="media://') && toDisplay(value) !== value
    if (current !== value || mediaReady) {
      editor.commands.setContent(toDisplay(value), { emitUpdate: false })
    }
  }, [value, editor, mediaTick])

  if (!editor) return null

  const insertImage = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      const { blob, width, height } = await compressImage(file)
      const id = await addMedia(blob, width, height)
      const url = URL.createObjectURL(blob)
      urlOf.current.set(id, url)
      editor.chain().focus().setImage({ src: url }).run()
    } catch (e) {
      onError?.(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  // 挖空：把選取的文字包成 {{cN::…}}，N 自動遞增；沒選字就插入空的 {{cN::}} 並把游標放進去
  const makeCloze = () => {
    const n = nextClozeNumber(editor.getText())
    const { from, to, empty } = editor.state.selection
    const selected = editor.state.doc.textBetween(from, to, ' ')
    if (empty || !selected) {
      editor.chain().focus().insertContent(`{{c${n}::}}`).run()
      const pos = editor.state.selection.from - 2
      editor.commands.setTextSelection(pos)
    } else {
      editor.chain().focus().insertContentAt({ from, to }, `{{c${n}::${selected}}}`).run()
    }
  }

  const btn = (active: boolean) =>
    `h-10 min-w-10 shrink-0 rounded-lg px-2 text-sm font-semibold disabled:opacity-40 ${
      active ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
    }`
  // onMouseDown 阻止預設行為，按工具列時編輯器才不會失去焦點（鍵盤不會收起來）
  const keep = (e: React.MouseEvent) => e.preventDefault()

  return (
    <div className="rounded-xl border border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900">
      <div className="flex flex-wrap gap-1 border-b border-slate-200 p-1 dark:border-slate-700" role="toolbar" aria-label={`${label}格式`}>
        {cloze && (
          <button type="button" aria-label="挖空" className={`${btn(false)} bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200`} onMouseDown={keep} onClick={makeCloze}>
            挖空
          </button>
        )}
        <button type="button" aria-label="粗體" className={btn(editor.isActive('bold'))} onMouseDown={keep} onClick={() => editor.chain().focus().toggleBold().run()}>
          <b>B</b>
        </button>
        <button type="button" aria-label="斜體" className={btn(editor.isActive('italic'))} onMouseDown={keep} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <i>I</i>
        </button>
        <button type="button" aria-label="底線" className={btn(editor.isActive('underline'))} onMouseDown={keep} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <u>U</u>
        </button>
        <button type="button" aria-label="項目符號" className={btn(editor.isActive('bulletList'))} onMouseDown={keep} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          •
        </button>
        <button type="button" aria-label="編號清單" className={btn(editor.isActive('orderedList'))} onMouseDown={keep} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          1.
        </button>
        <button type="button" aria-label="從相簿插入圖片" disabled={busy} className={btn(false)} onMouseDown={keep} onClick={() => fileInput.current?.click()}>
          {busy ? '處理中…' : '圖片'}
        </button>
        <button type="button" aria-label="拍照插入" disabled={busy} className={btn(false)} onMouseDown={keep} onClick={() => cameraInput.current?.click()}>
          拍照
        </button>
      </div>
      <EditorContent editor={editor} />
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          void insertImage(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          void insertImage(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
