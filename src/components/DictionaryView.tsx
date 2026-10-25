import { useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { BookOpen, Download, Play, Search, Square, Trash2, Upload } from 'lucide-react'
import { useStore } from '@/state/store'
import { t } from '@/lib/i18n'

const BATCH_PAUSE_MS = 250

async function translateBatch(texts: string[]): Promise<string[]> {
  const q = texts.join('\n')
  const resp = await fetch(
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ru&dt=t&q=${encodeURIComponent(q)}`,
  )
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const data = (await resp.json()) as unknown
  const out: string[] = []
  // response: [[["chunk","src",...], ...], ...] — concatenate sentence chunks
  const sentences = (data as [unknown, [string, string][]][])?.[0]?.[1]
  if (Array.isArray(sentences)) {
    const joined = sentences.map((s) => s[0]).join('')
    out.push(...joined.split('\n'))
  } else {
    throw new Error('unexpected response')
  }
  while (out.length < texts.length) out.push('')
  return out.slice(0, texts.length)
}

function DictionaryEmptyState() {
  const lang = useStore((s) => s.lang)
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="max-w-lg text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-panel2">
          <BookOpen className="h-7 w-7 text-blue-500" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-fg">
          {lang === 'ru' ? 'Словарь пуст' : 'Dictionary is empty'}
        </h2>
        <p className="mt-1 text-sm text-mut">
          {lang === 'ru'
            ? 'Откройте SP-Daten в режиме «Модули» или загрузите базу переводов в Настройках — имена функций появятся здесь.'
            : 'Open SP-Daten in the Modules view or load a translations database in Settings — function names will appear here.'}
        </p>
      </div>
    </div>
  )
}

export function DictionaryView() {
  const lang = useStore((s) => s.lang)
  const spDaten = useStore((s) => s.spDaten)
  const translations = useStore((s) => s.translations)
  const overlay = useStore((s) => s.overlay)
  const overlayFile = useStore((s) => s.overlayFile)
  const dictStatus = useStore((s) => s.dictStatus)
  const autoTranslateRunning = useStore((s) => s.autoTranslateRunning)
  const setOverlayEntry = useStore((s) => s.setOverlayEntry)
  const loadOverlayCsv = useStore((s) => s.loadOverlayCsv)
  const clearOverlay = useStore((s) => s.clearOverlay)
  const setDictStatus = useStore((s) => s.setDictStatus)
  const setAutoTranslateRunning = useStore((s) => s.setAutoTranslateRunning)
  const showToast = useStore((s) => s.showToast)
  const importRef = useRef<HTMLInputElement>(null)
  const [filter, setFilter] = useState('')
  const cancelRef = useRef(false)

  // All known names: RU overlay keys + base database keys + SP-Daten functions.
  const names = useMemo(() => {
    const set = new Set<string>()
    if (overlay) for (const k of Object.keys(overlay)) set.add(k.toUpperCase())
    if (translations) for (const k of translations.keys()) set.add(k.toUpperCase())
    if (spDaten) {
      for (const m of spDaten.modules) for (const f of m.functions) {
        const n = spDaten.fswNames.get(f.id)
        if (n) set.add(n.toUpperCase())
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [overlay, translations, spDaten])

  const en = (name: string) => translations?.get(name.toLowerCase())
  const ru = (name: string) => overlay?.[name.toLowerCase()]

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return names
    return names.filter(
      (n) => n.toLowerCase().includes(q) || (en(n) ?? '').toLowerCase().includes(q) || (ru(n) ?? '').toLowerCase().includes(q),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [names, filter, overlay, translations])

  const translatedCount = useMemo(() => names.filter((n) => ru(n)).length, [names, overlay])

  // --- machine draft translation ---
  const runAutoTranslate = async () => {
    const targets = names.filter((n) => !ru(n) && en(n))
    if (targets.length === 0) {
      showToast(lang === 'ru' ? 'Всё уже переведено' : 'Nothing left to translate')
      return
    }
    if (!confirm(lang === 'ru'
      ? `Машинный перевод ${targets.length} описаний через внешний сервис (Google translate). Продолжить?`
      : `Machine-translate ${targets.length} descriptions via an external service (Google translate). Continue?`))
      return

    setAutoTranslateRunning(true)
    cancelRef.current = false
    try {
      let done = 0
      let batch: string[] = []
      const flush = async () => {
        if (batch.length === 0) return
        const src = batch.map((n) => en(n) ?? n)
        const out = await translateBatch(src)
        batch.forEach((name, i) => {
          if (out[i]) setOverlayEntry(name, out[i])
        })
        done += batch.length
        setDictStatus(`${done}/${targets.length}`)
        batch = []
        await new Promise((r) => setTimeout(r, BATCH_PAUSE_MS))
      }
      for (const name of targets) {
        if (cancelRef.current) break
        batch.push(name)
        if (batch.join('\n').length > 1200) await flush()
      }
      if (batch.length && !cancelRef.current) await flush()
      setDictStatus(null)
      setAutoTranslateRunning(false)
      if (!cancelRef.current) showToast(lang === 'ru' ? 'Черновик готов' : 'Draft complete')
    } catch (e) {
      setDictStatus(null)
      setAutoTranslateRunning(false)
      showToast(
        lang === 'ru'
          ? `Ошибка автоперевода: ${e instanceof Error ? e.message : String(e)} — заполните словарь вручную или импортом`
          : `Auto-translate failed: ${e instanceof Error ? e.message : String(e)} — fill the dictionary manually or by import`,
      )
    }
  }

  const onImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    void file.text().then((content) => {
      loadOverlayCsv(file.name, content)
      showToast(t(lang, 'translationsLoaded'))
    })
  }

  const onExport = () => {
    const rows = names.filter((n) => ru(n)).map((n) => `${n};${ru(n)}`)
    const blob = new Blob(['\uFEFF' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'ncs-studio-ru.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  if (names.length === 0) return <DictionaryEmptyState />

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-panel/40 px-4 py-2">
        <Database_ lang={lang} count={names.length} translated={translatedCount} file={overlayFile} />
        <div className="ml-auto flex items-center gap-2">
          {autoTranslateRunning ? (
            <button
              type="button"
              onClick={() => {
                cancelRef.current = true
              }}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-line bg-panel px-3 py-1.5 text-sm text-zinc-200 transition-colors hover:bg-panel2"
            >
              <Square className="h-3.5 w-3.5" /> {lang === 'ru' ? 'Стоп' : 'Stop'}
              {dictStatus ? ` · ${dictStatus}` : ''}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void runAutoTranslate()}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-line bg-panel px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-panel2 hover:text-fg"
            >
              <Play className="h-3.5 w-3.5" />
              {lang === 'ru' ? 'Машинный черновик EN→RU' : 'Machine draft EN→RU'}
            </button>
          )}
          <button
            type="button"
            onClick={() => importRef.current?.click()}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-line bg-panel px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-panel2 hover:text-fg"
          >
            <Upload className="h-3.5 w-3.5" /> CSV
          </button>
          <button
            type="button"
            onClick={onExport}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-line bg-panel px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-panel2 hover:text-fg"
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm(lang === 'ru' ? 'Очистить весь русский словарь?' : 'Clear the whole Russian dictionary?'))
                void clearOverlay()
            }}
            title={lang === 'ru' ? 'Очистить словарь' : 'Clear dictionary'}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-line bg-panel px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-panel2 hover:text-fg"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="border-b border-line px-4 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={lang === 'ru' ? 'Поиск имени или описания…' : 'Search name or description…'}
            spellCheck={false}
            className="w-full max-w-md rounded-lg border border-line bg-panel py-1.5 pl-9 pr-3 text-sm text-fg outline-none transition-colors placeholder:text-faint2 focus:border-blue-600"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-[minmax(200px,1fr)_minmax(200px,1.4fr)_minmax(200px,1fr)] gap-3 border-b border-line bg-panel/60 px-4 py-2 text-xs font-medium uppercase tracking-wider text-faint">
          <div>{lang === 'ru' ? 'Имя' : 'Name'}</div>
          <div>{lang === 'ru' ? 'Английское описание' : 'English description'}</div>
          <div>{lang === 'ru' ? 'Русское описание' : 'Russian description'}</div>
        </div>
        {filtered.slice(0, 400).map((name) => (
          <div key={name} className="grid grid-cols-[minmax(200px,1fr)_minmax(200px,1.4fr)_minmax(200px,1fr)] items-center gap-3 border-b border-line px-4 py-1.5">
            <div className="truncate font-mono text-[13px] text-zinc-200">{name}</div>
            <div className="truncate text-[13px] text-mut">{en(name) ?? ''}</div>
            <input
              value={ru(name) ?? ''}
              onChange={(e) => setOverlayEntry(name, e.target.value)}
              placeholder={lang === 'ru' ? '—' : '—'}
              spellCheck={false}
              className="w-full rounded-md border border-line bg-panel px-2.5 py-1 font-sans text-[13px] text-fg outline-none transition-colors focus:border-blue-600"
            />
          </div>
        ))}
        {filtered.length > 400 && (
          <div className="px-4 py-3 text-xs text-faint">
            {lang === 'ru' ? 'Уточните поиск — показаны первые 400 записей' : 'Refine the search — showing first 400 entries'}
          </div>
        )}
      </div>
      <input ref={importRef} type="file" accept=".csv,.txt" className="hidden" onChange={onImport} />
    </div>
  )
}

function Database_({ lang, count, translated, file }: { lang: string; count: number; translated: number; file: string }) {
  return (
    <span className="text-xs text-mut">
      {lang === 'ru'
        ? `Записей: ${count} · с русским: ${translated}`
        : `Entries: ${count} · with Russian: ${translated}`}
      {file ? ` · ${file}` : ''}
    </span>
  )
}
