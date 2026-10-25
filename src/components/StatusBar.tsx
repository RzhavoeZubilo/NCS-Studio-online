import { useStore } from '@/state/store'
import { docStats } from '@/lib/trc'
import { t } from '@/lib/i18n'

export function StatusBar() {
  const lang = useStore((s) => s.lang)
  const doc = useStore((s) => s.doc)
  const stats = doc ? docStats(doc) : null

  return (
    <div className="flex h-7 shrink-0 items-center gap-4 border-t border-line bg-panel/60 px-4 text-xs text-faint">
      <span className="font-medium text-fg">{doc ? doc.fileName : t(lang, 'noFileOpen')}</span>
      {doc && <span>{doc.eol === '\r\n' ? 'CRLF' : 'LF'}</span>}
      {stats && (
        <span>
          {stats.options} {t(lang, 'ofOptions')}
        </span>
      )}
      {stats && stats.changed > 0 && (
        <span className="text-amber-600">
          {stats.changed} {t(lang, 'changed')}
        </span>
      )}
      {stats && stats.binary > 0 && (
        <span>
          {stats.binary} {t(lang, 'nettodataRecords')}
        </span>
      )}
      <span className="ml-auto">
        {lang === 'ru' ? 'Словарь: встроенный (RU)' : 'Dictionary: built-in (RU)'}
      </span>
    </div>
  )
}
