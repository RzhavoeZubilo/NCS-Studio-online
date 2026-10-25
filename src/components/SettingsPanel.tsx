import { Trash2, X } from 'lucide-react'
import { useStore } from '@/state/store'
import { t } from '@/lib/i18n'

function Segment({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center rounded-lg border border-line bg-panel p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1 text-sm transition-colors ${
            value === o.value
              ? 'bg-panel2 font-medium text-fg'
              : 'text-mut hover:text-fg'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const lang = useStore((s) => s.lang)
  const overlay = useStore((s) => s.overlay)
  const overlayFile = useStore((s) => s.overlayFile)
  const clearOverlay = useStore((s) => s.clearOverlay)
  const setView = useStore((s) => s.setView)
  const setLang = useStore((s) => s.setLang)
  const paramLang = useStore((s) => s.paramLang)
  const setParamLang = useStore((s) => s.setParamLang)
  const showToast = useStore((s) => s.showToast)

  const field = 'text-xs font-medium uppercase tracking-wide text-faint'

  return (
    <div className="absolute right-2 top-12 z-40 w-96 rounded-xl border border-line bg-panel p-4 shadow-2xl">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-fg">{t(lang, 'settings')}</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-faint transition-colors hover:bg-panel2 hover:text-fg"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <div className={field}>{t(lang, 'interfaceLanguage')}</div>
          <div className="mt-1.5">
            <Segment
              options={[
                { value: 'en', label: 'English' },
                { value: 'ru', label: 'Русский' },
              ]}
              value={lang}
              onChange={(v) => setLang(v as typeof lang)}
            />
          </div>
        </div>

        <div>
          <div className={field}>{t(lang, 'parameterTranslations')}</div>
          <div className="mt-1.5">
            <Segment
              options={[
                { value: 'original', label: lang === 'ru' ? 'Оригинал' : 'Original' },
                { value: 'en', label: 'EN' },
                { value: 'ru', label: 'RU' },
              ]}
              value={paramLang}
              onChange={(v) => setParamLang(v as typeof paramLang)}
            />
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-faint2">
            {lang === 'ru'
              ? 'Русский язык — встроенный словарь терминов BMW + ваши дополнения из режима «Словарь».'
              : 'Russian uses the built-in BMW term dictionary plus your additions from the Dictionary view.'}
          </p>
        </div>

        <div>
          <div className={field}>{lang === 'ru' ? 'Ваши дополнения (оверлей)' : 'Your additions (overlay)'}</div>
          <div className="mt-1.5 flex items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate text-fg2">
              {overlay
                ? `${Object.keys(overlay).length} ${lang === 'ru' ? 'записей' : 'entries'}${overlayFile ? ' · ' + overlayFile : ''}`
                : lang === 'ru'
                  ? 'Пусто — заполняется в режиме «Словарь»'
                  : 'Empty — fill it in the Dictionary view'}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setView('dict')}
              className="rounded-lg border border-line bg-panel px-3 py-1.5 text-sm text-fg2 transition-colors hover:bg-panel2 hover:text-fg"
            >
              {lang === 'ru' ? 'Открыть словарь' : 'Open dictionary'}
            </button>
            {overlay && (
              <button
                type="button"
                onClick={() => {
                  void clearOverlay()
                  showToast(lang === 'ru' ? 'Словарь очищен' : 'Dictionary cleared')
                }}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-line bg-panel px-3 py-1.5 text-sm text-mut transition-colors hover:bg-panel2 hover:text-fg"
              >
                <Trash2 className="h-3.5 w-3.5" /> {t(lang, 'clearDb')}
              </button>
            )}
          </div>
        </div>

        <p className="text-xs leading-relaxed text-faint2">{t(lang, 'dbStoredLocally')}</p>
      </div>
    </div>
  )
}
