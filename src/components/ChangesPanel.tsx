import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useStore } from '@/state/store'
import { isChanged } from '@/lib/trc'
import { t } from '@/lib/i18n'

export function ChangesPanel() {
  const lang = useStore((s) => s.lang)
  const doc = useStore((s) => s.doc)
  const scrollTo = useStore((s) => s.scrollTo)
  const revertAll = useStore((s) => s.revertAll)
  const [open, setOpen] = useState(false)

  if (!doc) return null

  const changes: { index: number; name: string; from: string; to: string }[] = []
  doc.segments.forEach((seg, i) => {
    if (seg.kind !== 'option' || !isChanged(seg)) return
    changes.push({
      index: i,
      name: seg.name,
      from: seg.original.map((v) => v.text).join(', '),
      to: seg.values.map((v) => v.text).join(', '),
    })
  })
  if (changes.length === 0) return null

  return (
    <div className="shrink-0 border-t border-line bg-panel/50">
      <div className="flex items-center gap-4 px-4 py-1.5">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 text-sm font-medium text-amber-600 transition-colors hover:text-amber-300"
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          {t(lang, 'changes')} ({changes.length})
        </button>
        <button
          type="button"
          onClick={revertAll}
          className="text-xs text-faint transition-colors hover:text-fg2"
        >
          {t(lang, 'revertAll')}
        </button>
      </div>
      {open && (
        <div className="max-h-52 overflow-y-auto px-4 pb-3">
          <table className="w-full border-collapse text-sm">
            <tbody>
              {changes.map((c) => (
                <tr
                  key={c.index}
                  onClick={() => scrollTo(c.index)}
                  className="cursor-pointer border-b border-line/60 transition-colors hover:bg-panel2/"
                >
                  <td className="py-1 pr-3 font-mono text-xs text-fg2">{c.name}</td>
                  <td className="py-1 pr-3 font-mono text-xs text-faint line-through">{c.from}</td>
                  <td className="py-1 pr-3 font-mono text-xs text-amber-600">{c.to}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
