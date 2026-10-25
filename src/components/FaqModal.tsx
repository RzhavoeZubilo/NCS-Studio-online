import { X } from 'lucide-react'
import { useStore } from '@/state/store'
import { FAQ } from '@/lib/faq'

export function FaqModal() {
  const lang = useStore((s) => s.lang)
  const setFaqOpen = useStore((s) => s.setFaqOpen)
  const title = lang === 'ru' ? 'Частые вопросы' : 'FAQ'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setFaqOpen(false)}>
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl border border-line bg-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <span className="text-base font-semibold text-fg">{title}</span>
          <button
            type="button"
            onClick={() => setFaqOpen(false)}
            className="rounded-md p-1 text-mut transition-colors hover:bg-panel2 hover:text-fg"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {FAQ.map((item, i) => (
            <div key={i} className="mb-4 last:mb-0">
              <div className="text-sm font-semibold text-blue-500">{item.q[lang]}</div>
              <p className="mt-1 text-sm leading-relaxed text-fg2">{item.a[lang]}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
