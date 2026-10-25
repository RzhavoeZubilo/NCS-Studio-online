import { useCallback, useEffect, useMemo, useState } from 'react'
import { useStore } from '@/state/store'
import { docStats, isChanged } from '@/lib/trc'
import { t } from '@/lib/i18n'
import { Header } from '@/components/Header'
import { PrgView } from '@/components/PrgView'
import { ModulesView } from '@/components/ModulesView'
import { DictionaryView } from '@/components/DictionaryView'
import { FaView } from '@/components/FaView'
import { FaqModal } from '@/components/FaqModal'
import { OptionTable, GRID } from '@/components/OptionTable'
import { DetailPanel } from '@/components/DetailPanel'
import { ChangesPanel } from '@/components/ChangesPanel'
import { StatusBar } from '@/components/StatusBar'
import { EmptyState } from '@/components/EmptyState'
import { OptionCards } from '@/components/OptionCards'

export default function App() {
  const doc = useStore((s) => s.doc)
  const query = useStore((s) => s.query)
  const setQuery = useStore((s) => s.setQuery)
  const changedOnly = useStore((s) => s.changedOnly)
  const setChangedOnly = useStore((s) => s.setChangedOnly)
  const translations = useStore((s) => s.translations)
  const spDaten = useStore((s) => s.spDaten)
  const linkedModule = useStore((s) => s.linkedModule)
  const openFile = useStore((s) => s.openFile)
  const view = useStore((s) => s.view)
  const theme = useStore((s) => s.theme)
  const faqOpen = useStore((s) => s.faqOpen)
  const restoreOverlay = useStore((s) => s.restoreOverlay)
  const linkModule = useStore((s) => s.linkModule)
  const toast = useStore((s) => s.toast)
  const lang = useStore((s) => s.lang)
  const [dragging, setDragging] = useState(false)

  // Apply theme.
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  // Restore the Russian dictionary overlay on startup.
  useEffect(() => {
    void restoreOverlay()
  }, [restoreOverlay])

  // Link the open trace to an SP-Daten module when both are present.
  useEffect(() => {
    linkModule()
  }, [doc, spDaten, linkModule])

  const [cardsView, setCardsView] = useState(
    (localStorage.getItem('cardsView') ?? 'cards') === 'cards',
  )

  const handleFile = useCallback(
    (file: File) => {
      void openFile(file)
    },
    [openFile],
  )

  // Window-wide drag & drop of coding files.
  useEffect(() => {
    let depth = 0
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')
    const onDragEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth++
      setDragging(true)
    }
    const onDragOver = (e: DragEvent) => e.preventDefault()
    const onDragLeave = () => {
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      depth = 0
      setDragging(false)
      const file = e.dataTransfer?.files[0]
      if (file) handleFile(file)
    }
    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [handleFile])

  const restoreTranslations = useStore((s) => s.restoreTranslations)

  // Restore cached translations on startup (like NCS Dummy loading its own
  // Translations.csv from the program folder).
  useEffect(() => {
    void restoreTranslations()
  }, [restoreTranslations])

  // Auto-hide toasts.
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => useStore.getState().showToast(''), 2500)
    return () => clearTimeout(t)
  }, [toast])

  const rows = useMemo(() => {
    if (!doc) return []
    const q = query.trim().toLowerCase()
    const out: number[] = []
    doc.segments.forEach((seg, i) => {
      if (seg.kind !== 'option') return
      if (changedOnly && !isChanged(seg)) return
      if (q) {
        const tr = translations?.get(seg.name.toLowerCase()) ?? ''
        const hay = `${seg.name}\n${seg.values.map((v) => v.text).join('\n')}\n${tr}`.toLowerCase()
        if (!hay.includes(q)) return
      }
      out.push(i)
    })
    return out
  }, [doc, query, changedOnly, translations])

  const stats = doc ? docStats(doc) : null

  return (
    <div className="flex h-full flex-col">
      <Header />

      {view === 'prg' ? (
        <PrgView />
      ) : view === 'modules' ? (
        <ModulesView />
      ) : view === 'dict' ? (
        <DictionaryView />
      ) : view === 'fa' ? (
        <FaView />
      ) : doc && stats ? (
        <>
          <div className="flex items-center gap-4 border-b border-line bg-panel/40 px-4 py-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t(lang, 'searchPlaceholder')}
              spellCheck={false}
              className="w-80 rounded-lg border border-line bg-panel px-3 py-1.5 text-sm text-fg outline-none transition-colors placeholder:text-faint2 focus:border-blue-600"
            />
            <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-mut">
              <input
                type="checkbox"
                checked={changedOnly}
                onChange={(e) => setChangedOnly(e.target.checked)}
                className="accent-blue-600"
              />
              {t(lang, 'changedOnly')}
            </label>
            {linkedModule && (
              <span
                className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-1 text-xs text-emerald-600"
                title={lang === 'ru' ? 'Модуль определён по совпадению функций' : 'Module matched by function names'}
              >
                {lang === 'ru' ? 'Модуль' : 'Module'}: <span className="font-mono">{linkedModule.fileName}</span> ({linkedModule.matchPct}%)
              </span>
            )}
            <div className="flex items-center rounded-lg border border-line bg-panel p-0.5">
              {([['cards', 'Карточки', 'Cards'], ['table', 'Таблица', 'Table']] as const).map(
                ([v, ru, en]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => {
                      setCardsView(v === 'cards')
                      localStorage.setItem('cardsView', v)
                    }}
                    className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                      (cardsView ? 'cards' : 'table') === v
                        ? 'bg-panel2 font-medium text-fg'
                        : 'text-mut hover:text-fg'
                    }`}
                  >
                    {lang === 'ru' ? ru : en}
                  </button>
                ),
              )}
            </div>
            <div className="ml-auto text-xs text-faint">
              {rows.length} / {stats.options} {t(lang, 'ofOptions')}
              {stats.changed > 0 && (
                <span className="ml-2 text-amber-600">· {stats.changed} {t(lang, 'changed')}</span>
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-1">
            <div className="flex min-w-0 flex-1 flex-col">
              {!cardsView && (
                <div
                  className={`grid ${GRID} items-center gap-3 border-b border-line bg-panel/60 px-4 py-2 text-xs font-medium uppercase tracking-wider text-faint`}
                >
                  <div>{t(lang, 'name')}</div>
                  <div>{t(lang, 'value')}</div>
                  <div>{t(lang, 'translation')}</div>
                  <div />
                </div>
              )}
              {cardsView ? (
                <OptionCards rows={rows} />
              ) : (
                <OptionTable rows={rows} />
              )}
              <ChangesPanel />
            </div>
            <DetailPanel />
          </div>
        </>
      ) : (
        <EmptyState />
      )}

      <StatusBar />

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-sel backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-blue-500 px-12 py-8 text-lg font-medium text-blue-200">
            {t(lang, 'dropToOpen')}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-12 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-line bg-panel2 px-4 py-2 text-sm text-fg shadow-xl">
          {toast}
        </div>
      )}

      {faqOpen && <FaqModal />}
    </div>
  )
}
