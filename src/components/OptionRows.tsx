import { useEffect, useRef } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Pencil, RotateCcw } from 'lucide-react'
import { useStore } from '@/state/store'
import { useDescribe } from '@/state/describe'
import { isChanged } from '@/lib/trc'
import { usePossibleValues } from '@/state/possibleValues'

export function OptionRows({ rows }: { rows: number[] }) {
  const doc = useStore((s) => s.doc)
  const selected = useStore((s) => s.selected)
  const select = useStore((s) => s.select)
  const setValues = useStore((s) => s.setValues)
  const revert = useStore((s) => s.revert)
  const pendingScroll = useStore((s) => s.pendingScroll)
  const clearScroll = useStore((s) => s.clearScroll)
  const lang = useStore((s) => s.lang)
  const describe = useDescribe()
  const possible = usePossibleValues()
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 12,
  })

  useEffect(() => {
    if (pendingScroll == null) return
    const pos = rows.indexOf(pendingScroll)
    if (pos >= 0) virtualizer.scrollToIndex(pos, { align: 'center' })
    clearScroll()
  }, [pendingScroll, rows, virtualizer, clearScroll])

  if (!doc) return null

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if ((e.key !== 'ArrowDown' && e.key !== 'ArrowUp') || rows.length === 0) return
    if (e.target instanceof HTMLSelectElement) return
    e.preventDefault()
    const cur = selected != null ? rows.indexOf(selected) : -1
    const next = e.key === 'ArrowDown' ? Math.min(cur + 1, rows.length - 1) : Math.max(cur - 1, 0)
    select(rows[next])
    virtualizer.scrollToIndex(next)
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-faint">
        {lang === 'ru' ? 'Ничего не найдено' : 'Nothing found'}
      </div>
    )
  }

  return (
    <div ref={parentRef} tabIndex={0} onKeyDown={onKeyDown} className="min-h-0 flex-1 overflow-auto outline-none">
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => {
          const segIdx = rows[item.index]
          const seg = doc.segments[segIdx]
          if (seg.kind !== 'option') return null
          const changed = isChanged(seg)
          const current = seg.values.map((v) => v.text)
          const text = describe.fn(seg.name)
          // SP-Daten list of values, else the values named in the description
          const options = possible.get(seg.name.toLowerCase()) ?? (text.values.size ? [...text.values.keys()] : undefined)
          const single = current.length <= 1 && options && options.length > 0
          const choices = single && !options.includes(current[0] ?? '') ? [current[0] ?? '', ...options] : options
          const valueNote = (v: string) => describe.value(seg.name, v)

          return (
            <div
              key={item.key}
              onClick={() => select(segIdx)}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: item.size, transform: `translateY(${item.start}px)` }}
              className={`flex cursor-pointer items-center gap-3 border-b border-l-2 border-b-line px-4 ${
                changed ? 'border-l-amber-500 bg-amber-500/5' : 'border-l-transparent'
              } ${selected === segIdx ? 'bg-sel' : 'hover:bg-panel/50'}`}
            >
              <div className="min-w-0 flex-1" title={[text.title, text.original, text.hint].filter(Boolean).join('\n')}>
                <div className="truncate text-sm text-fg">{text.title}</div>
                {text.title !== seg.name && (
                  <div className="truncate text-xs text-faint">
                    <span className="font-mono">{seg.name}</span>
                    {text.original && <span> · {text.original}</span>}
                  </div>
                )}
              </div>

              {single && choices ? (
                <select
                  value={current[0] ?? ''}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setValues(segIdx, [e.target.value])}
                  className={`w-[45%] max-w-72 shrink-0 rounded-lg border bg-panel px-2 py-1.5 font-mono text-[13px] outline-none transition-colors focus:border-blue-600 ${
                    changed ? 'border-amber-600/60 text-amber-600' : 'border-line text-fg'
                  }`}
                >
                  {choices.map((v) => {
                    const vt = valueNote(v)
                    return (
                      <option key={v} value={v}>
                        {v}
                        {vt ? ` — ${vt}` : ''}
                      </option>
                    )
                  })}
                </select>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    select(segIdx)
                  }}
                  title={lang === 'ru' ? 'Изменить значения' : 'Edit values'}
                  className={`flex w-[45%] max-w-72 shrink-0 items-center justify-between gap-2 rounded-lg border px-2 py-1.5 text-left font-mono text-[13px] transition-colors hover:border-blue-600 ${
                    changed ? 'border-amber-600/60 text-amber-600' : 'border-line text-fg2'
                  }`}
                >
                  <span className="truncate">
                    {current.join(', ') || '—'}
                    {current.length === 1 && valueNote(current[0]) && (
                      <span className="font-sans text-faint"> — {valueNote(current[0])}</span>
                    )}
                  </span>
                  <Pencil className="h-3.5 w-3.5 shrink-0 text-faint" />
                </button>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  revert(segIdx)
                }}
                title={lang === 'ru' ? 'Вернуть исходное значение' : 'Revert to original'}
                className={`shrink-0 rounded-md p-1.5 text-faint transition-colors hover:bg-panel2 hover:text-fg ${changed ? '' : 'invisible'}`}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
