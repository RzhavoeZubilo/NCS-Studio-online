import { useMemo } from 'react'
import { Check, Plus } from 'lucide-react'
import { useStore, useTranslator } from '@/state/store'
import { isChanged } from '@/lib/trc'
import { translate } from '@/lib/translations'

export function OptionCards({ rows }: { rows: number[] }) {
  const doc = useStore((s) => s.doc)
  const select = useStore((s) => s.select)
  const selected = useStore((s) => s.selected)
  const setValues = useStore((s) => s.setValues)
  const tr = useTranslator()
  const lang = useStore((s) => s.lang)
  const spDaten = useStore((s) => s.spDaten)
  const linkedModule = useStore((s) => s.linkedModule)

  // possible values per function name, from the linked SGBD module
  const possible = useMemo(() => {
    const map = new Map<string, string[]>()
    if (!spDaten || !linkedModule) return map
    const mod = spDaten.modules.find((m) => m.fileName === linkedModule.fileName)
    if (!mod) return map
    for (const f of mod.functions) {
      const name = spDaten.fswNames.get(f.id)
      if (!name) continue
      map.set(
        name.toLowerCase(),
        f.values.map((v) => spDaten.pswNames.get(v) ?? `#${v}`),
      )
    }
    return map
  }, [spDaten, linkedModule])

  if (!doc) return null

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
      {rows.map((segIdx) => {
        const seg = doc.segments[segIdx]
        if (seg.kind !== 'option') return null
        const changed = isChanged(seg)
        const isSelected = selected === segIdx
        const nameTr = tr(seg.name)
        const possibleValues = possible.get(seg.name.toLowerCase())
        const current = seg.values.map((v) => v.text)

        const setSingle = (value: string) => setValues(segIdx, [value])

        const toggleIn = (value: string) => {
          if (current.includes(value)) {
            setValues(
              segIdx,
              current.filter((v) => v !== value),
            )
          } else {
            setValues(segIdx, [...current, value])
          }
        }

        return (
          <div
            key={segIdx}
            onClick={() => select(segIdx)}
            className={`mb-1.5 cursor-pointer rounded-lg border px-3 py-2 transition-colors ${
              isSelected ? 'border-blue-600 bg-sel' : 'border-line bg-panel hover:bg-panel/60'
            }`}
          >
            {/* header: name + translation + current value */}
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="font-mono text-[13px] font-semibold text-blue-500">{seg.name}</span>
              {nameTr && <span className="text-[13px] text-mut">{nameTr}</span>}
              <span
                className={`ml-auto font-mono text-[13px] ${
                  changed ? 'font-semibold text-amber-600' : 'text-faint'
                }`}
              >
                {current.join(', ') || '—'}
              </span>
              {changed && (
                <span className="rounded bg-amber-500/15 px-1.5 text-[11px] text-amber-600">
                  {lang === 'ru' ? 'изм.' : 'mod'}
                </span>
              )}
            </div>

            {/* values as checkboxes, NCS Dummy style */}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {(possibleValues ?? current).map((value) => {
                const active = current.includes(value)
                const valueTr = tr(value)
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation()
                      if (possibleValues && possibleValues.length > 1) toggleIn(value)
                      else setSingle(value)
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-xs transition-colors ${
                      active
                        ? 'border-blue-600 bg-sel font-medium text-fg'
                        : 'border-line bg-panel text-mut hover:border-blue-600 hover:text-fg'
                    }`}
                    title={valueTr}
                  >
                    {active && <Check className="h-3 w-3 text-blue-500" />}
                    {value}
                    {valueTr && !active && (
                      <span className="font-sans text-faint2">{valueTr}</span>
                    )}
                  </button>
                )
              })}
              <button
                type="button"
                onClick={(ev) => {
                  ev.stopPropagation()
                  select(segIdx)
                }}
                title={lang === 'ru' ? 'Редактировать' : 'Edit'}
                className="rounded-md border border-dashed border-line px-2 py-1 text-mut transition-colors hover:border-blue-600 hover:text-fg"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// keep translate import used (translations in the header line above)
void translate
