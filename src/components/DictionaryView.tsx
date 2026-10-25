import { useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { BookOpen, Search, Trash2 } from 'lucide-react'
import { useStore } from '@/state/store'

function DictionaryEmptyState() {
  const lang = useStore((s) => s.lang)
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="max-w-lg text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-panel2">
          <BookOpen className="h-7 w-7 text-blue-500" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-fg">
          {lang === 'ru' ? 'Ваши дополнения пока пусты' : 'No custom translations yet'}
        </h2>
        <p className="mt-1 text-sm text-mut">
          {lang === 'ru'
            ? 'Откройте SP-Daten в режиме «Модули» — имена функций появятся здесь, и вы сможете добавить свои русские описания.'
            : 'Open SP-Daten in the Modules view — function names will appear here so you can add your own Russian descriptions.'}
        </p>
      </div>
    </div>
  )
}

export function DictionaryView() {
  const lang = useStore((s) => s.lang)
  const spDaten = useStore((s) => s.spDaten)
  const overlay = useStore((s) => s.overlay)
  const overlayFile = useStore((s) => s.overlayFile)
  const setOverlayEntry = useStore((s) => s.setOverlayEntry)
  const clearOverlay = useStore((s) => s.clearOverlay)
  const showToast = useStore((s) => s.showToast)
  const [filter, setFilter] = useState('')

  const names = useMemo(() => {
    const set = new Set<string>()
    if (overlay) for (const k of Object.keys(overlay)) set.add(k.toUpperCase())
    if (spDaten) {
      for (const m of spDaten.modules)
        for (const f of m.functions) {
          const n = spDaten.fswNames.get(f.id)
          if (n) set.add(n.toUpperCase())
        }
      for (const v of spDaten.pswNames.values()) set.add(v.toUpperCase())
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [spDaten, overlay])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return names
    return names.filter(
      (n) =>
        n.toLowerCase().includes(q) ||
        (overlay?.[n.toLowerCase()] ?? '').toLowerCase().includes(q),
    )
  }, [names, filter, overlay])

  const translatedCount = useMemo(
    () => names.filter((n) => overlay?.[n.toLowerCase()]).length,
    [names, overlay],
  )

  if (names.length === 0) return <DictionaryEmptyState />

  const onImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    void file.text().then((content) => {
      for (const line of content.split(/\r?\n/)) {
        const m = line.match(/^([^;,#]+)[;,]\s*(.+)$/)
        if (m) setOverlayEntry(m[1].trim(), m[2].trim())
      }
      showToast(lang === 'ru' ? 'Дополнения загружены' : 'Additions loaded')
    })
  }

  const onExport = () => {
    const rows = names
      .filter((n) => overlay?.[n.toLowerCase()])
      .map((n) => `${n}; ${overlay?.[n.toLowerCase()]}`)
    const blob = new Blob(['\uFEFF' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'ncs-studio-ru.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-panel/40 px-4 py-2">
        <span className="text-xs text-mut">
          {lang === 'ru'
            ? `Записей: ${names.length} · с русским: ${translatedCount}`
            : `Entries: ${names.length} · with Russian: ${translatedCount}`}
          {overlayFile ? ` · ${overlayFile}` : ''}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onExport}
            title={lang === 'ru' ? 'Экспорт ваших дополнений' : 'Export your additions'}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-panel px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-panel2 hover:text-fg"
          >
            CSV
          </button>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-panel px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-panel2 hover:text-fg">
            CSV↑
            <input type="file" accept=".csv,.txt" className="hidden" onChange={onImport} />
          </label>
          <button
            type="button"
            onClick={() => {
              if (confirm(lang === 'ru' ? 'Очистить ваши дополнения?' : 'Clear your additions?')) {
                void clearOverlay()
                showToast(lang === 'ru' ? 'Словарь очищен' : 'Dictionary cleared')
              }
            }}
            title={lang === 'ru' ? 'Очистить' : 'Clear'}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-panel px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-panel2 hover:text-fg"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="border-b border-line px-4 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={lang === 'ru' ? 'Поиск имени…' : 'Search name…'}
            spellCheck={false}
            className="w-full max-w-md rounded-lg border border-line bg-panel py-1.5 pl-9 pr-3 text-sm text-fg outline-none transition-colors placeholder:text-zinc-600 focus:border-blue-600"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-[minmax(220px,1fr)_minmax(240px,1fr)] gap-4 border-b border-line bg-panel/60 px-4 py-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
          <div>{lang === 'ru' ? 'Имя' : 'Name'}</div>
          <div>{lang === 'ru' ? 'Ваше описание' : 'Your description'}</div>
        </div>
        {filtered.slice(0, 400).map((name) => (
          <div
            key={name}
            className="grid grid-cols-[minmax(220px,1fr)_minmax(240px,1fr)] items-center gap-4 border-b border-line px-4 py-1.5"
          >
            <div className="truncate font-mono text-[13px] text-zinc-200">{name}</div>
            <input
              value={overlay?.[name.toLowerCase()] ?? ''}
              onChange={(e) => setOverlayEntry(name, e.target.value)}
              placeholder="—"
              spellCheck={false}
              className="w-full rounded-md border border-line bg-panel px-2.5 py-1 font-sans text-[13px] text-fg outline-none transition-colors focus:border-blue-600"
            />
          </div>
        ))}
        {filtered.length > 400 && (
          <div className="px-4 py-3 text-xs text-zinc-500">
            {lang === 'ru'
              ? 'Уточните поиск — показаны первые 400 записей'
              : 'Refine the search — showing first 400 entries'}
          </div>
        )}
      </div>
    </div>
  )
}
