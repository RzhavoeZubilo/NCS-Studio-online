import { useStore } from '@/state/store'
import { docStats } from '@/lib/trc'
import { t } from '@/lib/i18n'

export function StatusBar() {
  const lang = useStore((s) => s.lang)
  const doc = useStore((s) => s.doc)
  const translations = useStore((s) => s.translations)
  const translationsFile = useStore((s) => s.translationsFile)
  const translationsFromCache = useStore((s) => s.translationsFromCache)
  const stats = doc ? docStats(doc) : null

  return (
    <div className="flex h-7 shrink-0 items-center gap-4 border-t border-line bg-panel/60 px-4 text-xs text-faint">
      <span className="font-medium text-fg2">{doc ? doc.fileName : t(lang, 'noFileOpen')}</span>
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
        {translations
          ? `${t(lang, 'translationsDbShort')}: ${translations.size} ${t(lang, 'entries')} (${translationsFile}${
              translationsFromCache ? ', ' + t(lang, 'fromCache') : ''
            })`
          : t(lang, 'translationsNotLoaded')}
      </span>
    </div>
  )
}
