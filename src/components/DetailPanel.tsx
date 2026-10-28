import { useState } from 'react'
import { Plus, RotateCcw, X } from 'lucide-react'
import { useStore } from '@/state/store'
import { useDescribe } from '@/state/describe'
import { usePossibleValues } from '@/state/possibleValues'
import { isChanged } from '@/lib/trc'
import { t } from '@/lib/i18n'

function AddValue({
  onAdd,
  lang,
}: {
  onAdd: (text: string) => void
  lang: ReturnType<typeof useStore.getState>['lang']
}) {
  const [text, setText] = useState('')
  const submit = () => {
    onAdd(text)
    setText('')
  }
  return (
    <div className="mt-3 flex items-center gap-1">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
        }}
        placeholder={t(lang, 'addValue')}
        spellCheck={false}
        className="min-w-0 flex-1 rounded-md border border-line bg-panel px-2.5 py-1.5 font-mono text-sm text-fg outline-none transition-colors placeholder:text-faint2 focus:border-blue-600"
      />
      <button
        type="button"
        onClick={submit}
        title="Add value"
        className="rounded-md p-2 text-mut transition-colors hover:bg-panel2 hover:text-fg"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  )
}

export function DetailPanel() {
  const lang = useStore((s) => s.lang)
  const doc = useStore((s) => s.doc)
  const selected = useStore((s) => s.selected)
  const describe = useDescribe()
  const setValues = useStore((s) => s.setValues)
  const revert = useStore((s) => s.revert)
  const possible = usePossibleValues()

  if (!doc || selected == null) return null
  const seg = doc.segments[selected]
  if (seg.kind !== 'option') return null

  const changed = isChanged(seg)
  const text = describe.fn(seg.name)
  // choices: the module's possible values (SP-Daten), else the values named in the description
  const quick = possible.get(seg.name.toLowerCase()) ?? [...text.values.keys()]
  const current = seg.values.map((v) => v.text)

  return (
    <aside className="flex w-[380px] shrink-0 flex-col overflow-y-auto border-l border-line bg-panel/30">
      <div className="border-b border-line px-4 py-3">
        <div className="break-all font-mono text-sm font-semibold text-blue-500">{seg.name}</div>
        {text.title !== seg.name && <div className="mt-1 text-sm text-fg">{text.title}</div>}
        {text.original && <div className="mt-0.5 text-sm text-mut">{text.original}</div>}
        {text.hint && <div className="mt-1 font-mono text-xs text-faint">{text.hint}</div>}
        {text.unverified && (
          <div className="mt-1.5 text-xs text-faint">
            {lang === 'ru'
              ? 'Описание составлено по имени параметра и ещё не проверено на машине.'
              : 'Described from the parameter name, not yet checked on a car.'}
          </div>
        )}
        {changed && (
          <div className="mt-2 inline-flex items-center gap-1 rounded bg-amber-500/15 px-2 py-0.5 text-xs text-amber-600">
            {t(lang, 'modified')}
          </div>
        )}
      </div>

      <div className="flex-1 px-4 py-3">
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">
          {t(lang, 'values')} ({seg.values.length})
        </div>
        <div className="space-y-2">
          {seg.values.map((v, vi) => {
            const valueChanged = v.text !== seg.original[vi]?.text
            const valueTr = describe.value(seg.name, v.text)
            return (
              <div key={vi}>
                <div className="flex items-center gap-1">
                  <input
                    value={v.text}
                    onChange={(e) =>
                      setValues(
                        selected,
                        seg.values.map((cur, j) => (j === vi ? e.target.value : cur.text)),
                      )
                    }
                    spellCheck={false}
                    className={`min-w-0 flex-1 rounded-md border bg-panel px-2.5 py-1.5 font-mono text-sm outline-none transition-colors focus:border-blue-600 ${
                      valueChanged ? 'border-amber-700 text-amber-300' : 'border-line text-fg'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setValues(
                        selected,
                        seg.values.filter((_, j) => j !== vi).map((x) => x.text),
                      )
                    }
                    title={t(lang, 'removeValue')}
                    className="rounded-md p-1.5 text-faint transition-colors hover:bg-panel2 hover:text-fg"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {valueTr && <div className="mt-0.5 pl-1 text-xs text-faint">{valueTr}</div>}
              </div>
            )
          })}
        </div>

        <AddValue
          lang={lang}
          onAdd={(text) => {
            if (!text.trim()) return
            setValues(selected, [...seg.values.map((x) => x.text), text.trim()])
          }}
        />

        {seg.values.length <= 1 && quick.length > 0 && (
          <div className="mt-4">
            <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-faint">
              {t(lang, 'quickSet')}
            </div>
            <div className="space-y-1">
              {quick.map((val) => {
                const active = current.includes(val)
                const note = describe.value(seg.name, val)
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setValues(selected, [val])}
                    className={`flex w-full items-baseline gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors ${
                      active ? 'border-blue-600 bg-sel text-fg' : 'border-line bg-panel text-fg2 hover:border-blue-500'
                    }`}
                  >
                    <span className="shrink-0 font-mono">{val}</span>
                    {note && <span className="text-mut">{note}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-line px-4 py-3">
        {changed && (
          <button
            type="button"
            onClick={() => revert(selected)}
            className="mb-3 inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-line bg-panel px-3 py-1.5 text-sm text-fg2 transition-colors hover:bg-panel2 hover:text-fg"
          >
            <RotateCcw className="h-3.5 w-3.5" /> {t(lang, 'revertChanges')}
          </button>
        )}
        <div className="text-xs text-faint2">
          {t(lang, 'original')}: <span className="font-mono">{seg.original.map((v) => v.text).join(', ') || '—'}</span>
        </div>
      </div>
    </aside>
  )
}
