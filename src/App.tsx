import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useStore } from '@/state/store'
import { t } from '@/lib/i18n'
import { TopBar } from '@/components/TopBar'
import { Sidebar } from '@/components/Sidebar'
import { Workspace } from '@/components/Workspace'
import { PrgView } from '@/components/PrgView'
import { DictionaryView } from '@/components/DictionaryView'
import { FaView } from '@/components/FaView'
import { FaqModal } from '@/components/FaqModal'

/** Tool views (FA reference, dictionary, PRG viewer) replace the workspace with a way back. */
function ToolFrame({ title, children }: { title: string; children: React.ReactNode }) {
  const lang = useStore((s) => s.lang)
  const setView = useStore((s) => s.setView)
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-line bg-panel/40 px-4 py-1.5">
        <button
          type="button"
          onClick={() => setView('coding')}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-mut transition-colors hover:bg-panel2 hover:text-fg"
        >
          <ArrowLeft className="h-4 w-4" />
          {lang === 'ru' ? 'К кодированию' : 'Back to coding'}
        </button>
        <span className="text-sm font-medium text-fg">{title}</span>
      </div>
      {children}
    </div>
  )
}

export default function App() {
  const doc = useStore((s) => s.doc)
  const spDaten = useStore((s) => s.spDaten)
  const openFile = useStore((s) => s.openFile)
  const view = useStore((s) => s.view)
  const theme = useStore((s) => s.theme)
  const faqOpen = useStore((s) => s.faqOpen)
  const restoreOverlay = useStore((s) => s.restoreOverlay)
  const restoreSpDaten = useStore((s) => s.restoreSpDaten)
  const linkModule = useStore((s) => s.linkModule)
  const toast = useStore((s) => s.toast)
  const lang = useStore((s) => s.lang)
  const [dragging, setDragging] = useState(false)
  const ru = lang === 'ru'

  // Apply theme.
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  // Restore the Russian dictionary overlay and the remembered SP-Daten folder on startup.
  useEffect(() => {
    void restoreOverlay()
    void restoreSpDaten()
  }, [restoreOverlay, restoreSpDaten])

  // Link the open trace to an SP-Daten module when both are present.
  useEffect(() => {
    linkModule()
  }, [doc, spDaten, linkModule])

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

  // Auto-hide toasts.
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => useStore.getState().showToast(''), 2500)
    return () => clearTimeout(t)
  }, [toast])

  return (
    <div className="flex h-full flex-col">
      <TopBar />

      {view === 'prg' ? (
        <ToolFrame title={ru ? 'Джобы ЭБУ (.prg)' : 'ECU jobs (.prg)'}>
          <PrgView />
        </ToolFrame>
      ) : view === 'dict' ? (
        <ToolFrame title={ru ? 'Словарь переводов' : 'Translation dictionary'}>
          <DictionaryView />
        </ToolFrame>
      ) : view === 'fa' ? (
        <ToolFrame title={ru ? 'Справочник опций (FA)' : 'Option codes (FA)'}>
          <FaView />
        </ToolFrame>
      ) : (
        <div className="flex min-h-0 flex-1">
          <Sidebar />
          <Workspace />
        </div>
      )}

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-sel backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-blue-500 px-12 py-8 text-lg font-medium text-blue-200">
            {t(lang, 'dropToOpen')}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-line bg-panel2 px-4 py-2 text-sm text-fg shadow-xl">
          {toast}
        </div>
      )}

      {faqOpen && <FaqModal />}
    </div>
  )
}
