import { useRef } from 'react'
import type { ChangeEvent } from 'react'
import { FileCode2, Upload } from 'lucide-react'
import { useStore } from '@/state/store'
import { t } from '@/lib/i18n'

export function EmptyState() {
  const lang = useStore((s) => s.lang)
  const hasDb = useStore((s) => !!s.translations)
  const inputRef = useRef<HTMLInputElement>(null)
  const openFile = useStore((s) => s.openFile)

  const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) void openFile(file)
  }

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="w-full max-w-lg rounded-2xl border-2 border-dashed border-line p-10 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-panel">
          <FileCode2 className="h-7 w-7 text-blue-500" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-fg">{t(lang, 'openCodingFile')}</h2>
        <p className="mt-1 text-sm text-faint">{t(lang, 'dropTrc')}</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
        >
          <Upload className="h-4 w-4" /> {t(lang, 'chooseFile')}
        </button>
        <p className="mt-6 text-xs text-faint2">
          {t(lang, hasDb ? 'translationsTip' : 'translationsTipMissing')}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".trc,.man,.txt,.prg,.csv"
          className="hidden"
          onChange={(e) => void onPick(e)}
        />
      </div>
    </div>
  )
}
