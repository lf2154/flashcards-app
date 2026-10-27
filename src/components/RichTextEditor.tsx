import { useEffect } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'

// 富文字編輯使用 TipTap，只開放粗體、斜體、底線、換行、清單（SPEC 10.5）。
// 圖片在階段 3 加入。

interface Props {
  value: string
  onChange: (html: string) => void
  label: string
  placeholder?: string
  autoFocus?: boolean
}

export function RichTextEditor({ value, onChange, label, placeholder, autoFocus }: Props) {
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
      Placeholder.configure({ placeholder: placeholder ?? '' }),
    ],
    content: value,
    autofocus: autoFocus ? 'end' : false,
    editorProps: { attributes: { 'aria-label': label, class: 'rich px-3 py-2' } },
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? '' : editor.getHTML()),
  })

  // 外部把內容清空或換掉時（例如儲存後清空欄位），同步到編輯器
  useEffect(() => {
    if (!editor) return
    const current = editor.isEmpty ? '' : editor.getHTML()
    if (current !== value) editor.commands.setContent(value, { emitUpdate: false })
  }, [value, editor])

  if (!editor) return null

  const btn = (active: boolean) =>
    `h-10 min-w-10 rounded-lg px-2 text-sm font-semibold ${
      active ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
    }`
  // onMouseDown 阻止預設行為，按工具列時編輯器才不會失去焦點（鍵盤不會收起來）
  const keep = (e: React.MouseEvent) => e.preventDefault()

  return (
    <div className="rounded-xl border border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900">
      <div className="flex gap-1 border-b border-slate-200 p-1 dark:border-slate-700" role="toolbar" aria-label={`${label}格式`}>
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
          • 清單
        </button>
        <button type="button" aria-label="編號清單" className={btn(editor.isActive('orderedList'))} onMouseDown={keep} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          1. 清單
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
