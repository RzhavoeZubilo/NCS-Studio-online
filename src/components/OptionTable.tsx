import { useEffect, useRef } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useStore, useTranslator } from '@/state/store'
import { isChanged } from '@/lib/trc'

export const GRID =
  'grid-cols-[minmax(200px,1.1fr)_minmax(160px,1fr)_minmax(240px,1.5fr)_16px]'

export function OptionTable({ rows }: { rows: number[] }) {
  const doc = useStore((s) => s.doc)
  const selected = useStore((s) => s.selected)
  const select = useStore((s) => s.select)
  const pendingScroll = useStore((s) => s.pendingScroll)
  const clearScroll = useStore((s) => s.clearScroll)
  const tr = useTranslator()
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 38,
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
    e.preventDefault()
    const cur = selected != null ? rows.indexOf(selected) : -1
    const next =
      e.key === 'ArrowDown'
        ? cur < 0
          ? 0
          : Math.min(cur + 1, rows.length - 1)
        : cur <= 0
          ? 0
          : cur - 1
    select(rows[next])
    virtualizer.scrollToIndex(next)
  }

  return (
    <div
      ref={parentRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="min-h-0 flex-1 overflow-auto outline-none"
    >
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => {
          const segIdx = rows[item.index]
          const seg = doc.segments[segIdx]
          if (seg.kind !== 'option') return null
          const changed = isChanged(seg)
          const isSelected = selected === segIdx
          const nameTr = tr(seg.name)
          return (
            <div
              key={item.key}
              onClick={() => select(segIdx)}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: item.size,
                transform: `translateY(${item.start}px)`,
              }}
              className={`grid cursor-pointer items-center gap-3 border-b border-line px-4 ${GRID} ${
                isSelected ? 'bg-sel' : 'hover:bg-panel/50'
              }`}
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="truncate font-mono text-[13px] text-fg">{seg.name}</span>
                {changed && (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" title="modified" />
                )}
              </div>
              <div className="truncate font-mono text-[13px] text-mut">
                {seg.values.map((v) => v.text).join('  ·  ')}
              </div>
              <div className="truncate text-[13px] text-faint">{nameTr ?? ''}</div>
              <div />
            </div>
          )
        })}
      </div>
    </div>
  )
}
